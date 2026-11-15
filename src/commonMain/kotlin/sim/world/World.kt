package sim.world

import base.Vector2
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.sin
import kotlin.random.Random
import sim.animal.Action
import sim.animal.Animal
import sim.animal.AnimalStats
import sim.animal.Brain
import sim.animal.Mind
import sim.objects.Carcass
import sim.objects.Egg
import sim.objects.SimObject
import sim.objects.Grass
import sim.objects.Plant
import sim.objects.Tree
import sim.species.Species
import sim.species.Trait
import terrain.Terrain

/** An exploring animal has arrived when this close (tiles) to its far-away target. */
internal const val EXPLORE_ARRIVE = 1.5

/**
 * Trait ALARM_CALLING: one alarm raised this tick by a fleeing [caller], naming the [threat] it is running from
 * (docs/sim/SPECIES.md). The sound comes from the caller's position, so an animal that hears it learns where the
 * caller is, not where the predator is. Any species with Trait.HEARING picks it up - predators included, which
 * is what makes calling a gamble rather than a free warning.
 */
internal class Alarm(val caller: Animal, val threat: Animal)

/** Holds the whole simulation state. The species are fixed when the world is created and never change. */
class World(
    val terrain: Terrain,
    val species: List<Species>,
    seed: Long = 0L,
) {
    val animals = mutableListOf<Animal>()

    /** Trees, grass, carcasses and other non-animal objects. */
    val objects = mutableListOf<SimObject>()

    /** The trees in [objects] (they never move or disappear), so food searches need not scan other objects. */
    internal val trees = ArrayList<Tree>()

    /** The grass tufts in [objects] (they never move or disappear), in the order the frontend receives them. */
    val grasses = ArrayList<Grass>()

    /** The carcasses in [objects]. */
    internal val carcasses = ArrayList<Carcass>()

    /** The eggs in [objects] that have not hatched or been eaten yet. */
    internal val eggs = ArrayList<Egg>()

    /** The world clock and day-night cycle. */
    val clock = Clock()

    internal val rng = Random(seed)
    private val brain = Brain(this)
    private val pathfinder = Pathfinder(terrain)
    private var nextId = 0

    /** Total animals killed by other animals so far this run. */
    var predatoryDeaths = 0
        private set

    /** Total animals that died of starvation, thirst or other non-predatory causes so far this run. */
    var naturalDeaths = 0
        private set

    /** Per species (indexed like [species]): animals that died of starvation or thirst so far this run. */
    val naturalDeathsBySpecies = IntArray(species.size)

    /** Per species (indexed like [species]): living animals summed over every tick so far, i.e. animal-ticks lived. */
    val animalTicksBySpecies = LongArray(species.size)

    /** Living animals that hunt, refreshed each tick; fear only needs to look at these. */
    internal var hunters: List<Animal> = emptyList()
        private set

    /** Living animals by map cell, rebuilt each tick, so searches only visit animals within view range. */
    internal val animalGrid = SpatialGrid<Animal>(terrain.width, terrain.height)

    /** Living hunters by map cell, rebuilt each tick, for fear checks. */
    internal val hunterGrid = SpatialGrid<Animal>(terrain.width, terrain.height)

    /** Eggs by map cell, rebuilt each tick. */
    internal val eggGrid = SpatialGrid<Egg>(terrain.width, terrain.height)

    /** Carcasses by map cell, rebuilt each tick. */
    internal val carcassGrid = SpatialGrid<Carcass>(terrain.width, terrain.height)

    /** Trees by map cell (trees never move). */
    internal val treeGrid = SpatialGrid<Tree>(terrain.width, terrain.height)

    /** Grass tufts by map cell (grass never moves). */
    internal val grassGrid = SpatialGrid<Grass>(terrain.width, terrain.height)

    /** Alarms raised this tick, by the map cell of the caller; rebuilt at the start of every sensing step. */
    internal val alarmGrid = SpatialGrid<Alarm>(terrain.width, terrain.height)

    /** Alarms raised this tick (docs/sim/SPECIES.md); rebuilt at the start of every sensing step. */
    internal val alarms = ArrayList<Alarm>()

    /** Where animals can drink and how to walk there. */
    internal val water = shoreField(terrain)

    /** Tiles that contain trees (trees never move), for animals that cannot see any food nearby. Built on first use. */
    internal val treeField: DistanceField by lazy {
        val tiles = trees.map { floor(it.position.y).toInt() * terrain.width + floor(it.position.x).toInt() }.toSet()
        DistanceField(terrain) { x, y -> (y * terrain.width + x) in tiles }
    }

    /** Trees by the index (y * width + x) of the tile they stand on. Built on first use. */
    internal val treesByTile: Map<Int, List<Tree>> by lazy {
        trees.groupBy { floor(it.position.y).toInt() * terrain.width + floor(it.position.x).toInt() }
    }

    // Per-tick counters for verbose logging.
    private var moved = 0
    private var ate = 0
    private var drank = 0
    private var attacks = 0
    private var births = 0
    private var poisoned = 0

    private companion object {
        /** Distance (tiles) to an edible object within which an animal can eat it. */
        const val EAT_REACH = 0.6
        /** Distance to a shore tile centre within which an animal can drink. */
        const val DRINK_REACH = 1.2
        const val EAT_RATE = 2.0
        /** Replan a path after this many ticks, since targets move. */
        const val PATH_REFRESH_TICKS = 40
        /** A waypoint counts as reached within this many tiles. */
        const val WAYPOINT_REACH = 0.6
        /** A hunter sprints (costing stamina) only when within this many tiles of its prey. */
        const val SPRINT_RANGE = 12.0
        const val DRINK_RATE = 3.0
        /** Fraction of full speed while wandering. */
        const val WANDER_SPEED = 0.4
        /** Chance per tick that a wandering animal picks a new direction. */
        const val WANDER_TURN_CHANCE = 0.03

        /** A fleeing animal runs within this many radians either side of straight away from the predator (about 60 degrees). */
        const val FLEE_SPREAD = 1.05

        /** Chance per tick that a fleeing animal picks a new direction within [FLEE_SPREAD]. */
        const val FLEE_TURN_CHANCE = 0.03
        /** HP regained per tick by REGENERATION animals that are not starving. */
        const val REGEN_RATE = 0.1
        /** Smallest share of its raw damage a bite always does, however armored the target (see [biteDamage]). */
        const val MIN_DAMAGE_SHARE = 0.1
        /** SOFT_CODED reward for each parent when an offspring is born or an egg laid (before [REWARD_SCALE]). */
        const val BIRTH_REWARD = 1.0
        /** SOFT_CODED rewards (status changes and births) are multiplied by this so they are large enough, next to the network's random start, to learn from quickly. */
        const val REWARD_SCALE = 10.0
        /** SOFT_CODED reward weight of HP change (as a fraction of max HP) relative to the nutrition and hydration [wellbeing] change. */
        const val HP_REWARD_WEIGHT = 2.0
        /** Angles (radians) tried, in order, when the straight path is blocked. */
        val MOVE_OFFSETS = doubleArrayOf(0.0, 0.7, -0.7, 1.4, -1.4)
    }

    /** Spawns an animal; animals are ground-only so the tile must be walkable. */
    fun spawn(s: Species, at: Vector2): Animal {
        require(s in species) { "$s is not a species of this world" }
        require(terrain.isWalkable(floor(at.x).toInt(), floor(at.y).toInt())) { "cannot spawn $s at $at: tile not walkable" }
        val mind = if (Trait.SOFT_CODED in s.traits) Mind.founder(rng) else null
        return Animal(nextId++, s, at, mind = mind).also { animals.add(it) }
    }

    /** Adds a non-animal object built from a freshly allocated id; its tile must be walkable. */
    fun <T : SimObject> spawnObject(at: Vector2, create: (id: Int, position: Vector2) -> T): T {
        require(terrain.isWalkable(floor(at.x).toInt(), floor(at.y).toInt())) { "cannot place object at $at: tile not walkable" }
        return create(nextId++, at).also {
            objects.add(it)
            if (it is Tree) { trees.add(it); treeGrid.add(it, it.position) }
            if (it is Grass) { grasses.add(it); grassGrid.add(it, it.position) }
        }
    }

    /** Removes objects that report [SimObject.isRemoved] (e.g. fully eaten carcasses). */
    fun removeFinishedObjects(): Boolean {
        carcasses.removeAll { it.isRemoved }
        eggs.removeAll { it.isRemoved }
        return objects.removeAll { it.isRemoved }
    }

    /** Removes dead animals from the world. */
    fun removeDead() = animals.removeAll { !it.isAlive }

    /** One-line state description: time, population per species, trees and carcasses. */
    fun summary(): String {
        val pops = species.joinToString(", ") { s -> "${s.name}=${animals.count { it.species == s }}" }
        val trees = objects.filterIsInstance<Tree>()
        return "[${clock.format()} ${clock.phase}] population: $pops | trees edible ${trees.count { it.isEdible }}/${trees.size} | grass edible ${grasses.count { it.isEdible }}/${grasses.size} | carcasses ${objects.count { it is Carcass }}"
    }

    // ################################################################ TICK PROCESS

    /**
     * Advances the simulation by one tick: Time, Decide, Act, Life. Major events (day-night changes,
     * births, deaths, extinctions) are always printed; the process/phase/step banners only if [verbose].
     */
    fun tick(verbose: Boolean = false) {
        val log = TickLog(verbose)
        log.process("World Tick ${clock.tick + 1}")
        timePhase(log)
        decidePhase(log)
        actPhase(log)
        lifePhase(log)
    }

    // ============================================================ 1/4 Time

    private fun timePhase(log: TickLog) {
        log.phase("1/4 Time")
        log.step("1/2 Advance clock")
        val phaseBefore = clock.phase
        val dayBefore = clock.day
        clock.advance()
        log.info { "tick ${clock.tick}: ${clock.format()} (${clock.phase})" }
        if (clock.day != dayBefore) simEvent("[${clock.format()}] NEW DAY: day ${clock.day} begins")
        if (clock.phase != phaseBefore) simEvent("[${clock.format()}] ${clock.phase} begins")

        log.step("2/2 Tick objects")
        objects.forEach { it.tick() }
        log.info { "ticked ${objects.size} objects" }
        hatchEggs()
    }

    // ============================================================ 2/4 Decide

    private fun decidePhase(log: TickLog) {
        log.phase("2/4 Decide")
        brain.listeners = 0
        log.step("1/3 Sense")
        hunters = animals.filter { it.isAlive && it.species.canHunt }
        animalGrid.clear(); hunterGrid.clear(); carcassGrid.clear(); eggGrid.clear()
        for (a in animals) if (a.isAlive) { animalGrid.add(a, a.position); if (a.species.canHunt) hunterGrid.add(a, a.position) }
        for (c in carcasses) if (!c.isRemoved) carcassGrid.add(c, c.position)
        for (e in eggs) if (!e.isRemoved) eggGrid.add(e, e.position)
        raiseAlarms()
        log.info { "${alarms.size} alarm calls are sounding" }
        var soft = 0
        for (a in animals) a.mind?.let { brain.sense(a, it); soft++ }
        log.info { "$soft SOFT_CODED animals sensed their surroundings" }

        log.step("2/3 Feel")
        for (a in animals) a.feelings = a.mind?.let { brain.feelSoft(a, it) } ?: brain.feel(a)
        log.info { "updated feelings of ${animals.size} animals (${animals.size - soft} by rules, $soft by network)" }

        log.step("3/3 Choose actions")
        brain.observations = 0
        for (a in animals) {
            a.action = a.mind?.let { brain.decideSoft(a, it) } ?: brain.decide(a)
            val f = a.feelings
            log.info { "${a.label}: ${a.action} (fear=${fmt1(f.fear)} hunger=${fmt1(f.hunger)} thirst=${fmt1(f.thirst)} libido=${fmt1(f.libido)}) age=${fmt1(a.age)} hp=${fmt1(a.hp)} nutrition=${fmt1(a.nutrition)} hydration=${fmt1(a.hydration)} stamina=${fmt1(a.stamina)}" }
        }
        log.info { "SOFT_CODED decisions were observed ${brain.observations} times by same-species onlookers" }
        log.info { "${brain.listeners} animals acted on something they heard rather than saw" }
    }

    /**
     * Trait ALARM_CALLING: every animal of a calling species that is running from a predator it can actually see
     * sounds an alarm, paying [Species.alarmCallStaminaCost] for it. An animal fleeing on hearsay stays quiet, so
     * one call cannot cascade through a whole population, and [Animal.tickAlarmCall] rations the calling into short
     * bursts with a quiet spell between them rather than one call every tick of a flee. Callers are read from the
     * action and feelings of last tick, so an alarm always reaches listeners one tick after the danger was spotted
     * (docs/sim/SPECIES.md).
     */
    private fun raiseAlarms() {
        alarms.clear(); alarmGrid.clear()
        for (a in animals) {
            val act = a.action
            val wants = a.isAlive && a.species.canCallAlarm && act is Action.RunFromPredator && act.predator.isAlive &&
                !a.feelings.threatHeardOnly
            if (a.tickAlarmCall(wants)) {
                val alarm = Alarm(a, (act as Action.RunFromPredator).predator)
                alarms.add(alarm)
                alarmGrid.add(alarm, a.position)
                a.changeStamina(-a.species.alarmCallStaminaCost)
            }
        }
    }

    // ============================================================ 3/4 Act

    private fun actPhase(log: TickLog) {
        moved = 0; ate = 0; drank = 0; attacks = 0; births = 0
        log.phase("3/4 Act")
        log.step("1/2 Move animals")
        val before = animals.map { it.position }
        for (a in animals) if (a.isAlive) move(a)
        moved = animals.indices.count { animals[it].position != before[it] }
        val sprinted = animals.count { it.isSprinting }
        val exhausted = animals.count { it.species.canSprint && it.sprintCharge <= 0 }
        log.info { "$moved of ${animals.size} animals moved; $sprinted sprinted, $exhausted out of sprint reserve" }

        log.step("2/2 Resolve eating, drinking, attacks and reproduction")
        for (a in animals.toList()) if (a.isAlive) interact(a)
        log.info { "attacks=$attacks meals=$ate drinks=$drank births=$births" }
    }

    /** Moves the animal toward or away from its action's target. */
    private fun move(a: Animal) {
        val s = a.species
        // Trait SPRINTING: fleeing and the final dash of a hunt are a sprint, but only for a species that can
        // sprint and still has reserve and stamina left; everything else moves at a walk (docs/sim/SPECIES.md).
        val sprinting = wantsToSprint(a) && a.canSprintNow
        a.isSprinting = sprinting
        val speed = a.stats.speed * a.speedFactor * (if (sprinting) s.sprintSpeedMultiplier else 1.0)
        val before = a.position
        when (val act = a.action) {
            Action.Rest -> {}
            Action.Wander -> wander(a)
            is Action.Explore -> if (!standingAtGoal(a)) moveToward(a, act.target, speed)
            is Action.RunFromPredator -> {
                val p = act.predator.position
                // Generally away from the predator, but not exactly: veer by a random offset that is only re-rolled occasionally.
                if (rng.nextDouble() < FLEE_TURN_CHANCE) a.fleeOffset = (rng.nextDouble() * 2 - 1) * FLEE_SPREAD
                val away = atan2(a.position.y - p.y, a.position.x - p.x)
                if (!tryMove(a, away + a.fleeOffset, speed)) a.fleeOffset = (rng.nextDouble() * 2 - 1) * FLEE_SPREAD
            }
            is Action.AttackTarget -> if (!inAttackReach(a, act.target)) moveToward(a, act.target.position, speed)
            is Action.DrinkWater -> if (!canDrink(a, act.target)) moveToward(a, act.target, speed)
            is Action.ReproduceWith -> if (act.target.isAlive && a.position.distanceTo(act.target.position) > s.reproductionRange) {
                moveToward(a, act.target.position, speed)
            }
            is Action.EatFood -> if (!act.target.isRemoved && !inEatReach(a, act.target)) {
                moveToward(a, act.target.position, speed)
            }
        }
        // Unstick: an animal that keeps failing to move tries a random direction.
        val wantsToMove = a.action != Action.Rest && a.action != Action.Wander
        if (wantsToMove && a.position == before && !standingAtGoal(a)) {
            if (++a.blockedTicks >= 3) {
                tryMove(a, rng.nextDouble() * 2 * kotlin.math.PI, speed)
                a.blockedTicks = 0
            }
        } else {
            a.blockedTicks = 0
        }
        // An animal that got nowhere this tick (blocked, or already at its goal) did not really sprint, so it pays nothing.
        a.movedThisTick = a.position != before
        if (!a.movedThisTick) a.isSprinting = false
        // Stamina: always regenerates slowly and always drains a base amount; walking adds its usage on top, sprinting its own cost.
        val moveCost = when {
            a.position == before || a.action == Action.Wander -> 0.0
            a.isSprinting -> s.staminaSprintCost
            else -> a.stats.walkingStaminaUsage
        }
        a.changeStamina(a.staminaRegen - a.baseStaminaUsage - moveCost)
        // Sprint reserve: one tick of it is spent per tick sprinted, and it refills whenever the animal is not sprinting.
        a.sprintCharge = (a.sprintCharge + if (a.isSprinting) -1.0 else s.sprintRecharge).coerceIn(0.0, s.sprintChargeTicks)
    }

    /**
     * Whether the animal's current action is one it would sprint for: running from a predator, or closing the
     * last [SPRINT_RANGE] tiles on prey (predators stalk at a walk before that).
     */
    private fun wantsToSprint(a: Animal): Boolean = when (val act = a.action) {
        is Action.RunFromPredator -> true
        is Action.AttackTarget -> a.position.distanceTo(act.target.position) <= SPRINT_RANGE
        else -> false
    }

    /** Eats, drinks or attacks if the animal is already within reach of its target. */
    private fun interact(a: Animal) {
        when (val act = a.action) {
            is Action.AttackTarget -> if (act.target.isAlive && inAttackReach(a, act.target) && a.stats.damage > 0) {
                resolveBite(a, act.target)
                attacks++
            }
            is Action.ReproduceWith -> if (a.reproductionCooldown == 0 &&
                act.target.reproductionCooldown == 0 && a.canReproduceWith(act.target)
            ) {
                reproduce(a, act.target)
                births++
            }
            is Action.DrinkWater -> if (canDrink(a, act.target)) {
                a.changeHydration(DRINK_RATE)
                drank++
            }
            is Action.EatFood -> {
                val t = act.target
                if (!t.isRemoved && inEatReach(a, t)) {
                    val gained = when (t) {
                        is Plant -> t.eat()
                        is Carcass -> t.eat(EAT_RATE)
                        is Egg -> t.eat(EAT_RATE)
                        else -> 0.0
                    }
                    if (gained > 0) { a.changeNutrition(gained); ate++ }
                }
            }
            else -> {}
        }
    }

    /**
     * One tick of [attacker] biting [target]: the bite itself, then everything the exchange sets off. Trait
     * VENOMOUS leaves a toxin in the target; traits POISONOUS and SPIKES hit the attacker back for biting, poison
     * as a toxin that goes on working and spikes as damage here and now (docs/sim/SPECIES.md). The defences fire
     * even if the bite was fatal: the animal was alive and defending itself when it was bitten.
     */
    private fun resolveBite(attacker: Animal, target: Animal) {
        val ts = target.species
        target.hurt(biteDamage(attacker, target), "killed by ${attacker.label}", byAnimal = true)
        if (attacker.species.isVenomous) {
            target.applyToxin(attacker.species.venomDamage, attacker.species.venomTicks, "died of ${attacker.label}'s venom")
        }
        if (ts.isPoisonous) attacker.applyToxin(ts.poisonDamage, ts.poisonTicks, "poisoned by biting ${target.label}")
        if (ts.hasSpikes) attacker.hurt(ts.spikeDamage, "killed by ${target.label}'s spikes", byAnimal = true)
    }

    /**
     * Damage one bite by [attacker] does to [target]: the attacker's damage less the target's ARMOR percentage,
     * less a flat [Species.hardSkinReduction] for Trait.HARD_SKIN. A bite always lands at least
     * [MIN_DAMAGE_SHARE] of its raw damage, so no combination of armor and hard skin makes an animal invulnerable
     * and leaves a predator chewing forever. The floor cannot bind on armor alone (it caps at
     * [sim.animal.AnimalStats.MAX_ARMOR_REDUCTION]), so hard skin is the only thing that can reach it.
     */
    private fun biteDamage(attacker: Animal, target: Animal): Double {
        val raw = attacker.stats.damage
        var dealt = raw * (1 - target.stats.armorReduction)
        if (target.species.hasHardSkin) dealt -= target.species.hardSkinReduction
        return max(dealt, raw * MIN_DAMAGE_SHARE)
    }

    /** Whether a straight walk from [from] to [to] stays on walkable tiles (no lake or sea in between). */
    internal fun isClearWalk(from: Vector2, to: Vector2): Boolean {
        val steps = (from.distanceTo(to) * 2).toInt() + 1
        for (i in 1..steps) {
            val t = i.toDouble() / steps
            val x = from.x + (to.x - from.x) * t
            val y = from.y + (to.y - from.y) * t
            if (!terrain.isWalkable(floor(x).toInt(), floor(y).toInt())) return false
        }
        return true
    }

    /** Whether the animal is already where its action wants it, so not moving is expected. */
    private fun standingAtGoal(a: Animal): Boolean = when (val act = a.action) {
        is Action.DrinkWater -> canDrink(a, act.target)
        is Action.Explore -> a.position.distanceTo(act.target) <= EXPLORE_ARRIVE
        is Action.EatFood -> act.target.isRemoved || inEatReach(a, act.target)
        is Action.AttackTarget -> inAttackReach(a, act.target)
        is Action.ReproduceWith -> !act.target.isAlive || a.position.distanceTo(act.target.position) <= a.species.reproductionRange
        else -> false
    }

    /** An animal can drink when it stands on a shore tile or is within reach of its chosen drinking spot. */
    private fun canDrink(a: Animal, spot: Vector2) =
        water.distanceFrom(a.position) == 0 || a.position.distanceTo(spot) <= DRINK_REACH

    private fun inEatReach(a: Animal, t: SimObject) = a.position.distanceTo(t.position) <= EAT_REACH

    private fun inAttackReach(a: Animal, t: Animal) =
        a.position.distanceTo(t.position) <= a.radius + t.radius + a.species.attackRange

    /** Walks toward [target]: straight if the way is clear, otherwise along a path around lakes and the sea. */
    private fun moveToward(a: Animal, target: Vector2, speed: Double) {
        val goal = if (isClearWalk(a.position, target)) {
            a.path.clear(); a.pathGoal = -1
            target
        } else {
            nextWaypoint(a, target) ?: target
        }
        tryMove(a, atan2(goal.y - a.position.y, goal.x - a.position.x), speed)
    }

    /** Next waypoint on the animal's path to [target], (re)planning when the goal changed or the path is stale. */
    private fun nextWaypoint(a: Animal, target: Vector2): Vector2? {
        val goalTile = floor(target.y).toInt() * terrain.width + floor(target.x).toInt()
        if (a.pathGoal != goalTile || a.path.isEmpty() || ++a.pathAge > PATH_REFRESH_TICKS) {
            a.path.clear()
            pathfinder.findPath(a.position, target)?.let { a.path.addAll(it) }
            a.pathGoal = goalTile
            a.pathAge = 0
        }
        while (a.path.isNotEmpty() && a.position.distanceSquaredTo(a.path.first()) < WAYPOINT_REACH * WAYPOINT_REACH) a.path.removeFirst()
        return a.path.firstOrNull()
    }

    /** Random-walk: keeps a heading, occasionally turns, and turns when blocked. */
    private fun wander(a: Animal) {
        if (rng.nextDouble() < WANDER_TURN_CHANCE) a.wanderHeading = rng.nextDouble() * 2 * kotlin.math.PI
        if (!tryMove(a, a.wanderHeading, a.stats.speed * a.speedFactor * WANDER_SPEED)) {
            a.wanderHeading = rng.nextDouble() * 2 * kotlin.math.PI
        }
    }

    /**
     * Steps toward [angle], trying slightly turned directions when the step would leave walkable terrain.
     * Planning around lakes is done by [Pathfinder]; this only handles the last bit of terrain edge.
     */
    private fun tryMove(a: Animal, angle: Double, speed: Double): Boolean {
        for (offset in MOVE_OFFSETS) {
            val ang = angle + offset
            val np = Vector2(a.position.x + cos(ang) * speed, a.position.y + sin(ang) * speed)
            if (terrain.isWalkable(floor(np.x).toInt(), floor(np.y).toInt())) { a.position = np; return true }
        }
        return false
    }

    // ============================================================ 4/4 Life

    private fun lifePhase(log: TickLog) {
        log.phase("4/4 Life")
        log.step("1/4 Metabolism, ageing, regeneration and toxins")
        poisoned = 0
        for (a in animals) {
            val s = a.species
            animalTicksBySpecies[species.indexOf(s)]++
            a.age += 1.0 / TICKS_PER_DAY
            a.changeNutrition(-s.nutritionDrain)
            a.changeHydration(-s.hydrationDrain)
            if (a.reproductionCooldown > 0) a.reproductionCooldown--
            if (a.nutrition <= 0) a.hurt(s.starvationDamage, "starved")
            if (a.hydration <= 0) a.hurt(s.starvationDamage, "died of thirst")
            // Regeneration must not run on an animal that just died, or it would be revived.
            if (!a.isAlive) continue
            if (a.canRegenerateHp) a.changeHp(s.hpRegen)
            if (s.canRegenerate && a.nutrition > 0 && a.hydration > 0) a.changeHp(REGEN_RATE)
            // Traits VENOMOUS and POISONOUS: a toxin keeps damaging its victim after the bite that delivered it.
            if (a.tickToxin()) poisoned++
        }
        log.info { "updated ${animals.size} animals; $poisoned are carrying a toxin" }

        log.step("2/4 Record rewards")
        var rewarded = 0
        var rewardSum = 0.0
        for (a in animals) {
            val m = a.mind ?: continue
            if (!a.isAlive) continue
            if (m.lastHp >= 0) {
                val s = a.species
                var r = wellbeing(a.nutrition / s.maxNutrition) - wellbeing(m.lastNutrition / s.maxNutrition) +
                    wellbeing(a.hydration / s.maxHydration) - wellbeing(m.lastHydration / s.maxHydration) +
                    HP_REWARD_WEIGHT * (a.hp - m.lastHp) / a.stats.maxHp
                r *= REWARD_SCALE
                m.pendingReward += r
                rewardSum += r
                rewarded++
            }
            m.lastHp = a.hp; m.lastNutrition = a.nutrition; m.lastHydration = a.hydration
        }
        log.info { "rewarded $rewarded SOFT_CODED animals (mean reward ${if (rewarded > 0) fmt1(rewardSum / rewarded * 1000) else "0"} per 1000)" }

        log.step("3/4 Train resting brains")
        var trained = 0
        var replays = 0
        for (a in animals) {
            val m = a.mind ?: continue
            if (!a.isAlive || a.action != Action.Rest) continue
            replays += m.train(rng)
            trained++
        }
        log.info { "$trained resting SOFT_CODED animals replayed $replays remembered decisions" }

        log.step("4/4 Deaths")
        val dead = animals.filter { !it.isAlive }
        for (a in dead) {
            if (a.killedByAnimal) predatoryDeaths++ else { naturalDeaths++; naturalDeathsBySpecies[species.indexOf(a.species)]++ }
            simEvent("[${clock.format()}] DEATH ${a.label} at (${fmt1(a.position.x)}, ${fmt1(a.position.y)}): ${a.causeOfDeath ?: "unknown causes"} (was ${a.action})")
            Carcass(nextId++, a.position, a.species.carcassNutrition).also { objects.add(it); carcasses.add(it) }
        }
        removeDead()
        removeFinishedObjects()
        for (s in dead.map { it.species }.distinct()) {
            if (animals.none { it.species == s }) simEvent("[${clock.format()}] EXTINCTION: ${s.name} has died out")
        }
        log.info { "${dead.size} deaths" }
    }

    /** Hatches every egg whose cooldown is over: the egg is removed and the animal with the stats it carried appears. */
    private fun hatchEggs() {
        for (egg in eggs.toList()) {
            if (!egg.readyToHatch) continue
            egg.hatch()
            val s = egg.species
            val child = Animal(nextId++, s, egg.position, egg.stats, nutrition = s.maxNutrition / 2, mind = egg.mind)
            child.reproductionCooldown = s.reproductionCooldownTicks
            animals.add(child)
            simEvent("[${clock.format()}] HATCH ${child.label} hatched from an egg${brainInfo(child.mind)}")
        }
    }

    /**
     * [a] and [mate] reproduce: parent [a] pays the nutrition cost and both go on cooldown. A LIVE_BIRTH newborn appears
     * at [a]'s position at once; an EGG_BIRTH species lays an [Egg] there instead, which hatches later.
     */
    private fun reproduce(a: Animal, mate: Animal) {
        val s = a.species
        val stats = AnimalStats.inherit(s, a.stats, mate.stats, rng)
        val mind = if (a.mind != null && mate.mind != null) Mind.inherit(s, a.mind, mate.mind, rng) else null
        a.mind?.let { it.pendingReward += BIRTH_REWARD * REWARD_SCALE }
        mate.mind?.let { it.pendingReward += BIRTH_REWARD * REWARD_SCALE }
        a.reproductionCooldown = s.reproductionCooldownTicks
        mate.reproductionCooldown = s.reproductionCooldownTicks
        a.changeNutrition(-s.reproductionNutritionCost)
        if (Trait.EGG_BIRTH in s.traits) {
            Egg(nextId++, a.position, s, stats, s.eggHatchTicks, s.eggNutrition, mind).also { objects.add(it); eggs.add(it) }
            simEvent("[${clock.format()}] EGG laid by ${a.label} and ${mate.label}${brainInfo(mind)}")
            return
        }
        val child = Animal(nextId++, s, a.position, stats, nutrition = s.maxNutrition / 2, mind = mind)
        animals.add(child)
        child.reproductionCooldown = s.reproductionCooldownTicks
        simEvent("[${clock.format()}] BIRTH ${child.label} born to ${a.label} and ${mate.label}${brainInfo(mind)}")
    }

    /**
     * How good a need level [fraction] (0 = empty, 1 = full) feels to a SOFT_CODED animal: 1 - (1 - fraction)^2. It is
     * concave, so the same gain is worth much more when the animal is low (drinking while parched) than when nearly full.
     */
    private fun wellbeing(fraction: Double): Double = 1 - (1 - fraction) * (1 - fraction)

    /** " (brain hidden layers [12, 4])" for a SOFT_CODED newborn's [mind], empty otherwise. */
    private fun brainInfo(mind: Mind?) = mind?.let { " (brain hidden layers ${it.net.hiddenSizes})" } ?: ""
}

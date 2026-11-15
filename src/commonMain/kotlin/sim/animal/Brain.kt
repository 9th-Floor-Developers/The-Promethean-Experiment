package sim.animal

import base.Vector2
import sim.objects.SimObject
import kotlin.math.max
import sim.objects.Carcass
import sim.objects.Plant
import sim.objects.Tree
import sim.species.Species
import sim.world.EXPLORE_ARRIVE
import sim.world.TimePhase
import sim.world.World

/**
 * Animal AI (docs/sim/ANIMALS.MD). HARD_CODED animals compute their feelings by fixed rules and pick an [Action]
 * with fixed thresholds. SOFT_CODED animals sense their surroundings ([sense]), their [Mind]'s network turns that
 * into one feeling per [Drive], and the strongest drive is carried out with the same target searches.
 */
internal class Brain(private val world: World) {
    private companion object {
        /** Fear at or above this makes an animal flee. */
        const val FEAR_THRESHOLD = 0.3
        /** Hunger at or above this makes an animal look for food. */
        const val NEED_START = 0.4
        /** Thirst at or above this makes an animal look for water; lower than hunger because water can be far away. */
        const val THIRST_START = 0.3
        /** Once started, an animal keeps eating/drinking until the need drops below this. */
        const val NEED_STOP = 0.15
        /** Resting animals wake up when a need reaches this. */
        const val DESPERATE = 0.55
        /** Thirst at or above this makes an animal stop fleeing distant predators and go drink. */
        const val DYING = 0.85
        /** Fear at or above this (predator very close) overrides even dying of thirst. */
        const val CLOSE_FEAR = 0.6
        /** Thirst counts this much more than hunger when choosing between drinking and eating (it kills faster). */
        const val THIRST_WEIGHT = 1.3
        /** Hunting is costlier than scavenging/grazing; prey distance is scaled by this when comparing. */
        const val HUNT_PENALTY = 3.0
        /** How many of the nearest food candidates are checked for a walkable route before giving up. */
        const val MAX_REACH_CHECKS = 12
        /** Random far-away spots tried when exploring before giving up and wandering. */
        const val EXPLORE_TRIES = 8
        /**
         * Fear from a danger the animal only heard counts this much next to seeing it; hearsay is less urgent than
         * sight. Deliberately below [CLOSE_FEAR], so a call makes an animal run but never triggers the reflex that
         * overrides a desperate need - prey that panic at every sound starve instead of eating.
         */
        const val HEARD_FEAR_DAMPING = 0.4
        /** Share of its view range an animal without Trait.NIGHT_VISION can see by at night. */
        const val NIGHT_SIGHT = 0.5
        /** The same at dawn and dusk, when there is some light left to see by. */
        const val TWILIGHT_SIGHT = 0.75
        /** Ticks of toxin left that the "Poisoned" sense reads as a full 1.0 (see [sense]). */
        const val TOXIN_SENSE_TICKS = 240.0
    }

    /**
     * Trait NIGHT_VISION: how far the animal can actually see right now. Sight is cut to [NIGHT_SIGHT] of its view
     * range at night and [TWILIGHT_SIGHT] at dawn and dusk; a species with the trait sees at its full range
     * whatever the hour (docs/sim/SPECIES.md). [Species.hearingRange] is deliberately left alone by the light, so
     * hearing counts for relatively more in the dark.
     */
    private fun sightRange(a: Animal): Double = a.stats.viewRange * lightFactor(a)

    /** The share of its view range the current light leaves an animal; always 1 with Trait.NIGHT_VISION. */
    private fun lightFactor(a: Animal): Double {
        if (a.species.canSeeInDark) return 1.0
        return when (world.clock.phase) {
            TimePhase.NIGHT -> NIGHT_SIGHT
            TimePhase.DAWN, TimePhase.DUSK -> TWILIGHT_SIGHT
            TimePhase.DAY -> 1.0
        }
    }

    /** Decisions seen by onlookers this tick (one count per onlooker), for the tick log; reset by the world. */
    var observations = 0

    private var scoreBuf = DoubleArray(256)
    private var targetBuf = arrayOfNulls<Any>(256)

    /** Animals that heard something this tick (one count per listener), for the tick log; reset by the world. */
    var listeners = 0

    /** Nearest predator (a hunter of another species) in view range; hunters themselves fear nothing. */
    private fun nearestThreat(a: Animal): Animal? {
        val s = a.species
        if (s.canHunt) return null
        var threat: Animal? = null
        val view = sightRange(a)
        var best = view * view
        world.hunterGrid.forEachNear(a.position, view) { o ->
            if (o.isAlive && o.species != s) {
                val d = a.position.distanceSquaredTo(o.position)
                if (d <= best) { best = d; threat = o }
            }
        }
        return threat
    }

    /** 1 when [o] is right next to the animal, falling to 0 at view range; 0 when there is nothing. */
    private fun closeness(a: Animal, o: Vector2?): Double =
        o?.let { (1 - a.position.distanceTo(it) / sightRange(a)).coerceIn(0.0, 1.0) } ?: 0.0

    // ------------------------------------------------------------ HEARING and ALARM CALLING

    /**
     * Something an animal heard (docs/sim/SPECIES.md): how clearly it came through ([audibility], 1 right next to
     * the animal falling to 0 at the edge of earshot) and which animal it is about - the predator an alarm named,
     * or the animal whose own movement made the noise.
     */
    private class Heard(val audibility: Double, val about: Animal, val heardOnly: Boolean = false)

    /**
     * How clearly a sound of [loudness] (see [Animal.noise]; an alarm call is [Species.ALARM_LOUDNESS]) carries
     * from [from] to the listener: 1 right next to it, falling to 0 at [Species.hearingRange] scaled by the
     * loudness, so a sprinting animal is heard much further off than a calling or walking one.
     */
    private fun audibility(a: Animal, from: Vector2, loudness: Double): Double {
        if (loudness <= 0.0) return 0.0
        val earshot = a.species.hearingRange * loudness
        if (earshot <= 0.0) return 0.0
        return (1 - a.position.distanceTo(from) / earshot).coerceIn(0.0, 1.0)
    }

    /**
     * Trait HEARING: the clearest danger a non-hunting animal heard rather than saw - an alarm call naming a
     * predator, or a predator it heard moving. Alarms from any species count, so prey of different species warn
     * each other. A call only carries [Species.ALARM_LOUDNESS] of earshot, and the predator must itself be within
     * that same range, so a call never reports danger from across the map.
     * Returns null for a species without the trait, and for hunters (they fear nothing).
     */
    private fun heardThreat(a: Animal): Heard? {
        val s = a.species
        if (!s.canHear || s.canHunt) return null
        var best: Heard? = null
        fun consider(audibility: Double, about: Animal) {
            if (audibility > 0.0 && audibility > (best?.audibility ?: 0.0)) best = Heard(audibility, about)
        }
        val callRange = s.hearingRange * Species.ALARM_LOUDNESS
        world.alarmGrid.forEachNear(a.position, callRange) { alarm ->
            if (alarm.caller !== a && alarm.threat.isAlive &&
                a.position.distanceTo(alarm.threat.position) <= callRange
            ) consider(audibility(a, alarm.caller.position, Species.ALARM_LOUDNESS), alarm.threat)
        }
        world.hunterGrid.forEachNear(a.position, s.hearingRange) { o ->
            if (o.isAlive && o.species != s) consider(audibility(a, o.position, o.noise), o)
        }
        return best
    }

    /**
     * Trait HEARING: the clearest animal a hunter heard rather than saw - one it heard moving, or one raising an
     * alarm (a caller gives its own position away, which is what makes calling a gamble). Returns null for a
     * species without the trait and for non-hunters.
     */
    private fun heardPrey(a: Animal): Heard? {
        val s = a.species
        if (!s.canHear || !s.canHunt) return null
        var best: Heard? = null
        fun consider(audibility: Double, about: Animal) {
            if (audibility > 0.0 && audibility > (best?.audibility ?: 0.0)) best = Heard(audibility, about)
        }
        world.alarmGrid.forEachNear(a.position, s.hearingRange * Species.ALARM_LOUDNESS) { alarm ->
            val c = alarm.caller
            if (c.isAlive && c.species != s) consider(audibility(a, c.position, Species.ALARM_LOUDNESS), c)
        }
        world.animalGrid.forEachNear(a.position, s.hearingRange) { o ->
            if (o.isAlive && o.species != s) consider(audibility(a, o.position, o.noise), o)
        }
        return best
    }

    /**
     * Fear and the animal it is about, from sight and from sound together: whichever channel is more urgent wins.
     * A danger that was only heard counts [HEARD_FEAR_DAMPING] of what seeing it would, so an animal reacts to a
     * call but not as hard as to a predator in plain view.
     */
    private fun threatOf(a: Animal): Heard? {
        val seen = nearestThreat(a)
        val seenFear = closeness(a, seen?.position)
        val heard = heardThreat(a)
        val heardFear = (heard?.audibility ?: 0.0) * HEARD_FEAR_DAMPING
        if (heard != null && heardFear > seenFear) { listeners++; return Heard(heardFear, heard.about, heardOnly = true) }
        return seen?.let { Heard(seenFear, it) }
    }

    /** Readiness to reproduce: 0 on cooldown or at/below the nutrition threshold, rising to 1 at full nutrition. */
    private fun libido(a: Animal): Double {
        val s = a.species
        val spare = s.maxNutrition - s.reproductionNutritionThreshold
        return when {
            a.reproductionCooldown > 0 || a.nutrition <= s.reproductionNutritionThreshold -> 0.0
            spare <= 0 -> 1.0
            else -> (a.nutrition - s.reproductionNutritionThreshold) / spare
        }
    }

    /** Computes a HARD_CODED animal's current fear, hunger, thirst and libido by fixed rules. */
    fun feel(a: Animal): Feelings {
        val s = a.species
        val threat = threatOf(a)
        return Feelings(threat?.audibility ?: 0.0, 1 - a.nutrition / s.maxNutrition, 1 - a.hydration / s.maxHydration, libido(a),
            threat?.about, threat?.heardOnly == true)
    }

    // ------------------------------------------------------------ SOFT CODED AI

    /**
     * Fills a SOFT_CODED animal's [Mind.inputs] (all roughly 0..1): its own hp, nutrition, hydration, stamina, age and
     * readiness to breed; how close the nearest predator, food, water and mate are; the time of day; whether its
     * activity cycle says it should be awake; how much toxin is in its body right now; and how clearly it can hear
     * the animal that matters most to it.
     *
     * Trait HEARING: the hearing input means opposite things to prey and to a hunter - an alarm call or a predator's
     * footsteps for one, a meal giving itself away for the other. A species never changes which it is, so each
     * lineage of networks only ever learns one of the two meanings (docs/sim/SPECIES.md). It is 0 for a species
     * without the trait, and carries loudness only: like the sight inputs it says how near, never which way.
     *
     * The toxin input is what lets a learning animal connect biting something to feeling terrible afterwards, and
     * so learn to leave VENOMOUS and POISONOUS species alone (docs/sim/SPECIES.md). Everything sensed by sight is
     * already shortened by the dark (see [sightRange]).
     */
    fun sense(a: Animal, m: Mind) {
        val s = a.species
        val waterDist = world.water.distanceFrom(a.position)
        val day = world.clock.timeOfDay * 2 * kotlin.math.PI
        m.inputs = doubleArrayOf(
            a.hp / a.stats.maxHp,
            a.nutrition / s.maxNutrition,
            a.hydration / s.maxHydration,
            a.stamina / s.maxStamina,
            (a.age / a.stats.elderlyAge.coerceAtLeast(0.1)).coerceAtMost(2.0) / 2,
            libido(a),
            closeness(a, nearestThreat(a)?.position),
            closeness(a, nearestFood(a)),
            if (waterDist < 0) 0.0 else (1 - waterDist / s.waterSenseRange).coerceIn(0.0, 1.0),
            closeness(a, findMate(a)?.position),
            kotlin.math.sin(day),
            kotlin.math.cos(day),
            if (s.isActiveAt(world.clock.phase)) 1.0 else 0.0,
            (a.toxinTicks / TOXIN_SENSE_TICKS).coerceAtMost(1.0),
            (heardThreat(a) ?: heardPrey(a))?.audibility ?: 0.0,
        )
    }

    /**
     * A SOFT_CODED animal's feelings: its network's value for each [Drive]. fear/hunger/thirst/libido are the
     * softmax shares of FLEE/EAT/DRINK/MATE among all drives, so they read 0..1 like the hard-coded ones.
     */
    fun feelSoft(a: Animal, m: Mind): Feelings {
        m.values = m.net.forward(m.inputs)
        val top = m.values.max()
        val exp = DoubleArray(m.values.size) { kotlin.math.exp(m.values[it] - top) }
        val sum = exp.sum()
        fun share(d: Drive) = exp[d.ordinal] / sum
        val threat = threatOf(a)
        return Feelings(share(Drive.FLEE), share(Drive.EAT), share(Drive.DRINK), share(Drive.MATE), threat?.about, threat?.heardOnly == true)
    }

    /**
     * Chooses a SOFT_CODED animal's action. A new decision is made when the switch cooldown is over, the current
     * action is no longer possible, or a predator has just come into view; otherwise the animal keeps going.
     * Each decision closes the previous one in the mind's memory with the reward it earned.
     */
    fun decideSoft(a: Animal, m: Mind): Action {
        if (a.actionCooldown > 0) a.actionCooldown--
        val current = a.action
        val threatAppeared = a.feelings.threat != null && !m.sawThreat
        m.sawThreat = a.feelings.threat != null
        if (m.lastDrive >= 0 && a.actionCooldown > 0 && !threatAppeared && stillPossible(current)) return current

        val drive = m.pickDrive(world.rng)
        m.decide(drive, m.inputs)?.let { share(a, it) }
        a.actionCooldown = a.species.actionCooldownTicks
        return actionFor(a, drive)
    }

    /**
     * Learning from others: every other SOFT_CODED animal of [a]'s species that can see [a] (within its own view range)
     * remembers the decision [e] that [a] just finished.
     */
    private fun share(a: Animal, e: Experience) {
        val reach = a.species.viewRange * AnimalStats.MAX_RATIO // largest view range any animal of the species can have
        world.animalGrid.forEachNear(a.position, reach) { o ->
            val om = o.mind
            if (o !== a && om != null && o.isAlive && o.species == a.species &&
                o.position.distanceSquaredTo(a.position) <= sightRange(o) * sightRange(o)
            ) { om.observe(e); observations++ }
        }
    }

    /** Turns [drive] into an action, keeping the current one when it already serves that drive and can go on. */
    private fun actionFor(a: Animal, drive: Drive): Action {
        val current = a.action
        val same = when (drive) {
            Drive.FLEE -> current is Action.RunFromPredator && current.predator === a.feelings.threat
            Drive.EAT -> current is Action.EatFood || current is Action.AttackTarget
            Drive.DRINK -> current is Action.DrinkWater
            Drive.MATE -> current is Action.ReproduceWith
            Drive.REST -> current == Action.Rest
            Drive.EXPLORE -> current is Action.Explore && a.position.distanceTo(current.target) > EXPLORE_ARRIVE
        }
        if (same && stillPossible(current)) return current
        return when (drive) {
            Drive.FLEE -> a.feelings.threat?.let { Action.RunFromPredator(it) } ?: Action.Wander
            Drive.EAT -> findFood(a) ?: explore(a)
            Drive.DRINK -> findWater(a) ?: Action.Wander
            Drive.MATE -> findMate(a)?.let { Action.ReproduceWith(it) } ?: explore(a)
            Drive.REST -> Action.Rest
            Drive.EXPLORE -> explore(a)
        }
    }

    /** Position of the nearest thing in view this species can eat (no route check; used as a sense only). */
    private fun nearestFood(a: Animal): Vector2? {
        val s = a.species
        val view = sightRange(a)
        var best: Vector2? = null
        var bestD = view * view
        fun consider(p: Vector2) { val d = a.position.distanceSquaredTo(p); if (d <= bestD) { bestD = d; best = p } }
        if (s.eatsPlants) world.treeGrid.forEachNear(a.position, view) { t -> if (t.isEdible) consider(t.position) }
        if (s.eatsPlants) world.grassGrid.forEachNear(a.position, view) { g -> if (g.isEdible) consider(g.position) }
        if (s.eatsCarcasses) world.carcassGrid.forEachNear(a.position, view) { c -> if (!c.isRemoved) consider(c.position) }
        if (s.eatsCarcasses) world.eggGrid.forEachNear(a.position, view) { e -> if (!e.isRemoved && e.species != s) consider(e.position) }
        if (s.canHunt) world.animalGrid.forEachNear(a.position, view) { o -> if (o.isAlive && o.species != s) consider(o.position) }
        return best
    }

    // ------------------------------------------------------------ HARD CODED AI

    /**
     * Chooses what the animal does this tick. After switching to a different kind of action the animal must
     * stick with it for [Species.actionCooldownTicks] ticks. The lock is skipped when the action is no longer
     * possible (target dead or gone) or a predator is very close, since flinching away is a reflex.
     */
    fun decide(a: Animal): Action {
        if (a.actionCooldown > 0) a.actionCooldown--
        val current = a.action
        val reflex = a.feelings.threat != null && a.feelings.fear >= CLOSE_FEAR
        if (a.actionCooldown > 0 && !reflex && stillPossible(current)) return current

        val next = choose(a)
        if (next::class != current::class) a.actionCooldown = a.species.actionCooldownTicks
        return next
    }

    /** Whether [act] can still be carried out (its target still exists and is still usable). */
    private fun stillPossible(act: Action): Boolean = when (act) {
        Action.Rest, Action.Wander, is Action.DrinkWater -> true
        is Action.Explore -> true
        is Action.RunFromPredator -> act.predator.isAlive
        is Action.AttackTarget -> act.target.isAlive
        is Action.EatFood -> !act.target.isRemoved && (act.target !is Plant || act.target.isEdible)
        is Action.ReproduceWith -> act.target.isAlive && act.target.reproductionCooldown == 0
    }

    /** Picks an action from the animal's feelings, ignoring the switch cooldown. */
    private fun choose(a: Animal): Action {
        val f = a.feelings
        // Fear wins, except that an animal about to die of thirst ignores a predator that is not close.
        val dying = f.thirst >= DYING && f.fear < CLOSE_FEAR
        f.threat?.let { if (f.fear >= FEAR_THRESHOLD && !dying) return Action.RunFromPredator(it) }

        if (!a.species.isActiveAt(world.clock.phase) && max(f.hunger, f.thirst) < DESPERATE) return Action.Rest

        keepCurrent(a, f)?.let { return it }

        val hungerLimit = if (a.action is Action.EatFood || a.action is Action.AttackTarget) NEED_STOP else NEED_START
        val thirstLimit = if (a.action is Action.DrinkWater) NEED_STOP else THIRST_START
        val wantsFood = f.hunger >= hungerLimit
        val wantsWater = f.thirst >= thirstLimit

        if (wantsWater && (f.thirst * THIRST_WEIGHT > f.hunger || !wantsFood)) findWater(a)?.let { return it }
        if (wantsFood) findFood(a)?.let { return it }
        if (wantsWater) findWater(a)?.let { return it }
        if (f.libido > 0) findMate(a)?.let { return Action.ReproduceWith(it) }
        // Wants food or a mate but nothing in view: search new ground instead of drifting aimlessly.
        if (wantsFood || f.libido > 0) return explore(a)
        return Action.Wander
    }

    /**
     * Keeps heading to the current far-away spot until reached; otherwise picks a new walkable one in a random
     * direction, 2 to 4 view ranges from where the animal stands now. Falls back to wandering if none is reachable.
     */
    private fun explore(a: Animal): Action {
        val current = a.action
        if (current is Action.Explore && a.position.distanceTo(current.target) > EXPLORE_ARRIVE) return current
        val t = world.terrain
        repeat(EXPLORE_TRIES) {
            val angle = world.rng.nextDouble() * 2 * kotlin.math.PI
            val dist = sightRange(a) * (2 + 2 * world.rng.nextDouble())
            val x = (a.position.x + kotlin.math.cos(angle) * dist).coerceIn(0.5, t.width - 0.5)
            val y = (a.position.y + kotlin.math.sin(angle) * dist).coerceIn(0.5, t.height - 0.5)
            val target = Vector2(x, y)
            if (t.isWalkable(x.toInt(), y.toInt()) && a.position.distanceTo(target) > sightRange(a) && world.isClearWalk(a.position, target)) {
                return Action.Explore(target)
            }
        }
        return Action.Wander
    }

    /**
     * Animals commit to what they are doing until the need is mostly met or the target is gone, so they do not
     * dither between, say, food and water. A need that is about to kill (very high thirst) breaks the commitment.
     */
    private fun keepCurrent(a: Animal, f: Feelings): Action? {
        val act = a.action
        val thirstEmergency = f.thirst >= DYING && act !is Action.DrinkWater
        if (thirstEmergency) return null
        return when (act) {
            is Action.DrinkWater -> act.takeIf { f.thirst >= NEED_STOP }
            is Action.EatFood -> act.takeIf { f.hunger >= NEED_STOP && !act.target.isRemoved && (act.target !is Plant || act.target.isEdible) }
            is Action.AttackTarget -> act.takeIf { f.hunger >= NEED_STOP && act.target.isAlive }
            is Action.ReproduceWith -> act.takeIf { f.libido > 0 && act.target.isAlive && act.target.reproductionCooldown == 0 }
            else -> null
        }
    }

    /** Nearest living, off-cooldown animal of the same species within view range. */
    private fun findMate(a: Animal): Animal? {
        val view = sightRange(a)
        val range = view * view
        var best: Animal? = null
        var bestD = Double.MAX_VALUE
        world.animalGrid.forEachNear(a.position, view) { o ->
            if (o !== a && o.isAlive && o.species == a.species && o.reproductionCooldown == 0) {
                val d = a.position.distanceSquaredTo(o.position)
                if (d <= range && d < bestD) { bestD = d; best = o }
            }
        }
        return best
    }

    /** Nearest reachable drinking spot (walkable tile next to water), within the species' water sense range. */
    private fun findWater(a: Animal): Action? {
        val d = world.water.distanceFrom(a.position)
        if (d < 0 || d > a.species.waterSenseRange) return null
        return Action.DrinkWater(world.water.nearestSourceFrom(a.position) ?: return null)
    }

    /** Best food this species can eat in view range: trees, carcasses or live prey. */
    private fun findFood(a: Animal): Action? {
        val s = a.species
        val view = sightRange(a)
        val range = view * view
        var n = 0

        // Gather candidates into reusable arrays (no per-candidate objects), scored by squared distance. Candidates
        // must be within [maxRange] squared, which is view range for anything seen and unlimited for anything heard.
        fun add(target: Any, position: Vector2, penalty: Double, maxRange: Double = range) {
            val d = a.position.distanceSquaredTo(position)
            if (d > maxRange) return
            if (n == scoreBuf.size) { scoreBuf = scoreBuf.copyOf(n * 2); targetBuf = targetBuf.copyOf(n * 2) }
            scoreBuf[n] = d * penalty * penalty
            targetBuf[n] = target
            n++
        }
        if (s.eatsPlants) world.treeGrid.forEachNear(a.position, view) { t -> if (t.isEdible) add(t, t.position, 1.0) }
        if (s.eatsPlants) world.grassGrid.forEachNear(a.position, view) { g -> if (g.isEdible) add(g, g.position, 1.0) }
        if (s.eatsCarcasses) world.carcassGrid.forEachNear(a.position, view) { c -> if (!c.isRemoved) add(c, c.position, 1.0) }
        // Eggs of other species are food for meat and carrion eaters; animals leave their own species' eggs alone.
        if (s.eatsCarcasses) world.eggGrid.forEachNear(a.position, view) { e -> if (!e.isRemoved && e.species != s) add(e, e.position, 1.0) }
        if (s.canHunt) world.animalGrid.forEachNear(a.position, view) { o -> if (o.isAlive && o.species != s) add(o, o.position, HUNT_PENALTY) }
        // Trait HEARING: a hunter also goes after prey it only heard, which may be well past what it can see -
        // including anything that gave itself away by raising an alarm (docs/sim/SPECIES.md).
        heardPrey(a)?.let { heard ->
            if (a.position.distanceSquaredTo(heard.about.position) > range) {
                listeners++
                add(heard.about, heard.about.position, HUNT_PENALTY, maxRange = Double.MAX_VALUE)
            }
        }

        // Nearest first, skipping targets that sit across water (a straight walk must be possible).
        for (attempt in 0 until MAX_REACH_CHECKS) {
            var best = -1
            var bestScore = Double.MAX_VALUE
            for (i in 0 until n) if (scoreBuf[i] < bestScore) { bestScore = scoreBuf[i]; best = i }
            if (best < 0) break
            val target = targetBuf[best]!!
            val position = when (target) { is SimObject -> target.position; else -> (target as Animal).position }
            if (world.isClearWalk(a.position, position)) {
                return when (target) { is SimObject -> Action.EatFood(target); else -> Action.AttackTarget(target as Animal) }
            }
            scoreBuf[best] = Double.MAX_VALUE
        }
        return if (s.eatsPlants) findDistantTree(a) else null
    }

    /** No food in sight: head for the nearest tree anywhere on the island (animals remember where forests are). */
    private fun findDistantTree(a: Animal): Action? {
        val field = world.treeField
        val idx = field.nearestSourceFrom(a.position)?.let { it.y.toInt() * world.terrain.width + it.x.toInt() } ?: return null
        val tree = world.treesByTile[idx]?.minByOrNull { a.position.distanceSquaredTo(it.position) } ?: return null
        return Action.EatFood(tree)
    }
}

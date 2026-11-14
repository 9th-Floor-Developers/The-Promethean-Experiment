package sim.animal

import base.Vector2
import sim.objects.SimObject
import kotlin.math.max
import sim.objects.Carcass
import sim.objects.Plant
import sim.objects.Tree
import sim.world.EXPLORE_ARRIVE
import sim.world.World

/**
 * Hard-coded animal AI (docs/sim/ANIMALS.MD): numeric feelings decide the current [Action].
 * SOFT_CODED animals currently use the same logic until a learned controller exists.
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
    }

    private var scoreBuf = DoubleArray(256)
    private var targetBuf = arrayOfNulls<Any>(256)

    /** Computes the animal's current fear, hunger and thirst. */
    fun feel(a: Animal): Feelings {
        val s = a.species
        var threat: Animal? = null
        var best = a.stats.viewRange * a.stats.viewRange
        if (!s.canHunt) {
            world.hunterGrid.forEachNear(a.position, a.stats.viewRange) { o ->
                if (o.isAlive && o.species != s) {
                    val d = a.position.distanceSquaredTo(o.position)
                    if (d <= best) { best = d; threat = o }
                }
            }
        }
        val fear = threat?.let { 1 - a.position.distanceTo(it.position) / a.stats.viewRange } ?: 0.0
        val spare = s.maxNutrition - s.reproductionNutritionThreshold
        val libido = when {
            a.reproductionCooldown > 0 || a.nutrition <= s.reproductionNutritionThreshold -> 0.0
            spare <= 0 -> 1.0
            else -> (a.nutrition - s.reproductionNutritionThreshold) / spare
        }
        return Feelings(fear, 1 - a.nutrition / s.maxNutrition, 1 - a.hydration / s.maxHydration, libido, threat)
    }

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
            val dist = a.stats.viewRange * (2 + 2 * world.rng.nextDouble())
            val x = (a.position.x + kotlin.math.cos(angle) * dist).coerceIn(0.5, t.width - 0.5)
            val y = (a.position.y + kotlin.math.sin(angle) * dist).coerceIn(0.5, t.height - 0.5)
            val target = Vector2(x, y)
            if (t.isWalkable(x.toInt(), y.toInt()) && a.position.distanceTo(target) > a.stats.viewRange && world.isClearWalk(a.position, target)) {
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
        val range = a.stats.viewRange * a.stats.viewRange
        var best: Animal? = null
        var bestD = Double.MAX_VALUE
        world.animalGrid.forEachNear(a.position, a.stats.viewRange) { o ->
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
        val range = a.stats.viewRange * a.stats.viewRange
        var n = 0

        // Gather in-range candidates into reusable arrays (no per-candidate objects), scored by squared distance.
        fun add(target: Any, position: Vector2, penalty: Double) {
            val d = a.position.distanceSquaredTo(position)
            if (d > range) return
            if (n == scoreBuf.size) { scoreBuf = scoreBuf.copyOf(n * 2); targetBuf = targetBuf.copyOf(n * 2) }
            scoreBuf[n] = d * penalty * penalty
            targetBuf[n] = target
            n++
        }
        val view = a.stats.viewRange
        if (s.eatsPlants) world.treeGrid.forEachNear(a.position, view) { t -> if (t.isEdible) add(t, t.position, 1.0) }
        if (s.eatsPlants) world.grassGrid.forEachNear(a.position, view) { g -> if (g.isEdible) add(g, g.position, 1.0) }
        if (s.eatsCarcasses) world.carcassGrid.forEachNear(a.position, view) { c -> if (!c.isRemoved) add(c, c.position, 1.0) }
        // Eggs of other species are food for meat and carrion eaters; animals leave their own species' eggs alone.
        if (s.eatsCarcasses) world.eggGrid.forEachNear(a.position, view) { e -> if (!e.isRemoved && e.species != s) add(e, e.position, 1.0) }
        if (s.canHunt) world.animalGrid.forEachNear(a.position, view) { o -> if (o.isAlive && o.species != s) add(o, o.position, HUNT_PENALTY) }

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

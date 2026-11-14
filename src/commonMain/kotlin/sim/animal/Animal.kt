package sim.animal

import base.Vector2

import sim.species.Species

/** A single living ground animal. Dies when [hp] reaches 0. */
class Animal(
    val id: Int,
    val species: Species,
    var position: Vector2,
    /** Health: the animal dies when this reaches 0. */
    var hp: Double = species.maxHp,
    /** Nutrition: the animal takes damage at 0; restored by eating. */
    var nutrition: Double = species.maxNutrition / 2,
    /** Hydration: the animal takes damage at 0; restored by drinking. */
    var hydration: Double = species.maxHydration * 0.8,
    /** Stamina: spent by exertion, regenerates slowly, scales movement speed. */
    var stamina: Double = species.maxStamina,
    /** Age in days, starting at 0. Older animals regenerate stamina more slowly. */
    var age: Double = 0.0,
) {
    val isAlive get() = hp > 0

    /** Body size (tiles); extends attack reach. */
    val radius get() = species.bodyRadius

    /** Short name for logs, e.g. "Animal#3(Mock Herbivore)". */
    val label get() = "Animal#$id(${species.name})"

    /** What the animal is doing right now. */
    var action: Action = Action.Rest

    /** Ticks left before the animal may switch to a different kind of action. */
    var actionCooldown = 0

    /** Latest drives, refreshed every tick. */
    var feelings = Feelings()

    /** Ticks until this animal can reproduce again. */
    var reproductionCooldown = 0

    /** Waypoints around obstacles toward [pathGoal]; empty when walking straight. */
    val path = ArrayDeque<Vector2>()

    /** Tile index (y * width + x) the current [path] leads to, or -1. */
    var pathGoal = -1

    /** Ticks since [path] was computed; stale paths are recomputed. */
    var pathAge = 0

    /** Consecutive ticks the animal tried to move but was blocked. */
    var blockedTicks = 0

    /** Direction (radians) of the current wander. */
    var wanderHeading = 0.0

    /** Why the animal died, set when [hp] hits 0. */
    var causeOfDeath: String? = null
        private set

    fun changeHp(delta: Double) { hp = (hp + delta).coerceIn(0.0, species.maxHp) }
    fun changeNutrition(delta: Double) { nutrition = (nutrition + delta).coerceIn(0.0, species.maxNutrition) }
    fun changeHydration(delta: Double) { hydration = (hydration + delta).coerceIn(0.0, species.maxHydration) }
    fun changeStamina(delta: Double) { stamina = (stamina + delta).coerceIn(0.0, species.maxStamina) }

    /** Stamina regained per tick, reduced by [age] (docs/sim/ANIMALS.MD). */
    val staminaRegen get() = species.staminaRegen / (1 + species.staminaAgeDecay * age)

    /** Whether stamina is high enough (90% of max) for HP to regenerate. */
    val canRegenerateHp get() = stamina >= species.maxStamina * 0.9

    /** Fraction of full speed available at the current stamina (never fully stops). */
    val speedFactor get() = MIN_SPEED_FACTOR + (1 - MIN_SPEED_FACTOR) * stamina / species.maxStamina

    /** Deals [amount] damage; records [cause] if this kills the animal. */
    fun hurt(amount: Double, cause: String) {
        if (!isAlive) return
        changeHp(-amount)
        if (!isAlive) causeOfDeath = cause
    }

    /** Reproduction rule from ENDGOAL: enough nutrition and in range of another animal of the same species. */
    fun canReproduceWith(other: Animal): Boolean =
        other !== this &&
            isAlive && other.isAlive &&
            other.species == species &&
            nutrition > species.reproductionNutritionThreshold &&
            position.distanceTo(other.position) <= species.reproductionRange

    override fun toString() = "Animal#$id(${species.name} hp=$hp nutrition=$nutrition hydration=$hydration stamina=$stamina age=$age)"
}

/** Speed multiplier at zero stamina. */
private const val MIN_SPEED_FACTOR = 0.3

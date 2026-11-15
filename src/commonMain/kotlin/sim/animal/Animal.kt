package sim.animal

import base.Vector2

import sim.species.Species

/** A single living ground animal. Dies when [hp] reaches 0. */
class Animal(
    val id: Int,
    val species: Species,
    var position: Vector2,
    /** This animal's universal stats, fixed for life; the species' founder values unless inherited from parents. */
    val stats: AnimalStats = AnimalStats.founder(species),
    /** Health: the animal dies when this reaches 0. */
    var hp: Double = stats.maxHp,
    /** Nutrition: the animal takes damage at 0; restored by eating. */
    var nutrition: Double = species.maxNutrition / 2,
    /** Hydration: the animal takes damage at 0; restored by drinking. */
    var hydration: Double = species.maxHydration * 0.8,
    /** Stamina: spent by exertion, regenerates slowly, scales movement speed. */
    var stamina: Double = species.maxStamina,
    /** Age in days, starting at 0. Older animals regenerate stamina more slowly. */
    var age: Double = 0.0,
    /** The learning brain of a SOFT_CODED animal; null for HARD_CODED ones. */
    val mind: Mind? = null,
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

    /**
     * Trait SPRINTING: the sprint reserve left, in ticks of sprinting. Drains 1 per tick spent sprinting and
     * refills by [Species.sprintRecharge] otherwise, so a sprint only lasts a short time (docs/sim/SPECIES.md).
     * Animals of a species without the trait never spend it.
     */
    var sprintCharge = species.sprintChargeTicks

    /** Whether the animal actually sprinted this tick; set by the movement step. */
    var isSprinting = false

    /** Whether the animal changed position this tick; set by the movement step. Moving animals make noise. */
    var movedThisTick = false

    /** Trait ALARM_CALLING: whether the animal is raising an alarm right now; set by the sensing step. */
    var isCalling = false

    /**
     * Traits VENOMOUS and POISONOUS: ticks of toxin left in the animal's body, the HP it costs per tick, and what
     * to record if it kills (docs/sim/SPECIES.md). An animal holds one toxin at a time: a fresh dose replaces the
     * old one and restarts the timer, so a long fight keeps the toxin topped up but never compounds it.
     */
    var toxinTicks = 0
        private set
    var toxinDamage = 0.0
        private set
    var toxinCause: String? = null
        private set

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

    /** Angle (radians) the animal veers off the exact direction away from its predator; re-rolled now and then. */
    var fleeOffset = 0.0

    /** Why the animal died, set when [hp] hits 0. */
    var causeOfDeath: String? = null
        private set

    /** True when the killing blow came from another animal (predation); false for starvation, thirst and other natural causes. */
    var killedByAnimal = false
        private set

    fun changeHp(delta: Double) { hp = (hp + delta).coerceIn(0.0, stats.maxHp) }
    fun changeNutrition(delta: Double) { nutrition = (nutrition + delta).coerceIn(0.0, species.maxNutrition) }
    fun changeHydration(delta: Double) { hydration = (hydration + delta).coerceIn(0.0, species.maxHydration) }
    fun changeStamina(delta: Double) { stamina = (stamina + delta).coerceIn(0.0, species.maxStamina) }

    /** Whether the animal has reached its [AnimalStats.elderlyAge], when negative effects begin. */
    val isElderly get() = age >= stats.elderlyAge

    /** Stamina spent every tick regardless of activity: the base usage plus the cost of running a [mind]. */
    val baseStaminaUsage get() = stats.baseStaminaUsage + (mind?.staminaCost ?: 0.0)

    /** Stamina regained per tick; once [isElderly] it decays with the days spent elderly (docs/sim/ANIMALS.MD). */
    val staminaRegen get() = species.staminaRegen / (1 + species.staminaAgeDecay * (age - stats.elderlyAge).coerceAtLeast(0.0))

    /** Whether stamina is high enough (90% of max) for HP to regenerate. */
    val canRegenerateHp get() = stamina >= species.maxStamina * 0.9

    /**
     * Trait SPRINTING: whether the animal could sprint right now. It needs the trait, some reserve left and
     * enough stamina ([SPRINT_STAMINA_FLOOR] of max), so an exhausted animal drops back to a walk.
     */
    val canSprintNow get() = species.canSprint && sprintCharge > 0 && stamina > species.maxStamina * SPRINT_STAMINA_FLOOR

    /**
     * How much sound the animal is making, 0 (still and silent) to 1 (sprinting). Only animals of a species with
     * Trait.HEARING can pick this up, and only within [Species.hearingRange] scaled by this (docs/sim/SPECIES.md).
     */
    val noise get() = when {
        isSprinting -> 1.0
        movedThisTick -> WALKING_NOISE
        else -> 0.0
    }

    /** Fraction of full speed available at the current stamina (never fully stops). */
    val speedFactor get() = MIN_SPEED_FACTOR + (1 - MIN_SPEED_FACTOR) * stamina / species.maxStamina

    /**
     * Traits VENOMOUS and POISONOUS: puts a toxin doing [damage] HP per tick for [ticks] ticks into the animal,
     * replacing any toxin already in it. [cause] is recorded as the cause of death if the toxin is what kills it.
     * Ignored on a dead animal and for a dose that would do nothing.
     */
    fun applyToxin(damage: Double, ticks: Int, cause: String) {
        if (!isAlive || damage <= 0.0 || ticks <= 0) return
        toxinDamage = damage
        toxinTicks = ticks
        toxinCause = cause
    }

    /**
     * Spends one tick of the toxin in the animal's body, damaging it. Returns true while a toxin is still running,
     * so the caller can count poisoned animals.
     */
    fun tickToxin(): Boolean {
        if (toxinTicks <= 0) return false
        toxinTicks--
        hurt(toxinDamage, toxinCause ?: "poisoned", byAnimal = true)
        if (toxinTicks == 0) { toxinDamage = 0.0; toxinCause = null }
        return true
    }

    /** Deals [amount] damage; records [cause] (and whether it was an [byAnimal] attack) if this kills the animal. */
    fun hurt(amount: Double, cause: String, byAnimal: Boolean = false) {
        if (!isAlive) return
        changeHp(-amount)
        if (!isAlive) { causeOfDeath = cause; killedByAnimal = byAnimal }
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

/** Share of max stamina an animal must have left to keep sprinting. */
private const val SPRINT_STAMINA_FLOOR = 0.15

/** How loud a walking animal is next to a sprinting one, which is 1.0. */
private const val WALKING_NOISE = 0.4

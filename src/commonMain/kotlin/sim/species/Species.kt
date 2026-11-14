package sim.species

import sim.world.TimePhase

/**
 * A species is an immutable template: a set of traits plus base stats shared by all its animals.
 * Invariant: at most one trait per [TraitCategory].
 */
class Species(
    val name: String,
    val traits: Set<Trait>,
    val maxHp: Double = 100.0,
    val maxNutrition: Double = 100.0,
    /** Nutrition an animal must exceed to be able to reproduce. */
    val reproductionNutritionThreshold: Double = 70.0,
    /** Max distance (in tiles) to a same-species partner for reproduction. */
    val reproductionRange: Double = 1.5,
    /** Maximum hydration. */
    val maxHydration: Double = 100.0,
    /** Maximum stamina. */
    val maxStamina: Double = 100.0,
    /** Stamina regained per tick. */
    val staminaRegen: Double = 0.05,
    /** How strongly time spent elderly (days past [elderlyAge]) slows stamina regeneration: regen is divided by 1 + this * days elderly. */
    val staminaAgeDecay: Double = 0.25,
    /** HP regained per tick while stamina is at least 90% full. */
    val hpRegen: Double = 0.05,
    /** Stamina spent per tick while sprinting (fleeing or chasing). */
    val staminaSprintCost: Double = 0.2,
    /** Universal stat WALKING_STAMINA_USAGE: stamina spent per tick while walking, added to [baseStaminaUsage]. */
    val walkingStaminaUsage: Double = 0.05,
    /** Universal stat BASE_STAMINA_USAGE: stamina spent every tick regardless of activity. */
    val baseStaminaUsage: Double = 0.01,
    /** Universal stat ELDERLY: age (in days) at which negative effects begin (stamina regen starts decaying with age). */
    val elderlyAge: Double = 5.0,
    /** Tiles moved per tick at full stamina. */
    val speed: Double = 0.1,
    /** Body size (tiles); only used to extend how far an animal can reach to attack. */
    val bodyRadius: Double = 0.3,
    /** Universal stat VIEW_RANGE: distance (tiles) at which animals notice food, water and other animals. */
    val viewRange: Double = 10.0,
    /** Walking distance (tiles) within which animals know where water is; much larger than [viewRange] because they remember where the water is. */
    val waterSenseRange: Double = 150.0,
    /** Ticks an animal must stick with an action before it may switch to a different kind of action. */
    val actionCooldownTicks: Int = 20,
    /** Nutrition lost per tick. */
    val nutritionDrain: Double = 0.05,
    /** Hydration lost per tick. */
    val hydrationDrain: Double = 0.07,
    /** HP lost per tick while nutrition or hydration is 0. */
    val starvationDamage: Double = 0.2,
    /** Founder DAMAGE: damage dealt per tick to a target in reach; 0 means the species cannot attack. */
    val attackDamage: Double = 3.0,
    /** Founder ARMOR: percent of attack damage absorbed (see [sim.animal.AnimalStats.armorReduction]). */
    val armor: Double = 1.0,
    /** Extra reach (tiles) beyond body contact for attacks. */
    val attackRange: Double = 0.3,
    /** Nutrition the parent loses when reproducing. */
    val reproductionNutritionCost: Double = 30.0,
    /** Ticks before an animal can reproduce again. */
    val reproductionCooldownTicks: Int = 300,
    /** Ticks an egg takes to hatch (EGG_BIRTH species only). */
    val eggHatchTicks: Int = 600,
    /** Nutrition an egg contains for animals that eat it (EGG_BIRTH species only). */
    val eggNutrition: Double = 25.0,
    /** Nutrition contained in the carcass left behind on death. */
    val carcassNutrition: Double = 60.0,
) {
    init {
        val dupes = traits.mapNotNull { it.category }.groupingBy { it }.eachCount().filterValues { it > 1 }.keys
        require(dupes.isEmpty()) { "Species '$name' has more than one trait in: $dupes" }
        require(baseStaminaUsage >= 0 && walkingStaminaUsage >= 0) { "stamina usage must not be negative" }
        require(elderlyAge >= 0) { "elderlyAge must not be negative" }
        require(reproductionNutritionThreshold <= maxNutrition) { "reproduction threshold above max nutrition" }
    }

    /** Whether animals of this species hunt other animals. */
    val canHunt get() = Trait.CARNIVORE in traits || Trait.OMNIVORE in traits

    /** Whether animals of this species eat trees. */
    val eatsPlants get() = Trait.HERBIVORE in traits || Trait.OMNIVORE in traits

    /** Whether animals of this species eat carcasses. */
    val eatsCarcasses get() = Trait.CARNIVORE in traits || Trait.OMNIVORE in traits || Trait.SCAVENGER in traits

    /** Whether the activity-cycle trait lets this species be active during [phase]; species without one are always active. */
    fun isActiveAt(phase: TimePhase): Boolean = when {
        Trait.DIURNAL in traits -> phase == TimePhase.DAY
        Trait.NOCTURNAL in traits -> phase == TimePhase.NIGHT
        Trait.CREPUSCULAR in traits -> phase == TimePhase.DAWN || phase == TimePhase.DUSK
        else -> true
    }

    fun has(trait: Trait) = trait in traits
    fun trait(category: TraitCategory): Trait? = traits.firstOrNull { it.category == category }

    override fun toString() = "Species($name)"
}

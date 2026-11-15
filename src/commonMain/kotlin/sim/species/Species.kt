package sim.species

import sim.animal.AnimalStats
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
    /** Trait SPRINTING: how much faster than a walk a sprint is. Only species with [Trait.SPRINTING] ever sprint. */
    val sprintSpeedMultiplier: Double = 1.6,
    /** Trait SPRINTING: the sprint reserve, in ticks of sprinting, that a fully rested animal holds. */
    val sprintChargeTicks: Double = 150.0,
    /** Trait SPRINTING: sprint reserve regained per tick while not sprinting. */
    val sprintRecharge: Double = 0.5,
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
    /**
     * Trait HEARING: how far (tiles) this species could pick up a sound of full loudness - alarm calls and the noise
     * of moving animals both reach a fraction of it ([ALARM_LOUDNESS], [sim.animal.Animal.noise]), so nothing in the
     * world is actually heard this far off. Defaults to a multiple of [viewRange] so the loudest sound always reaches
     * past what the eye can see, however far-sighted the species is (docs/sim/SPECIES.md). A species setting rather
     * than an inherited stat, like [waterSenseRange].
     */
    val hearingRange: Double = viewRange * HEARING_VIEW_MULTIPLE,
    /** Trait ALARM_CALLING: stamina spent each tick spent raising an alarm, so calling is never free. */
    val alarmCallStaminaCost: Double = 0.05,
    /**
     * Trait ALARM_CALLING: how long one call sounds. Long enough for listeners to act on it, but far short of a
     * whole flee: an animal calls in bursts rather than shouting every tick it runs (docs/sim/SPECIES.md).
     */
    val alarmCallTicks: Int = 15,
    /**
     * Trait ALARM_CALLING: ticks an animal must stay quiet after a call before it may raise another, even while it
     * is still running. This is what keeps one long chase from filling the world with calls.
     */
    val alarmCallCooldownTicks: Int = 90,
    /**
     * Trait VENOMOUS: HP per tick, and for how many ticks, the toxin left in whatever this species bites does
     * (docs/sim/SPECIES.md). Set above [sim.world.REGEN_RATE] so Trait.REGENERATION cannot simply out-heal it.
     */
    val venomDamage: Double = 0.25,
    val venomTicks: Int = 240,
    /**
     * Trait POISONOUS: HP per tick, and for how many ticks, the toxin left in whatever bites this species does.
     * Lasts longer than venom: the point of poison is that it keeps working after the attacker has let go.
     */
    val poisonDamage: Double = 0.25,
    val poisonTicks: Int = 360,
    /** Trait SPIKES: HP an attacker loses for each tick it spends biting this species; instant, and only while biting. */
    val spikeDamage: Double = 0.5,
    /**
     * Trait HARD_SKIN: damage removed from every bite before it lands, on top of the [armor] percentage. A flat
     * subtraction, so weak-biting attackers lose nearly all of their damage while a strong bite still gets through
     * (see [sim.world.World.biteDamage], which always leaves a minimum trickle so nothing is invulnerable).
     */
    val hardSkinReduction: Double = 1.0,
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
    /** Founder ARMOR stat (the "Armor" slider; unrelated to Trait.HARD_SKIN): percent of attack damage absorbed (see [sim.animal.AnimalStats.armorReduction]). */
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
    /**
     * How strongly offspring differ from their parents: each inherited stat changes by up to this fraction either way,
     * and SOFT_CODED brain mutations scale with it (see [sim.animal.Mind.inherit]). A species setting; it is never
     * inherited or mutated itself.
     */
    val mutationRate: Double = AnimalStats.DEFAULT_MUTATION,
) {
    init {
        val dupes = traits.mapNotNull { it.category }.groupingBy { it }.eachCount().filterValues { it > 1 }.keys
        require(dupes.isEmpty()) { "Species '$name' has more than one trait in: $dupes" }
        require(maxHp >= AnimalStats.MIN_MAX_HP && speed >= AnimalStats.MIN_SPEED && attackDamage >= AnimalStats.MIN_DAMAGE &&
            armor >= AnimalStats.MIN_ARMOR && viewRange >= AnimalStats.MIN_VIEW_RANGE) { "Species '$name' has an inherited stat below its minimum" }
        require(baseStaminaUsage >= 0 && walkingStaminaUsage >= 0) { "stamina usage must not be negative" }
        require(elderlyAge >= 0) { "elderlyAge must not be negative" }
        require(mutationRate in 0.0..AnimalStats.MAX_MUTATION) { "mutationRate must be between 0 and ${AnimalStats.MAX_MUTATION}" }
        require(sprintSpeedMultiplier >= 1.0) { "sprintSpeedMultiplier must be at least 1 (a sprint is never slower than a walk)" }
        require(sprintChargeTicks > 0 && sprintRecharge > 0) { "sprint reserve and recharge must be positive" }
        require(hearingRange >= 0 && alarmCallStaminaCost >= 0) { "hearing range and alarm call cost must not be negative" }
        require(alarmCallTicks > 0 && alarmCallCooldownTicks >= 0) { "an alarm call must last at least a tick and its cooldown must not be negative" }
        require(venomDamage >= 0 && poisonDamage >= 0 && spikeDamage >= 0 && hardSkinReduction >= 0) { "trait damage must not be negative" }
        require(venomTicks >= 0 && poisonTicks >= 0) { "toxin durations must not be negative" }
        require(reproductionNutritionThreshold <= maxNutrition) { "reproduction threshold above max nutrition" }
    }

    /**
     * The mechanical effect of this species' BODY_COVERING trait (docs/sim/SPECIES.md). Every species has a
     * covering: one given no covering trait falls back to [Covering.BARE_SKIN]. Stored rather than computed,
     * because every animal reads it on every tick.
     */
    val covering: Covering = Covering.of(traits.firstOrNull { it.category == TraitCategory.BODY_COVERING })

    /** Trait ALARM_CALLING: whether animals of this species raise an alarm when they flee. */
    val canCallAlarm get() = Trait.ALARM_CALLING in traits

    /** Trait HEARING: whether animals of this species pick up sound (alarm calls and moving animals). */
    val canHear get() = Trait.HEARING in traits

    /** Trait VENOMOUS: whether a bite by this species leaves a toxin in its target. */
    val isVenomous get() = Trait.VENOMOUS in traits

    /** Trait POISONOUS: whether biting this species leaves a toxin in the attacker. */
    val isPoisonous get() = Trait.POISONOUS in traits

    /** Trait SPIKES: whether biting this species costs the attacker HP for every tick it keeps biting. */
    val hasSpikes get() = Trait.SPIKES in traits

    /** Trait HARD_SKIN: whether a flat [hardSkinReduction] comes off every bite this species takes. */
    val hasHardSkin get() = Trait.HARD_SKIN in traits

    /** Trait NIGHT_VISION: whether this species sees at full range in the dark, instead of the usual night penalty. */
    val canSeeInDark get() = Trait.NIGHT_VISION in traits

    /** Trait REGENERATION: whether this species slowly heals itself while fed and watered. */
    val canRegenerate get() = Trait.REGENERATION in traits

    /** Trait SPRINTING: whether animals of this species can sprint at all; others always move at a walk. */
    val canSprint get() = Trait.SPRINTING in traits

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

    companion object {
        /** How much further than [viewRange] a species hears by default; sound carries past line of sight. */
        const val HEARING_VIEW_MULTIPLE = 2.5

        /**
         * Trait ALARM_CALLING: how loud a call is, as a share of a listener's [hearingRange] (see
         * [sim.animal.Animal.noise] for the sounds of moving). A call therefore reaches [HEARING_VIEW_MULTIPLE] x
         * this = 1.5x the listener's view range, which makes it the loudest thing in the world: a shout carries
         * further than even a sprint, so warning the herd is worth the stamina (docs/sim/SPECIES.md).
         */
        const val ALARM_LOUDNESS = 0.6
    }
}

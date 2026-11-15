package sim.species

/**
 * The mechanical effect of one BODY_COVERING trait (docs/sim/SPECIES.md).
 *
 * Every covering trades defence against upkeep, so none of them is strictly best: a covering that takes the sting
 * out of a bite costs its owner water, food, stamina or speed to carry around. A species without a covering trait
 * gets [NONE], which costs and gives nothing.
 *
 * Fields are added here as each covering's mechanic is designed; a covering only ever uses the levers it needs.
 */
class Covering(
    /**
     * Extra share of every bite the covering absorbs (0.04 = four percentage points), added to the animal's ARMOR
     * percentage before the shared cap in [sim.animal.AnimalStats.MAX_ARMOR_REDUCTION]. A share rather than a flat
     * subtraction, so flat damage reduction stays Trait.HARD_SKIN's signature.
     */
    val armorBonus: Double = 0.0,
    /** Multiplier on [Species.hydrationDrain]: above 1 the covering makes its owner thirstier, below 1 it holds water in. */
    val hydrationFactor: Double = 1.0,
    /**
     * Multiplier on the stamina an animal spends per tick on simply existing and moving ([Species.baseStaminaUsage],
     * [Species.walkingStaminaUsage] and [Species.staminaSprintCost] together). Stamina regeneration and the cost of
     * an alarm call are left alone: a call is a deliberate shout, not a cost of carrying the covering about.
     */
    val staminaFactor: Double = 1.0,
) {
    init {
        require(armorBonus >= 0) { "a covering's armor bonus must not be negative" }
        require(hydrationFactor > 0) { "a covering's hydration factor must be positive" }
        require(staminaFactor > 0) { "a covering's stamina factor must be positive" }
    }

    companion object {
        /** The covering of a species that has no BODY_COVERING trait: no defence, no cost. */
        val NONE = Covering()

        /**
         * FUR: a coat that takes the edge off a bite but costs its owner water at every hour, since the animal
         * carries its coat through the heat of the day as well as the cool of the night.
         */
        val FUR = Covering(armorBonus = 0.04, hydrationFactor = 1.25)

        /**
         * FEATHERS: insulation that weighs almost nothing, so a feathered animal spends less stamina carrying itself
         * around than a bare-skinned one - but it still insulates, so it drinks more. The mover's covering: it travels
         * furthest on the least energy and pays for it at the water's edge.
         */
        val FEATHERS = Covering(armorBonus = 0.02, hydrationFactor = 1.15, staminaFactor = 0.85)

        /** The effect of [trait], or [NONE] for a species with no covering (or one whose mechanic is not designed yet). */
        fun of(trait: Trait?): Covering = when (trait) {
            Trait.FUR -> FUR
            Trait.FEATHERS -> FEATHERS
            else -> NONE
        }
    }
}

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
     * percentage before the shared cap in [sim.animal.AnimalStats.MAX_ARMOR_REDUCTION]. Most coverings work only
     * this way; a rigid plate also takes a flat [flatReduction] off the top.
     */
    val armorBonus: Double = 0.0,
    /**
     * Flat damage taken off every bite, on top of [armorBonus] and alongside Trait.HARD_SKIN's own
     * [Species.hardSkinReduction]. Only a rigid covering has one: a plate stops a small bite outright, where a
     * percentage would merely shave it. The floor in [sim.world.World.biteDamage] still lets a trickle through, so
     * stacking this with hard skin cannot make an animal invulnerable.
     */
    val flatReduction: Double = 0.0,
    /** Multiplier on [Species.hydrationDrain]: above 1 the covering makes its owner thirstier, below 1 it holds water in. */
    val hydrationFactor: Double = 1.0,
    /**
     * Multiplier on the stamina an animal spends per tick on simply existing and moving ([Species.baseStaminaUsage],
     * [Species.walkingStaminaUsage] and [Species.staminaSprintCost] together). Stamina regeneration and the cost of
     * an alarm call are left alone: a call is a deliberate shout, not a cost of carrying the covering about.
     */
    val staminaFactor: Double = 1.0,
    /**
     * Multiplier on how fast the animal actually travels (see [sim.animal.Animal.walkSpeed]), at a walk, a wander
     * and a sprint alike. The inherited SPEED stat itself is untouched: a covering is a species constant, so it must
     * not show up in the stats that mutate or in the leaderboard.
     */
    val speedFactor: Double = 1.0,
) {
    init {
        require(armorBonus >= 0) { "a covering's armor bonus must not be negative" }
        require(flatReduction >= 0) { "a covering's flat damage reduction must not be negative" }
        require(hydrationFactor > 0) { "a covering's hydration factor must be positive" }
        require(staminaFactor > 0) { "a covering's stamina factor must be positive" }
        require(speedFactor > 0) { "a covering's speed factor must be positive" }
    }

    companion object {
        /**
         * BARE SKIN: nothing to carry and nothing to insulate, so it is simply the cheapest body to run - and the
         * only covering with no defence whatever. Every species has a covering and this is the default, so there is
         * no such thing as an animal with no covering at all.
         */
        val BARE_SKIN = Covering(hydrationFactor = 0.92, staminaFactor = 0.92)

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

        /**
         * SCALES: an overlapping hide that seals moisture in, so a scaly animal can cross dry ground that would
         * kill a furred one - but it is stiff and heavy enough to cost real speed. The drought specialist that
         * cannot outrun its troubles.
         */
        val SCALES = Covering(armorBonus = 0.08, hydrationFactor = 0.72, speedFactor = 0.93)

        /**
         * EXOSKELETON: a rigid plate that both sheds a share of every bite and stops a small one outright, bought
         * with the effort of hauling it around. The only covering that is expensive on the axis the simulation
         * actually turns on, which is what keeps its armour from being a free lunch.
         */
        val EXOSKELETON = Covering(armorBonus = 0.14, flatReduction = 0.5, staminaFactor = 1.18)

        /**
         * The effect of [trait]. BARE SKIN is the default: a species given no BODY_COVERING trait is bare-skinned
         * rather than uncovered, so [sim.world.parseSpeciesConfig] fills it in and this falls back to it too.
         */
        fun of(trait: Trait?): Covering = when (trait) {
            Trait.FUR -> FUR
            Trait.FEATHERS -> FEATHERS
            Trait.SCALES -> SCALES
            Trait.EXOSKELETON -> EXOSKELETON
            else -> BARE_SKIN
        }
    }
}

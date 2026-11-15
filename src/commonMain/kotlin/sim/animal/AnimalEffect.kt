package sim.animal

/**
 * A temporary condition an animal can be in (docs/sim/ANIMALS.MD, "effects"). Effects are read off the animal's
 * current state rather than stored, so they can never drift out of step with it. [bit] is the effect's flag in
 * the bitmask the snapshot export sends to the UI.
 */
enum class AnimalEffect(val bit: Int) {
    /** Venom or poison still working in its body (traits VENOMOUS and POISONOUS); loses HP every tick. */
    POISONED(1),
    /** Nutrition is empty; loses HP every tick until it eats. */
    STARVING(2),
    /** Hydration is empty; loses HP every tick until it drinks. */
    DEHYDRATED(4),
    /** Stamina below [TIRED_STAMINA_SHARE] of max: walking near its slowest and unable to sprint. */
    TIRED(8);

    companion object {
        /** Share of max stamina below which an animal counts as [TIRED]; also the point where sprinting stops. */
        const val TIRED_STAMINA_SHARE = 0.15

        /** Packs [effects] into one integer, one [bit] per effect. */
        fun mask(effects: Set<AnimalEffect>): Int = effects.sumOf { it.bit }
    }
}

package sim.objects

/** A plant object (docs/sim/SIM_OBJECT.MD): edible until eaten, then non-edible for a cooldown before it can be eaten again. */
interface Plant {
    /** Whether an animal can eat this plant right now. */
    val isEdible: Boolean

    /** Eats the plant and returns the nutrition gained, or 0.0 if it is still cooling down. */
    fun eat(): Double
}

package sim.objects

import base.Vector2
import sim.animal.AnimalStats
import sim.species.Species

/**
 * An egg laid by an animal with the EGG_BIRTH trait (docs/sim/SIM_OBJECT.MD). It carries the stats the hatchling
 * inherited, hatches into an animal after [hatchTicks] ticks, and can be eaten before that, which destroys it.
 */
class Egg(
    id: Int,
    position: Vector2,
    /** Species of the animal that will hatch. */
    val species: Species,
    /** Stats the hatchling is born with, fixed when the egg is laid. */
    val stats: AnimalStats,
    val hatchTicks: Int,
    nutrition: Double,
) : SimObject(id, position) {
    init {
        require(hatchTicks > 0) { "hatchTicks must be positive" }
        require(nutrition > 0) { "nutrition must be positive" }
    }

    /** Ticks until the egg hatches. */
    var ticksLeft: Int = hatchTicks
        private set
    private var hatched = false

    /** Nutrition left in the egg; an eater gets this much in total. */
    var nutrition: Double = nutrition
        private set

    /** How far along the egg is, from 0.0 (just laid) to 1.0 (ready to hatch). */
    val progress: Double get() = 1.0 - ticksLeft.toDouble() / hatchTicks

    /** Whether the egg is still there and its cooldown is over. */
    val readyToHatch: Boolean get() = !isRemoved && ticksLeft <= 0

    override val isRemoved: Boolean get() = hatched || nutrition <= 0

    /** Counts the hatch cooldown down by one tick. */
    override fun tick() { if (ticksLeft > 0) ticksLeft-- }

    /** Marks the egg as hatched; it is removed from the world. */
    fun hatch() { hatched = true }

    /** Eats up to [amount] of nutrition and returns how much was actually consumed. */
    fun eat(amount: Double): Double {
        val eaten = amount.coerceIn(0.0, nutrition)
        nutrition -= eaten
        return eaten
    }
}

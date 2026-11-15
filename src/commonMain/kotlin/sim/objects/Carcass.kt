package sim.objects

import base.Vector2

/** Ticks a carcass takes to rot away completely (3 in-game days), long enough for scavengers to find it. */
const val CARCASS_ROT_TICKS = 3600

/**
 * A dead animal's body. Can be eaten; despawns once fully eaten. It also rots: its nutrition shrinks evenly
 * over [rotTicks] ticks and it despawns when nothing is left, so dead bodies cannot pile up as a permanent food store.
 */
class Carcass(id: Int, position: Vector2, nutrition: Double, val rotTicks: Int = CARCASS_ROT_TICKS) :
    SimObject(id, position) {
    init {
        require(nutrition > 0) { "nutrition must be positive" }
        require(rotTicks > 0) { "rotTicks must be positive" }
    }

    /** Nutrition the carcass started with. */
    val initialNutrition: Double = nutrition

    /** Nutrition left in the carcass. */
    var nutrition: Double = nutrition
        private set

    override val isRemoved: Boolean get() = nutrition <= 0

    /** Eats up to [amount] of nutrition and returns how much was actually consumed. */
    fun eat(amount: Double): Double {
        val eaten = amount.coerceIn(0.0, nutrition)
        nutrition -= eaten
        return eaten
    }

    /** Rots by one tick. */
    override fun tick() { nutrition = (nutrition - initialNutrition / rotTicks).coerceAtLeast(0.0) }
}

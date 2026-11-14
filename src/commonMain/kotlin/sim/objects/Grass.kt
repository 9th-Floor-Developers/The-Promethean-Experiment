package sim.objects

import base.Vector2

/**
 * A tuft of grass (docs/sim/SIM_OBJECT.MD). Grows mostly on plain tiles. Edible until eaten, then non-edible for
 * [cooldownTicks] ticks. Animals walk over it.
 */
class Grass(
    id: Int,
    position: Vector2,
    /** Nutrition an animal gains from eating the tuft once. */
    val nutritionValue: Double = 6.0,
    /** Ticks the tuft stays non-edible after being eaten. */
    val cooldownTicks: Int = 100,
) : SimObject(id, position), Plant {
    /** Ticks left until the grass is edible again; 0 means edible. */
    var cooldownRemaining: Int = 0
        private set

    override val isEdible: Boolean get() = cooldownRemaining == 0

    override fun eat(): Double {
        if (!isEdible) return 0.0
        cooldownRemaining = cooldownTicks
        return nutritionValue
    }

    /** Advances the cooldown by one tick. */
    override fun tick() { if (cooldownRemaining > 0) cooldownRemaining-- }
}

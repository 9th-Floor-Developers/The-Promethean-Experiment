package sim.objects

import base.Vector2

/**
 * A tree (docs/sim/SIM_OBJECT.MD). Is edible until eaten, then is non-edible for [cooldownTicks]
 * ticks before it can be eaten again.
 */
class Tree(
    id: Int,
    position: Vector2,
    /** Nutrition an animal gains from eating the tree once. */
    val nutritionValue: Double = 20.0,
    /** Ticks the tree stays non-edible after being eaten. */
    val cooldownTicks: Int = 200,
) : SimObject(id, position), Plant {
    /** Ticks left until the tree is edible again; 0 means edible. */
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

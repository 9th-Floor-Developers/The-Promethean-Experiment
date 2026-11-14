package sim.objects

import base.Vector2

/**
 * Base class for non-animal things in the world that animals can interact with
 * (see docs/sim/SIM_OBJECT.MD). Every object has a [position]; objects have no collision shape.
 */
abstract class SimObject(
    val id: Int,
    val position: Vector2,
) {
    /** Whether this object should be removed from the world. */
    open val isRemoved: Boolean get() = false

    /** Advances the object by one tick; most objects do nothing. */
    open fun tick() {}

    override fun toString() = "${this::class.simpleName}#$id@(${position.x}, ${position.y})"
}

package base

import kotlin.math.sqrt

/** Position in tile units; the tile under it is (floor(x), floor(y)). */
data class Vector2(val x: Double, val y: Double) {
    /** Squared distance to [o]; cheaper than [distanceTo] when only comparing distances. */
    fun distanceSquaredTo(o: Vector2): Double {
        val dx = x - o.x
        val dy = y - o.y
        return dx * dx + dy * dy
    }

    /** Euclidean distance to [o]. */
    fun distanceTo(o: Vector2): Double = sqrt(distanceSquaredTo(o))
}

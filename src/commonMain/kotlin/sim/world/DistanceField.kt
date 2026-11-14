package sim.world

import base.Vector2
import terrain.Terrain
import terrain.TileType

/**
 * Pre-computed map of where something static is (drinking water, trees). The *source* tiles are chosen by
 * [isSource]; for every walkable tile the field stores the walking distance (in tiles, 4-connected) to the
 * nearest source tile and which one that is, so animals can find goals and walk around lakes without
 * per-tick searches.
 */
class DistanceField(private val terrain: Terrain, isSource: (x: Int, y: Int) -> Boolean) {
    private val w = terrain.width
    private val h = terrain.height

    /** Walking distance to the nearest source tile, or -1 when none is reachable (or the tile is not walkable). */
    val distance = IntArray(w * h) { -1 }

    /** Index (y * width + x) of the nearest source tile, or -1. */
    val nearestShore = IntArray(w * h) { -1 }

    init {
        val queue = ArrayDeque<Int>()
        for (y in 0 until h) for (x in 0 until w) {
            if (terrain.isWalkable(x, y) && isSource(x, y)) {
                val i = y * w + x
                distance[i] = 0
                nearestShore[i] = i
                queue.add(i)
            }
        }
        while (queue.isNotEmpty()) {
            val i = queue.removeFirst()
            val x = i % w
            val y = i / w
            for ((nx, ny) in neighbours4(x, y)) {
                if (!terrain.isWalkable(nx, ny)) continue
                val n = ny * w + nx
                if (distance[n] == -1) {
                    distance[n] = distance[i] + 1
                    nearestShore[n] = nearestShore[i]
                    queue.add(n)
                }
            }
        }
    }

    private fun neighbours4(x: Int, y: Int) = listOf(x - 1 to y, x + 1 to y, x to y - 1, x to y + 1)

    /** Walking distance in tiles from [p] to the nearest source tile, or -1 if none is reachable. */
    fun distanceFrom(p: Vector2): Int = indexOf(p)?.let { distance[it] } ?: -1

    /** Centre of the source tile nearest (by walking) to [p], or null if none is reachable. */
    fun nearestSourceFrom(p: Vector2): Vector2? {
        val s = indexOf(p)?.let { nearestShore[it] } ?: return null
        return if (s < 0) null else Vector2(s % w + 0.5, s / w + 0.5)
    }

    /**
     * The centre of the neighbouring tile (8 directions, no corner cutting through water) that is closest
     * to a source by walking, or null if no neighbour improves on [p]'s tile.
     */
    fun nextStepToward(p: Vector2): Vector2? {
        val cx = p.x.toInt()
        val cy = p.y.toInt()
        if (!terrain.inBounds(cx, cy)) return null
        var best = distance[cy * w + cx]
        if (best < 0) return null
        var result: Vector2? = null
        for (dy in -1..1) for (dx in -1..1) {
            if (dx == 0 && dy == 0) continue
            val nx = cx + dx
            val ny = cy + dy
            if (!terrain.isWalkable(nx, ny)) continue
            if (dx != 0 && dy != 0 && (!terrain.isWalkable(cx + dx, cy) || !terrain.isWalkable(cx, cy + dy))) continue
            val d = distance[ny * w + nx]
            if (d in 0 until best) { best = d; result = Vector2(nx + 0.5, ny + 0.5) }
        }
        return result
    }

    private fun indexOf(p: Vector2): Int? {
        val x = p.x.toInt()
        val y = p.y.toInt()
        return if (terrain.inBounds(x, y)) y * w + x else null
    }
}

/** Tiles that are walkable and touch water: where animals drink. */
fun shoreField(terrain: Terrain) = DistanceField(terrain) { x, y ->
    listOf(x - 1 to y, x + 1 to y, x to y - 1, x to y + 1)
        .any { (nx, ny) -> terrain.inBounds(nx, ny) && terrain.at(nx, ny) == TileType.WATER }
}

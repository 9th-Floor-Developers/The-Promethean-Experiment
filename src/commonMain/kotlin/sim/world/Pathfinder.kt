package sim.world

import base.Vector2
import terrain.Terrain

/**
 * Tile-grid breadth-first path search over walkable tiles (8 directions, no corner cutting through water).
 * Used when a straight walk to a target is blocked by a lake or the sea.
 */
class Pathfinder(private val terrain: Terrain) {
    private val w = terrain.width
    private val h = terrain.height

    /**
     * Waypoints (tile centres) from the tile of [from] to the tile of [to], excluding the start tile,
     * or null if [to] cannot be reached on foot.
     */
    fun findPath(from: Vector2, to: Vector2): List<Vector2>? {
        val sx = from.x.toInt()
        val sy = from.y.toInt()
        val gx = to.x.toInt()
        val gy = to.y.toInt()
        if (!terrain.isWalkable(sx, sy) || !terrain.isWalkable(gx, gy)) return null
        val start = sy * w + sx
        val goal = gy * w + gx
        if (start == goal) return emptyList()

        val parent = IntArray(w * h) { -2 }
        parent[start] = -1
        val queue = ArrayDeque<Int>()
        queue.add(start)
        while (queue.isNotEmpty()) {
            val i = queue.removeFirst()
            if (i == goal) break
            val x = i % w
            val y = i / w
            for (dy in -1..1) for (dx in -1..1) {
                if (dx == 0 && dy == 0) continue
                val nx = x + dx
                val ny = y + dy
                if (!terrain.isWalkable(nx, ny)) continue
                if (dx != 0 && dy != 0 && (!terrain.isWalkable(x + dx, y) || !terrain.isWalkable(x, y + dy))) continue
                val n = ny * w + nx
                if (parent[n] == -2) { parent[n] = i; queue.add(n) }
            }
        }
        if (parent[goal] == -2) return null
        val path = ArrayList<Vector2>()
        var i = goal
        while (i != start) { path.add(Vector2(i % w + 0.5, i / w + 0.5)); i = parent[i] }
        path.reverse()
        return path
    }
}

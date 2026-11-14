package sim.world

import base.Vector2
import kotlin.math.max
import kotlin.math.min

/**
 * Buckets items by the map cell they stand in so "what is within view range of here?" only visits the
 * few cells around a point instead of every item in the world. Cells are [CELL_SIZE] tiles wide.
 */
class SpatialGrid<T : Any>(mapWidth: Int, mapHeight: Int) {
    private val cols = (mapWidth + CELL_SIZE - 1) / CELL_SIZE
    private val rows = (mapHeight + CELL_SIZE - 1) / CELL_SIZE
    private val cells = Array(cols * rows) { ArrayList<T>() }

    private fun col(x: Double) = min(cols - 1, max(0, (x / CELL_SIZE).toInt()))
    private fun row(y: Double) = min(rows - 1, max(0, (y / CELL_SIZE).toInt()))

    /** Adds [item] at [at]; items that move must be re-added after [clear]. */
    fun add(item: T, at: Vector2) { cells[row(at.y) * cols + col(at.x)].add(item) }

    /** Empties the grid, keeping its storage for reuse. */
    fun clear() { for (c in cells) c.clear() }

    /**
     * Calls [action] for every item in a cell touching the square of half-width [range] around [at]. This is a
     * superset of the items within [range]; callers still do their own exact distance check.
     */
    inline fun forEachNear(at: Vector2, range: Double, action: (T) -> Unit) {
        for (r in rowOf(at.y - range)..rowOf(at.y + range)) for (c in colOf(at.x - range)..colOf(at.x + range)) {
            val cell = cellAt(r, c)
            for (i in 0 until cell.size) action(cell[i])
        }
    }

    @PublishedApi internal fun rowOf(y: Double) = row(y)
    @PublishedApi internal fun colOf(x: Double) = col(x)
    @PublishedApi internal fun cellAt(r: Int, c: Int): List<T> = cells[r * cols + c]

    private companion object {
        /** Cell width in tiles; about the size of a typical view range keeps queries to a handful of cells. */
        const val CELL_SIZE = 8
    }
}

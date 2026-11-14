package terrain

const val TERRAIN_SIZE = 200

class Terrain(val width: Int, val height: Int, private val tiles: Array<TileType>) {
    init { require(tiles.size == width * height) }

    fun inBounds(x: Int, y: Int) = x in 0 until width && y in 0 until height
    fun at(x: Int, y: Int): TileType = tiles[y * width + x]
    fun isWalkable(x: Int, y: Int) = inBounds(x, y) && at(x, y).walkable

    fun counts(): Map<TileType, Int> = TileType.entries.associateWith { t -> tiles.count { it == t } }
}

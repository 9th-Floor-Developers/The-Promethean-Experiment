package terrain

/** Terrain tile kinds. Animals are ground-only, so only [walkable] tiles can be entered. */
enum class TileType(val walkable: Boolean, val symbol: Char) {
    WATER(false, '~'),
    PLAIN(true, '.'),
    FOREST(true, 'T'),
    DESERT(true, ':'),
}

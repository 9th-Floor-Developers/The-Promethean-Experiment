import terrain.Terrain
import terrain.TerrainGenerator
import terrain.TileType

/**
 * Entry point exposed to the TypeScript frontend (via Kotlin/Wasm).
 * Generates a terrain with [TerrainGenerator] and serialises it as JSON:
 * `{"width":W,"height":H,"tileTypes":[{"name","walkable","symbol"}...],"tiles":"<one digit per tile>"}`.
 * `tiles` is row-major (index = y * width + x); each digit is an index into `tileTypes`
 * (the [TileType] ordinal), so the frontend never hard-codes the tile list.
 * [seed] is an Int because Long is not part of the Wasm JS-interop surface.
 */
@OptIn(ExperimentalJsExport::class)
@JsExport
fun generateTerrainJson(seed: Int, size: Int): String {
    val terrain = TerrainGenerator.generate(seed.toLong(), size)
    return terrainToJson(terrain)
}

/** Serialises [terrain] into the JSON contract documented on [generateTerrainJson]. */
internal fun terrainToJson(terrain: Terrain): String {
    val types = TileType.entries.joinToString(",") {
        """{"name":"${it.name}","walkable":${it.walkable},"symbol":"${it.symbol}"}"""
    }
    val tiles = buildString {
        for (y in 0 until terrain.height) for (x in 0 until terrain.width) append(terrain.at(x, y).ordinal)
    }
    return """{"width":${terrain.width},"height":${terrain.height},"tileTypes":[$types],"tiles":"$tiles"}"""
}

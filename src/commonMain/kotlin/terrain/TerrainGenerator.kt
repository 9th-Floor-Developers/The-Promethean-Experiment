package terrain

import kotlin.math.round
import kotlin.random.Random
import kotlin.math.sqrt

private fun process(name: String) = println("\n########## PROCESS: $name ##########")
private fun phase(name: String) = println("\n========== PHASE: $name ==========")
/** Common-Kotlin replacement for String.format("%.2f"), which is JVM-only. */
private fun fmt2(v: Double): String {
    val r = round(v * 100).toInt()
    return "${r / 100}.${(r % 100).toString().padStart(2, '0')}"
}

private fun step(name: String) = println("---------- STEP: $name ----------")

object TerrainGenerator {
    // Noise scale: smaller = larger landmasses.
    private const val SCALE = 0.06
    private const val WATER_LEVEL = 0.42
    private const val DRY_LEVEL = 0.42
    private const val WET_LEVEL = 0.58

    private const val NOISE_WEIGHT = 0.45
    private const val MASK_WEIGHT = 0.65

    /** Flood-fills land (4-connected), keeps the biggest region, floods the rest. Returns tiles removed. */
    private fun keepLargestLandmass(tiles: Array<TileType>, size: Int): Int {
        val region = IntArray(size * size) { -1 }
        val sizes = mutableListOf<Int>()
        for (start in tiles.indices) {
            if (tiles[start] == TileType.WATER || region[start] != -1) continue
            val id = sizes.size
            var count = 0
            val stack = ArrayDeque<Int>().apply { add(start) }
            region[start] = id
            while (stack.isNotEmpty()) {
                val i = stack.removeLast()
                count++
                val x = i % size
                val y = i / size
                for ((nx, ny) in listOf(x - 1 to y, x + 1 to y, x to y - 1, x to y + 1)) {
                    if (nx !in 0 until size || ny !in 0 until size) continue
                    val n = ny * size + nx
                    if (tiles[n] != TileType.WATER && region[n] == -1) { region[n] = id; stack.add(n) }
                }
            }
            sizes.add(count)
        }
        val best = sizes.indices.maxByOrNull { sizes[it] } ?: return 0
        var removed = 0
        for (i in tiles.indices) if (region[i] != -1 && region[i] != best) { tiles[i] = TileType.WATER; removed++ }
        return removed
    }

    /** Ponds are placed at least this many tiles from existing water, so they serve the interior. */
    private const val POND_MIN_COAST_DISTANCE = 6
    /** Minimum distance between pond centres, in tiles. */
    private const val POND_SPACING = 16.0
    /** Pond radius range in tiles; at least ~1.6 so a pond is wide enough to render as water. */
    private const val POND_MIN_RADIUS = 1.7
    private const val POND_MAX_RADIUS = 3.3
    /** About one pond per this many land tiles. */
    private const val LAND_TILES_PER_POND = 600

    /** Distance (4-connected) from every tile to the nearest water tile. */
    private fun distanceToWater(tiles: Array<TileType>, size: Int): IntArray {
        val dist = IntArray(size * size) { -1 }
        val queue = ArrayDeque<Int>()
        for (i in tiles.indices) if (tiles[i] == TileType.WATER) { dist[i] = 0; queue.add(i) }
        while (queue.isNotEmpty()) {
            val i = queue.removeFirst()
            val x = i % size
            val y = i / size
            for ((nx, ny) in listOf(x - 1 to y, x + 1 to y, x to y - 1, x to y + 1)) {
                if (nx !in 0 until size || ny !in 0 until size) continue
                val n = ny * size + nx
                if (dist[n] == -1) { dist[n] = dist[i] + 1; queue.add(n) }
            }
        }
        return dist
    }

    /** Picks pond centres (count scaled by [waterAmount], 1.0 = normal) on land far from the coast and from each other, spread across the island. */
    private fun pickPondSites(tiles: Array<TileType>, size: Int, rng: Random, waterAmount: Double): List<Pair<Int, Int>> {
        val dist = distanceToWater(tiles, size)
        val landCount = tiles.count { it != TileType.WATER }
        val wanted = (landCount * waterAmount / LAND_TILES_PER_POND).toInt().coerceAtLeast(1)
        val candidates = tiles.indices.filter { dist[it] >= POND_MIN_COAST_DISTANCE }.shuffled(rng)
        val sites = mutableListOf<Pair<Int, Int>>()
        for (i in candidates) {
            if (sites.size >= wanted) break
            val x = i % size
            val y = i / size
            val farEnough = sites.all { (sx, sy) -> (sx - x) * (sx - x) + (sy - y) * (sy - y) >= POND_SPACING * POND_SPACING }
            if (farEnough) sites.add(x to y)
        }
        return sites
    }

    /** Turns a roughly round, slightly ragged patch of land around (cx, cy) into water. Returns tiles changed. */
    private fun carvePond(tiles: Array<TileType>, size: Int, cx: Int, cy: Int, radius: Double, rng: Random): Int {
        var changed = 0
        val reach = radius.toInt() + 2
        for (y in cy - reach..cy + reach) for (x in cx - reach..cx + reach) {
            if (x !in 0 until size || y !in 0 until size) continue
            val dx = x - cx
            val dy = y - cy
            val ragged = radius + (rng.nextDouble() - 0.5) * 0.9
            if (sqrt((dx * dx + dy * dy).toDouble()) <= ragged && tiles[y * size + x] != TileType.WATER) {
                tiles[y * size + x] = TileType.WATER
                changed++
            }
        }
        return changed
    }

    /** Generates the island. [waterAmount] scales how many inland ponds are carved (1.0 = default, at least one pond). */
    fun generate(seed: Long, size: Int = TERRAIN_SIZE, waterAmount: Double = 1.0): Terrain {
        process("Terrain Generation (${size}x$size, seed=$seed)")

        phase("1/3 Noise field")
        step("1/4 Seed noise generators")
        val elevation = Perlin(seed)
        val moisture = Perlin(seed xor 0x5DEECE66DL)
        println("elevation + moisture generators seeded")

        step("2/4 Sample Perlin noise")
        val elev = DoubleArray(size * size)
        val moist = DoubleArray(size * size)
        for (y in 0 until size) for (x in 0 until size) {
            elev[y * size + x] = elevation.octave(x * SCALE, y * SCALE)
            moist[y * size + x] = moisture.octave(x * SCALE + 1000, y * SCALE + 1000)
        }
        println("sampled ${size * size} points x 2 fields")

        step("3/4 Normalize")
        println("octave() output is already normalized to 0..1; elevation range " +
            "${fmt2(elev.min())}..${fmt2(elev.max())}")

        step("4/4 Apply continent mask (Pangea)")
        val half = size / 2.0
        for (y in 0 until size) for (x in 0 until size) {
            val dx = (x + 0.5 - half) / half
            val dy = (y + 0.5 - half) / half
            val d = sqrt(dx * dx + dy * dy).coerceAtMost(1.0)
            elev[y * size + x] = elev[y * size + x] * NOISE_WEIGHT + (1 - d) * MASK_WEIGHT
        }
        println("radial falloff applied: land concentrates at the map centre")

        phase("2/3 Tile classification")
        step("1/2 Classify tiles")
        val tiles = Array(size * size) { i ->
            when {
                elev[i] < WATER_LEVEL -> TileType.WATER
                moist[i] < DRY_LEVEL -> TileType.DESERT
                moist[i] > WET_LEVEL -> TileType.FOREST
                else -> TileType.PLAIN
            }
        }

        step("2/2 Keep largest landmass")
        val removed = keepLargestLandmass(tiles, size)
        println("converted $removed tiles of stray islands to WATER")

        phase("3/3 Ponds")
        step("1/4 Pick pond sites")
        val rng = Random(seed xor 0x706F6E64L)
        val sites = pickPondSites(tiles, size, rng, waterAmount)
        println("picked ${sites.size} pond sites (inland, at least $POND_MIN_COAST_DISTANCE tiles from water, $POND_SPACING apart)")

        step("2/4 Carve ponds")
        var carved = 0
        for ((cx, cy) in sites) carved += carvePond(tiles, size, cx, cy, POND_MIN_RADIUS + rng.nextDouble() * (POND_MAX_RADIUS - POND_MIN_RADIUS), rng)
        println("carved $carved pond tiles")

        step("3/4 Keep largest landmass again")
        println("converted ${keepLargestLandmass(tiles, size)} tiles cut off by ponds to WATER")
        val terrain = Terrain(size, size, tiles)

        step("4/4 Summary")
        terrain.counts().forEach { (t, n) -> println("${t.name.padEnd(7)} $n") }
        for (y in 0 until size) println((0 until size).joinToString("") { terrain.at(it, y).symbol.toString() })

        return terrain
    }
}

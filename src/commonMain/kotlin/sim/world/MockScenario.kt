package sim.world

import base.Vector2
import sim.objects.Grass
import sim.objects.Tree
import sim.species.Species
import sim.species.Trait
import terrain.TERRAIN_SIZE
import terrain.TerrainGenerator
import terrain.TileType
import kotlin.random.Random

/** Mock carnivore used until real species definitions exist. */
val MOCK_CARNIVORE = Species(
    name = "Mock Carnivore",
    traits = setOf(Trait.HARD_CODED, Trait.CARNIVORE, Trait.LIVE_BIRTH, Trait.FUR, Trait.ENDOTHERMIC, Trait.CREPUSCULAR, Trait.PACK),
    speed = 0.10,
    staminaSprintCost = 0.1,
    viewRange = 24.0,
    bodyRadius = 0.35,
    attackDamage = 3.0,
    reproductionNutritionThreshold = 85.0,
    reproductionNutritionCost = 60.0,
    reproductionCooldownTicks = 3600,
    nutritionDrain = 0.045,
)

/** Mock herbivore used until real species definitions exist. */
val MOCK_HERBIVORE = Species(
    name = "Mock Herbivore",
    traits = setOf(Trait.HARD_CODED, Trait.HERBIVORE, Trait.LIVE_BIRTH, Trait.FUR, Trait.ENDOTHERMIC, Trait.DIURNAL),
    reproductionCooldownTicks = 600,
    carcassNutrition = 70.0,
)

/** Starting population of each mock species. */
const val START_CARNIVORES = 10
const val START_HERBIVORES = 40

/** Ticks plants stay inedible after being eaten; long enough that food, not predators alone, limits the herbivores. */
const val TREE_COOLDOWN_TICKS = 2400
const val GRASS_COOLDOWN_TICKS = 1200

/** Chance per tile of a grass tuft: mostly plains, a little in forests. */
const val GRASS_ON_PLAIN = 0.12
const val GRASS_ON_FOREST = 0.03

/**
 * Builds the demo world shared by the JVM entry point and the Wasm export: generated terrain, the two
 * mock species spread over random land tiles, then grass and trees (dense in forests).
 */
fun createMockWorld(seed: Long, size: Int = TERRAIN_SIZE): World {
    val terrain = TerrainGenerator.generate(seed, size)
    val world = World(terrain, listOf(MOCK_CARNIVORE, MOCK_HERBIVORE), seed)
    val rng = Random(seed)

    val spots = (0 until terrain.width * terrain.height)
        .map { Vector2((it % terrain.width) + 0.5, (it / terrain.width) + 0.5) }
        .filter { terrain.at(it.x.toInt(), it.y.toInt()) != TileType.WATER }
        .shuffled(rng)
    repeat(START_CARNIVORES) { world.spawn(MOCK_CARNIVORE, spots[it]) }
    repeat(START_HERBIVORES) { world.spawn(MOCK_HERBIVORE, spots[START_CARNIVORES + it]) }
    scatterObjects(world, rng)
    return world
}

/** Scatters grass (mostly plains), and trees (dense in forests, sparse on plains), keeping trees clear of spawned animals. */
private fun scatterObjects(world: World, rng: Random) {
    val terrain = world.terrain
    for (y in 0 until terrain.height) for (x in 0 until terrain.width) {
        val tile = terrain.at(x, y)
        val roll = rng.nextDouble()
        val pos = Vector2(x + 0.2 + rng.nextDouble() * 0.6, y + 0.2 + rng.nextDouble() * 0.6)
        val grassRoll = rng.nextDouble()
        if ((tile == TileType.PLAIN && grassRoll < GRASS_ON_PLAIN) || (tile == TileType.FOREST && grassRoll < GRASS_ON_FOREST)) {
            world.spawnObject(Vector2(x + 0.1 + rng.nextDouble() * 0.8, y + 0.1 + rng.nextDouble() * 0.8)) { id, p -> Grass(id, p, cooldownTicks = GRASS_COOLDOWN_TICKS) }
        }
        if (world.animals.any { it.position.distanceSquaredTo(pos) < 1.0 }) continue
        when {
            tile == TileType.FOREST && roll < 0.25 -> world.spawnObject(pos) { id, p -> Tree(id, p, cooldownTicks = TREE_COOLDOWN_TICKS) }
            tile == TileType.PLAIN && roll < 0.03 -> world.spawnObject(pos) { id, p -> Tree(id, p, cooldownTicks = TREE_COOLDOWN_TICKS) }
        }
    }
}

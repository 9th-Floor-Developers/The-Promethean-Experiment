package sim.world

import base.Vector2
import sim.objects.CARCASS_ROT_TICKS
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
    traits = setOf(Trait.HARD_CODED, Trait.CARNIVORE, Trait.LIVE_BIRTH, Trait.FUR, Trait.CREPUSCULAR),
    speed = 0.09,
    staminaSprintCost = 0.1,
    viewRange = 30.0,
    bodyRadius = 0.35,
    attackDamage = 3.0,
    reproductionNutritionThreshold = 85.0,
    reproductionNutritionCost = 60.0,
    reproductionCooldownTicks = 6000,
    nutritionDrain = 0.027,
)

/** Mock herbivore used until real species definitions exist. */
val MOCK_HERBIVORE = Species(
    name = "Mock Herbivore",
    traits = setOf(Trait.HARD_CODED, Trait.HERBIVORE, Trait.LIVE_BIRTH, Trait.FUR, Trait.DIURNAL),
    speed = 0.07,
    viewRange = 16.0,
    reproductionCooldownTicks = 600,
    carcassNutrition = 70.0,
)

/** Starting population of each mock species. */
const val START_CARNIVORES = 10
const val START_HERBIVORES = 40

/**
 * How plentiful each resource is: multipliers where 1.0 is the default amount (ponds, trees, grass tufts), plus
 * [carcassRotTicks], how long a dead body stays as food before it has rotted away, and [brainNoise], the world's
 * decision noise for neural-network animals (0 = off, see [sim.animal.Mind.pickDrive]).
 */
class Resources(
    val water: Double = 1.0,
    val trees: Double = 1.0,
    val grass: Double = 1.0,
    val carcassRotTicks: Int = CARCASS_ROT_TICKS,
    val brainNoise: Double = 0.0,
)

/** Ticks plants stay inedible after being eaten; long enough that food, not predators alone, limits the herbivores. */
const val TREE_COOLDOWN_TICKS = 2400
const val GRASS_COOLDOWN_TICKS = 1200

/** Chance per tile of a grass tuft: mostly plains, a little in forests. */
const val GRASS_ON_PLAIN = 0.12
const val GRASS_ON_FOREST = 0.03

/**
 * Builds the default demo world shared by the JVM entry point and the Wasm export: generated terrain, the two
 * mock species spread over random land tiles, then grass and trees (dense in forests).
 */
fun createMockWorld(seed: Long, size: Int = TERRAIN_SIZE): World =
    createWorld(seed, size, listOf(SpeciesSetup(MOCK_CARNIVORE, START_CARNIVORES), SpeciesSetup(MOCK_HERBIVORE, START_HERBIVORES)))

/**
 * Builds a world from user-chosen [setups]: generated terrain, each species spread over random land tiles
 * (as many as fit), then grass and trees. The terrain depends only on [seed] and [size].
 */
fun createWorld(seed: Long, size: Int, setups: List<SpeciesSetup>, resources: Resources = Resources()): World {
    val terrain = TerrainGenerator.generate(seed, size, resources.water)
    val world = World(terrain, setups.map { it.species }, seed, resources.carcassRotTicks.coerceAtLeast(1), resources.brainNoise.coerceAtLeast(0.0))
    val rng = Random(seed)

    val spots = (0 until terrain.width * terrain.height)
        .map { Vector2((it % terrain.width) + 0.5, (it / terrain.width) + 0.5) }
        .filter { terrain.at(it.x.toInt(), it.y.toInt()) != TileType.WATER }
        .shuffled(rng)
    var next = 0
    for (setup in setups) repeat(setup.count) { if (next < spots.size) world.spawn(setup.species, spots[next++]) }
    scatterObjects(world, rng, resources)
    return world
}

/** Scatters grass (mostly plains), and trees (dense in forests, sparse on plains), keeping trees clear of spawned animals. */
private fun scatterObjects(world: World, rng: Random, resources: Resources) {
    val terrain = world.terrain
    for (y in 0 until terrain.height) for (x in 0 until terrain.width) {
        val tile = terrain.at(x, y)
        val roll = rng.nextDouble()
        val pos = Vector2(x + 0.2 + rng.nextDouble() * 0.6, y + 0.2 + rng.nextDouble() * 0.6)
        val grassRoll = rng.nextDouble()
        if ((tile == TileType.PLAIN && grassRoll < GRASS_ON_PLAIN * resources.grass) || (tile == TileType.FOREST && grassRoll < GRASS_ON_FOREST * resources.grass)) {
            world.spawnObject(Vector2(x + 0.1 + rng.nextDouble() * 0.8, y + 0.1 + rng.nextDouble() * 0.8)) { id, p -> Grass(id, p, cooldownTicks = GRASS_COOLDOWN_TICKS) }
        }
        if (world.animals.any { it.position.distanceSquaredTo(pos) < 1.0 }) continue
        when {
            tile == TileType.FOREST && roll < 0.25 * resources.trees -> world.spawnObject(pos) { id, p -> Tree(id, p, cooldownTicks = TREE_COOLDOWN_TICKS) }
            tile == TileType.PLAIN && roll < 0.03 * resources.trees -> world.spawnObject(pos) { id, p -> Tree(id, p, cooldownTicks = TREE_COOLDOWN_TICKS) }
        }
    }
}

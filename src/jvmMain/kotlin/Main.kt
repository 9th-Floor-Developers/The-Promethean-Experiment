import sim.world.MOCK_CARNIVORE
import sim.world.MOCK_HERBIVORE
import sim.world.START_CARNIVORES
import sim.world.START_HERBIVORES
import sim.world.SpeciesSetup
import sim.world.TICKS_PER_DAY
import sim.world.createWorld
import terrain.TERRAIN_SIZE

/** Ticks between one-line population summaries. */
private const val SUMMARY_EVERY = TICKS_PER_DAY / 4

/** Number of opening ticks printed with full process/phase/step banners. */
private const val VERBOSE_TICKS = 2

/**
 * Entry point. Usage: `[seed] [days] [mapSize] [carnivores] [herbivores]` (defaults 42, 3, TERRAIN_SIZE and the mock
 * starting counts). Builds a world with the two mock species, then ticks it for the given number of in-game days.
 * The extra arguments exist for scale experiments (map size and starting populations versus long-run stability).
 */
fun main(args: Array<String>) {
    val seed = args.firstOrNull()?.toLongOrNull() ?: 42L
    val days = args.getOrNull(1)?.toIntOrNull() ?: 3
    val size = args.getOrNull(2)?.toIntOrNull() ?: TERRAIN_SIZE
    val carnivores = args.getOrNull(3)?.toIntOrNull() ?: START_CARNIVORES
    val herbivores = args.getOrNull(4)?.toIntOrNull() ?: START_HERBIVORES
    val world = createWorld(seed, size, listOf(SpeciesSetup(MOCK_CARNIVORE, carnivores), SpeciesSetup(MOCK_HERBIVORE, herbivores)))

    println("\n########## PROCESS: Simulation Run ($days days, ${days * TICKS_PER_DAY} ticks, map ${size}x$size, $carnivores carnivores, $herbivores herbivores) ##########")
    println(world.summary())
    repeat(days * TICKS_PER_DAY) {
        world.tick(verbose = it < VERBOSE_TICKS)
        if (world.clock.tick % SUMMARY_EVERY == 0L) println(world.summary())
        if (world.animals.isEmpty()) {
            println("all animals are dead; stopping at ${world.clock.format()}")
            return
        }
    }
    println("\nsimulation finished at ${world.clock.format()}")
}

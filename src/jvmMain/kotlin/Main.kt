import sim.world.TICKS_PER_DAY
import sim.world.createMockWorld

/** Ticks between one-line population summaries. */
private const val SUMMARY_EVERY = TICKS_PER_DAY / 4

/** Number of opening ticks printed with full process/phase/step banners. */
private const val VERBOSE_TICKS = 2

/**
 * Entry point. Usage: `[seed] [days]` (defaults 42 and 3). Builds the mock world, then ticks it for the
 * given number of in-game days.
 */
fun main(args: Array<String>) {
    val seed = args.firstOrNull()?.toLongOrNull() ?: 42L
    val days = args.getOrNull(1)?.toIntOrNull() ?: 3
    val world = createMockWorld(seed)

    println("\n########## PROCESS: Simulation Run ($days days, ${days * TICKS_PER_DAY} ticks) ##########")
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

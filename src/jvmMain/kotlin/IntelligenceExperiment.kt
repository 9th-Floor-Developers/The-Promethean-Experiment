import sim.animal.Animal
import sim.animal.Mind
import sim.animal.NeuralNet
import kotlin.random.Random
import sim.species.Trait
import sim.world.Resources
import sim.world.TICKS_PER_DAY
import sim.world.createWorld
import sim.world.parseSpeciesConfig
import java.io.File
import java.io.OutputStream
import java.io.PrintStream
import java.util.concurrent.Executors
import kotlin.math.sqrt

/**
 * One animal's end, as the Statistics page records it (src/sim/useDeaths.ts): the age in days it reached and its
 * intelligence (network connections, fixed at birth). [day] is the in-game day it died on, for checkpoint statistics.
 */
private class Death(val age: Double, val intelligence: Int, val day: Double, val cause: String = "")

/** Pearson correlation of [x] and [y]; null when undefined (fewer than 3 points, or either side constant). */
private fun pearsonOf(x: DoubleArray, y: DoubleArray): Double? {
    if (x.size < 3) return null
    val mx = x.average(); val my = y.average()
    var sxy = 0.0; var sxx = 0.0; var syy = 0.0
    for (i in x.indices) { val dx = x[i] - mx; val dy = y[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy }
    return if (sxx <= 0 || syy <= 0) null else sxy / sqrt(sxx * syy)
}

/** Pearson correlation of intelligence and age at death, exactly as the Statistics page computes it. */
private fun pearson(rows: List<Death>): Double? =
    pearsonOf(DoubleArray(rows.size) { rows[it].intelligence.toDouble() }, DoubleArray(rows.size) { rows[it].age })

/** Ranks of [v] (ties share their average rank), for [spearman]. */
private fun ranks(v: List<Double>): DoubleArray {
    val idx = v.indices.sortedBy { v[it] }
    val out = DoubleArray(v.size)
    var i = 0
    while (i < idx.size) {
        var j = i
        while (j + 1 < idx.size && v[idx[j + 1]] == v[idx[i]]) j++
        val rank = (i + j) / 2.0
        for (k in i..j) out[idx[k]] = rank
        i = j + 1
    }
    return out
}

/** Spearman rank correlation of intelligence and age at death: robust to a few outliers, unlike [pearson]. */
private fun spearman(rows: List<Death>): Double? =
    pearsonOf(ranks(rows.map { it.intelligence.toDouble() }), ranks(rows.map { it.age }))

/** Result of one seed: per neural-network species, its deaths, and how many of every species were alive at the end. */
private class RunResult(val seed: Long, val deaths: Map<String, List<Death>>, val finalPops: Map<String, Int>, val endDay: Double)

/**
 * Runs one world for [days] in-game days and records every death of a SOFT_CODED animal. Deaths are found the way the
 * frontend finds them: an animal present before a tick and gone after it has died.
 */
private fun runSeed(seed: Long, days: Int, size: Int, config: String, resources: Resources, founderShapes: List<IntArray>?, all: Boolean, diag: MutableMap<String, Int>? = null, mutateFounders: Boolean = false): RunResult {
    val setups = parseSpeciesConfig(config)
    val world = createWorld(seed, size, setups, resources)
    val soft = setups.map { it.species }.filter { all || Trait.SOFT_CODED in it.traits }.toSet()
    // Controlled test: give the neural founders brains of different shapes (round robin) instead of all the same one.
    if (founderShapes != null) {
        val rng = Random(seed * 31 + 7)
        var k = 0
        for (i in world.animals.indices) {
            val a = world.animals[i]
            if (a.mind == null) continue
            val hidden = founderShapes[k++ % founderShapes.size]
            val mind = Mind(NeuralNet.random(intArrayOf(Mind.INPUTS, *hidden, Mind.OUTPUTS), rng))
            world.animals[i] = Animal(a.id, a.species, a.position, a.stats, mind = mind)
        }
    }
    // --mutate-founders: each neural founder gets the brain a newborn of two founders would (one round of birth mutation),
    // to measure what founder diversity would do. Test only; the simulation itself starts every founder alike.
    if (mutateFounders) {
        for (i in world.animals.indices) {
            val a = world.animals[i]
            val m = a.mind ?: continue
            world.animals[i] = Animal(a.id, a.species, a.position, a.stats, mind = Mind.inherit(a.species, m, Mind.founder(world.rng), world.rng))
        }
    }
    val deaths = soft.associate { it.name to ArrayList<Death>() }
    var before: List<Animal> = world.animals.toList()
    repeat(days * TICKS_PER_DAY) {
        world.tick()
        val alive = HashSet<Animal>(world.animals)
        for (a in before) if (a !in alive && a.species in soft) {
            deaths[a.species.name]!!.add(Death(a.age, a.mind?.net?.connections ?: -1, world.clock.tick.toDouble() / TICKS_PER_DAY, causeKind(a.causeOfDeath)))
        }
        before = world.animals.toList()
        if (diag != null) for (a in world.animals) if (a.mind != null) {
            val key = a.action::class.simpleName ?: "?"
            diag.merge(key, 1, Int::plus)
            if (a.hydration < 30) diag.merge("thirsty:" + key, 1, Int::plus)
            if (a.nutrition < 30) diag.merge("hungry:" + key, 1, Int::plus)
        }
        if (world.animals.none { it.species in soft }) {
            return RunResult(seed, deaths, setups.associate { s -> s.species.name to world.animals.count { it.species == s.species } }, world.clock.tick.toDouble() / TICKS_PER_DAY)
        }
    }
    return RunResult(seed, deaths, setups.associate { s -> s.species.name to world.animals.count { it.species == s.species } }, world.clock.tick.toDouble() / TICKS_PER_DAY)
}

/** A death cause with the animal labels stripped, e.g. "killed by" or "starved", for the cause tally. */
private fun causeKind(cause: String?): String = when {
    cause == null -> "unknown"
    cause.startsWith("killed by") && cause.endsWith("spikes") -> "spikes"
    cause.startsWith("killed by") -> "killed"
    "venom" in cause -> "venom"
    "poisoned" in cause -> "poison"
    else -> cause
}

private fun f2(v: Double?) = v?.let { "%.3f".format(it) } ?: "  -  "

/**
 * Headless experiment for the intelligence-lifespan question: runs a species config on several seeds in parallel and
 * prints, per neural-network species, the Pearson correlation of intelligence at birth and age at death that the
 * Statistics page shows (plus Spearman, checkpoints and population outcome), then the mean over seeds.
 *
 * Usage: `IntelligenceExperimentKt configFile seeds days [mapSize] [water] [trees] [grass] [carcassRotHours] [brainNoise] [threads] [flags]`
 * with seeds comma separated and the world values as on the Settings screen (defaults 200, 1, 1, 1, 72, 0). Flags:
 * `--sizes` per-brain-size table, `--hist` age-at-death histogram, `--causes` death causes, `--diag` what the learners
 * spend their ticks doing, `--all` also record instinct species, `--mutate-founders` gives each neural founder one round of birth mutation, `--shapes=2;8;8,8` gives the neural founders those
 * hidden layers in turn instead of the usual founder brain (a controlled brain-size test). Simulation events are
 * silenced; only the report is printed. Used to tune the "Intelligence pays" preset (src/settings/presets.ts).
 */
fun main(args: Array<String>) {
    val config = File(args[0]).readText()
    val seeds = args[1].split(",").map { it.trim().toLong() }
    val days = args[2].toInt()
    val size = args.getOrNull(3)?.toIntOrNull() ?: 200
    val num = { i: Int, d: Double -> args.getOrNull(i)?.toDoubleOrNull() ?: d }
    val resources = Resources(num(4, 1.0), num(5, 1.0), num(6, 1.0), (num(7, 72.0) * TICKS_PER_DAY / 24).toInt(), num(8, 0.0))
    val threads = args.getOrNull(9)?.toIntOrNull() ?: seeds.size
    // --shapes=2;4;8,8 gives neural founders these hidden layers in turn (a controlled brain-size test).
    val shapes = args.firstOrNull { it.startsWith("--shapes=") }?.removePrefix("--shapes=")?.split(";")
        ?.map { l -> l.split(",").map { it.trim().toInt() }.toIntArray() }

    val out = System.out
    System.setOut(PrintStream(OutputStream.nullOutputStream())) // simEvent prints every birth and death
    // --diag tallies, over every tick, what the neural animals are doing (also when thirsty or hungry).
    val diag: MutableMap<String, Int>? = if ("--diag" in args) java.util.concurrent.ConcurrentHashMap() else null
    val pool = Executors.newFixedThreadPool(threads) { r -> Thread(r).apply { isDaemon = true } }
    val results = seeds.map { s -> pool.submit<RunResult> { runSeed(s, days, size, config, resources, shapes, "--all" in args, diag, "--mutate-founders" in args) } }.map { it.get() }
    pool.shutdownNow()

    out.println("########## PROCESS: Intelligence experiment (${args[0]}, $days days, map $size, seeds $seeds) ##########")
    val checkpoints = listOf(10, 20, 40, 60, 100).filter { it < days }
    val summary = HashMap<String, MutableList<Double>>()
    for (r in results) {
        out.println("---------- STEP: seed ${r.seed} (ended day ${"%.1f".format(r.endDay)}) final ${r.finalPops} ----------")
        for ((name, rows) in r.deaths) {
            val p = pearson(rows)
            p?.let { summary.getOrPut(name) { mutableListOf() }.add(it) }
            val cps = checkpoints.joinToString(" ") { d -> "d$d=${f2(pearson(rows.filter { it.day <= d }))}" }
            // Correlation within cohorts born in the same 5-day window (removes the trend over the run), averaged by size.
            val cohorts = rows.groupBy { ((it.day - it.age) / 5).toInt() }.values.filter { it.size >= 20 }
            val within = cohorts.mapNotNull { c -> pearson(c)?.let { it to c.size } }
            val rWithin = if (within.isEmpty()) null else within.sumOf { it.first * it.second } / within.sumOf { it.second }
            val iq = rows.map { it.intelligence }
            val bySize = rows.groupBy { it.intelligence }.toSortedMap().entries.joinToString(" ") { (k, v) -> "$k:${v.size}/${"%.1f".format(v.sumOf { it.age } / v.size)}" }
            out.println("  $name deaths=${rows.size} r=${f2(p)} rho=${f2(spearman(rows))} rCohort=${f2(rWithin)} iq[min=${iq.minOrNull()} mean=${"%.0f".format(iq.average())} max=${iq.maxOrNull()}] meanAge=${"%.2f".format(rows.map { it.age }.average())}  $cps")
            if (args.contains("--sizes")) out.println("    size:count/meanAge  $bySize")
            if (args.contains("--hist")) out.println("    ages(days 0-1,1-2,..,>=15) " + IntArray(16).also { h -> rows.forEach { h[it.age.toInt().coerceAtMost(15)]++ } }.joinToString(" "))
            if (args.contains("--causes")) out.println("    causes " + rows.groupBy { it.cause }.entries.joinToString(" ") { (k, v) -> "$k:${v.size}/${"%.1f".format(v.sumOf { it.age } / v.size)}d" })
        }
    }
    for ((name, rs) in summary) out.println("==> $name mean r=${"%.3f".format(rs.average())} min r=${"%.3f".format(rs.min())} over ${rs.size} seeds")
    diag?.let { d ->
        val total = d.filterKeys { ':' !in it }.values.sum().toDouble()
        out.println("DIAG " + d.entries.sortedBy { it.key }.joinToString(" ") { "${it.key}=${"%.1f".format(100 * it.value / total)}%" })
    }
    // One machine-readable line per neural species, for parameter searches: mean r, min r, mean Spearman, mean deaths,
    // seeds where it died out, seeds where every species survived, mean r over the first 15 days.
    for (name in results.first().deaths.keys) {
        val rs = results.map { pearson(it.deaths[name]!!) ?: 0.0 }
        val rhos = results.map { spearman(it.deaths[name]!!) ?: 0.0 }
        val extinct = results.count { (it.finalPops[name] ?: 0) == 0 }
        val allAlive = results.count { r -> r.finalPops.values.all { it > 0 } }
        out.println("RESULT $name ${"%.4f".format(rs.average())} ${"%.4f".format(rs.min())} ${"%.4f".format(rhos.average())} ${"%.0f".format(results.map { it.deaths[name]!!.size }.average())} $extinct $allAlive ${"%.4f".format(results.map { r -> pearson(r.deaths[name]!!.filter { it.day <= 15 }) ?: 0.0 }.average())}")
    }
}

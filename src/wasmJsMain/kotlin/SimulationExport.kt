import base.Vector2
import sim.animal.Action
import sim.objects.Carcass
import sim.objects.Grass
import sim.objects.Tree
import sim.world.World
import sim.world.createMockWorld
import sim.world.createWorld
import sim.world.parseSpeciesConfig
import kotlin.math.roundToInt

/** The single running simulation, created by [createSimulation]. */
private var world: World? = null

private fun current(): World = world ?: error("createSimulation must be called first")

/** Action names in the order of [actionCode]; sent to the frontend in [getSimulationInfo]. */
private val ACTION_NAMES = listOf("REST", "WANDER", "RUN_FROM_PREDATOR", "ATTACK_TARGET", "DRINK_WATER", "EAT_FOOD", "REPRODUCE_WITH")

/** Index into [ACTION_NAMES] for an animal's current action. */
private fun actionCode(a: Action): Int = when (a) {
    Action.Rest -> 0
    Action.Wander -> 1
    is Action.RunFromPredator -> 2
    is Action.AttackTarget -> 3
    is Action.DrinkWater -> 4
    is Action.EatFood -> 5
    is Action.ReproduceWith -> 6
}

/** Rounds to 2 decimals so the JSON stays short. */
private fun r2(v: Double): Double = (v * 100).roundToInt() / 100.0

/** A JSON string literal for [s] (names here contain no characters that need escaping). */
private fun q(s: String) = "\"$s\""

/**
 * Creates (or replaces) the simulation and returns its terrain as JSON in the contract documented on
 * [generateTerrainJson]. [speciesConfig] is the Settings text (see [parseSpeciesConfig]); blank = default demo species. The frontend renders exactly this terrain, so visuals and simulation agree.
 */
@OptIn(ExperimentalJsExport::class)
@JsExport
fun createSimulation(seed: Int, size: Int, speciesConfig: String): String {
    println("\n########## PROCESS: Create Simulation (seed=$seed, size=$size) ##########")
    val w = if (speciesConfig.isBlank()) createMockWorld(seed.toLong(), size)
    else createWorld(seed.toLong(), size, parseSpeciesConfig(speciesConfig))
    world = w
    return terrainToJson(w.terrain)
}

/**
 * Static facts the frontend needs once:
 * `{"actions":[name...],"species":[{"name","canHunt","traits":[..],"maxHp","maxNutrition","maxHydration","maxStamina","viewRange"}...],
 * "scenery":[[id,type,x,y]...]}`. `actions` is indexed by an animal row's action code.
 * Scenery `type` is 1 = tree, 2 = grass; trees and grass appear in the same order as the `trees` and `grass`
 * strings of [getSimulationSnapshot]. Positions are in tile units (the tile under it is floor(x), floor(y)).
 */
@OptIn(ExperimentalJsExport::class)
@JsExport
fun getSimulationInfo(): String {
    val w = current()
    val species = w.species.joinToString(",") { s ->
        "{" + """"name":${q(s.name)},"canHunt":${s.canHunt},"traits":[${s.traits.joinToString(",") { q(it.name) }}],""" +
            """"maxHp":${s.maxHp},"maxNutrition":${s.maxNutrition},"maxHydration":${s.maxHydration},"maxStamina":${s.maxStamina},"viewRange":${s.viewRange}}"""
    }
    val scenery = w.objects.filter { it is Grass || it is Tree }.joinToString(",") {
        "[${it.id},${if (it is Tree) 1 else 2},${r2(it.position.x)},${r2(it.position.y)}]"
    }
    return """{"actions":[${ACTION_NAMES.joinToString(",") { q(it) }}],"species":[$species],"scenery":[$scenery]}"""
}

/** Advances the simulation by [ticks] ticks. Major events are printed to the console by the simulation. */
@OptIn(ExperimentalJsExport::class)
@JsExport
fun tickSimulation(ticks: Int) {
    val w = current()
    repeat(ticks) { w.tick() }
}

/**
 * Current state as JSON:
 * `{"tick","day","timeOfDay","phase",
 * "animals":[[id,speciesIndex,x,y,hp,nutrition,hydration,stamina,age,actionCode,fear,hunger,thirst,libido,targetX,targetY]...],
 * "carcasses":[[id,x,y,fractionLeft]...],"trees":"<one digit per tree, 1 = edible>","grass":"<one digit per grass tuft, 1 = edible>"}`.
 * `targetX`/`targetY` are the tile-unit position the animal is heading for (see [destination]), or -1,-1 when it has none.
 * `timeOfDay` runs 0.0 (midnight) to 1.0; `speciesIndex` indexes `species` from [getSimulationInfo].
 */
@OptIn(ExperimentalJsExport::class)
@JsExport
fun getSimulationSnapshot(): String {
    val w = current()
    val animals = w.animals.joinToString(",") { a ->
        "[${a.id},${w.species.indexOf(a.species)},${r2(a.position.x)},${r2(a.position.y)}," +
            "${r2(a.hp)},${r2(a.nutrition)},${r2(a.hydration)},${r2(a.stamina)},${r2(a.age)},${actionCode(a.action)}," +
            "${r2(a.feelings.fear)},${r2(a.feelings.hunger)},${r2(a.feelings.thirst)},${r2(a.feelings.libido)}," +
            (destination(a.action)?.let { "${r2(it.x)},${r2(it.y)}" } ?: "-1,-1") + "]"
    }
    val carcasses = w.objects.filterIsInstance<Carcass>().joinToString(",") {
        "[${it.id},${r2(it.position.x)},${r2(it.position.y)},${r2(it.nutrition / it.initialNutrition)}]"
    }
    val trees = buildString { w.objects.filterIsInstance<Tree>().forEach { append(if (it.isEdible) '1' else '0') } }
    val grass = buildString { w.grasses.forEach { append(if (it.isEdible) '1' else '0') } }
    return """{"tick":${w.clock.tick},"day":${w.clock.day},"timeOfDay":${r2(w.clock.timeOfDay)},""" +
        """"phase":"${w.clock.phase}","animals":[$animals],"carcasses":[$carcasses],"trees":"$trees","grass":"$grass"}"""
}

/** Where the animal is walking to for [action] (its food, water, mate or prey); null when it has no destination. */
private fun destination(action: Action): Vector2? = when (action) {
    is Action.DrinkWater -> action.target
    is Action.EatFood -> action.target.position
    is Action.AttackTarget -> action.target.position
    is Action.ReproduceWith -> action.target.position
    Action.Rest, Action.Wander, is Action.RunFromPredator -> null
}

/**
 * The waypoints (tile units) the animal with [id] is following around lakes toward its destination, as a flat
 * JSON array `[x0,y0,x1,y1,...]`. Empty when it walks straight, has no path, or does not exist.
 */
@OptIn(ExperimentalJsExport::class)
@JsExport
fun getAnimalPath(id: Int): String {
    val a = current().animals.firstOrNull { it.id == id } ?: return "[]"
    return a.path.joinToString(",", "[", "]") { "${r2(it.x)},${r2(it.y)}" }
}

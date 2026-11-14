package sim.world

import sim.species.Species
import sim.species.Trait

/** One species the user configured plus how many animals of it start in the world. */
class SpeciesSetup(val species: Species, val count: Int)

/** Largest starting population per species; keeps a mistyped number from freezing the browser. */
const val MAX_START_COUNT = 300

/**
 * Parses the settings text sent by the frontend's Settings screen into species setups.
 * One species per line: `name|count|key=value,key=value|TRAIT,TRAIT`.
 * Keys are the universal stats: maxHp, speed, baseStaminaUsage, walkingStaminaUsage, elderlyAge, viewRange.
 * Unknown keys/traits are ignored. Species that can hunt get carnivore-style attack and breeding defaults,
 * the rest get herbivore-style ones, so the user only has to pick traits.
 * Throws IllegalArgumentException for a malformed line or an invalid trait combination.
 */
fun parseSpeciesConfig(text: String): List<SpeciesSetup> =
    text.lines().filter { it.isNotBlank() }.map { line ->
        val parts = line.split("|")
        require(parts.size == 4) { "bad species line: '$line'" }
        val name = parts[0].replace("\"", "").replace("\\", "").trim().ifEmpty { "Species" }
        val count = (parts[1].trim().toIntOrNull() ?: 0).coerceIn(0, MAX_START_COUNT)
        val stats = parts[2].split(",").filter { "=" in it }.associate { kv ->
            kv.substringBefore("=").trim() to (kv.substringAfter("=").trim().toDoubleOrNull() ?: Double.NaN)
        }.filterValues { !it.isNaN() }
        val traits = parts[3].split(",").mapNotNull { n -> Trait.entries.firstOrNull { it.name == n.trim() } }.toSet()
        SpeciesSetup(buildSpecies(name, traits, stats), count)
    }

/** Builds a species from user-chosen [traits] and universal-stat overrides in [stats]. */
private fun buildSpecies(name: String, traits: Set<Trait>, stats: Map<String, Double>): Species {
    val hunter = Trait.CARNIVORE in traits || Trait.OMNIVORE in traits
    val maxNutrition = 100.0
    return Species(
        name = name,
        traits = traits,
        maxHp = stats["maxHp"] ?: 100.0,
        speed = stats["speed"] ?: if (hunter) 0.10 else 0.06,
        baseStaminaUsage = stats["baseStaminaUsage"] ?: 0.01,
        walkingStaminaUsage = stats["walkingStaminaUsage"] ?: 0.05,
        elderlyAge = stats["elderlyAge"] ?: 5.0,
        viewRange = stats["viewRange"] ?: if (hunter) 24.0 else 12.0,
        maxNutrition = maxNutrition,
        staminaSprintCost = if (hunter) 0.1 else 0.2,
        bodyRadius = if (hunter) 0.35 else 0.3,
        attackDamage = if (hunter) 3.0 else 0.0,
        reproductionNutritionThreshold = if (hunter) 85.0 else 70.0,
        reproductionNutritionCost = if (hunter) 60.0 else 30.0,
        reproductionCooldownTicks = if (hunter) 3600 else 600,
        nutritionDrain = if (hunter) 0.045 else 0.05,
        carcassNutrition = if (hunter) 60.0 else 70.0,
    )
}

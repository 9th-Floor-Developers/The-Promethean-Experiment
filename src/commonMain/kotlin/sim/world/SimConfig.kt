package sim.world

import sim.animal.AnimalStats
import sim.species.Species
import sim.species.Trait

/** One species the user configured plus how many animals of it start in the world. */
class SpeciesSetup(val species: Species, val count: Int)

/**
 * Ticks between a scavenger's births (2.5 days): slower than herbivores, faster than hunters. Scavengers breed from
 * 70% nutrition like herbivores, because meat eaters stop eating at 85% and so rarely pass a hunter's 85% threshold.
 */
const val SCAVENGER_REPRODUCTION_COOLDOWN = 3000

/** Largest starting population per species; keeps a mistyped number from freezing the browser. */
const val MAX_START_COUNT = 300

/**
 * Parses the settings text sent by the frontend's Settings screen into species setups.
 * One species per line: `name|count|key=value,key=value|TRAIT,TRAIT`.
 * Keys are the inherited founder stats: maxHp, speed, damage, armor, viewRange, plus mutationRate (percent, 0 to 50; a species
 * setting, not inherited). (baseStaminaUsage, walkingStaminaUsage and elderlyAge are
 * still accepted as founder values; they are calculated for each animal from its inherited stats.)
 * Unknown keys/traits are ignored. Species that can hunt get carnivore-style attack defaults; meat eaters (hunters
 * and scavengers) get carnivore-style metabolism, since they live on big, rare meals; hunters breed like carnivores,
 * scavengers in between (see [SCAVENGER_REPRODUCTION_COOLDOWN]); the rest get herbivore-style ones, so the user only
 * has to pick traits.
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
    // Scavengers eat like carnivores (big, rare meals) even though they never attack.
    val scavenger = Trait.SCAVENGER in traits
    val meatEater = hunter || scavenger
    val maxNutrition = 100.0
    return Species(
        name = name,
        traits = traits,
        maxHp = (stats["maxHp"] ?: 100.0).coerceAtLeast(AnimalStats.MIN_MAX_HP),
        speed = (stats["speed"] ?: 0.1).coerceAtLeast(AnimalStats.MIN_SPEED),
        baseStaminaUsage = stats["baseStaminaUsage"] ?: 0.01,
        walkingStaminaUsage = stats["walkingStaminaUsage"] ?: 0.05,
        elderlyAge = stats["elderlyAge"] ?: 5.0,
        viewRange = (stats["viewRange"] ?: 10.0).coerceAtLeast(AnimalStats.MIN_VIEW_RANGE),
        maxNutrition = maxNutrition,
        staminaSprintCost = if (hunter) 0.1 else 0.2,
        bodyRadius = if (hunter) 0.35 else 0.3,
        attackDamage = (stats["damage"] ?: 3.0).coerceAtLeast(AnimalStats.MIN_DAMAGE),
        armor = (stats["armor"] ?: 1.0).coerceAtLeast(AnimalStats.MIN_ARMOR),
        reproductionNutritionThreshold = if (hunter) 85.0 else 70.0,
        reproductionNutritionCost = if (meatEater) 60.0 else 30.0,
        reproductionCooldownTicks = when { hunter -> 6000; scavenger -> SCAVENGER_REPRODUCTION_COOLDOWN; else -> 600 },
        nutritionDrain = if (meatEater) 0.027 else 0.05,
        carcassNutrition = if (hunter) 60.0 else 70.0,
        mutationRate = ((stats["mutationRate"] ?: (AnimalStats.DEFAULT_MUTATION * 100)) / 100).coerceIn(0.0, AnimalStats.MAX_MUTATION),
    )
}

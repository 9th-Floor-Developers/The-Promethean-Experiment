package sim.animal

import sim.species.Species
import kotlin.random.Random

/**
 * The universal stats of one animal (docs/sim/SPECIES.md); constant for its whole life.
 *
 * Inherited stats ([maxHp], [speed], [damage], [armor], [viewRange]) are mixed from the parents when the animal
 * is born. Calculated stats ([baseStaminaUsage], [walkingStaminaUsage], [elderlyAge]) follow from them: they
 * scale the species' founder values by how far the inherited stats are from the founders.
 */
class AnimalStats(
    val maxHp: Double,
    val speed: Double,
    /** Damage dealt per tick to a target in reach; 0 means the animal cannot attack. */
    val damage: Double,
    /** Percent of incoming attack damage absorbed (see [armorReduction]). */
    val armor: Double,
    /** Distance in tiles at which the animal sees things. */
    val viewRange: Double,
    val baseStaminaUsage: Double,
    val walkingStaminaUsage: Double,
    /** Age in days at which negative effects begin. */
    val elderlyAge: Double,
) {
    /** Fraction of attack damage armor removes: [armor] percent, never more than [MAX_ARMOR_REDUCTION]. */
    val armorReduction: Double get() = (armor / 100).coerceIn(0.0, MAX_ARMOR_REDUCTION)

    companion object {
        /** Each inherited stat is multiplied by a random factor within this fraction either side of 1 at birth. */
        const val MUTATION = 0.05

        /** Inherited stats stay between these multiples of the species' founder value, so lines cannot run away. */
        const val MIN_RATIO = 0.5
        const val MAX_RATIO = 2.0

        /** Armor never absorbs more than this fraction of damage. */
        const val MAX_ARMOR_REDUCTION = 0.8

        /** Stats of the animals a species starts with: exactly the species' own values. */
        fun founder(s: Species) = derive(s, s.maxHp, s.speed, s.attackDamage, s.armor, s.viewRange)

        /** Builds stats from the five inherited values, calculating the other three from the species' founder values. */
        fun derive(s: Species, maxHp: Double, speed: Double, damage: Double, armor: Double, viewRange: Double): AnimalStats {
            val view = ratio(viewRange, s.viewRange)
            return AnimalStats(
                maxHp, speed, damage, armor, viewRange,
                baseStaminaUsage = s.baseStaminaUsage * ratio(maxHp, s.maxHp) * view,
                walkingStaminaUsage = s.walkingStaminaUsage * ratio(speed, s.speed),
                elderlyAge = s.elderlyAge / view,
            )
        }

        /** Stats of a newborn: each inherited stat is the parents' average, randomly mutated, kept near the founder value. */
        fun inherit(s: Species, a: AnimalStats, b: AnimalStats, rng: Random): AnimalStats {
            fun mix(x: Double, y: Double, founder: Double): Double {
                if (founder == 0.0) return 0.0 // a stat the species lacks (no attack, no armor) cannot appear by mutation
                val mutated = (x + y) / 2 * (1 + (rng.nextDouble() * 2 - 1) * MUTATION)
                return mutated.coerceIn(founder * MIN_RATIO, founder * MAX_RATIO)
            }
            return derive(
                s,
                maxHp = mix(a.maxHp, b.maxHp, s.maxHp),
                speed = mix(a.speed, b.speed, s.speed),
                damage = mix(a.damage, b.damage, s.attackDamage),
                armor = mix(a.armor, b.armor, s.armor),
                viewRange = mix(a.viewRange, b.viewRange, s.viewRange),
            )
        }

        private fun ratio(value: Double, founder: Double) = if (founder == 0.0) 1.0 else value / founder
    }
}

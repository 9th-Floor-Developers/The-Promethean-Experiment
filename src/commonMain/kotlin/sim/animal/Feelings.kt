package sim.animal

import base.Vector2

/** An animal's current drives (docs/sim/ANIMALS.MD). Needs are 0.0 (satisfied) to 1.0 (desperate). */
class Feelings(
    /** How scared the animal is of the nearest [threat] (0 = no predator in sense range). */
    val fear: Double = 0.0,
    /** How much the animal wants food (0 = full nutrition). */
    val hunger: Double = 0.0,
    /** How much the animal wants water (0 = full hydration). */
    val thirst: Double = 0.0,
    /** How much the animal wants to reproduce (0 = not ready or on cooldown, 1 = fully fed). */
    val libido: Double = 0.0,
    /** Nearest predator in sense range, if any. */
    val threat: Animal? = null,
)

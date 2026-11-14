package sim.animal

import base.Vector2
import sim.objects.SimObject
import sim.world.fmt1

/** What an animal is currently doing (docs/sim/ANIMALS.MD). Re-chosen every tick. */
sealed class Action {
    /** Sleeping or resting; no movement. */
    data object Rest : Action()

    /** Aimless walking while nothing needs doing. */
    data object Wander : Action()

    /** Running directly away from a [predator]. */
    class RunFromPredator(val predator: Animal) : Action() {
        override fun toString() = "RUN_FROM_PREDATOR ${predator.label}"
    }

    /** Chasing and attacking [target]. */
    class AttackTarget(val target: Animal) : Action() {
        override fun toString() = "ATTACK_TARGET ${target.label}"
    }

    /** Walking to a shore position and drinking. */
    class DrinkWater(val target: Vector2) : Action() {
        override fun toString() = "DRINK_WATER (${fmt1(target.x)}, ${fmt1(target.y)})"
    }

    /** Walking to [target], a same-species animal, and reproducing with it once in range. */
    class ReproduceWith(val target: Animal) : Action() {
        override fun toString() = "REPRODUCE_WITH ${target.label}"
    }

    /** Walking to a tree or carcass and eating it. */
    class EatFood(val target: SimObject) : Action() {
        override fun toString() = "EAT_FOOD $target"
    }
}

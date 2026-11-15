package sim.animal

import kotlin.random.Random
import sim.species.Species

/**
 * What a SOFT_CODED animal can choose to pursue (docs/sim/ANIMALS.MD). The network outputs one value (feeling)
 * per drive; the strongest one wins and the hard-coded target search turns it into an [Action].
 */
enum class Drive { FLEE, EAT, DRINK, MATE, REST, EXPLORE }

/** One remembered decision: what was sensed, which drive was chosen, the reward it earned and what was sensed next. */
class Experience(
    val state: DoubleArray,
    val drive: Int,
    val reward: Double,
    /** Sensed inputs at the next decision. */
    val next: DoubleArray,
)

/**
 * The learning brain of one SOFT_CODED animal: its [net], the decisions it remembers, and the reward collected
 * since its last decision. Q-learning: each decision is stored with its reward, and while the animal rests it
 * replays remembered decisions to train the network (docs/sim/ANIMALS.MD).
 */
class Mind(val net: NeuralNet) {
    companion object {
        /** Number of sensed inputs (see [sim.animal.Brain.sense]). */
        const val INPUTS = 13
        val OUTPUTS = Drive.entries.size

        /** Hidden layers of the founders of a species. */
        val FOUNDER_HIDDEN = intArrayOf(12)

        /** Decisions remembered per animal; the oldest are forgotten first. */
        const val MEMORY = 200
        /** Discount on the value of the next decision. */
        const val GAMMA = 0.9
        const val LEARNING_RATE = 0.05
        /** Remembered decisions replayed per tick while resting. */
        const val REPLAYS_PER_TICK = 16
        /** Chance a decision is a random drive instead of the strongest one, so the animal keeps trying new things. */
        const val EXPLORATION = 0.1

        /** Stamina spent per tick for every hidden neuron, so bigger brains must earn their keep. */
        const val NEURON_STAMINA_COST = 0.0003

        // The mutation constants below apply at the default mutation rate; Species.mutationRate scales them.

        /** Chance at birth that a hidden layer is added, and separately that one is removed. */
        const val LAYER_MUTATION_CHANCE = 0.05
        /** Chance at birth that each hidden layer gains or loses up to [MAX_NEURON_CHANGE] neurons. */
        const val NEURON_MUTATION_CHANCE = 0.3
        const val MAX_NEURON_CHANGE = 2
        const val MIN_LAYER_SIZE = 2
        const val MAX_LAYER_SIZE = 64
        const val MAX_HIDDEN_LAYERS = 4
        /** Size of a hidden layer added by mutation. */
        const val NEW_LAYER_SIZE = 4
        /** Largest random change to each inherited weight. */
        const val WEIGHT_MUTATION = 0.05

        /** A founder's mind: [FOUNDER_HIDDEN] layers with random weights. */
        fun founder(rng: Random) = Mind(NeuralNet.random(intArrayOf(INPUTS, *FOUNDER_HIDDEN, OUTPUTS), rng))

        /**
         * A newborn's mind: hidden layers taken from a random parent, each sized as the parents' average where both
         * have that layer, then mutated (layers added/removed, neurons added/removed); weights mixed from both parents.
         * All mutation chances and sizes are the constants above scaled by the species' mutation rate relative to the
         * default ([Species.mutationRate] / [AnimalStats.DEFAULT_MUTATION]), so a rate of 0 copies the parents exactly.
         */
        fun inherit(species: Species, a: Mind, b: Mind, rng: Random): Mind {
            val scale = species.mutationRate / AnimalStats.DEFAULT_MUTATION
            val shapeParent = if (rng.nextBoolean()) a else b
            val ha = a.net.hiddenSizes; val hb = b.net.hiddenSizes
            val hidden = shapeParent.net.hiddenSizes.indices.map { i ->
                if (i < ha.size && i < hb.size) (ha[i] + hb[i] + rng.nextInt(2)) / 2 else shapeParent.net.hiddenSizes[i]
            }.toMutableList()
            for (i in hidden.indices) if (rng.nextDouble() < NEURON_MUTATION_CHANCE * scale) {
                hidden[i] = (hidden[i] + rng.nextInt(-MAX_NEURON_CHANGE, MAX_NEURON_CHANGE + 1)).coerceIn(MIN_LAYER_SIZE, MAX_LAYER_SIZE)
            }
            if (hidden.size < MAX_HIDDEN_LAYERS && rng.nextDouble() < LAYER_MUTATION_CHANCE * scale) hidden.add(NEW_LAYER_SIZE)
            if (hidden.size > 1 && rng.nextDouble() < LAYER_MUTATION_CHANCE * scale) hidden.removeAt(rng.nextInt(hidden.size))
            val sizes = intArrayOf(INPUTS, *hidden.toIntArray(), OUTPUTS)
            return Mind(NeuralNet.inherit(sizes, a.net, b.net, WEIGHT_MUTATION * scale, rng))
        }
    }

    /** Remembered decisions, oldest first. */
    val memory = ArrayDeque<Experience>()

    /** Inputs sensed this tick. */
    var inputs = DoubleArray(INPUTS)

    /** Network outputs (one per [Drive]) for [inputs]. */
    var values = DoubleArray(OUTPUTS)

    /** Inputs and drive of the decision being carried out, or -1 before the first decision. */
    var lastState: DoubleArray? = null
    var lastDrive = -1

    /** Whether a predator was in view last tick; one coming into view triggers a new decision. */
    var sawThreat = false

    /** Reward gathered since the last decision. */
    var pendingReward = 0.0

    /** Status values at the previous reward check, so the change can be rewarded. -1 means not measured yet. */
    var lastHp = -1.0
    var lastNutrition = -1.0
    var lastHydration = -1.0

    /** Stamina spent every tick to run this brain. */
    val staminaCost: Double get() = net.hiddenNeurons * NEURON_STAMINA_COST

    /** Picks the strongest drive in [values], or a random one with chance [EXPLORATION]. */
    fun pickDrive(rng: Random): Drive {
        if (rng.nextDouble() < EXPLORATION) return Drive.entries[rng.nextInt(OUTPUTS)]
        var best = 0
        for (i in 1 until OUTPUTS) if (values[i] > values[best]) best = i
        return Drive.entries[best]
    }

    /** Closes the decision being carried out (if any) with [next] inputs, stores it, and starts tracking [drive]. */
    fun decide(drive: Drive, next: DoubleArray) {
        lastState?.let { remember(Experience(it, lastDrive, pendingReward, next)) }
        lastState = next
        lastDrive = drive.ordinal
        pendingReward = 0.0
    }

    private fun remember(e: Experience) {
        if (memory.size == MEMORY) memory.removeFirst()
        memory.addLast(e)
    }

    /** Replays [REPLAYS_PER_TICK] random remembered decisions through Q-learning. Returns how many were trained. */
    fun train(rng: Random): Int {
        if (memory.isEmpty()) return 0
        repeat(REPLAYS_PER_TICK) {
            val e = memory[rng.nextInt(memory.size)]
            val target = e.reward + GAMMA * net.forward(e.next).max()
            net.train(e.state, e.drive, target, LEARNING_RATE)
        }
        return REPLAYS_PER_TICK
    }
}

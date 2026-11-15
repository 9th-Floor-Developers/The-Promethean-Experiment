package sim.animal

import kotlin.math.cos
import kotlin.math.ln
import kotlin.math.pow
import kotlin.math.sqrt
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
 *
 * Besides its own decisions ([memory]) it remembers decisions it saw same-species animals make ([observed]),
 * which simulates learning from others. Both memories belong to this animal alone: what it observed depends on
 * where it was, so no two animals hold the same data.
 */
class Mind(val net: NeuralNet) {
    companion object {
        /** Number of sensed inputs (see [sim.animal.Brain.sense]). */
        const val INPUTS = 15
        val OUTPUTS = Drive.entries.size

        /** Hidden layers of the founders of a species. */
        val FOUNDER_HIDDEN = intArrayOf(2)

        /** Intelligence of a founder: the connections of a [FOUNDER_HIDDEN] network (see [NeuralNet.connections]). */
        val FOUNDER_INTELLIGENCE: Int get() = NeuralNet.connectionsOf(intArrayOf(INPUTS, *FOUNDER_HIDDEN, OUTPUTS))

        /** Own decisions remembered per animal; the oldest are forgotten first. */
        const val MEMORY = 200
        /** Decisions of others (same species, in view) remembered per animal; the oldest are forgotten first. */
        const val OBSERVED_MEMORY = 100
        /** Share of replays drawn from [observed] decisions (when there are any); the rest come from the animal's own. */
        const val OBSERVED_REPLAY_SHARE = 0.3
        /** Discount on the value of the next decision. */
        const val GAMMA = 0.9
        const val LEARNING_RATE = 0.05
        /** Remembered decisions replayed per tick while resting. */
        const val REPLAYS_PER_TICK = 16
        /**
         * Remembered decisions replayed per tick while awake when the world's awake learning setting is on (it is off
         * by default). Learners chose REST in only about 3% of ticks, so a brain that learns only at rest hardly
         * learns at all: with awake learning a learner population roughly triples and stops dying out on most seeds.
         */
        const val AWAKE_REPLAYS_PER_TICK = 4
        /** Chance a decision is a random drive instead of the strongest one, so the animal keeps trying new things. */
        const val EXPLORATION = 0.1

        /**
         * How fast decision noise falls with intelligence (see [pickDrive]): the noise is scaled by
         * (founder intelligence / intelligence) to this power, so twice the connections leave a quarter of the noise.
         */
        const val DECISION_NOISE_EXPONENT = 2.0

        /** Stamina spent per tick for every hidden neuron, so bigger brains must earn their keep. */
        const val NEURON_STAMINA_COST = 0.0003

        // The mutation constants below apply at the default mutation rate; Species.mutationRate scales them.

        /**
         * Chance at birth that a hidden layer is added, and separately that one is removed. High enough that deeper
         * brains turn up within a run (15% of a one-layer pair's young get a second layer); equal both ways so
         * mutation itself does not push brains deeper, only selection can.
         */
        const val LAYER_MUTATION_CHANCE = 0.15
        /** Chance at birth that each hidden layer gains or loses up to [MAX_NEURON_CHANGE] neurons. */
        const val NEURON_MUTATION_CHANCE = 0.3
        const val MAX_NEURON_CHANGE = 2
        const val MIN_LAYER_SIZE = 2
        const val MAX_LAYER_SIZE = 64
        /** Hidden layers a brain can have; a newborn's count is its shape parent's, plus or minus one by mutation. */
        const val MIN_HIDDEN_LAYERS = 1
        const val MAX_HIDDEN_LAYERS = 5
        /** Size of a hidden layer added by mutation. */
        const val NEW_LAYER_SIZE = 4
        /** Largest random change to each inherited weight. */
        const val WEIGHT_MUTATION = 0.05
        /**
         * Share of a newborn's starting weights that comes from its parents; the rest is fresh random, so behaviour
         * is mainly learned in each life rather than passed on.
         */
        const val PARENT_WEIGHT_SHARE = 0.25

        /** A founder's mind: [FOUNDER_HIDDEN] layers with random weights. */
        fun founder(rng: Random) = Mind(NeuralNet.random(intArrayOf(INPUTS, *FOUNDER_HIDDEN, OUTPUTS), rng))

        /**
         * A newborn's mind: hidden layers taken from a random parent, each sized as the parents' average where both
         * have that layer, then mutated (layers added/removed, neurons added/removed). Each weight is only
         * [PARENT_WEIGHT_SHARE] the parents' mix, the rest fresh random: the shape is inherited, the behaviour mostly learned.
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
            if (hidden.size > MIN_HIDDEN_LAYERS && rng.nextDouble() < LAYER_MUTATION_CHANCE * scale) hidden.removeAt(rng.nextInt(hidden.size))
            val sizes = intArrayOf(INPUTS, *hidden.toIntArray(), OUTPUTS)
            return Mind(NeuralNet.inherit(sizes, a.net, b.net, PARENT_WEIGHT_SHARE, WEIGHT_MUTATION * scale, rng))
        }
    }

    /** This animal's own remembered decisions, oldest first. */
    val memory = ArrayDeque<Experience>()

    /** Decisions this animal saw others of its species make, oldest first. */
    val observed = ArrayDeque<Experience>()

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

    /** Stamina spent every tick to run this brain: per hidden neuron, not per connection (intelligence). */
    val staminaCost: Double get() = net.hiddenNeurons * NEURON_STAMINA_COST

    /**
     * Picks the strongest drive in [values], or a random one with chance [EXPLORATION].
     *
     * [brainNoise] is the world's decision noise (a Settings value, 0 = off): before the strongest drive is picked,
     * every drive value is blurred by random noise of [brainNoise] standard deviations of the values themselves,
     * scaled by (founder intelligence / this brain's intelligence)^[DECISION_NOISE_EXPONENT]. A founder-sized brain
     * at noise 5 therefore chooses almost blindly, while one with twice the connections has a quarter of the noise:
     * a bigger brain weighs its options more reliably, which is what intelligence buys here. It is still paid for
     * with [NEURON_STAMINA_COST] per hidden neuron, so past some size the extra precision no longer earns its keep.
     */
    fun pickDrive(rng: Random, brainNoise: Double = 0.0): Drive {
        if (rng.nextDouble() < EXPLORATION) return Drive.entries[rng.nextInt(OUTPUTS)]
        val noise = if (brainNoise > 0) decisionNoise(brainNoise) else 0.0
        var best = 0
        var bestValue = Double.NEGATIVE_INFINITY
        for (i in 0 until OUTPUTS) {
            val x = values[i] + if (noise > 0) noise * gaussian(rng) else 0.0
            if (x > bestValue) { bestValue = x; best = i }
        }
        return Drive.entries[best]
    }

    /** Standard deviation of the noise [pickDrive] adds to each drive value at world decision noise [brainNoise]. */
    fun decisionNoise(brainNoise: Double): Double {
        val mean = values.average()
        val spread = sqrt(values.sumOf { (it - mean) * (it - mean) } / values.size)
        val relative = FOUNDER_INTELLIGENCE.toDouble() / net.connections
        return brainNoise * spread * relative.pow(DECISION_NOISE_EXPONENT)
    }

    /** A standard normal random number (Box-Muller). */
    private fun gaussian(rng: Random): Double {
        val u = rng.nextDouble().coerceAtLeast(1e-12)
        return sqrt(-2 * ln(u)) * cos(2 * kotlin.math.PI * rng.nextDouble())
    }

    /**
     * Closes the decision being carried out (if any) with [next] inputs, stores it, and starts tracking [drive].
     * Returns the closed decision (so onlookers can [observe] it), or null if this was the first decision.
     */
    fun decide(drive: Drive, next: DoubleArray): Experience? {
        val closed = lastState?.let { Experience(it, lastDrive, pendingReward, next) }
        closed?.let { remember(memory, MEMORY, it) }
        lastState = next
        lastDrive = drive.ordinal
        pendingReward = 0.0
        return closed
    }

    /** Remembers a decision seen being made by another animal of the same species. */
    fun observe(e: Experience) = remember(observed, OBSERVED_MEMORY, e)

    private fun remember(into: ArrayDeque<Experience>, capacity: Int, e: Experience) {
        if (into.size == capacity) into.removeFirst()
        into.addLast(e)
    }

    /**
     * Replays [replays] random remembered decisions through Q-learning ([REPLAYS_PER_TICK] while resting,
     * [AWAKE_REPLAYS_PER_TICK] otherwise). Returns how many were trained.
     */
    fun train(rng: Random, replays: Int = REPLAYS_PER_TICK): Int {
        if (memory.isEmpty() && observed.isEmpty()) return 0
        repeat(replays) {
            val fromObserved = observed.isNotEmpty() && (memory.isEmpty() || rng.nextDouble() < OBSERVED_REPLAY_SHARE)
            val pool = if (fromObserved) observed else memory
            val e = pool[rng.nextInt(pool.size)]
            val target = e.reward + GAMMA * net.forward(e.next).max()
            net.train(e.state, e.drive, target, LEARNING_RATE)
        }
        return replays
    }
}

package sim.animal

import kotlin.math.tanh
import kotlin.random.Random

/**
 * A small fully connected network (docs/sim/ANIMALS.MD SOFT CODED AI): inputs → tanh hidden layers → linear outputs.
 * Used as a Q-function: each output is the expected value of one [Drive].
 *
 * Layer `l` maps `sizes[l]` neurons to `sizes[l + 1]`; its weights are stored row-major in [weights] (`out * in`)
 * with one bias per output neuron in [biases].
 */
class NeuralNet private constructor(
    /** Neuron count of every layer, input and output included. */
    val sizes: IntArray,
    private val weights: Array<DoubleArray>,
    private val biases: Array<DoubleArray>,
) {
    /** Hidden layer sizes (everything between input and output). */
    val hiddenSizes: List<Int> get() = sizes.slice(1 until sizes.size - 1)

    /** Total hidden neurons; drives the brain's stamina cost. */
    val hiddenNeurons: Int get() = hiddenSizes.sum()

    /** A copy of the weights of layer [l] (row-major, `sizes[l + 1]` rows of `sizes[l]`), e.g. for drawing the network. */
    fun layerWeights(l: Int): DoubleArray = weights[l].copyOf()

    /** Activations of every layer from the last [forward] call, reused by [train]. */
    private val acts = Array(sizes.size) { DoubleArray(sizes[it]) }

    /** Runs the network on [input] and returns a fresh copy of the outputs. */
    fun forward(input: DoubleArray): DoubleArray {
        input.copyInto(acts[0])
        for (l in 0 until sizes.size - 1) {
            val inN = sizes[l]; val outN = sizes[l + 1]
            val w = weights[l]; val b = biases[l]; val a = acts[l]; val o = acts[l + 1]
            val hidden = l + 1 < sizes.size - 1
            for (j in 0 until outN) {
                var sum = b[j]
                val row = j * inN
                for (i in 0 until inN) sum += w[row + i] * a[i]
                o[j] = if (hidden) tanh(sum) else sum
            }
        }
        return acts.last().copyOf()
    }

    /**
     * One step of gradient descent pulling output [output] toward [target] for [input] (squared error on that
     * output only, as in Q-learning where only the taken action's value is corrected). Returns the error before the step.
     */
    fun train(input: DoubleArray, output: Int, target: Double, learningRate: Double): Double {
        val predicted = forward(input)[output]
        val error = (predicted - target).coerceIn(-MAX_ERROR, MAX_ERROR)
        var delta = DoubleArray(sizes.last()).also { it[output] = error }
        for (l in sizes.size - 2 downTo 0) {
            val inN = sizes[l]; val outN = sizes[l + 1]
            val w = weights[l]; val b = biases[l]; val a = acts[l]
            val prev = DoubleArray(inN)
            for (j in 0 until outN) {
                val d = delta[j]
                if (d == 0.0) continue
                val row = j * inN
                for (i in 0 until inN) {
                    prev[i] += w[row + i] * d
                    w[row + i] -= learningRate * d * a[i]
                }
                b[j] -= learningRate * d
            }
            // Back through tanh of the layer below (inputs have no activation).
            if (l > 0) for (i in 0 until inN) prev[i] *= 1 - a[i] * a[i]
            delta = prev
        }
        return error
    }

    companion object {
        /** Errors are clipped to this size so one surprising reward cannot wreck the weights. */
        const val MAX_ERROR = 1.0

        /** A network of the given [sizes] with small random weights. */
        fun random(sizes: IntArray, rng: Random): NeuralNet {
            require(sizes.size >= 2 && sizes.all { it > 0 }) { "bad layer sizes ${sizes.toList()}" }
            val w = Array(sizes.size - 1) { l -> DoubleArray(sizes[l] * sizes[l + 1]) { initWeight(sizes[l], rng) } }
            val b = Array(sizes.size - 1) { l -> DoubleArray(sizes[l + 1]) }
            return NeuralNet(sizes.copyOf(), w, b)
        }

        /** Random starting weight scaled by the layer's fan-in. */
        private fun initWeight(fanIn: Int, rng: Random) = (rng.nextDouble() * 2 - 1) / kotlin.math.sqrt(fanIn.toDouble())

        /**
         * A child network of shape [sizes] built from parents [a] and [b]. The parents' weight at the same layer and
         * position is their average (or the one parent that has it, or a fresh random weight if neither does); the
         * child's weight is [parentShare] of that plus the rest of a fresh random weight, plus a random mutation of up
         * to [mutation] either way. Biases are mixed the same way, with 0 as the fresh value.
         */
        fun inherit(sizes: IntArray, a: NeuralNet, b: NeuralNet, parentShare: Double, mutation: Double, rng: Random): NeuralNet {
            val child = random(sizes, rng)
            for (l in 0 until sizes.size - 1) {
                val inN = sizes[l]; val outN = sizes[l + 1]
                val la = a.matchingLayer(l, sizes.size); val lb = b.matchingLayer(l, sizes.size)
                for (j in 0 until outN) {
                    for (i in 0 until inN) {
                        val wa = a.weightAt(la, j, i); val wb = b.weightAt(lb, j, i)
                        val fresh = child.weights[l][j * inN + i]
                        val parents = when {
                            wa != null && wb != null -> (wa + wb) / 2
                            else -> wa ?: wb ?: fresh
                        }
                        child.weights[l][j * inN + i] = parentShare * parents + (1 - parentShare) * fresh + (rng.nextDouble() * 2 - 1) * mutation
                    }
                    val ba = a.biasAt(la, j); val bb = b.biasAt(lb, j)
                    val parents = if (ba != null && bb != null) (ba + bb) / 2 else ba ?: bb ?: 0.0
                    child.biases[l][j] = parentShare * parents + (rng.nextDouble() * 2 - 1) * mutation
                }
            }
            return child
        }
    }

    /**
     * This network's layer matching layer [l] of a network with [otherLayers] layers: output layers match output
     * layers, hidden layers match by position; -1 when there is no match (the other network has more hidden layers).
     */
    private fun matchingLayer(l: Int, otherLayers: Int): Int = when {
        l == otherLayers - 2 -> sizes.size - 2
        l < sizes.size - 2 -> l
        else -> -1
    }

    /** Weight from neuron [i] of layer [l] to neuron [j] of layer l+1, or null if this network has no such weight. */
    private fun weightAt(l: Int, j: Int, i: Int): Double? {
        if (l < 0 || l >= sizes.size - 1 || j >= sizes[l + 1] || i >= sizes[l]) return null
        return weights[l][j * sizes[l] + i]
    }

    /** Bias of neuron [j] of layer l+1, or null if this network has no such neuron. */
    private fun biasAt(l: Int, j: Int): Double? = if (l >= 0 && l < sizes.size - 1 && j < sizes[l + 1]) biases[l][j] else null
}

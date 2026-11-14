package terrain

import kotlin.math.floor
import kotlin.random.Random

/** Basic seeded 2D Perlin noise (no dependencies, so it transpiles to Wasm). */
class Perlin(seed: Long) {
    private val perm = IntArray(512)

    init {
        val p = (0 until 256).toMutableList().also { it.shuffle(Random(seed)) }
        for (i in 0 until 512) perm[i] = p[i and 255]
    }

    private fun fade(t: Double) = t * t * t * (t * (t * 6 - 15) + 10)
    private fun lerp(a: Double, b: Double, t: Double) = a + t * (b - a)

    private fun grad(hash: Int, x: Double, y: Double): Double = when (hash and 7) {
        0 -> x + y
        1 -> -x + y
        2 -> x - y
        3 -> -x - y
        4 -> x
        5 -> -x
        6 -> y
        else -> -y
    }

    /** Single-octave noise, roughly in -1..1. */
    fun noise(x: Double, y: Double): Double {
        val xi = floor(x).toInt() and 255
        val yi = floor(y).toInt() and 255
        val xf = x - floor(x)
        val yf = y - floor(y)
        val u = fade(xf)
        val v = fade(yf)
        val aa = perm[perm[xi] + yi]
        val ab = perm[perm[xi] + yi + 1]
        val ba = perm[perm[xi + 1] + yi]
        val bb = perm[perm[xi + 1] + yi + 1]
        return lerp(
            lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u),
            lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u),
            v,
        )
    }

    /** Multi-octave noise, normalized to 0..1. */
    fun octave(x: Double, y: Double, octaves: Int = 4, persistence: Double = 0.5): Double {
        var total = 0.0
        var amp = 1.0
        var freq = 1.0
        var max = 0.0
        repeat(octaves) {
            total += noise(x * freq, y * freq) * amp
            max += amp
            amp *= persistence
            freq *= 2
        }
        // 2D gradient noise spans about ±0.707, so scale to -1..1 and then to 0..1.
        return ((total / max) / 0.707 * 0.5 + 0.5).coerceIn(0.0, 1.0)
    }
}

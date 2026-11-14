package sim.world

import kotlin.math.round

/** Formats [v] with one decimal (common-Kotlin replacement for String.format). */
internal fun fmt1(v: Double): String {
    val r = round(v * 10).toInt()
    return "${r / 10}.${kotlin.math.abs(r % 10)}"
}

/** Prints a major simulation event; always shown, whatever the verbosity. */
fun simEvent(message: String) = println(message)

/** Prints the process/phase/step banners and details of a tick, only when [verbose]. */
internal class TickLog(val verbose: Boolean) {
    fun process(name: String) { if (verbose) println("\n########## PROCESS: $name ##########") }
    fun phase(name: String) { if (verbose) println("\n========== PHASE: $name ==========") }
    fun step(name: String) { if (verbose) println("---------- STEP: $name ----------") }
    /** Prints [message] only when verbose; the lambda is not evaluated otherwise, so no string is built. */
    inline fun info(message: () -> String) { if (verbose) println(message()) }
}

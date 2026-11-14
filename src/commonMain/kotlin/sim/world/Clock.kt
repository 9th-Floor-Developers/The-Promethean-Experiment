package sim.world

/** One in-game day lasts this many ticks. */
const val TICKS_PER_DAY = 1200

/** Part of the day-night cycle. */
enum class TimePhase { NIGHT, DAWN, DAY, DUSK }

/**
 * The world clock and day-night cycle. Time of day runs 0.0 (midnight) to 1.0; the simulation
 * begins at [startTimeOfDay] (default 0.25 = 06:00, dawn).
 */
class Clock(startTimeOfDay: Double = 0.25) {
    private val offset = (startTimeOfDay * TICKS_PER_DAY).toLong()

    /** Number of ticks simulated so far. */
    var tick = 0L
        private set

    /** Current day, starting at 1. */
    val day: Int get() = ((tick + offset) / TICKS_PER_DAY).toInt() + 1

    /** Current time of day in 0.0 until 1.0 (0.0 = midnight, 0.5 = noon). */
    val timeOfDay: Double get() = ((tick + offset) % TICKS_PER_DAY).toDouble() / TICKS_PER_DAY

    /** Current phase of the day. */
    val phase: TimePhase get() = phaseAt(timeOfDay)

    /** Advances time by one tick. */
    fun advance() { tick++ }

    /** Human readable time, e.g. "Day 2 06:30". */
    fun format(): String {
        val minutes = (timeOfDay * 24 * 60).toInt()
        return "Day $day ${(minutes / 60).toString().padStart(2, '0')}:${(minutes % 60).toString().padStart(2, '0')}"
    }

    companion object {
        /** Night is 0.80-0.20 of the day, dawn 0.20-0.30, day 0.30-0.70, dusk 0.70-0.80. */
        fun phaseAt(t: Double): TimePhase = when {
            t < 0.20 || t >= 0.80 -> TimePhase.NIGHT
            t < 0.30 -> TimePhase.DAWN
            t < 0.70 -> TimePhase.DAY
            else -> TimePhase.DUSK
        }
    }
}

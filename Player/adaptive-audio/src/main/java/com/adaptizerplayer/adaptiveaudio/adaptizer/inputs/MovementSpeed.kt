package com.adaptizerplayer.adaptiveaudio.adaptizer.inputs

import kotlin.math.roundToInt

/** The five activities for which movement speed has a defined scale. */
enum class MovementActivity {
    STILL,
    WALKING,
    RUNNING,
    CYCLING,
    IN_VEHICLE
}

/**
 * Maps a speed in metres per second to an input reading in 0..9 relative to
 * what the listener is doing. Each moving activity owns its full range;
 * [MovementActivity.STILL] is unavailable rather than a reading of zero.
 */
fun movementSpeedReading(speedMetresPerSecond: Double, activity: MovementActivity): Int? {
    if (activity == MovementActivity.STILL) return null

    val (minimum, maximum) = when (activity) {
        MovementActivity.WALKING -> 0.3 to 2.0
        MovementActivity.RUNNING -> 2.0 to 5.5
        MovementActivity.CYCLING -> 2.0 to 11.0
        MovementActivity.IN_VEHICLE -> 3.0 to 35.0
        MovementActivity.STILL -> error("Still was handled above")
    }

    if (!speedMetresPerSecond.isFinite()) return 0
    val fraction = ((speedMetresPerSecond - minimum) / (maximum - minimum)).coerceIn(0.0, 1.0)
    // The tiny epsilon keeps a mathematically exact midpoint such as walking's
    // 1.15 m/s from becoming 4 because of binary floating-point drift below
    // 4.5. It is many orders of magnitude below location-speed precision.
    return (fraction * 9.0 + 1e-9).roundToInt()
}

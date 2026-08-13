package com.adaptizerplayer.adaptiveaudio.adaptizer

import kotlin.math.round

/**
 * The value a single dimension is **held** at while its input is unavailable:
 * the middle of the range, not the bottom, so an unmeasurable dimension plays
 * a deliberate-sounding version of the song rather than its quietest variant
 * for the whole duration.
 */
private const val HELD = 5

/**
 * A snapshot of every input's reading at one instant. `null` means that input
 * was unavailable when the snapshot was taken - inputs never fabricate a
 * reading, so a non-null value here is always a real measurement.
 */
data class InputReadings(
    val volume: Int? = null,
    val movementSpeed: Int? = null,
    val heartRate: Int? = null
) {

    /**
     * The value of [dimension] given these readings - the one resolver, and
     * the only place the single-versus-aggregate distinction is drawn.
     *
     * A single dimension is its input's reading, or [HELD] while that input is
     * unavailable. The aggregate drops its unavailable members and
     * renormalizes the rest, so a missing sensor never drags a song quieter
     * than its author intended.
     *
     * An unrecognised name resolves as the aggregate rather than rejecting the
     * song, so a dimension published after this build shipped still plays and
     * still adapts - see
     * `docs/adr/0001-songs-declare-their-adaptation-dimension-by-name.md`.
     */
    fun resolve(dimension: String): Int = when (dimension) {
        Dimensions.VOLUME -> volume ?: HELD
        Dimensions.MOVEMENT_SPEED -> movementSpeed ?: HELD
        Dimensions.HEART_RATE -> heartRate ?: HELD
        else -> aggregate()
    }

    private fun aggregate(): Int {
        // The aggregate's weights, and the only place they are written down.
        // Changing one is a one-line change here. They are renormalized over
        // whatever is available, so they only need to sum to 1.0 when every
        // member is.
        val members = listOf(
            volume to 0.5,
            movementSpeed to 0.3,
            heartRate to 0.2
        )

        var weightedSum = 0.0
        var availableWeight = 0.0
        for ((reading, weight) in members) {
            if (reading == null) continue
            weightedSum += weight * reading
            availableWeight += weight
        }

        // Dividing by the weight actually present is the renormalization: the
        // available members' weights are scaled to sum to 1.0, which is the
        // only reason the result lands back in 0..9. With one member left that
        // makes the aggregate exactly that member's value.
        if (availableWeight == 0.0) {
            // Unreachable while device volume is always available, so the
            // aggregate never really has to handle an empty set - but held at
            // 5 like a single dimension rather than dividing by zero.
            return HELD
        }
        return round(weightedSum / availableWeight).toInt()
    }
}

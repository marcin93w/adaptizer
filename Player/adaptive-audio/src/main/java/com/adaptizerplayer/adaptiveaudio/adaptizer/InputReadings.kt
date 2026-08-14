package com.adaptizerplayer.adaptiveaudio.adaptizer

/**
 * A snapshot of every input's reading at one instant. `null` means that input
 * was unavailable when the snapshot was taken - inputs never fabricate a
 * reading, so a non-null value here is always a real measurement.
 *
 * This is only the readings. Turning them into a dimension's value is a
 * [Dimension]'s job, selected by name in [Dimensions].
 */
data class InputReadings(
    val volume: Int? = null,
    val movementSpeed: Int? = null,
    val heartRate: Int? = null
)

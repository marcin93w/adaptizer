package com.adaptizerplayer.adaptiveaudio.adaptizer

/**
 * Owns the device's inputs and answers "what is the value of this dimension,
 * right now" for any of the four - it does not decide which dimension matters.
 * That is the current song's business, and songs are not this library's
 * concern.
 *
 * An input that is absent here is indistinguishable from one reporting itself
 * unavailable: its dimension is held at 5 and it contributes nothing to the
 * aggregate.
 *
 * Parameters are ordered as [InputReadings] declares them, so a positional
 * call cannot mean one thing here and another there.
 */
class Adaptizer(
    private val volumeInput: AdaptizerInput,
    private val movementSpeedInput: AdaptizerInput? = null,
    private val heartRateInput: AdaptizerInput? = null
) {

    /** Every input's reading as of now; `null` where an input is unavailable. */
    fun currentReadings(): InputReadings = InputReadings(
        volume = readingOf(volumeInput),
        movementSpeed = readingOf(movementSpeedInput),
        heartRate = readingOf(heartRateInput)
    )

    /** The value of [dimension] against the readings current at this instant. */
    fun resolve(dimension: String): Int = Dimensions.of(dimension).resolve(currentReadings())

    /**
     * Registers [onChange] to receive a fresh snapshot whenever any input
     * changes - a new measurement or an appearing/disappearing signal alike,
     * since an input reports both the same way.
     */
    fun onReadingsChange(onChange: (InputReadings) -> Unit) {
        listOfNotNull(volumeInput, movementSpeedInput, heartRateInput).forEach { input ->
            input.registerChangeListener { onChange(currentReadings()) }
        }
    }

    private fun readingOf(input: AdaptizerInput?): Int? =
        if (input != null && input.isAvailable) input.getCurrentValue() else null
}

package com.adaptizerplayer.adaptiveaudio.adaptizer

/**
 * A device-side source of a signal about the listener's context, normalized to
 * 0..9.
 */
interface AdaptizerInput {

    /**
     * Whether this input can be read right now. Absent hardware, a denied
     * permission and an unbonded device are all the same state - there is no
     * distinct handling for any of them.
     *
     * A change here must fire the registered change listener exactly as a
     * value change does, so that a held dimension unpins and the aggregate
     * re-weights live, mid-song, without a restart.
     */
    val isAvailable: Boolean

    /**
     * This input's current reading, 0..9. Only meaningful while
     * [isAvailable]; callers must not read it otherwise.
     *
     * An input never fabricates a reading: it reports what it measured or it
     * reports itself unavailable. Inventing a stand-in value is a
     * [dimension's][Dimension.resolve] job, not an input's, so a value in
     * the aggregate is always a real measurement.
     */
    fun getCurrentValue(): Int

    fun registerChangeListener(listener: () -> Unit)
    fun initialize()
    fun release()
}

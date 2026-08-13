package com.adaptizerplayer.adaptiveaudio.adaptizer

/**
 * The four dimension names a song can be authored against.
 *
 * These strings are byte-identical to what InstrumentUI writes into the `.adz`
 * project, what the catalog row holds, and what the native-bridge payload
 * carries. They are never re-cased, never mapped, never parsed - only
 * compared. See `docs/adr/0001-songs-declare-their-adaptation-dimension-by-name.md`.
 *
 * The set is flat and closed. Nothing here records whether a dimension is a
 * single input's reading or an aggregate of several: that distinction exists
 * only inside [InputReadings.resolve].
 */
object Dimensions {
    const val VOLUME = "volume"
    const val HEART_RATE = "heartRate"
    const val MOVEMENT_SPEED = "movementSpeed"
    const val INTENSITY = "intensity"
}

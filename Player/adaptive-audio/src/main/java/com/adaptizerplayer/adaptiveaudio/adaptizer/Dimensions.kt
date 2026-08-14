package com.adaptizerplayer.adaptiveaudio.adaptizer

/**
 * The four dimension names a song can be authored against, and the resolver
 * each one selects.
 *
 * The name strings are byte-identical to what Instrument writes into the `.adz`
 * project, what the catalog row holds, and what the native-bridge payload
 * carries. They are never re-cased, never mapped, never parsed - only compared.
 * See `docs/adr/0001-songs-declare-their-adaptation-dimension-by-name.md`.
 *
 * The set is flat and closed. Which names are single dimensions and which is
 * the aggregate is recorded here, in [byName], as [Dimension] values - the kind
 * a name resolves to is a type ([SingleDimension] / [AggregateDimension]), not a
 * branch buried elsewhere.
 */
object Dimensions {
    const val VOLUME = "volume"
    const val HEART_RATE = "heartRate"
    const val MOVEMENT_SPEED = "movementSpeed"
    const val INTENSITY = "intensity"

    // The aggregate's weights live here, the only place they are written down.
    // Changing one is a one-line change; a new aggregate dimension is one more
    // entry in this map.
    private val byName: Map<String, Dimension> = mapOf(
        VOLUME to SingleDimension { it.volume },
        HEART_RATE to SingleDimension { it.heartRate },
        MOVEMENT_SPEED to SingleDimension { it.movementSpeed },
        INTENSITY to AggregateDimension(
            member(0.5) { it.volume },
            member(0.3) { it.movementSpeed },
            member(0.2) { it.heartRate },
        ),
    )

    /**
     * The resolver for [name]. An unrecognised name resolves as the aggregate
     * (intensity) rather than rejecting the song, so a dimension published
     * after this build shipped still plays and still adapts - the catalog
     * string is narrowed and the surprise logged one layer up, in
     * `mobile/src/domain/dimension.ts`, where the song is known.
     */
    fun of(name: String): Dimension = byName[name] ?: byName.getValue(INTENSITY)
}

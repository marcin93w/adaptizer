package com.adaptizerplayer.adaptiveaudio.player

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class AdaptizerTrackSelectorTest {

    @Test
    fun `constructor rejects an initial index outside the ten-track contract`() {
        for (index in listOf(-1, 10, 999)) {
            val error = assertThrows(AdaptiveAudioUnsupportedTrackException::class.java) {
                AdaptizerTrackSelector(index)
            }

            assertEquals(index, error.requestedIndex)
            assertEquals(10, error.availableTrackCount)
        }
    }

    @Test
    fun `changeTrack rejects an out-of-range index before selection exists`() {
        val selector = AdaptizerTrackSelector(0)

        val error = assertThrows(AdaptiveAudioUnsupportedTrackException::class.java) {
            selector.changeTrack(10)
        }

        assertEquals(10, error.requestedIndex)
        assertEquals(10, error.availableTrackCount)
    }
}

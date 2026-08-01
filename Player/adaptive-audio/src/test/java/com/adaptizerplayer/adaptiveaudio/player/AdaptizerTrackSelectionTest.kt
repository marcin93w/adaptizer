@file:OptIn(UnstableApi::class)

package com.adaptizerplayer.adaptiveaudio.player

import androidx.media3.common.C
import androidx.media3.common.Format
import androidx.media3.common.MimeTypes
import androidx.media3.common.TrackGroup
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.source.chunk.MediaChunk
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/**
 * Focused JVM test for [AdaptizerTrackSelection.evaluateQueueSize]'s one-shot queue-invalidation
 * behavior (docs/migration/M00-baseline.md section 4, B04 requirement 4): after
 * [AdaptizerTrackSelection.setSelectedTrack] (called from [AdaptizerTrackSelector.changeTrack]),
 * the very next [AdaptizerTrackSelection.evaluateQueueSize] call must return 0 exactly once, then
 * fall back to normal (`super`/[androidx.media3.exoplayer.trackselection.BaseTrackSelection])
 * behavior until the next track change. Pure JVM/Robolectric-free: verified by disassembling
 * Media3 1.5.1 that `BaseTrackSelection.evaluateQueueSize`'s non-clearQueue path is exactly
 * `return queue.size();`, so the fake queues below only need a correct `size()`, never a real
 * [MediaChunk] instance.
 *
 * Runs under Robolectric (like the rest of this module's JVM tests, e.g. VolumeInputTest) rather
 * than as a bare JUnit test: constructing a real [TrackGroup]/[Format] touches
 * `android.text.TextUtils.isEmpty` internally (via `MimeTypes.getTrackType`), which is unstubbed
 * on the plain JVM and throws without Robolectric's shadow.
 */
@RunWith(RobolectricTestRunner::class)
class AdaptizerTrackSelectionTest {

    private fun testGroup(count: Int): TrackGroup {
        val formats = Array(count) { i ->
            Format.Builder()
                .setId(i.toString())
                .setSampleMimeType(MimeTypes.AUDIO_OPUS)
                .setSampleRate(48000)
                .setChannelCount(2)
                .build()
        }
        return TrackGroup(*formats)
    }

    private fun queueOfSize(n: Int): List<MediaChunk> = object : AbstractList<MediaChunk>() {
        override val size: Int = n
        override fun get(index: Int): MediaChunk =
            throw UnsupportedOperationException(
                "evaluateQueueSize's non-clearQueue path only calls List.size(), never get()"
            )
    }

    @Test
    fun `evaluateQueueSize delegates to queue size when no track change is pending`() {
        val selection = AdaptizerTrackSelection(testGroup(3), intArrayOf(0, 1, 2), 0)

        assertEquals(5, selection.evaluateQueueSize(0L, queueOfSize(5)))
        assertEquals(5, selection.evaluateQueueSize(0L, queueOfSize(5)))
    }

    @Test
    fun `evaluateQueueSize returns 0 exactly once after setSelectedTrack, then resumes normal behavior`() {
        val selection = AdaptizerTrackSelection(testGroup(3), intArrayOf(0, 1, 2), 0)

        // Baseline: normal behavior before any track change.
        assertEquals(4, selection.evaluateQueueSize(0L, queueOfSize(4)))

        selection.setSelectedTrack(1)

        // Exactly once: the first call after setSelectedTrack must clear the queue (return 0),
        // regardless of the queue's real size.
        assertEquals(0, selection.evaluateQueueSize(0L, queueOfSize(7)))

        // Every call after that resumes delegating to the real queue size, until the next change.
        assertEquals(7, selection.evaluateQueueSize(0L, queueOfSize(7)))
        assertEquals(2, selection.evaluateQueueSize(0L, queueOfSize(2)))
    }

    @Test
    fun `each setSelectedTrack call re-arms the one-shot queue clear`() {
        val selection = AdaptizerTrackSelection(testGroup(3), intArrayOf(0, 1, 2), 0)

        selection.setSelectedTrack(1)
        assertEquals(0, selection.evaluateQueueSize(0L, queueOfSize(3)))
        assertEquals(3, selection.evaluateQueueSize(0L, queueOfSize(3)))

        selection.setSelectedTrack(2)
        assertEquals(0, selection.evaluateQueueSize(0L, queueOfSize(9)))
        assertEquals(9, selection.evaluateQueueSize(0L, queueOfSize(9)))
    }

    @Test
    fun `getSelectedIndex reflects the requested track for in-range indices`() {
        val selection = AdaptizerTrackSelection(testGroup(3), intArrayOf(0, 1, 2), 0)
        assertEquals(0, selection.getSelectedIndex())

        selection.setSelectedTrack(2)
        assertEquals(2, selection.getSelectedIndex())
    }

    @Test
    fun `getSelectedIndex returns INDEX_UNSET for a track index outside the fixed tracks array`() {
        // Same root cause exercised end-to-end by
        // AdaptiveAudioEngineInstrumentedTest#changeTrack_outOfRangeIndex*_doesNotCrashProcess:
        // indexOf(int) itself never throws, it just cannot find the value and returns -1.
        val selection = AdaptizerTrackSelection(testGroup(3), intArrayOf(0, 1, 2), 0)

        selection.setSelectedTrack(5)

        assertEquals(C.INDEX_UNSET, selection.getSelectedIndex())
    }
}

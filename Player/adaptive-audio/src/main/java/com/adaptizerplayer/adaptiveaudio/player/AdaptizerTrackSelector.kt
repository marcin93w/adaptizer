package com.adaptizerplayer.adaptiveaudio.player

import androidx.media3.common.C
import androidx.media3.common.Timeline
import androidx.media3.common.util.NullableType
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.RendererConfiguration
import androidx.media3.exoplayer.source.MediaSource
import androidx.media3.exoplayer.trackselection.ExoTrackSelection
import androidx.media3.exoplayer.trackselection.MappingTrackSelector

class AdaptiveAudioUnsupportedTrackException(
    val requestedIndex: Int,
    val availableTrackCount: Int
) : IllegalArgumentException(
    "Track index $requestedIndex is outside 0..${availableTrackCount - 1}"
)

class AdaptiveAudioManifestException(
    val expectedTrackCount: Int,
    val actualTrackCount: Int
) : IllegalStateException(
    "Expected $expectedTrackCount audio representations, found $actualTrackCount"
)

@UnstableApi
class AdaptizerTrackSelector(private var trackIndex: Int) : MappingTrackSelector() {

    companion object {
        const val EXPECTED_TRACK_COUNT = 10
    }

    private var trackSelection: AdaptizerTrackSelection? = null
    private var detectedTrackCount: Int? = null

    val requestedTrackIndex: Int
        get() = trackIndex

    val availableTrackCount: Int?
        get() = detectedTrackCount

    init {
        validateTrackIndex(trackIndex)
    }

    override fun selectTracks(
        mappedTrackInfo: MappedTrackInfo,
        rendererFormatSupports: Array<out Array<out IntArray>>,
        rendererMixedMimeTypeAdaptationSupport: IntArray,
        mediaPeriodId: MediaSource.MediaPeriodId,
        timeline: Timeline
    ): android.util.Pair<Array<out @NullableType RendererConfiguration?>, Array<out @NullableType ExoTrackSelection?>> {
        val rendererConfiguration = arrayOfNulls<RendererConfiguration>(mappedTrackInfo.rendererCount)
        val trackSelections = arrayOfNulls<ExoTrackSelection>(mappedTrackInfo.rendererCount)

        for (i in 0 until mappedTrackInfo.rendererCount) {
            if (mappedTrackInfo.getRendererType(i) == C.TRACK_TYPE_AUDIO) {
                val trackGroupArray = mappedTrackInfo.getTrackGroups(i)
                if (trackGroupArray.length > 0) {
                    val group = trackGroupArray.get(0)
                    detectedTrackCount = group.length
                    if (group.length != EXPECTED_TRACK_COUNT) {
                        throw AdaptiveAudioManifestException(EXPECTED_TRACK_COUNT, group.length)
                    }
                    trackSelection = AdaptizerTrackSelection(
                        group,
                        IntArray(EXPECTED_TRACK_COUNT) { it },
                        trackIndex
                    )
                    trackSelections[i] = trackSelection
                    rendererConfiguration[i] = RendererConfiguration.DEFAULT
                }
            }
        }

        return android.util.Pair(rendererConfiguration, trackSelections)
    }

    fun changeTrack(trackIndex: Int) {
        validateTrackIndex(trackIndex)
        if (this.trackIndex != trackIndex) {
            this.trackIndex = trackIndex
            trackSelection?.setSelectedTrack(trackIndex)
        }
    }

    /** Read-only test seam for asserting the selected representation after Media3 preparation. */
    fun currentSelectedIndex(): Int? = trackSelection?.getSelectedIndex()

    private fun validateTrackIndex(index: Int) {
        if (index !in 0 until EXPECTED_TRACK_COUNT) {
            throw AdaptiveAudioUnsupportedTrackException(index, EXPECTED_TRACK_COUNT)
        }
    }
}

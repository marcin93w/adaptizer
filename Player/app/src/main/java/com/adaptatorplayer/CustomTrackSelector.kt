package com.adaptatorplayer

import androidx.media3.common.C
import androidx.media3.common.Timeline
import androidx.media3.common.util.NullableType
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.RendererConfiguration
import androidx.media3.exoplayer.source.MediaSource
import androidx.media3.exoplayer.trackselection.ExoTrackSelection
import androidx.media3.exoplayer.trackselection.FixedTrackSelection
import androidx.media3.exoplayer.trackselection.MappingTrackSelector

@UnstableApi
class CustomTrackSelector() : MappingTrackSelector() {

    private var trackIndex: Int = 0

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
                if (trackGroupArray.length > 0 && trackGroupArray.length >= trackIndex) {
                    trackSelections[i] = FixedTrackSelection(trackGroupArray.get(trackIndex), 0)
                    rendererConfiguration[i] = RendererConfiguration.DEFAULT
                }
            }
        }

        return android.util.Pair(rendererConfiguration, trackSelections)
    }

    fun changeTrack() {
        trackIndex = if (trackIndex == 0) 1 else 0
        this.invalidate()
    }
}

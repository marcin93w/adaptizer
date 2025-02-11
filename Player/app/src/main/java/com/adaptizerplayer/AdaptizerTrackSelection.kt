package com.adaptizerplayer

import androidx.media3.common.C
import androidx.media3.common.TrackGroup
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.source.chunk.MediaChunk
import androidx.media3.exoplayer.source.chunk.MediaChunkIterator
import androidx.media3.exoplayer.trackselection.BaseTrackSelection

@UnstableApi
class AdaptizerTrackSelection(
    group: TrackGroup,
    tracks: IntArray,
    private var selectedTrack: Int
) : BaseTrackSelection(group, tracks, TYPE_CUSTOM_BASE) {

    private var clearQueue = false

    override fun updateSelectedTrack(
        playbackPositionUs: Long,
        bufferedDurationUs: Long,
        availableDurationUs: Long,
        queue: List<MediaChunk>,
        mediaChunkIterators: Array<MediaChunkIterator>
    ) {
    }

    override fun getSelectedIndex(): Int = selectedTrack
    override fun getSelectionReason(): Int = C.SELECTION_REASON_ADAPTIVE
    override fun getSelectionData(): Any? = null

    override fun evaluateQueueSize(playbackPositionUs: Long, queue: List<MediaChunk>): Int {
        if (clearQueue) {
            clearQueue = false
            return 0
        }
        return super.evaluateQueueSize(playbackPositionUs, queue)
    }

    fun setSelectedTrack(trackIndex: Int) {
        selectedTrack = trackIndex
        clearQueue = true
    }
}

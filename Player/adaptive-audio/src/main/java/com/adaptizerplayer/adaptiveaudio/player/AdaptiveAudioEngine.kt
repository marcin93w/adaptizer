@file:OptIn(UnstableApi::class)

package com.adaptizerplayer.adaptiveaudio.player

import android.content.Context
import android.os.Looper
import androidx.core.net.toUri
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.dash.DashMediaSource

/**
 * Thrown when a transport command (`prepare`, `play`, `pause`, `seekTo`, `changeTrack`) is issued
 * on an [AdaptiveAudioEngine] that has not yet been [AdaptiveAudioEngine.initialize]d, or that has
 * already been [AdaptiveAudioEngine.release]d. This is a typed replacement for the
 * NullPointerException that would otherwise result from touching a null/released ExoPlayer
 * instance; see docs/native-bridge-contract.md's `lifecycle` / `not_initialized` error codes,
 * which the bridge layer maps this onto.
 */
class AdaptiveAudioEngineStateException(message: String) : IllegalStateException(message)

/**
 * Observer for playback state and error events produced by the underlying player. This is new
 * capability relative to the legacy `MainActivity`, which never registered a `Player.Listener` at
 * all (see docs/adaptive-audio.md section 7, known issue 4). Registering zero listeners - i.e. a
 * host that never calls [AdaptiveAudioEngine.addListener] - reproduces the legacy app's observable
 * behavior exactly.
 */
interface AdaptiveAudioListener {
    fun onPlaybackStateChanged(playbackState: Int)
    fun onPlayerError(error: PlaybackException)

    /** Called when ExoPlayer starts or stops actively advancing playback. */
    fun onIsPlayingChanged(isPlaying: Boolean) {}
}

/**
 * Owns the Media3 [ExoPlayer] instance, the custom [AdaptizerTrackSelector] and DASH media-source
 * preparation described in docs/adaptive-audio.md sections 4 and 5. This is the
 * `AdaptiveAudioEngine` referenced by docs/native-bridge-contract.md; it has no React Native or
 * JS dependency of any kind, and exposes no `setIntensity()` / `selectTrack()` style API - track
 * selection is driven only by [changeTrack], called from Kotlin-side adaptation logic.
 *
 * Main-thread confinement: every public member must only be called from the main thread, matching
 * ExoPlayer's own threading requirement. [checkMainThread] enforces this on every entry point.
 */
class AdaptiveAudioEngine(private val context: Context) {

    private var exoPlayer: ExoPlayer? = null
    private var trackSelector: AdaptizerTrackSelector? = null
    private var released = false

    private val listeners = mutableListOf<AdaptiveAudioListener>()

    private val playerListener = object : Player.Listener {
        override fun onPlaybackStateChanged(playbackState: Int) {
            listeners.forEach { it.onPlaybackStateChanged(playbackState) }
        }

        override fun onPlayerError(error: PlaybackException) {
            listeners.forEach { it.onPlayerError(error) }
        }

        override fun onIsPlayingChanged(isPlaying: Boolean) {
            listeners.forEach { it.onIsPlayingChanged(isPlaying) }
        }
    }

    /**
     * The underlying [Player], for a host to bind to a `PlayerView` (e.g.
     * `playerView.player = engine.player`). `null` before [initialize] and after [release].
     */
    val player: Player?
        get() {
            checkMainThread()
            return exoPlayer
        }

    /** Current playback position in milliseconds, or `0` before [initialize] / after [release]. */
    val currentPositionMs: Long
        get() {
            checkMainThread()
            return exoPlayer?.currentPosition ?: 0L
        }

    /** Duration of the current source in milliseconds, or [C.TIME_UNSET] if unknown/not prepared. */
    val durationMs: Long
        get() {
            checkMainThread()
            return exoPlayer?.duration ?: C.TIME_UNSET
        }

    /** Current buffered position in milliseconds, or `0` before initialization / after release. */
    val bufferedPositionMs: Long
        get() {
            checkMainThread()
            return exoPlayer?.bufferedPosition ?: 0L
        }

    /** Read-only test seam for asserting the selected representation after Media3 preparation. */
    val selectedTrackIndex: Int?
        get() {
            checkMainThread()
            return trackSelector?.currentSelectedIndex()
        }

    /** Requested adaptation index, or `null` before initialization / after release. */
    val requestedTrackIndex: Int?
        get() {
            checkMainThread()
            return trackSelector?.requestedTrackIndex
        }

    /** Number of audio representations detected in the prepared manifest. */
    val availableTrackCount: Int?
        get() {
            checkMainThread()
            return trackSelector?.availableTrackCount
        }

    /**
     * Builds the [ExoPlayer] with an [AdaptizerTrackSelector] seeded at [initialTrackIndex] -
     * mirroring the legacy `MainActivity`, which computed the intensity synchronously and built
     * `AdaptizerTrackSelector(adaptizer.getTrackIndex())` before constructing the player (see
     * the intensity formula in docs/adaptive-audio.md). Idempotent: a second call while already
     * initialized has no effect. Safe to call again after [release] to start a new session.
     */
    fun initialize(initialTrackIndex: Int) {
        checkMainThread()
        if (exoPlayer != null) return
        released = false
        val selector = AdaptizerTrackSelector(initialTrackIndex)
        trackSelector = selector
        exoPlayer = ExoPlayer.Builder(context)
            .setTrackSelector(selector)
            .build()
            .also { it.addListener(playerListener) }
    }

    /**
     * Builds the DASH [MediaItem]/[DashMediaSource] for [sourceUri] using a
     * [DefaultHttpDataSource.Factory] and calls `setMediaSource` + `prepare`, exactly as the
     * legacy `MainActivity.prepareSong` did. Does not start playback.
     */
    fun prepare(sourceUri: String) {
        checkMainThread()
        val player = requirePlayer()
        val mediaItem = MediaItem.fromUri(sourceUri.toUri())
        val dashMediaSource = DashMediaSource.Factory(DefaultHttpDataSource.Factory())
            .createMediaSource(mediaItem)
        player.setMediaSource(dashMediaSource)
        player.prepare()
    }

    fun play() {
        checkMainThread()
        requirePlayer().play()
    }

    fun pause() {
        checkMainThread()
        requirePlayer().pause()
    }

    fun seekTo(positionMs: Long) {
        checkMainThread()
        requirePlayer().seekTo(positionMs)
    }

    /** Delegates to the [AdaptizerTrackSelector]; this is the only supported way to change track. */
    fun changeTrack(trackIndex: Int) {
        checkMainThread()
        requirePlayer()
        trackSelector?.changeTrack(trackIndex)
    }

    fun addListener(listener: AdaptiveAudioListener) {
        checkMainThread()
        listeners.add(listener)
    }

    fun removeListener(listener: AdaptiveAudioListener) {
        checkMainThread()
        listeners.remove(listener)
    }

    /** Releases the underlying player. Idempotent: safe to call multiple times. */
    fun release() {
        checkMainThread()
        exoPlayer?.removeListener(playerListener)
        exoPlayer?.release()
        exoPlayer = null
        trackSelector = null
        listeners.clear()
        released = true
    }

    private fun requirePlayer(): ExoPlayer {
        return exoPlayer ?: throw AdaptiveAudioEngineStateException(
            if (released) {
                "AdaptiveAudioEngine command issued after release()"
            } else {
                "AdaptiveAudioEngine command issued before initialize()"
            }
        )
    }

    private fun checkMainThread() {
        check(Looper.myLooper() == Looper.getMainLooper()) {
            "AdaptiveAudioEngine must only be accessed from the main thread"
        }
    }
}

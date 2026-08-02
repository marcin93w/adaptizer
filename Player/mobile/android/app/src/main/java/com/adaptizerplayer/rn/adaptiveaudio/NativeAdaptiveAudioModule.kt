@file:OptIn(androidx.media3.common.util.UnstableApi::class)

package com.adaptizerplayer.rn.adaptiveaudio

import android.os.Handler
import android.os.Looper
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import com.adaptizerplayer.adaptiveaudio.adaptizer.Adaptizer
import com.adaptizerplayer.adaptiveaudio.adaptizer.AdaptizerInput
import com.adaptizerplayer.adaptiveaudio.adaptizer.AdaptizerState
import com.adaptizerplayer.adaptiveaudio.adaptizer.inputs.AccelerometerInput
import com.adaptizerplayer.adaptiveaudio.adaptizer.inputs.VolumeInput
import com.adaptizerplayer.adaptiveaudio.player.AdaptiveAudioEngine
import com.adaptizerplayer.adaptiveaudio.player.AdaptiveAudioEngineStateException
import com.adaptizerplayer.adaptiveaudio.player.AdaptiveAudioListener
import com.adaptizerplayer.adaptiveaudio.player.AdaptiveAudioManifestException
import com.adaptizerplayer.adaptiveaudio.player.AdaptizerTrackSelector
import com.adaptizerplayer.adaptiveaudio.player.AdaptiveAudioUnsupportedTrackException
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule

/**
 * Native adaptation bridge for [AdaptiveAudioEngine].
 *
 * Commands may arrive on React Native's module queue, while Media3 must be
 * accessed from Android's main thread. Adaptizer and both device inputs are
 * initialized and released with this module; JS only observes their typed
 * intensity/track events and has no track-selection command.
 */
@ReactModule(name = NativeAdaptiveAudioSpec.NAME)
class NativeAdaptiveAudioModule(reactContext: ReactApplicationContext) :
    NativeAdaptiveAudioSpec(reactContext), LifecycleEventListener {

  companion object {
    const val NAME: String = NativeAdaptiveAudioSpec.NAME

    const val EXPECTED_TRACK_COUNT = AdaptizerTrackSelector.EXPECTED_TRACK_COUNT
    const val PROGRESS_INTERVAL_MS = 250L

    const val STATE_IDLE = "idle"
    const val STATE_BUFFERING = "buffering"
    const val STATE_READY = "ready"
    const val STATE_PLAYING = "playing"
    const val STATE_PAUSED = "paused"
    const val STATE_ENDED = "ended"
  }

  private val mainHandler = Handler(Looper.getMainLooper())
  private var engine: AdaptiveAudioEngine? = null
  private var adaptizer: Adaptizer? = null
  private var inputs: List<AdaptizerInput> = emptyList()
  private var sourceId: String? = null
  private var playRequested = false
  private var explicitlyPaused = false
  private var lastPlaybackState: String? = null
  private var released = false

  private val progressRunnable = object : Runnable {
    override fun run() {
      if (released || sourceId == null) return
      emitProgress()
      if (engine?.player?.isPlaying == true) {
        mainHandler.postDelayed(this, PROGRESS_INTERVAL_MS)
      }
    }
  }

  private val engineListener = object : AdaptiveAudioListener {
    override fun onPlaybackStateChanged(playbackState: Int) {
      when (playbackState) {
        Player.STATE_IDLE -> reportPlaybackState(STATE_IDLE)
        Player.STATE_BUFFERING -> reportPlaybackState(STATE_BUFFERING)
        Player.STATE_READY -> {
          if (engine?.player?.isPlaying == true && playRequested) {
            reportPlaybackState(STATE_PLAYING)
            startProgressUpdates()
          } else if (explicitlyPaused) {
            reportPlaybackState(STATE_PAUSED)
          } else {
            reportPlaybackState(STATE_READY)
          }
          emitCurrentTrackChanged()
        }
        Player.STATE_ENDED -> {
          playRequested = false
          explicitlyPaused = false
          reportPlaybackState(STATE_ENDED)
          stopProgressUpdates()
        }
      }
    }

    override fun onIsPlayingChanged(isPlaying: Boolean) {
      if (isPlaying) {
        reportPlaybackState(STATE_PLAYING)
        startProgressUpdates()
      } else if (explicitlyPaused && engine?.player?.playbackState == Player.STATE_READY) {
        reportPlaybackState(STATE_PAUSED)
        stopProgressUpdates()
      }
    }

    override fun onPlayerError(error: PlaybackException) {
      stopProgressUpdates()
      reportPlayerError(errorCode(error), error.message ?: error.errorCodeName, recoverable(error))
    }
  }

  init {
    reactApplicationContext.addLifecycleEventListener(this)
  }

  override fun prepare(sourceUri: String, metadata: ReadableMap) {
    onMain {
      if (!checkUsable()) return@onMain

      try {
        val requestedSourceId =
            if (metadata.hasKey("id") && !metadata.isNull("id")) {
              metadata.getString("id")
            } else {
              null
            } ?: sourceUri

        val activeEngine = engine ?: createActiveEngine()
        stopProgressUpdates()
        sourceId = requestedSourceId
        playRequested = false
        explicitlyPaused = false
        activeEngine.prepare(sourceUri)
      } catch (error: Exception) {
        sourceId = null
        reportCommandError(error)
      }
    }
  }

  override fun play() {
    onMain {
      if (!checkPrepared()) return@onMain
      try {
        playRequested = true
        explicitlyPaused = false
        engine!!.play()
        if (engine?.player?.isPlaying == true) {
          reportPlaybackState(STATE_PLAYING)
          startProgressUpdates()
        }
      } catch (error: Exception) {
        reportCommandError(error)
      }
    }
  }

  override fun pause() {
    onMain {
      if (!checkPrepared()) return@onMain
      try {
        playRequested = false
        explicitlyPaused = true
        engine!!.pause()
        reportPlaybackState(STATE_PAUSED)
        emitProgress()
        stopProgressUpdates()
      } catch (error: Exception) {
        reportCommandError(error)
      }
    }
  }

  override fun seekTo(positionMs: Double) {
    onMain {
      if (!checkPrepared()) return@onMain
      try {
        engine!!.seekTo(positionMs.toLong().coerceAtLeast(0L))
        // ExoPlayer applies the seek asynchronously; this immediate event is
        // the bridge contract's minimum acknowledgement, followed by the
        // periodic event if playback is active.
        emitProgress()
      } catch (error: Exception) {
        reportCommandError(error)
      }
    }
  }

  override fun release() {
    onMain { releaseInternal(emitIdle = true) }
  }

  override fun onHostResume() = Unit

  override fun onHostPause() = Unit

  override fun onHostDestroy() {
    onMain { releaseInternal(emitIdle = false) }
  }

  override fun invalidate() {
    // Paired with the registration in init: without this the dead module (and
    // its main-thread Handler) stays in the context's listener set and keeps
    // receiving host callbacks for the life of the React context.
    reactApplicationContext.removeLifecycleEventListener(this)
    onMain { releaseInternal(emitIdle = false, permanent = true) }
    super.invalidate()
  }

  private fun onMain(action: () -> Unit) {
    if (Looper.myLooper() == Looper.getMainLooper()) {
      action()
    } else {
      mainHandler.post(action)
    }
  }

  private fun createActiveEngine(): AdaptiveAudioEngine {
    val volumeInput = VolumeInput(reactApplicationContext)
    val accelerometerInput = AccelerometerInput(reactApplicationContext)
    val newAdaptizer = Adaptizer(volumeInput, accelerometerInput)
    newAdaptizer.onStateChange { state -> onAdaptizerStateChanged(state) }

    val newInputs = listOf<AdaptizerInput>(volumeInput, accelerometerInput)
    val newEngine = AdaptiveAudioEngine(reactApplicationContext)
    try {
      // Match the legacy ordering: listeners are wired before native inputs
      // begin reporting, and the initial selector index uses live input state.
      inputs = newInputs
      adaptizer = newAdaptizer
      newInputs.forEach { it.initialize() }
      newEngine.addListener(engineListener)
      newEngine.initialize(newAdaptizer.getTrackIndex())
      engine = newEngine
      emitIntensityChanged(newAdaptizer.getCurrentState())
      return newEngine
    } catch (error: Exception) {
      newInputs.asReversed().forEach { it.release() }
      inputs = emptyList()
      adaptizer = null
      throw error
    }
  }

  private fun onAdaptizerStateChanged(state: AdaptizerState) {
    onMain {
      if (released) return@onMain
      emitIntensityChanged(state)

      val activeEngine = engine ?: return@onMain
      try {
        // This is the only native track-selection path. The JS contract has
        // no setIntensity/selectTrack command by design.
        activeEngine.changeTrack(state.intensity)
        emitCurrentTrackChanged(state.intensity)
      } catch (error: Exception) {
        reportCommandError(error)
      }
    }
  }

  private fun checkUsable(): Boolean {
    if (released) {
      reportPlayerError("not_initialized", "Adaptive audio module was released.", false)
      return false
    }
    return true
  }

  private fun checkPrepared(): Boolean {
    if (!checkUsable()) return false
    if (engine == null || sourceId == null) {
      reportPlayerError(
          "not_initialized", "Prepare a source before issuing transport commands.", false)
      return false
    }
    return true
  }

  private fun releaseInternal(emitIdle: Boolean, permanent: Boolean = false) {
    if (released) return
    val shouldEmitIdle = emitIdle && sourceId != null
    stopProgressUpdates()
    engine?.removeListener(engineListener)
    engine?.release()
    inputs.asReversed().forEach { it.release() }
    engine = null
    adaptizer = null
    inputs = emptyList()
    sourceId = null
    playRequested = false
    explicitlyPaused = false
    lastPlaybackState = null
    released = permanent
    if (shouldEmitIdle) {
      emitOnPlaybackState(
          Arguments.createMap().apply {
            putString("state", STATE_IDLE)
            putNull("sourceId")
          })
    }
  }

  private fun startProgressUpdates() {
    mainHandler.removeCallbacks(progressRunnable)
    mainHandler.post(progressRunnable)
  }

  private fun stopProgressUpdates() {
    mainHandler.removeCallbacks(progressRunnable)
  }

  private fun emitProgress() {
    val activeEngine = engine ?: return
    if (sourceId == null || released) return
    emitOnProgress(
        Arguments.createMap().apply {
          putDouble("positionMs", activeEngine.currentPositionMs.toDouble())
          putDouble("durationMs", durationForEvent(activeEngine.durationMs).toDouble())
          putDouble("bufferedMs", activeEngine.bufferedPositionMs.toDouble())
        })
  }

  private fun emitIntensityChanged(state: AdaptizerState) {
    emitOnIntensityChanged(
        Arguments.createMap().apply {
          putInt("intensity", state.intensity)
          putInt("volume", state.volume)
          putInt("acceleration", state.acceleration)
        })
  }

  private fun emitCurrentTrackChanged(requestedIndex: Int? = null) {
    val activeEngine = engine ?: return
    val selectedIndex = activeEngine.selectedTrackIndex ?: return
    val availableCount = activeEngine.availableTrackCount ?: return
    val request = requestedIndex ?: activeEngine.requestedTrackIndex ?: return

    // The selector rejects non-contract manifests before creating a
    // selection. Keep this guard at the bridge boundary too so a malformed or
    // future selector cannot send an invalid typed event to JS.
    if (availableCount != EXPECTED_TRACK_COUNT ||
        request !in 0 until availableCount ||
        selectedIndex !in 0 until availableCount) {
      reportPlayerError(
          "unsupported_track",
          "Track selection is outside the supported $EXPECTED_TRACK_COUNT-track contract.",
          false)
      return
    }

    emitOnTrackChanged(
        Arguments.createMap().apply {
          putInt("requestedIndex", request)
          putInt("selectedIndex", selectedIndex)
          putInt("availableCount", availableCount)
        })
  }

  private fun durationForEvent(durationMs: Long): Long =
      if (durationMs < 0L || durationMs == Long.MAX_VALUE) -1L else durationMs

  private fun reportPlaybackState(state: String) {
    if (released || sourceId == null || lastPlaybackState == state) return
    lastPlaybackState = state
    emitOnPlaybackState(
        Arguments.createMap().apply {
          putString("state", state)
          putString("sourceId", sourceId)
        })
  }

  private fun reportCommandError(error: Throwable) {
    when (error) {
      is AdaptiveAudioEngineStateException ->
          reportPlayerError("not_initialized", error.message ?: "Adaptive audio is not prepared.", false)
      is AdaptiveAudioUnsupportedTrackException ->
          reportPlayerError("unsupported_track", error.message ?: "Unsupported audio track.", false)
      is AdaptiveAudioManifestException ->
          reportPlayerError("manifest", error.message ?: "Unsupported audio manifest.", false)
      else -> reportPlayerError("lifecycle", error.message ?: "Adaptive audio command failed.", false)
    }
  }

  private fun reportPlayerError(code: String, message: String, recoverable: Boolean) {
    emitOnPlayerError(
        Arguments.createMap().apply {
          putString("code", code)
          putString("message", message.ifBlank { code })
          putBoolean("recoverable", recoverable)
        })
  }

  private fun errorCode(error: PlaybackException): String {
    if (error.hasCause<AdaptiveAudioManifestException>()) return "manifest"
    if (error.hasCause<AdaptiveAudioUnsupportedTrackException>()) return "unsupported_track"

    return when (error.errorCode) {
      PlaybackException.ERROR_CODE_IO_UNSPECIFIED,
      PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_FAILED,
      PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_TIMEOUT,
      PlaybackException.ERROR_CODE_IO_INVALID_HTTP_CONTENT_TYPE,
      PlaybackException.ERROR_CODE_IO_BAD_HTTP_STATUS,
      PlaybackException.ERROR_CODE_IO_FILE_NOT_FOUND,
      PlaybackException.ERROR_CODE_IO_NO_PERMISSION,
      PlaybackException.ERROR_CODE_IO_CLEARTEXT_NOT_PERMITTED,
      PlaybackException.ERROR_CODE_IO_READ_POSITION_OUT_OF_RANGE -> "network"
      PlaybackException.ERROR_CODE_PARSING_CONTAINER_MALFORMED,
      PlaybackException.ERROR_CODE_PARSING_MANIFEST_MALFORMED,
      PlaybackException.ERROR_CODE_PARSING_CONTAINER_UNSUPPORTED,
      PlaybackException.ERROR_CODE_PARSING_MANIFEST_UNSUPPORTED -> "manifest"
      PlaybackException.ERROR_CODE_DECODER_INIT_FAILED,
      PlaybackException.ERROR_CODE_DECODER_QUERY_FAILED,
      PlaybackException.ERROR_CODE_DECODING_FAILED,
      PlaybackException.ERROR_CODE_DECODING_FORMAT_EXCEEDS_CAPABILITIES,
      PlaybackException.ERROR_CODE_DECODING_FORMAT_UNSUPPORTED,
      PlaybackException.ERROR_CODE_AUDIO_TRACK_INIT_FAILED,
      PlaybackException.ERROR_CODE_AUDIO_TRACK_WRITE_FAILED,
      PlaybackException.ERROR_CODE_AUDIO_TRACK_OFFLOAD_INIT_FAILED,
      PlaybackException.ERROR_CODE_AUDIO_TRACK_OFFLOAD_WRITE_FAILED -> "decoder"
      else -> "unknown"
    }
  }

  private fun recoverable(error: PlaybackException): Boolean = errorCode(error) == "network"

  private inline fun <reified T : Throwable> Throwable.hasCause(): Boolean {
    var current: Throwable? = this
    while (current != null) {
      if (current is T) return true
      current = current.cause
    }
    return false
  }
}

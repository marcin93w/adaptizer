package com.adaptizerplayer.rn.adaptiveaudio

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule

/**
 * A03 bridge shell only. Playback and adaptation stay out of this module
 * until A04 connects the independent adaptive-audio library.
 */
@ReactModule(name = NativeAdaptiveAudioSpec.NAME)
class NativeAdaptiveAudioModule(reactContext: ReactApplicationContext) :
    NativeAdaptiveAudioSpec(reactContext) {

  private var released = false

  override fun prepare(sourceUri: String, metadata: ReadableMap) {
    reportNotInitialized(
        "Adaptive audio bridge is scaffolded; playback is not connected yet.")
  }

  override fun play() {
    reportNotInitialized("Adaptive audio playback is not initialized yet.")
  }

  override fun pause() {
    reportNotInitialized("Adaptive audio playback is not initialized yet.")
  }

  override fun seekTo(positionMs: Double) {
    reportNotInitialized("Adaptive audio playback is not initialized yet.")
  }

  override fun release() {
    released = true
    reportNotInitialized("Adaptive audio bridge has no playback engine yet.")
  }

  private fun reportNotInitialized(message: String) {
    emitOnPlayerError(
        Arguments.createMap().apply {
          putString("code", "not_initialized")
          putString("message", if (released) "Adaptive audio module was released." else message)
          putBoolean("recoverable", false)
        })
  }

  companion object {
    const val NAME: String = NativeAdaptiveAudioSpec.NAME
  }
}

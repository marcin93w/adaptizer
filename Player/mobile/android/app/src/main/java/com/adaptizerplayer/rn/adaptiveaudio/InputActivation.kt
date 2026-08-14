package com.adaptizerplayer.rn.adaptiveaudio

/** Application-layer lifecycle for an input that may need runtime permission. */
internal interface InputActivation {
  fun onSourcePrepared(dimension: String)
  fun onPlaybackRequested()
  fun onHostPause()
  fun onHostResume()
  fun release()
}

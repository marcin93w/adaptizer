package com.adaptizerplayer.rn.adaptiveaudio

import android.content.pm.PackageManager

/**
 * Owns the single Android runtime-permission request slot shared by all input
 * activations. Requests are queued in activation order and the next dialog is
 * not launched until the current result has been delivered.
 */
internal class InputActivationCoordinator(
    private val launchPermissionRequest: (Array<String>, Int) -> Boolean,
) {
  private data class PendingRequest(
      val owner: InputActivation,
      val permissions: Array<String>,
      val onLaunched: () -> Unit,
      val onResult: (Boolean) -> Unit,
      val onFailed: () -> Unit,
  )

  private val activations = mutableListOf<InputActivation>()
  private val permissionQueue = ArrayDeque<PendingRequest>()
  private var activePermissionRequest: PendingRequest? = null
  private var released = false

  fun register(activation: InputActivation) {
    check(!released) { "Cannot register an input activation after release." }
    activations += activation
  }

  fun onSourcePrepared(dimension: String) {
    if (released) return
    activations.forEach { it.onSourcePrepared(dimension) }
  }

  fun onPlaybackRequested() {
    if (released) return
    activations.forEach { it.onPlaybackRequested() }
  }

  fun onHostPause() {
    if (released) return
    activations.forEach { it.onHostPause() }
  }

  fun onHostResume() {
    if (released) return
    activations.forEach { it.onHostResume() }
  }

  fun requestPermission(
      owner: InputActivation,
      permissions: Array<String>,
      onLaunched: () -> Unit,
      onResult: (Boolean) -> Unit,
      onFailed: () -> Unit,
  ) {
    if (released || activePermissionRequest?.owner === owner ||
        permissionQueue.any { it.owner === owner }) return

    permissionQueue += PendingRequest(owner, permissions, onLaunched, onResult, onFailed)
    launchNextPermissionRequest()
  }

  fun cancelQueuedPermission(owner: InputActivation) {
    val cancelled = permissionQueue.filter { it.owner === owner }
    permissionQueue.removeAll(cancelled.toSet())
    cancelled.forEach { it.onFailed() }
  }

  fun onRequestPermissionsResult(
      requestCode: Int,
      grantResults: IntArray,
  ): Boolean {
    if (requestCode != INPUT_PERMISSION_REQUEST_CODE) return false
    val completed = activePermissionRequest
    activePermissionRequest = null
    if (!released && completed != null) {
      val granted =
          grantResults.size == completed.permissions.size &&
              grantResults.all { it == PackageManager.PERMISSION_GRANTED }
      completed.onResult(granted)
      launchNextPermissionRequest()
    }
    return true
  }

  fun release() {
    if (released) return
    released = true
    permissionQueue.forEach { it.onFailed() }
    permissionQueue.clear()
    activePermissionRequest = null
    activations.asReversed().forEach { it.release() }
    activations.clear()
  }

  private fun launchNextPermissionRequest() {
    while (!released && activePermissionRequest == null && permissionQueue.isNotEmpty()) {
      val request = permissionQueue.removeFirst()
      activePermissionRequest = request
      val launched =
          try {
            launchPermissionRequest(request.permissions, INPUT_PERMISSION_REQUEST_CODE)
          } catch (_: RuntimeException) {
            false
          }
      if (launched) {
        request.onLaunched()
      } else {
        activePermissionRequest = null
        request.onFailed()
      }
    }
  }

  companion object {
    internal const val INPUT_PERMISSION_REQUEST_CODE = 2501
  }
}

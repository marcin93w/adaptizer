package com.adaptizerplayer.rn.adaptiveaudio

import android.Manifest
import android.bluetooth.BluetoothManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import com.adaptizerplayer.adaptiveaudio.adaptizer.AdaptizerInput
import com.adaptizerplayer.adaptiveaudio.adaptizer.Dimensions

internal class HeartRateInputActivation internal constructor(
    private val input: AdaptizerInput,
    private val coordinator: InputActivationCoordinator,
    private val hasCapability: () -> Boolean,
    private val requiredPermissions: () -> Array<String>,
    private val hasPermissions: (Array<String>) -> Boolean,
    private val permissionWasRequested: () -> Boolean,
    private val setPermissionWasRequested: (Boolean) -> Unit,
) : InputActivation {
  private var relevant = false
  private var playbackRequested = false
  private var permissionPending = false
  private var generation = 0
  private var released = false

  constructor(
      context: Context,
      input: AdaptizerInput,
      coordinator: InputActivationCoordinator,
  ) : this(
      input = input,
      coordinator = coordinator,
      hasCapability = {
        context.packageManager.hasSystemFeature(PackageManager.FEATURE_BLUETOOTH_LE) &&
            (context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager)?.adapter != null
      },
      requiredPermissions = {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
          arrayOf(Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT)
        } else {
          arrayOf(Manifest.permission.ACCESS_FINE_LOCATION)
        }
      },
      hasPermissions = { permissions ->
        permissions.all { context.checkSelfPermission(it) == PackageManager.PERMISSION_GRANTED }
      },
      permissionWasRequested = {
        context.getSharedPreferences(PERMISSION_PREFERENCES, Context.MODE_PRIVATE)
            .getBoolean(PERMISSION_REQUESTED, false)
      },
      setPermissionWasRequested = { requested ->
        context.getSharedPreferences(PERMISSION_PREFERENCES, Context.MODE_PRIVATE)
            .edit()
            .let { editor ->
              if (requested) editor.putBoolean(PERMISSION_REQUESTED, true)
              else editor.remove(PERMISSION_REQUESTED)
            }
            .apply()
      },
  )

  override fun onSourcePrepared(dimension: String) {
    generation++
    relevant = dimension.needsHeartRate()
    playbackRequested = false
    if (!relevant) {
      coordinator.cancelQueuedPermission(this)
      input.release()
    }
  }

  override fun onPlaybackRequested() {
    if (released) return
    playbackRequested = true
    activate(allowPermissionRequest = true)
  }

  override fun onHostPause() = Unit

  override fun onHostResume() {
    if (!released && relevant && playbackRequested) activate(allowPermissionRequest = false)
  }

  override fun release() {
    if (released) return
    released = true
    generation++
    relevant = false
    playbackRequested = false
    coordinator.cancelQueuedPermission(this)
    input.release()
  }

  private fun activate(allowPermissionRequest: Boolean) {
    if (!relevant || !playbackRequested || !hasCapability()) return
    val permissions = requiredPermissions()
    if (hasPermissions(permissions)) {
      input.initialize()
      return
    }
    if (!allowPermissionRequest || permissionPending || permissionWasRequested()) return

    val requestedGeneration = generation
    permissionPending = true
    coordinator.requestPermission(
        owner = this,
        permissions = permissions,
        onLaunched = { setPermissionWasRequested(true) },
        onResult = { granted ->
          permissionPending = false
          if (granted && !released && generation == requestedGeneration && relevant &&
              playbackRequested) {
            input.initialize()
          }
        },
        onFailed = {
          permissionPending = false
          setPermissionWasRequested(false)
        },
    )
  }

  private fun String.needsHeartRate(): Boolean =
      this != Dimensions.VOLUME && this != Dimensions.MOVEMENT_SPEED

  private companion object {
    const val PERMISSION_PREFERENCES = "adaptive_audio_permissions"
    const val PERMISSION_REQUESTED = "bluetooth_requested"
  }
}

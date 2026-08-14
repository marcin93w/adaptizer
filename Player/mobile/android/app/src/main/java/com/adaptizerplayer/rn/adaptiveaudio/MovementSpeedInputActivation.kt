package com.adaptizerplayer.rn.adaptiveaudio

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import com.adaptizerplayer.adaptiveaudio.adaptizer.AdaptizerInput
import com.adaptizerplayer.adaptiveaudio.adaptizer.Dimensions
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability

internal class MovementSpeedInputActivation internal constructor(
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
  private var hostResumed = true
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
        GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(context) ==
            ConnectionResult.SUCCESS
      },
      requiredPermissions = {
        buildList {
          add(Manifest.permission.ACCESS_COARSE_LOCATION)
          add(Manifest.permission.ACCESS_FINE_LOCATION)
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            add(Manifest.permission.ACTIVITY_RECOGNITION)
          }
        }.toTypedArray()
      },
      hasPermissions = {
        ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED &&
            (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q ||
                ContextCompat.checkSelfPermission(
                    context, Manifest.permission.ACTIVITY_RECOGNITION) ==
                    PackageManager.PERMISSION_GRANTED)
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
    relevant = dimension.needsMovementSpeed()
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

  override fun onHostPause() {
    hostResumed = false
    input.release()
  }

  override fun onHostResume() {
    hostResumed = true
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
    if (!hostResumed || !relevant || !playbackRequested || !hasCapability()) return
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
              playbackRequested && hostResumed) {
            input.initialize()
          }
        },
        onFailed = {
          permissionPending = false
          setPermissionWasRequested(false)
        },
    )
  }

  private fun String.needsMovementSpeed(): Boolean =
      this != Dimensions.VOLUME && this != Dimensions.HEART_RATE

  private companion object {
    const val PERMISSION_PREFERENCES = "adaptive_audio_permissions"
    const val PERMISSION_REQUESTED = "movement_speed_asked"
  }
}

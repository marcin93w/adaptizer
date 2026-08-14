package com.adaptizerplayer.rn.adaptiveaudio

import android.content.pm.PackageManager
import com.adaptizerplayer.adaptiveaudio.adaptizer.AdaptizerInput
import com.adaptizerplayer.adaptiveaudio.adaptizer.Dimensions
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class HeartRateInputActivationTest {
  @Test
  fun prepareIsLazy_andEachDimensionActivatesOnlyWhenRelevant() {
    listOf(
            Dimensions.HEART_RATE to true,
            Dimensions.INTENSITY to true,
            "futureDimension" to true,
            Dimensions.MOVEMENT_SPEED to false,
            Dimensions.VOLUME to false,
        )
        .forEach { (dimension, expectedRelevant) ->
          val harness = HeartHarness(granted = true)

          harness.coordinator.onSourcePrepared(dimension)
          assertEquals(0, harness.input.initializeCount)
          assertTrue(harness.launchedPermissions.isEmpty())

          harness.coordinator.onPlaybackRequested()
          assertEquals(if (expectedRelevant) 1 else 0, harness.input.initializeCount)
        }
  }

  @Test
  fun denialIsPersisted_andIsNotPromptedAgain() {
    val harness = HeartHarness()
    harness.prepareAndPlay()

    assertEquals(1, harness.launchedPermissions.size)
    assertTrue(harness.permissionWasRequested)
    harness.deliver(granted = false)
    harness.coordinator.onPlaybackRequested()

    assertEquals(1, harness.launchedPermissions.size)
    assertEquals(0, harness.input.initializeCount)
  }

  @Test
  fun persistedDenialSkipsRequest_butSettingsGrantActivatesOnResume() {
    val harness = HeartHarness(permissionWasRequested = true)
    harness.prepareAndPlay()

    assertTrue(harness.launchedPermissions.isEmpty())
    assertEquals(0, harness.input.initializeCount)

    harness.granted = true
    harness.coordinator.onHostResume()

    assertEquals(1, harness.input.initializeCount)
  }

  @Test
  fun requestFailureCanBeRetried() {
    val harness = HeartHarness(launchSucceeds = false)
    harness.prepareAndPlay()

    assertFalse(harness.permissionWasRequested)
    assertEquals(1, harness.launchAttempts)

    harness.launchSucceeds = true
    harness.coordinator.onPlaybackRequested()
    assertEquals(2, harness.launchAttempts)
    assertTrue(harness.permissionWasRequested)
  }

  @Test
  fun sourceSwitchMakesPermissionCallbackStale() {
    val harness = HeartHarness()
    harness.prepareAndPlay()
    harness.coordinator.onSourcePrepared(Dimensions.VOLUME)

    harness.deliver(granted = true)

    assertEquals(0, harness.input.initializeCount)
    assertTrue(harness.input.releaseCount > 0)
  }

  @Test
  fun releaseIsIdempotent_andStaleCallbackCannotActivateInput() {
    val harness = HeartHarness()
    harness.prepareAndPlay()

    harness.coordinator.release()
    harness.coordinator.release()
    harness.deliver(granted = true)

    assertEquals(0, harness.input.initializeCount)
    assertEquals(1, harness.input.releaseCount)
  }
}

class MovementSpeedInputActivationTest {
  @Test
  fun prepareIsLazy_andEachDimensionActivatesOnlyWhenRelevant() {
    listOf(
            Dimensions.MOVEMENT_SPEED to true,
            Dimensions.INTENSITY to true,
            "futureDimension" to true,
            Dimensions.HEART_RATE to false,
            Dimensions.VOLUME to false,
        )
        .forEach { (dimension, expectedRelevant) ->
          val harness = MovementHarness(granted = true)

          harness.coordinator.onSourcePrepared(dimension)
          assertEquals(0, harness.input.initializeCount)
          harness.coordinator.onPlaybackRequested()

          assertEquals(if (expectedRelevant) 1 else 0, harness.input.initializeCount)
        }
  }

  @Test
  fun denialAndPersistedDenialDoNotReprompt() {
    val denied = MovementHarness()
    denied.prepareAndPlay()
    denied.deliver(granted = false)
    denied.coordinator.onPlaybackRequested()
    assertEquals(1, denied.launchedPermissions.size)
    assertTrue(denied.permissionWasRequested)

    val persisted = MovementHarness(permissionWasRequested = true)
    persisted.prepareAndPlay()
    assertTrue(persisted.launchedPermissions.isEmpty())
  }

  @Test
  fun requestFailureCanBeRetried() {
    val harness = MovementHarness(launchSucceeds = false)
    harness.prepareAndPlay()

    assertFalse(harness.permissionWasRequested)
    harness.launchSucceeds = true
    harness.coordinator.onPlaybackRequested()

    assertEquals(2, harness.launchAttempts)
    assertTrue(harness.permissionWasRequested)
  }

  @Test
  fun hostPauseReleasesReading_andResumeRestartsOnlyRelevantGrantedInput() {
    val harness = MovementHarness(granted = true)
    harness.prepareAndPlay()
    assertEquals(1, harness.input.initializeCount)

    harness.coordinator.onHostPause()
    assertEquals(1, harness.input.releaseCount)
    harness.coordinator.onHostResume()
    assertEquals(2, harness.input.initializeCount)

    harness.coordinator.onSourcePrepared(Dimensions.HEART_RATE)
    harness.coordinator.onHostPause()
    harness.coordinator.onHostResume()
    assertEquals(2, harness.input.initializeCount)
  }

  @Test
  fun permissionGrantedWhileBackgroundedWaitsForResume() {
    val harness = MovementHarness()
    harness.prepareAndPlay()
    harness.coordinator.onHostPause()

    harness.granted = true
    harness.deliver(granted = true)
    assertEquals(0, harness.input.initializeCount)

    harness.coordinator.onHostResume()
    assertEquals(1, harness.input.initializeCount)
  }

  @Test
  fun settingsGrantActivatesAlreadyPlayedSourceOnResume() {
    val harness = MovementHarness(permissionWasRequested = true)
    harness.prepareAndPlay()
    harness.coordinator.onHostPause()
    harness.granted = true

    harness.coordinator.onHostResume()

    assertEquals(1, harness.input.initializeCount)
  }

  @Test
  fun sourceSwitchAndReleaseRejectStalePermissionCallbacks() {
    val switched = MovementHarness()
    switched.prepareAndPlay()
    switched.coordinator.onSourcePrepared(Dimensions.HEART_RATE)
    switched.deliver(granted = true)
    assertEquals(0, switched.input.initializeCount)

    val released = MovementHarness()
    released.prepareAndPlay()
    released.coordinator.release()
    released.deliver(granted = true)
    assertEquals(0, released.input.initializeCount)
    assertEquals(1, released.input.releaseCount)
  }
}

class InputActivationCoordinatorTest {
  @Test
  fun intensitySerializesHeartRateThenMovementPermissionDialogs() {
    assertSerializedFor(Dimensions.INTENSITY)
  }

  @Test
  fun unknownDimensionSerializesHeartRateThenMovementPermissionDialogs() {
    assertSerializedFor("futureDimension")
  }

  @Test
  fun unrelatedPermissionResultIsNotConsumed() {
    val coordinator = InputActivationCoordinator { _, _ -> true }

    assertFalse(coordinator.onRequestPermissionsResult(999, intArrayOf()))
  }

  private fun assertSerializedFor(dimension: String) {
    val launched = mutableListOf<List<String>>()
    val coordinator = InputActivationCoordinator { permissions, _ ->
      launched += permissions.toList()
      true
    }
    val heart =
        HeartRateInputActivation(
            FakeInput(), coordinator, { true }, { arrayOf("heart") }, { false }, { false }, {})
    val movement =
        MovementSpeedInputActivation(
            FakeInput(), coordinator, { true }, { arrayOf("movement") }, { false }, { false }, {})
    coordinator.register(heart)
    coordinator.register(movement)

    coordinator.onSourcePrepared(dimension)
    coordinator.onPlaybackRequested()
    assertEquals(listOf(listOf("heart")), launched)

    coordinator.onRequestPermissionsResult(
        InputActivationCoordinator.INPUT_PERMISSION_REQUEST_CODE,
        intArrayOf(PackageManager.PERMISSION_DENIED),
    )
    assertEquals(listOf(listOf("heart"), listOf("movement")), launched)
  }
}

private class FakeInput : AdaptizerInput {
  var initializeCount = 0
  var releaseCount = 0

  override val isAvailable = false

  override fun getCurrentValue() = error("No reading")

  override fun registerChangeListener(listener: () -> Unit) = Unit

  override fun initialize() {
    initializeCount++
  }

  override fun release() {
    releaseCount++
  }
}

private class HeartHarness(
    var granted: Boolean = false,
    var permissionWasRequested: Boolean = false,
    var launchSucceeds: Boolean = true,
) {
  val input = FakeInput()
  val launchedPermissions = mutableListOf<List<String>>()
  var launchAttempts = 0
  val coordinator =
      InputActivationCoordinator { permissions, _ ->
        launchAttempts++
        if (launchSucceeds) launchedPermissions += permissions.toList()
        launchSucceeds
      }
  private val activation =
      HeartRateInputActivation(
          input,
          coordinator,
          hasCapability = { true },
          requiredPermissions = { arrayOf("heart") },
          hasPermissions = { granted },
          permissionWasRequested = { permissionWasRequested },
          setPermissionWasRequested = { permissionWasRequested = it },
      )

  init {
    coordinator.register(activation)
  }

  fun prepareAndPlay() {
    coordinator.onSourcePrepared(Dimensions.HEART_RATE)
    coordinator.onPlaybackRequested()
  }

  fun deliver(granted: Boolean) {
    coordinator.onRequestPermissionsResult(
        InputActivationCoordinator.INPUT_PERMISSION_REQUEST_CODE,
        intArrayOf(
            if (granted) PackageManager.PERMISSION_GRANTED else PackageManager.PERMISSION_DENIED),
    )
  }
}

private class MovementHarness(
    var granted: Boolean = false,
    var permissionWasRequested: Boolean = false,
    var launchSucceeds: Boolean = true,
) {
  val input = FakeInput()
  val launchedPermissions = mutableListOf<List<String>>()
  var launchAttempts = 0
  val coordinator =
      InputActivationCoordinator { permissions, _ ->
        launchAttempts++
        if (launchSucceeds) launchedPermissions += permissions.toList()
        launchSucceeds
      }
  private val activation =
      MovementSpeedInputActivation(
          input,
          coordinator,
          hasCapability = { true },
          requiredPermissions = { arrayOf("movement") },
          hasPermissions = { granted },
          permissionWasRequested = { permissionWasRequested },
          setPermissionWasRequested = { permissionWasRequested = it },
      )

  init {
    coordinator.register(activation)
  }

  fun prepareAndPlay() {
    coordinator.onSourcePrepared(Dimensions.MOVEMENT_SPEED)
    coordinator.onPlaybackRequested()
  }

  fun deliver(granted: Boolean) {
    coordinator.onRequestPermissionsResult(
        InputActivationCoordinator.INPUT_PERMISSION_REQUEST_CODE,
        intArrayOf(
            if (granted) PackageManager.PERMISSION_GRANTED else PackageManager.PERMISSION_DENIED),
    )
  }
}

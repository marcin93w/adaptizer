package com.adaptizerplayer.rn

import androidx.test.ext.junit.runners.AndroidJUnit4
import com.adaptizerplayer.rn.adaptiveaudio.AdaptiveAudioPackage
import com.adaptizerplayer.rn.adaptiveaudio.NativeAdaptiveAudioModule
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test
import org.junit.runner.RunWith

/** D03 availability and native-module lifecycle checks without media or sensors. */
@RunWith(AndroidJUnit4::class)
class D03AdaptiveAudioAvailabilityInstrumentedTest {
  @Test
  fun packageRegistersExpectedTurboModule() {
    val (_, module) = D03TestSupport.newAdaptiveAudioModule()
    val moduleInfo =
        AdaptiveAudioPackage()
            .getReactModuleInfoProvider()
            .getReactModuleInfos()[NativeAdaptiveAudioModule.NAME]

    assertEquals(NativeAdaptiveAudioModule.NAME, module.name)
    assertNotNull(moduleInfo)
    assertEquals(true, moduleInfo!!.isTurboModule)

    D03TestSupport.onMain { module.invalidate() }
  }

  @Test
  fun repeatedMountUnmountAndInvalidation_areIdempotent_withoutPhysicalSensors() {
    repeat(5) {
      val (_, module) = D03TestSupport.newAdaptiveAudioModule()

      D03TestSupport.onMain {
        module.onHostResume()
        module.onHostPause()
        module.onHostResume()
        module.onHostDestroy()
        module.invalidate()
        module.invalidate()
      }

      // The module registers a LifecycleEventListener in its constructor and
      // must be safe to invalidate after the host has already been destroyed.
    }
  }
}

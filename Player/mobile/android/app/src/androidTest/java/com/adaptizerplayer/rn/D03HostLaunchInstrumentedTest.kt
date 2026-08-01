package com.adaptizerplayer.rn

import android.content.Intent
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test
import org.junit.runner.RunWith

/**
 * D03 host smoke coverage.
 *
 * This deliberately verifies Android host lifecycle, not catalog/network
 * content. The React Native screen remains dependent on the JS bundle and
 * catalog endpoint; the B04 fixture preflight is the authoritative network
 * check and fails loudly when emulator-to-host networking is unavailable.
 */
@RunWith(AndroidJUnit4::class)
class D03HostLaunchInstrumentedTest {
  @Test
  fun launcherIntent_resolvesToMainActivity_andActivityCanLaunch() {
    val target = InstrumentationRegistry.getInstrumentation().targetContext
    val intent =
        target.packageManager.getLaunchIntentForPackage(target.packageName)
            ?: error("${target.packageName} must declare a launcher activity")

    assertEquals(Intent.ACTION_MAIN, intent.action)
    assertNotNull(intent.component)
    assertEquals(
        "com.adaptizerplayer.rn.MainActivity",
        intent.component!!.className,
    )

    ActivityScenario.launch<MainActivity>(intent).use { scenario ->
      scenario.onActivity { activity ->
        assertEquals(MainActivity::class.java, activity.javaClass)
      }
    }
  }

  @Test
  fun activityRecreation_survivesBackgroundForegroundLifecycle() {
    ActivityScenario.launch(MainActivity::class.java).use { scenario ->
      scenario.moveToState(androidx.lifecycle.Lifecycle.State.CREATED)
      scenario.moveToState(androidx.lifecycle.Lifecycle.State.RESUMED)
      scenario.recreate()
      scenario.moveToState(androidx.lifecycle.Lifecycle.State.CREATED)
      scenario.moveToState(androidx.lifecycle.Lifecycle.State.RESUMED)
    }
  }
}

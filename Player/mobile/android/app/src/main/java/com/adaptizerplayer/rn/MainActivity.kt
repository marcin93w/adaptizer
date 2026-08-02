package com.adaptizerplayer.rn

import android.os.Bundle
import android.view.View
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "AdaptizerPlayer"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    keepContentClearOfSystemBars()
  }

  /**
   * The app is edge-to-edge (forced anyway from Android 15, and Android 16 drops the opt-out), so
   * without this the header logo would sit under the status bar icons. React Native has no
   * cross-platform inset API to do it in JS: `SafeAreaView` is iOS-only and
   * `StatusBar.currentHeight` covers only the top.
   */
  private fun keepContentClearOfSystemBars() {
    // React Native derives this from the system light/dark setting, but the strip behind the
    // gesture pill is dark either way, so in light mode the pill would be dark-on-dark.
    WindowInsetsControllerCompat(window, window.decorView).isAppearanceLightNavigationBars = false

    val content = findViewById<View>(android.R.id.content)
    ViewCompat.setOnApplyWindowInsetsListener(content) { view, windowInsets ->
      val insets =
          windowInsets.getInsets(
              WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
      view.setPadding(insets.left, insets.top, insets.right, insets.bottom)
      // Unconsumed: React Native's `adjustResize` handling still needs the keyboard insets.
      windowInsets
    }
  }
}

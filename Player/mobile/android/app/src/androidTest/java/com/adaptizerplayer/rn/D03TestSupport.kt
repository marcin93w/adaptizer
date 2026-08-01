package com.adaptizerplayer.rn

import android.app.Application
import androidx.test.core.app.ApplicationProvider
import androidx.test.platform.app.InstrumentationRegistry
import com.facebook.react.bridge.Callback
import com.facebook.react.bridge.CatalystInstance
import com.facebook.react.bridge.JavaScriptContextHolder
import com.facebook.react.bridge.JavaScriptModule
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.UIManager
import com.adaptizerplayer.rn.adaptiveaudio.AdaptiveAudioPackage
import com.adaptizerplayer.rn.adaptiveaudio.NativeAdaptiveAudioModule
import com.facebook.react.turbomodule.core.interfaces.CallInvokerHolder

internal object D03TestSupport {
  fun application(): Application = ApplicationProvider.getApplicationContext()

  fun newAdaptiveAudioModule(): Pair<ReactApplicationContext, NativeAdaptiveAudioModule> {
    val reactContext = TestReactApplicationContext(application())
    val module =
        requireNotNull(AdaptiveAudioPackage().getModule(NativeAdaptiveAudioModule.NAME, reactContext)) {
          "AdaptiveAudioPackage must register ${NativeAdaptiveAudioModule.NAME}"
        } as NativeAdaptiveAudioModule
    return reactContext to module
  }

  fun onMain(block: () -> Unit) {
    InstrumentationRegistry.getInstrumentation().runOnMainSync(block)
    InstrumentationRegistry.getInstrumentation().waitForIdleSync()
  }

  /** Minimal context implementation for module lifecycle tests without a JS runtime. */
  @Suppress("DEPRECATION")
  private class TestReactApplicationContext(application: Application) :
      ReactApplicationContext(application) {
    override fun <T : JavaScriptModule> getJSModule(jsInterface: Class<T>): T? = null

    override fun <T : NativeModule> hasNativeModule(nativeModuleInterface: Class<T>): Boolean = false

    override fun getNativeModules(): Collection<NativeModule> = emptyList()

    override fun <T : NativeModule> getNativeModule(nativeModuleInterface: Class<T>): T? = null

    override fun getNativeModule(moduleName: String): NativeModule? = null

    override fun getCatalystInstance(): CatalystInstance =
        error("D03 test context has no CatalystInstance")

    override fun hasActiveCatalystInstance(): Boolean = false

    override fun hasActiveReactInstance(): Boolean = false

    override fun hasCatalystInstance(): Boolean = false

    override fun hasReactInstance(): Boolean = false

    override fun destroy() = Unit

    override fun handleException(exception: Exception): Unit = throw exception

    override fun isBridgeless(): Boolean = false

    override fun getJavaScriptContextHolder(): JavaScriptContextHolder? = null

    override fun getJSCallInvokerHolder(): CallInvokerHolder? = null

    override fun getFabricUIManager(): UIManager? = null

    override fun getSourceURL(): String? = null

    override fun registerSegment(segmentId: Int, path: String, callback: Callback) = Unit
  }
}

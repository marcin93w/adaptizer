package com.adaptizerplayer.rn.adaptiveaudio

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import com.facebook.react.uimanager.ViewManager

/** Manual registration is intentional until this local package is published/autolinked. */
class AdaptiveAudioPackage : BaseReactPackage() {
  override fun getModule(
      name: String,
      reactContext: ReactApplicationContext,
  ): NativeModule? =
      if (name == NativeAdaptiveAudioModule.NAME) {
        NativeAdaptiveAudioModule(reactContext)
      } else {
        null
      }

  override fun createViewManagers(
      reactContext: ReactApplicationContext,
  ): List<ViewManager<*, *>> = emptyList()

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider =
      ReactModuleInfoProvider {
        mapOf(
            NativeAdaptiveAudioModule.NAME to
                ReactModuleInfo(
                    NativeAdaptiveAudioModule.NAME,
                    NativeAdaptiveAudioModule::class.java.name,
                    false,
                    false,
                    false,
                    true,
                ))
      }
}

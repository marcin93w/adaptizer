plugins {
    // Use plugin IDs instead of versioned catalog aliases so this module can
    // be included by both the legacy Player build and the RN host build. Each
    // root build supplies the plugin versions on its own classpath.
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.adaptizerplayer.adaptiveaudio"
    compileSdk = 35

    // The RN host's AGP toolchain compiles Java sources for 17, while the
    // standalone legacy build remains on 11. Keep both consumers valid while
    // this module is shared as a local project dependency.
    val javaTarget =
        if (rootProject.name == "com.adaptizerplayer.rn") JavaVersion.VERSION_17
        else JavaVersion.VERSION_11

    defaultConfig {
        minSdk = 24

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    compileOptions {
        sourceCompatibility = javaTarget
        targetCompatibility = javaTarget
    }
    kotlinOptions {
        jvmTarget = javaTarget.toString()
    }

    testOptions {
        unitTests {
            isIncludeAndroidResources = true
        }
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.kotlinx.coroutines.android)
    // AdaptiveAudioEngine's public listener/player surface exposes Media3
    // types, so these must be API dependencies for bridge consumers.
    api(libs.androidx.media3.exoplayer)
    api(libs.androidx.media3.exoplayer.dash)

    testImplementation(libs.junit)
    // Robolectric lets these tests exercise real Context/AudioManager/
    // SensorManager behavior (receiver registration, stream volume shadows,
    // sensor availability) on the plain JVM, without an emulator/device.
    testImplementation(libs.robolectric)

    // B04: instrumentation (device/emulator) tests characterizing real Media3/ExoPlayer behavior
    // against the D02 DASH fixture - see src/androidTest and test-media/README.md. These need a
    // real ExoPlayer + DashMediaSource + Looper, which Robolectric does not faithfully provide.
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.test.runner)
    androidTestImplementation(libs.androidx.media3.exoplayer)
    androidTestImplementation(libs.androidx.media3.exoplayer.dash)
}

plugins {
    // Use plugin IDs instead of versioned catalog aliases so this module can
    // be included by both the standalone Player build and the RN host build.
    // Each root build supplies the plugin versions on its own classpath.
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.adaptizerplayer.adaptiveaudio"
    compileSdk = 35

    // Matches the RN host's AGP toolchain, which compiles Java sources for 17.
    val javaTarget = JavaVersion.VERSION_17

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
    // Robolectric lets the input tests exercise real (shadowed)
    // Context/AudioManager behavior - receiver registration, stream volume -
    // on the plain JVM, without an emulator/device. The dimension resolver's
    // own tests need none of it and touch nothing Android.
    testImplementation(libs.robolectric)

    // Instrumentation (device/emulator) tests characterizing real Media3/ExoPlayer behavior
    // against the deterministic DASH fixture - see src/androidTest and test-media/README.md.
    // These need a real ExoPlayer + DashMediaSource + Looper, which Robolectric does not
    // faithfully provide.
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.test.runner)
    androidTestImplementation(libs.androidx.media3.exoplayer)
    androidTestImplementation(libs.androidx.media3.exoplayer.dash)
}

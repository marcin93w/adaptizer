plugins {
    alias(libs.plugins.android.library)
    alias(libs.plugins.kotlin.android)
}

android {
    namespace = "com.adaptizerplayer.adaptiveaudio"
    compileSdk = 35

    defaultConfig {
        minSdk = 24

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
    kotlinOptions {
        jvmTarget = "11"
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
    implementation(libs.androidx.media3.exoplayer)
    implementation(libs.androidx.media3.exoplayer.dash)

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

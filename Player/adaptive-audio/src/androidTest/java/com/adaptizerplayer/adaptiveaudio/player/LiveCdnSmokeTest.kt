package com.adaptizerplayer.adaptiveaudio.player

import android.content.Context
import androidx.media3.common.C
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference

/**
 * B04 requirement 8: one opt-in smoke test against the *real* production manifest, kept out of
 * ordinary `connectedAndroidTest` runs.
 *
 * Exclusion mechanism: [assumeOptedIn] reads the `runLiveCdnTests` instrumentation-runner
 * argument via [InstrumentationRegistry.getArguments] and calls `Assume.assumeTrue`. A plain
 * `connectedAndroidTest` run passes no such argument, so this resolves to `false` and every test
 * in this class is reported as *skipped* (JUnit `AssumptionViolatedException`), not run and not
 * failed. The [LiveCdn] annotation on the test method is documentation only - see its own doc
 * comment for why a bare JUnit4 annotation cannot itself skip a test.
 *
 * To opt in:
 * ```
 * gradlew.bat :adaptive-audio:connectedDebugAndroidTest \
 *   -Pandroid.testInstrumentationRunnerArguments.class=com.adaptizerplayer.adaptiveaudio.player.LiveCdnSmokeTest \
 *   -Pandroid.testInstrumentationRunnerArguments.runLiveCdnTests=true
 * ```
 * (The `...runnerArguments.class=...` filter is optional but keeps the run to just this test;
 * `runLiveCdnTests=true` is the required opt-in.)
 */
@RunWith(AndroidJUnit4::class)
class LiveCdnSmokeTest {

    companion object {
        private const val ARG_ENABLE_LIVE_CDN = "runLiveCdnTests"
        private const val LIVE_MANIFEST_URL =
            "https://pub-fb297744d1fd4584a256f702d29363a8.r2.dev/Sample/manifest.mpd"
        private const val READY_TIMEOUT_SECONDS = 30L
    }

    private lateinit var context: Context
    private var engine: AdaptiveAudioEngine? = null

    @Before
    fun assumeOptedIn() {
        val enabled = InstrumentationRegistry.getArguments()
            .getString(ARG_ENABLE_LIVE_CDN)
            ?.toBoolean() ?: false
        assumeTrue(
            "Live-CDN smoke test skipped by default (this is expected for ordinary " +
                "connectedAndroidTest runs). Opt in with " +
                "-Pandroid.testInstrumentationRunnerArguments.$ARG_ENABLE_LIVE_CDN=true.",
            enabled
        )
        context = ApplicationProvider.getApplicationContext()
    }

    @After
    fun tearDown() {
        val e = engine ?: return
        InstrumentationRegistry.getInstrumentation().runOnMainSync { e.release() }
    }

    @LiveCdn
    @Test
    fun prepareAgainstProductionManifest_reachesReadyState_withTenAudioTracks() {
        val readyLatch = CountDownLatch(1)
        val errorLatch = CountDownLatch(1)
        val errorRef = AtomicReference<PlaybackException?>()

        val listener = object : AdaptiveAudioListener {
            override fun onPlaybackStateChanged(playbackState: Int) {
                if (playbackState == Player.STATE_READY) readyLatch.countDown()
            }

            override fun onPlayerError(error: PlaybackException) {
                errorRef.set(error)
                errorLatch.countDown()
                readyLatch.countDown()
            }
        }

        val e = AdaptiveAudioEngine(context)
        engine = e
        InstrumentationRegistry.getInstrumentation().runOnMainSync {
            e.addListener(listener)
            e.initialize(0)
            e.prepare(LIVE_MANIFEST_URL)
        }

        val completed = readyLatch.await(READY_TIMEOUT_SECONDS, TimeUnit.SECONDS)
        val err = errorRef.get()
        if (err != null) {
            fail("expected STATE_READY against the live production manifest but got onPlayerError: ${err.errorCodeName}: ${err.message}")
        }
        assertTrue("did not reach STATE_READY against the live production manifest within ${READY_TIMEOUT_SECONDS}s (network required)", completed)

        val audioGroupLengths = AtomicReference<List<Int>>(emptyList())
        InstrumentationRegistry.getInstrumentation().runOnMainSync {
            audioGroupLengths.set(
                e.player?.currentTracks?.groups
                    ?.filter { it.type == C.TRACK_TYPE_AUDIO }
                    ?.map { it.length }
                    .orEmpty()
            )
        }

        assertEquals(
            "expected exactly one audio track group of length 10 in the live production manifest",
            listOf(10),
            audioGroupLengths.get()
        )
    }
}

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
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Before
import org.junit.BeforeClass
import org.junit.Test
import org.junit.runner.RunWith
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference
import kotlin.math.abs

/**
 * Characterization tests: lock down real Media3/ExoPlayer behavior of [AdaptiveAudioEngine]
 * against the deterministic fixture (`test-media/`, docs at `test-media/README.md`). See
 * docs/adaptive-audio.md sections 4 (manifest contract) and 5 (queue invalidation) for the
 * behavior these tests pin down.
 *
 * Fixture access: these tests hit `test-media/serve.py` over real HTTP
 * (`http://10.0.2.2:8099`, `10.0.2.2` being the emulator's alias for the host loopback interface)
 * rather than bundling the fixture as an `asset:///` and adding a DataSource.Factory seam to
 * [AdaptiveAudioEngine.prepare]. This is deliberate: it exercises the exact same
 * `DefaultHttpDataSource` + `DashMediaSource` code path as production, including the fixture's
 * `SegmentBase`/`indexRange` byte-range addressing (the same addressing family production uses,
 * see test-media/README.md), and it requires zero changes to `prepare()`. The cost is an external
 * process dependency: the server must be started before `connectedAndroidTest`
 * (`python test-media/serve.py --port 8099 --dir test-media`, run from `Player/`) and stopped
 * after. [checkFixtureServerReachable] makes an unreachable server a loud class-level failure
 * rather than a silent skip.
 */
@RunWith(AndroidJUnit4::class)
class AdaptiveAudioEngineInstrumentedTest {

    companion object {
        private const val FIXTURE_BASE_URL = "http://10.0.2.2:8099"
        private const val MANIFEST_URL = "$FIXTURE_BASE_URL/dash/manifest.mpd"
        private const val MALFORMED_NOT_XML_URL = "$FIXTURE_BASE_URL/malformed/not-xml.mpd"
        private const val MALFORMED_TOO_FEW_URL = "$FIXTURE_BASE_URL/malformed/too-few-representations.mpd"

        private const val READY_TIMEOUT_SECONDS = 20L
        private const val ERROR_TIMEOUT_SECONDS = 20L

        /**
         * Tolerance for asserting the reported playback position after [AdaptiveAudioEngine.seekTo].
         * 500ms comfortably covers ExoPlayer's async seek-completion and position-reporting
         * granularity against this ~6s fixture without masking a real seek defect.
         */
        private const val SEEK_TOLERANCE_MS = 500L

        /**
         * Fails the whole test class loudly - NOT a skip - if the fixture HTTP server is not
         * reachable. An unreachable fixture here means the test environment is mis-set-up (server
         * not started, wrong port, emulator networking broken), not that this behavior is
         * inapplicable, so it must surface as a failure rather than silently passing zero tests.
         */
        @BeforeClass
        @JvmStatic
        fun checkFixtureServerReachable() {
            try {
                val connection = URL(MANIFEST_URL).openConnection() as HttpURLConnection
                connection.connectTimeout = 5000
                connection.readTimeout = 5000
                connection.requestMethod = "GET"
                val code = connection.responseCode
                connection.disconnect()
                if (code != 200) {
                    throw AssertionError(
                        "Fixture HTTP server at $FIXTURE_BASE_URL returned HTTP $code for " +
                            "$MANIFEST_URL; expected 200. Is test-media/serve.py serving " +
                            "--dir test-media (the parent of dash/ and malformed/)?"
                    )
                }
            } catch (e: IOException) {
                throw AssertionError(
                    "Cannot reach fixture HTTP server at $FIXTURE_BASE_URL from this test " +
                        "process. Start it before running connectedAndroidTest: " +
                        "'python test-media/serve.py --port 8099 --dir test-media' (from Player/), " +
                        "which must be reachable from the emulator via 10.0.2.2. " +
                        "Underlying error: ${e.javaClass.simpleName}: ${e.message}",
                    e
                )
            }
        }
    }

    private lateinit var context: Context
    private val trackedEngines = mutableListOf<AdaptiveAudioEngine>()

    @Before
    fun setUp() {
        context = ApplicationProvider.getApplicationContext()
    }

    @After
    fun tearDown() {
        // release() is idempotent (AdaptiveAudioEngine.kt) so this is safe even for engines a
        // test already released itself.
        runOnMain { trackedEngines.forEach { it.release() } }
        trackedEngines.clear()
    }

    // ---------------------------------------------------------------------------------------
    // Main-thread helpers. AdaptiveAudioEngine enforces main-thread confinement on every public
    // member (checkMainThread()); ExoPlayer callbacks are asynchronous, so waits use a
    // latch/poll pattern with a bounded timeout rather than Thread.sleep.
    // ---------------------------------------------------------------------------------------

    private fun runOnMain(block: () -> Unit) {
        InstrumentationRegistry.getInstrumentation().runOnMainSync(block)
    }

    private fun <T> callOnMain(block: () -> T): T {
        val ref = AtomicReference<T>()
        InstrumentationRegistry.getInstrumentation().runOnMainSync { ref.set(block()) }
        @Suppress("UNCHECKED_CAST")
        return ref.get()
    }

    private class ReadyOrErrorObserver {
        /** Counts down on the first STATE_READY *or* the first onPlayerError, whichever is first. */
        val outcomeLatch = CountDownLatch(1)
        val errorLatch = CountDownLatch(1)
        val error = AtomicReference<PlaybackException?>()

        val listener = object : AdaptiveAudioListener {
            override fun onPlaybackStateChanged(playbackState: Int) {
                if (playbackState == Player.STATE_READY) outcomeLatch.countDown()
            }

            override fun onPlayerError(error: PlaybackException) {
                this@ReadyOrErrorObserver.error.set(error)
                errorLatch.countDown()
                outcomeLatch.countDown()
            }
        }
    }

    private sealed class Outcome {
        object Ready : Outcome()
        data class Error(val error: PlaybackException) : Outcome()
        object TimedOut : Outcome()
    }

    /** Creates + initializes + prepares an engine against [uri]; does not wait for an outcome. */
    private fun newSession(initialTrackIndex: Int, uri: String): Pair<AdaptiveAudioEngine, ReadyOrErrorObserver> {
        val engine = AdaptiveAudioEngine(context)
        trackedEngines += engine
        val observer = ReadyOrErrorObserver()
        runOnMain {
            engine.addListener(observer.listener)
            engine.initialize(initialTrackIndex)
            engine.prepare(uri)
        }
        return engine to observer
    }

    private fun awaitOutcome(observer: ReadyOrErrorObserver, timeoutSeconds: Long = READY_TIMEOUT_SECONDS): Outcome {
        val completed = observer.outcomeLatch.await(timeoutSeconds, TimeUnit.SECONDS)
        if (!completed) return Outcome.TimedOut
        val err = observer.error.get()
        return if (err != null) Outcome.Error(err) else Outcome.Ready
    }

    /** [newSession] + assert it reaches STATE_READY (fails loudly with the error otherwise). */
    private fun newReadySession(initialTrackIndex: Int, uri: String = MANIFEST_URL): Pair<AdaptiveAudioEngine, ReadyOrErrorObserver> {
        val (engine, observer) = newSession(initialTrackIndex, uri)
        when (val outcome = awaitOutcome(observer)) {
            is Outcome.Ready -> Unit
            is Outcome.Error -> fail(
                "expected STATE_READY for initial index $initialTrackIndex on $uri but got " +
                    "onPlayerError: ${outcome.error.errorCodeName} (${outcome.error.message})"
            )
            Outcome.TimedOut -> fail(
                "did not reach STATE_READY or onPlayerError within ${READY_TIMEOUT_SECONDS}s " +
                    "for initial index $initialTrackIndex on $uri"
            )
        }
        return engine to observer
    }

    // ---------------------------------------------------------------------------------------
    // 1. Manifest preparation
    // ---------------------------------------------------------------------------------------

    @Test
    fun manifestPreparation_reachesReadyState_withExactlyTenAudioTracks() {
        val (engine, _) = newReadySession(initialTrackIndex = 0)

        val audioGroupLengths = callOnMain {
            engine.player?.currentTracks?.groups
                ?.filter { it.type == C.TRACK_TYPE_AUDIO }
                ?.map { it.length }
                .orEmpty()
        }

        assertEquals(
            "expected exactly one audio track group of length 10",
            listOf(10),
            audioGroupLengths
        )
    }

    // ---------------------------------------------------------------------------------------
    // 2. Initial index
    // ---------------------------------------------------------------------------------------

    @Test
    fun initialIndex_engineStartsOnRequestedRepresentation() {
        for (index in listOf(0, 4, 9)) {
            val (engine, _) = newReadySession(initialTrackIndex = index)
            val selected = callOnMain { engine.selectedTrackIndex }
            assertEquals("selected index right after prepare for initialTrackIndex=$index", index, selected)
        }
    }

    // ---------------------------------------------------------------------------------------
    // 3. Requested -> selected index for 0, 4 and 9
    // ---------------------------------------------------------------------------------------

    @Test
    fun changeTrack_selectedIndexMatchesRequestedIndex_for0_4_and9() {
        // Start away from all three targets so each changeTrack() call is a genuine change (see
        // AdaptizerTrackSelector.changeTrack's no-op-when-unchanged guard).
        val (engine, observer) = newReadySession(initialTrackIndex = 2)

        for (target in listOf(0, 4, 9)) {
            runOnMain { engine.changeTrack(target) }
            val selected = callOnMain { engine.selectedTrackIndex }
            assertEquals("AdaptizerTrackSelection.getSelectedIndex() after changeTrack($target)", target, selected)
        }

        assertNull("no player error expected for in-range track changes", observer.error.get())
    }

    // ---------------------------------------------------------------------------------------
    // 5. Out-of-range handling
    //
    // Before the index validation, these requests installed INDEX_UNSET into
    // AdaptizerTrackSelection and could
    // later fail asynchronously inside Media3. The minimal hardening validates the fixed 0..9
    // contract before mutating selector state and returns a stable typed exception instead.
    // ---------------------------------------------------------------------------------------

    @Test
    fun changeTrack_outOfRangeIndex10_returnsTypedError() = assertOutOfRangeIndexReturnsTypedError(10)

    @Test
    fun changeTrack_outOfRangeIndexNegativeOne_returnsTypedError() = assertOutOfRangeIndexReturnsTypedError(-1)

    @Test
    fun changeTrack_outOfRangeIndex999_returnsTypedError() = assertOutOfRangeIndexReturnsTypedError(999)

    private fun assertOutOfRangeIndexReturnsTypedError(badIndex: Int) {
        val (engine, observer) = newReadySession(initialTrackIndex = 0)

        val error = assertThrows(AdaptiveAudioUnsupportedTrackException::class.java) {
            runOnMain { engine.changeTrack(badIndex) }
        }
        assertEquals(badIndex, error.requestedIndex)
        assertEquals(10, error.availableTrackCount)
        assertEquals("a rejected request must not change selection", 0, callOnMain { engine.selectedTrackIndex })
        assertNull("a rejected request must not poison ExoPlayer", observer.error.get())
    }

    // ---------------------------------------------------------------------------------------
    // 6. Malformed manifest -> typed PlaybackException, not an index exception
    // ---------------------------------------------------------------------------------------

    @Test
    fun prepare_notXmlManifest_surfacesTypedPlayerError() {
        val (_, observer) = newSession(initialTrackIndex = 0, uri = MALFORMED_NOT_XML_URL)

        when (val outcome = awaitOutcome(observer, ERROR_TIMEOUT_SECONDS)) {
            is Outcome.Error -> assertTrue(
                "expected a PlaybackException for not-xml.mpd, got ${outcome.error}",
                outcome.error is PlaybackException
            )
            Outcome.Ready -> fail("expected onPlayerError for not-xml.mpd but reached STATE_READY")
            Outcome.TimedOut -> fail("expected onPlayerError for not-xml.mpd within ${ERROR_TIMEOUT_SECONDS}s, got neither ready nor error")
        }
    }

    /**
     * The important case: a structurally valid manifest whose audio AdaptationSet has only 3
     * Representations, directly exercising the ten-representation manifest contract
     * (docs/adaptive-audio.md section 4).
     *
     * [AdaptizerTrackSelector] validates the count before constructing BaseTrackSelection, so
     * Media3 reports a PlaybackException whose cause chain includes
     * [AdaptiveAudioManifestException], rather than an incidental
     * ArrayIndexOutOfBoundsException from TrackGroup.getFormat().
     */
    @Test
    fun prepare_tooFewRepresentationsManifest_surfacesTypedPlayerError_notArrayIndexException() {
        val (_, observer) = newSession(initialTrackIndex = 0, uri = MALFORMED_TOO_FEW_URL)

        when (val outcome = awaitOutcome(observer, ERROR_TIMEOUT_SECONDS)) {
            is Outcome.Error -> {
                assertTrue(
                    "expected AdaptiveAudioManifestException in cause chain, got ${outcome.error}",
                    outcome.error.hasCause<AdaptiveAudioManifestException>()
                )
                assertTrue(
                    "short-manifest failure must not contain ArrayIndexOutOfBoundsException",
                    !outcome.error.hasCause<ArrayIndexOutOfBoundsException>()
                )
            }
            Outcome.Ready -> fail(
                "expected onPlayerError for too-few-representations.mpd (hard-coded ten-track " +
                    "overrun) but reached STATE_READY instead"
            )
            Outcome.TimedOut -> fail(
                "expected onPlayerError for too-few-representations.mpd within " +
                    "${ERROR_TIMEOUT_SECONDS}s, got neither ready nor error"
            )
        }
    }

    // ---------------------------------------------------------------------------------------
    // 7. Stable playback position after seekTo
    // ---------------------------------------------------------------------------------------

    @Test
    fun changeTrack_preservesSeekedPositionWithinTolerance() {
        val (engine, _) = newReadySession(initialTrackIndex = 0)
        val targetMs = 2000L

        runOnMain {
            engine.seekTo(targetMs)
            engine.changeTrack(4)
        }

        // ExoPlayer applies seeks asynchronously; poll the bounded window below instead of a
        // single fixed Thread.sleep, so the test finishes as soon as the position settles.
        val deadline = System.currentTimeMillis() + TimeUnit.SECONDS.toMillis(10)
        var lastPositionMs = -1L
        while (System.currentTimeMillis() < deadline) {
            lastPositionMs = callOnMain { engine.currentPositionMs }
            if (abs(lastPositionMs - targetMs) <= SEEK_TOLERANCE_MS) break
            Thread.sleep(100)
        }

        assertTrue(
            "expected reported position within ${SEEK_TOLERANCE_MS}ms of ${targetMs}ms, was ${lastPositionMs}ms",
            abs(lastPositionMs - targetMs) <= SEEK_TOLERANCE_MS
        )
    }

    private inline fun <reified T : Throwable> Throwable.hasCause(): Boolean {
        var current: Throwable? = this
        while (current != null) {
            if (current is T) return true
            current = current.cause
        }
        return false
    }
}

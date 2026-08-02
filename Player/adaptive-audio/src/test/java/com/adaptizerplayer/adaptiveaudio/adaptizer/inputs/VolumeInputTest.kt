package com.adaptizerplayer.adaptiveaudio.adaptizer.inputs

import android.app.Application
import android.content.Context
import android.content.Intent
import android.media.AudioManager
import android.os.Looper
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf

/**
 * Robolectric tests exercising VolumeInput against real (shadowed)
 * Context/AudioManager broadcast-receiver behavior on the JVM. These pin down
 * the lifecycle contract: receiver ownership, idempotent initialize()/
 * release(), and registration-order independence with Adaptizer -- without
 * changing the volume normalization formula itself (see the dedicated
 * formula test below, which must keep passing unchanged).
 */
@RunWith(RobolectricTestRunner::class)
class VolumeInputTest {

    // Mirrors the private constant inside VolumeInput. Duplicated here
    // deliberately: the test must observe the real broadcast action string
    // VolumeInput registers for, independent of its internal implementation.
    private val volumeChangedAction = "android.media.VOLUME_CHANGED_ACTION"

    private lateinit var context: Application
    private lateinit var audioManager: AudioManager
    private lateinit var volumeInput: VolumeInput

    @Before
    fun setUp() {
        context = RuntimeEnvironment.getApplication()
        audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        volumeInput = VolumeInput(context)
    }

    /**
     * A dynamically registered receiver with no explicit Handler is, on a
     * real device, delivered its broadcast via a post to the main looper -
     * it is not synchronous. Robolectric models that faithfully, so tests
     * that send a broadcast and expect the receiver to have run must idle
     * the shadow main looper first.
     */
    private fun sendBroadcastAndFlush(action: String) {
        context.sendBroadcast(Intent(action))
        shadowOf(Looper.getMainLooper()).idle()
    }

    private fun registeredReceiverCountForVolumeAction(): Int {
        return shadowOf(context).registeredReceivers.count { registered ->
            val filter = registered.intentFilter
            (0 until filter.countActions()).any { i -> filter.getAction(i) == volumeChangedAction }
        }
    }

    @Test
    fun `initialize registers exactly one receiver for the volume-changed action`() {
        volumeInput.initialize()

        assertEquals(1, registeredReceiverCountForVolumeAction())
    }

    @Test
    fun `release unregisters the receiver so it does not leak`() {
        volumeInput.initialize()
        volumeInput.release()

        assertEquals(0, registeredReceiverCountForVolumeAction())
    }

    @Test
    fun `repeated initialize-release cycles leak no receiver`() {
        repeat(3) { cycle ->
            volumeInput.initialize()
            assertEquals("cycle $cycle after initialize", 1, registeredReceiverCountForVolumeAction())

            volumeInput.release()
            assertEquals("cycle $cycle after release", 0, registeredReceiverCountForVolumeAction())
        }
    }

    @Test
    fun `release before initialize does not throw`() {
        // Must not throw. If it did, this test would fail with an exception.
        volumeInput.release()

        assertEquals(0, registeredReceiverCountForVolumeAction())
    }

    @Test
    fun `release called twice does not throw and stays unregistered`() {
        volumeInput.initialize()
        volumeInput.release()
        volumeInput.release()

        assertEquals(0, registeredReceiverCountForVolumeAction())
    }

    @Test
    fun `initialize called twice does not double-register`() {
        volumeInput.initialize()
        volumeInput.initialize()

        assertEquals(1, registeredReceiverCountForVolumeAction())

        // And a single release() still fully unregisters it.
        volumeInput.release()
        assertEquals(0, registeredReceiverCountForVolumeAction())
    }

    @Test
    fun `registerChangeListener called after initialize still delivers callbacks - registration order independence`() {
        // Mirrors the real call order in MainActivity + Adaptizer: MainActivity
        // calls inputs.forEach { it.initialize() } first, and only afterwards
        // does Adaptizer.onStateChange { ... } call registerChangeListener(...).
        volumeInput.initialize()

        var callbackCount = 0
        volumeInput.registerChangeListener { callbackCount++ }

        sendBroadcastAndFlush(volumeChangedAction)

        assertEquals(1, callbackCount)
    }

    @Test
    fun `registerChangeListener called before initialize still delivers callbacks`() {
        var callbackCount = 0
        volumeInput.registerChangeListener { callbackCount++ }

        volumeInput.initialize()

        sendBroadcastAndFlush(volumeChangedAction)

        assertEquals(1, callbackCount)
    }

    @Test
    fun `broadcasts after release no longer invoke the listener`() {
        var callbackCount = 0
        volumeInput.registerChangeListener { callbackCount++ }
        volumeInput.initialize()

        sendBroadcastAndFlush(volumeChangedAction)
        assertEquals(1, callbackCount)

        volumeInput.release()

        sendBroadcastAndFlush(volumeChangedAction)
        assertEquals("no further callbacks after release", 1, callbackCount)
    }

    // --- Behavior-preservation: normalization maths must not change. ---

    @Test
    fun `volume normalization matches (currentVolume times 10) integer-divided by (maxVolume plus 1)`() {
        val shadowAudioManager = shadowOf(audioManager)

        // (currentVolume, maxVolume, expected)
        val cases = listOf(
            Triple(0, 15, 0),
            Triple(7, 15, 4),
            Triple(15, 15, 9),
            Triple(3, 9, 3),
            Triple(9, 9, 9),
            Triple(0, 0, 0)
        )

        for ((current, max, expected) in cases) {
            shadowAudioManager.setStreamMaxVolume(max)
            audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, current, 0)

            assertEquals(
                "current=$current max=$max",
                expected,
                volumeInput.getCurrentValue()
            )
        }
    }
}

package com.adaptizerplayer.adaptiveaudio.adaptizer

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Fake AdaptizerInput used to drive Adaptizer without any Android framework
 * dependency, so these tests run on a plain JVM.
 */
private class FakeAdaptizerInput(initialValue: Int = 0) : AdaptizerInput {
    var value: Int = initialValue
    private var changeListener: (() -> Unit)? = null
    var initializeCallCount = 0
        private set
    var releaseCallCount = 0
        private set

    override fun getCurrentValue(): Int = value

    override fun registerChangeListener(listener: () -> Unit) {
        changeListener = listener
    }

    override fun initialize() {
        initializeCallCount++
    }

    override fun release() {
        releaseCallCount++
    }

    /** Simulates the underlying sensor/system firing its change notification. */
    fun fireChange() {
        changeListener?.invoke()
    }
}

class AdaptizerTest {

    @Test
    fun `getTrackIndex returns the combined intensity of both inputs`() {
        val volumeInput = FakeAdaptizerInput(8)
        val accelerometerInput = FakeAdaptizerInput(4)
        val adaptizer = Adaptizer(volumeInput, accelerometerInput)

        // 8*0.75 + 4*0.25 = 7
        assertEquals(7, adaptizer.getTrackIndex())
    }

    @Test
    fun `onStateChange callback fires when the volume input listener fires`() {
        val volumeInput = FakeAdaptizerInput(0)
        val accelerometerInput = FakeAdaptizerInput(0)
        val adaptizer = Adaptizer(volumeInput, accelerometerInput)

        var callbackCount = 0
        adaptizer.onStateChange { callbackCount++ }

        volumeInput.fireChange()

        assertEquals(1, callbackCount)
    }

    @Test
    fun `onStateChange callback fires when the accelerometer input listener fires`() {
        val volumeInput = FakeAdaptizerInput(0)
        val accelerometerInput = FakeAdaptizerInput(0)
        val adaptizer = Adaptizer(volumeInput, accelerometerInput)

        var callbackCount = 0
        adaptizer.onStateChange { callbackCount++ }

        accelerometerInput.fireChange()

        assertEquals(1, callbackCount)
    }

    @Test
    fun `onStateChange callback receives the current state at the time each input fires`() {
        val volumeInput = FakeAdaptizerInput(2)
        val accelerometerInput = FakeAdaptizerInput(0)
        val adaptizer = Adaptizer(volumeInput, accelerometerInput)

        val observedIntensities = mutableListOf<Int>()
        adaptizer.onStateChange { state -> observedIntensities.add(state.intensity) }

        volumeInput.fireChange()

        accelerometerInput.value = 8
        accelerometerInput.fireChange()

        // First firing: volume=2, acceleration=0 -> round(1.5) -> even tie -> 2
        // Second firing: volume=2, acceleration=8 -> round(1.5 + 2) = round(3.5) -> even tie -> 4
        assertEquals(listOf(2, 4), observedIntensities)
    }

    @Test
    fun `state read is live - changing a fake input value changes the next getTrackIndex result`() {
        val volumeInput = FakeAdaptizerInput(0)
        val accelerometerInput = FakeAdaptizerInput(0)
        val adaptizer = Adaptizer(volumeInput, accelerometerInput)

        assertEquals(0, adaptizer.getTrackIndex())

        volumeInput.value = 4
        accelerometerInput.value = 4

        // 4*0.75 + 4*0.25 = 4, and this must reflect the updated fake values,
        // proving getTrackIndex() re-reads the inputs rather than caching state.
        assertEquals(4, adaptizer.getTrackIndex())
    }

    @Test
    fun `getDebugOutput reports intensity volume and acceleration currently held by the inputs`() {
        val volumeInput = FakeAdaptizerInput(8)
        val accelerometerInput = FakeAdaptizerInput(4)
        val adaptizer = Adaptizer(volumeInput, accelerometerInput)

        assertEquals("Intensity: 7 (Vol: 8, Acc: 4)", adaptizer.getDebugOutput())
    }

    @Test
    fun `Adaptizer only depends on the AdaptizerInput interface, not concrete input types`() {
        // This test exists to pin the constructor signature: both parameters
        // accept any AdaptizerInput, not just VolumeInput/AccelerometerInput.
        val anyInput: AdaptizerInput = FakeAdaptizerInput(0)
        val adaptizer = Adaptizer(anyInput, anyInput)

        assertFalse(adaptizer.getDebugOutput().isEmpty())
        assertTrue(adaptizer.getTrackIndex() >= 0)
    }
}

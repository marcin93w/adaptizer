package com.adaptizerplayer.adaptiveaudio.adaptizer

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Fake AdaptizerInput used to drive Adaptizer without any Android framework
 * dependency, so these tests run on a plain JVM.
 *
 * It holds the input contract honestly: getCurrentValue() throws while the
 * input is unavailable, so any caller that reads a reading it was not entitled
 * to fails the test rather than silently getting a stale number. Both a new
 * measurement and an availability flip fire the one change notification, which
 * is exactly what a real input must do.
 */
private class FakeAdaptizerInput(
    initialValue: Int = 0,
    initiallyAvailable: Boolean = true
) : AdaptizerInput {

    override var isAvailable: Boolean = initiallyAvailable
        private set

    private var value: Int = initialValue
    private var changeListener: () -> Unit = {}

    var initializeCallCount = 0
        private set
    var releaseCallCount = 0
        private set

    override fun getCurrentValue(): Int {
        check(isAvailable) { "getCurrentValue() was read while the input was unavailable" }
        return value
    }

    override fun registerChangeListener(listener: () -> Unit) {
        changeListener = listener
    }

    override fun initialize() {
        initializeCallCount++
    }

    override fun release() {
        releaseCallCount++
    }

    /** Simulates a fresh measurement arriving from the underlying signal. */
    fun measure(newValue: Int) {
        value = newValue
        changeListener()
    }

    /** Simulates the signal appearing or disappearing mid-session. */
    fun setAvailable(available: Boolean) {
        isAvailable = available
        changeListener()
    }
}

/**
 * The whole resolver, exercised through the input seam with fakes: all four
 * dimensions, the hold-at-5 rule, aggregate renormalization, the one-member
 * aggregate, and availability flipping mid-session. Nothing here touches
 * Android.
 */
class AdaptizerTest {

    // --- Single dimensions ---------------------------------------------------

    @Test
    fun `the volume dimension is the volume input's reading`() {
        val volume = FakeAdaptizerInput(7)

        val adaptizer = Adaptizer(volume)

        assertEquals(7, adaptizer.resolve(Dimensions.VOLUME))
    }

    @Test
    fun `the heart rate dimension is the heart rate input's reading`() {
        val heartRate = FakeAdaptizerInput(3)

        val adaptizer = Adaptizer(FakeAdaptizerInput(9), heartRateInput = heartRate)

        assertEquals(3, adaptizer.resolve(Dimensions.HEART_RATE))
    }

    @Test
    fun `the movement speed dimension is the movement speed input's reading`() {
        val movementSpeed = FakeAdaptizerInput(6)

        val adaptizer = Adaptizer(FakeAdaptizerInput(9), movementSpeedInput = movementSpeed)

        assertEquals(6, adaptizer.resolve(Dimensions.MOVEMENT_SPEED))
    }

    @Test
    fun `a single dimension whose input is unavailable is held at 5`() {
        val heartRate = FakeAdaptizerInput(9, initiallyAvailable = false)

        val adaptizer = Adaptizer(FakeAdaptizerInput(0), heartRateInput = heartRate)

        assertEquals(5, adaptizer.resolve(Dimensions.HEART_RATE))
    }

    @Test
    fun `a single dimension with no input wired at all is held at 5`() {
        val adaptizer = Adaptizer(FakeAdaptizerInput(0))

        assertEquals(5, adaptizer.resolve(Dimensions.HEART_RATE))
        assertEquals(5, adaptizer.resolve(Dimensions.MOVEMENT_SPEED))
    }

    // --- The aggregate -------------------------------------------------------

    @Test
    fun `intensity over all three inputs is the weighted mean of 0_5 volume 0_3 movement speed 0_2 heart rate`() {
        val adaptizer = Adaptizer(
            FakeAdaptizerInput(8),
            movementSpeedInput = FakeAdaptizerInput(4),
            heartRateInput = FakeAdaptizerInput(0)
        )

        // 8*0.5 + 4*0.3 + 0*0.2 = 5.2
        assertEquals(5, adaptizer.resolve(Dimensions.INTENSITY))
    }

    @Test
    fun `intensity drops an unavailable member and renormalizes the remaining weights`() {
        val heartRate = FakeAdaptizerInput(0, initiallyAvailable = false)
        val adaptizer = Adaptizer(
            FakeAdaptizerInput(9),
            movementSpeedInput = FakeAdaptizerInput(0),
            heartRateInput = heartRate
        )

        // Heart rate is out, so the remaining 0.5 and 0.3 renormalize over
        // their own 0.8: (9*0.5 + 0*0.3) / 0.8 = 5.625. Were the missing
        // member instead counted as a zero, this would resolve to 5.
        assertEquals(6, adaptizer.resolve(Dimensions.INTENSITY))
    }

    @Test
    fun `a one-member aggregate resolves to exactly that member's value`() {
        val volume = FakeAdaptizerInput(0)
        val adaptizer = Adaptizer(volume)

        for (reading in 0..9) {
            volume.measure(reading)
            assertEquals(reading, adaptizer.resolve(Dimensions.INTENSITY))
        }
    }

    @Test
    fun `an unrecognised dimension name resolves as intensity`() {
        val adaptizer = Adaptizer(FakeAdaptizerInput(3))

        assertEquals(
            adaptizer.resolve(Dimensions.INTENSITY),
            adaptizer.resolve("dimensionThisBuildHasNeverHeardOf")
        )
    }

    // --- Live readings and change notification -------------------------------

    @Test
    fun `resolving samples the inputs live rather than caching a reading`() {
        val volume = FakeAdaptizerInput(0)
        val adaptizer = Adaptizer(volume)

        assertEquals(0, adaptizer.resolve(Dimensions.VOLUME))

        volume.measure(4)

        assertEquals(4, adaptizer.resolve(Dimensions.VOLUME))
    }

    @Test
    fun `every input's change notification reaches the listener`() {
        val volume = FakeAdaptizerInput(0)
        val heartRate = FakeAdaptizerInput(0)
        val movementSpeed = FakeAdaptizerInput(0)
        val adaptizer = Adaptizer(volume, movementSpeed, heartRate)

        var notifications = 0
        adaptizer.onReadingsChange { notifications++ }

        volume.measure(1)
        heartRate.measure(1)
        movementSpeed.measure(1)

        assertEquals(3, notifications)
    }

    @Test
    fun `an availability change notifies listeners exactly as a value change does`() {
        val heartRate = FakeAdaptizerInput(4)
        val adaptizer = Adaptizer(FakeAdaptizerInput(0), heartRateInput = heartRate)

        val resolvedHeartRates = mutableListOf<Int>()
        adaptizer.onReadingsChange { readings ->
            resolvedHeartRates.add(Dimensions.of(Dimensions.HEART_RATE).resolve(readings))
        }

        heartRate.measure(6)
        heartRate.setAvailable(false)

        assertEquals(listOf(6, 5), resolvedHeartRates)
    }

    @Test
    fun `a single dimension unpins the moment its input becomes available mid-session`() {
        val movementSpeed = FakeAdaptizerInput(8, initiallyAvailable = false)
        val adaptizer = Adaptizer(FakeAdaptizerInput(0), movementSpeedInput = movementSpeed)

        assertEquals(5, adaptizer.resolve(Dimensions.MOVEMENT_SPEED))

        movementSpeed.setAvailable(true)

        assertEquals(8, adaptizer.resolve(Dimensions.MOVEMENT_SPEED))
    }

    @Test
    fun `the aggregate re-weights mid-session when a member's availability flips`() {
        val movementSpeed = FakeAdaptizerInput(0)
        val adaptizer = Adaptizer(FakeAdaptizerInput(9), movementSpeedInput = movementSpeed)

        // Both members: (9*0.5 + 0*0.3) / 0.8 = 5.625
        assertEquals(6, adaptizer.resolve(Dimensions.INTENSITY))

        movementSpeed.setAvailable(false)

        // Volume alone: the one remaining member's own value, exactly.
        assertEquals(9, adaptizer.resolve(Dimensions.INTENSITY))

        movementSpeed.setAvailable(true)

        assertEquals(6, adaptizer.resolve(Dimensions.INTENSITY))
    }

    @Test
    fun `readings delivered to the listener are the ones current at that moment`() {
        val volume = FakeAdaptizerInput(0)
        val movementSpeed = FakeAdaptizerInput(0)
        val adaptizer = Adaptizer(volume, movementSpeedInput = movementSpeed)

        val observed = mutableListOf<Int>()
        adaptizer.onReadingsChange { readings ->
            observed.add(Dimensions.of(Dimensions.INTENSITY).resolve(readings))
        }

        volume.measure(8)          // (8*0.5) / 0.8 = 5
        movementSpeed.measure(9)   // (8*0.5 + 9*0.3) / 0.8 = 8.375

        assertEquals(listOf(5, 8), observed)
    }

    @Test
    fun `an input is never read while it is unavailable`() {
        // The fake throws from getCurrentValue() if it is read while
        // unavailable, so every dimension resolving here proves the readings
        // snapshot asked only the inputs entitled to answer.
        val unavailable = { FakeAdaptizerInput(9, initiallyAvailable = false) }
        val adaptizer = Adaptizer(unavailable(), unavailable(), unavailable())

        assertEquals(5, adaptizer.resolve(Dimensions.VOLUME))
        assertEquals(5, adaptizer.resolve(Dimensions.MOVEMENT_SPEED))
        assertEquals(5, adaptizer.resolve(Dimensions.HEART_RATE))
        assertEquals(5, adaptizer.resolve(Dimensions.INTENSITY))
    }
}

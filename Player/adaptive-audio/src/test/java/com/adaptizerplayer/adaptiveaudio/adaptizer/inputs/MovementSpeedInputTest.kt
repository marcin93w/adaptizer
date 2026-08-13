package com.adaptizerplayer.adaptiveaudio.adaptizer.inputs

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class MovementSpeedInputTest {
    private lateinit var speedUpdates: FakeSpeedUpdates
    private lateinit var activityUpdates: FakeActivityUpdates

    @Before
    fun setUp() {
        speedUpdates = FakeSpeedUpdates()
        activityUpdates = FakeActivityUpdates()
    }

    private fun input(
        hasPermissions: Boolean = true,
        hasCapability: Boolean = true
    ) = MovementSpeedInput(
        speedUpdates,
        activityUpdates,
        hasPermissions = { hasPermissions },
        hasCapability = { hasCapability }
    )

    @Test
    fun `initialize and release are idempotent`() {
        val input = input()

        input.initialize()
        input.initialize()
        assertEquals(1, speedUpdates.startCount)
        assertEquals(1, activityUpdates.startCount)

        input.release()
        input.release()
        assertEquals(1, speedUpdates.stopCount)
        assertEquals(1, activityUpdates.stopCount)
    }

    @Test
    fun `absent capability degrades to unavailable without starting updates`() {
        val input = input(hasCapability = false)

        input.initialize()

        assertFalse(input.isAvailable)
        assertEquals(0, speedUpdates.startCount)
        assertEquals(0, activityUpdates.startCount)
    }

    @Test
    fun `absent permission degrades to unavailable without throwing`() {
        val input = input(hasPermissions = false)

        input.initialize()

        assertFalse(input.isAvailable)
        assertEquals(0, speedUpdates.startCount)
        assertEquals(0, activityUpdates.startCount)
    }

    @Test
    fun `a measured speed and recognized activity notify the listener and become readable`() {
        val input = input()
        var changes = 0
        input.registerChangeListener { changes++ }
        input.initialize()

        speedUpdates.emit(2.0)
        assertFalse(input.isAvailable)
        activityUpdates.emit(MovementActivity.WALKING)

        assertTrue(input.isAvailable)
        assertEquals(9, input.getCurrentValue())
        assertEquals(2, changes)
    }

    @Test
    fun `release makes a live reading unavailable and notifies the listener`() {
        val input = input()
        var changes = 0
        input.registerChangeListener { changes++ }
        input.initialize()
        speedUpdates.emit(4.0)
        activityUpdates.emit(MovementActivity.RUNNING)
        assertTrue(input.isAvailable)

        input.release()

        assertFalse(input.isAvailable)
        assertEquals(3, changes)
    }

    @Test
    fun `an unrecognized activity makes a previous reading unavailable`() {
        val input = input()
        input.initialize()
        speedUpdates.emit(4.0)
        activityUpdates.emit(MovementActivity.RUNNING)
        assertTrue(input.isAvailable)

        activityUpdates.emit(null)

        assertFalse(input.isAvailable)
    }

    @Test
    fun `still makes a previous movement reading unavailable`() {
        val input = input()
        input.initialize()
        speedUpdates.emit(1.5)
        activityUpdates.emit(MovementActivity.WALKING)
        assertTrue(input.isAvailable)

        activityUpdates.emit(MovementActivity.STILL)

        assertFalse(input.isAvailable)
    }

    private class FakeSpeedUpdates : SpeedUpdateSource {
        var startCount = 0
        var stopCount = 0
        private var listener: ((Double?) -> Unit)? = null

        override fun start(listener: (Double?) -> Unit) {
            startCount++
            this.listener = listener
        }

        override fun stop() {
            stopCount++
            listener = null
        }

        fun emit(speed: Double?) = listener?.invoke(speed) ?: Unit
    }

    private class FakeActivityUpdates : ActivityUpdateSource {
        var startCount = 0
        var stopCount = 0
        private var listener: ((MovementActivity?) -> Unit)? = null

        override fun start(listener: (MovementActivity?) -> Unit) {
            startCount++
            this.listener = listener
        }

        override fun stop() {
            stopCount++
            listener = null
        }

        fun emit(activity: MovementActivity?) = listener?.invoke(activity) ?: Unit
    }
}

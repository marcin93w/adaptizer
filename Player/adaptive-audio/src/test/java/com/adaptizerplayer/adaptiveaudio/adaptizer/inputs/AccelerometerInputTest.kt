package com.adaptizerplayer.adaptiveaudio.adaptizer.inputs

import android.app.Application
import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorManager
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.shadow.api.Shadow
import org.robolectric.shadows.ShadowSensor
import org.robolectric.util.ReflectionHelpers

/**
 * Robolectric tests exercising AccelerometerInput against a real (shadowed)
 * SensorManager on the JVM. These pin down the lifecycle contract: an
 * owned/cancellable coroutine scope, idempotent initialize()/release(), and
 * safe handling of devices with no accelerometer -- without changing the
 * acceleration normalization formula (see the dedicated formula test below,
 * which must keep passing unchanged).
 */
@RunWith(RobolectricTestRunner::class)
class AccelerometerInputTest {

    private fun application(): Application = RuntimeEnvironment.getApplication()

    private fun sensorManager(context: Context): SensorManager =
        context.getSystemService(Context.SENSOR_SERVICE) as SensorManager

    /** Registers a fake TYPE_ACCELEROMETER sensor with the shadow SensorManager. */
    private fun addFakeAccelerometer(context: Context): Sensor {
        val sensor = ShadowSensor.newInstance(Sensor.TYPE_ACCELEROMETER)
        shadowOf(sensorManager(context)).addSensor(sensor)
        return sensor
    }

    /** Builds a real SensorEvent instance via Robolectric's reflection helpers. */
    private fun sensorEvent(sensor: Sensor, x: Float, y: Float, z: Float): SensorEvent {
        val event = Shadow.newInstanceOf(SensorEvent::class.java)
        ReflectionHelpers.setField(event, "values", floatArrayOf(x, y, z))
        ReflectionHelpers.setField(event, "sensor", sensor)
        return event
    }

    // --- Sensor unavailability: must not crash. ---

    @Test
    fun `no accelerometer present is reported as unavailable`() {
        val context = application()
        // Robolectric's default SensorManager has no sensors registered
        // unless explicitly added, so this simulates a device without one.
        val input = AccelerometerInput(context)

        assertFalse(input.isAvailable)
    }

    @Test
    fun `getCurrentValue stays 0 with no accelerometer present`() {
        val input = AccelerometerInput(application())

        assertEquals(0, input.getCurrentValue())
        input.initialize()
        assertEquals(0, input.getCurrentValue())
    }

    @Test
    fun `initialize, release and getCurrentValue do not crash with no accelerometer present`() {
        val input = AccelerometerInput(application())

        input.initialize()
        input.release()
        input.getCurrentValue()
        // Reaching this line without an exception is the assertion.
        input.initialize()
        input.release()
    }

    @Test
    fun `accelerometer present is reported as available`() {
        val context = application()
        addFakeAccelerometer(context)

        val input = AccelerometerInput(context)

        assertTrue(input.isAvailable)
    }

    // --- Idempotent initialize()/release(). ---

    @Test
    fun `release before initialize does not throw`() {
        val input = AccelerometerInput(application())

        input.release()
    }

    @Test
    fun `release called twice does not throw`() {
        val context = application()
        addFakeAccelerometer(context)
        val input = AccelerometerInput(context)

        input.initialize()
        input.release()
        input.release()
    }

    @Test
    fun `initialize called twice does not throw and behaves like a single initialize`() {
        val context = application()
        val sensor = addFakeAccelerometer(context)
        val input = AccelerometerInput(context)

        input.initialize()
        input.initialize()

        input.onSensorChanged(sensorEvent(sensor, 0f, 0f, SensorManager.GRAVITY_EARTH))
        assertEquals(0, input.getCurrentValue())
        assertTrue(input.isThrottleJobActive)

        input.release()
        assertFalse(input.isThrottleJobActive)
    }

    @Test
    fun `repeated initialize-release cycles work and a fresh scope is usable each time`() {
        val context = application()
        val sensor = addFakeAccelerometer(context)
        val input = AccelerometerInput(context)

        repeat(3) { cycle ->
            input.initialize()

            input.onSensorChanged(sensorEvent(sensor, 0f, 0f, SensorManager.GRAVITY_EARTH))
            assertEquals("cycle $cycle value", 0, input.getCurrentValue())
            assertTrue("cycle $cycle throttle job active", input.isThrottleJobActive)

            input.release()
            assertFalse("cycle $cycle throttle job cancelled", input.isThrottleJobActive)
        }
    }

    // --- The owned coroutine scope is cancelled by release(). ---

    @Test
    fun `release cancels the throttle job so it is not active afterwards`() {
        val input = AccelerometerInput(application())
        input.initialize()

        input.updateInputValue(5f)
        assertTrue(input.isThrottleJobActive)

        input.release()

        assertFalse(input.isThrottleJobActive)
    }

    @Test
    fun `throttle job started before release does not resurrect after release`() {
        val input = AccelerometerInput(application())
        input.initialize()

        input.updateInputValue(5f)
        assertTrue(input.isThrottleJobActive)
        input.release()
        assertFalse(input.isThrottleJobActive)

        // A value update after release() must not be able to schedule work on
        // the now-cancelled scope.
        input.updateInputValue(5f)
        assertFalse(input.isThrottleJobActive)
    }

    // --- Behavior-preservation: acceleration normalization must not change. ---

    @Test
    fun `updateInputValue matches min(abs(value) as int, 9)`() {
        val input = AccelerometerInput(application())

        // (currentAcceleration, expected) - this is the exact
        // min(abs(currentAcceleration.toInt()), 9) formula.
        val cases = listOf(
            0f to 0,
            4.9f to 4,
            -4.9f to 4,
            9f to 9,
            -9f to 9,
            20f to 9,
            -20f to 9
        )

        for ((value, expected) in cases) {
            input.updateInputValue(value)
            assertEquals("value=$value", expected, input.getCurrentValue())
        }
    }

    @Test
    fun `onSensorChanged computes min(abs(magnitude minus GRAVITY_EARTH) as int, 9)`() {
        val context = application()
        val sensor = addFakeAccelerometer(context)
        val input = AccelerometerInput(context)
        input.initialize()

        // (x, y, z, expected) - axis-aligned vectors so the magnitude
        // sqrt(x^2+y^2+z^2) is exact, then compared against
        // min(abs(magnitude - GRAVITY_EARTH).toInt(), 9).
        val cases = listOf(
            Triple(0f, 0f, SensorManager.GRAVITY_EARTH) to 0, // resting flat on a table
            Triple(0f, 0f, 0f) to 9,                          // free fall: magnitude 0
            Triple(15f, 0f, 0f) to 5,                         // magnitude 15
            Triple(20f, 0f, 0f) to 9                          // magnitude 20, clamped to 9
        )

        for ((axes, expected) in cases) {
            val (x, y, z) = axes
            input.onSensorChanged(sensorEvent(sensor, x, y, z))
            assertEquals("axes=$axes", expected, input.getCurrentValue())
        }

        input.release()
    }
}

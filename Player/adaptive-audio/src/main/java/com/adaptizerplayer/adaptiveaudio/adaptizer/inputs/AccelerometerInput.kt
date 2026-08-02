package com.adaptizerplayer.adaptiveaudio.adaptizer.inputs

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import com.adaptizerplayer.adaptiveaudio.adaptizer.AdaptizerInput
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.abs
import kotlin.math.min
import kotlin.math.sqrt

class AccelerometerInput(context: Context) : AdaptizerInput, SensorEventListener {

    private val sensorManager =
        context.getSystemService(Context.SENSOR_SERVICE) as SensorManager

    private val accelerometer: Sensor? =
        sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)

    /**
     * True when this device reports an accelerometer sensor. Devices without
     * one (some tablets/emulators/form factors) must not crash: initialize()
     * and release() are safe no-ops for sensor registration in that case, and
     * getCurrentValue() simply keeps returning 0 forever since onSensorChanged
     * is never invoked.
     */
    val isAvailable: Boolean = accelerometer != null

    private var changeListener: () -> Unit = {}
    private var currentValue: Int = 0

    private var lastUpdateTime: Long = 0L
    private var throttleJob: Job? = null

    // Owned per initialize()/release() cycle rather than created once at
    // construction time: release() cancels it outright (so nothing queued on
    // it can run again), and initialize() creates a brand new one, so a
    // subsequent initialize() after release() is not stuck launching
    // coroutines onto a scope that was already torn down.
    private var scope: CoroutineScope? = null

    private val throttleIntervalMs: Long = 2000
    private val stopDelayMs: Long = 2000
    private var isThrottling: Boolean = false

    // Tracks whether the sensor listener/scope are currently registered, so
    // initialize() and release() are both idempotent.
    private var isInitialized: Boolean = false

    override fun initialize() {
        if (isInitialized) {
            // Already initialized - must not double-register the listener.
            return
        }
        isInitialized = true
        scope = CoroutineScope(Dispatchers.Main + SupervisorJob())
        accelerometer?.also { sensor ->
            sensorManager.registerListener(this, sensor, SensorManager.SENSOR_DELAY_NORMAL)
        }
    }

    override fun release() {
        if (!isInitialized) {
            // Not initialized (either never initialized, or already
            // released) - nothing to tear down, and must not throw.
            return
        }
        isInitialized = false
        sensorManager.unregisterListener(this)
        isThrottling = false
        throttleJob?.cancel()
        throttleJob = null
        scope?.cancel()
        scope = null
    }

    override fun onSensorChanged(event: SensorEvent?) {
        if (event?.sensor?.type == Sensor.TYPE_ACCELEROMETER) {
            val x = event.values[0]
            val y = event.values[1]
            val z = event.values[2]

            var currentAcceleration = sqrt(x * x + y * y + z * z) - SensorManager.GRAVITY_EARTH
            updateInputValue(currentAcceleration)
        }
    }

    fun updateInputValue(currentAcceleration: Float) {
        val newInputValue = min(abs(currentAcceleration.toInt()), 9)
        currentValue = newInputValue
        lastUpdateTime = System.currentTimeMillis()
        if (throttleJob?.isActive != true) {
            isThrottling = true
            startThrottling()
        }
    }

    private fun startThrottling() {
        val activeScope = scope ?: return
        throttleJob = activeScope.launch {
            while (isThrottling) {
                val now = System.currentTimeMillis()
                if (now - lastUpdateTime > stopDelayMs) {
                    isThrottling = false
                    break
                }
                changeListener()
                delay(throttleIntervalMs)
            }
            throttleJob = null
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {
    }

    override fun getCurrentValue(): Int {
        return currentValue
    }

    override fun registerChangeListener(listener: () -> Unit) {
        changeListener = listener
    }

    /**
     * Internal test seam: whether the throttle coroutine is currently active.
     * `internal` rather than `private` so JVM unit tests in this module (which
     * cannot exercise real sensor hardware) can assert that release()
     * promptly cancels the throttle job rather than leaving it running.
     */
    internal val isThrottleJobActive: Boolean
        get() = throttleJob?.isActive == true
}

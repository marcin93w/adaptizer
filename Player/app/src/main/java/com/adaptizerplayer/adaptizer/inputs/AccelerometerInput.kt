package com.adaptizerplayer.adaptizer.inputs

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import com.adaptizerplayer.adaptizer.AdaptizerInput
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
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

    private var changeListener: () -> Unit = {}
    private var currentValue: Int = 0

    private var lastUpdateTime: Long = 0L
    private var throttleJob: Job? = null
    private val scope = CoroutineScope(Dispatchers.Main)
    private val throttleIntervalMs: Long = 2000
    private val stopDelayMs: Long = 2000
    private var isThrottling: Boolean = false

    override fun initialize() {
        accelerometer?.also { sensor ->
            sensorManager.registerListener(this, sensor, SensorManager.SENSOR_DELAY_NORMAL)
        }
    }

    override fun release() {
        sensorManager.unregisterListener(this)
        isThrottling = false
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
        throttleJob = scope.launch {
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
}

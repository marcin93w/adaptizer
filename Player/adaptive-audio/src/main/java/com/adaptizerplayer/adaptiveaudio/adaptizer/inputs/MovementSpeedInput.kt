package com.adaptizerplayer.adaptiveaudio.adaptizer.inputs

import android.Manifest
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.os.Build
import android.os.Looper
import androidx.core.content.ContextCompat
import com.adaptizerplayer.adaptiveaudio.adaptizer.AdaptizerInput
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import com.google.android.gms.location.ActivityRecognition
import com.google.android.gms.location.ActivityRecognitionResult
import com.google.android.gms.location.DetectedActivity
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger

internal fun interface SpeedUpdateSource {
    fun start(listener: (Double?) -> Unit)

    fun stop() = Unit
}

internal fun interface ActivityUpdateSource {
    fun start(listener: (MovementActivity?) -> Unit)

    fun stop() = Unit
}

/**
 * Fused-location and activity-recognition backed movement-speed input.
 *
 * Permission prompting belongs to the host. If permissions or Google Play
 * services are absent this class simply remains unavailable. Releasing it
 * immediately clears both measurements, so a backgrounded app cannot keep a
 * stale reading alive.
 */
class MovementSpeedInput internal constructor(
    private val speedUpdates: SpeedUpdateSource,
    private val activityUpdates: ActivityUpdateSource,
    private val hasPermissions: () -> Boolean,
    private val hasCapability: () -> Boolean
) : AdaptizerInput {

    constructor(context: Context) : this(
        speedUpdates = FusedSpeedUpdateSource(context.applicationContext),
        activityUpdates = RecognizedActivityUpdateSource(context.applicationContext),
        hasPermissions = { context.applicationContext.hasMovementSpeedPermissions() },
        hasCapability = {
            GoogleApiAvailability.getInstance()
                .isGooglePlayServicesAvailable(context.applicationContext) == ConnectionResult.SUCCESS
        }
    )

    private var changeListener: () -> Unit = {}
    private var started = false
    private var speedMetresPerSecond: Double? = null
    private var activity: MovementActivity? = null

    override val isAvailable: Boolean
        get() =
            started &&
                speedMetresPerSecond != null &&
                activity != null &&
                activity != MovementActivity.STILL

    override fun getCurrentValue(): Int {
        val speed = speedMetresPerSecond
        val currentActivity = activity
        check(isAvailable && speed != null && currentActivity != null) {
            "Movement speed is unavailable."
        }
        return checkNotNull(movementSpeedReading(speed, currentActivity)) {
            "Movement speed is unavailable."
        }
    }

    override fun registerChangeListener(listener: () -> Unit) {
        changeListener = listener
    }

    override fun initialize() {
        if (started || !hasPermissions() || !hasCapability()) return

        started = true
        try {
            activityUpdates.start(::onActivityChanged)
            speedUpdates.start(::onSpeedChanged)
        } catch (_: RuntimeException) {
            speedUpdates.stop()
            activityUpdates.stop()
            started = false
            clearReadingAndNotify()
        }
    }

    override fun release() {
        if (!started) return
        speedUpdates.stop()
        activityUpdates.stop()
        started = false
        clearReadingAndNotify()
    }

    private fun onSpeedChanged(speed: Double?) {
        val sanitized = speed?.takeIf { it.isFinite() && it >= 0.0 }
        updateIfChanged(speedMetresPerSecond, sanitized) { speedMetresPerSecond = sanitized }
    }

    private fun onActivityChanged(newActivity: MovementActivity?) {
        updateIfChanged(activity, newActivity) { activity = newActivity }
    }

    private fun <T> updateIfChanged(previous: T, next: T, update: () -> Unit) {
        if (previous == next) return
        update()
        changeListener()
    }

    private fun clearReadingAndNotify() {
        val hadReading = speedMetresPerSecond != null || activity != null
        speedMetresPerSecond = null
        activity = null
        if (hadReading) changeListener()
    }
}

private fun Context.hasMovementSpeedPermissions(): Boolean {
    val hasFineLocation =
        ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED
    val hasActivityRecognition =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.Q ||
            ContextCompat.checkSelfPermission(this, Manifest.permission.ACTIVITY_RECOGNITION) ==
                PackageManager.PERMISSION_GRANTED
    return hasFineLocation && hasActivityRecognition
}

private class FusedSpeedUpdateSource(context: Context) : SpeedUpdateSource {
    private val client: FusedLocationProviderClient =
        LocationServices.getFusedLocationProviderClient(context)
    private var callback: LocationCallback? = null

    override fun start(listener: (Double?) -> Unit) {
        if (callback != null) return
        val newCallback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                listener(result.lastLocation.toSpeedOrNull())
            }
        }
        callback = newCallback

        val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, UPDATE_INTERVAL_MS)
            .setMinUpdateIntervalMillis(MIN_UPDATE_INTERVAL_MS)
            .build()
        try {
            client.requestLocationUpdates(request, newCallback, Looper.getMainLooper())
                .addOnFailureListener { listener(null) }
        } catch (error: SecurityException) {
            callback = null
            listener(null)
        }
    }

    override fun stop() {
        val registered = callback ?: return
        callback = null
        try {
            client.removeLocationUpdates(registered)
        } catch (_: SecurityException) {
            // Permission can be revoked while the host is backgrounded. The
            // local callback is already cleared, so removal remains complete
            // from this input's point of view.
        }
    }

    private fun Location?.toSpeedOrNull(): Double? =
        this?.takeIf { it.hasSpeed() }?.speed?.toDouble()

    private companion object {
        const val UPDATE_INTERVAL_MS = 2_000L
        const val MIN_UPDATE_INTERVAL_MS = 1_000L
    }
}

private object MovementActivityCallbacks {
    private val nextId = AtomicInteger(1)
    private val callbacks = ConcurrentHashMap<Int, (MovementActivity?) -> Unit>()

    fun register(callback: (MovementActivity?) -> Unit): Int =
        nextId.getAndIncrement().also { callbacks[it] = callback }

    fun unregister(id: Int) {
        callbacks.remove(id)
    }

    fun deliver(id: Int, activity: MovementActivity?) {
        callbacks[id]?.invoke(activity)
    }
}

/** Explicit PendingIntent target used by Google Play services. */
class MovementActivityReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
        if (intent == null || !ActivityRecognitionResult.hasResult(intent)) return
        val callbackId = intent.getIntExtra(CALLBACK_ID, 0)
        val activity =
            ActivityRecognitionResult.extractResult(intent)?.mostProbableActivity.toMovementActivity()
        MovementActivityCallbacks.deliver(callbackId, activity)
    }

    companion object {
        internal const val CALLBACK_ID = "movement_activity_callback_id"
    }
}

private fun DetectedActivity?.toMovementActivity(): MovementActivity? = when (this?.type) {
    DetectedActivity.STILL -> MovementActivity.STILL
    DetectedActivity.WALKING -> MovementActivity.WALKING
    DetectedActivity.RUNNING -> MovementActivity.RUNNING
    DetectedActivity.ON_BICYCLE -> MovementActivity.CYCLING
    DetectedActivity.IN_VEHICLE -> MovementActivity.IN_VEHICLE
    else -> null
}

private class RecognizedActivityUpdateSource(private val context: Context) : ActivityUpdateSource {
    private val client = ActivityRecognition.getClient(context)
    private var callbackId: Int? = null
    private var pendingIntent: PendingIntent? = null

    override fun start(listener: (MovementActivity?) -> Unit) {
        if (callbackId != null) return
        val newCallbackId = MovementActivityCallbacks.register(listener)
        val newPendingIntent = PendingIntent.getBroadcast(
            context,
            newCallbackId,
            Intent(context, MovementActivityReceiver::class.java)
                .putExtra(MovementActivityReceiver.CALLBACK_ID, newCallbackId),
            PendingIntent.FLAG_UPDATE_CURRENT or mutablePendingIntentFlag()
        )
        callbackId = newCallbackId
        pendingIntent = newPendingIntent
        try {
            client.requestActivityUpdates(ACTIVITY_INTERVAL_MS, newPendingIntent)
                .addOnFailureListener { listener(null) }
        } catch (error: SecurityException) {
            stop()
            listener(null)
        }
    }

    override fun stop() {
        val registeredCallbackId = callbackId ?: return
        val registeredPendingIntent = pendingIntent
        callbackId = null
        pendingIntent = null
        MovementActivityCallbacks.unregister(registeredCallbackId)
        try {
            if (registeredPendingIntent != null) {
                client.removeActivityUpdates(registeredPendingIntent)
            }
        } catch (_: SecurityException) {
            // Treat a mid-session revocation as ordinary unavailability.
        } finally {
            registeredPendingIntent?.cancel()
        }
    }

    private fun mutablePendingIntentFlag(): Int =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0

    private companion object {
        const val ACTIVITY_INTERVAL_MS = 2_000L
    }
}

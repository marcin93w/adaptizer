package com.adaptizerplayer.adaptiveaudio.adaptizer.inputs

import android.Manifest
import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattDescriptor
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.bluetooth.BluetoothStatusCodes
import android.bluetooth.le.BluetoothLeScanner
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.os.Build
import android.os.ParcelUuid
import com.adaptizerplayer.adaptiveaudio.adaptizer.AdaptizerInput
import java.util.UUID

/**
 * A live heart-rate input backed by the Bluetooth LE Heart Rate Profile.
 *
 * Pairing deliberately stays in Android settings. Once initialized, this
 * input scans only for the standard Heart Rate service and connects only to a
 * result that Android already reports as bonded. A sleeping strap can
 * therefore appear mid-song and immediately become available without a
 * player restart.
 *
 * Runtime permission prompts are owned by the application host, not this
 * library. Calling [initialize] without the required permission, BLE hardware
 * or an enabled adapter simply leaves the input unavailable.
 */
class HeartRateInput(private val context: Context) : AdaptizerInput {

    private companion object {
        val HEART_RATE_SERVICE_UUID: UUID =
            UUID.fromString("0000180d-0000-1000-8000-00805f9b34fb")
        val HEART_RATE_MEASUREMENT_UUID: UUID =
            UUID.fromString("00002a37-0000-1000-8000-00805f9b34fb")
        val CLIENT_CHARACTERISTIC_CONFIGURATION_UUID: UUID =
            UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")

        // A physiological heart-rate band mapped linearly onto the ten
        // variants. Values outside it are still measurements, but clamp to
        // the nearest end rather than producing an invalid track index.
        const val MIN_HEART_RATE_BPM = 40
        const val MAX_HEART_RATE_BPM = 200
    }

    @Volatile private var changeListener: () -> Unit = {}
    @Volatile private var currentValue: Int? = null
    @Volatile private var initialized = false
    @Volatile private var scanner: BluetoothLeScanner? = null
    @Volatile private var scanning = false
    @Volatile private var gatt: BluetoothGatt? = null
    private var adapterStateReceiver: BroadcastReceiver? = null

    override val isAvailable: Boolean
        get() = currentValue != null

    override fun getCurrentValue(): Int =
        checkNotNull(currentValue) { "Heart rate is unavailable." }

    override fun registerChangeListener(listener: () -> Unit) {
        changeListener = listener
    }

    /**
     * Starts waiting for a bonded Heart Rate Profile device. Idempotent, and
     * intentionally non-throwing when the device cannot provide the input.
     */
    @SuppressLint("MissingPermission")
    override fun initialize() {
        if (initialized || !hasBleCapability() || !hasBluetoothPermissions()) return

        val adapter = bluetoothAdapter() ?: return
        val receiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                if (intent?.action != BluetoothAdapter.ACTION_STATE_CHANGED) return

                when (intent.getIntExtra(BluetoothAdapter.EXTRA_STATE, BluetoothAdapter.ERROR)) {
                    BluetoothAdapter.STATE_ON -> startScan()
                    BluetoothAdapter.STATE_OFF,
                    BluetoothAdapter.STATE_TURNING_OFF -> stopForDisabledAdapter()
                }
            }
        }

        try {
            registerAdapterStateReceiver(receiver)
            adapterStateReceiver = receiver
            initialized = true
            if (adapter.isEnabled) startScan()
        } catch (_: SecurityException) {
            unregisterAdapterStateReceiver(receiver)
        } catch (_: RuntimeException) {
            // Bluetooth is an optional capability. Vendor-stack failures have
            // the same meaning here as absent hardware: unavailable.
            unregisterAdapterStateReceiver(receiver)
        }
    }

    /** Stops scanning/connection ownership. Safe before initialize and twice. */
    @SuppressLint("MissingPermission")
    override fun release() {
        if (!initialized && adapterStateReceiver == null && !scanning && gatt == null) return

        initialized = false
        stopScan()

        adapterStateReceiver?.let(::unregisterAdapterStateReceiver)
        adapterStateReceiver = null

        val activeGatt = gatt
        gatt = null
        try {
            activeGatt?.disconnect()
        } catch (_: SecurityException) {
            // Permission can be revoked while the app is alive.
        } catch (_: RuntimeException) {
            // A broken vendor Bluetooth stack must not break player release.
        }
        try {
            activeGatt?.close()
        } catch (_: RuntimeException) {
            // close() is best effort during teardown.
        }
        currentValue = null
    }

    private val scanCallback = object : ScanCallback() {
        @SuppressLint("MissingPermission")
        override fun onScanResult(callbackType: Int, result: ScanResult) {
            val device = result.device ?: return
            try {
                if (device.bondState == BluetoothDevice.BOND_BONDED) connect(device)
            } catch (_: SecurityException) {
                stopScan()
            }
        }

        override fun onScanFailed(errorCode: Int) {
            scanner = null
            scanning = false
        }
    }

    private val gattCallback = object : BluetoothGattCallback() {
        @SuppressLint("MissingPermission")
        override fun onConnectionStateChange(activeGatt: BluetoothGatt, status: Int, newState: Int) {
            if (activeGatt !== gatt) return

            if (status == BluetoothGatt.GATT_SUCCESS && newState == BluetoothProfile.STATE_CONNECTED) {
                try {
                    if (!activeGatt.discoverServices()) closeGattAndResumeScan(activeGatt)
                } catch (_: SecurityException) {
                    closeGattAndResumeScan(activeGatt)
                } catch (_: RuntimeException) {
                    closeGattAndResumeScan(activeGatt)
                }
            } else if (newState == BluetoothProfile.STATE_DISCONNECTED ||
                status != BluetoothGatt.GATT_SUCCESS) {
                closeGattAndResumeScan(activeGatt)
            }
        }

        @SuppressLint("MissingPermission")
        override fun onServicesDiscovered(activeGatt: BluetoothGatt, status: Int) {
            if (activeGatt !== gatt || status != BluetoothGatt.GATT_SUCCESS) {
                if (activeGatt === gatt) closeGattAndResumeScan(activeGatt)
                return
            }

            val measurement =
                activeGatt.getService(HEART_RATE_SERVICE_UUID)
                    ?.getCharacteristic(HEART_RATE_MEASUREMENT_UUID)
            if (measurement == null || !enableNotifications(activeGatt, measurement)) {
                closeGattAndResumeScan(activeGatt)
            }
        }

        @Deprecated("Android 13 supplies an immutable value to the overload below")
        @Suppress("DEPRECATION")
        override fun onCharacteristicChanged(
            activeGatt: BluetoothGatt,
            characteristic: BluetoothGattCharacteristic
        ) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU &&
                activeGatt === gatt &&
                characteristic.uuid == HEART_RATE_MEASUREMENT_UUID) {
                characteristic.value?.let(::acceptMeasurement)
            }
        }

        override fun onCharacteristicChanged(
            activeGatt: BluetoothGatt,
            characteristic: BluetoothGattCharacteristic,
            value: ByteArray
        ) {
            if (activeGatt === gatt && characteristic.uuid == HEART_RATE_MEASUREMENT_UUID) {
                acceptMeasurement(value)
            }
        }

        override fun onDescriptorWrite(
            activeGatt: BluetoothGatt,
            descriptor: BluetoothGattDescriptor,
            status: Int
        ) {
            if (activeGatt === gatt && status != BluetoothGatt.GATT_SUCCESS) {
                closeGattAndResumeScan(activeGatt)
            }
        }
    }

    @SuppressLint("MissingPermission")
    private fun startScan() {
        if (!initialized || scanning || gatt != null) return

        try {
            val adapter = bluetoothAdapter() ?: return
            if (!adapter.isEnabled) return
            val activeScanner = adapter.bluetoothLeScanner ?: return
            val filter = ScanFilter.Builder()
                .setServiceUuid(ParcelUuid(HEART_RATE_SERVICE_UUID))
                .build()
            val settings = ScanSettings.Builder()
                .setScanMode(ScanSettings.SCAN_MODE_LOW_POWER)
                .build()

            scanner = activeScanner
            scanning = true
            activeScanner.startScan(listOf(filter), settings, scanCallback)
        } catch (_: SecurityException) {
            scanner = null
            scanning = false
        } catch (_: RuntimeException) {
            scanner = null
            scanning = false
        }
    }

    @SuppressLint("MissingPermission")
    private fun stopScan() {
        val activeScanner = scanner
        scanner = null
        val wasScanning = scanning
        scanning = false
        if (!wasScanning) return

        try {
            activeScanner?.stopScan(scanCallback)
        } catch (_: SecurityException) {
            // Permission may have been revoked after startScan().
        } catch (_: RuntimeException) {
            // Treat vendor scanner teardown failures as unavailability.
        }
    }

    @SuppressLint("MissingPermission")
    private fun connect(device: BluetoothDevice) {
        if (!initialized || gatt != null) return
        stopScan()

        try {
            gatt = device.connectGatt(context, false, gattCallback, BluetoothDevice.TRANSPORT_LE)
            if (gatt == null) startScan()
        } catch (_: SecurityException) {
            gatt = null
        } catch (_: RuntimeException) {
            gatt = null
            startScan()
        }
    }

    @SuppressLint("MissingPermission")
    @Suppress("DEPRECATION")
    private fun enableNotifications(
        activeGatt: BluetoothGatt,
        measurement: BluetoothGattCharacteristic
    ): Boolean {
        if (!activeGatt.setCharacteristicNotification(measurement, true)) return false
        val configuration =
            measurement.getDescriptor(CLIENT_CHARACTERISTIC_CONFIGURATION_UUID) ?: return false

        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            activeGatt.writeDescriptor(
                configuration,
                BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
            ) == BluetoothStatusCodes.SUCCESS
        } else {
            configuration.value = BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
            activeGatt.writeDescriptor(configuration)
        }
    }

    private fun acceptMeasurement(value: ByteArray) {
        val beatsPerMinute = parseHeartRate(value) ?: return
        updateReading(normalizeHeartRate(beatsPerMinute))
    }

    private fun updateReading(value: Int?) {
        val previous = currentValue
        currentValue = value
        if (previous != value) changeListener()
    }

    private fun closeGattAndResumeScan(activeGatt: BluetoothGatt) {
        if (activeGatt !== gatt) return
        gatt = null
        try {
            activeGatt.close()
        } catch (_: RuntimeException) {
            // The next scan is still safe to attempt.
        }
        updateReading(null)
        if (initialized) startScan()
    }

    private fun stopForDisabledAdapter() {
        stopScan()
        val activeGatt = gatt
        gatt = null
        try {
            activeGatt?.close()
        } catch (_: RuntimeException) {
            // Bluetooth is already going away.
        }
        updateReading(null)
    }

    private fun bluetoothAdapter(): BluetoothAdapter? =
        (context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager)?.adapter

    private fun hasBleCapability(): Boolean =
        context.packageManager.hasSystemFeature(PackageManager.FEATURE_BLUETOOTH_LE)

    private fun hasBluetoothPermissions(): Boolean =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            context.checkSelfPermission(Manifest.permission.BLUETOOTH_SCAN) ==
                PackageManager.PERMISSION_GRANTED &&
                context.checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) ==
                PackageManager.PERMISSION_GRANTED
        } else {
            // BLE scan results were guarded by location on Android 6-11,
            // even though this scan is explicitly never used for location.
            context.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) ==
                PackageManager.PERMISSION_GRANTED
        }

    private fun registerAdapterStateReceiver(receiver: BroadcastReceiver) {
        val filter = IntentFilter(BluetoothAdapter.ACTION_STATE_CHANGED)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            context.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            context.registerReceiver(receiver, filter)
        }
    }

    private fun unregisterAdapterStateReceiver(receiver: BroadcastReceiver) {
        try {
            context.unregisterReceiver(receiver)
        } catch (_: IllegalArgumentException) {
            // Registration may have failed partway through initialize().
        }
    }

    internal fun normalizeHeartRate(beatsPerMinute: Int): Int {
        val clamped = beatsPerMinute.coerceIn(MIN_HEART_RATE_BPM, MAX_HEART_RATE_BPM)
        return ((clamped - MIN_HEART_RATE_BPM) * 9) /
            (MAX_HEART_RATE_BPM - MIN_HEART_RATE_BPM)
    }

    internal fun parseHeartRate(value: ByteArray): Int? {
        if (value.size < 2) return null
        val isSixteenBit = value[0].toInt() and 0x01 != 0
        val beatsPerMinute =
            if (isSixteenBit) {
                if (value.size < 3) return null
                (value[1].toInt() and 0xff) or ((value[2].toInt() and 0xff) shl 8)
            } else {
                value[1].toInt() and 0xff
            }
        return beatsPerMinute.takeIf { it > 0 }
    }
}

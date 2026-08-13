package com.adaptizerplayer.adaptiveaudio.adaptizer.inputs

import android.Manifest
import android.app.Application
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattDescriptor
import android.bluetooth.BluetoothGattService
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.bluetooth.le.ScanResult
import android.content.Context
import android.content.pm.PackageManager
import android.os.Looper
import java.util.UUID
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.shadow.api.Shadow
import org.robolectric.shadows.ShadowBluetoothDevice
import org.robolectric.shadows.ShadowBluetoothGatt

/**
 * Robolectric coverage for the Android BLE ownership that cannot be exercised
 * by the resolver's fake-input tests: scan/connect/disconnect lifecycle,
 * unavailability, and notification delivery.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [30])
class HeartRateInputTest {

    private val heartRateServiceUuid =
        UUID.fromString("0000180d-0000-1000-8000-00805f9b34fb")
    private val heartRateMeasurementUuid =
        UUID.fromString("00002a37-0000-1000-8000-00805f9b34fb")
    private val clientConfigurationUuid =
        UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")

    private lateinit var context: Application
    private lateinit var adapter: BluetoothAdapter
    private lateinit var input: HeartRateInput

    @Before
    fun setUp() {
        context = RuntimeEnvironment.getApplication()
        shadowOf(context).grantPermissions(Manifest.permission.ACCESS_FINE_LOCATION)
        shadowOf(context.packageManager)
            .setSystemFeature(PackageManager.FEATURE_BLUETOOTH_LE, true)
        adapter =
            (context.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager).adapter
        @Suppress("DEPRECATION")
        shadowOf(adapter).setEnabled(true)
        input = HeartRateInput(context)
    }

    private fun scannerCallbackCount(): Int =
        shadowOf(adapter.bluetoothLeScanner).scanCallbacks.size

    private fun adapterStateReceiverCount(): Int =
        shadowOf(context).registeredReceivers.count { registered ->
            val filter = registered.intentFilter
            (0 until filter.countActions()).any { index ->
                filter.getAction(index) == BluetoothAdapter.ACTION_STATE_CHANGED
            }
        }

    @Test
    fun `initialize and release are idempotent and leak neither scan nor receiver`() {
        input.initialize()
        input.initialize()

        assertEquals(1, scannerCallbackCount())
        assertEquals(1, adapterStateReceiverCount())

        input.release()
        input.release()

        assertEquals(0, scannerCallbackCount())
        assertEquals(0, adapterStateReceiverCount())
        assertFalse(input.isAvailable)
    }

    @Test
    fun `release before initialize is safe`() {
        input.release()

        assertEquals(0, scannerCallbackCount())
        assertEquals(0, adapterStateReceiverCount())
        assertFalse(input.isAvailable)
    }

    @Test
    fun `absent BLE capability degrades to unavailable without throwing`() {
        shadowOf(context.packageManager)
            .setSystemFeature(PackageManager.FEATURE_BLUETOOTH_LE, false)

        input.initialize()

        assertFalse(input.isAvailable)
        assertEquals(0, scannerCallbackCount())
        assertEquals(0, adapterStateReceiverCount())
    }

    @Test
    fun `an unbonded heart-rate advertisement stays unavailable and is not connected`() {
        val device = adapter.getRemoteDevice("00:11:22:33:44:55")
        val shadowDevice: ShadowBluetoothDevice = Shadow.extract(device)
        shadowDevice.setBondState(BluetoothDevice.BOND_NONE)
        input.initialize()

        shadowOf(adapter.bluetoothLeScanner).scanCallbacks.single()
            .onScanResult(0, ScanResult(device, null, -40, 1L))
        shadowOf(Looper.getMainLooper()).idle()

        assertTrue(shadowDevice.bluetoothGatts.isEmpty())
        assertFalse(input.isAvailable)
        assertEquals(1, scannerCallbackCount())
    }

    @Test
    fun `a bonded strap measurement becomes available and disconnect notifies unavailability`() {
        val device = adapter.getRemoteDevice("00:11:22:33:44:66")
        val shadowDevice: ShadowBluetoothDevice = Shadow.extract(device)
        shadowDevice.setBondState(BluetoothDevice.BOND_BONDED)
        var changeCount = 0
        input.registerChangeListener { changeCount++ }
        input.initialize()

        shadowOf(adapter.bluetoothLeScanner).scanCallbacks.single()
            .onScanResult(0, ScanResult(device, null, -40, 1L))
        shadowOf(Looper.getMainLooper()).idle()

        val activeGatt = shadowDevice.bluetoothGatts.single()
        val shadowGatt: ShadowBluetoothGatt = Shadow.extract(activeGatt)
        val measurement = addHeartRateService(shadowGatt)
        shadowGatt.allowCharacteristicNotification(measurement)

        shadowDevice.simulateGattConnectionChange(
            BluetoothGatt.GATT_SUCCESS,
            BluetoothProfile.STATE_CONNECTED
        )

        @Suppress("DEPRECATION")
        measurement.value = byteArrayOf(0x00, 120.toByte())
        @Suppress("DEPRECATION")
        shadowGatt.gattCallback.onCharacteristicChanged(activeGatt, measurement)

        assertTrue(input.isAvailable)
        assertEquals(4, input.getCurrentValue())
        assertEquals(1, changeCount)

        shadowDevice.simulateGattConnectionChange(
            BluetoothGatt.GATT_SUCCESS,
            BluetoothProfile.STATE_DISCONNECTED
        )

        assertFalse(input.isAvailable)
        assertEquals(2, changeCount)
        assertTrue(shadowGatt.isClosed)
        assertEquals(1, scannerCallbackCount())
    }

    @Test
    fun `heart-rate packets support eight and sixteen bit profile values`() {
        assertEquals(72, input.parseHeartRate(byteArrayOf(0x00, 72)))
        assertEquals(300, input.parseHeartRate(byteArrayOf(0x01, 0x2c, 0x01)))
        assertEquals(null, input.parseHeartRate(byteArrayOf(0x01, 0x2c)))
        assertEquals(null, input.parseHeartRate(byteArrayOf(0x00, 0x00)))
    }

    @Test
    fun `heart rate normalizes linearly and clamps to a track index`() {
        assertEquals(0, input.normalizeHeartRate(20))
        assertEquals(0, input.normalizeHeartRate(40))
        assertEquals(4, input.normalizeHeartRate(120))
        assertEquals(9, input.normalizeHeartRate(200))
        assertEquals(9, input.normalizeHeartRate(240))
    }

    private fun addHeartRateService(
        shadowGatt: ShadowBluetoothGatt
    ): BluetoothGattCharacteristic {
        val service =
            BluetoothGattService(
                heartRateServiceUuid,
                BluetoothGattService.SERVICE_TYPE_PRIMARY
            )
        val measurement =
            BluetoothGattCharacteristic(
                heartRateMeasurementUuid,
                BluetoothGattCharacteristic.PROPERTY_NOTIFY,
                BluetoothGattCharacteristic.PERMISSION_READ
            )
        measurement.addDescriptor(
            BluetoothGattDescriptor(
                clientConfigurationUuid,
                BluetoothGattDescriptor.PERMISSION_READ or
                    BluetoothGattDescriptor.PERMISSION_WRITE
            )
        )
        service.addCharacteristic(measurement)
        shadowGatt.addDiscoverableService(service)
        return measurement
    }
}

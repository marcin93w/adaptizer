package com.adaptizerplayer.adaptiveaudio.adaptizer

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Arithmetic coverage of dimension resolution over a readings snapshot. The
 * behaviour is also driven end to end through the input seam in
 * [AdaptizerTest]; this pins the numbers.
 *
 * Note that `kotlin.math.round` on the JVM delegates to `Math.rint`, i.e.
 * exact `.5` fractions round to the nearest EVEN integer rather than always
 * up. That banker's rounding is inherited from the original intensity formula
 * and is pinned below.
 */
class InputReadingsTest {

    private fun readings(volume: Int?, movementSpeed: Int? = null, heartRate: Int? = null) =
        InputReadings(volume = volume, movementSpeed = movementSpeed, heartRate = heartRate)

    // --- Single dimensions ---------------------------------------------------

    @Test
    fun `a single dimension is its own input's reading`() {
        val snapshot = readings(volume = 2, movementSpeed = 5, heartRate = 8)

        assertEquals(2, snapshot.resolve(Dimensions.VOLUME))
        assertEquals(5, snapshot.resolve(Dimensions.MOVEMENT_SPEED))
        assertEquals(8, snapshot.resolve(Dimensions.HEART_RATE))
    }

    @Test
    fun `a single dimension with no reading is held at 5`() {
        val snapshot = readings(volume = null)

        assertEquals(5, snapshot.resolve(Dimensions.VOLUME))
        assertEquals(5, snapshot.resolve(Dimensions.MOVEMENT_SPEED))
        assertEquals(5, snapshot.resolve(Dimensions.HEART_RATE))
    }

    @Test
    fun `holding a single dimension at 5 does not disturb the others`() {
        val snapshot = readings(volume = 9, movementSpeed = null, heartRate = 1)

        assertEquals(9, snapshot.resolve(Dimensions.VOLUME))
        assertEquals(5, snapshot.resolve(Dimensions.MOVEMENT_SPEED))
        assertEquals(1, snapshot.resolve(Dimensions.HEART_RATE))
    }

    // --- The aggregate, all three members present ----------------------------

    @Test
    fun `intensity over all three members is round(0_5 volume plus 0_3 movement speed plus 0_2 heart rate)`() {
        // Triple(volume, movementSpeed, heartRate) to expected intensity.
        val cases = listOf(
            Triple(0, 0, 0) to 0,
            Triple(9, 9, 9) to 9,
            Triple(8, 4, 0) to 5,   // 4 + 1.2 + 0   = 5.2
            Triple(2, 7, 9) to 5,   // 1 + 2.1 + 1.8 = 4.9
            Triple(6, 2, 1) to 4,   // 3 + 0.6 + 0.2 = 3.8
        )

        for ((inputs, expected) in cases) {
            val (volume, movementSpeed, heartRate) = inputs
            assertEquals(
                "volume=$volume movementSpeed=$movementSpeed heartRate=$heartRate",
                expected,
                readings(volume, movementSpeed, heartRate).resolve(Dimensions.INTENSITY)
            )
        }
    }

    @Test
    fun `an exact half in the aggregate rounds to even`() {
        // 1*0.5 + 0*0.3 + 0*0.2 = 0.5 exactly; the lower neighbour 0 is even.
        assertEquals(0, readings(1, 0, 0).resolve(Dimensions.INTENSITY))
        // 3*0.5 = 1.5 exactly; the lower neighbour 1 is odd, so it rounds up.
        assertEquals(2, readings(3, 0, 0).resolve(Dimensions.INTENSITY))
        // 9*0.5 = 4.5 exactly; the lower neighbour 4 is even.
        assertEquals(4, readings(9, 0, 0).resolve(Dimensions.INTENSITY))
    }

    // --- The aggregate, renormalized over what is available ------------------

    @Test
    fun `intensity over volume and movement speed renormalizes their weights over 0_8`() {
        assertEquals(6, readings(9, 0).resolve(Dimensions.INTENSITY))  // 4.5 / 0.8 = 5.625
        assertEquals(3, readings(0, 9).resolve(Dimensions.INTENSITY))  // 2.7 / 0.8 = 3.375
        assertEquals(5, readings(5, 5).resolve(Dimensions.INTENSITY))  // 4.0 / 0.8 = 5.0
    }

    @Test
    fun `intensity over volume and heart rate renormalizes their weights over 0_7`() {
        assertEquals(6, readings(9, heartRate = 0).resolve(Dimensions.INTENSITY))  // 4.5 / 0.7
        assertEquals(3, readings(0, heartRate = 9).resolve(Dimensions.INTENSITY))  // 1.8 / 0.7
    }

    @Test
    fun `intensity over movement speed and heart rate renormalizes their weights over 0_5`() {
        assertEquals(5, readings(null, 9, 0).resolve(Dimensions.INTENSITY))  // 2.7 / 0.5 = 5.4
        assertEquals(4, readings(null, 0, 9).resolve(Dimensions.INTENSITY))  // 1.8 / 0.5 = 3.6
    }

    @Test
    fun `a one-member aggregate resolves to exactly that member's value, whichever member it is`() {
        for (reading in 0..9) {
            assertEquals(reading, readings(volume = reading).resolve(Dimensions.INTENSITY))
            assertEquals(reading, readings(null, movementSpeed = reading).resolve(Dimensions.INTENSITY))
            assertEquals(reading, readings(null, heartRate = reading).resolve(Dimensions.INTENSITY))
        }
    }

    @Test
    fun `an aggregate with nothing available is held at 5, like a single dimension`() {
        // Unreachable in production - device volume is always available - but
        // defined rather than left to divide by zero.
        assertEquals(5, readings(null).resolve(Dimensions.INTENSITY))
    }

    // --- The name is the contract --------------------------------------------

    @Test
    fun `an unrecognised dimension name resolves as intensity`() {
        val snapshot = readings(9, 0)

        assertEquals(
            snapshot.resolve(Dimensions.INTENSITY),
            snapshot.resolve("expression")
        )
    }

    @Test
    fun `the four dimension names are spelled exactly as the contract requires`() {
        assertEquals("volume", Dimensions.VOLUME)
        assertEquals("heartRate", Dimensions.HEART_RATE)
        assertEquals("movementSpeed", Dimensions.MOVEMENT_SPEED)
        assertEquals("intensity", Dimensions.INTENSITY)
    }
}

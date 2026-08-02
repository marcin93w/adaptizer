package com.adaptizerplayer.adaptiveaudio.adaptizer

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Table-driven coverage of AdaptizerState.intensity, which implements
 * round(volume * 0.75 + acceleration * 0.25).
 *
 * The expected values below are derived directly from the formula. Note
 * that `kotlin.math.round` on the JVM delegates to `Math.rint`, i.e. ties
 * (exact .5 fractions) are rounded to the nearest EVEN integer, not always
 * "up". That banker's-rounding behavior is intentionally reflected in the
 * expected table below (see e.g. volume=0,acceleration=2 -> 0.5 -> 0, and
 * volume=1,acceleration=6 -> 1.5 -> 2).
 */
class AdaptizerStateTest {

    // Triple(volume, acceleration, expectedIntensity) for the full 0-9 x 0-9 range.
    private val expectedIntensityTable: List<Triple<Int, Int, Int>> = listOf(
        Triple(0, 0, 0), Triple(0, 1, 0), Triple(0, 2, 0), Triple(0, 3, 1), Triple(0, 4, 1),
        Triple(0, 5, 1), Triple(0, 6, 2), Triple(0, 7, 2), Triple(0, 8, 2), Triple(0, 9, 2),

        Triple(1, 0, 1), Triple(1, 1, 1), Triple(1, 2, 1), Triple(1, 3, 2), Triple(1, 4, 2),
        Triple(1, 5, 2), Triple(1, 6, 2), Triple(1, 7, 2), Triple(1, 8, 3), Triple(1, 9, 3),

        Triple(2, 0, 2), Triple(2, 1, 2), Triple(2, 2, 2), Triple(2, 3, 2), Triple(2, 4, 2),
        Triple(2, 5, 3), Triple(2, 6, 3), Triple(2, 7, 3), Triple(2, 8, 4), Triple(2, 9, 4),

        Triple(3, 0, 2), Triple(3, 1, 2), Triple(3, 2, 3), Triple(3, 3, 3), Triple(3, 4, 3),
        Triple(3, 5, 4), Triple(3, 6, 4), Triple(3, 7, 4), Triple(3, 8, 4), Triple(3, 9, 4),

        Triple(4, 0, 3), Triple(4, 1, 3), Triple(4, 2, 4), Triple(4, 3, 4), Triple(4, 4, 4),
        Triple(4, 5, 4), Triple(4, 6, 4), Triple(4, 7, 5), Triple(4, 8, 5), Triple(4, 9, 5),

        Triple(5, 0, 4), Triple(5, 1, 4), Triple(5, 2, 4), Triple(5, 3, 4), Triple(5, 4, 5),
        Triple(5, 5, 5), Triple(5, 6, 5), Triple(5, 7, 6), Triple(5, 8, 6), Triple(5, 9, 6),

        Triple(6, 0, 4), Triple(6, 1, 5), Triple(6, 2, 5), Triple(6, 3, 5), Triple(6, 4, 6),
        Triple(6, 5, 6), Triple(6, 6, 6), Triple(6, 7, 6), Triple(6, 8, 6), Triple(6, 9, 7),

        Triple(7, 0, 5), Triple(7, 1, 6), Triple(7, 2, 6), Triple(7, 3, 6), Triple(7, 4, 6),
        Triple(7, 5, 6), Triple(7, 6, 7), Triple(7, 7, 7), Triple(7, 8, 7), Triple(7, 9, 8),

        Triple(8, 0, 6), Triple(8, 1, 6), Triple(8, 2, 6), Triple(8, 3, 7), Triple(8, 4, 7),
        Triple(8, 5, 7), Triple(8, 6, 8), Triple(8, 7, 8), Triple(8, 8, 8), Triple(8, 9, 8),

        Triple(9, 0, 7), Triple(9, 1, 7), Triple(9, 2, 7), Triple(9, 3, 8), Triple(9, 4, 8),
        Triple(9, 5, 8), Triple(9, 6, 8), Triple(9, 7, 8), Triple(9, 8, 9), Triple(9, 9, 9),
    )

    @Test
    fun `intensity matches round(volume times 0_75 plus acceleration times 0_25) across the full 0-9 range`() {
        for ((volume, acceleration, expected) in expectedIntensityTable) {
            val actual = AdaptizerState(volume, acceleration).intensity
            assertEquals(
                "volume=$volume, acceleration=$acceleration",
                expected,
                actual
            )
        }
    }

    @Test
    fun `volume 0 and acceleration 0 yields intensity 0`() {
        assertEquals(0, AdaptizerState(0, 0).intensity)
    }

    @Test
    fun `volume 9 and acceleration 9 yields intensity 9`() {
        assertEquals(9, AdaptizerState(9, 9).intensity)
    }

    @Test
    fun `exact half tie rounds up when the lower neighbor is odd`() {
        // volume=1, acceleration=6 -> 1*0.75 + 6*0.25 = 1.5, floor is 1 (odd) so it rounds up to 2.
        assertEquals(2, AdaptizerState(1, 6).intensity)
    }

    @Test
    fun `exact half tie rounds down when the lower neighbor is even`() {
        // volume=0, acceleration=2 -> 0*0.75 + 2*0.25 = 0.5, floor is 0 (even) so it rounds down to 0.
        assertEquals(0, AdaptizerState(0, 2).intensity)
    }

    @Test
    fun `mixed volume and acceleration values combine per the weighted formula`() {
        // volume=8, acceleration=4 -> 8*0.75 + 4*0.25 = 6 + 1 = 7
        assertEquals(7, AdaptizerState(8, 4).intensity)
        // volume=3, acceleration=9 -> 3*0.75 + 9*0.25 = 2.25 + 2.25 = 4.5, floor is 4 (even) -> rounds down to 4.
        assertEquals(4, AdaptizerState(3, 9).intensity)
    }

    @Test
    fun `intensity is not clamped to the 0-9 range by AdaptizerState itself`() {
        // Current behavior: AdaptizerState performs no clamping of its own. It only
        // stays within 0-9 in production because VolumeInput and AccelerometerInput
        // bound their reported values to 0-9. Given out-of-range inputs directly,
        // intensity follows the formula with no clamping, including going negative.
        assertEquals(20, AdaptizerState(20, 20).intensity)
        assertEquals(-3, AdaptizerState(-4, 0).intensity)
    }
}

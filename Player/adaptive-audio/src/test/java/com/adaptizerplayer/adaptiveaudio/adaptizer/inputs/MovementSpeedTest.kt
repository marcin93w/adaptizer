package com.adaptizerplayer.adaptiveaudio.adaptizer.inputs

import org.junit.Assert.assertEquals
import org.junit.Test

class MovementSpeedTest {

    @Test
    fun `still is unavailable at every speed`() {
        listOf(-1.0, 0.0, 0.3, 2.0, 35.0, 100.0).forEach { speed ->
            assertEquals(null, movementSpeedReading(speed, MovementActivity.STILL))
        }
    }

    @Test
    fun `every moving activity spans zero through nine and clamps at both ends`() {
        val bands = listOf(
            Triple(MovementActivity.WALKING, 0.3, 2.0),
            Triple(MovementActivity.RUNNING, 2.0, 5.5),
            Triple(MovementActivity.CYCLING, 2.0, 11.0),
            Triple(MovementActivity.IN_VEHICLE, 3.0, 35.0)
        )

        for ((activity, minimum, maximum) in bands) {
            val midpoint = (minimum + maximum) / 2.0
            val epsilon = (maximum - minimum) / 100.0

            assertEquals("$activity below minimum", 0, movementSpeedReading(minimum - epsilon, activity))
            assertEquals("$activity at minimum", 0, movementSpeedReading(minimum, activity))
            assertEquals("$activity at midpoint", 5, movementSpeedReading(midpoint, activity))
            assertEquals("$activity at maximum", 9, movementSpeedReading(maximum, activity))
            assertEquals("$activity above maximum", 9, movementSpeedReading(maximum + epsilon, activity))
        }
    }

    @Test
    fun `each activity uses its own specified speed band`() {
        assertEquals(9, movementSpeedReading(2.0, MovementActivity.WALKING))
        assertEquals(0, movementSpeedReading(2.0, MovementActivity.RUNNING))
        assertEquals(0, movementSpeedReading(2.0, MovementActivity.CYCLING))
        assertEquals(0, movementSpeedReading(3.0, MovementActivity.IN_VEHICLE))
        assertEquals(9, movementSpeedReading(5.5, MovementActivity.RUNNING))
        assertEquals(9, movementSpeedReading(11.0, MovementActivity.CYCLING))
        assertEquals(9, movementSpeedReading(35.0, MovementActivity.IN_VEHICLE))
    }
}

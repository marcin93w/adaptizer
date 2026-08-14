package com.adaptizerplayer.adaptiveaudio.adaptizer

import kotlin.math.round

/**
 * The value a single dimension is **held** at while its input is unavailable:
 * the middle of the range, not the bottom, so an unmeasurable dimension plays
 * a deliberate-sounding version of the song rather than its quietest variant
 * for the whole duration.
 */
private const val HELD = 5

/**
 * How one dimension turns a readings snapshot into a 0..9 value - the concept
 * that decides which variant plays. This is where the single-versus-aggregate
 * distinction the glossary draws (`Player/CONTEXT.md`) actually lives: each
 * kind is a type, not a branch. The names that select between them are the
 * closed contract set in [Dimensions].
 */
sealed interface Dimension {
    fun resolve(readings: InputReadings): Int
}

/**
 * A dimension that is exactly one input's [reading], or [HELD] while that input
 * is unavailable - volume, heart rate and movement speed.
 */
class SingleDimension(private val reading: (InputReadings) -> Int?) : Dimension {
    override fun resolve(readings: InputReadings): Int = reading(readings) ?: HELD
}

/**
 * A dimension computed as a weighted mean over its [members] - intensity is the
 * only one today. Each member is one input's reading paired with its weight;
 * build them with [member].
 *
 * Unavailable members are dropped and the remaining weights renormalized, so a
 * missing sensor never drags a song quieter than its author intended. The
 * weights therefore only need to sum to 1.0 when every member is present.
 */
class AggregateDimension(private vararg val members: Member) : Dimension {

    override fun resolve(readings: InputReadings): Int {
        var weightedSum = 0.0
        var availableWeight = 0.0
        for (member in members) {
            val value = member.readingIn(readings) ?: continue
            weightedSum += member.weight * value
            availableWeight += member.weight
        }

        // Dividing by the weight actually present is the renormalization: the
        // available members' weights are scaled to sum to 1.0, which is the
        // only reason the result lands back in 0..9. With one member left that
        // makes the aggregate exactly that member's value.
        if (availableWeight == 0.0) {
            // Unreachable while device volume is always available, so the
            // aggregate never really has to handle an empty set - but held at
            // 5 like a single dimension rather than dividing by zero.
            return HELD
        }
        return round(weightedSum / availableWeight).toInt()
    }
}

/** One member of an [AggregateDimension]: an input's reading and its weight. */
class Member(val weight: Double, private val reading: (InputReadings) -> Int?) {
    fun readingIn(readings: InputReadings): Int? = reading(readings)
}

/** A [Member] weighing [reading] at [weight] in an [AggregateDimension]. */
fun member(weight: Double, reading: (InputReadings) -> Int?): Member =
    Member(weight, reading)

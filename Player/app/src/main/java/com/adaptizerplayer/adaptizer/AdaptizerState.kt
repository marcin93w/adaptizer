package com.adaptizerplayer.adaptizer

import kotlin.math.round

class AdaptizerState(
    var volume: Int, var acceleration: Int) {

    val intensity: Int
        get() {
            return round(volume * 0.75 + acceleration * 0.25).toInt()
        }
}
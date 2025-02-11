package com.adaptizerplayer.adaptizer

import com.adaptizerplayer.adaptizer.inputs.AccelerometerInput
import com.adaptizerplayer.adaptizer.inputs.VolumeInput

class Adaptizer(private var volumeInput: VolumeInput,
                private var accelerometerInput: AccelerometerInput) {

    private fun getState(): AdaptizerState {
        val volume = volumeInput.getCurrentValue()
        val acceleration = accelerometerInput.getCurrentValue()
        return AdaptizerState(volume, acceleration)
    }

    fun onStateChange(onChange: (AdaptizerState) -> Unit) {
        volumeInput.registerChangeListener { onChange(getState()) }
        accelerometerInput.registerChangeListener { onChange(getState()) }
    }

    fun getTrackIndex(): Int {
        return getState().intensity
    }

    fun getDebugOutput(): String {
        return "Intensity: ${getState().intensity} (Vol: ${getState().volume}, Acc: ${getState().acceleration})"
    }
}
package com.adaptizerplayer.adaptizer

import com.adaptizerplayer.adaptizer.inputs.VolumeInput

class Adaptizer(private var volumeInput: VolumeInput) {
    private fun getState(): AdaptizerState {
        val volume = volumeInput.getCurrentValue()
        return AdaptizerState(volume)
    }

    fun onStateChange(onChange: (AdaptizerState) -> Unit) {
        volumeInput.onChange { onChange(getState()) }
    }

    fun getTrackIndex(): Int {
        return getState().volume
    }

    fun getDebugOutput(): String {
        return "Volume: ${getState().volume}"
    }
}
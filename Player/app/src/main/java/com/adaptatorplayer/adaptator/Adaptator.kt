package com.adaptatorplayer.adaptator

import com.adaptatorplayer.adaptator.inputs.VolumeInput

class Adaptator(private var volumeInput: VolumeInput) {
    private fun getState(): AdaptatorState {
        val volume = volumeInput.getCurrentValue()
        return AdaptatorState(volume)
    }

    fun onStateChange(onChange: (AdaptatorState) -> Unit) {
        volumeInput.onChange { onChange(getState()) }
    }

    fun getTrackIndex(): Int {
        return getState().volume
    }

    fun getDebugOutput(): String {
        return "Volume: ${getState().volume}"
    }
}
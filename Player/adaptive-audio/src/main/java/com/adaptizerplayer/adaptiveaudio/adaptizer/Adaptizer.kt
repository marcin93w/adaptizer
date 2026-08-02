package com.adaptizerplayer.adaptiveaudio.adaptizer

class Adaptizer(private var volumeInput: AdaptizerInput,
                private var accelerometerInput: AdaptizerInput) {

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

    fun getCurrentState(): AdaptizerState {
        return getState()
    }

    fun getDebugOutput(): String {
        return "Intensity: ${getState().intensity} (Vol: ${getState().volume}, Acc: ${getState().acceleration})"
    }
}

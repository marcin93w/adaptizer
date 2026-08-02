package com.adaptizerplayer.adaptiveaudio.adaptizer

interface AdaptizerInput {
    fun getCurrentValue(): Int
    fun registerChangeListener(listener: () -> Unit)
    fun initialize()
    fun release()
}

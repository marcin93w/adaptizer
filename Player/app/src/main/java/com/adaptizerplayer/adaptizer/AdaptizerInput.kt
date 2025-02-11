package com.adaptizerplayer.adaptizer

interface AdaptizerInput {
    fun getCurrentValue(): Int
    fun registerChangeListener(listener: () -> Unit)
    fun initialize()
    fun release()
}
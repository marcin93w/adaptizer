package com.adaptizerplayer.adaptizer

interface AdaptizerInput {
    fun getCurrentValue(): Int
    fun onChange(listener: () -> Unit)
}
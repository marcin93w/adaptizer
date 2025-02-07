package com.adaptatorplayer.adaptator

interface AdaptatorInput {
    fun getCurrentValue(): Int
    fun onChange(listener: () -> Unit)
}
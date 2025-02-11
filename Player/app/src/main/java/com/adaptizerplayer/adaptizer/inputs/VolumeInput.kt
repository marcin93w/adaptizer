package com.adaptizerplayer.adaptizer.inputs

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.media.AudioManager
import com.adaptizerplayer.adaptizer.AdaptizerInput

class VolumeInput(private val context: Context) : AdaptizerInput {
    override fun getCurrentValue(): Int {
        val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        val currentVolume = audioManager.getStreamVolume(AudioManager.STREAM_MUSIC)
        val maxVolume = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
        return (currentVolume * 10) / (maxVolume+1)
    }

    override fun registerChangeListener(listener: () -> Unit) {
        val filter = IntentFilter("android.media.VOLUME_CHANGED_ACTION")
        val receiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                if (intent?.action == "android.media.VOLUME_CHANGED_ACTION") {
                    listener()
                }
            }
        }
        context.registerReceiver(receiver, filter)
    }

    override fun initialize() {
    }

    override fun release() {
    }
}
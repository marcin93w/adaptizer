package com.adaptatorplayer

import android.content.ContentResolver
import android.net.Uri
import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import androidx.annotation.OptIn
import androidx.appcompat.app.AppCompatActivity
import androidx.media3.common.MediaItem
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DefaultDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.ProgressiveMediaSource
import androidx.media3.ui.PlayerView
import com.adaptatorplayer.adaptator.Adaptator
import com.adaptatorplayer.adaptator.inputs.VolumeInput

class MainActivity : AppCompatActivity() {
    private lateinit var exoPlayer: ExoPlayer
    private lateinit var playerView: PlayerView

    @OptIn(UnstableApi::class)
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        playerView = findViewById(R.id.playerView)
        val btnPlay = findViewById<Button>(R.id.btnPlay)
        val btnStop = findViewById<Button>(R.id.btnStop)
        val debugText = findViewById<TextView>(R.id.debugText)

        var adaptator = Adaptator(VolumeInput(this))
        val trackSelector = ManualTrackSelector(adaptator.getTrackIndex())
        adaptator.onStateChange {
            trackSelector.changeTrack(adaptator.getTrackIndex())
            debugText.text = adaptator.getDebugOutput()
        }

        exoPlayer = ExoPlayer.Builder(this)
            .setTrackSelector(trackSelector)
            .build()

        playerView.player = exoPlayer

        val rawResourceId = R.raw.adaptator_sample
        val rawUri = Uri.Builder().scheme(ContentResolver.SCHEME_ANDROID_RESOURCE).path(
            rawResourceId.toString()
        ).build()
        val mediaItem = MediaItem.fromUri(rawUri)

        val dataSourceFactory = DefaultDataSource.Factory(this)
        val mediaSource = ProgressiveMediaSource.Factory(dataSourceFactory)
            .createMediaSource(mediaItem)

        exoPlayer.setMediaSource(mediaSource)
        exoPlayer.prepare()

        btnPlay.setOnClickListener {
            exoPlayer.play()
        }

        btnStop.setOnClickListener {
            exoPlayer.pause()
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        exoPlayer.release()
    }
}
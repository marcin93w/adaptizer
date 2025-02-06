package com.adaptatorplayer

import android.content.ContentResolver
import android.net.Uri
import android.os.Bundle
import android.widget.Button
import androidx.annotation.OptIn
import androidx.appcompat.app.AppCompatActivity
import androidx.media3.common.MediaItem
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DefaultDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.ProgressiveMediaSource
import androidx.media3.ui.PlayerView

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
        val btnChangeTrack = findViewById<Button>(R.id.btnChangeTrack)

        val trackSelector = CustomTrackSelector()
        exoPlayer = ExoPlayer.Builder(this)
            .setTrackSelector(trackSelector)
            .build()

        playerView.player = exoPlayer

        val rawResourceId = R.raw.output
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

        btnChangeTrack.setOnClickListener {
            trackSelector.changeTrack()
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        exoPlayer.release()
    }
}
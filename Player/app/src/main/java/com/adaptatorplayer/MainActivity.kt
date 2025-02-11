package com.adaptatorplayer

import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import androidx.annotation.OptIn
import androidx.appcompat.app.AppCompatActivity
import androidx.media3.common.MediaItem
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.dash.DashMediaSource
import androidx.media3.ui.PlayerView
import com.adaptatorplayer.adaptator.Adaptator
import com.adaptatorplayer.adaptator.inputs.VolumeInput
import androidx.core.net.toUri

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
        val trackSelector = AdaptizerTrackSelector(adaptator.getTrackIndex())

        adaptator.onStateChange {
            trackSelector.changeTrack(adaptator.getTrackIndex())
            debugText.text = adaptator.getDebugOutput()
        }

        exoPlayer = ExoPlayer.Builder(this)
            .setTrackSelector(trackSelector)
            .build()

        playerView.player = exoPlayer

        val dashManifestUri = "https://jablka.agro.pl/_adaptizer/manifest.mpd".toUri()
        val mediaItem = MediaItem.fromUri(dashManifestUri)
        val dashMediaSource = DashMediaSource.Factory(DefaultHttpDataSource.Factory())
            .createMediaSource(mediaItem)

        exoPlayer.setMediaSource(dashMediaSource)
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
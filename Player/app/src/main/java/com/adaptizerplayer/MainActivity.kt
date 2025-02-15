package com.adaptizerplayer

import android.os.Bundle
import android.widget.TextView
import androidx.annotation.OptIn
import androidx.appcompat.app.AppCompatActivity
import androidx.core.net.toUri
import androidx.lifecycle.lifecycleScope
import androidx.media3.common.MediaItem
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.dash.DashMediaSource
import androidx.media3.ui.PlayerView
import com.adaptizerplayer.adaptizer.Adaptizer
import com.adaptizerplayer.adaptizer.AdaptizerInput
import com.adaptizerplayer.adaptizer.inputs.AccelerometerInput
import com.adaptizerplayer.adaptizer.inputs.VolumeInput
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {
    private lateinit var exoPlayer: ExoPlayer
    private lateinit var playerView: PlayerView
    private var inputs: List<AdaptizerInput> = emptyList()

    @OptIn(UnstableApi::class)
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        playerView = findViewById(R.id.playerView)
        val debugText = findViewById<TextView>(R.id.debugText)

        val volumeInput = VolumeInput(this)
        val accelerometerInput = AccelerometerInput(this)
        inputs = listOf(volumeInput, accelerometerInput)
        inputs.forEach { it.initialize() }

        var adaptizer = Adaptizer(volumeInput, accelerometerInput)
        val trackSelector = AdaptizerTrackSelector(adaptizer.getTrackIndex())

        adaptizer.onStateChange {
            trackSelector.changeTrack(adaptizer.getTrackIndex())
            debugText.text = adaptizer.getDebugOutput()
        }

        exoPlayer = ExoPlayer.Builder(this)
            .setTrackSelector(trackSelector)
            .build()

        playerView.player = exoPlayer
        playerView.setControllerShowTimeoutMs(0)
        playerView.setUseController(true)
        playerView.showController()

        lifecycleScope.launch {
            playFirstSong()
        }
    }

    @OptIn(UnstableApi::class)
    suspend fun playFirstSong() {
        val songsRepository = SongsRepository()
        val song = songsRepository.fetchSongs().firstOrNull()

        val dashManifestUri = "https://pub-fb297744d1fd4584a256f702d29363a8.r2.dev/${song!!.storageLocation}/manifest.mpd".toUri()
        val mediaItem = MediaItem.fromUri(dashManifestUri)
        val dashMediaSource = DashMediaSource.Factory(DefaultHttpDataSource.Factory())
            .createMediaSource(mediaItem)

        exoPlayer.setMediaSource(dashMediaSource)
        exoPlayer.prepare()
    }

    override fun onDestroy() {
        super.onDestroy()
        exoPlayer.release()
        inputs.forEach { it.release() }
    }
}
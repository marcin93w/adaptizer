package com.adaptizerplayer

import android.os.Bundle
import android.widget.ProgressBar
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.media3.ui.PlayerView
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.adaptizerplayer.adaptiveaudio.adaptizer.Adaptizer
import com.adaptizerplayer.adaptiveaudio.adaptizer.AdaptizerInput
import com.adaptizerplayer.adaptiveaudio.adaptizer.inputs.AccelerometerInput
import com.adaptizerplayer.adaptiveaudio.adaptizer.inputs.VolumeInput
import com.adaptizerplayer.adaptiveaudio.player.AdaptiveAudioEngine
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {
    private lateinit var engine: AdaptiveAudioEngine
    private lateinit var playerView: PlayerView
    private lateinit var nowPlayingTitle: TextView
    private var inputs: List<AdaptizerInput> = emptyList()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        val recyclerView: RecyclerView = findViewById(R.id.recyclerView)
        recyclerView.layoutManager = LinearLayoutManager(this)
        playerView = findViewById(R.id.playerView)
        val intensityProgressBar = findViewById<ProgressBar>(R.id.intensityProgressBar)
        nowPlayingTitle = findViewById<TextView>(R.id.nowPlayingTitle)

        val volumeInput = VolumeInput(this)
        val accelerometerInput = AccelerometerInput(this)
        inputs = listOf(volumeInput, accelerometerInput)
        inputs.forEach { it.initialize() }

        var adaptizer = Adaptizer(volumeInput, accelerometerInput)

        engine = AdaptiveAudioEngine(this)
        engine.initialize(adaptizer.getTrackIndex())

        adaptizer.onStateChange {
            engine.changeTrack(adaptizer.getTrackIndex())
            intensityProgressBar.progress = adaptizer.getTrackIndex()
        }

        playerView.player = engine.player
        playerView.setControllerShowTimeoutMs(0)
        playerView.setUseController(true)
        playerView.showController()

        lifecycleScope.launch {
            val songsRepository = SongsRepository()
            val songs = songsRepository.fetchSongs()

            val adapter = SongsAdapter(songs)
            adapter.setOnItemClickListener { song ->
                playSong(song)
            }
            recyclerView.adapter = adapter

            prepareSong(songs[0])
        }
    }

    fun playSong(song: Song) {
        prepareSong(song)
        engine.play()
    }

    fun prepareSong(song: Song) {
        nowPlayingTitle.text = "${song.author} - ${song.name}"

        val dashManifestUri = "https://pub-fb297744d1fd4584a256f702d29363a8.r2.dev/${song.storageLocation}/manifest.mpd"
        engine.prepare(dashManifestUri)
    }

    override fun onDestroy() {
        super.onDestroy()
        engine.release()
        inputs.forEach { it.release() }
    }
}

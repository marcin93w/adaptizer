package com.adaptizerplayer

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView

class SongsAdapter(private val songs: List<Song>) : RecyclerView.Adapter<SongsAdapter.SongViewHolder>() {
    private var onItemClickListener: ((Song) -> Unit)? = null

    class SongViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        private val songName: TextView = view.findViewById(R.id.songTitle)
        private val songArtist: TextView = view.findViewById(R.id.songArtist)

        fun bind(song: Song) {
            songName.text = song.name
            songArtist.text = song.author
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): SongViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.song_list_item, parent, false)
        return SongViewHolder(view)
    }

    override fun onBindViewHolder(holder: SongViewHolder, position: Int) {
        holder.bind(songs[position])
        holder.itemView.setOnClickListener {
            onItemClickListener?.invoke(songs[position])
        }
    }

    override fun getItemCount() = songs.size
    
    fun setOnItemClickListener(function: (Song) -> Unit) {
        onItemClickListener = function
    }
}
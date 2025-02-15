package com.adaptizerplayer

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView

class SongsAdapter(private val songs: List<Song>) : RecyclerView.Adapter<SongsAdapter.SongViewHolder>() {
    class SongViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        private val songName: TextView = view.findViewById(android.R.id.text1)

        fun bind(song: Song) {
            songName.text = "${song.name} - ${song.author}"
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): SongViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(android.R.layout.simple_list_item_1, parent, false)
        return SongViewHolder(view)
    }

    override fun onBindViewHolder(holder: SongViewHolder, position: Int) {
        holder.bind(songs[position])
    }

    override fun getItemCount() = songs.size
}
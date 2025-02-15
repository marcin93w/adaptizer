package com.adaptizerplayer

import com.google.gson.annotations.SerializedName
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.GET

data class Song(
    val id: Int,
    val author: String,
    val album: String,
    val name: String,
    @SerializedName("storage_location") val storageLocation: String
)

interface SongsApi {
    @GET("/")
    suspend fun getSongs(): List<Song>
}

class SongsRepository {
    private val api: SongsApi

    init {
        val retrofit = Retrofit.Builder()
            .baseUrl("https://adaptizer.marcin93w.workers.dev")
            .addConverterFactory(GsonConverterFactory.create())
            .build()

        api = retrofit.create(SongsApi::class.java)
    }

    suspend fun fetchSongs(): List<Song> {
        return try {
            api.getSongs()
        } catch (e: Exception) {
            e.printStackTrace()
            emptyList()
        }
    }
}

package com.adaptizerplayer.adaptiveaudio.adaptizer.inputs

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.media.AudioManager
import android.os.Build
import com.adaptizerplayer.adaptiveaudio.adaptizer.AdaptizerInput

class VolumeInput(private val context: Context) : AdaptizerInput {

    private companion object {
        /**
         * `android.media.VOLUME_CHANGED_ACTION` is NOT a documented, public
         * Android API constant (it is not `AudioManager.VOLUME_CHANGED_ACTION`,
         * which does not exist as a public field). It is an unofficial,
         * undocumented broadcast action string that has been observed to work
         * across shipped Android versions, but it is not guaranteed by the
         * platform contract: a future Android release could rename, stop
         * sending, or restrict delivery of this broadcast without notice.
         * Kept as a single private constant so any future API-level workaround
         * only needs to change one place.
         */
        const val VOLUME_CHANGED_ACTION = "android.media.VOLUME_CHANGED_ACTION"
    }

    // The callback registered via registerChangeListener(). Read dynamically
    // by the receiver below at delivery time, so it is safe for
    // registerChangeListener() to be called either before or after
    // initialize() - registration order does not matter.
    private var changeListener: () -> Unit = {}

    // Stored so release() can unregister the exact receiver instance that
    // initialize() registered. Null means "not currently registered", which
    // also makes initialize()/release() idempotent.
    private var receiver: BroadcastReceiver? = null

    override fun getCurrentValue(): Int {
        val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        val currentVolume = audioManager.getStreamVolume(AudioManager.STREAM_MUSIC)
        val maxVolume = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
        return (currentVolume * 10) / (maxVolume + 1)
    }

    override fun registerChangeListener(listener: () -> Unit) {
        changeListener = listener
    }

    override fun initialize() {
        if (receiver != null) {
            // Already registered - calling initialize() twice must not
            // register a second receiver.
            return
        }

        val filter = IntentFilter(VOLUME_CHANGED_ACTION)
        val newReceiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                if (intent?.action == VOLUME_CHANGED_ACTION) {
                    changeListener()
                }
            }
        }

        // API 33 (Tiramisu) requires every dynamically registered receiver to
        // declare an exported/not-exported flag. This broadcast is only ever
        // sent by the system to this app, so it must not be exported.
        //
        // Chosen approach: an explicit Build.VERSION.SDK_INT branch calling
        // the real two Context.registerReceiver overloads, rather than
        // ContextCompat.registerReceiver(..., RECEIVER_NOT_EXPORTED). Both
        // are correct on a real device across minSdk 24 .. targetSdk 35, but
        // ContextCompat's pre-33 shim additionally requires a self-signature
        // permission (`<applicationId>.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`)
        // that AndroidX injects via its own manifest at merge time - that
        // works in a real app, but a JVM/Robolectric unit test target has no
        // merged app manifest to source it from, so it throws at registration
        // time in tests. The explicit branch below needs no manifest
        // cooperation on either side of the SDK_INT check, keeping this
        // testable without weakening the not-exported guarantee.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            context.registerReceiver(newReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            context.registerReceiver(newReceiver, filter)
        }
        receiver = newReceiver
    }

    override fun release() {
        val registered = receiver ?: return
        context.unregisterReceiver(registered)
        receiver = null
    }
}

# M00 - Behavioral baseline (legacy Android app)

**Migration step:** M00 (Lane B / D, depends on: none)

**Baseline commit.** All `file:line` references below are pinned to commit `69226d0` ("Sending MIDI messages"), the last commit before migration work began. Later steps move and rename these files by design; to read the baseline as recorded, use `git show 69226d0:<path>`.

**Purpose.** Record what the current `app/` Android application actually does, with file:line references into the code as it exists on `rn-migration` today, so later React Native work has an objective parity target. This document records behavior only. It does not propose fixes; known defects are listed separately in section 6.

**Build verification.** The legacy debug build was verified green on this branch: `gradlew assembleDebug` (run with `JAVA_HOME` pointed at a JDK 17, e.g. the JBR bundled with Android Studio) completed with `BUILD SUCCESSFUL` and exit code 0, 34 actionable tasks, no failed tasks. This confirms the module compiles; it is not a runtime/device verification (see section 7).

---

## 1. Launch -> catalog load -> first-song preparation -> play/pause/seek flow

All references are to `app/src/main/java/com/adaptizerplayer/MainActivity.kt` unless noted.

1. **Launch.** `onCreate` (line 31) inflates `R.layout.activity_main`, binds `recyclerView` (35-36), `playerView` (37), `intensityProgressBar` (38) and `nowPlayingTitle` (39).
2. **Input registration.** `VolumeInput(this)` and `AccelerometerInput(this)` are constructed and both `initialize()`d (41-44). `Adaptizer(volumeInput, accelerometerInput)` is constructed (46) and `AdaptizerTrackSelector(adaptizer.getTrackIndex())` (47) is built using the intensity computed synchronously at that moment from whatever the current volume/accelerometer state is (accelerometer defaults to 0 until a sensor event arrives; see section 2).
3. **State-change wiring.** `adaptizer.onStateChange { ... }` (49-52) registers a callback that, on every reported input change, calls `trackSelector.changeTrack(adaptizer.getTrackIndex())` (50) and sets `intensityProgressBar.progress = adaptizer.getTrackIndex()` (51).
4. **Player construction.** `ExoPlayer.Builder(this).setTrackSelector(trackSelector).build()` (54-56). `playerView.player = exoPlayer` (58); the view's controller is force-enabled at runtime: `playerView.setControllerShowTimeoutMs(0)`, `setUseController(true)`, `showController()` (59-61) - this overrides the XML default `app:use_controller="false"` in `activity_main.xml:95`.
5. **Catalog load.** `lifecycleScope.launch { ... }` (63-74) creates `SongsRepository()` and calls `fetchSongs()` (64-65, see section 5 for the endpoint and section 6 for error handling). A `SongsAdapter(songs)` is built from the result (67), its click listener is wired to `playSong(song)` (68-70), and it is assigned to `recyclerView.adapter` (71).
6. **First-song preparation.** `prepareSong(songs[0])` is called unconditionally (73) - there is no check that `songs` is non-empty (see Known defect 6.1).
7. **`prepareSong(song)`** (82-93): sets `nowPlayingTitle.text` to `"${song.author} - ${song.name}"` (84, see section 5's title-format note), builds the DASH manifest URI from `song.storageLocation` (86, see section 5 for the endpoint template), wraps it in a `MediaItem` (87), builds a `DashMediaSource` via `DashMediaSource.Factory(DefaultHttpDataSource.Factory())` (88-89), and calls `exoPlayer.setMediaSource(...)` + `exoPlayer.prepare()` (91-92). This call does **not** start playback.
8. **Play.** `playSong(song)` (77-80) calls `prepareSong(song)` then `exoPlayer.play()` (79) - this is the only explicit `play()` call in the source and is reached by tapping a song in the list. Playback can also be started/paused directly through the ExoPlayer `PlayerView` built-in transport controller, since the controller is force-enabled (step 4 above).
9. **Pause.** There is no explicit `exoPlayer.pause()` call anywhere in the Kotlin source. Pause is only reachable through the `PlayerView` built-in controller UI.
10. **Seek.** There is no explicit `exoPlayer.seekTo(...)` call anywhere in the Kotlin source. Seeking is only reachable through the `PlayerView` built-in controller's seek bar.
11. **Teardown.** `onDestroy()` (95-99) calls `exoPlayer.release()` (97) and `inputs.forEach { it.release() }` (98). See Known defects 6.2 and 6.3 for gaps in what `release()` actually cleans up.

## 2. Intensity formula, volume normalization, accelerometer normalization and throttle behavior

**Intensity formula** - `app/src/main/java/com/adaptizerplayer/adaptizer/AdaptizerState.kt:8-11`:

```kotlin
val intensity: Int
    get() {
        return round(volume * 0.75 + acceleration * 0.25).toInt()
    }
```

`volume` and `acceleration` are both `Int` fields supplied by `AdaptizerState(volume, acceleration)`, constructed in `Adaptizer.getState()` (`adaptizer/Adaptizer.kt:9-13`) from `volumeInput.getCurrentValue()` and `accelerometerInput.getCurrentValue()`.

**Volume normalization** - `app/src/main/java/com/adaptizerplayer/adaptizer/inputs/VolumeInput.kt:11-16`:

```kotlin
val currentVolume = audioManager.getStreamVolume(AudioManager.STREAM_MUSIC)
val maxVolume = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
return (currentVolume * 10) / (maxVolume + 1)
```

Integer division against `STREAM_MUSIC`. Because the denominator is `maxVolume + 1`, the result is always in `0..9` for any `currentVolume` in `0..maxVolume` (never reaches 10).

Volume change notifications: `registerChangeListener` (`VolumeInput.kt:18-28`) registers an `IntentFilter("android.media.VOLUME_CHANGED_ACTION")` with a `BroadcastReceiver` that invokes the listener whenever that action fires (no debounce/throttle at this layer).

**Accelerometer normalization** - `app/src/main/java/com/adaptizerplayer/adaptizer/inputs/AccelerometerInput.kt`:

- `onSensorChanged` (47-56) computes `sqrt(x*x + y*y + z*z) - SensorManager.GRAVITY_EARTH` (magnitude of the accelerometer vector minus Earth's gravity, i.e. an approximation of "extra" acceleration beyond gravity) and passes it to `updateInputValue`.
- `updateInputValue` (58-66): `newInputValue = min(abs(currentAcceleration.toInt()), 9)` - clamps the truncated absolute value to a maximum of 9 (no explicit lower clamp is needed since `abs(...)` is non-negative). Sets `currentValue = newInputValue` and `lastUpdateTime = System.currentTimeMillis()`. If no throttle job is currently active (`throttleJob?.isActive != true`), sets `isThrottling = true` and calls `startThrottling()`.
- `startThrottling` (68-81) launches a coroutine on `scope = CoroutineScope(Dispatchers.Main)` that loops while `isThrottling`: if more than `stopDelayMs` (2000 ms, line 33) has elapsed since `lastUpdateTime`, it sets `isThrottling = false` and exits the loop (**2-second stop-delay**: the loop stops emitting ~2s after the last sensor update). Otherwise it invokes `changeListener()` (the registered `Adaptizer` callback) and then `delay(throttleIntervalMs)` (2000 ms, line 32) before checking again (**2-second throttle interval**: while motion continues, at most one emission every 2 seconds).
- Net effect: a burst of accelerometer activity produces an immediate emission (first loop iteration), then further emissions at most every 2 seconds for as long as `onSensorChanged` keeps refreshing `lastUpdateTime`, and emissions stop roughly 2 seconds after motion stops. `getCurrentValue()` (86-88) always returns the latest `currentValue`, which keeps being updated by `onSensorChanged` independently of the throttle loop's own cadence.
- Sensor registration/deregistration: `initialize()` (36-40) registers the listener at `SensorManager.SENSOR_DELAY_NORMAL` if an accelerometer is present; `release()` (42-45) unregisters the listener and sets `isThrottling = false` (see Known defect 6.3 for what this does not do).

## 3. Manifest contract

The app assumes a single audio `AdaptationSet` with exactly ten WebM/Opus representations, indexed 0-9:

- `app/src/main/java/com/adaptizerplayer/AdaptizerTrackSelector.kt:28-31` - inside `selectTracks`, only renderers of type `C.TRACK_TYPE_AUDIO` are handled (28), and only the **first** track group is used: `if (trackGroupArray.length > 0) { trackSelection = AdaptizerTrackSelection(trackGroupArray.get(0), intArrayOf(0,1,2,3,4,5,6,7,8,9), trackIndex) }` (29-31). The track index array is a hard-coded literal `intArrayOf(0,1,2,3,4,5,6,7,8,9)`, i.e. exactly ten indices, 0 through 9, with no reference to the manifest's actual track count.
- This hard-coded array is passed as the `tracks` constructor argument of `AdaptizerTrackSelection` (`AdaptizerTrackSelection.kt:11-15`), which extends `BaseTrackSelection` - so ExoPlayer's track mapping is told there are exactly 10 selectable tracks in that group regardless of what the manifest actually contains.
- `getSelectedIndex()` (`AdaptizerTrackSelection.kt:28`) returns `indexOf(selectedTrack)`, i.e. the position of the requested representation index (0-9) inside the hard-coded 10-element array.

## 4. Queue-invalidation behavior (`AdaptizerTrackSelection`)

`app/src/main/java/com/adaptizerplayer/AdaptizerTrackSelection.kt`:

- `setSelectedTrack(trackIndex)` (40-43) sets `selectedTrack = trackIndex` and `clearQueue = true`.
- `evaluateQueueSize(playbackPositionUs, queue)` (32-38): if `clearQueue` is `true`, it resets the flag to `false` and returns `0` (telling ExoPlayer to drop the currently queued/buffered chunks so the new representation takes effect immediately); otherwise it delegates to `super.evaluateQueueSize(...)`.
- This is a one-shot flag: exactly one subsequent `evaluateQueueSize` call after a track change observes `clearQueue == true`; every call after that behaves like the default implementation until `setSelectedTrack` is called again.
- `updateSelectedTrack(...)` (19-26) is an intentionally empty override - selection is driven entirely by explicit `setSelectedTrack` calls from `AdaptizerTrackSelector.changeTrack` (`AdaptizerTrackSelector.kt:41-46`), not by ExoPlayer's adaptive bandwidth logic.

## 5. Endpoints in use

- **Songs API** - `app/src/main/java/com/adaptizerplayer/SongsRepository.kt:26`: `Retrofit.Builder().baseUrl("https://adaptizer.marcin93w.workers.dev")`, consumed through `SongsApi.getSongs()` which is a `GET("/")` (`SongsRepository.kt:16-18`) returning `List<Song>` deserialized via Gson (`Song` fields: `id`, `author`, `album`, `name`, `storage_location` -> `storageLocation`; lines 8-14).
- **Media base** - `app/src/main/java/com/adaptizerplayer/MainActivity.kt:86`: `"https://pub-fb297744d1fd4584a256f702d29363a8.r2.dev/${song.storageLocation}/manifest.mpd"`, built per-song from `song.storageLocation` and loaded as a DASH manifest.
- **Now-playing title format** - `MainActivity.kt:84`: `"${song.author} - ${song.name}"`.

## 6. Known defects

These are defects present in the code as of this baseline. This section records them; it does not propose fixes.

1. **Unchecked `songs[0]` access.** `MainActivity.kt:73` - `prepareSong(songs[0])` is called with no check that `songs` is non-empty. If `SongsRepository.fetchSongs()` returns an empty list (see defect 5 below, which happens both on a legitimately empty catalog and on any network/parsing failure), this throws an `IndexOutOfBoundsException` on the main thread inside the `lifecycleScope.launch` coroutine, crashing the app on launch.
2. **`VolumeInput` broadcast receiver is never stored or unregistered.** `app/src/main/java/com/adaptizerplayer/adaptizer/inputs/VolumeInput.kt:18-28` - `registerChangeListener` creates a new anonymous `BroadcastReceiver` (20-26) and registers it with `context.registerReceiver(receiver, filter)` (27), but the `receiver` reference is a local variable, never kept in a field. `release()` (33-34) is an empty function body. Consequently the receiver can never be unregistered, and every call to `registerChangeListener` (see defect 6 below) registers an additional receiver rather than replacing the previous one.
3. **`AccelerometerInput`'s coroutine scope is never cancelled.** `app/src/main/java/com/adaptizerplayer/adaptizer/inputs/AccelerometerInput.kt:31` - `private val scope = CoroutineScope(Dispatchers.Main)` is a plain scope with no owned `Job` reference kept elsewhere. `release()` (42-45) unregisters the sensor listener and sets `isThrottling = false`, but never calls `scope.cancel()` and never cancels `throttleJob` directly. A throttle loop that is mid-`delay()` when `release()` runs will wake up, find `isThrottling == false`, and simply exit on its next iteration rather than being cancelled promptly - but the underlying `scope` itself remains alive indefinitely (it is never torn down), so a fresh `initialize()`/throttle cycle after `release()` continues to schedule coroutines on that same never-cancelled scope.
4. **Hard-coded ten-track assumption.** `app/src/main/java/com/adaptizerplayer/AdaptizerTrackSelector.kt:31` - `intArrayOf(0,1,2,3,4,5,6,7,8,9)` is a compile-time literal. A manifest with fewer than ten audio representations will misbehave or throw inside ExoPlayer's track-selection/mapping machinery when an out-of-range index is requested; a manifest with more than ten representations has its extra representations silently ignored, since only the hard-coded ten indices are ever presented as selectable.
5. **`SongsRepository.fetchSongs()` swallows all exceptions.** `app/src/main/java/com/adaptizerplayer/SongsRepository.kt:33-40` - the `try`/`catch (e: Exception)` block calls `e.printStackTrace()` and returns `emptyList()` for every failure mode (network timeout, DNS failure, non-2xx response, malformed JSON, etc.). A genuinely empty catalog and every possible network/server error are indistinguishable to the caller, and no error state is ever surfaced to `MainActivity` or the UI.
6. **Single listener slot per input allows silent overwrite on repeated registration.** `app/src/main/java/com/adaptizerplayer/adaptizer/Adaptizer.kt:15-18` - `onStateChange` calls `volumeInput.registerChangeListener { ... }` and `accelerometerInput.registerChangeListener { ... }` once each. `AccelerometerInput.registerChangeListener` (`AccelerometerInput.kt:90-92`) stores the callback in a single `changeListener` var field, so a second call to `onStateChange` silently discards the first accelerometer listener. `VolumeInput.registerChangeListener` does the opposite and arguably worse thing (see defect 2): it does not overwrite anything, it accumulates an additional, never-cleaned-up `BroadcastReceiver` registration on every call. Repeated registration therefore fails in two different, inconsistent ways depending on which input is involved, and in the current code path `onStateChange` happens to be called exactly once (`MainActivity.kt:49`), so this defect is latent rather than currently observed.

**Additional defects found beyond the required list:**

7. **No `Player.Listener` / `onPlayerError` handling anywhere.** `MainActivity.kt` constructs `exoPlayer` (54-56) and never calls `exoPlayer.addListener(...)`. There is no code path today - not even a log statement - that observes ExoPlayer playback errors (decoder failure, network failure mid-stream, malformed manifest encountered during playback, etc.). This matters directly for the parity matrix's "player error surfaced" row: today, nothing is surfaced.
8. **Unused `READ_MEDIA_AUDIO` permission.** `app/src/main/AndroidManifest.xml:4` declares `<uses-permission android:name="android.permission.READ_MEDIA_AUDIO" />`, but the app never reads local on-device media - all audio is streamed from the network DASH manifest (section 5). This is an unnecessary runtime permission request with no corresponding functionality.

## 7. Manual evidence required

**Status: NOT YET CAPTURED.**

This documentation pass was produced in an automated tooling environment (Windows shell with Git, Gradle and a JDK available, but no attached Android emulator, physical device, ADB target, or display). `gradlew assembleDebug` was run to confirm the module compiles (see "Build verification" above), but no runtime/instrumented/manual behavior could be exercised here. Before this baseline can be treated as reproduced evidence (per the M00 acceptance check "a reviewer can reproduce the baseline on one supported Android device"), a human must capture, on a physical Android device (or a device-equivalent emulator with working accelerometer and volume-stream simulation):

- **Screen recording of at least three intensity/track transitions** - a continuous recording showing the intensity bar and audible/representation changes crossing at least three distinct intensity levels (e.g. via a combination of media-volume changes and physical shakes), demonstrating the flow described in sections 1 and 2 end to end on real hardware.
- **A logcat excerpt** captured during that same session (e.g. `adb logcat` filtered to the app's process) covering the same transitions. Note that the current code has no explicit application-level logging of intensity/track-selection events (see defect 7 for the closest related gap, on player errors specifically) - a logcat capture today would show only ExoPlayer's own internal log lines plus system-level volume/sensor broadcasts, not a purpose-built diagnostic trail.
- **Volume-response check** - confirm manually that raising/lowering the media stream volume changes the intensity bar and the selected DASH representation, per the normalization and broadcast-listener behavior in section 2.
- **Shake-response check** - confirm manually that physically shaking the device changes the intensity bar per the accelerometer normalization, throttle interval and stop-delay behavior in section 2.

None of the above has been captured as part of this documentation pass. The parity matrix (`docs/migration/parity-matrix.md`) reflects this: every row that depends on live device behavior is seeded as not verified rather than marked with fabricated evidence.

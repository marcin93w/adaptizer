# Adaptive audio behavior

Reference for how Adaptizer Player aggregates real-time listener-context signals
into a single intensity value, and how that value selects a DASH representation.
This is the authoritative description of the product's defining feature; the
implementation lives in the `adaptive-audio/` Kotlin library and is consumed by
both the legacy `app/` module and the React Native host in `mobile/`.

Related: [`native-bridge-contract.md`](native-bridge-contract.md) for the typed
JS/Kotlin boundary, [`adr/0001-react-native-shell-with-kotlin-adaptive-audio.md`](adr/0001-react-native-shell-with-kotlin-adaptive-audio.md)
for why this logic stays in Kotlin.

---

## 1. Intensity: the aggregate signal

**Intensity is an aggregate metric over a set of listener-context inputs, not a
function of any one of them.** It is a single integer, `0-9`, and it is the only
thing track selection consumes. The input set is expected to grow; the aggregate
is the stable concept, the current membership is not.

Every input implements one interface
(`adaptizer/AdaptizerInput.kt`), which is what makes the set extensible:

```kotlin
interface AdaptizerInput {
    fun getCurrentValue(): Int          // normalized to 0-9
    fun registerChangeListener(listener: () -> Unit)
    fun initialize()
    fun release()
}
```

Two contracts hold across the whole set:

- **Every input normalizes itself to `0-9`.** Normalization is the input's own
  job, so the aggregation step never needs to know a sensor's native range.
- **The aggregation is a weighted mean whose weights sum to `1.0`.** That is the
  only reason the result lands back in `0-9`.

Today the set has **two** members, weighted 0.75 volume / 0.25 acceleration
(`adaptizer/AdaptizerState.kt`):

```kotlin
val intensity: Int
    get() = round(volume * 0.75 + acceleration * 0.25).toInt()
```

`Adaptizer.getState()` samples each input on demand via `getCurrentValue()` and
builds an `AdaptizerState` from the readings; `getTrackIndex()` returns the
resulting `intensity`. Any input's `registerChangeListener` callback triggers a
recompute, so the aggregate refreshes whenever *any* member changes.

Two properties worth knowing before touching the formula:

- **`kotlin.math.round` is round-half-to-even**, not half-up. An exact `.5`
  rounds to the even integer, so `AdaptizerState(0, 2).intensity == 0`. This is
  pinned by unit test. It matters only if the formula is ever reimplemented
  outside Kotlin - which the ADR rules out.
- **`intensity` is not clamped.** It is bounded to `0-9` only because every
  input is and the weights sum to 1. Also pinned by test.

### Adding an input

The `AdaptizerInput` interface and the weighted-mean shape are built for this;
the surrounding types are not yet generic over the set, so a third input touches
four places:

1. **The input itself** - implement `AdaptizerInput`, normalize to `0-9`, make
   `initialize()`/`release()` idempotent, and degrade to a constant `0` when the
   underlying sensor is absent (see how `AccelerometerInput.isAvailable` does
   it). Cover it with Robolectric tests like the existing two.
2. **`AdaptizerState`** - currently a fixed `(volume, acceleration)` pair. Add
   the field and re-weight so the weights still sum to `1.0`; re-pin the
   boundary cases by test.
3. **`Adaptizer`** - currently takes its two inputs as named constructor
   parameters and registers a listener on each. A third member is the point at
   which taking a `List<AdaptizerInput>` is likely worth the refactor.
4. **The bridge payload** - `onIntensityChanged` ships
   `{ intensity, volume, acceleration }` with a field per input, so it must gain
   one too. That is a contract change: see
   [`native-bridge-contract.md`](native-bridge-contract.md) and update it and
   the TypeScript types in the same change.

Note what does *not* change: the `0-9` output range, the ten-representation
manifest contract (section 4), and the rule that React Native only observes the
aggregate and never contributes to or overrides it.

## 2. Input: device volume

Weight in the aggregate: **0.75**. `adaptizer/inputs/VolumeInput.kt`:

```kotlin
val currentVolume = audioManager.getStreamVolume(AudioManager.STREAM_MUSIC)
val maxVolume = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
return (currentVolume * 10) / (maxVolume + 1)
```

Integer division against `STREAM_MUSIC`. Because the denominator is
`maxVolume + 1`, the result is always in `0..9` and never reaches 10.

Change notification comes from a `BroadcastReceiver` on
`android.media.VOLUME_CHANGED_ACTION`, with no debounce at this layer.

> **That action string is not public Android API.** It is not
> `AudioManager.VOLUME_CHANGED_ACTION` (no such public field exists). It is an
> undocumented broadcast that has worked across shipped Android versions but is
> not guaranteed by the platform contract. It is isolated in a single private
> constant so a future workaround touches one place.

On API 33+ the receiver is registered with `Context.RECEIVER_NOT_EXPORTED` via
an explicit `Build.VERSION.SDK_INT` branch rather than `ContextCompat`, because
the AndroidX shim needs a manifest-injected permission that a JVM/Robolectric
test target has no merged manifest to supply.

`initialize()` and `release()` are idempotent: the registered receiver instance
is stored so `release()` unregisters exactly it, and a second `initialize()`
does not register a duplicate.

## 3. Input: accelerometer

Weight in the aggregate: **0.25**. `adaptizer/inputs/AccelerometerInput.kt`:

- `onSensorChanged` computes `sqrt(x² + y² + z²) - SensorManager.GRAVITY_EARTH`
  - the acceleration beyond gravity.
- `updateInputValue` clamps that to `min(abs(value.toInt()), 9)` and stamps
  `lastUpdateTime`.
- **Throttle interval: 2000 ms. Stop delay: 2000 ms.** While motion continues,
  the change listener fires at most once every 2 s; emissions stop roughly 2 s
  after the last sensor update.
- `getCurrentValue()` always returns the freshest value, which `onSensorChanged`
  keeps updating independently of the throttle loop's own cadence.

Lifecycle: the coroutine scope is owned per `initialize()`/`release()` cycle -
`release()` cancels the throttle job and the scope outright, and a subsequent
`initialize()` creates a fresh one. Both calls are idempotent.

Devices with no accelerometer are handled without crashing: `isAvailable` is
`false`, registration is a no-op, and `getCurrentValue()` stays at 0.

## 4. Manifest contract

The player assumes **a single audio `AdaptationSet` with exactly ten WebM/Opus
representations, indexed 0-9**. Production manifests are generated by
`shaka-packager` and use `SegmentBase`/`indexRange` byte-range addressing, one
`BaseURL` file per representation.

`player/AdaptizerTrackSelector.kt` enforces this rather than assuming it:

- `EXPECTED_TRACK_COUNT = 10`.
- `selectTracks` reads the first audio track group, records
  `availableTrackCount`, and throws `AdaptiveAudioManifestException` if the
  group length differs from 10.
- Any track index outside `0..9` throws `AdaptiveAudioUnsupportedTrackException`
  at construction time and on every `changeTrack` call.

Both surface to JavaScript as typed `manifest` / `unsupported_track` error
codes (see the bridge contract). A deterministic offline fixture reproducing
this shape - plus malformed and too-few-representation negative fixtures - lives
in [`../test-media/`](../test-media/README.md).

## 5. Queue invalidation on track switch

`player/AdaptizerTrackSelection.kt`:

- `setSelectedTrack(index)` sets the selection and raises a one-shot
  `clearQueue` flag.
- `evaluateQueueSize(...)` returns `0` once while that flag is set - telling
  ExoPlayer to drop already-buffered chunks so the new representation takes
  effect immediately - then reverts to the default implementation until the next
  `setSelectedTrack`.
- `updateSelectedTrack(...)` is an intentionally empty override. Selection is
  driven entirely by explicit `changeTrack` calls, never by ExoPlayer's adaptive
  bandwidth logic.

This immediate-switch behavior is the reason a general-purpose player library
was rejected; see the ADR's alternatives section.

## 6. Endpoints

| Purpose | Value |
| --- | --- |
| Songs API | `https://adaptizer.marcin93w.workers.dev` - `GET /` returns `List<Song>` (`id`, `author`, `album`, `name`, `storage_location`) |
| Media | `https://pub-fb297744d1fd4584a256f702d29363a8.r2.dev/{storageLocation}/manifest.mpd` |
| Now-playing label | `"{author} - {name}"` |

The React Native client centralizes both base URLs in `mobile/src/config/`.

## 7. Known issues in the legacy `app/` module

The lifecycle and manifest problems above were fixed during the extraction into
`adaptive-audio/`. These remain in `app/` itself, which is retained unchanged as
the rollback reference until cutover. They are recorded here so nobody
reintroduces them in the React Native path.

1. **Unchecked `songs[0]` access.** `MainActivity.kt` calls
   `prepareSong(songs[0])` with no empty check, so an empty catalog crashes on
   launch. The React Native catalog deliberately does not reproduce this.
2. **`SongsRepository.fetchSongs()` swallows every exception.** It catches
   `Exception`, prints the stack trace and returns `emptyList()`, so a genuinely
   empty catalog and any network/parse failure are indistinguishable to callers
   and no error state ever reaches the UI. The TypeScript client distinguishes
   them.
3. **`Adaptizer.onStateChange` has a single listener slot per input.** Repeated
   registration silently overwrites the previous callback. Latent today, since
   the call site registers exactly once.
4. **No `Player.Listener` is registered anywhere in `app/`**, so no ExoPlayer
   error is observed or surfaced. `AdaptiveAudioEngine` now offers
   `AdaptiveAudioListener`; error reporting through the bridge is therefore a
   **behavior addition**, not parity with the legacy app.
5. **`READ_MEDIA_AUDIO` is declared but unused.** All audio is streamed; nothing
   reads local media. The React Native host omits it and keeps only `INTERNET`.

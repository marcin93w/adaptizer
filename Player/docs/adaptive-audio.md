# Adaptive audio behavior

Reference for how Adaptizer Player measures real-time listener-context signals,
resolves a dimension into a value 0..9, and how that value selects a DASH
representation. This is the authoritative description
of the product's defining feature; the implementation lives in the
`adaptive-audio/` Kotlin library and is consumed by the React Native host in
`mobile/`.

Related: [`native-bridge-contract.md`](native-bridge-contract.md) for the typed
JS/Kotlin boundary, [`adr/0001-react-native-shell-with-kotlin-adaptive-audio.md`](adr/0001-react-native-shell-with-kotlin-adaptive-audio.md)
for why this logic stays in Kotlin.

---

## 1. Dimensions, inputs and the resolver

A song is authored against exactly one **dimension** — the axis a track index
`0-9` means — and names it with one of exactly four strings: `volume`,
`heartRate`, `movementSpeed`, `intensity`. Three are **single dimensions**, each
one input's reading; `intensity` is the **aggregate dimension**, a weighted mean
over the inputs currently available. See
[`../../docs/adr/0001-songs-declare-their-adaptation-dimension-by-name.md`](../../docs/adr/0001-songs-declare-their-adaptation-dimension-by-name.md)
for why the name, not the formula, is what a song records.

An **input** is a device-side signal source. Every input implements one
interface (`adaptizer/AdaptizerInput.kt`):

```kotlin
interface AdaptizerInput {
    val isAvailable: Boolean            // measurable right now?
    fun getCurrentValue(): Int          // normalized to 0-9, only while available
    fun registerChangeListener(listener: () -> Unit)
    fun initialize()
    fun release()
}
```

Three contracts hold across the whole set:

- **Every input normalizes itself to `0-9`.** Normalization is the input's own
  job, so resolution never needs to know a sensor's native range.
- **An input never fabricates a reading.** Absent hardware, a denied permission
  and an unbonded device are all the same state — `isAvailable` is false and
  `getCurrentValue()` is meaningless. Inventing a stand-in value is the
  resolver's job, so a value in the aggregate is always a real measurement.
- **An availability change fires the same change notification a value change
  does**, so a held dimension unpins and the aggregate re-weights live,
  mid-song, without a restart.

`registerChangeListener` has **one listener slot**: registering twice silently
overwrites the first callback. Latent today - `Adaptizer` registers exactly once
per input - but it is a trap for a second observer.

`Adaptizer` owns the inputs and hands out an `InputReadings` snapshot — one
nullable reading per input, `null` meaning unavailable. `InputReadings.resolve`
is the one resolver function, and the only place the single-versus-aggregate
distinction is drawn:

- A **single dimension** is its input's reading, or **held at `5`** — the middle
  of the range, not the bottom — while that input is unavailable.
- The **aggregate** drops its unavailable members and renormalizes the rest, so
  a missing sensor never systematically drags a song quieter than its author
  intended.
- An **unrecognised name** resolves as the aggregate rather than rejecting the
  song, so a dimension published after a build shipped still plays and still
  adapts.

Any input's `registerChangeListener` callback delivers a fresh snapshot, so the
resolved value refreshes whenever *any* input changes.

**The song's dimension reaches the resolver.** The catalog records one, the
React Native client narrows it (`mobile/src/domain/dimension.ts`) and the bridge
carries it: `prepare` metadata includes the song's `dimension`, the native
module (`NativeAdaptiveAudioModule`) holds it and asks the resolver for that
dimension, and only it, to select the track. Holding it in the module rather
than the library keeps the library ignorant of songs and stops a song switch
racing a stale dimension into selection. The resolved dimension, the resolved
value that drives selection, and the per-input diagnostic readings ride back to
JS on the `onDimensionChanged` event — see
[`native-bridge-contract.md`](native-bridge-contract.md).

### The aggregate weights

`volume` 0.5, `movementSpeed` 0.3, `heartRate` 0.2, written down in exactly one
place — the member list in `InputReadings.aggregate()`, which pairs each reading
with its own weight. They are renormalized over whatever is available (the
implementation divides by the weight actually present, which is the same thing),
so they only need to sum to `1.0` when every member is available.

**Today only the volume input exists**, so `intensity` is a one-member aggregate
identical to `volume` exactly, and `heartRate`/`movementSpeed` are always held
at `5`. That is deliberate: the accelerometer was judged a mistake and deleted
before its replacements landed, and a one-member aggregate exercises the
renormalization path from the first commit rather than the fourth.

Two properties worth knowing before touching the formula:

- **`kotlin.math.round` is round-half-to-even**, not half-up. An exact `.5`
  rounds to the even integer, so readings of `(volume 1, movementSpeed 0,
  heartRate 0)` resolve to `0`. Pinned by unit test. It matters only if the
  formula is ever reimplemented outside Kotlin - which the ADR rules out.
- **The resolved value is not clamped.** It is bounded to `0-9` only because
  every input is and the renormalized weights sum to 1.

### Adding an input

1. **The input itself** - implement `AdaptizerInput`, normalize to `0-9`, make
   `initialize()`/`release()` idempotent, report `isAvailable` honestly and fire
   the change listener when it flips. Cover it with Robolectric tests like
   `VolumeInputTest`.
2. **`Adaptizer`** - pass it in the matching constructor parameter. An input
   left unwired is indistinguishable from one reporting itself unavailable.
3. **The member list in `InputReadings.aggregate()`** - only if the aggregate
   should gain a member; changing a weight is a one-line change there and
   nothing else.
4. **The bridge payload** - `onDimensionChanged` ships one diagnostic field per
   input (`volume`, `movementSpeed`, `heartRate`, each `-1` when unavailable),
   so it gains one too. That is a contract change: see
   [`native-bridge-contract.md`](native-bridge-contract.md) and update it and
   the TypeScript types in the same change.

Note what does *not* change: the `0-9` output range, the ten-representation
manifest contract (section 4), and the rule that React Native only observes the
resolved value and never contributes to or overrides it.

## 2. Input: device volume

Weight in the aggregate: **0.5**. Always available: every device has a music
stream, and reading it needs no permission and no hardware that can be absent.
This is why the aggregate always has at least one member and never has to handle
an empty set. `adaptizer/inputs/VolumeInput.kt`:

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

## 3. Inputs not yet built

`movementSpeed` (weight 0.3) and `heartRate` (weight 0.2) have no input behind
them yet. Until they do, both dimensions are held at `5` and neither
contributes to the aggregate.

There was previously an accelerometer input, weighted 0.25, reading phone shake.
It was deleted: shake is not a meaningful measure of listening context, and
telling a listener to shake their phone to hear the song change is not a
feature. The legacy `app/` Android module went with it, since it constructed
that input directly.

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
| Songs API | `https://adaptizer.marcin93w.workers.dev` - `GET /` returns `List<Song>` (`id`, `author`, `album`, `name`, `storage_location`, `dimension`) |
| Media | `https://pub-fb297744d1fd4584a256f702d29363a8.r2.dev/{storageLocation}/manifest.mpd` |
| Now-playing label | `"{author} - {name}"` |

The React Native client centralizes both base URLs in `mobile/src/config/`. The
songs API is a Cloudflare Worker backed by a D1 catalog; its source lives in
[`../../API/`](../../API/README.md).

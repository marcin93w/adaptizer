# Native bridge contract - `NativeAdaptiveAudio` TurboModule

The typed boundary between the React Native shell and the Kotlin adaptive audio
engine. This document defines names, payload shapes and semantics; the
executable form is the Codegen specification at
`mobile/src/specs/NativeAdaptiveAudio.ts`, with the Kotlin implementation in
`mobile/android/app/src/main/java/com/adaptizerplayer/rn/adaptiveaudio/NativeAdaptiveAudioModule.kt`.

**Ownership boundary.** React Native issues commands and receives events. All
adaptation decisions - which representation to play, and when - are made in
Kotlin. See [`adr/0001-react-native-shell-with-kotlin-adaptive-audio.md`](adr/0001-react-native-shell-with-kotlin-adaptive-audio.md)
and [`adaptive-audio.md`](adaptive-audio.md).

## Commands: JS to Kotlin

| Command | Signature | Description |
| --- | --- | --- |
| `prepare` | `prepare(sourceUri: string, metadata: { id: string; title: string; artist: string; dimension: string }): void` | Creates and prepares the DASH media source for `sourceUri` (the manifest URL, e.g. the `.../{storageLocation}/manifest.mpd` path in [`adaptive-audio.md`](adaptive-audio.md) section 6). Does not start playback. `metadata.id` is the catalog song identifier as a string (stringified form of `Song.id: Int`); `metadata.title` and `metadata.artist` are supplied for host-side reference (e.g. media-session/notification metadata) and are not required to reproduce the `"{author} - {name}"` now-playing label, which stays a presentation concern in React Native. `metadata.dimension` is the song's adaptation dimension — one of the four identical-string contract names `volume`, `heartRate`, `movementSpeed`, `intensity` — carried byte-identical (never re-cased or mapped) and held by the native module, which resolves it, and only it, to drive track selection. An unrecognised name resolves as the aggregate rather than being rejected. Calling `prepare` while a previous source is prepared replaces it, and re-resolves for the new song's dimension. |
| `play` | `play(): void` | Starts or resumes playback of the currently prepared source. No-op (or `not_initialized` error, see taxonomy below) if nothing has been prepared. |
| `pause` | `pause(): void` | Pauses playback. No-op if already paused or nothing is prepared. |
| `seekTo` | `seekTo(positionMs: number): void` | Seeks the current source to `positionMs` (milliseconds from the start of the media). Out-of-range values are clamped to the valid duration by the Kotlin implementation. |
| `release` | `release(): void` | Releases the underlying player and any Kotlin-owned native inputs associated with this module instance. After `release`, all other commands must resolve as `not_initialized` rather than throwing or being silently ignored, and must not be reachable again without a new `prepare`. |

**Explicitly not included:** there is no `stop()` distinct from `pause()` plus a
fresh `prepare()`, and no command to set the dimension value or the track (see
"API constraint" below).

## Events: Kotlin to JS

| Event | Payload | Description |
| --- | --- | --- |
| `onPlaybackState` | `{ state: PlaybackState; sourceId: string \| null }` | Fired whenever the player's playback state changes (see Playback states below). `sourceId` is the `metadata.id` passed to the most recent `prepare` call, or `null` if nothing is prepared. |
| `onProgress` | `{ positionMs: number; durationMs: number; bufferedMs: number }` | Fired periodically during playback (and at minimum once immediately after a successful seek) to drive progress UI. `durationMs` is `-1` if not yet known. `bufferedMs` is the buffered position, always `>= positionMs`. |
| `onDimensionChanged` | `{ dimension: string; value: number; volume: number; movementSpeed: number; heartRate: number }` | Fired whenever the current song's dimension is re-resolved - any input changing, a new reading or an availability flip alike - see [`adaptive-audio.md`](adaptive-audio.md) sections 1-3. `dimension` is the resolved dimension the module used (the current song's, one of the four contract names); `value` is the resolved value `0-9` that actually drives track selection. `volume`, `movementSpeed` and `heartRate` are the per-input diagnostic readings, each an integer `0-9` or `-1` when that input is unavailable (the same `-1` sentinel `onProgress.durationMs` uses) - so the same fields report what each input read *and* which inputs are unavailable. Inputs never fabricate a value, so a non-`-1` reading is always a real measurement. **The input set is expected to grow** (and has shrunk once, when the accelerometer was deleted): consumers render `value` and treat the per-input fields as an open, diagnostics-only set. Adding or removing an input changes those fields and is a contract change. Presentation only; it implies no JS-side decision-making. |
| `onTrackChanged` | `{ requestedIndex: number; selectedIndex: number; availableCount: number }` | Fired whenever the Kotlin track selector processes a track-change request. `requestedIndex` is the index Kotlin attempted to select; `selectedIndex` is the index ExoPlayer actually applied (normally equal, but may differ if the request was rejected - see `unsupported_track`); `availableCount` is the number of audio representations detected in the prepared manifest's first `AdaptationSet`. Diagnostics/UI only. |
| `onPlayerError` | `{ code: ErrorCode; message: string; recoverable: boolean }` | Fired on any player, manifest, network, decoder or lifecycle error. See error taxonomy below. |

## Error taxonomy

Every error surfaced to JS (via `onPlayerError`, and via command rejections
where applicable) uses one of these stable string codes plus a
`recoverable: boolean` indicating whether the same prepared source can plausibly
recover without a fresh `prepare()`.

| Code | Meaning | Typical `recoverable` |
| --- | --- | --- |
| `network` | A network-level failure loading the manifest or media segments (timeout, DNS failure, connection reset, non-2xx response). | `true` - the engine may retry automatically; UI should offer a manual retry if it does not resolve. |
| `manifest` | The DASH manifest was malformed, unparsable, or did not contain the expected single audio `AdaptationSet` shape. | `false` - a broken manifest will not fix itself; treat the source as broken. |
| `unsupported_track` | The manifest's actual representation count did not match the expected ten-representation contract, and the requested track index could not be honored. | `false` for the specific index; the source may still be playable at a supported index. |
| `decoder` | The platform decoder failed to initialize or decode the selected representation (codec/format error). | `false` in general; may be `true` if switching to a different supported representation is expected to succeed. |
| `lifecycle` | A command was issued in an invalid lifecycle state other than "not yet initialized" (for example after `release()` completed, or during a disallowed transitional state). | `false` - a caller sequencing mistake; no automatic recovery. |
| `not_initialized` | A transport command (`play`, `pause`, `seekTo`) was issued before any `prepare()`, or after `release()`. | `false` until a new `prepare()` succeeds. |
| `unknown` | Anything that does not fit the above. Always includes a non-empty `message` with as much detail as is safely loggable. | `false` unless the underlying cause is later reclassified. |

`message` is a short, human/log-readable description. It is **not** part of the
stable contract - wording may change and JS logic must never pattern-match it.
Only `code` is stable.

## Playback states

`PlaybackState` is a closed string union:

`"idle" | "buffering" | "ready" | "playing" | "paused" | "ended"`

| State | Meaning |
| --- | --- |
| `idle` | No source prepared, or the module was just released. |
| `buffering` | A source is prepared/playing but is currently buffering (initial load or a mid-playback stall). |
| `ready` | A source is prepared and has enough buffered data to play, but is not currently advancing (post-`prepare`, pre-`play`, or after a completed seek while paused). |
| `playing` | Actively playing. |
| `paused` | Paused by an explicit `pause()` call (or equivalent host-level pause) with a valid position to resume from. |
| `ended` | Playback reached the end of the current source. |

Transitions are reported via `onPlaybackState`; no state is skipped silently
(`idle` -> `playing` is expected to pass through `buffering` and/or `ready`
first, matching normal ExoPlayer state semantics).

## API constraint

There is no production `setDimension()`, `setIntensity()` or `selectTrack()`
command in the JavaScript API, and none is planned. Adaptation decisions stay
entirely inside `adaptive-audio/`, driven by the device inputs and the
`Adaptizer`/`AdaptizerTrackSelector` pipeline against the current song's
dimension. React Native only ever *observes* adaptation outcomes via
`onDimensionChanged` and `onTrackChanged`; it never *requests* a specific value
or track.

Debug-only input overrides may exist behind a build-time guard for deterministic
testing, but any such override is excluded from release builds and is not part
of this contract. If one is added, it must be named and gated so it cannot be
mistaken for a production API - kept out of the release Codegen spec entirely
rather than exposed and no-op'd.

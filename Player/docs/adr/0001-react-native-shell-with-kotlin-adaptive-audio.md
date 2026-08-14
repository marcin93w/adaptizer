# 0001 - React Native shell with Kotlin-owned adaptive audio

**Status:** Accepted

**Date:** 2026-08-01

## Context

The product started as a single-module native Android app (`app/`) that renders a song catalog, plays adaptive DASH/WebM/Opus audio through Media3 ExoPlayer, and continuously derives a 0-9 "intensity" value from device volume and accelerometer input to select among ten pre-encoded representations of the same track (`AdaptizerTrackSelector`/`AdaptizerTrackSelection`, `Adaptizer`/`AdaptizerState`, `VolumeInput`/`AccelerometerInput` - see [`../adaptive-audio.md`](../adaptive-audio.md)).

The product shell (UI, catalog networking, screen state) moves to React Native and TypeScript. The adaptive audio behavior - track selection driven by volume and motion - is the product's defining, latency-sensitive feature and depends on:

- Media3 ExoPlayer and a custom `MappingTrackSelector`/`BaseTrackSelection` pair that performs explicit representation selection and one-shot queue invalidation on switch.
- Android `AudioManager` stream-volume queries plus a `VOLUME_CHANGED_ACTION` broadcast listener.
- Android `SensorManager`/`Sensor.TYPE_ACCELEROMETER` readings with a hand-rolled throttle/stop-delay coroutine loop (2 s interval, 2 s stop-delay).

None of the above has a natural, low-latency equivalent in the JavaScript engine that hosts React Native. Moving any of it to TypeScript would put high-frequency sensor sampling and track-selection timing on the JS thread/event loop. Track selection and sensor decisions stay on the Android main/native side; React Native receives state events but does not decide which DASH representation to play.

A decision is needed on: how the two runtimes are organized in the repository, which CLI/tooling generates the React Native app, which JavaScript architecture the native bridge uses, whether an existing community video player library is adopted, and how long the legacy `app/` module is retained.

## Decision

1. **Additive `mobile/` React Native application.** A new React Native app is created under `mobile/` alongside the existing `app/` module. The legacy app remains buildable and installable side by side with `mobile/` until cutover.
2. **`adaptive-audio/` Kotlin Gradle library.** The adaptive audio implementation - ExoPlayer ownership, `AdaptizerTrackSelector`/`AdaptizerTrackSelection`, `Adaptizer`/`AdaptizerState`, `VolumeInput`/`AccelerometerInput` - is extracted into a reusable Android library Gradle module, `adaptive-audio/`, consumed by both the legacy app (transitionally) and the new native module.
3. **Android-first scope.** This ADR covers the Android React Native application only. iOS is an explicit, separately scoped follow-up because the retained engine is Android-specific (Media3/ExoPlayer, Android volume APIs, Android sensors, DASH/WebM/Opus) and the standard Apple playback path (AVFoundation/HLS) is a different engine entirely. See "iOS" below.
4. **Bare React Native Community CLI, not Expo.** `mobile/` is scaffolded with the current supported React Native Community CLI TypeScript template.
5. **TypeScript** for all product-shell code in `mobile/` (screens, catalog client, state, and the typed JS side of the native-module contract).
6. **New Architecture TurboModule.** The Kotlin bridge is exposed as a typed Turbo Native Module (Codegen-generated), not the legacy bridge, so the JS-side API surface is statically typed end to end (see [`../native-bridge-contract.md`](../native-bridge-contract.md)).
7. **No `react-native-video`.** The playback engine is not replaced by a community video-player package. `adaptive-audio/` keeps direct ownership of ExoPlayer, DASH media-source creation, the custom track selector and transport operations; the TurboModule is a thin, typed pass-through to that engine.
8. **Kotlin retains ownership of ExoPlayer, track selection, intensity calculation and device inputs.** React Native issues commands (`prepare`, `play`, `pause`, `seekTo`, `release`) and receives typed events (`onPlaybackState`, `onProgress`, `onIntensityChanged`, `onTrackChanged`, `onPlayerError`); it never computes intensity, never picks a track index, and never touches `AudioManager`/`SensorManager` directly. See [`../native-bridge-contract.md`](../native-bridge-contract.md) for the contract and its explicit "no `setIntensity()`/`selectTrack()` in production JS" constraint.
9. **Legacy `app/` is retained until post-cutover deletion.** `app/` remains the production artifact and rollback reference until the React Native app has shipped and soaked in production. It is deleted only in its own isolated, deletion-only change, keeping rollback a simple branch/tag operation in the meantime.

**Update, 2026-08-13 (decision 9 superseded).** `app/` was deleted as part of the adaptation-dimensions work ([issue #22](https://github.com/marcin93w/adaptizer/issues/22)), not as an isolated deletion-only change. It constructed the accelerometer input directly, and that input was being deleted as a mistake, so leaving the module in place would have broken the Gradle build for the whole project. Rollback to the legacy app remains a branch/tag operation, just to a commit before that change rather than to the tip. Everything else here stands.

**Update, 2026-08-14 (decisions 2 and 8 evolved).** The Kotlin library now resolves the song's named dimension from device volume, BLE heart rate, and movement speed; the accelerometer is no longer an input. The bridge event is now `onDimensionChanged`, carrying the resolved dimension and value plus per-input diagnostics. Kotlin still exclusively owns input handling, dimension resolution, ExoPlayer, and representation selection, so the runtime boundary established by this ADR is unchanged. See the repository-wide [dimension-by-name ADR](../../../docs/adr/0001-songs-declare-their-adaptation-dimension-by-name.md) and the [current bridge contract](../native-bridge-contract.md).

## Consequences

**Positive**

- High-frequency, latency-sensitive work (sensor sampling, volume polling, track selection, queue invalidation) stays on the same runtime and thread discipline it already uses today; migrating the UI does not introduce a new source of adaptation jitter or JS-thread contention.
- The legacy app and the new app can be installed side by side (`mobile/` uses a temporary debug application ID) and compared directly against each other.
- `adaptive-audio/` becomes independently unit-testable (table-driven intensity tests, characterization tests against a deterministic DASH fixture) without an emulator or a React Native host.
- A typed TurboModule contract, frozen before implementation, lets product UI and Kotlin engine work proceed in parallel against a shared mock.
- Deferring `react-native-video` avoids adopting a general-purpose player abstraction that does not model this app's explicit ten-representation manual selection and one-shot queue-clear behavior, and that would likely require forking or monkey-patching to preserve it.
- Deleting `app/` only after a soak period keeps rollback a simple branch/tag operation.

**Negative / costs**

- Two build systems and two application shells (Gradle/Kotlin and Node/React Native's Gradle-wrapped Android build) must be maintained simultaneously until cutover, increasing CI time and local setup complexity.
- The typed bridge is an additional layer between UI and engine; every new command or event requires coordinated changes across the Codegen spec, the Kotlin implementation and the TypeScript consumer, rather than a single-language change.
- iOS is explicitly out of scope; stakeholders expecting a cross-platform outcome from "moving to React Native" must be told that only the UI/TypeScript layer is cross-platform-ready, not the playback engine, until a separate iOS engine project is approved and executed.
- Keeping `app/` buildable and otherwise unchanged means some legacy defects are knowingly left unresolved in `app/` itself; they are addressed only in the extracted `adaptive-audio/` library, not backported to the legacy call sites beyond what keeping `app/` compiling requires.

## Alternatives considered

**`react-native-video` as the playback engine.** Rejected. `react-native-video` is built around a single active source and does not natively model "ten explicit pre-encoded representations of the same track, manually selected by an external, non-bandwidth-driven signal, with one-shot queue invalidation on switch." Adopting it would mean either forcing the existing `AdaptizerTrackSelector`/`AdaptizerTrackSelection` behavior through an API not designed for it, or forking the library.

**Rewriting the adaptation logic in TypeScript.** Rejected. Volume polling, accelerometer sampling, the 2-second throttle/stop-delay behavior, and ExoPlayer track selection are all latency-sensitive and synchronous with Android's own event delivery. Moving any of this to the JS thread makes adaptation timing dependent on JS event-loop scheduling and bridge round-trips. No JavaScript timer, sensor package or player library is required to make adaptation decisions, and none should be introduced. It would also mean re-deriving and re-verifying the exact intensity formula and manifest-index behavior in a second language.

**Big-bang rewrite (replace `app/` in place, no parallel `mobile/`).** Rejected. A big-bang rewrite removes the ability to compare the new app against the working legacy app, forces one enormous unreviewable change, and eliminates the "branch revert is rollback" property that holds until cutover.

**Expo (managed or bare-with-Expo-modules workflow).** Rejected for this project. The product's defining functionality is a custom native TurboModule wrapping ExoPlayer, a hand-rolled track selector and raw Android sensor/audio APIs - none of which are part of Expo's managed module set, and all of which require full control over native Gradle configuration and Codegen. The bare React Native Community CLI template gives direct control over `android/` without an additional abstraction layer to work around.

## iOS

The React Native UI and TypeScript catalog code can be cross-platform, but the retained engine cannot run on iOS: it uses Android Media3/ExoPlayer, Android volume APIs and Android sensors, and the media is DASH with WebM/Opus representations while the standard Apple playback path is AVFoundation/HLS. `mobile/ios/` exists from the template and builds, but there is no iOS adaptive-audio implementation - `packages/adaptive-audio/src/index.ios.ts` is a deliberate unsupported stub.

If iOS becomes a requirement, it is its own project, not a continuation of this one:

1. Create HLS/CMAF media packaging with separately selectable intensity renditions and verify codec support.
2. Implement an equivalent Swift AVFoundation engine behind the same TypeScript contract, or select a third-party native player after a prototype.
3. Reuse the React Native screens and the bridge contract, but treat playback parity as a fresh baseline with its own release gates.

## References

- [`../adaptive-audio.md`](../adaptive-audio.md) - intensity formula, input normalization, manifest contract
- [`../native-bridge-contract.md`](../native-bridge-contract.md) - the typed JS/Kotlin boundary
- [React Native: Turbo Native Modules](https://reactnative.dev/docs/turbo-native-modules-introduction)
- [React Native: Platform-specific code](https://reactnative.dev/docs/platform-specific-code.html)
- [Android Media3: Track selection](https://developer.android.com/media/media3/exoplayer/track-selection)
- [Android Media3: ExoPlayer customization](https://developer.android.com/media/media3/exoplayer/customization)
- [Apple AVPlayer overview](https://developer.apple.com/documentation/avfoundation/avplayer)
- [Apple HTTP Live Streaming overview](https://developer.apple.com/documentation/HTTP-Live-Streaming)

# 0001 - React Native shell with Kotlin-owned adaptive audio

**Status:** Proposed (Phase 0, M01 - awaiting architecture review sign-off per `REACT_NATIVE_MIGRATION_PLAN.md`)

**Date:** 2026-08-01

**Depends on:** M00 (`docs/migration/M00-baseline.md`)

## Context

The current product is a single-module native Android app (`app/`) that renders a song catalog, plays adaptive DASH/WebM/Opus audio through Media3 ExoPlayer, and continuously derives a 0-9 "intensity" value from device volume and accelerometer input to select among ten pre-encoded representations of the same track (`AdaptizerTrackSelector`/`AdaptizerTrackSelection`, `Adaptizer`/`AdaptizerState`, `VolumeInput`/`AccelerometerInput` - see `docs/migration/M00-baseline.md` sections 2-4).

The organization wants to move the product shell (UI, catalog networking, screen state) to React Native and TypeScript, per the migration plan's target outcome. The adaptive audio behavior - track selection driven by volume and motion - is the product's defining, latency-sensitive feature and currently depends on:

- Media3 ExoPlayer and a custom `MappingTrackSelector`/`BaseTrackSelection` pair that performs explicit representation selection and one-shot queue invalidation on switch.
- Android `AudioManager` stream-volume queries plus a `VOLUME_CHANGED_ACTION` broadcast listener.
- Android `SensorManager`/`Sensor.TYPE_ACCELEROMETER` readings with a hand-rolled throttle/stop-delay coroutine loop (2s interval, 2s stop-delay; see M00 section 2).

None of the above has a natural, low-latency equivalent in the JavaScript engine that hosts React Native. Moving any of it to TypeScript would put high-frequency sensor sampling and track-selection timing on the JS thread/event loop, which is exactly the kind of dependency the migration plan's guardrails rule out ("Keep track selection and sensor decisions on the Android main/native side. React Native receives state events but does not decide which DASH representation to play.").

A decision is needed on: how the two runtimes are organized in the repository, which CLI/tooling generates the React Native app, which JavaScript architecture the native bridge uses, whether an existing community video player library is adopted, and how long the legacy `app/` module is retained.

## Decision

1. **Additive `mobile/` React Native application.** A new React Native app is created under `mobile/` alongside the existing `app/` module. The legacy app is not modified beyond what later, separately reviewed steps require, and remains buildable and installable side by side with `mobile/` until cutover (R01/R02).
2. **`adaptive-audio/` Kotlin Gradle library.** The adaptive audio implementation - ExoPlayer ownership, `AdaptizerTrackSelector`/`AdaptizerTrackSelection`, `Adaptizer`/`AdaptizerState`, `VolumeInput`/`AccelerometerInput` - is extracted into a reusable Android library Gradle module, `adaptive-audio/`, consumed by both the legacy app (transitionally) and the new native module.
3. **Android-first scope.** This ADR and the plan it belongs to cover the Android React Native application only. iOS is an explicit, separately scoped follow-up (see `REACT_NATIVE_MIGRATION_PLAN.md` section 7) because the retained engine is Android-specific (Media3/ExoPlayer, Android volume APIs, Android sensors, DASH/WebM/Opus) and the standard Apple playback path (AVFoundation/HLS) is a different engine entirely.
4. **Bare React Native Community CLI, not Expo.** `mobile/` is scaffolded with the current supported React Native Community CLI TypeScript template.
5. **TypeScript** for all product-shell code in `mobile/` (screens, catalog client, state, and the typed JS side of the native-module contract).
6. **New Architecture TurboModule.** The Kotlin bridge is exposed as a typed Turbo Native Module (Codegen-generated), not the legacy bridge, so the JS-side API surface is statically typed end to end (see `docs/migration/bridge-contract.md`).
7. **No `react-native-video`.** The playback engine is not replaced by a community video-player package. `adaptive-audio/` keeps direct ownership of ExoPlayer, DASH media-source creation, the custom track selector and transport operations; the TurboModule is a thin, typed pass-through to that engine.
8. **Kotlin retains ownership of ExoPlayer, track selection, intensity calculation and device inputs.** React Native issues commands (`prepare`, `play`, `pause`, `seekTo`, `release`) and receives typed events (`onPlaybackState`, `onProgress`, `onIntensityChanged`, `onTrackChanged`, `onPlayerError`); it never computes intensity, never picks a track index, and never touches `AudioManager`/`SensorManager` directly. See `docs/migration/bridge-contract.md` for the frozen contract and its explicit "no `setIntensity()`/`selectTrack()` in production JS" constraint.
9. **Legacy `app/` is retained until post-soak deletion.** `app/` remains the production artifact and rollback reference through Phase 5 (R01/R02). It is deleted only in its own, isolated, deletion-only pull request after a production soak period with no stop-threshold breaches, per the migration plan's rollback strategy (`REACT_NATIVE_MIGRATION_PLAN.md` section 6).

## Consequences

**Positive**

- High-frequency, latency-sensitive work (sensor sampling, volume polling, track selection, queue invalidation) stays on the same runtime and thread discipline it already uses today; migrating the UI does not introduce a new source of adaptation jitter or JS-thread contention.
- The legacy app and the new app can be installed side by side (`mobile/` uses a temporary debug application ID, per A01) and compared directly against the M00 baseline and parity matrix throughout the migration.
- `adaptive-audio/` becomes independently unit-testable (table-driven intensity tests, characterization tests against a deterministic DASH fixture) without an emulator or a React Native host, ahead of any bridge work.
- A typed TurboModule contract, frozen before implementation (D01), lets Lane C (product UI) and Lane B (Kotlin engine) proceed in parallel against a shared mock.
- Deferring `react-native-video` avoids adopting a general-purpose player abstraction that does not model this app's explicit ten-representation manual selection and one-shot queue-clear behavior, and that would likely require forking or monkey-patching to preserve it.
- Deleting `app/` only after a dedicated soak period keeps rollback a simple branch/tag operation for the entire migration, matching the plan's stated rollback strategy.

**Negative / costs**

- Two build systems and two application shells (Gradle/Kotlin and Node/React Native's Gradle-wrapped Android build) must be maintained simultaneously for the duration of the migration, increasing CI time and local setup complexity.
- The typed bridge is an additional layer between UI and engine; every new command or event requires coordinated changes across the Codegen spec, the Kotlin implementation and the TypeScript consumer, rather than a single-language change.
- iOS is explicitly out of scope; stakeholders expecting a cross-platform outcome from "moving to React Native" must be told that only the UI/TypeScript layer is cross-platform-ready, not the playback engine, until a separate iOS engine project is approved and executed.
- Keeping `app/` buildable and unchanged for the duration of the migration means some legacy defects (see `docs/migration/M00-baseline.md` section 6) are knowingly left unresolved in `app/` itself; they are addressed only in the extracted `adaptive-audio/` library (B01/B03), not backported to the legacy call sites beyond what B02/B03 require to keep `app/` compiling.

## Alternatives considered

**`react-native-video` as the playback engine.** Rejected. `react-native-video` is built around a single active source and does not natively model "ten explicit pre-encoded representations of the same track, manually selected by an external, non-bandwidth-driven signal, with one-shot queue invalidation on switch." Adopting it would mean either forcing the existing `AdaptizerTrackSelector`/`AdaptizerTrackSelection` behavior through an API not designed for it, or forking the library - both costs the migration plan explicitly wants to avoid ("Do not replace the player with react-native-video," non-goals section).

**Rewriting the adaptation logic in TypeScript.** Rejected. Volume polling, accelerometer sampling, the 2-second throttle/stop-delay behavior, and ExoPlayer track selection are all latency-sensitive and currently synchronous with Android's own event delivery. Moving any of this to the JS thread makes adaptation timing dependent on JS event-loop scheduling and bridge round-trips, which the migration plan's guardrails explicitly prohibit ("No JavaScript timer, sensor package or player library is required to make adaptation decisions," success criteria). It would also mean re-deriving and re-verifying the exact intensity formula and manifest-index behavior in a second language, doubling the surface area for the very defects M00 exists to catch.

**Big-bang rewrite (replace `app/` in place, no parallel `mobile/`).** Rejected. A big-bang rewrite removes the ability to compare the new app against the working legacy app at every step, forces one enormous, unreviewable pull request, and eliminates the "branch revert is rollback" property the plan relies on before R01. The migration plan's delivery model explicitly calls for small, independently reviewable, additive pull requests instead.

**Expo (managed or bare-with-Expo-modules workflow).** Rejected for this project. The product's defining functionality is a custom native TurboModule wrapping ExoPlayer, a hand-rolled track selector and raw Android sensor/audio APIs - none of which are part of Expo's managed module set, and all of which require full control over native Gradle configuration and Codegen. The bare React Native Community CLI template gives direct control over `android/` without an additional abstraction layer to work around.

## References

- `REACT_NATIVE_MIGRATION_PLAN.md` (sections 1, 2, 4 M00/M01, 6, 7, 8, Appendix A)
- `docs/migration/M00-baseline.md`
- `docs/migration/bridge-contract.md`

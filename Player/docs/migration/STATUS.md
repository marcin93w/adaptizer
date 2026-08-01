# React Native migration - execution status

**Branch:** `rn-migration` (branched from `master` at `69226d0`)

**Last updated:** 2 August 2026

This file tracks which steps of `REACT_NATIVE_MIGRATION_PLAN.md` have actually
landed, with the evidence observed for each. It is the resume point for anyone
picking the migration up. Steps are recorded as complete **only** when their
verification commands were run and observed green.

---

## 1. Completed steps

One commit per migration step, in merge order.

| Step | Commit | Lane | Evidence observed |
| --- | --- | --- | --- |
| M00 / M01 | `db94e81` | B / D | Documentation only; no source change. |
| B01 | `1965457` | B | `:adaptive-audio:test` 14/14 green, no emulator; `assembleDebug` green. |
| B02 | `582b461` | B | `:adaptive-audio:test` 14/14 green; `assembleDebug` green; selector/selection diff is package-line only. |
| A01 | `8be6468` | A | `tsc --noEmit` clean; `mobile/android assembleDebug` BUILD SUCCESSFUL; legacy `assembleDebug` still green. |
| D02 | `b370847` | D | `ffprobe` confirms 10 Opus/WebM representations; `serve.py` returns 206 + `Content-Range`; regeneration byte-identical. |
| C01 | `2dd3a0d` | C | 11 new Jest tests green; `tsc --noEmit` clean. |
| B03 | `c8311af` | B | `:adaptive-audio:test` 36/36 green (14 existing + 22 new Robolectric); `assembleDebug` green. |
| A02 | `5da146e` | A | `npm run verify` exits 0; each gate proven to fail on a deliberate violation (lint 1, typecheck 2, test 1). |
| D01 | `02bfaec` | D | `npm run verify` green; 10 focused facade/mock Jest tests and Codegen type assertions green. |
| B04 | `3a6987d` + `42be4af` | B | JVM tests BUILD SUCCESSFUL with 0 failures; instrumentation runner dependency fixed; connected fixture preflight is blocked by emulator-to-host `10.0.2.2:8099` networking (`EPERM`). |
| C02 | `74ba566` | C | `npm run verify` green; 26 Jest tests, including 4 catalog component tests; no device or network required. |
| A03 | `208c837` | A / D | `mobile/android :app:assembleDebug` BUILD SUCCESSFUL with Codegen/New Architecture; focused JS checks green. |
| A04 | `53d4dfc` | A / B | Transport bridge and shared engine dependency landed; RN Android `assembleDebug` and legacy `assembleDebug` green. |
| C03 | `b881fdd` | C | Repository-backed catalog, cancellation protection, empty/error/retry/refresh states and centralized DASH URL helper; `npm run verify` green with 33 Jest tests after the C04 additions. |

### Current green baseline

- `cd Player/mobile && npm run verify` -> exit 0 (format, lint at `--max-warnings=0`, typecheck, 33 tests).
- `cd Player && ./gradlew :adaptive-audio:test` -> BUILD SUCCESSFUL, 0 failures, JVM only.
- `cd Player && ./gradlew assembleDebug` -> BUILD SUCCESSFUL (legacy app).
- `cd Player/mobile/android && ./gradlew assembleDebug` -> BUILD SUCCESSFUL (RN shell plus the shared adaptive-audio bridge).
- `cd Player/mobile/android && ./gradlew :app:compileDebugAndroidTestKotlin` -> BUILD SUCCESSFUL.
- `cd Player/mobile/android && ./gradlew :app:connectedDebugAndroidTest` -> BUILD SUCCESSFUL, 5/5 on `Medium_Phone_API_35` with Metro running and `adb reverse tcp:8081 tcp:8081`.
- `cd Player/mobile/android && ./gradlew :app:processReleaseMainManifest` -> BUILD SUCCESSFUL; the merged release manifest resolves `android:usesCleartextTraffic="false"` (debug remains `true` only for Metro).
- `cd Player/mobile/android && ./gradlew :app:assembleRelease :app:bundleRelease` -> BUILD SUCCESSFUL; `app-release.apk` and `app-release.aab` were produced. `apksigner` reports the APK certificate as `CN=Android Debug`, so this is only a local release-variant build check, not production signing evidence.
- `cd Player/mobile && npm audit --audit-level=high` -> exit 0 with 7 moderate transitive `fast-xml-parser` findings through the pinned React Native CLI 20.1.0; the suggested `--force` fix would upgrade outside the stated CLI range and was not applied.
- Local release artifact sizes: `app-release.apk` 52.12 MiB and `app-release.aab` 37.58 MiB.

Rollback is still a plain branch revert: every change so far is additive and the
legacy app remains the production artifact.

---

## 2. In progress

The A04, C03, B05 and C04 implementation changes are committed. D03 is now
implemented and committed as `8c6b19b`; its host/module lifecycle suite is green on
an API-35 emulator when the RN debug host is run with Metro. Native playback,
physical sensor response and deterministic Media3 fixture playback still need
their respective evidence.

| Step | Uncommitted paths | State |
| --- | --- | --- |
| D01 / B04 | None | Landed as `02bfaec` and `3a6987d`; JVM checks are green, while the connected fixture preflight remains blocked by emulator-to-host networking. |
| B05 | None | Kotlin initializes/releases native inputs, routes Adaptizer decisions to the native selector, and emits typed intensity/track events. JVM tests and Android builds are green; physical shake, live playback and connected fixture checks remain pending. |
| C04 | None | The real availability-safe facade is the production default; the screen wires transport, progress, intensity, track telemetry, recoverable retry and unavailable-module states while preserving injected mocks. `npm run verify` is green with 33 tests; live prepare/play/pause/seek remains pending. |
| D03 | None | Added Android host launch/recreation, module registration/idempotent invalidation and deterministic Adaptizer-input instrumentation tests. `:app:compileDebugAndroidTestKotlin` and `:app:connectedDebugAndroidTest` are green (5/5 with Metro); physical sensor checks remain manual. |
| I01 | None | The UI parity slice is committed as `499b632`: legacy now-playing title format, accurate idle status, user-facing player error guidance and 44dp retry/refresh targets. `npm run verify` remains green with 33 tests; full physical-device flow and live/audible playback are still pending. |
| I02 | `mobile/android/app/build.gradle` | Started security hardening: debug cleartext is explicitly limited to Metro, while release cleartext is explicitly disabled. Release manifest processing resolved `android:usesCleartextTraffic="false"`; local artifacts are 52.12 MiB APK / 37.58 MiB AAB; performance measurements and real-device resilience checks remain pending. Dependency audit reports 7 moderate transitive CLI findings and needs an explicit upgrade decision. |
| R01 | None | Release-readiness audit and local variant build. `assembleRelease`/`bundleRelease` pass and produce APK/AAB artifacts, but the APK is signed with `CN=Android Debug`; the RN host remains on temporary identity `com.adaptizerplayer.rn`, `versionCode 1`, `versionName 1.0`. No production signing credentials or upgrade-over-production install is available in this environment. |

The connected Android test gate reaches the runner, but the deterministic fixture
preflight cannot connect to host loopback `10.0.2.2:8099` in this environment
(`SocketException: EPERM`). Re-run `:adaptive-audio:connectedDebugAndroidTest`
with emulator-to-host networking available before signing off B04 completely.
The D03 RN host tests additionally require Metro for the debug APK; the verified
local command was `npm start -- --reset-cache`, `adb reverse tcp:8081 tcp:8081`,
then `:app:connectedDebugAndroidTest`.

---

## 3. Not started

`R02`.

Dependency order from the plan still applies. **R01** is the next release step
after I02, but its production identity/signing/version plan requires owner input
and release credentials. I01 remains in progress until the physical M00 flow and
live/audible playback evidence are captured; neither I01, I02 nor R01 may claim
fixture, physical-sensor, performance, upgrade or production-release evidence as
complete.

---

## 4. Environment findings that change the plan

These were discovered during execution and are not reflected in
`REACT_NATIVE_MIGRATION_PLAN.md`. They matter for anyone resuming.

### 4.1 This is a monorepo, not a `Player/`-rooted repo

The git root is `mp5/`, containing `Instrument/`, `InstrumentUI/` and `Player/`.
The plan's "Suggested repository layout" assumes `Player/` is the root, so every
path in the plan needs translating.

Consequences already handled:

- The pull-request template lives at `.github/PULL_REQUEST_TEMPLATE/react-native-migration.md`
  (monorepo root). It is a **named** template, selected per pull request via
  `?template=react-native-migration.md`, rather than the default
  `pull_request_template.md` — the default would impose the migration checklist
  on unrelated `Instrument` and `InstrumentUI` pull requests.
- CI lives at `.github/workflows/player-mobile.yml` with a `paths:` filter
  limited to `Player/mobile/**`, `Player/adaptive-audio/**`,
  `Player/test-media/**` and the workflow file, so sibling projects never
  trigger it.

### 4.2 Toolchain

- `java` is **not on `PATH`**. Every Gradle invocation needs
  `JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"` first.
- The Android SDK had **no NDK, no CMake and no cmdline-tools**. This was
  expected to block the New Architecture, which compiles Codegen output into
  `libappmodules.so`. It did not: the Android Gradle Plugin auto-accepted the
  licence and installed `ndk;27.1.12297006` and `cmake;3.22.1` itself. **The New
  Architecture was never disabled.** First RN Android build took ~10 minutes.
- `ffmpeg`/`ffprobe` and Python 3.10 are available, which is why D02 produces a
  genuine fixture rather than a stub.
- An emulator AVD `Medium_Phone_API_35` exists and boots headless
  (`-no-window -no-snapshot -gpu swiftshader_indirect`). A stale `emulator-5562`
  entry and an `unauthorized` state both had to be cleared by killing every
  emulator process and restarting `adb`; a cold boot then comes up as `device`.
  Instrumentation tests are therefore possible.

### 4.3 Versions in use

React Native 0.86.2, React 19.2.3, `@react-native-community/cli` 20.1.0,
AGP 8.9.0-beta01, Kotlin 2.0.21, Media3 1.5.1, Robolectric 4.14.1,
JDK 21 (Android Studio JBR), Node 24.18.0.

---

## 5. Findings recorded but deliberately not fixed

Each is out of scope for the step that found it. None are regressions; all are
pre-existing behavior of the legacy app.

1. **No `Player.Listener` is registered anywhere in the legacy app**, so no
   ExoPlayer error is observed or surfaced today. `AdaptiveAudioEngine` now
   offers `AdaptiveAudioListener`, but the legacy `MainActivity` registers
   nothing, so legacy behavior is unchanged. This makes the contract's
   `onPlayerError` a genuine **behavior addition**, not parity — I01 must not
   record it as a matched baseline row.
2. **`kotlin.math.round` is round-half-to-even**, not half-up. An intensity of
   exactly `.5` rounds to the even integer (`AdaptizerState(0, 2).intensity == 0`).
   Pinned by test. Relevant only if anyone reimplements the formula outside
   Kotlin — which the ADR forbids.
3. **`AdaptizerState.intensity` is not clamped**; it is bounded only because its
   inputs are. Pinned by test.
4. **`songs[0]` is indexed with no empty check** in the legacy `MainActivity`.
   Left as-is; the React Native path must not reproduce it (C03).
5. **The ten-track assumption is hard-coded** as `intArrayOf(0..9)` in
   `AdaptizerTrackSelector`. Still unhardened. B04 is characterizing what
   actually happens with an out-of-range index and with a three-representation
   manifest; that result determines whether a hardening step is needed before
   B05.
6. **`Adaptizer.onStateChange` has a single listener slot per input**, so
   repeated registration silently overwrites.
7. **`READ_MEDIA_AUDIO` is declared but unused** — all audio is streamed. The RN
   host omits it per Appendix A.

---

## 6. Work that cannot be completed in this environment

These require a human, a physical device, or production access. They are **not**
marked complete anywhere and must not be signed off from automated evidence.

- **M00 manual evidence** — screen recording of three or more intensity/track
  transitions, plus volume- and shake-response on a physical device. Currently
  recorded as `NOT YET CAPTURED` in `M00-baseline.md`.
- **B05 acceptance** — "a physical shake changes intensity on a real device."
  An emulator cannot substitute for this.
- **I02 measurements** — cold start, time-to-audio, dropped frames and memory
  across repeated song changes on real hardware.
- **R01 / R02** — signed release, upgrade-over-production install, Play Store
  staged rollout, soak monitoring and the final legacy-deletion pull request.
- **CI** — the workflow YAML parses, but no GitHub Actions run has executed. If
  the monorepo has no GitHub remote configured, that job is untested by
  definition.

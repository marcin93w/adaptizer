# React Native migration - execution status

**Branch:** `rn-migration` (branched from `master` at `69226d0`)

**Last updated:** 1 August 2026

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

### Current green baseline

- `cd Player/mobile && npm run verify` -> exit 0 (format, lint at `--max-warnings=0`, typecheck, 26 tests).
- `cd Player && ./gradlew :adaptive-audio:test` -> BUILD SUCCESSFUL, 0 failures, JVM only.
- `cd Player && ./gradlew assembleDebug` -> BUILD SUCCESSFUL (legacy app).
- `cd Player/mobile/android && ./gradlew assembleDebug` -> BUILD SUCCESSFUL (RN shell plus the shared adaptive-audio bridge).

Rollback is still a plain branch revert: every change so far is additive and the
legacy app remains the production artifact.

---

## 2. In progress

The D01 and B04 changes that were previously mid-flight are now committed and verified.
A04 is implemented in the working tree and has passed its compile/build gates; it
has not been committed yet.

| Step | Uncommitted paths | State |
| --- | --- | --- |
| D01 / B04 | None | Landed as `02bfaec` and `3a6987d`; no migration-step files remain uncommitted. |
| A04 | `adaptive-audio/**`, `mobile/android/**`, `mobile/src/native/AdaptiveAudio.ts`, `mobile/src/specs/NativeAdaptiveAudio.ts` | Transport bridge implemented; shared engine dependency, main-thread dispatch and playback/progress/error event paths compile cleanly. Host teardown is wired in code; deterministic media harness/manual playback remains pending. Awaiting commit; UI remains on the C02 mock until C04. |

The connected Android test gate reaches the runner, but the deterministic fixture
preflight cannot connect to host loopback `10.0.2.2:8099` in this environment
(`SocketException: EPERM`). Re-run `:adaptive-audio:connectedDebugAndroidTest`
with emulator-to-host networking available before signing off B04 completely.

---

## 3. Not started

`C03`, `B05`, `C04`, `D03`, `I01`, `I02`, `R01`, `R02`.

Dependency order from the plan still applies. The next ready steps are **C03**
(connect the catalog API; needs C01 + C02), **B05** (enable Kotlin-owned
adaptation; needs A04 + B04), and **D03** (bridge contract/release evidence;
needs A04 + B04 + C04).

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

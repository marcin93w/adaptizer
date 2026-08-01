# A02 - Local checks and CI quality gates (Player/mobile)

**Migration step:** A02 (Lane A, depends on: A01)

**Purpose.** Document the single local command that mirrors CI for `Player/mobile`, what each gate checks, how to reproduce the Android debug build locally, and where local and CI intentionally diverge.

---

## 1. The one command

```
cd Player/mobile
npm run verify
```

`verify` runs, in order, and stops at the first failure: `format:check`, `lint`, `typecheck`, `test`. It is implemented as a plain Node script (`Player/mobile/scripts/verify.js`), not an `&&` shell chain, so it behaves identically on Windows (cmd.exe / PowerShell) and POSIX shells.

Exit code is `0` only if every step passed. Each step's own output (Prettier's file list, ESLint's problem list, `tsc`'s diagnostics, Jest's failures) is printed inline so you can see exactly what failed without re-running anything.

## 2. The individual scripts

All scripts live in `Player/mobile/package.json` and can be run individually with `npm run <script>`:

| Script | What it does |
| --- | --- |
| `format` | `prettier --write .` - reformats every file Prettier owns. |
| `format:check` | `prettier --check .` - fails if any file is not formatted. Run this, not `format`, in CI so CI never silently rewrites your branch. |
| `lint` | `eslint . --max-warnings=0` - the template's `@react-native` ESLint config, with warnings treated as failures. `.eslintignore` excludes `node_modules/`, `coverage/`, `android/` and `ios/` (native project files, not JS/TS - ESLint would otherwise also pick up generated files like `coverage/lcov-report/*.js`). |
| `typecheck` | `tsc --noEmit` - the whole TypeScript project, using `tsconfig.json` (which extends `@react-native/typescript-config`). No `.js` is emitted; this only checks types. |
| `test` | `jest` - the template's Jest config (`@react-native/jest-preset`). Runs once, locally, without coverage. |
| `test:ci` | `jest --ci --coverage` - same tests, plus a coverage report (written to `Player/mobile/coverage/`, which is gitignored). Use this form in CI so coverage evidence is captured. |
| `license-report` | `license-report --output=json --only=prod > license-report.json` - writes a JSON report of every production dependency's license. Evidence only; see section 5. |
| `verify` | Runs `format:check`, `lint`, `typecheck`, `test` in sequence; see section 1. |

`.prettierignore` excludes build output that isn't hand-authored: `android/build/`, `android/app/build/`, `android/app/.cxx/`, `android/.gradle/`, `android/.kotlin/`, `ios/build/`, `ios/Pods/`, generated Xcode project/asset-catalog files, `coverage/`, `license-report.json` and `package-lock.json`.

## 3. Reproducing the Android debug build locally

CI builds `Player/mobile/android` with `./gradlew assembleDebug` on a clean checkout (JDK 17, Android SDK installed fresh, no `local.properties`). To reproduce that locally:

```
cd Player/mobile/android
$env:JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"   # PowerShell; java is not on PATH on this machine
./gradlew assembleDebug
```

Notes:

- **`JAVA_HOME` is required.** `java` is not on PATH on this machine. Point `JAVA_HOME` at a JDK 17-compatible runtime - the JBR bundled with Android Studio (`C:\Program Files\Android\Android Studio\jbr`) works and is what was used to verify this step.
- **`local.properties`** (in `Player/mobile/android/`) is gitignored and machine-specific; it is not present in a fresh checkout or in CI. The Android Gradle Plugin falls back to the `ANDROID_HOME` / `ANDROID_SDK_ROOT` environment variable when `local.properties` is absent, which is what CI relies on (see section 4). Locally, if you already have Android Studio set up, `local.properties` is regenerated automatically and takes precedence; you do not need to delete it.
- The resulting debug APK is written to `Player/mobile/android/app/build/outputs/apk/debug/`. CI uploads this as the `player-mobile-debug-apk` workflow artifact.
- This does **not** touch `Player/app` (the legacy Android app) or any root Gradle file. The legacy app has its own build, unaffected by this workflow.

## 4. What CI runs that `npm run verify` does not

The workflow is `C:\projects\mp5\.github\workflows\player-mobile.yml` (repo root - GitHub only reads `.github/` at the git root of the `mp5` monorepo, not inside `Player/`). It is path-filtered to `Player/mobile/**`, `Player/adaptive-audio/**`, `Player/test-media/**` and the workflow file itself, so changes to sibling projects (`Instrument/`, `InstrumentUI/`) or to the legacy `Player/app` never trigger it.

Three jobs:

1. **`checks`** - `npm ci`, then `format:check`, `lint`, `typecheck`, `test:ci` (this is `verify`, plus coverage). This is the part `npm run verify` reproduces locally.
2. **`android-debug-build`** - JDK 17 (Temurin) + Android SDK setup, then `./gradlew assembleDebug` in `Player/mobile/android`, with the debug APK uploaded as an artifact. `npm run verify` does **not** build the Android app; reproduce this locally per section 3, or push a branch/PR and let CI do it.
3. **`audit`** - `npm audit --audit-level=high` and the `license-report` script, both `continue-on-error: true` (per the migration plan, these start as non-blocking evidence, uploaded as artifacts, not merge gates). Neither runs as part of `verify`; run them locally with `npm audit --audit-level=high` and `npm run license-report` if you want to see the same evidence.

The Gradle cache in `android-debug-build` is keyed on a hash of the Gradle build/config files (`android/**/*.gradle*` and `gradle-wrapper.properties`), not a static key, so a dependency version bump invalidates the cache instead of silently building against stale, cached dependencies.

## 5. Known gaps (honest status as of this writing)

- `npm run verify` / `format:check` currently fails against `Player/mobile/App.tsx` (unformatted per the shipped Prettier config, plus one ESLint warning for a deep `react-native/package.json` import). `App.tsx` is out of scope for A02 (owned by A01/product work); this document records the gate's correct behavior, not a claim that the whole tree is currently green. Whoever next touches `App.tsx` should run `npm run format` and resolve the `@react-native/no-deep-imports` warning before merging.
- The gates themselves were proven to fail correctly (deliberate lint, type and test violations each produced the expected non-zero exit code and were reverted afterward with a clean `git status`); see the A02 pull request evidence.
- CI cannot be executed locally; the `android-debug-build` and `audit` jobs are only verified by their scripted local equivalents (section 3 and section 4) plus YAML parsing of the workflow file, not an actual GitHub Actions run.

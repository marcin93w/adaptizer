# Quality gates - `Player/mobile`

The single local command that mirrors CI, what each gate checks, how to
reproduce the Android debug build locally, and where local and CI intentionally
diverge.

---

## 1. The one command

```bash
cd Player/mobile && npm run verify
```

`verify` runs, in order, stopping at the first failure: `format:check`, `lint`,
`typecheck`, `test`. It is implemented as a plain Node script
(`Player/mobile/scripts/verify.js`), not an `&&` shell chain, so it behaves
identically on Windows (cmd.exe / PowerShell) and POSIX shells.

Exit code is `0` only if every step passed. Each step's own output (Prettier's
file list, ESLint's problem list, `tsc`'s diagnostics, Jest's failures) is
printed inline so you can see what failed without re-running anything.

## 2. The individual scripts

All scripts live in `Player/mobile/package.json` and can be run individually
with `npm run <script>`:

| Script | What it does |
| --- | --- |
| `format` | `prettier --write .` - reformats every file Prettier owns. |
| `format:check` | `prettier --check .` - fails if any file is not formatted. Run this, not `format`, in CI so CI never silently rewrites a branch. |
| `lint` | `eslint . --max-warnings=0` - the `@react-native` ESLint config, warnings treated as failures. `.eslintignore` excludes `node_modules/`, `coverage/`, `android/` and `ios/` (native project files, plus generated output like `coverage/lcov-report/*.js`). |
| `typecheck` | `tsc --noEmit` - the whole TypeScript project via `tsconfig.json` (which extends `@react-native/typescript-config`). Types only, no emit. |
| `test` | `jest` - the `@react-native/jest-preset` config. Runs once, locally, without coverage. |
| `test:ci` | `jest --ci --coverage` - same tests plus a coverage report in `Player/mobile/coverage/` (gitignored). Use this form in CI so coverage evidence is captured. |
| `license-report` | Writes a JSON report of every production dependency's license. Evidence only; see section 4. |
| `android:device` | Builds, installs and launches the debug app on a connected device - see [`../mobile/README.md`](../mobile/README.md). |
| `verify` | Runs `format:check`, `lint`, `typecheck`, `test` in sequence; see section 1. |

`.prettierignore` excludes build output that isn't hand-authored:
`android/build/`, `android/app/build/`, `android/app/.cxx/`, `android/.gradle/`,
`android/.kotlin/`, `ios/build/`, `ios/Pods/`, generated Xcode project and
asset-catalog files, `coverage/`, `license-report.json` and `package-lock.json`.

## 3. Reproducing the Android debug build locally

CI builds `Player/mobile/android` with `./gradlew assembleDebug` on a clean
checkout (JDK 17, Android SDK installed fresh, no `local.properties`). Locally:

```bash
cd Player/mobile/android && ./gradlew assembleDebug
```

Notes:

- **`JAVA_HOME` is required** if `java` is not on PATH. Point it at a
  JDK 17-compatible runtime; the JBR bundled with Android Studio
  (`C:\Program Files\Android\Android Studio\jbr`) works:

  ```powershell
  $env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
  ```

- **`local.properties`** (in `Player/mobile/android/`) is gitignored and
  machine-specific; it is absent in a fresh checkout and in CI. The Android
  Gradle Plugin falls back to `ANDROID_HOME` / `ANDROID_SDK_ROOT` when it is
  missing, which is what CI relies on. Locally, Android Studio regenerates it
  automatically and it takes precedence - you do not need to delete it.
- The debug APK is written to
  `Player/mobile/android/app/build/outputs/apk/debug/`. CI uploads it as the
  `player-mobile-debug-apk` artifact.
- This does **not** touch the repo-root Gradle files under `Player/`.

### Kotlin library tests

The `adaptive-audio/` unit tests are JVM-only (Robolectric only where Android
classes are needed - the dimension resolver's own tests touch nothing Android)
and need no emulator:

```bash
cd Player && ./gradlew :adaptive-audio:test
```

Instrumentation tests under `adaptive-audio/src/androidTest/` and
`mobile/android/app/src/androidTest/` need a running device or emulator. The RN
host tests additionally need Metro reachable from the device:

```bash
cd Player/mobile && npm start -- --reset-cache
```

then, in a second shell, `adb reverse tcp:8081 tcp:8081` before running
`:app:connectedDebugAndroidTest`.

## 4. What CI runs that `npm run verify` does not

The workflow is `.github/workflows/player-mobile.yml` at the **monorepo root** -
GitHub only reads `.github/` at the git root of `mp5`, not inside `Player/`. It
is path-filtered to `Player/mobile/**`, `Player/adaptive-audio/**`,
`Player/test-media/**` and the workflow file itself, so changes to sibling
project (`Instrument/`) never triggers it.

Three jobs:

1. **`checks`** - `npm ci`, then `format:check`, `lint`, `typecheck`, `test:ci`.
   This is `verify` plus coverage, and the part `npm run verify` reproduces.
2. **`android-debug-build`** - JDK 17 (Temurin) plus Android SDK setup, then
   `./gradlew assembleDebug` in `Player/mobile/android`, with the debug APK
   uploaded as an artifact. `npm run verify` does **not** build the Android app;
   reproduce it per section 3 or let CI do it.
3. **`audit`** - `npm audit --audit-level=high` and the `license-report` script,
   both `continue-on-error: true`: evidence uploaded as artifacts, not merge
   gates. Neither runs as part of `verify`.

The Gradle cache in `android-debug-build` is keyed on a hash of the Gradle
build/config files (`android/**/*.gradle*` and `gradle-wrapper.properties`), not
a static key, so a dependency version bump invalidates the cache instead of
silently building against stale dependencies.

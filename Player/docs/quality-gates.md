# Quality gates - `Player/mobile`

The single local command that mirrors pull-request CI, what each gate checks,
how to reproduce the post-merge standalone Android build locally, and where
local and CI intentionally diverge.

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

## 3. Reproducing the standalone Android build locally

After Player changes land on `master`, CI builds `Player/mobile/android` with
`./gradlew assembleRelease` on a clean checkout (JDK 17, Android SDK installed
fresh, no `local.properties`). The release variant bundles the React Native
JavaScript, so the resulting APK runs without Metro or Expo. It currently uses
the debug signing configuration and is intended for direct testing, not store
distribution. Locally:

```bash
cd Player/mobile/android && ./gradlew assembleRelease
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
- The standalone APK is written to
  `Player/mobile/android/app/build/outputs/apk/release/app-release.apk`. CI
  uploads that file directly, without wrapping it in a ZIP archive.
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

The workflows are under `.github/workflows/` at the **monorepo root** - GitHub
only reads `.github/` at the git root of `mp5`, not inside `Player/`.

Pull requests run `.github/workflows/player-mobile.yml`, path-filtered to
`Player/mobile/**`, `Player/adaptive-audio/**`, `Player/test-media/**` and the
workflow file itself. It has two jobs and deliberately produces no APK:

1. **`checks`** - `npm ci`, then `format:check`, `lint`, `typecheck`, `test:ci`.
   This is `verify` plus coverage, and the part `npm run verify` reproduces.
2. **`audit`** - `npm audit --audit-level=high` and the `license-report` script,
   both `continue-on-error: true`: evidence uploaded as artifacts, not merge
   gates. Neither runs as part of `verify`.

Pushes to `master` that change anything under `Player/**` run
`.github/workflows/player-mobile-apk.yml`. Its `android-release-build` job runs
`assembleRelease` and uploads `app-release.apk` directly. This build is not part
of pull-request CI and is not reproduced by `npm run verify`.

The APK workflow's Gradle cache is keyed on a hash of the Gradle build/config
files (`android/**/*.gradle*` and `gradle-wrapper.properties`), not a static key,
so a dependency version bump invalidates the cache instead of silently building
against stale dependencies.

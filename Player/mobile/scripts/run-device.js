#!/usr/bin/env node
/**
 * Builds, installs and launches the debug app on a physically connected
 * (USB or wireless) ADB device.
 *
 * This exists because `npm run android` (`react-native run-android`) fails in
 * this environment: the CLI shells out to the bare name `gradlew.bat`, which
 * cmd.exe refuses to resolve from the current directory, so the build dies with
 * "'gradlew.bat' is not recognized as an internal or external command". This
 * script invokes the wrapper by absolute path instead.
 *
 * It also picks a single target device explicitly, so a stale `offline`
 * emulator in `adb devices` cannot hijack or fail the install.
 *
 * Metro is NOT started here - run `npm start` in a separate terminal first.
 *
 * Usage:
 *   npm run android:device
 *   npm run android:device -- --device <adb-serial>
 *   npm run android:device -- --port 8082
 */

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const isWindows = process.platform === 'win32';
const androidDir = path.resolve(__dirname, '..', 'android');
const gradlew = path.join(androidDir, isWindows ? 'gradlew.bat' : 'gradlew');
const packageName = 'com.adaptizerplayer.rn';

// Android Studio's bundled JBR - this environment has no `java` on PATH.
const fallbackJavaHome = 'C:\\Program Files\\Android\\Android Studio\\jbr';

function parseArgs(argv) {
  const args = { device: process.env.ANDROID_SERIAL, port: '8081' };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--device' || argv[i] === '-d') {
      args.device = argv[++i];
    } else if (argv[i] === '--port' || argv[i] === '-p') {
      args.port = argv[++i];
    } else {
      console.error(`run-device: unknown argument "${argv[i]}"`);
      process.exit(1);
    }
  }
  return args;
}

function adb(adbArgs, { capture = false } = {}) {
  return spawnSync('adb', adbArgs, {
    stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
    encoding: 'utf8',
  });
}

/**
 * Returns the serials of every attached device in the `device` state.
 * `offline` / `unauthorized` entries are skipped - they cannot be installed to.
 */
function listReadyDevices() {
  const result = adb(['devices'], { capture: true });
  if (result.error) {
    console.error(
      `run-device: could not run adb (${result.error.message}). Is the Android SDK platform-tools directory on PATH?`,
    );
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error('run-device: "adb devices" failed.');
    process.exit(result.status ?? 1);
  }

  return (result.stdout || '')
    .split(/\r?\n/)
    .slice(1) // drop the "List of devices attached" header
    .map(line => line.trim().split(/\s+/))
    .filter(([serial, state]) => serial && state === 'device')
    .map(([serial]) => serial);
}

function resolveDevice(requested) {
  const ready = listReadyDevices();

  if (requested) {
    if (!ready.includes(requested)) {
      console.error(
        `run-device: device "${requested}" is not attached and ready. Ready devices: ${
          ready.join(', ') || '(none)'
        }`,
      );
      process.exit(1);
    }
    return requested;
  }

  if (ready.length === 0) {
    console.error(
      'run-device: no ready ADB device found. Connect a device (or start an emulator) and re-run. Check with "adb devices".',
    );
    process.exit(1);
  }

  if (ready.length > 1) {
    console.error(
      `run-device: multiple ready devices found: ${ready.join(
        ', ',
      )}. Re-run with: npm run android:device -- --device <serial>`,
    );
    process.exit(1);
  }

  return ready[0];
}

function run(step, command, commandArgs, options = {}) {
  console.log(`\n> run-device: ${step}`);
  const result = spawnSync(command, commandArgs, {
    stdio: 'inherit',
    ...options,
  });

  if (result.error) {
    console.error(
      `\nrun-device: failed to start "${step}": ${result.error.message}`,
    );
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(
      `\nrun-device: "${step}" failed with exit code ${result.status}. Stopping.`,
    );
    process.exit(result.status ?? 1);
  }
}

const { device: requestedDevice, port } = parseArgs(process.argv.slice(2));

if (!/^\d+$/.test(port)) {
  console.error(`run-device: --port must be a number, got "${port}"`);
  process.exit(1);
}

if (!fs.existsSync(gradlew)) {
  console.error(`run-device: Gradle wrapper not found at ${gradlew}`);
  process.exit(1);
}

const javaHome =
  process.env.JAVA_HOME ||
  (fs.existsSync(fallbackJavaHome) ? fallbackJavaHome : undefined);

if (!javaHome) {
  console.error(
    "run-device: JAVA_HOME is not set and Android Studio's bundled JBR was not found. Set JAVA_HOME to a JDK 17+ install and re-run.",
  );
  process.exit(1);
}

const device = resolveDevice(requestedDevice);
const env = { ...process.env, JAVA_HOME: javaHome, ANDROID_SERIAL: device };

console.log(`run-device: target device ${device}`);
console.log(`run-device: JAVA_HOME   ${javaHome}`);

// Every adb call is pinned to the chosen device with `-s`: relying on
// ANDROID_SERIAL alone is not enough, because a stale `offline` emulator still
// makes plain adb fail with "more than one device/emulator".
const adbTarget = ['-s', device];

// Lets the app on the device reach the Metro dev server on the host.
run('adb reverse (Metro)', 'adb', [
  ...adbTarget,
  'reverse',
  `tcp:${port}`,
  `tcp:${port}`,
]);

const gradleArgs = [
  'app:installDebug',
  '-x',
  'lint',
  `-PreactNativeDevServerPort=${port}`,
];

// Node refuses to spawn a .bat/.cmd without a shell (CVE-2024-27980), so on
// Windows go through cmd.exe. The whole invocation is passed as one quoted
// string rather than as an args array, because args are only concatenated (not
// escaped) when `shell` is set - see Node's DEP0190. `port` is validated above,
// and every other argument is a literal.
if (isWindows) {
  run(
    'gradle app:installDebug',
    `"${gradlew}" ${gradleArgs.join(' ')}`,
    undefined,
    { cwd: androidDir, env, shell: true },
  );
} else {
  run('gradle app:installDebug', gradlew, gradleArgs, {
    cwd: androidDir,
    env,
  });
}

run('launch app', 'adb', [
  ...adbTarget,
  'shell',
  'monkey',
  '-p',
  packageName,
  '-c',
  'android.intent.category.LAUNCHER',
  '1',
]);

console.log(
  `\nrun-device: ${packageName} installed and launched on ${device}.`,
);
console.log(
  'run-device: if the app shows a red screen, make sure "npm start" (Metro) is running.',
);

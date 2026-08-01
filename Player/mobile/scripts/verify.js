#!/usr/bin/env node
/**
 * Runs the same checks CI runs, in the same order, and stops at the first
 * failure. This is a plain Node script (not an `&&` chain) so `npm run verify`
 * behaves identically on Windows (cmd.exe/PowerShell) and POSIX shells.
 *
 * Usage: npm run verify
 */

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const steps = [
  { name: 'format:check', script: 'format:check' },
  { name: 'lint', script: 'lint' },
  { name: 'typecheck', script: 'typecheck' },
  { name: 'test', script: 'test' },
];

const cwd = path.resolve(__dirname, '..');

for (const step of steps) {
  console.log(`\n> verify: running "${step.name}" (npm run ${step.script})`);
  // shell: true is required on Windows to resolve npm.cmd; it is safe here
  // because none of the arguments come from user input.
  const result = spawnSync('npm', ['run', '--silent', step.script], {
    cwd,
    stdio: 'inherit',
    shell: true,
  });

  if (result.error) {
    console.error(
      `\nverify: failed to start "${step.name}": ${result.error.message}`,
    );
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(
      `\nverify: "${step.name}" failed with exit code ${result.status}. Stopping.`,
    );
    process.exit(result.status ?? 1);
  }
}

console.log('\nverify: all checks passed.');

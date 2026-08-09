# Testing strategy - InstrumentUI

## Goal

A small suite of tests that pin **business rules and user-observable outcomes**, not internals. Concretely: assertions about *what the DAW receives* and *what the user sees*, never about which method called which.

## Decisions

- **Runner: Vitest.** InstrumentUI has no Babel config and doesn't want one. Jest + TSX would need either `ts-jest` (slow, per-file typechecking) or five Babel packages plus a `babel.config.js` with `runtime: 'classic'` set correctly or every component fails to render. Vitest transforms TS/TSX with esbuild for free. Three other deciding facts: `tsconfig.json` sets `"jsx": "react"` (classic runtime - every component already does `import React`), which esbuild honors; the `import "./x.scss"` side-effect imports resolve to empty modules under Vitest's default `css: false` where Jest needs a `moduleNameMapper`; and Vitest never invokes `tsc`, so the build config's Node16 module resolution (under which a CommonJS-typed file importing an ESM-only package is a hard error) constrains only `tsconfig.test.json`, not the runner. The sibling `Player/mobile` uses Jest, but only because React Native ships `@react-native/jest-preset`; what actually transfers from that project - the `verify.js` Node script, the path-filtered workflow, this doc - is preserved below.
- **DOM: jsdom**, not happy-dom. `@testing-library/react` is developed against it, and the UI leans on `<input type="number">` and `localStorage` semantics. jsdom's missing `PointerEvent` is represented by `MouseEvent` in test setup; curve tests provide explicit SVG bounds for deterministic pointer coordinates.
- **Minimal DI seams**, not module mocking. See below.
- **Domain tested properly; components covered by a few coarse happy-path journeys.**
- **No snapshots, anywhere.**
- **A defect gets fixed, not pinned.** Asserting broken behavior bakes a wrong contract into the suite, and `it.fails` - green while the bug lives, red the day it dies - reads as a trap. Fix it and assert the real behavior; if it is not worth fixing, it is not worth a test either.
- **A test written after the code has to be seen failing.** Break the behavior it claims to pin and watch it go red before keeping it. A test that passed on its first run has demonstrated nothing about what it would catch, and the ones written against code that already works are exactly where a silently vacuous assertion survives.
- **Test pressure may improve the product; it may not distort it.** Queries go through accessible names, so a control with no name, or two controls sharing one, gets a name rather than a `data-testid` or a class selector. Reaching for the escape hatch hides a defect the user has too.
- **Coverage collected, never gated.**

## The seams

Two hard dependencies block behavior testing. `src/renderer/services/midi-service.ts` exports a **pre-constructed singleton instance**, and `window.electronAPI` is a `contextBridge` global typed in `src/main/preload.ts`. Neither is injectable, and the objects that need them are constructed several layers down (`Configurator` builds `Adaptizer`; `ExportDialog` builds `Exporter`), so a seam has to reach through.

Two interfaces - `MidiPort` (`src/renderer/services/midi-port.ts`) and `ElectronApi` (`src/shared/electron-api.ts`) - with method names deliberately unchanged, so `midi-service.ts` is a one-line diff and no call site changes shape. `Adaptizer` and `Exporter` take them as constructor parameters; the components default them as props (`midiPort: MidiPort = MidiService`, `electronApi: ElectronApi = window.electronAPI`), so production callers need no edits. `App` takes both and hands them down, which is what makes a whole-app render against fakes possible.

Three design notes:

1. **`Exporter` takes the port from the adaptizer, not its own constructor.** Its first rule is "refuse to start if the port is missing, because otherwise every track renders the same". It must check *the port the adaptizer will actually send through*; a separate parameter would let a caller pass a different one and check the wrong thing. `Adaptizer` exposing `get midiPort()` makes that impossible by construction.
2. **Defaults live on components, not domain constructors.** `Adaptizer` and `Exporter` require their dependencies. A default prop is evaluated at render time inside jsdom, so `window.electronAPI` is never touched at module-eval time.
3. **`index.tsx` holds nothing but the mount.** `App` lives in `app.tsx` and has no side effects on import; a component defined next to a module-scope `ReactDOM.createRoot(...)` cannot be rendered by a test at all.

**Stubbing a browser API is not module mocking.** `navigator.requestMIDIAccess` is replaced through `Object.defineProperty`, and jsdom-hostile Electron main-process modules through `vi.mock('electron')`. Both substitute an *environment* the test cannot run, which is the same category as swapping the timer implementation - not the same as mocking our own modules by import specifier.

**Rejected:** a React context (`Exporter` isn't a component, so it still bottoms out in constructor injection - that's context *plus* the constructor work, and it forces every component test to wrap in a provider); a module-level registry (swaps one global for another, and makes tests depend on teardown ordering against shared mutable state); leaving the singleton and using `vi.mock` (asserts against an import specifier, so moving a file breaks tests though nothing observable changed; forces "was this called with" assertions; and cannot express state changing mid-scenario, such as loopMIDI being unplugged at track 4).

## The two tiers

**Tier 1 - the domain, tested properly.** Curve evaluation and its invariants, the `.adz` round trip and what it rejects, the adaptizer's debounce and send rules, the export state machine, control numbering. Every fine-grained rule belongs here, where it can be asserted against the fake port's message log or an evaluated output rather than through a rendered tree.

**Tier 2 - components, as coarse happy-path journeys.** Deliberately few. Each wires a **real `Project`, a real `Adaptizer` over a fake `MidiPort`, and a fake `ElectronApi`** - fake only the boundary, never the domain. Query by role and text, never by class or `data-testid`. The fine-grained rules already live in Tier 1; what a journey adds is proof that the screen is wired to them at all.

**The one exception to happy-path-only:** a failure whose symptom is plausible-looking output earns a test at this tier. Ten tracks that all sound the same, or a cancelled export reporting whatever the aborting track threw, both read as success until somebody listens to the result - and both are undone silently by a naive refactor. A failure the user cannot miss does not qualify.

### The fake kit - `src/testing/`

Modelled on `Player/mobile/src/native/mockAdaptiveAudio.ts` and bound by its constraints: implement the same interface production depends on, start no timers, expose a driving API for inputs and an inspection API for outputs, never patch a global or a module registry. Excluded from `tsconfig.json`, included in `tsconfig.test.json`, each with its own small test.

Two rules the fakes are built on, both of which cost a test to get wrong:

- **A fake mirrors production's silences, not just its successes.** Sends while the MIDI port is missing are dropped rather than recorded, because the real service silently no-ops; a fake that recorded them would let tests assert on messages that never reach a real DAW. The same goes for *when* a state change becomes visible - a port that appears is only noticed on the next access request, which is the whole reason the connection warning needs a refresh button.
- **A fake exposes the inside of a call, not only its result.** A hook that fires *during* `exportTrack` is what turns "cancel while track 3 is rendering" and "what was the DAW holding when this track was rendered" into scenarios rather than timing hacks.

Builders (`aControl({...})` / `aProject({...})`) exist because six positional numbers are unreadable, and unreadable tests get deleted rather than fixed.

**Timers:** `vi.useFakeTimers()` for the renderer's 300 ms debounce and 500 ms settle - swapping the environment's timer implementation is not implementation coupling. Use `await vi.advanceTimersByTimeAsync(ms)`; **the synchronous variant will deadlock** `Exporter`'s loop, which awaits its sleep inside a loop that also awaits IPC promises.

## What we deliberately do not test, and why

Without this section the suite rots: the first person to see 0% coverage on `adaptizer-knob.tsx` writes the knob-drag test this strategy argues against.

- **SCSS, class names, DOM structure, layout.** Zero defect-catching power, maximum refactor tax. The user's observable surface is text and interactive roles; query by those.
- **Snapshot tests - none, anywhere.** A snapshot asserts "the output is what it was", which is not a business rule. It goes stale, gets blessed with `-u` reflexively, and its failure message never says what broke.
- **Browser SVG rendering.** Interaction tests pin the editor's coordinate conversion against an explicit view box, but visual grid alignment, responsive sizing and pointer feel still belong in the manual smoke check.
- **The knob's `document` mousemove wiring.** jsdom does not populate `MouseEvent.movementY` (always 0), so a synthesized drag moves the value by exactly zero and the test would pass against a knob that does nothing. Forging the property means asserting that your forged event reaches `setValue`. Only the half of the knob's contract that needs no drag is covered: the value it starts on is the value the DAW is auditioning, which is what the configurator's send assertions are written against.
- **Where the knob points.** The indicator angle and the ring both derive from the fraction of the way through the range, and getting that fraction wrong is invisible while `min` is 0 - but asserting a CSS rotation is asserting rendering, and it belongs in the manual smoke check.
- **Trivial `Control` accessors in isolation.** Point edits are covered through curve output, invariants, notifications and MIDI consequences instead.
- **The PowerShell scripts and `runScript`'s process spawning.** `ableton-export.ps1` drives Ableton's Export dialog with SendKeys against whatever window has focus - it needs a licensed Ableton install and an uncontested desktop, and running it on a dev machine steals keystrokes mid-typing. What *is* testable is covered from both sides: the arguments we pass and the errors we read back, with the `ADAPTIZER_ERROR:` prefix as the contract between them.
- **Electron main-process wiring** - `main.ts`, `menu.ts`, `ipcMain` registration, native dialogs. Declarative glue; testing it needs `vi.mock('electron')` and the assertions would be "we called `ipcMain.handle` with this string".

Everything on this list is a **cost judgement, and a cost judgement expires when the cost changes.** `ProjectManager.saveProject` sat here on the belief that testing it needed a `ProjectStore` port; it needed a temp directory and the `electron` mock that was already there, and three tests came out of a re-reading, not a refactor. Re-read the list before extending it.

## Guardrails

- **`npm run verify`** - `typecheck` then `test`, as an `&&` chain in `package.json`. What earns a named entry point at all is the first step: **Vitest never invokes `tsc`** - esbuild strips types without reading them - so `npm test` alone is green on code that does not compile, and a separate command is a command that gets skipped. Prepend `format:check` / `lint` if they land. *Why not the sibling's `scripts/verify.js`:* it exists because an `&&` chain is not portable, but that constrains the shell you type into, not the script body - npm runs those through `%ComSpec%` (cmd.exe on Windows, `sh` elsewhere), so the chain short-circuits and propagates the failing exit code from PowerShell just as it does from bash. Adopt the Node script if the step list ever grows enough to want its "which step failed" reporting; two steps do not.
- **`.github/workflows/instrument-ui.yml`** (monorepo root) - same shape as `player-mobile.yml`: path-filtered to `InstrumentUI/**` so it never runs for sibling projects, `concurrency` with `cancel-in-progress`, one `checks` job on **`windows-latest`** running `npm ci`, `typecheck`, `test:ci`, `npm run build`, then uploading coverage. *Why Windows despite the suite being OS-independent by design:* the **product** is Windows-only (PowerShell, Ableton, `taskkill`, backslash paths), and this job also runs the build, which is where `tsc` + Parcel path and casing problems actually surface.
- **Coverage: collect, do not gate.** A global percentage rewards writing tests for whatever is uncovered - here, the SCSS-heavy markup, the knob's drag wiring and the Electron glue, i.e. precisely what the section above argues against. If a gate is ever wanted, scope it to `src/renderer/domain/**`.

## Deferred

- **Main-process pure logic.** Four extractions, each currently `private` or module-scoped and therefore untestable in place: `readScriptError` (stderr to user message, including the CRLF split that is a genuine Windows bug magnet), `dashConverterArgs`, `projectNameFromPath` (truncates `My.Song.adz` to "My"; hardcoded backslash), and above all **`waitForRenderedFile`** - a `while(true)` polling state machine with four outcomes that can hang the app forever or fail a forty-minute export spuriously, and that cannot be tested by hand. It needs an injected `RenderedFileWatcher` (`sizeOf` / `isOpenForWriting` / `now` / `sleep`), because `statSync`/`openSync` have no environment-level substitute the way `setTimeout` does; a scripted sample sequence then expresses a twenty-minute render in six array entries and runs in microseconds.
- **Electron E2E smoke.** One Playwright `_electron` spec, two assertions, on `workflow_dispatch` only - never a PR gate. It buys one thing nothing else can: proof that `contextBridge` actually exposes `electronAPI` and the renderer boots against it. Every jsdom test injects a fake by construction, so all of them are blind to a broken preload path or a Parcel bundle that did not line up - the exact failure that turns the app into a white screen.

## The one thing no automated test here covers

A full manual export - 10 tracks through Ableton, ffmpeg and Shaka packager. Run it once at the end of any batch that touches the export path.

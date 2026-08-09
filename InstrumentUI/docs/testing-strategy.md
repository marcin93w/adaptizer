# Testing strategy - InstrumentUI

## Goal

A small suite of tests that pin **business rules and user-observable outcomes**, not internals. Concretely: assertions about *what the DAW receives* and *what the user sees*, never about which method called which.

## Decisions

- **Runner: Vitest.** InstrumentUI has no Babel config and doesn't want one. Jest + TSX would need either `ts-jest` (slow, per-file typechecking) or five Babel packages plus a `babel.config.js` with `runtime: 'classic'` set correctly or every component fails to render. Vitest transforms TS/TSX with esbuild for free. Three other deciding facts: `tsconfig.json` sets `"jsx": "react"` (classic runtime - every component already does `import React`), which esbuild honors; the `import "./x.scss"` side-effect imports resolve to empty modules under Vitest's default `css: false` where Jest needs a `moduleNameMapper`; and Vitest never invokes `tsc`, so the build config's Node16 module resolution (under which a CommonJS-typed file importing an ESM-only package is a hard error) constrains only `tsconfig.test.json`, not the runner. The sibling `Player/mobile` uses Jest, but only because React Native ships `@react-native/jest-preset`; what actually transfers from that project - the `verify.js` Node script, the path-filtered workflow, this doc - is preserved below.
- **DOM: jsdom**, not happy-dom. `@testing-library/react` is developed against it, and the UI leans on `<input type="number">` and `localStorage` semantics. jsdom's missing `PointerEvent` is represented by `MouseEvent` in test setup; curve tests provide explicit SVG bounds for deterministic pointer coordinates.
- **Minimal DI seams**, not module mocking. See below.
- **Domain tested properly; components covered by a few coarse happy-path journeys.**
- **No snapshots, anywhere.**
- **Coverage collected, never gated.**

## The seams

Two hard dependencies block behavior testing. `src/renderer/services/midi-service.ts` exports a **pre-constructed singleton instance**, and `window.electronAPI` is a `contextBridge` global typed in `src/main/preload.ts`. Neither is injectable, and the objects that need them are constructed several layers down (`Configurator` builds `Adaptizer`; `ExportDialog` builds `Exporter`), so a seam has to reach through.

Two interfaces - `MidiPort` (`src/renderer/services/midi-port.ts`) and `ElectronApi` (`src/shared/electron-api.ts`) - with method names deliberately unchanged, so `midi-service.ts` is a one-line diff and no call site changes shape. `Adaptizer` and `Exporter` take them as constructor parameters; the components default them as props (`midiPort: MidiPort = MidiService`, `electronApi: ElectronApi = window.electronAPI`), so production callers need no edits.

Two design notes:

1. **`Exporter` takes the port from the adaptizer, not its own constructor.** Its first rule is "refuse to start if the port is missing, because otherwise every track renders the same". It must check *the port the adaptizer will actually send through*; a separate parameter would let a caller pass a different one and check the wrong thing. `Adaptizer` exposing `get midiPort()` makes that impossible by construction.
2. **Defaults live on components, not domain constructors.** `Adaptizer` and `Exporter` require their dependencies. A default prop is evaluated at render time inside jsdom, so `window.electronAPI` is never touched at module-eval time.

**Rejected:** a React context (`Exporter` isn't a component, so it still bottoms out in constructor injection - that's context *plus* the constructor work, and it forces every component test to wrap in a provider); a module-level registry (swaps one global for another, and makes tests depend on teardown ordering against shared mutable state); leaving the singleton and using `vi.mock` (asserts against an import specifier, so moving a file breaks tests though nothing observable changed; forces "was this called with" assertions; and cannot express state changing mid-scenario, such as loopMIDI being unplugged at track 4).

## Test inventory

### Tier 1 - domain, tested properly

| | File | Covers |
| --- | --- | --- |
| **T1** | `domain/__tests__/control-transform.test.ts` | Piecewise-linear curve evaluation: exact points, increasing/decreasing/flat/non-monotonic segments, rounding, clamping, the ten default export values, point invariants, protected endpoints and notifications. |
| **T2** | `domain/__tests__/project-dto.test.ts` | Format-1 `.adz` round-trip asserted through evaluated outputs, deterministic point sorting, unsupported-format and invalid-curve rejection, and tolerance for harmless unknown metadata. |
| **T3** | `domain/__tests__/adaptizer.test.ts` | Debounce and send rules, asserted against the fake port's message log: the DAW is in sync on load; a new control is auditionable at once; **dragging a curve point does not flood the port**; controls debounce independently; **turning the knob is instant**; selecting a control re-announces it so the DAW can learn the CC. |
| **T4** | `domain/__tests__/exporter.test.ts` | The 10-track state machine: refuses to start with no MIDI port and with no export tools (**zero tracks rendered** in both cases); **every track is rendered with its own control values**; tracks 0-9 in order exactly once; progress ordering; cancellation between tracks and mid-conversion, throwing nothing; a failing track aborts the rest and surfaces the DAW's message verbatim. |
| **T9** | `domain/__tests__/project-controls.test.ts` | Adding a control: the new number clears every number in use, so **a control the user configured is never replaced**; the first control of an empty project is 1; a number no MIDI controller can carry is refused. |

### Tier 2 - components: coarse happy-path journeys

Deliberately few. Each wires a **real `Project`, a real `Adaptizer` over a fake `MidiPort`, and a fake `ElectronApi`** - fake only the boundary, never the domain. Query by role and text, never by class or `data-testid`. The fine-grained rules already live in Tier 1.

- **`automation-curve.test.tsx`** — click-to-add with snapping, pointer dragging
  against explicit SVG geometry, exact numeric editing, keyboard nudge/removal,
  endpoint protection, current-input visualization and preview synchronization.
- **`project-manager.test.ts`** — an invalid file reports an error without replacing
  the open project; valid format-1 files are normalized before entering the renderer.

- **T5 `export-dialog.test.tsx`** - the export happy path end to end (folder, BPM, Export, then ten tracks with their own values, conversion, and "host `manifest.mpd` alongside the `.webm` files"); Export blocked until the settings can produce a valid stream (`dash-converter.ps1` computes `segmentDuration = 2 * (60 / Bpm)` and throws on a non-positive tempo); settings remembered from the last run. *Two deliberate exceptions to happy-path-only, because the feature silently produces garbage otherwise:* the export refuses to start when loopMIDI isn't running and says so; and cancelling mid-render ends with "Export cancelled." - **not** the failure the aborting track throws on its way out, which is deliberate UX a naive refactor undoes silently.
- **T6 `configurator.test.tsx`** - the live audition journey; editing a curve point changes what the DAW hears after the debounce; adding a control never replaces one the user already configured; opening a different project replaces the controls, closes the export dialog, and leaves exactly one live connection to the DAW.
- **T7 `app.test.tsx`** - every edit is reported to the main process so it can be saved; opening a project replaces what's on screen; the MIDI warning appears only when the port is missing and the refresh button dismisses it (the whole loopMIDI onboarding loop).
- **T8 `midi-service.test.ts`** - small, but the only test that can catch "we send on the wrong channel". Stub `navigator.requestMIDIAccess` via `Object.defineProperty` (stubbing a *browser API* is an environment concern, not module mocking). The port is matched by the exact name `Adaptizer`; "Adaptizer 2" is not accepted; sending while the port is missing is silently ignored.

**Written so far:** T1-T4, T9, T8, `automation-curve.test.tsx` and `project-manager.test.ts`. **T5-T7 are still to write, and are blocked on the seams above being finished**: `Configurator` still imports the `MidiService` singleton and reaches for `window.electronAPI` directly rather than taking them as props, so a component test cannot get a fake in. `Adaptizer` and `Exporter` already take theirs.

**Two accessibility fixes are prerequisites for T5**, and are good changes in their own right: `<label>BPM: </label>` and its `<input>` are siblings with no `htmlFor`/`id`, so `getByLabelText('BPM')` throws; and **both** Browse buttons are named "Browse", so `getByRole('button', {name: 'Browse'})` throws on multiple matches. This is test pressure improving the product rather than distorting it.

### The fake kit - `src/testing/`

Modelled on `Player/mobile/src/native/mockAdaptiveAudio.ts` and bound by its constraints: implement the same interface production depends on, start no timers, expose a driving API for inputs and an inspection API for outputs, never patch a global or a module registry. Excluded from `tsconfig.json`, included in `tsconfig.test.json`, each with its own small test.

- **`fake-midi-port.ts`** - `sent` / `take()` / `lastValueFor(cc)`, `accessRequests`, `dropped`, plus `setPortPresent()` and `failNextAccessRequest()`. Sends while the port is missing are **dropped, not recorded** (the real service silently no-ops, and a fake that recorded them would let tests assert messages that never reach a real DAW). `setPortPresent` takes effect on the *next* access request, mirroring `MidiService`.
- **`fake-electron-api.ts`** - an ordered `calls` log, `exportedTracks`, `sentProjects`, `cancelConversionCount`; failure drivers; `emitProjectOpened` / `emitExportRequested`; and **`onExportTrackCalled(hook)`, which fires inside the call** - what makes "cancel while track 3 is rendering" a scenario rather than a timing hack.
- **`project-builders.ts`** - `aControl({...})` / `aProject({...})`, because six positional numbers are unreadable and unreadable tests get deleted rather than fixed.

**Timers:** `vi.useFakeTimers()` for the renderer's 300 ms debounce and 500 ms settle - swapping the environment's timer implementation is not implementation coupling. Use `await vi.advanceTimersByTimeAsync(ms)`; **the synchronous variant will deadlock** `Exporter`'s loop, which awaits its sleep inside a loop that also awaits IPC promises.

## What we deliberately do not test, and why

Without this section the suite rots: the first person to see 0% coverage on `adaptizer-knob.tsx` writes the knob-drag test this strategy argues against.

- **SCSS, class names, DOM structure, layout.** Zero defect-catching power, maximum refactor tax. The user's observable surface is text and interactive roles; query by those.
- **Snapshot tests - none, anywhere.** A snapshot asserts "the output is what it was", which is not a business rule. It goes stale, gets blessed with `-u` reflexively, and its failure message never says what broke.
- **Browser SVG rendering.** Interaction tests pin the editor's coordinate conversion against an explicit view box, but visual grid alignment, responsive sizing and pointer feel still belong in the manual smoke check.
- **The knob's `document` mousemove wiring.** jsdom does not populate `MouseEvent.movementY` (always 0), so a synthesized drag moves the value by exactly zero and the test would pass against a knob that does nothing. Forging the property means asserting that your forged event reaches `setValue`. The knob's contract toward the rest of the app is covered by T6.
- **`valueToAngle`'s `min` bug** (`-135 + (v/max)*270` ignores `min`). Harmless while `min === 0`, purely visual; asserting a CSS rotation is asserting rendering. Worth a comment, not a test.
- **Trivial `Control` accessors in isolation.** Point edits are covered through curve output, invariants, notifications and MIDI consequences instead.
- **The PowerShell scripts and `runScript`'s process spawning.** `ableton-export.ps1` drives Ableton's Export dialog with SendKeys against whatever window has focus - it needs a licensed Ableton install and an uncontested desktop, and running it on a dev machine steals keystrokes mid-typing. What *is* testable is covered from both sides: the arguments we pass and the errors we read back, with the `ADAPTIZER_ERROR:` prefix as the contract between them.
- **Electron main-process wiring** - `main.ts`, `menu.ts`, `ipcMain` registration, native dialogs. Declarative glue; testing it needs `vi.mock('electron')` and the assertions would be "we called `ipcMain.handle` with this string".
- ~~**`ProjecManager.saveProject`'s error handling**~~ - **this call was reversed when defect (f) was fixed.** The argument against it was the cost of a `ProjectStore` port. There is no port: `project-manager.test.ts` already mocks `electron` - an external boundary jsdom cannot run, the same kind of substitution as stubbing a browser API - and writes into a temp directory, so "the file is written" and "a failure reaches the user" cost three tests and no production seam. Extracting the rule from the defect: *deciding not to test something is a cost judgement, and it expires when the cost changes.*

## Known defects

**Fix first** where the fix is cheap and pinning the broken behavior would bake a wrong contract into the suite; otherwise schedule it and say so.

`it.fails` - a test that passes while a bug exists and fails the day it is fixed - was considered as a way to document defects without going red, and rejected: a test that passes *because* the code is broken reads as a trap, and it is more machinery than a scheduled fix deserves. Where a defect is worth pinning, fix it and assert the real behavior.

All of these are now closed. The table stays as the record of what was wrong and how it was
settled - a defect that reappears is easier to recognise than to rediscover.

| | Defect | Ruling |
| --- | --- | --- |
| a | Phantom hardcoded control 1 survives `fromDto` - a `.adz` holding just CC 7 opens with CC 1 **and** CC 7, and the DAW receives CC 1 messages the user never configured. Fix: a `Project.newDefault()` factory; the plain constructor starts empty. Three call sites. | **Fixed.** `Project.newDefault()`; the starting curve lives once, in `Control.withDefaultCurve`. Pinned by T2. |
| b | `addControl` overwrites on a `length + 1` collision - controls live in a `Map` keyed by control *number* while the configurator derives the new one from the *count*. Open an `.adz` holding CC 1 and CC 3, press `+`, and the CC 3 the user configured is silently replaced. Fix: `max + 1`. | **Fixed.** The rule went to `Project.nextControlNumber()` rather than staying in the component, so T9 can hold it without a component test. |
| c | Control-view listeners must not grow across rerenders. `control-summary.tsx` and the curve editor register in effects and unregister when the control changes or unmounts. Adaptizer listener lifecycle remains a separate concern. | **View leak fixed; the adaptizer half is closed as a non-defect.** Once (e) leaves one adaptizer per project, a replaced one is unreachable and collected with the project it served. The only thing that outlives it is a debounce timer, so opening another project inside 300 ms of an edit sends one stale CC - **nobody does that, and nothing goes wrong when they do.** An `Adaptizer.dispose()` was written for it and removed: it earned its keep only through tests that pinned a scenario the product does not have. The debounce did move off the control - see (e). |
| d | Knob emits `onChange(5)` against an `inputValue` of 0 - on launch the DAW gets a 0 burst then a 5 burst, and for one frame the cards show value-0 outputs under a knob reading 5. Fix: `initialValue` prop, one source of truth. **The start value is a product decision** - 0 matches the export's first track; the midpoint is a defensible audition default. | **Fixed; the value is 0.** What the DAW hears before the user touches anything is now a value the finished song actually contains. Unpinned until T6. |
| e | `[project]` effect `initialize()`s the stale adaptizer from the closure. Harmless in itself, but it's the statement that creates the second Adaptizer in (c). Fix: `useMemo`. `react-hooks/exhaustive-deps` would have flagged it - the concrete argument for adding lint. | **Fixed** with `useMemo`. Worth recording *why* the duplicate was invisible: both adaptizers debounced through the same property parked on the control, so the second listener kept cancelling the first one's send. Shared mutable state hid a bug by breaking a second time. |
| f | `await writeFile(path, data, cb)` awaits the **callback** form, which returns `undefined` - the save is fire-and-forget and a failure is only `console.error`d, so **the user is told nothing and believes their project is saved.** Fix: `fs/promises` + `dialog.showErrorBox`. | **Fixed, and tested after all** - see the reversed call above. |
| g | `0xB1` in code vs `0xB0` in the README - **resolved: the code is right.** `Instrument/midi_controller.py:23` sends `channel=1`, and mido channels are 0-indexed, so the wire byte is `0xB0 \| 1` = `0xB1`. Fix the README. *Two smaller README mismatches found while checking: it links to `InstrumentUI/conf.adz`, which does not exist in the repo, and `Instrument/conf.adp` uses `BINARY_ON`, a transform the TypeScript app cannot represent - so that sample cannot be loaded by InstrumentUI at all.* | **Fixed and pinned by T8.** The dead `conf.adz` link went when the README started pointing at the Ableton sample project. `Instrument/conf.adp` still uses `BINARY_ON` and still cannot be opened by InstrumentUI - that is a Python-side sample, and the two apps' formats parted ways at the curve editor. |
| h | The former collapsed-range divide-by-zero path no longer exists. Controls always have distinct input positions and mandatory endpoints; validation rejects duplicate inputs before they can reach MIDI output. | **Superseded by curve editor.** (The project format is still version 1 - the curve editor changed what a control *is* without bumping it.) |

## Guardrails (later batch)

- **`InstrumentUI/scripts/verify.js`** - a near-copy of `Player/mobile/scripts/verify.js`: plain Node, `spawnSync` with `shell: true`, `stdio: 'inherit'`, stop at the first failure. **Deliberately not an `&&` chain**, for the reason the sibling gives - identical behavior in PowerShell, cmd.exe and bash. Steps: `typecheck`, `test`; prepend `format:check` / `lint` if they land.
- **`.github/workflows/instrument-ui.yml`** (monorepo root) - same shape as `player-mobile.yml`: path-filtered to `InstrumentUI/**` so it never runs for sibling projects, `concurrency` with `cancel-in-progress`, one `checks` job on **`windows-latest`** running `npm ci`, `typecheck`, `test:ci`, `npm run build`, then uploading coverage. *Why Windows despite the suite being OS-independent by design:* the **product** is Windows-only (PowerShell, Ableton, `taskkill`, backslash paths), and this job also runs the build, which is where `tsc` + Parcel path and casing problems actually surface.
- **Coverage: collect, do not gate.** A global percentage rewards writing tests for whatever is uncovered - here, the SCSS-heavy markup, the knob's drag wiring and the Electron glue, i.e. precisely what the section above argues against. If a gate is ever wanted, scope it to `src/renderer/domain/**`.

## Deferred

Both were considered and left out; neither is blocked by anything above.

- **Main-process pure logic.** Four extractions, each currently `private` or module-scoped and therefore untestable in place: `readScriptError` (stderr to user message, including the CRLF split that is a genuine Windows bug magnet), `dashConverterArgs`, `projectNameFromPath` (truncates `My.Song.adz` to "My"; hardcoded backslash), and above all **`waitForRenderedFile`** - a `while(true)` polling state machine with four outcomes that can hang the app forever or fail a forty-minute export spuriously, and that cannot be tested by hand. It needs an injected `RenderedFileWatcher` (`sizeOf` / `isOpenForWriting` / `now` / `sleep`), because `statSync`/`openSync` have no environment-level substitute the way `setTimeout` does; a scripted sample sequence then expresses a twenty-minute render in six array entries and runs in microseconds.
- **Electron E2E smoke.** One Playwright `_electron` spec, two assertions, on `workflow_dispatch` only - never a PR gate. It buys one thing nothing else can: proof that `contextBridge` actually exposes `electronAPI` and the renderer boots against it. Every jsdom test injects a fake by construction, so all of them are blind to a broken preload path or a Parcel bundle that did not line up - the exact failure that turns the app into a white screen.

## The one thing no automated test here covers

A full manual export - 10 tracks through Ableton, ffmpeg and Shaka packager. Run it once at the end of any batch that touches the export path.

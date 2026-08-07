# Adaptizer — InstrumentUI

Desktop (Electron) editor for [Adaptizer](../readme.md) — real-time listener context as MIDI input for music production.

InstrumentUI is the graphical counterpart of the Python CLI instrument in [Instrument/](../Instrument). Instead of typing commands, you configure the mapping between *listener context* (the input a player reports, e.g. how intense the listening situation is) and *MIDI CC messages* sent to your DAW, and hear the result immediately while the song plays.

## What it does

- **Pick an input type** — `Volume`, `Intensity` or `Expression`. This is the listener-context signal the mapping reacts to.
- **Add MIDI controls (CC)** — each control maps an input range to a MIDI CC value range on a given CC number.
- **Configure each control**:
  - *Transform type* — `Linear` or `Reversed linear`.
  - *Input range* — which slice of the input (0..9) the control reacts to; values outside are clamped.
  - *MIDI range* — the CC value range (0..127) the input is scaled into.
- **Audition live** — the big knob simulates the input value (0..9). Turning it recalculates every control and sends CC messages out of the `Adaptizer` MIDI port in real time, so you hear your DAW respond while the song is playing.
- **Save / open projects** — configurations are stored as `.adz` files (`File → New / Open / Save Project`). See [sample.adz](sample.adz) for an example.
- **MIDI port check** — if no output port named `Adaptizer` is found, a warning bar appears with a refresh button.
- **Export the song** — `File → Export Ableton Project` renders one track per input value from Ableton Live and converts them into a DASH stream. See [Exporting a song](#exporting-a-song).

Adaptizer relies on the MIDI protocol, so it works with any DAW.

## Prerequisites

- [Node.js](https://nodejs.org/) (with npm)
- [LoopMIDI](https://www.tobias-erichsen.de/software/loopmidi.html)

## Setup

1. Add a new loopback port in loopMIDI and use `Adaptizer` as its name.
1. Install dependencies:

```bash
npm install
```

## Running

```bash
npm start
```

This compiles the TypeScript main process, bundles the renderer with Parcel and launches Electron.

Other scripts:

| Script | Description |
| --- | --- |
| `npm start` | Build everything and run the app |
| `npm run debug` | Same as `start`, with the renderer debugger on port 9222 |
| `npm run build` | Build only (no Electron launch) |
| `npm run dev-renderer` | Parcel dev server for the renderer, with hot reload |
| `npm run package` | Build and package the app with electron-builder |

[launch.json](launch.json) contains VS Code configurations for debugging the main and renderer processes.

## Usage with a DAW

1. Set up the `Adaptizer` MIDI port as a MIDI remote in your DAW.
1. Run `npm start` to open InstrumentUI.
1. Add a control in the app and select it — moving its *MIDI range* sliders sends CC messages, which your DAW can pick up when learning a MIDI map.
1. Configure the input type, transform type and ranges for each control.
1. Play the song in your DAW and turn the knob (0..9) to test how your controls react to changing listener context.
1. Save the configuration as an `.adz` project.

## Project structure

```
src/
  main/       Electron main process — window, application menu, .adz project load/save
    scripts/     PowerShell scripts driving the Ableton export and the DASH conversion
  renderer/   React UI
    components/  knob, per-control editor, MIDI connection warning, export dialog
    domain/      Project, Control, Adaptizer (input → CC value calculation), Exporter
    services/    Web MIDI access and CC message sending
  shared/     DTOs and IPC event names shared by both processes
```

Built with Electron, React, TypeScript, Parcel and Sass. MIDI output goes through the Web MIDI API (`navigator.requestMIDIAccess`), sending CC messages as `[0xB0, controlNumber, value]`.

## Exporting a song

When your song is ready, InstrumentUI can render it into a DASH stream — one track per input value (0..9), so the player can switch between them as the listener context changes. Only Ableton Live is supported for now.

Additional prerequisites:

- [FFmpeg](https://www.ffmpeg.org/download.html) (available in the PATH)
- [Shaka packager](https://github.com/shaka-project/shaka-packager)

Usage:

1. Open your song in Ableton Live and make sure the `Adaptizer` MIDI port is mapped to your controls.
1. Configure the export settings in Ableton once (`Ctrl+Shift+R`) — InstrumentUI reuses whatever is set there.
1. In InstrumentUI select `File → Export Ableton Project` and choose:
   - *Output folder* — where the rendered tracks and the DASH stream are written.
   - *BPM* — the tempo of the song, used to align DASH segments with the beat.
   - *Shaka packager* — the packager executable, unless `packager-win-x64.exe` is already in the PATH.
1. Press *Export* and leave Ableton Live alone until it finishes — the export drives its Export Audio/Video dialog for every track.

Each input value is sent to Ableton as MIDI before its track is rendered, so every track sounds the way the knob sounds at that value. The rendered `0.wav`..`9.wav` files are then encoded and packaged — host the resulting `manifest.mpd` in the same directory as the `.webm` files.

The same export is available in the Python CLI instrument in [Instrument/](../Instrument) as `e <outputPath> <bpm>`.

# Adaptizer — Instrument (console)

The original Python console instrument for [Adaptizer](../readme.md). It does the
same job as the desktop editor in [InstrumentUI/](../InstrumentUI/README.md) —
map listener context to MIDI CC messages and export the song — but through typed
commands. InstrumentUI is the maintained version; this one is kept as the
scriptable / reference implementation.

## Prerequisites

- Python 3
- [LoopMIDI](https://www.tobias-erichsen.de/software/loopmidi.html)
- For exporting only: [FFmpeg](https://www.ffmpeg.org/download.html) and
  [Shaka packager](https://github.com/shaka-project/shaka-packager)

## Setup

1. Add a new loopback port in loopMIDI named `Adaptizer`.
1. Install dependencies:

```bash
pip install -r requirements.txt
```

3. For exporting only: set `$shakaPackagerPath` in
   [dash-converter.ps1](dash-converter.ps1) to your packager executable.

## Usage

```bash
python main.py
```

| Command | What it does |
| --- | --- |
| `load <file>` | Load a control configuration ([conf.adp](conf.adp) is an example) |
| `save <file>` | Save the current configuration |
| `assign <ccNumber>` | Send a test CC signal so your DAW can learn the MIDI map |
| `set INTENSITY <0-9>` | Set the input value and send the resulting CC messages |
| `e <outputPath> <bpm>` | Export the open Ableton song as a DASH stream |
| `q` | Quit |

Typical session: set up the `Adaptizer` port as a MIDI remote in your DAW, `load`
a configuration, use `assign` to map each control in the DAW, then play the song
and `set INTENSITY <0-9>` to hear how it reacts.

> `cc <ccNumber> <minValue> <maxValue> <inputType>` is listed by the app but is
> out of date — it does not pass the input range and transform type that a
> control needs, so it fails. Configure controls in a `.adp` file and `load` it.

## Configuration format

A `.adp` file is one control per line:

```
<ccNumber> <midiMin> <midiMax> <inputType> <inputMin> <inputMax> <transformType>
```

`inputType` is `INTENSITY`. `transformType` is `LINEAR`, `REVERSED_LINEAR`,
`BINARY_ON` or `BINARY_OFF`. The input value is clamped to `inputMin..inputMax`
and scaled into `midiMin..midiMax`; the binary transforms switch between the two
MIDI bounds depending on whether the input falls inside the range.

## Exporting a song

`e <outputPath> <bpm>` renders one track per intensity value (0..9) out of
Ableton Live and converts them into a DASH stream. Each value is sent as MIDI
before its track is rendered, so every track sounds the way the song sounds at
that value. Configure Ableton's export settings once (`Ctrl+Shift+R`) — the
export reuses them. `bpm` is used to align DASH segments with the beat.

The result is `0.wav`..`9.wav` plus the packaged `.webm` files and a
`manifest.mpd`; host the manifest in the same directory as the `.webm` files.

The same export with a progress dialog is available in
[InstrumentUI](../InstrumentUI/README.md#exporting-a-song).

## Tests

```bash
python adaptizer.test.py
```

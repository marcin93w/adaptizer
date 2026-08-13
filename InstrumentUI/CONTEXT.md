# InstrumentUI

The desktop editor where a producer authors an adaptive song: chooses the
dimension the song adapts to, shapes how that dimension drives the DAW, auditions
the result live, and exports the finished variants.

## Language

### What the song adapts to

**Dimension**:
The adaptation axis a song is mapped to — what an input level of 0..9 means. A song has exactly one.
_Avoid_: Input type, input, metric, axis

**Volume**:
The dimension that follows how loud the listener has their device turned up.

**Heart rate**:
The dimension that follows the listener's measured heart rate.

**Movement speed**:
The dimension that follows how fast the listener is moving, relative to how they are moving.

**Intensity**:
The dimension that blends the other three into one figure. Named, never spelled out — a song records that it uses intensity, not how intensity is computed.
_Avoid_: Aggregate, combined, overall

**Input level**:
A position on the chosen dimension, always an integer 0..9. What the knob shows and what a curve is drawn against.
_Avoid_: Input value, intensity (when the dimension is not intensity)

### Authoring

**Control**:
One MIDI CC number the producer is shaping, together with its curve.

**Curve**:
The breakpoint line mapping every input level 0..9 onto a MIDI CC value 0..127, with straight segments interpolating between points.
_Avoid_: Automation, envelope

**Breakpoint**:
A point on a curve. The endpoints at levels 0 and 9 can move vertically but cannot be removed.
_Avoid_: Node, keyframe, handle

**Audition**:
Turning the knob while the song plays in the DAW, so the producer hears the song at a chosen input level.
_Avoid_: Preview, monitor

**Project**:
Everything the producer authored for one song — its dimension and its controls. Saved as an `.adz` file.

### Publishing

**Export**:
Rendering the song once per input level, producing ten variants and the DASH stream a listener will stream.
_Avoid_: Render, bounce, build

**Variant**:
One rendered version of the song, corresponding to a single input level.
_Avoid_: Track (which in a DAW means something else entirely), representation

## The identical-string contract

The four dimensions above are written into the `.adz` project as exactly these
strings — `volume`, `heartRate`, `movementSpeed`, `intensity` — and the same
string is then typed by hand into the catalog, returned by the Worker, narrowed
in React Native and resolved in Kotlin. It is byte-identical at every layer:
never re-cased, never mapped, never parsed — only compared. See
[ADR-0001](../docs/adr/0001-songs-declare-their-adaptation-dimension-by-name.md).

This context is where the string is first written, so it is where a mistake
would originate. The display labels — "Heart rate", "Movement speed" — are
presentation only; they are produced for the screen and never persisted, and no
code path turns a label back into a name.

The set is flat and closed. InstrumentUI offers four names and knows nothing
else about them: not how a dimension is measured, not whether it is one signal
or a blend of several. Intensity is picked here the same way volume is.

InstrumentUI is the producer side of the producer/player line. An **input** —
the Player's word for a device-side signal source — does not exist in this
context, and a producer never sees one.

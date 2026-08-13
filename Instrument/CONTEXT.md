# Instrument

The original Python console instrument: the same job as InstrumentUI — map an
axis onto MIDI CC curves and export the variants — driven by typed commands
instead of a UI. Superseded by InstrumentUI and kept only as the scriptable
reference implementation. It is frozen; the dimension vocabulary is recorded
here so that reading this code does not mislead, not because this context is
going to grow.

Producer-side. Like InstrumentUI it authors a song and never measures anything;
an **input** in the Player's sense — a device-side signal source — does not
exist here.

## Language

**Input type**:
The `.adp` control format's field naming what drives a control. It has exactly one value, `INTENSITY`, and no mechanism for a second. Everywhere else in Adaptizer this concept is called a **dimension**.
_Avoid_: reading it as the Player's **input** — this context has none

**Intensity**:
Here, the one axis 0..9 the producer sets by hand with `set INTENSITY <0-9>` and the export walks. It carries none of the aggregate meaning it has in the Player: nothing is measured and nothing is blended, because the producer is the signal.
_Avoid_: aggregate, blended, weighted mean — none of that is in this context

**Control**:
One MIDI CC number and the transform that maps the input value onto its MIDI range. The `.adp` file is a line per control.

**Transform**:
How a control turns an input value into a MIDI value: `LINEAR`, `REVERSED_LINEAR`, `BINARY_ON` or `BINARY_OFF`. InstrumentUI replaced this fixed set with a breakpoint **curve**.
_Avoid_: Curve (which in InstrumentUI means the breakpoint line, not one of four shapes)

**Export**:
Rendering the Ableton song once per input value 0..9 and packaging the result as a DASH stream. The same job as InstrumentUI's export, without the progress dialog.

## The identical-string contract

The four dimension names — `volume`, `heartRate`, `movementSpeed`, `intensity` —
are byte-identical wherever a dimension is persisted or transmitted, per
[ADR-0001](../docs/adr/0001-songs-declare-their-adaptation-dimension-by-name.md).

**This context stands outside that contract, because it never enters it.**
`INTENSITY` in an `.adp` file is a local enum name that never leaves the
machine: Instrument writes no `.adz` project and no catalog row, so it never
transmits a dimension name to anyone. It is the one place in the repo where a
dimension is not spelled as one of the four strings, and only because it does
not spell them at all. Were this instrument ever revived rather than removed, it
would adopt the contract — the contract would not bend to it.

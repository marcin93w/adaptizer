# Player

The Android app where a listener hears an adaptive song: it measures the
listener's real-world context on the device, resolves the dimension the song was
authored against, and plays the matching variant.

## Language

### What a song adapts to

**Dimension**:
The adaptation axis a song is mapped to — what a value of 0..9 means. Chosen by the producer, recorded against the song in the catalog, and the only thing that decides which variant plays.
_Avoid_: Input type, metric, axis

**Single dimension**:
A dimension that is exactly one input's reading, with nothing added on top. Volume, heart rate and movement speed.

**Aggregate dimension**:
A dimension computed from several inputs rather than measured directly. Intensity is the only one.

**Intensity**:
The aggregate dimension: a weighted mean over the available inputs. A song records the name, never the formula, so the formula can change without republishing anything.
_Avoid_: Using "intensity" to mean adaptation in general — that is a dimension

### What the device measures

**Input**:
A device-side source of a signal about the listener's context, normalized to 0..9. Volume, heart rate and movement speed. Exists only in this context — a producer never sees one.
_Avoid_: Sensor, signal, source, metric

**Reading**:
An input's current value. Only meaningful while that input is available.

**Available**:
Whether an input can be read right now. Absent hardware, a denied permission and an unbonded heart-rate strap are all the same state; there is no separate concept for any of them.
_Avoid_: Enabled, supported, permitted, connected

**Held**:
What a single dimension is when its input is unavailable: fixed at 5, the middle of the range, and reported as such on screen. Inputs themselves never invent a reading.
_Avoid_: Default, fallback value

**Movement speed**:
How fast the listener is moving, scaled against what they are doing — a brisk walk and fast cycling both reach the top of the range.
_Avoid_: Velocity, pace, motion, acceleration

### Playback

**Variant**:
One rendered version of a song, corresponding to a single value 0..9. A song has ten. The existing code and the native-bridge contract call this a *track*, and DASH calls it a *representation*; all three name the same thing.

**Listener context**:
The real-world situation a song is being heard in — the thing every input is trying to measure a facet of.
_Avoid_: Environment, activity, state

**Catalog**:
The list of published songs the app fetches on launch. Each entry names where the song's audio lives and which dimension it was authored against.
_Avoid_: Library, songs list

## The identical-string contract

A song's dimension arrives here as one of exactly four strings — `volume`,
`heartRate`, `movementSpeed`, `intensity` — byte-identical to what InstrumentUI
wrote into the `.adz` and what the catalog row holds. It crosses the API
response, the native-bridge payload and into the Kotlin resolver unchanged:
never re-cased, never mapped, never parsed — only compared. See
[ADR-0001](../docs/adr/0001-songs-declare-their-adaptation-dimension-by-name.md).

This context is the end of that chain and the only one that interprets the name.
The set is flat and closed: the distinction between a **single dimension** and
the **aggregate dimension** is drawn in one resolver function, which switches on
the name and either returns an input's reading or computes the weighted mean.
Nothing above that function — not the bridge, not the catalog, not the UI —
carries which kind a dimension is. An unrecognised name resolves to `intensity`
and is logged, so a fifth dimension in the catalog does not break an installed
app.

The Player is the listener side of the producer/player line, and the only
context with **inputs**. An input appears in nothing a producer or the catalog
sees.

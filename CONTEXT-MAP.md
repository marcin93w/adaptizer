# Context Map

Adaptizer is three independent components — different stacks, no shared workspace
— each treated as its own context with its own glossary.

## Contexts

- [Instrument](./Instrument/CONTEXT.md) — where a producer authors a song: maps a dimension onto MIDI CC curves and exports the variants
- [Player](./Player/CONTEXT.md) — where a listener hears a song: measures the listener's context on the device and picks the matching variant
- [API](./API/CONTEXT.md) — the catalog of published songs

## The dimension vocabulary

A song adapts along exactly one **dimension**, and there are four of them:
`volume`, `heartRate`, `movementSpeed`, `intensity`. Those strings are
byte-identical in every context that persists or transmits one — see
[ADR-0001](./docs/adr/0001-songs-declare-their-adaptation-dimension-by-name.md),
which every `CONTEXT.md` here names.

The producer/player line runs through this vocabulary. Instrument and the API
sit on the producer side: they name dimensions and never know what is behind
them. The Player sits on the other side, and is the only
context with **inputs** — device-side signal sources. An input appears in
nothing a producer or the catalog sees.

## Relationships

- **Instrument → Player**: a song's **dimension** is chosen in Instrument and honoured by the Player. Both name it with the identical string — see [ADR-0001](./docs/adr/0001-songs-declare-their-adaptation-dimension-by-name.md).
- **Instrument → API**: an export produces the ten track variants and the manifest; Instrument then publishes them to the Worker in one authenticated request, which writes the audio to R2 and the catalog row, recording the song's dimension (see [ADR-0002](./docs/adr/0002-publishing-proxies-audio-through-the-worker.md)). This is the one place audio passes through the API.
- **API → Player**: the Player fetches the catalog and reads each song's `storage_location` and `dimension`. Audio never passes through the API on this read path — the Player streams straight off public R2.
- **Player internal**: **inputs** exist only here. Instrument and the API know about dimensions and never about the signals behind them.

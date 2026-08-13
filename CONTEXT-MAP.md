# Context Map

Adaptizer is four independent components — different stacks, no shared workspace
— each treated as its own context with its own glossary.

## Contexts

- [InstrumentUI](./InstrumentUI/CONTEXT.md) — where a producer authors a song: maps a dimension onto MIDI CC curves and exports the variants
- [Player](./Player/CONTEXT.md) — where a listener hears a song: measures the listener's context on the device and picks the matching variant
- [API](./API/CONTEXT.md) — the catalog of published songs
- [Instrument](./Instrument/CONTEXT.md) — the original Python console instrument, superseded by InstrumentUI and slated for removal. Frozen: its glossary exists to stop its vocabulary being read as current.

## The dimension vocabulary

A song adapts along exactly one **dimension**, and there are four of them:
`volume`, `heartRate`, `movementSpeed`, `intensity`. Those strings are
byte-identical in every context that persists or transmits one — see
[ADR-0001](./docs/adr/0001-songs-declare-their-adaptation-dimension-by-name.md),
which every `CONTEXT.md` here names.

The producer/player line runs through this vocabulary. InstrumentUI, the
Instrument and the API sit on the producer side: they name dimensions and never
know what is behind them. The Player sits on the other side, and is the only
context with **inputs** — device-side signal sources. An input appears in
nothing a producer or the catalog sees.

## Relationships

- **InstrumentUI → Player**: a song's **dimension** is chosen in InstrumentUI and honoured by the Player. Both name it with the identical string — see [ADR-0001](./docs/adr/0001-songs-declare-their-adaptation-dimension-by-name.md).
- **InstrumentUI → API**: an export produces the ten track variants and the manifest; a catalog row is then written by hand, recording the song's dimension.
- **API → Player**: the Player fetches the catalog and reads each song's `storage_location` and `dimension`. Audio itself never passes through the API.
- **Player internal**: **inputs** exist only here. InstrumentUI and the API know about dimensions and never about the signals behind them.

## A note on timing

The **dimension** vocabulary in these glossaries is the agreed model, introduced
by [issue #17](https://github.com/marcin93w/adaptizer/issues/17), and it lands
one context at a time. InstrumentUI speaks it now: a project declares its
`dimension`, and `expression` — which never did anything — is gone. The Player's
Kotlin library speaks it too: it resolves any of the four dimensions against the
inputs available, holds an unmeasurable one at 5 and renormalizes the aggregate.
But no song's dimension reaches it yet — the catalog does not record one, and
the app still asks for `intensity` whatever a song was authored against. Where
the code and the glossary disagree, the glossary is right and the code is
behind.

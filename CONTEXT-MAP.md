# Context Map

Adaptizer is four independent components — different stacks, no shared workspace
— each treated as its own context with its own glossary.

## Contexts

- [InstrumentUI](./InstrumentUI/CONTEXT.md) — where a producer authors a song: maps a dimension onto MIDI CC curves and exports the variants
- [Player](./Player/CONTEXT.md) — where a listener hears a song: measures the listener's context on the device and picks the matching variant
- [API](./API/CONTEXT.md) — the catalog of published songs

`Instrument/` is the original Python console instrument, superseded by
InstrumentUI and slated for removal. It gets no glossary.

## Relationships

- **InstrumentUI → Player**: a song's **dimension** is chosen in InstrumentUI and honoured by the Player. Both name it with the identical string — see [ADR-0001](./docs/adr/0001-songs-declare-their-adaptation-dimension-by-name.md).
- **InstrumentUI → API**: an export produces the ten track variants and the manifest; a catalog row is then written by hand, recording the song's dimension.
- **API → Player**: the Player fetches the catalog and reads each song's `storage_location` and `dimension`. Audio itself never passes through the API.
- **Player internal**: **inputs** exist only here. InstrumentUI and the API know about dimensions and never about the signals behind them.

## A note on timing

The **dimension** vocabulary in these glossaries is the agreed model, introduced
by [issue #17](https://github.com/marcin93w/adaptizer/issues/17). Until that
lands, the code still says `inputType` and offers an `expression` value that
does nothing. Where the code and the glossary disagree, the glossary is right
and the code is behind.

# API

The catalog of published Adaptizer songs. It answers one question — what songs
exist and where each one's audio lives — and nothing else. Audio never passes
through it.

## Language

**Catalog**:
The full list of published songs. The only thing this context serves.
_Avoid_: Library, songs list, index

**Song**:
One published, adaptive piece of music: its identity, where its audio lives, and the dimension it was authored against.
_Avoid_: Track, release, item

**Dimension**:
The adaptation axis the song was authored against, recorded as a name rather than a formula, so that changing how a dimension is computed never requires republishing a song. Opaque here — this context stores and serves the name, and never interprets it.
_Avoid_: Input type, metric, mode

**Storage location**:
The prefix in the audio bucket holding one song's manifest and its ten variants. The client builds the stream URL from it.
_Avoid_: Path, URL, folder, key

**Variant**:
One rendered version of a song, corresponding to a single dimension value 0..9. A song has ten.
_Avoid_: Track, representation

**Published**:
A song is published once its audio is uploaded and its catalog row exists. Both steps are done by hand.
_Avoid_: Released, live, deployed

## The identical-string contract

A song's dimension is one of exactly four names — `volume`, `heartRate`,
`movementSpeed`, `intensity` — and the string is byte-identical everywhere it is
persisted or transmitted: the `.adz` project, this D1 column, this Worker's
response, the native-bridge payload and the Kotlin resolver. Never re-cased,
never mapped, never parsed — only compared. See
[ADR-0001](../docs/adr/0001-songs-declare-their-adaptation-dimension-by-name.md).

This context holds the string at its thinnest: typed by hand into a row, stored,
served. The Worker does not validate it against the four, does not normalize its
case and has no enum to check it against — the contract is what keeps a
hand-typed row correct, not the schema. The set is flat and closed; the catalog
records no notion of a dimension being single or aggregate.

The API sits on the producer side of the producer/player line. It knows
dimensions and never **inputs**, which exist only in the Player.

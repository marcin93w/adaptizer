# Adaptizer — Player

The Android player for [Adaptizer](../readme.md). It fetches the songs catalog
from the [API](../API/README.md), streams a song's DASH manifest from R2, and
measures listener context on the device to pick the matching track — one of the
ten representations exported from the DAW — while the song plays.

A song declares one **dimension** — the axis a track index 0..9 means. The
player measures the device-side **inputs** behind the four dimensions and
resolves any of them to a track index.

A song's dimension now reaches the resolver end to end: the catalog records it,
the React Native client reads it, and the native bridge carries it down in the
`prepare` metadata so the player honours the dimension its author chose. Device
volume is still the only input, so `intensity` (a one-member aggregate today)
and `volume` resolve to the same value, and `heartRate`/`movementSpeed` songs
are held at 5 until those inputs land.

## Modules

| Module | What it is |
| --- | --- |
| [`mobile/`](mobile/README.md) | The React Native app — catalog, transport controls, and the TurboModule facade over the native engine. This is the app. |
| `adaptive-audio/` | Kotlin library owning the inputs, the dimension resolver and the ExoPlayer track selection. Consumed by `mobile/`. |
| [`test-media/`](test-media/README.md) | Offline DASH fixtures, including malformed ones, for tests. |

## Running

See [`mobile/README.md`](mobile/README.md) — `npm install`, `npm start`, then
`npm run android:device`.

## Docs

- [`docs/adaptive-audio.md`](docs/adaptive-audio.md) — how a dimension is
  resolved and how it selects a track; the manifest contract the player
  requires.
- [`docs/native-bridge-contract.md`](docs/native-bridge-contract.md) — the
  `NativeAdaptiveAudio` command/event contract between JS and Kotlin.
- [`docs/quality-gates.md`](docs/quality-gates.md) — `npm run verify` and what CI adds.
- [`docs/adr/`](docs/adr) — architecture decisions.

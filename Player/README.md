# Adaptizer — Player

The Android player for [Adaptizer](../readme.md). It fetches the songs catalog
from the [API](../API/README.md), streams a song's DASH manifest from R2, and
measures listener context on the device to pick the matching track — one of the
ten representations exported from the DAW — while the song plays.

Listener context is aggregated into a single *intensity* value (0..9) from device
volume (weight 0.75) and accelerometer motion (0.25). That value is the track
index.

## Modules

| Module | What it is |
| --- | --- |
| [`mobile/`](mobile/README.md) | The React Native app — catalog, transport controls, and the TurboModule facade over the native engine. This is the active app. |
| `adaptive-audio/` | Kotlin library owning the intensity inputs and the ExoPlayer track selection. Consumed by both `mobile/` and `app/`. |
| `app/` | The legacy native Android app, kept unchanged as the rollback reference until cutover. |
| [`test-media/`](test-media/README.md) | Offline DASH fixtures, including malformed ones, for tests. |

## Running

See [`mobile/README.md`](mobile/README.md) — `npm install`, `npm start`, then
`npm run android:device`.

## Docs

- [`docs/adaptive-audio.md`](docs/adaptive-audio.md) — how intensity is computed
  and how it selects a track; the manifest contract the player requires.
- [`docs/native-bridge-contract.md`](docs/native-bridge-contract.md) — the
  `NativeAdaptiveAudio` command/event contract between JS and Kotlin.
- [`docs/quality-gates.md`](docs/quality-gates.md) — `npm run verify` and what CI adds.
- [`docs/adr/`](docs/adr) — architecture decisions.

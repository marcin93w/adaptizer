# Adaptizer

Real-time listener context as MIDI input for music production.

Adaptizer maps *real-world listener context* — how the song is being listened to,
reduced to an intensity metric — to MIDI CC messages in your DAW. You are free to
use that input however you like to adapt your song to the listener's activity. It
opens an entirely new dimension, one that connects the artist with the listener in
a unique way.

Once the song is ready, Adaptizer helps you export it in multiple variants, in a
format ready to stream from the Adaptizer mobile app. The player app measures the
listener's context on the device and smoothly switches to the matching variant
while the song plays, so the music adapts to the situation it is heard in.

Adaptizer relies on the MIDI protocol, so it works with any DAW. Exporting a song
currently supports Ableton Live only.

## Components

| Component | What it is |
| --- | --- |
| [InstrumentUI](InstrumentUI/README.md) | Desktop (Electron) editor for producers: configure the context → MIDI CC mapping, audition it live, and export the song as a DASH stream. |
| [Instrument](Instrument/README.md) | The original Python console instrument. Same job as InstrumentUI, driven by typed commands. |
| [Player](Player/README.md) | Android app that streams a song, measures listener context on the device and switches tracks in real time. |
| [API](API/README.md) | Cloudflare Worker serving the songs catalog to the Player. Audio is served from an R2 bucket. |

## Publishing a song

1. Map your controls and export the song with [InstrumentUI](InstrumentUI/README.md).
2. Upload the export and add a catalog row — see [API](API/README.md).
3. Play it in the [Player](Player/README.md).

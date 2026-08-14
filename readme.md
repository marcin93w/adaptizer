<!-- Claude/Codex: Please never edit this file, if you think changes are needed, point suggested changes in the output instead. This is the front page of the project on GitHub, I want it to be free from AI slop. -->

# Adaptizer

Real-time listener context as MIDI input for music production.

Adaptizer maps *real-world listener context* — how the song is being listened to — to MIDI CC messages in your DAW. 
You pick the dimension your song adapts along, for example, volume, listener heart rate, movement speed, or a combination of them, and use it however you like to adapt the song to the listener's situation. 
<br>It opens an entirely new dimension for music production, one that connects the artist with the listener in a unique way.

Once the song is ready, Adaptizer helps you export it in multiple variants, in a format ready to stream from the Adaptizer mobile app. 
The player app measures the listener's context on the device and smoothly switches to the matching variant while the song plays.

Adaptizer relies on the MIDI protocol, so it works with any DAW. Exporting automation currently supports Ableton Live only.

## Components

| Component | What it is |
| --- | --- |
| [Instrument](Instrument/README.md) | Desktop editor for producers: pick the song's dimension, configure the MIDI CC mapping, and play with it in your favorite DAW. When ready, export the song in a streamable format. <br> *NOTE: Three external tools are needed to use the Adaptizer: LoopMIDI, FFmpeg, and Shaka packager, see setup instructions in the Instrument readme.* |
| [Player](Player/README.md) | Android app that streams a song, measures listener context on the device and adapts audio in real time. |
| [API](API/README.md) | API serving the songs catalog to the Player. Audio and API are hosted on Claudflare. |

## Publishing a song

1. Map your controls and export the song with [Instrument](Instrument/README.md).
2. Upload the export and add a catalog row — see [API](API/README.md).
3. Play it in the [Player](Player/README.md).

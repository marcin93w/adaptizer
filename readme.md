# Adaptizer

Real-time listener context as MIDI input for music production.

## For music producers

Adaptizer relies on MIDI protocol and works with any DAW.

### Windows

Prerequisites:
- Python 3
- [LoopMIDI](https://www.tobias-erichsen.de/software/loopmidi.html)
- [FFmpeg](https://www.ffmpeg.org/download.html)
- [Shaka packager](https://github.com/shaka-project/shaka-packager)


Setup:
1. Add new loopback port in loopMIDI, use `Adaptizer` as a name.
1. Setup `Adaptizer` MIDI port as a MIDI remote in your DAW.
1. Run python [main.py](Instrument/main.py).
1. Add MIDI map for controls in your DAW (You can use `assign <controlTypeNumber>` to send test signal from Adaptizer).
1. Configure controls in Adaptizer to map them to user context input (or use `load conf.adp` to import example configuration).
1. Run `set INTENSITY <0-9>` to test your controls while playing song in DAW.

Export:
1. Export your song in wav format on every input value (use `0.wav`, `1.wav`, etc as file names).
1. Put shaka packager executable in the same directory, or adjust location in [dash-converter.ps1](Instrument/dash-converter.ps1) script.
1. Run `dash-converter.ps1 <bpm-of-your-song>` 
1. Host files together with the generated manifest.
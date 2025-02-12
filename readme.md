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
1. Update path of shaka packager executable in [dash-converter.ps1](Instrument/dash-converter.ps1) script.

Usage:
1. Setup `Adaptizer` MIDI port as a MIDI remote in your DAW.
1. Run 'python [main.py](Instrument/main.py)' to start Adaptizer.
1. Add MIDI map for controls in your DAW (You can use `assign <controlTypeNumber>` to send test signal from Adaptizer).
1. Configure controls in Adaptizer to map them to user context input (or use `load conf.adp` to import example configuration).
1. Run `set INTENSITY <0-9>` to test your controls while playing song in DAW.
1. When your song is ready, run `e <outputPath> <bpm>` to export in DASH format (only Ableton is supported for now).

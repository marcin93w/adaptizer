# test-media

Deterministic, offline DASH audio fixture. It lets instrumentation tests
exercise representation selection (`AdaptizerTrackSelection` /
`AdaptizerTrackSelector`, see [`../docs/adaptive-audio.md`](../docs/adaptive-audio.md)
section 4) without depending on the production CDN.

## Tooling used

- `ffmpeg version 7.1-essentials_build-www.gyan.dev` (built with
  `--enable-libopus`), at `C:\ProgramData\chocolatey\bin\ffmpeg.exe`
- `ffprobe`, same build, for validation
- Python 3.10.2 (`C:\Python310\python.exe`), standard library only, for
  `serve.py` and for validating XML/manifest structure while building the
  fixture
- `shaka-packager` is not available in this environment and was not used.

## Production manifest shape (reference, fetched once for comparison)

Fetched `https://pub-fb297744d1fd4584a256f702d29363a8.r2.dev/Sample/manifest.mpd`
once to confirm the shape (network was available). Production is generated
by `shaka-packager v3.4.2` and looks like:

```xml
<MPD ... type="static" mediaPresentationDuration="PT59.102001S">
  <Period id="0">
    <AdaptationSet id="0" contentType="audio" subsegmentAlignment="true">
      <Representation id="0" bandwidth="126980" codecs="opus"
                      mimeType="audio/webm" audioSamplingRate="48000">
        <AudioChannelConfiguration schemeIdUri="urn:mpeg:dash:23003:3:audio_channel_configuration:2011" value="2"/>
        <BaseURL>audio0_dash.webm</BaseURL>
        <SegmentBase indexRange="333-1372" timescale="1000000">
          <Initialization range="0-332"/>
        </SegmentBase>
      </Representation>
      <!-- ... Representation id="1" through id="9", one BaseURL file each ... -->
    </AdaptationSet>
  </Period>
</MPD>
```

Key shape facts confirmed from the live manifest: one `Period`, one audio
`AdaptationSet` (`id="0"`), exactly ten `Representation` elements
(`id="0"`..`id="9"`), each `codecs="opus"` `mimeType="audio/webm"`
`audioSamplingRate="48000"`, each with its own single-file `BaseURL` and a
`SegmentBase`/`indexRange` (byte-range) addressing scheme rather than
`SegmentTemplate`. This fixture reproduces that same addressing scheme (see
"Manifest structure" below).

## What this fixture is

Ten ~6-second synthetic sine-tone audio tracks, one per representation
index 0-9, each encoded to Opus in a WebM container. Representation *i*
carries a pure sine tone at `220 * (i + 1)` Hz, so an instrumentation test
can decode a representation and verify *which* one played by checking the
dominant frequency, not just that "some" audio played.

| Representation index | Representation `id` | Frequency (Hz) | File |
|---|---|---|---|
| 0 | 0 |  220 | `dash/audio0.webm` |
| 1 | 1 |  440 | `dash/audio1.webm` |
| 2 | 2 |  660 | `dash/audio2.webm` |
| 3 | 3 |  880 | `dash/audio3.webm` |
| 4 | 4 | 1100 | `dash/audio4.webm` |
| 5 | 5 | 1320 | `dash/audio5.webm` |
| 6 | 6 | 1540 | `dash/audio6.webm` |
| 7 | 7 | 1760 | `dash/audio7.webm` |
| 8 | 8 | 1980 | `dash/audio8.webm` |
| 9 | 9 | 2200 | `dash/audio9.webm` |

This matches the index scheme `AdaptizerTrackSelector.kt` hard-codes:
`intArrayOf(0,1,2,3,4,5,6,7,8,9)` passed into `AdaptizerTrackSelection`.

Encoding parameters: Opus, 32 kbps CBR (`-vbr off`), 48000 Hz, stereo,
duration 6.008 s (6 s requested + Opus's fixed pre-skip/priming). Codec and
container match production (`opus` / `audio/webm`); duration is much
shorter than production's ~59 s per-song content since this is a synthetic
test tone, not a song.

## Generating it

```bash
cd test-media
./generate-fixture.sh
```

The script (`test-media/generate-fixture.sh`) does two ffmpeg passes per
representation set:

**1. Encode pass** (run once per representation `i`, frequency `220*(i+1)`):

```bash
ffmpeg -y -hide_banner -loglevel warning \
  -f lavfi -i "sine=frequency=<FREQ>:sample_rate=48000:duration=6" \
  -c:a libopus -b:a 32k -vbr off -application audio -ac 2 \
  -metadata creation_time="1970-01-01T00:00:00.000000Z" \
  -map_metadata -1 -fflags +bitexact -flags:a +bitexact \
  -dash 1 -dash_track_number <i+1> \
  dash/audio<i>.webm
```

**2. Manifest pass** (run once, reading all ten encoded files back in):

```bash
ffmpeg -y -hide_banner -loglevel warning \
  -f webm_dash_manifest -i dash/audio0.webm \
  -f webm_dash_manifest -i dash/audio1.webm \
  ... \
  -f webm_dash_manifest -i dash/audio9.webm \
  -c copy \
  -map 0 -map 1 ... -map 9 \
  -f webm_dash_manifest \
  -adaptation_sets "id=0,streams=0,1,2,3,4,5,6,7,8,9" \
  dash/manifest.mpd
```

### A gotcha worth documenting: `-cues_to_front`

The ffmpeg wiki / common examples for WebM DASH often suggest
`-cues_to_front 1` on the encode pass to move the Matroska `Cues` (seek
index) element to the front of the file. **Do not do this here.** It moves
`Cues` but does not update the `SeekHead` element's recorded byte offset for
it, and ffmpeg's `webm_dash_manifest` demuxer looks up `Cues` via
`SeekHead`, not by scanning the file. With `-cues_to_front 1` the manifest
pass fails with `Error parsing Cues` / `Operation not permitted`. Without
it, ffmpeg's default Matroska muxer layout keeps `SeekHead` and `Cues`
consistent and the manifest pass succeeds. Root-caused by reading
`webm_dash_manifest_cues()` in ffmpeg's `libavformat/matroskadec.c`
(release/7.1 branch), which requires a `SeekHead` entry pointing at `Cues`
whose byte offset it can seek to directly.

### Determinism

Verified empirically: running `generate-fixture.sh` twice in a row on this
machine produced byte-identical output for all ten `.webm` files and
`manifest.mpd` (`cmp` reported no differences; confirmed by full MD5 match
on `audio0.webm` specifically: `467b39ce75b8192fb83ced49b93b35d0`).

What makes this possible:
- The source is a synthetic `sine` generator (`-f lavfi`), not a file read,
  so there's no filesystem timestamp or content drift.
- `-metadata creation_time="1970-01-01T00:00:00.000000Z"` pins the WebM
  `DateUTC` element, which the Matroska muxer otherwise stamps with the
  current wall-clock time on every run - this was the only source of
  non-determinism found, and fixing it was sufficient for full byte-identity.
- `-map_metadata -1 -fflags +bitexact -flags:a +bitexact` strip incidental
  metadata and disable non-bitexact encoder behavior.

**Caveat:** determinism is scoped to a fixed ffmpeg/libopus build. The
`ENCODER=Lavc libopus` stream tag that libopus writes during encoding (not
copied metadata, so `-map_metadata` does not remove it) will change if the
ffmpeg or libopus version changes, which would change output bytes even
though the audio content is identical. Re-running on a different
ffmpeg/libopus build should be expected to produce different (but
functionally equivalent) files, not necessarily byte-identical ones.

## Manifest structure: SegmentBase vs SegmentTemplate

**ffmpeg's `webm_dash_manifest` muxer uses `SegmentBase` with byte-range
(`indexRange`/`Initialization range`) addressing - the same addressing
family as production, NOT `SegmentTemplate`.** This is a good match: both
this fixture and production point one `BaseURL` at a single WebM file per
representation and let the client range-read the Matroska `Cues` element
(via `indexRange`) to build a seek table, then range-read the actual init
segment and media clusters out of that same file. This means Media3's
`DashMediaSource` exercises the same `SegmentBase`/byte-range code path
against this fixture as it does against production - `SegmentTemplate`
would have exercised a materially different code path (segment-per-URL
rather than segment-per-byte-range), so this was a deliberate check, not
an assumption.

Structural differences that remain, found by diffing generated
`dash/manifest.mpd` against the fetched production manifest:

| | Production (shaka-packager) | This fixture (ffmpeg) |
|---|---|---|
| `AdaptationSet` attributes | `contentType="audio"` | `mimeType`, `codecs`, `audioSamplingRate` at the `AdaptationSet` level (hoisted up since all ten representations share them) instead of `contentType` |
| `Representation` attributes | `codecs`, `mimeType`, `audioSamplingRate` per-Representation | only `id`, `bandwidth` per-Representation (codec/mime/rate live on the parent `AdaptationSet` instead) |
| `AudioChannelConfiguration` element | present per-Representation | **absent** - ffmpeg's `webm_dash_manifest` muxer does not emit this element |
| `MPD` root namespace | `urn:mpeg:dash:schema:mpd:2011` (lowercase) | `urn:mpeg:DASH:schema:MPD:2011` (mixed case) |
| `profiles` | `urn:mpeg:dash:profile:isoff-on-demand:2011` | `urn:mpeg:dash:profile:webm-on-demand:2012` |
| Per-representation `bandwidth` | varies (111114-148000) with real per-song audio content | identical (28781) for all ten - expected, since all ten representations here are the same duration/bitrate/channel-count and only differ by sine frequency, which barely affects Opus-encoded size |

None of these differences should affect whether Media3's DASH parser
accepts the manifest or which code path it takes for track selection -
they're either attribute-placement/casing differences the DASH XML schema
tolerates, or (for `AudioChannelConfiguration`) an element Media3 also
tolerates being absent on since it falls back to sensible defaults. They are
listed so a test author can decide whether any of them is worth asserting on.

## Total size

All ten `.webm` files + `manifest.mpd`: **~266 KB** (well under the 5 MB
target). Each `audioN.webm` is ~26.4 KB; `manifest.mpd` is ~2.4 KB.

## Validation performed

```bash
# Direct per-file validation
ffprobe -v error -show_entries stream=codec_name,codec_type,sample_rate,channels \
        -show_entries format=format_name,duration dash/audio0.webm
# -> codec_name=opus, codec_type=audio, sample_rate=48000, channels=2
#    format_name=matroska,webm, duration=6.008000
# (repeated for audio0.webm .. audio9.webm - all ten pass identically)

# Manifest-level validation (resolves the DASH manifest and lists all streams)
ffprobe -v error -show_entries stream=index,codec_name,codec_type manifest.mpd
# -> ten streams, index=0..9, codec_name=opus, codec_type=audio, each
```

Representation `id` / `bandwidth` list extracted from `dash/manifest.mpd`:

```
id=0 bandwidth=28781
id=1 bandwidth=28781
id=2 bandwidth=28781
id=3 bandwidth=28781
id=4 bandwidth=28781
id=5 bandwidth=28781
id=6 bandwidth=28781
id=7 bandwidth=28781
id=8 bandwidth=28781
id=9 bandwidth=28781
```

## Local HTTP test server (`serve.py`)

`test-media/serve.py` serves `test-media/dash/` (or any `--dir`) over plain
HTTP using only the Python 3 standard library (`http.server` /
`socketserver` - no pip installs), with:

- HTTP Range request support (`bytes=start-end`, `bytes=start-`,
  `bytes=-suffixLength`), returning `206 Partial Content` with
  `Content-Range`/`Content-Length`/`Accept-Ranges` headers. This is
  necessary because the fixture's `SegmentBase`/`indexRange` addressing
  requires byte-range GETs against the `.webm` files, and Python's
  `http.server.SimpleHTTPRequestHandler` does not support `Range` out of
  the box - `serve.py` overrides `send_head()` to add it.
- Correct `Content-Type`: `application/dash+xml` for `.mpd`, `video/webm`
  for `.webm`.
- `--port` flag, default `8099`.

```bash
python test-media/serve.py --port 8099
# or, explicit interpreter path used in this environment:
C:\Python310\python.exe test-media\serve.py --port 8099
```

Verified with `curl` (server started, requests made, server stopped):

| Request | Result |
|---|---|
| `GET /manifest.mpd` (no Range) | `200`, `Content-Type: application/dash+xml`, `Content-Length: 2398` |
| `GET /audio0.webm` (no Range) | `200`, `Content-Type: video/webm`, full 26404 bytes |
| `GET /audio0.webm` with `Range: bytes=0-99` | `206`, `Content-Range: bytes 0-99/26404`, `Content-Length: 100` |
| `GET /audio0.webm` with `Range: bytes=-50` (suffix range) | `206` |
| `GET /doesnotexist.webm` | `404` |

## Negative fixtures (`test-media/malformed/`)

For later error-path tests (so they can assert a typed error instead of an
`IndexOutOfBoundsException` or an unhandled XML parse exception):

- **`malformed/not-xml.mpd`** - not valid XML at all (unclosed tags, stray
  text, unescaped `&`). Confirmed with `xml.etree.ElementTree.parse()`,
  which raises `xml.etree.ElementTree.ParseError: syntax error: line 1,
  column 0` on this file.
- **`malformed/too-few-representations.mpd`** - structurally valid DASH XML
  (parses cleanly, same `MPD`/`Period`/`AdaptationSet` shape as the real
  fixture) but its audio `AdaptationSet` has only **3** `Representation`
  elements (`id="0"`, `id="1"`, `id="2"`), reusing `BaseURL` references
  (`../dash/audio0.webm` etc.) that point at real files in `dash/`, so it is
  a genuinely fetchable/playable manifest - just with the wrong
  representation count. Confirmed with `xml.etree.ElementTree`: parses
  cleanly, `findall('.//Representation')` returns exactly 3 elements. This
  lets a test exercise `AdaptizerTrackSelector`/`AdaptizerTrackSelection`
  against a manifest with fewer than the hard-coded 10 tracks and assert on
  a typed error rather than an index exception.

## Regenerating

```bash
cd test-media
./generate-fixture.sh
```

Safe to re-run: it removes and rewrites everything under `dash/` (does not
touch `malformed/`). Re-running on the same ffmpeg/libopus build reproduces
byte-identical output (see "Determinism" above).

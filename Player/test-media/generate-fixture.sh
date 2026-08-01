#!/usr/bin/env bash
# generate-fixture.sh
#
# Generates a deterministic, offline, ten-representation DASH audio fixture
# under test-media/dash/, matching the production AdaptationSet shape
# described in docs/migration/M00-baseline.md section 3 ("Manifest contract"):
# one audio AdaptationSet, ten WebM/Opus Representations, indices 0-9.
#
# Requires: ffmpeg (with --enable-libopus) and ffprobe on PATH.
# Tested against: ffmpeg version 7.1-essentials_build-www.gyan.dev
#
# Usage (Git Bash / any POSIX shell on Windows, or Linux/macOS):
#   cd test-media
#   ./generate-fixture.sh
#
# Determinism: every ffmpeg invocation below is byte-for-byte reproducible on
# a given ffmpeg/libopus build:
#   - input is a synthetic `sine` source (no wall-clock or filesystem input)
#   - -map_metadata -1 strips any incidental metadata
#   - -metadata creation_time="1970-01-01T00:00:00.000000Z" pins the WebM
#     "DateUTC" element, which the matroska muxer otherwise fills in with the
#     current wall-clock time on every run
#   - -fflags +bitexact -flags:a +bitexact disable encoder IDs/timestamps
#     that could otherwise vary
# The one thing that is NOT stripped is the `ENCODER=Lavc libopus` stream
# tag libopus embeds during encoding (not copied metadata, so
# -map_metadata does not touch it). It is stable across repeated runs on the
# same ffmpeg/libopus build, but WILL change if the ffmpeg/libopus version
# changes. This has been verified empirically: two consecutive runs of this
# script on the same machine produced byte-identical .webm and .mpd output
# (see test-media/README.md for the verification commands and MD5s).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT_DIR="${SCRIPT_DIR}/dash"

mkdir -p "${OUT_DIR}"
rm -f "${OUT_DIR}"/audio*.webm "${OUT_DIR}"/manifest.mpd

NUM_REPRESENTATIONS=10
DURATION_SECONDS=6
SAMPLE_RATE=48000
BITRATE_KBPS=32

echo "Generating ${NUM_REPRESENTATIONS} synthetic Opus/WebM representations..."

INPUT_ARGS=()
MAP_ARGS=()

for i in $(seq 0 $((NUM_REPRESENTATIONS - 1))); do
  freq=$((220 * (i + 1)))
  out="${OUT_DIR}/audio${i}.webm"
  echo "  representation ${i}: ${freq} Hz -> ${out}"

  # Encode pass: synthetic sine tone -> Opus in WebM, with the "-dash 1"
  # muxer flag so the resulting file carries the SeekHead->Cues linkage the
  # webm_dash_manifest demuxer/muxer requires in the next step.
  #
  # NOTE: do NOT pass -cues_to_front here. It shifts the Cues element to the
  # front of the file but does not update the SeekHead's recorded byte
  # offset for it, which makes ffmpeg's webm_dash_manifest demuxer fail with
  # "Error parsing Cues" when the manifest-building pass below reads these
  # files back in. Without -cues_to_front, ffmpeg's webm muxer places Cues
  # at a position the SeekHead correctly references, and parsing succeeds.
  ffmpeg -y -hide_banner -loglevel warning \
    -f lavfi -i "sine=frequency=${freq}:sample_rate=${SAMPLE_RATE}:duration=${DURATION_SECONDS}" \
    -c:a libopus -b:a "${BITRATE_KBPS}k" -vbr off -application audio -ac 2 \
    -metadata creation_time="1970-01-01T00:00:00.000000Z" \
    -map_metadata -1 -fflags +bitexact -flags:a +bitexact \
    -dash 1 -dash_track_number $((i + 1)) \
    "${out}"

  INPUT_ARGS+=(-f webm_dash_manifest -i "${out}")
  MAP_ARGS+=(-map "${i}")
done

echo "Building manifest.mpd..."

# Manifest-building pass: read each encoded file back in through the
# webm_dash_manifest demuxer (which extracts SegmentBase/Cues/bandwidth
# metadata from each file) and emit a single MPD via the webm_dash_manifest
# muxer, with all ten streams grouped into one audio AdaptationSet (id=0),
# matching the production shape (one AdaptationSet, ten Representations,
# indices 0-9 as consumed by AdaptizerTrackSelection).
STREAM_LIST=$(seq -s, 0 $((NUM_REPRESENTATIONS - 1)))

ffmpeg -y -hide_banner -loglevel warning \
  "${INPUT_ARGS[@]}" \
  -c copy \
  "${MAP_ARGS[@]}" \
  -f webm_dash_manifest \
  -adaptation_sets "id=0,streams=${STREAM_LIST}" \
  "${OUT_DIR}/manifest.mpd"

echo "Done. Output in ${OUT_DIR}"
du -sh "${OUT_DIR}"/*.webm "${OUT_DIR}/manifest.mpd" 2>/dev/null || true

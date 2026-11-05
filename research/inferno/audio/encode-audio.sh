#!/usr/bin/env bash
# @file encode-audio.sh
# @purpose RESEARCH/ASSET BUILD — renders masters with render-audio.cjs, encodes game assets with
#          ffmpeg (libvorbis .ogg + libmp3lame .mp3 for cues; .ogg + 24 kHz .wav fallback for the
#          loop to avoid MP3 encoder-delay gaps), writes an audition MP3 to review-artifacts, and
#          measures integrated loudness / true peak with ffmpeg's ebur128 filter.
# @author Agent 934  @date 2026-11-05  @license Proprietary – available for licensing
set -euo pipefail
cd "$(dirname "$0")/../../.."
MASTER=research/inferno/audio/out
ASSETS=public/assets/inferno/audio
REVIEW=docs/inferno-polish-001/review-artifacts/audio
node research/inferno/audio/render-audio.cjs --out "$MASTER"
mkdir -p "$ASSETS" "$REVIEW"
for f in "$MASTER"/*.wav; do
  n=$(basename "$f" .wav)
  [ "$n" = "audition-reel" ] && continue
  ffmpeg -loglevel error -y -i "$f" -ac 1 -c:a libvorbis -q:a 4 "$ASSETS/$n.ogg"
  if [ "$n" = "inferno-forge-loop" ]; then
    ffmpeg -loglevel error -y -i "$f" -ac 1 -ar 24000 -c:a pcm_s16le "$ASSETS/$n.wav"
  else
    ffmpeg -loglevel error -y -i "$f" -ac 1 -c:a libmp3lame -b:a 96k "$ASSETS/$n.mp3"
  fi
done
ffmpeg -loglevel error -y -i "$MASTER/audition-reel.wav" -ac 1 -c:a libmp3lame -b:a 128k "$REVIEW/inferno-audition-reel.mp3"
ffmpeg -loglevel error -y -i "$MASTER/inferno-forge-loop.wav" -t 16 -ac 1 -c:a libmp3lame -b:a 128k "$REVIEW/inferno-forge-loop-preview.mp3"
# Loudness / true peak (ebur128 with peak=true). Short cues are below the 400 ms gating block, so
# their integrated loudness is reported as measured (often -70/unmeasurable) — true peak is the useful figure.
{
  echo "file,integrated_lufs,true_peak_dbtp"
  for f in "$MASTER"/*.wav "$ASSETS"/*.ogg; do
    out=$(ffmpeg -hide_banner -nostats -i "$f" -filter_complex ebur128=peak=true -f null - 2>&1 | tail -14)
    I=$(echo "$out" | awk '/I:/{print $2; exit}')
    TP=$(echo "$out" | awk '/Peak:/{print $2; exit}')
    echo "$(basename "$f"),$I,$TP"
  done
} > docs/inferno-polish-001/evidence/audio-loudness.csv
cp "$MASTER/render-manifest.json" docs/inferno-polish-001/evidence/audio-render-manifest.json
du -ch "$ASSETS"/* | tail -1

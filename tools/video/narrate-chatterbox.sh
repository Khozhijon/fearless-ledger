#!/bin/sh
# Step 1 (Chatterbox voice) of the demo video: speak every scene of script.json with Chatterbox
# in a CPU container, normalise loudness, and write <id>.aiff + durations.json for record.cjs/mux.cjs.
#   HF_CACHE=/path/to/hf-cache tools/video/narrate-chatterbox.sh [scene id ...]
set -e
cd "$(dirname "$0")/../.."
TMP=submission/video-tmp
HF_CACHE=${HF_CACHE:-$PWD/.cache/hf}
PIP_CACHE=${PIP_CACHE:-$PWD/.cache/pip}
mkdir -p "$TMP" "$HF_CACHE" "$PIP_CACHE"
docker run --rm -v "$PWD":/v -v "$HF_CACHE":/hf -v "$PIP_CACHE":/pip -w /v -e HF_HOME=/hf -e PIP_CACHE_DIR=/pip python:3.11-slim sh -c \
  "apt-get update -qq >/dev/null && apt-get install -y -qq libgomp1 libsndfile1 >/dev/null 2>&1; pip install -q --root-user-action=ignore chatterbox-tts soundfile 2>&1 | tail -3; python tools/video/chatterbox_gen.py $*"
node -e '
const {execFileSync} = require("node:child_process"), fs = require("node:fs"), path = require("node:path")
const tmp = "submission/video-tmp", durations = {}
for (const s of JSON.parse(fs.readFileSync("tools/video/script.json", "utf8"))) {
  const wav = path.join(tmp, s.id + ".voice.wav"), aiff = path.join(tmp, s.id + ".aiff")
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", wav, "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", "44100", aiff])
  durations[s.id] = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", aiff]).toString())
  console.log(s.id.padEnd(12), durations[s.id].toFixed(1), "s")
}
fs.writeFileSync(path.join(tmp, "durations.json"), JSON.stringify(durations, null, 2))
console.log("total", Object.values(durations).reduce((a, b) => a + b, 0).toFixed(1), "s")'

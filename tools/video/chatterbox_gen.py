# Narration with Chatterbox (Resemble AI, MIT licence), its built-in default voice, on CPU.
# Reads tools/video/script.json and writes submission/video-tmp/<id>.voice.wav per scene.
#   python chatterbox_gen.py [scene id ...]
import json, os, re, sys
import torch, torchaudio as ta
from chatterbox.tts import ChatterboxTTS

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "submission", "video-tmp")
os.makedirs(OUT, exist_ok=True)
scenes = json.load(open(os.path.join(ROOT, "tools", "video", "script.json")))
wanted = set(sys.argv[1:])
torch.manual_seed(7)
model = ChatterboxTTS.from_pretrained(device="cpu")

for scene in scenes:
    if wanted and scene["id"] not in wanted:
        continue
    # One sentence at a time keeps the prosody steady; join with short pauses.
    parts = [p.strip() for p in re.split(r"(?<=[.:?])\s+", scene["say"]) if p.strip()]
    gap = torch.zeros(1, int(model.sr * 0.28))
    chunks = []
    for p in parts:
        chunks += [model.generate(p), gap]
    wav = torch.cat(chunks[:-1], dim=1)
    out = os.path.join(OUT, scene["id"] + ".voice.wav")
    ta.save(out, wav, model.sr)
    print(scene["id"], "%.1f s" % (wav.shape[1] / model.sr), flush=True)

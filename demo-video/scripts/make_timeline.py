"""Works out the final timeline from beats.json and the captured footage, and makes the soundtrack.
Usage: python scripts/make_timeline.py [live|local]
All sound is synthesised here, so there's no third-party music to clear.
If public/ondevice.mp4 exists (your own screen recording of the on-device test), it is used for the on-device scene."""
import json, os, sys, wave
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
target = sys.argv[1] if len(sys.argv) > 1 else "live"
beats = json.load(open(os.path.join(ROOT, "beats.json"), encoding="utf-8"))
clips = json.load(open(os.path.join(ROOT, "public", "footage", f"{target}.json"), encoding="utf-8"))["clips"]
has_recording = os.path.exists(os.path.join(ROOT, "public", "ondevice.mp4"))

out, t = [], 0.0
for b in beats:
    if "clip" in b and b["clip"] not in clips:
        print("skipping", b["clip"])
        continue
    b = dict(b)
    if b.get("kind") == "ondevice":
        b["recording"] = has_recording
    b["start"] = round(t, 3)
    t += b["d"]
    out.append(b)
total = t
json.dump({"target": target, "total": total, "beats": out, "clips": clips}, open(os.path.join(ROOT, "src", "timeline.json"), "w", encoding="utf-8"), indent=1)
print(f"{len(out)} beats, {total:.1f}s, on-device recording: {'yes' if has_recording else 'no (placeholder)'}")
assert total < 175, "too long"

SR = 44100
N = int(SR * (total + 0.5))
mix = np.zeros((N, 2))


def tone(freq, dur, amp, attack=0.8, release=1.5, detune=0.0):
    n = int(SR * dur)
    tt = np.arange(n) / SR
    env = np.minimum(1, tt / attack) * np.minimum(1, (dur - tt) / release)
    w = np.sin(2 * np.pi * freq * tt) + 0.35 * np.sin(2 * np.pi * freq * 2.001 * tt) + 0.12 * np.sin(2 * np.pi * freq * 3.002 * tt)
    r = np.sin(2 * np.pi * (freq + detune) * tt) + 0.35 * np.sin(2 * np.pi * (freq + detune) * 2.003 * tt) + 0.12 * np.sin(2 * np.pi * (freq + detune) * 3.001 * tt)
    return np.stack([w, r], axis=1) * (env * amp)[:, None]


def place(sig, at):
    i = int(at * SR)
    if i >= N:
        return
    e = min(N, i + len(sig))
    mix[i:e] += sig[: e - i]


def pluck(freq, amp, dur=1.1, decay=5.5):
    tt = np.arange(int(SR * dur)) / SR
    env = np.exp(-tt * decay)
    s = (np.sin(2 * np.pi * freq * tt) + 0.25 * np.sin(2 * np.pi * freq * 2 * tt)) * env * amp
    return np.stack([s, s], axis=1)


# A warm, curious bed in C major (I - vi - IV - V), a little brighter than a study playlist.
CHORDS = [[261.63, 329.63, 392.0, 493.88], [220.0, 261.63, 329.63, 392.0], [174.61, 220.0, 261.63, 329.63], [196.0, 246.94, 293.66, 392.0]]
bar, i, at = 3.6, 0, 0.0
rng = np.random.default_rng(11)
while at < total:
    ch = CHORDS[i % 4]
    for f in ch:
        place(tone(f, bar + 1.4, 0.016, attack=0.8, release=1.5, detune=0.6), at)
    place(tone(ch[0] / 2, bar + 0.9, 0.028, attack=0.4, release=1.1, detune=0.2), at)
    # Light "pencil" plucks on the off-beats.
    for k in range(4):
        place(pluck(ch[int(rng.integers(0, 4))] * 2, 0.02, dur=0.7, decay=7), at + k * bar / 4 + bar / 8)
    at += bar
    i += 1

fade = np.ones(N)
a, z = int(SR * 1.5), int(SR * 3)
fade[:a] = np.linspace(0, 1, a)
end = int(SR * total)
fade[end - z:end] = np.linspace(1, 0, z)
fade[end:] = 0
mix *= fade[:, None]

# Soft clicks, and a little two-note chime for good moments (balanced lines, correct answers, stickers).
tt = np.arange(int(SR * 0.05)) / SR
click = (np.sin(2 * np.pi * 1700 * tt) * 0.5 + rng.normal(0, 0.18, len(tt))) * np.exp(-tt * 170) * 0.2
click = np.stack([click, click], axis=1)
for b in out:
    for c in b.get("click", []):
        place(click, b["start"] + c)
    if b.get("good"):
        place(pluck(1046.5, 0.07), b["start"] + 0.12)
        place(pluck(1568.0, 0.055), b["start"] + 0.26)

peak = np.abs(mix).max() or 1
data = (np.clip(mix * (0.7 / peak), -1, 1) * 32767).astype(np.int16)
with wave.open(os.path.join(ROOT, "public", "audio.wav"), "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(data.tobytes())
print("audio.wav written")

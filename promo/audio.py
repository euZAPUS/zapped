#!/usr/bin/env python3
"""Synthesises the promo soundtrack (music + sound design) from out/cues.json.

Everything is generated with numpy: soft pads, a plucked arpeggio, a muted pulse, key clicks that
follow the typing on screen, whooshes and a final chord. No samples, no external assets.
Run:  python3 promo/audio.py   ->  promo/out/audio.wav
"""
import json
import math
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
SR = 48000
rng = np.random.default_rng(42)

cues = json.loads((OUT / "cues.json").read_text())
DUR = float(cues["duration"])
N = int((DUR + 3.0) * SR)  # a little tail for the reverb

dry = np.zeros((N, 2))
wet = np.zeros((N, 2))  # reverb send


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def tt(dur):
    return np.arange(int(dur * SR)) / SR


def add(buf, sig, t0, gain=1.0, pan=0.0):
    i = int(t0 * SR)
    if i < 0 or i >= len(buf):
        return
    sig = sig[: len(buf) - i]
    l = math.cos((pan + 1) * math.pi / 4)
    r = math.sin((pan + 1) * math.pi / 4)
    buf[i : i + len(sig), 0] += sig * gain * l
    buf[i : i + len(sig), 1] += sig * gain * r


def env(n, atk, rel, curve=2.0):
    e = np.ones(n)
    a = max(1, int(atk * SR))
    r = max(1, int(rel * SR))
    e[:a] = np.linspace(0, 1, min(a, n)) ** 1.5
    if r < n:
        e[-r:] *= np.linspace(1, 0, r) ** curve
    return e


# --------------------------------------------------------------------------- instruments

def pad(freq, dur, atk=0.9, rel=1.4, harm=6):
    t = tt(dur + rel)
    sig = np.zeros_like(t)
    for d, ph in ((1.0, 0.0), (1.004, 1.3), (0.996, 2.1)):
        for h in range(1, harm + 1):
            sig += np.sin(2 * math.pi * freq * d * h * t + ph * h) / h ** 1.7
    sig *= 0.18
    sig *= 1 + 0.06 * np.sin(2 * math.pi * 0.23 * t)
    return sig * env(len(t), atk, rel)


def pluck(freq, dur=0.7):
    t = tt(dur)
    s = np.sin(2 * math.pi * freq * t) * np.exp(-t / 0.20)
    s += 0.35 * np.sin(2 * math.pi * freq * 2 * t) * np.exp(-t / 0.11)
    s += 0.12 * np.sin(2 * math.pi * freq * 3.01 * t) * np.exp(-t / 0.06)
    s *= np.minimum(1, t / 0.004)
    return s


def bell(freq, dur=1.8, bright=1.4):
    t = tt(dur)
    mod = bright * np.sin(2 * math.pi * freq * 2.005 * t) * np.exp(-t / 0.45)
    s = np.sin(2 * math.pi * freq * t + mod) * np.exp(-t / 0.7)
    return s * np.minimum(1, t / 0.003)


def sub(freq, dur, atk=0.02, decay=None):
    t = tt(dur)
    s = np.sin(2 * math.pi * freq * t)
    if decay:
        s *= np.exp(-t / decay)
    return s * env(len(t), atk, min(0.25, dur / 2))


def kick(dur=0.32):
    t = tt(dur)
    f = 42 + 90 * np.exp(-t / 0.035)
    ph = 2 * math.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t / 0.11) * np.minimum(1, t / 0.002)


def noise(n):
    return rng.standard_normal(n)


def lowpass(x, fc):
    a = 1 - math.exp(-2 * math.pi * fc / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc += a * (x[i] - acc)
        y[i] = acc
    return y


def highpass(x, fc):
    return x - lowpass(x, fc)


def hat(open_=False):
    n = int((0.22 if open_ else 0.05) * SR)
    t = np.arange(n) / SR
    s = highpass(noise(n), 6500) * np.exp(-t / (0.09 if open_ else 0.014))
    return s * 0.5


def click(kind):
    n = int(0.05 * SR)
    t = np.arange(n) / SR
    if kind in ("key", "click"):
        body = highpass(noise(n), 2500) * np.exp(-t / 0.005)
        body += 0.5 * np.sin(2 * math.pi * (170 + rng.uniform(-18, 18)) * t) * np.exp(-t / 0.014)
        return body * (0.55 if kind == "key" else 0.8)
    if kind == "space":
        body = highpass(noise(n), 1200) * np.exp(-t / 0.008) * 0.6
        body += 0.8 * np.sin(2 * math.pi * 105 * t) * np.exp(-t / 0.03)
        return body
    if kind == "back":
        return highpass(noise(n), 1800) * np.exp(-t / 0.006) * 0.4
    if kind == "err":
        return (np.sin(2 * math.pi * 92 * t) + 0.5 * np.sign(np.sin(2 * math.pi * 92 * t))) * np.exp(-t / 0.05) * 0.35
    return np.zeros(n)


def whoosh(dur, kind):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = noise(n)
    u = t / dur
    # time-varying low-pass: rising for "in"/"rise", falling for "out"
    if kind == "out":
        fc = 5200 * (1 - u) ** 1.5 + 300
    elif kind == "rise":
        fc = 300 + 7000 * u ** 2
    else:
        fc = 350 + 5500 * np.sin(u * math.pi / 2) ** 2
    y = np.empty(n)
    acc = 0.0
    for i in range(n):
        a = 1 - math.exp(-2 * math.pi * fc[i] / SR)
        acc += a * (x[i] - acc)
        y[i] = acc
    shape = np.sin(u * math.pi) ** (1.2 if kind != "rise" else 2.5)
    if kind == "rise":
        shape = u ** 2.2
    return y * shape * 3.0


# --------------------------------------------------------------------------- composition

CHORDS = {
    "Am": dict(bass=45, notes=[57, 60, 64, 67]),
    "F": dict(bass=41, notes=[53, 57, 60, 64]),
    "C": dict(bass=48, notes=[55, 60, 64, 67]),
    "G": dict(bass=43, notes=[55, 59, 62, 64]),
}
PROG = [(3.0, "F"), (5.0, "C"), (7.0, "G"), (9.0, "Am"), (11.0, "F"), (13.0, "C"), (15.0, "G"), (17.0, "Am"), (19.0, "F"), (21.0, "C"), (23.0, "G"), (25.0, "Am")]


def level(t, a, b, fi=1.0, fo=1.0):
    """0..1 ramp that is on between a and b."""
    return float(np.clip((t - a) / fi, 0, 1) * np.clip((b - t) / fo, 0, 1))


# intro: a slow swell on A minor, then the ignition
add(wet, pad(midi(45), 2.9, atk=2.2, rel=0.6), 0.0, 0.9)
add(wet, pad(midi(57), 2.9, atk=2.2, rel=0.6), 0.1, 0.7)
add(wet, pad(midi(64), 2.9, atk=2.4, rel=0.6), 0.2, 0.5)
add(dry, sub(midi(33), 2.4, atk=0.01, decay=0.9), 1.15, 0.6)
for k, n in enumerate([81, 84, 88, 93, 96]):
    add(wet, bell(midi(n), 2.2), 1.2 + k * 0.11, 0.16, pan=(-1) ** k * 0.5)
for k, n in enumerate([76, 79, 81, 84, 88, 91]):  # twinkles while the wordmark appears
    add(wet, pluck(midi(n)), 1.75 + k * 0.17, 0.2, pan=(-1) ** k * 0.6)

# pads and bass follow the chord changes
for i, (t0, name) in enumerate(PROG):
    t1 = PROG[i + 1][0] if i + 1 < len(PROG) else 27.5
    d = (t1 - t0) + 0.2
    ch = CHORDS[name]
    arc = float(np.clip((t0 - 3.0) / 19.0, 0, 1))  # the piece builds towards the personalisation scene
    g = 0.34 + 0.30 * arc
    for j, n in enumerate(ch["notes"]):
        add(wet, pad(midi(n), d, atk=0.7, rel=1.2), t0, g, pan=(j - 1.5) * 0.35)
    add(dry, sub(midi(ch["bass"]), d, atk=0.04), t0, 0.10 + 0.17 * arc)

# plucked arpeggio, 8th notes
PATTERN = [0, 2, 1, 3, 2, 3, 1, 2]
t = 3.0
step = 0.25
idx = 0
while t < 27.0:
    name = [c for s, c in PROG if s <= t][-1]
    notes = CHORDS[name]["notes"]
    n = notes[PATTERN[idx % 8]] + 12
    vel = 0.50 + 0.22 * (idx % 4 == 0) + 0.20 * float(np.clip((t - 3.0) / 19.0, 0, 1))
    v = vel * level(t, 3.0, 27.0, 1.2, 0.6)
    add(wet, pluck(midi(n)), t, 0.30 * v, pan=math.sin(idx * 0.9) * 0.55)
    add(dry, pluck(midi(n)), t, 0.10 * v, pan=math.sin(idx * 0.9) * 0.55)
    t += step
    idx += 1

# muted pulse: quarter-note kick from the result screen, hats from the selector scene
t = 7.0
while t < 27.0 - 0.01:
    add(dry, kick(), t, 0.36 * float(np.clip((t - 7.0) / 4.0, 0.25, 1)) * level(t, 7.0, 27.0, 0.3, 0.5))
    t += 0.5
t = 10.75
while t < 26.9:
    add(dry, hat(), t, 0.11 * level(t, 10.5, 27.0, 1.5, 0.4), pan=0.25)
    t += 0.5
t = 10.5
while t < 26.9:
    add(dry, hat(), t, 0.04 * level(t, 10.5, 27.0, 1.5, 0.4), pan=-0.25)
    t += 0.25

# --------------------------------------------------------------------------- cues from the animation

for c in cues["keys"]:
    k = c["k"]
    jitter = rng.uniform(-0.004, 0.004)
    add(dry, click(k), c["t"] + jitter, 0.5 if k in ("key", "space") else 0.4, pan=rng.uniform(-0.15, 0.15))
    if k == "key":
        add(wet, click("key"), c["t"], 0.06)

scale = [69, 72, 74, 76, 79, 81, 84, 86]  # A minor pentatonic-ish ladder for the theme changes
theme_i = 0
for c in cues["hits"]:
    t0, k = c["t"], c["k"]
    if k == "ignite":
        continue  # handled in the intro
    if k == "result":
        for j, n in enumerate([72, 76, 79, 84]):
            add(wet, bell(midi(n), 2.2), t0 + j * 0.085, 0.3, pan=(j - 1.5) * 0.3)
        add(dry, sub(midi(36), 0.9, decay=0.4), t0, 0.5)
    elif k == "press":
        add(dry, click("space"), t0, 0.9)
        add(dry, sub(midi(31), 0.35, decay=0.12), t0, 0.5)
    elif k == "open":
        add(wet, bell(midi(81), 1.2, 0.8), t0, 0.22)
        add(dry, whoosh(0.35, "in"), t0 - 0.25, 0.1)
    elif k == "toggle":
        add(dry, click("click"), t0, 0.9)
        add(wet, bell(midi(88), 1.0, 0.6), t0 + 0.02, 0.22)
    elif k == "theme":
        n = scale[theme_i % len(scale)]
        theme_i += 1
        add(wet, bell(midi(n), 1.0, 0.9), t0, 0.26, pan=((theme_i % 3) - 1) * 0.5)
        add(dry, pluck(midi(n - 12)), t0, 0.14)
    elif k == "soft":
        add(wet, bell(midi(84), 1.6, 0.7), t0, 0.2)
    elif k == "done":
        for j, n in enumerate([76, 83]):
            add(wet, bell(midi(n), 1.8), t0 + j * 0.11, 0.26)
    elif k == "finale":
        add(dry, sub(midi(24), 3.4, atk=0.015, decay=1.6), t0, 0.75)
        add(dry, kick(0.5), t0, 0.6)
        for j, n in enumerate([48, 55, 60, 64, 67, 71, 74]):
            add(wet, pad(midi(n), 2.2, atk=0.05, rel=1.8), t0, 0.85, pan=(j - 3) * 0.28)
        for j, n in enumerate([84, 88, 91, 95, 98]):
            add(wet, bell(midi(n), 2.6), t0 + 0.05 + j * 0.09, 0.2, pan=(j - 2) * 0.35)

for c in cues["whooshes"]:
    add(wet, whoosh(c["d"], c["k"]), c["t"], 0.16)
    add(dry, whoosh(c["d"], c["k"]), c["t"], 0.07)

# --------------------------------------------------------------------------- reverb and master


def make_ir(seed, length=2.6):
    r = np.random.default_rng(seed)
    n = int(length * SR)
    t = np.arange(n) / SR
    ir = r.standard_normal(n) * np.exp(-t / 0.62)
    ir = lowpass(ir, 6500)
    ir[: int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))
    return ir / np.sqrt(np.sum(ir**2))


def convolve(x, ir):
    n = 1
    while n < len(x) + len(ir):
        n *= 2
    return np.fft.irfft(np.fft.rfft(x, n) * np.fft.rfft(ir, n), n)[: len(x)]


rev = np.stack([convolve(wet[:, 0], make_ir(1)), convolve(wet[:, 1], make_ir(2))], axis=1)
mix = dry + 0.55 * wet + 0.95 * rev * 0.55
mix = mix - np.stack([lowpass(mix[:, 0], 28), lowpass(mix[:, 1], 28)], axis=1)  # remove rumble below ~28 Hz

# fades: in at the start, out with the picture going to black
fade_in = np.clip(np.arange(N) / (0.25 * SR), 0, 1)
tail_start = int((DUR - 0.5) * SR)
fade_out = np.ones(N)
fade_out[tail_start:] = np.clip(1 - (np.arange(N - tail_start) / (0.7 * SR)), 0, 1) ** 1.6
mix *= (fade_in * fade_out)[:, None]
mix = mix[: int((DUR + 0.2) * SR)]

# gentle glue: soft clip, then peak normalise
mix = np.tanh(mix * 1.1) / np.tanh(1.1)
mix *= 0.89 / max(1e-9, np.abs(mix).max())

raw = OUT / "audio-raw.wav"
with wave.open(str(raw), "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((mix * 32767).astype("<i2").tobytes())

# loudness: about -16 LUFS, true peak under -1.5 dB
subprocess.run(
    ["ffmpeg", "-y", "-loglevel", "error", "-i", str(raw), "-af", "loudnorm=I=-16:TP=-1.5:LRA=9", "-ar", "48000", str(OUT / "audio.wav")],
    check=True,
)
print("audio ->", OUT / "audio.wav")

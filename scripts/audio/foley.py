#!/usr/bin/env python3
"""Builds the interaction sounds in assets/audio/ from nothing.

Soft, warm, close-mic foley for a cozy mystery: wood, paper, cloth, glass,
a little brass, a cat. Everything is synthesized here, physical-modelling
style (no samples, nothing downloaded; docs/AUDIO.md):

- an impact is a contact pulse (a half-sine: shorter is harder and brighter)
  ringing a bank of modal resonators (a block of wood, a brass bolt, a glass
  lens), each mode with its own frequency, decay and level;
- scrapes, rustles and whooshes are seeded noise through time-varying
  band-passes, shaped by envelopes and grain textures;
- chimes and sparkles are additive bells (a few partials, each decaying);
- every cue goes through a short procedural room (early reflections and a
  damped noise tail), a 40 Hz high-pass and a gentle top roll-off, then is
  levelled to a common momentary loudness with a peak ceiling, faded to
  exact zero at its end, and encoded to AAC (.m4a) with ffmpeg.

    python3 scripts/audio/foley.py                 # every cue
    python3 scripts/audio/foley.py drawer purr     # just these
    python3 scripts/audio/foley.py pencil-rub      # a cue's numbered set (pencil-rub-1, -2, -3; music-note-0 to -5)
    WAV_DIR=/tmp/wavs python3 scripts/audio/foley.py   # also keep the 16-bit WAVs
    python3 scripts/audio/contact_sheet.py /tmp/wavs     # waveforms + spectrograms PNG

Needs Python 3.10+, numpy, scipy, and ffmpeg (native aac encoder) on PATH.
The output is deterministic (seeded noise, bit-exact encode), so a rebuild
changes only what you edit. Room tones, the camera shutter and the
typewriter are built by scripts/audio/generate.mjs.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from scipy import signal
from scipy.io import wavfile

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "assets" / "audio"
SR = 44100
TAU = 2 * np.pi

# Levelling: every cue is brought to this maximum momentary loudness (LUFS,
# 400 ms K-weighted windows), unless that would push its (4x oversampled)
# peak over PEAK_DB; then the peak ceiling wins. Short transients (a detent,
# a click) land on the ceiling and sit quieter; sound.ts sets the final mix.
TARGET_LUFS = -18.0
PEAK_DB = -1.5
BITRATE = "96k"


# ---------------------------------------------------------------------------
# Primitives
# ---------------------------------------------------------------------------


def n_of(sec: float) -> int:
    return max(1, int(round(sec * SR)))


def silence(sec: float) -> np.ndarray:
    return np.zeros(n_of(sec))


def times(n: int) -> np.ndarray:
    return np.arange(n) / SR


def place(out: np.ndarray, x: np.ndarray, at: float, gain: float = 1.0) -> np.ndarray:
    """Mix x into out starting at `at` seconds (clipped to out's length)."""
    i = n_of(at) if at > 0 else 0
    j = min(len(out), i + len(x))
    if j > i:
        y = gain * x[: j - i]
        # Every layer ends on a short fade, so a buffer cut off while still ringing never clicks.
        f = min(n_of(0.012), len(y) // 4)
        if f > 1:
            y = y.copy()
            y[-f:] *= np.cos(0.5 * np.pi * np.arange(f) / f) ** 2
        out[i:j] += y
    return out


def butter(x: np.ndarray, kind: str, f, order: int = 2) -> np.ndarray:
    sos = signal.butter(order, f, btype=kind, fs=SR, output="sos")
    return signal.sosfilt(sos, x)


def lp(x, f, order=2):
    return butter(x, "lowpass", min(f, SR * 0.45), order)


def hp(x, f, order=2):
    return butter(x, "highpass", f, order)


def bp(x, lo, hi, order=2):
    return butter(x, "bandpass", [lo, min(hi, SR * 0.45)], order)


def svf_bandpass(x: np.ndarray, fc: np.ndarray, q: float) -> np.ndarray:
    """A band-pass whose centre moves sample by sample (Chamberlin state-variable filter, 0 dB peak)."""
    fc = np.broadcast_to(fc, x.shape)
    f = 2 * np.sin(np.pi * np.minimum(fc, SR / 6) / SR)
    damp = 1.0 / q
    low = band = 0.0
    y = np.empty_like(x)
    for i in range(len(x)):
        high = x[i] - low - damp * band
        band += f[i] * high
        low += f[i] * band
        y[i] = band * damp
    return y


def env(n: int, attack: float, tau: float, hold: float = 0.0) -> np.ndarray:
    """Raised-cosine attack, optional hold, then exponential decay with time constant tau (s)."""
    t = times(n)
    a = max(attack, 1.0 / SR)
    e = np.where(t < a, 0.5 - 0.5 * np.cos(np.pi * np.clip(t / a, 0, 1)), 1.0)
    after = np.clip(t - a - hold, 0, None)
    return e * np.exp(-after / tau)


def bell_env(n: int, peak: float) -> np.ndarray:
    """A smooth swell and fall: rises to 1 at `peak`, falls to 0 at the end (sin^2 halves)."""
    t = times(n)
    total = n / SR
    up = np.sin(0.5 * np.pi * np.clip(t / peak, 0, 1)) ** 2
    down = np.cos(0.5 * np.pi * np.clip((t - peak) / max(total - peak, 1e-6), 0, 1)) ** 2
    return np.where(t < peak, up, down)


def contact(duration: float, rng: np.random.Generator | None = None, grit: float = 0.0) -> np.ndarray:
    """The force of two things meeting: a half-sine pulse (shorter = harder), optionally a little rough."""
    n = max(2, n_of(duration))
    x = np.sin(np.pi * (np.arange(n) + 0.5) / n)
    if rng is not None and grit > 0:
        x = x * (1 + grit * rng.standard_normal(n))
    return x / x.sum()  # unit impulse area, so modes ring at their level whatever the hardness


def modes(exc: np.ndarray, bank, sec: float) -> np.ndarray:
    """Ring a bank of (freq Hz, decay time-constant s, level) two-pole resonators with an excitation."""
    x = np.zeros(n_of(sec))
    x[: len(exc)] = exc[: len(x)]
    y = np.zeros_like(x)
    for f, tau, g in bank:
        if f >= SR * 0.45:
            continue
        r = np.exp(-1.0 / (tau * SR))
        w = TAU * f / SR
        # Unit-amplitude ringing for a unit impulse: h[n] = r^n sin((n+1)w).
        y += signal.lfilter([g * np.sin(w)], [1, -2 * r * np.cos(w), r * r], x)
    return y


def hit(bank, sec: float, hardness: float, rng=None, grit=0.0) -> np.ndarray:
    """One struck object: a contact of `hardness` seconds into its modes."""
    return modes(contact(hardness, rng, grit), bank, sec)


def scale_bank(bank, fk=1.0, gk=1.0, tk=1.0):
    return [(f * fk, tau * tk, g * gk) for f, tau, g in bank]


def bell(freq: float, sec: float, partials, attack: float = 0.0015, detune: float = 0.0) -> np.ndarray:
    """An additive struck bell: [(ratio, level, decay tau s)]. A soft mallet attack keeps it round."""
    n = n_of(sec)
    t = times(n)
    y = np.zeros(n)
    for ratio, g, tau in partials:
        f = freq * ratio * (1 + detune)
        if f >= SR * 0.45:
            continue
        y += g * np.sin(TAU * f * t) * np.exp(-t / tau)
    a = n_of(attack)
    y[:a] *= 0.5 - 0.5 * np.cos(np.pi * np.arange(a) / a)
    # Let it die away over the last third rather than stop: `sec` is the bell's whole length.
    f = n // 3
    y[-f:] *= np.cos(0.5 * np.pi * np.arange(f) / f) ** 2
    return y


# A warm, celesta-like bar: mostly fundamental, a whisper of the upper partials.
CELESTA = [(1.0, 1.0, 0.55), (2.0, 0.16, 0.22), (3.0, 0.05, 0.12), (4.07, 0.035, 0.07)]
# A small glass bell for sparkles: glassier (inharmonic) and shorter.
GLINT = [(1.0, 1.0, 0.16), (2.32, 0.22, 0.07), (4.25, 0.06, 0.04)]


def room(x: np.ndarray, rng: np.random.Generator, rt60: float = 0.25, wet: float = 0.12, tone: float = 4500) -> np.ndarray:
    """A small furnished room: a few early reflections and a damped, low-passed noise tail."""
    n = n_of(rt60 * 1.1)
    t = times(n)
    tail = rng.standard_normal(n) * np.exp(-6.91 * t / rt60)
    tail = lp(tail, tone, 2)
    tail[: n_of(0.008)] *= np.linspace(0, 1, n_of(0.008))  # the tail grows in after the first reflections
    ir = tail / np.sqrt(np.sum(tail**2))
    for delay, g in ((0.0031, 0.5), (0.0057, 0.38), (0.0089, 0.3), (0.0123, 0.22), (0.0171, 0.15)):
        ir[n_of(delay)] += g * (1 if rng.random() > 0.3 else -1)
    ir /= np.sqrt(np.sum(ir**2))
    w = np.zeros(len(x) + n)
    w[: len(x) + n - 1] = signal.fftconvolve(x, ir)
    dry = np.concatenate([x, np.zeros(n)])
    return dry + wet * w


def k_weight(x: np.ndarray) -> np.ndarray:
    """ITU-R BS.1770 K-weighting (the pre-filter shelf and RLB high-pass), designed for 44.1 kHz."""
    def biquad(kind, f0, q, gain_db=0.0):
        a_ = 10 ** (gain_db / 40)
        w0 = TAU * f0 / SR
        alpha = np.sin(w0) / (2 * q)
        c = np.cos(w0)
        if kind == "shelf":
            b = [a_ * ((a_ + 1) + (a_ - 1) * c + 2 * np.sqrt(a_) * alpha), -2 * a_ * ((a_ - 1) + (a_ + 1) * c),
                 a_ * ((a_ + 1) + (a_ - 1) * c - 2 * np.sqrt(a_) * alpha)]
            a = [(a_ + 1) - (a_ - 1) * c + 2 * np.sqrt(a_) * alpha, 2 * ((a_ - 1) - (a_ + 1) * c),
                 (a_ + 1) - (a_ - 1) * c - 2 * np.sqrt(a_) * alpha]
        else:
            b = [(1 + c) / 2, -(1 + c), (1 + c) / 2]
            a = [1 + alpha, -2 * c, 1 - alpha]
        return np.array(b) / a[0], np.array(a) / a[0]

    b, a = biquad("shelf", 1681.97, 0.7072, 4.0)
    y = signal.lfilter(b, a, x)
    b, a = biquad("hp", 38.135, 0.5003)
    return signal.lfilter(b, a, y)


def momentary_max(x: np.ndarray) -> float:
    """The loudest 400 ms window (BS.1770 momentary loudness, LUFS), 10 ms steps."""
    k = k_weight(np.concatenate([x, np.zeros(n_of(0.4))]))
    win = n_of(0.4)
    power = np.convolve(k**2, np.ones(win) / win, mode="valid")[:: n_of(0.01)]
    return float(-0.691 + 10 * np.log10(max(power.max(), 1e-12)))


def true_peak_db(x: np.ndarray) -> float:
    return float(20 * np.log10(max(np.abs(signal.resample_poly(x, 4, 1)).max(), 1e-12)))


def finish(x: np.ndarray, top: float = 12000, fade: float = 0.012) -> np.ndarray:
    """Clean up a cue: 40 Hz high-pass, a gentle top roll-off, trim the silent tail, fade both ends to zero."""
    x = hp(x, 40, 2)
    x = lp(x, top, 2)
    # Trim the tail once it's 60 dB down, then fade the last `fade` s to exact zero.
    level = np.abs(x)
    above = np.nonzero(level > level.max() * 10 ** (-60 / 20))[0]
    x = x[: min(len(x), above[-1] + n_of(0.02))] if len(above) else x
    f = min(n_of(fade), len(x) // 2)
    x[-f:] *= np.cos(0.5 * np.pi * np.arange(f) / f) ** 2
    x[-1] = 0.0
    # A 0.5 ms raised-cosine fade-in: no step at the start, the transient intact.
    a = n_of(0.0005)
    x[:a] *= 0.5 - 0.5 * np.cos(np.pi * np.arange(a) / a)
    x[0] = 0.0
    return x


def level(x: np.ndarray) -> tuple[np.ndarray, float, float]:
    """Bring to TARGET_LUFS momentary max, capped so the oversampled peak stays at PEAK_DB."""
    gain_db = min(TARGET_LUFS - momentary_max(x), PEAK_DB - true_peak_db(x))
    y = x * 10 ** (gain_db / 20)
    return y, momentary_max(y), true_peak_db(y)


# ---------------------------------------------------------------------------
# Materials (modal banks: freq Hz, decay tau s, level). Phone speakers give up
# below ~250 Hz, so every "low" body also has modes in 300 Hz to 1 kHz that
# carry it.
# ---------------------------------------------------------------------------

WOOD_BLOCK = [(150, 0.04, 0.45), (292, 0.035, 0.7), (565, 0.03, 1.0), (948, 0.02, 0.6), (1690, 0.01, 0.25)]
DESK = [(96, 0.05, 0.45), (182, 0.045, 0.55), (344, 0.034, 0.9), (612, 0.024, 0.75), (1130, 0.012, 0.35)]
DRAWER_STOP = [(118, 0.045, 0.45), (236, 0.04, 0.6), (472, 0.03, 1.0), (824, 0.02, 0.6), (1460, 0.01, 0.25)]
MUTED_WOOD = [(104, 0.04, 0.5), (186, 0.034, 0.7), (322, 0.026, 1.0), (522, 0.016, 0.7), (862, 0.008, 0.3)]
BRASS_BOLT = [(88, 0.05, 0.7), (176, 0.04, 0.55), (436, 0.034, 1.0), (1160, 0.022, 0.5), (1930, 0.03, 0.22),
              (3310, 0.02, 0.12), (2620, 0.008, 0.18)]
LATCH = [(1320, 0.012, 0.45), (2410, 0.011, 1.0), (3920, 0.007, 0.5), (5650, 0.004, 0.2)]
DETENT = [(1900, 0.005, 0.4), (3300, 0.0042, 1.0), (5100, 0.003, 0.5), (7200, 0.002, 0.2), (650, 0.009, 0.25)]
SNAP_A = [(520, 0.024, 0.5), (905, 0.015, 0.45), (2120, 0.0065, 1.0), (3410, 0.0045, 0.6), (5230, 0.003, 0.3)]
SNAP_B = [(384, 0.03, 0.55), (1510, 0.009, 0.65), (2780, 0.005, 0.3)]
TAP = [(380, 0.016, 0.6), (1150, 0.011, 1.0), (2300, 0.006, 0.4), (3600, 0.003, 0.12)]
GLASS_TICK = [(620, 0.012, 0.5), (1250, 0.03, 0.55), (2950, 0.05, 1.0), (4810, 0.034, 0.4), (6900, 0.016, 0.12)]
LENS_ON_WOOD = [(420, 0.02, 0.45), (905, 0.013, 0.6), (2650, 0.032, 0.7), (4300, 0.02, 0.3)]
ROCKER = [(800, 0.012, 0.4), (2700, 0.006, 1.0), (4100, 0.004, 0.5)]
TRINKET = [(2140, 0.01, 1.0), (3370, 0.007, 0.5), (1210, 0.01, 0.3)]


# ---------------------------------------------------------------------------
# The cues
# ---------------------------------------------------------------------------


def press(rng):
    """A button: a soft rounded tap, like a fingertip on a felt-covered wooden key."""
    x = hit(TAP, 0.09, 0.0005)
    return room(x, rng, rt60=0.12, wet=0.05)


def knock(rng):
    """thud: a firm, physical moment. A wooden block set down on a cloth-topped table."""
    x = hit(WOOD_BLOCK, 0.3, 0.0014)
    x += 0.25 * hit(scale_bank(WOOD_BLOCK, 1.37, 0.6, 0.5), 0.3, 0.001)  # the block's other face
    return room(x, rng, rt60=0.22, wet=0.1)


def paper(rng):
    """A note picked up and opened: a crisp crinkle, the sheet flexing open, a soft landing."""
    out = silence(0.46)
    # The crinkle: tiny fibre cracks, dense at first, thinning out.
    for _ in range(70):
        at = 0.3 * rng.random() ** 1.6
        d = rng.uniform(0.0008, 0.004)
        g = min(rng.pareto(2.4) * 0.1 + 0.03, 0.14)
        grain = rng.standard_normal(n_of(d)) * np.hanning(n_of(d))
        lo = rng.uniform(1800, 4500)
        place(out, bp(grain, lo, lo * 1.9), at, g)
    # The sheet flexing open: noise through a band rising 800 Hz to 2.6 kHz.
    n = n_of(0.26)
    sweep = np.linspace(800, 2600, n)
    swish = svf_bandpass(rng.standard_normal(n), sweep, 1.1) * bell_env(n, 0.09)
    place(out, swish, 0.02, 0.4)
    # It settles: a light, papery landing.
    land = lp(rng.standard_normal(n_of(0.05)), 1800) * env(n_of(0.05), 0.002, 0.007)
    place(out, land + 0.4 * hit([(310, 0.012, 1.0), (720, 0.008, 0.5)], 0.05, 0.003), 0.31, 0.35)
    out = lp(out, 9500)
    return room(out, rng, rt60=0.18, wet=0.08)


def pickup(rng):
    """An item found: a soft wood-and-glass tick, then a tiny three-note sparkle."""
    out = silence(0.5)
    place(out, hit(GLASS_TICK, 0.2, 0.0009), 0.0, 1.0)
    for at, f, g in ((0.045, 2637.0, 0.22), (0.085, 3136.0, 0.17), (0.125, 4186.0, 0.12)):  # E7 G7 C8
        place(out, bell(f, 0.42, GLINT, attack=0.002), at, g)
    n = n_of(0.22)
    air = hp(rng.standard_normal(n), 6500) * bell_env(n, 0.06)
    place(out, air, 0.04, 0.025)
    return room(out, rng, rt60=0.35, wet=0.14, tone=6000)


def snap(rng):
    """An item used and fitting: a clean two-part click, in, then seated."""
    out = silence(0.2)
    place(out, hit(SNAP_A, 0.12, 0.0004), 0.0, 1.0)
    place(out, hit(SNAP_B, 0.12, 0.0008), 0.028, 0.55)
    return room(out, rng, rt60=0.14, wet=0.06)


def detent(rng):
    """A code wheel's step: one tiny, fine mechanical tick."""
    x = hit(DETENT, 0.05, 0.00025)
    return room(x, rng, rt60=0.08, wet=0.03)


def unlock(rng):
    """A correct code: a warm brass bolt clunks across, the latch clicks at 110 ms, then a soft chime."""
    out = silence(0.95)
    # The bolt sliding just ahead of its clunk.
    n = n_of(0.03)
    slide = bp(rng.standard_normal(n), 700, 2600) * np.linspace(0.2, 1, n) ** 2
    place(out, slide, 0.0, 0.02)
    place(out, hit(BRASS_BOLT, 0.3, 0.001), 0.012, 1.0)
    place(out, hit(LATCH, 0.08, 0.0004), 0.11, 0.42)
    # The chime: G5 and D6, a soft open fifth.
    place(out, bell(784.0, 0.8, CELESTA, attack=0.003), 0.13, 0.12)
    place(out, bell(1174.7, 0.8, CELESTA, attack=0.003), 0.145, 0.09)
    return room(out, rng, rt60=0.4, wet=0.14)


def wrong_code(rng):
    """A wrong code: two gentle, muted wooden knocks (0 and 90 ms): it doesn't give. No buzzer."""
    out = silence(0.36)
    place(out, hit(MUTED_WOOD, 0.25, 0.0014), 0.0, 1.0)
    place(out, hit(scale_bank(MUTED_WOOD, 0.94), 0.25, 0.0016), 0.09, 0.72)
    # The latch shifting a hair in its keep: two dull little ticks.
    place(out, hit([(1180, 0.006, 1.0), (1900, 0.004, 0.4)], 0.03, 0.0008), 0.03, 0.05)
    place(out, hit([(1120, 0.006, 1.0), (1800, 0.004, 0.4)], 0.03, 0.0008), 0.118, 0.04)
    out = lp(out, 1800, 2)
    return room(out, rng, rt60=0.2, wet=0.08)


def stamp(rng):
    """A thick rubber stamp pressed onto paper on a wooden desk, and lifted off with a faint peel."""
    out = silence(0.42)
    place(out, hit(DESK, 0.3, 0.0016), 0.0, 1.0)
    n = n_of(0.012)
    smack = bp(rng.standard_normal(n), 320, 1500) * env(n, 0.0008, 0.003)
    place(out, smack, 0.0, 0.14)
    n = n_of(0.004)
    crush = hp(rng.standard_normal(n), 3200) * env(n, 0.0003, 0.0012)
    place(out, crush, 0.001, 0.012)
    # The peel: a little sticky crackle as the rubber leaves the sheet.
    n = n_of(0.05)
    sticky = (rng.random(n) < 0.02) * rng.standard_normal(n)
    peel = bp(sticky + 0.1 * rng.standard_normal(n), 1500, 5000) * bell_env(n, 0.015)
    place(out, peel, 0.17, 0.05)
    return room(out, rng, rt60=0.22, wet=0.1)


def solved(rng):
    """The case solved: a warm, short magical shimmer. Celesta notes on the haptic beats (0, 260, 400 ms)."""
    out = silence(1.7)
    t = times(n_of(1.5))
    # A soft warm pad under it: Cmaj9, slightly chorused, swelling in and fading.
    pad = np.zeros(len(t))
    for f in (261.6, 329.6, 392.0, 493.9, 587.3):
        for cents in (-4, 4):
            ff = f * 2 ** (cents / 1200)
            pad += np.sin(TAU * ff * t + rng.random() * TAU) + 0.12 * np.sin(TAU * 2 * ff * t)
    pad = lp(pad, 2200) * bell_env(len(t), 0.18) ** 1.5
    place(out, pad, 0.0, 0.012)
    # The notes: E5, G5, then C6 with E6.
    place(out, bell(659.3, 1.2, CELESTA), 0.0, 0.3)
    place(out, bell(784.0, 1.2, CELESTA), 0.26, 0.3)
    place(out, bell(1046.5, 1.2, CELESTA), 0.4, 0.3)
    place(out, bell(1318.5, 1.1, CELESTA), 0.405, 0.18)
    # The shimmer: a cascade of tiny glass notes (C major pentatonic, octave 7) after the last beat.
    notes = [2093.0, 2349.3, 2637.0, 3136.0, 3520.0, 4186.0]
    for i in range(16):
        at = 0.37 + 0.6 * (i / 16) ** 1.3 + rng.uniform(-0.01, 0.01)
        place(out, bell(notes[rng.integers(len(notes))], 0.35, GLINT, attack=0.002), at, 0.05 * (1 - i / 20))
    n = n_of(0.8)
    air = svf_bandpass(rng.standard_normal(n), np.linspace(4000, 8000, n), 1.4) * bell_env(n, 0.2)
    place(out, air, 0.3, 0.02)
    return room(out, rng, rt60=0.9, wet=0.2, tone=6000)


def drawer(rng):
    """A wooden drawer: a short slide toward you, then its soft thud against the stop at 170 ms."""
    out = silence(0.56)
    # The slide: friction noise through the drawer box's resonances, its stick-slip a ragged ~45 Hz grain.
    n = n_of(0.19)
    t = times(n)
    rate = 45 * (1 + 0.25 * np.sin(TAU * 3 * t)) * (1 + 0.15 * rng.standard_normal(n).cumsum() / np.sqrt(n))
    phase = np.cumsum(rate) / SR
    grain = (0.5 + 0.5 * np.cos(TAU * phase)) ** 3
    grain = lp(grain * (1 + 0.6 * rng.standard_normal(n)), 600)
    friction = bp(rng.standard_normal(n), 180, 2200) * (0.35 + grain)
    box = modes(friction * 0.05, [(212, 0.03, 1.0), (468, 0.024, 0.8), (884, 0.014, 0.5)], 0.19)
    slide = (bp(friction, 250, 1800) * 0.6 + box) * bell_env(n, 0.07) ** 0.8
    place(out, lp(slide, 2400), 0.0, 0.11)
    # The thud at the stop, and what's inside giving two tiny knocks.
    place(out, hit(DRAWER_STOP, 0.3, 0.0013), 0.17, 1.0)
    place(out, hit(TRINKET, 0.04, 0.0006), 0.196, 0.05)
    place(out, hit(scale_bank(TRINKET, 0.9), 0.04, 0.0007), 0.232, 0.03)
    return room(out, rng, rt60=0.25, wet=0.11)


def cloth(rng):
    """A cloth lifted: a soft, close rustle of fabric, a breath of air under it."""
    out = silence(0.42)
    n = n_of(0.36)
    t = times(n)
    # Fabric texture: many tiny soft grains (threads rubbing) over a steady hush.
    texture = np.zeros(n)
    for _ in range(140):
        d = rng.uniform(0.002, 0.009)
        g = rng.pareto(3) * 0.25 + 0.05
        grain = rng.standard_normal(n_of(d)) * np.hanning(n_of(d))
        place(texture, grain, rng.random() * 0.34, g)
    body = svf_bandpass(rng.standard_normal(n) * 0.5 + texture, np.linspace(900, 2200, n) * (1 + 0.2 * np.sin(TAU * 4 * t)), 0.8)
    rustle = lp(body, 4200, 4) * bell_env(n, 0.09) ** 1.2
    place(out, rustle, 0.0, 0.5)
    # The air the cloth pulls up with it.
    n2 = n_of(0.24)
    whump = lp(rng.standard_normal(n2), 520, 2) * bell_env(n2, 0.07)
    place(out, whump, 0.0, 0.5)
    return room(out, rng, rt60=0.18, wet=0.07)


def uv_switch(rng):
    """The UV light on: a soft rocker click, then a warm electric hum flickering up and fading."""
    out = silence(0.52)
    place(out, hit(ROCKER, 0.06, 0.0005), 0.0, 0.7)
    # The hum: the ballast settling from 96 to 120 Hz; its harmonics carry it on a phone speaker.
    n = n_of(0.48)
    t = times(n)
    f0 = 120 - 24 * np.exp(-t / 0.018)
    ph = TAU * np.cumsum(f0) / SR
    hum = sum((1 / k**1.1) * np.sin(k * ph + 0.3 * k) for k in range(1, 10))
    # It flickers a few times in its first 60 ms (smoothed, so the flicker never clicks).
    toggles = ((rng.random(n) < 0.004).cumsum() % 2) * (t < 0.06)
    flicker = 1 - 0.35 * lp(toggles.astype(float), 150, 2)
    hum = lp(hum, 1800) * env(n, 0.03, 0.12) * flicker
    place(out, hum, 0.012, 0.09)
    # A faint fizz as the tube strikes: a high band pulsing at 120 Hz.
    buzz = bp(rng.standard_normal(n), 2600, 5200) * np.abs(np.sin(ph / 2)) ** 6 * env(n, 0.01, 0.05)
    place(out, buzz, 0.015, 0.05)
    out = lp(out, 6000)
    return room(out, rng, rt60=0.2, wet=0.08)


def lens_up(rng):
    """The magnifier lifted: a soft upward whoosh with the faintest glint of glass."""
    out = silence(0.3)
    n = n_of(0.24)
    whoosh = svf_bandpass(rng.standard_normal(n), np.geomspace(450, 1900, n), 0.9) * bell_env(n, 0.13) ** 1.3
    place(out, lp(whoosh, 4500, 4), 0.0, 0.5)
    place(out, bell(3520.0, 0.3, GLINT, attack=0.003), 0.14, 0.02)
    return room(out, rng, rt60=0.18, wet=0.06)


def lens_down(rng):
    """The magnifier set down: a short falling breath, then a soft glass-on-wood tick."""
    out = silence(0.24)
    n = n_of(0.07)
    fall = svf_bandpass(rng.standard_normal(n), np.geomspace(1500, 600, n), 0.9) * bell_env(n, 0.04)
    place(out, fall, 0.0, 0.12)
    place(out, hit(LENS_ON_WOOD, 0.16, 0.0009), 0.065, 1.0)
    return room(out, rng, rt60=0.16, wet=0.07)


def purr(rng):
    """The cat, rubbed: a small, soft, breathy purr. Breathing out, in, and out again as it fades.

    A house cat's purr is mostly air: the larynx closes and opens ~25 times a second (21 to 27 Hz
    breathing out, a touch faster breathing in; Eklund, Peters & Duthie 2010, Schoetz & Eklund 2011)
    and each opening lets a puff of breath through. So the source here is breath noise, pulsed at that
    rate with a little per-pulse jitter (the flutter), shaped by a small head's light, high resonances.
    No buzzing oscillator, no strong low chest modes: those are what made the first one a lion.
    """
    total = 2.0
    n = n_of(total)
    t = times(n)

    def window(a, b, rise, fall):
        """1 between a and b, raised-cosine edges of `rise` and `fall` s."""
        up = np.sin(0.5 * np.pi * np.clip((t - a) / rise, 0, 1)) ** 2
        down = np.cos(0.5 * np.pi * np.clip((t - (b - fall)) / fall, 0, 1)) ** 2
        return up * down * (t >= a) * (t <= b)

    # The breaths: out (0 to 0.86 s), a short turn, in (softer, quicker: 0.9 to 1.42 s), out again, fading.
    ex1 = window(0.0, 0.86, 0.08, 0.1) * (0.85 + 0.15 * np.sin(np.pi * np.clip(t / 0.86, 0, 1)))
    inh = window(0.9, 1.42, 0.06, 0.08)
    ex2 = window(1.46, total, 0.08, 0.45)
    breathing_in = inh > 0
    # The pulse rate: ~25 Hz out, ~27.5 Hz in, wandering slowly; every pulse a little different.
    drift = 1 + 0.05 * lp(rng.standard_normal(n), 3, 1) * 30
    rate = np.where(breathing_in, 27.5, 25.0) * drift
    phase = np.cumsum(rate) / SR
    k = np.floor(phase).astype(int)
    per_pulse = np.clip(np.exp(0.28 * rng.standard_normal(k.max() + 2)), 0.6, 1.5)  # the flutter: uneven puffs
    shape = (0.5 + 0.5 * np.cos(TAU * phase)) ** 3
    pulse = 0.12 + 0.88 * per_pulse[k] * shape  # air never fully stops: breathy, not a buzz
    # Breath noise, a little pink, through a small head: soft, broad resonances.
    air = lp(rng.standard_normal(n), 1600, 1) + 0.12 * rng.standard_normal(n)
    puffs = air * pulse
    # The rumble a phone can play: the pulsed air between 220 and 700 Hz; then the head's light,
    # higher resonances (a small cat: nothing like a big cat's low, open-throated formants).
    voice = (bp(puffs, 220, 700, 1) * 1.0
             + bp(puffs, 700, 1400, 1) * 0.5
             + bp(puffs, 1400, 3000, 1) * 0.1)
    # The tiny flap of each opening: a soft tick of the larynx, quiet, gives the purr its grain.
    flap = modes(np.diff(np.floor(phase), prepend=0) * per_pulse[k] * 0.035,
                 [(310, 0.008, 0.8), (620, 0.006, 1.0), (1180, 0.004, 0.45), (2100, 0.0025, 0.15)], total)
    # A light chest: a little warmth around 160 Hz, nothing carrying weight below it.
    chest = bp(puffs, 120, 240, 1) * 0.18
    src = voice + flap + chest
    # Breathing in is softer and airier (a touch brighter); out is fuller.
    bright = hp(src, 900, 1)
    x = src * (ex1 + 0.9 * ex2) + (0.55 * src + 0.15 * bright) * inh
    x = hp(x, 100, 2)
    x = lp(x, 3800, 2)
    return room(x, rng, rt60=0.16, wet=0.05)


def mug_break(rng):
    """A ceramic mug knocked off the window sill, breaking on a hard floor just off-screen.

    The crack: a hard contact into a glazed mug's short, bright modes (cracked ceramic stops ringing
    almost at once) with a dry snap of noise; the pieces parting a few ms apart and the biggest one
    landing again; then three shards skittering away, their ticks coming closer together, two
    sliding to a stop, and one last crumb (about 0.85 s in all, then the room). Heard from a few metres off: rolled off on top, a little
    more of the room in it.
    """
    out = silence(1.1)
    # The mug: a glazed stoneware body, its modes damped short by the break.
    mug = [(1180, 0.012, 0.7), (2050, 0.011, 1.0), (3120, 0.009, 0.8), (4380, 0.007, 0.6),
           (5870, 0.005, 0.45), (7550, 0.0035, 0.25)]
    floor_ = [(190, 0.012, 0.6), (430, 0.009, 1.0), (870, 0.006, 0.5)]
    place(out, hit(mug, 0.1, 0.0003, rng, 0.3), 0.0, 1.0)
    place(out, hit(floor_, 0.06, 0.0009), 0.0, 0.6)
    # The crack itself: a dry snap of broadband noise, a few crackles inside it.
    n = n_of(0.012)
    place(out, bp(rng.standard_normal(n), 900, 9000, 2) * env(n, 0.0002, 0.0025), 0.0, 0.6)
    for _ in range(12):
        d = rng.uniform(0.0004, 0.0016)
        grain = hp(rng.standard_normal(n_of(d)), 2200) * np.hanning(n_of(d))
        place(out, grain, 0.001 + 0.045 * rng.random() ** 1.5, rng.uniform(0.08, 0.25))
    # The pieces parting: a handful of smaller, higher hits in the first 60 ms.
    for at, fk, g in ((0.007, 1.32, 0.55), (0.016, 1.7, 0.45), (0.029, 1.18, 0.4), (0.043, 2.15, 0.3), (0.061, 1.55, 0.22)):
        piece = scale_bank(mug, fk * rng.uniform(0.97, 1.03), 1.0, 0.7)
        place(out, hit(piece, 0.06, rng.uniform(0.0002, 0.0004), rng, 0.3), at, g)
    # The biggest piece (the handle side) lands again, lower and heavier.
    place(out, hit(scale_bank(mug, 0.78, 1.0, 0.8), 0.08, 0.0004, rng, 0.3), 0.092, 0.42)
    place(out, hit(floor_, 0.05, 0.0008), 0.092, 0.25)

    # Shards: small, high pieces of glaze ticking across the floor. Each tick lands on a different
    # edge, so its pitch shifts a little; a click of grit rides on each.
    shard_bank = [(3200, 0.005, 1.0), (4900, 0.0035, 0.6), (7100, 0.0025, 0.3), (2300, 0.004, 0.35)]

    def tick(at, fk, g):
        place(out, hit(scale_bank(shard_bank, fk * rng.uniform(0.94, 1.06)), 0.025, 0.00022, rng, 0.25), at, g)
        m = n_of(0.0012)
        place(out, hp(rng.standard_normal(m), 3000) * np.hanning(m), at, g * 0.25)

    def shard(start, fk, gain, gaps, slide=0.0):
        at, g = start, gain
        for gap in gaps:
            tick(at, fk, g)
            at += gap
            g *= rng.uniform(0.76, 0.88)
        if slide:
            # It slides the last few centimetres: a short, fine scrape of grit, fading.
            m = n_of(slide)
            grit = (rng.random(m) < 0.05) * rng.standard_normal(m) + 0.15 * rng.standard_normal(m)
            scrape = bp(grit, 2500, 7000) * np.linspace(1, 0, m) ** 1.5 * bell_env(m, 0.015)
            place(out, scrape, at, g * 0.6)

    shard(0.12, 1.0, 0.3, [0.11, 0.09, 0.072, 0.06, 0.05, 0.043], slide=0.16)
    shard(0.2, 1.28, 0.22, [0.13, 0.1, 0.078, 0.06, 0.048])
    shard(0.33, 0.86, 0.18, [0.14, 0.11, 0.084, 0.06], slide=0.12)
    tick(0.8, 1.45, 0.07)  # a last crumb settling
    # Heard from across the room: the top rolled off, the room a little larger in it.
    out = lp(out, 7000, 2)
    return room(out, rng, rt60=0.4, wet=0.2, tone=5000)


# One back-and-forth stroke each: (forth s, back s, back's level, brightness, the turn's depth).
PENCIL_STROKES = [(0.19, 0.2, 0.85, 1.0, 0.22), (0.17, 0.21, 0.95, 1.08, 0.3), (0.22, 0.2, 0.78, 0.93, 0.18)]


def pencil_rub(rng, variant=0):
    """Soft graphite shading on paper: one back-and-forth stroke of the side of a pencil lead.

    Graphite on paper is friction noise: dry and breathy, its loudness and brightness following the
    hand's speed (two swells, forth and back, easing through the turn without stopping), its grain
    the paper's tooth (ragged little stick-slip bursts, a few hundred a second) with the odd fibre the
    lead catches (a tiny tick). The sheet on the desk gives it a little papery body around 500 Hz.
    Wide, flat bands only: no narrow resonance, so no squeak. It starts and ends on nothing, so it
    can be retriggered while the player rubs; three variants keep a run of them from sounding stamped.
    """
    forth, back, back_gain, bright, turn = PENCIL_STROKES[variant]
    total = forth + back
    n = n_of(total)
    t = times(n)
    # The hand's speed: a swell forth, a dip at the turn (never to zero: the lead stays down), a swell back.
    a = np.sin(np.pi * np.clip(t / forth, 0, 1)) ** 1.3
    b = np.sin(np.pi * np.clip((t - forth) / back, 0, 1)) ** 1.3 * back_gain
    speed = lp(np.maximum(a, 0) + np.maximum(b, 0) + turn * bell_env(n, forth) ** 0.5, 30, 2)
    speed *= bell_env(n, forth) ** 0.35  # both ends ease from and to nothing
    # The paper's tooth: the lead sticks and slips over it, so the friction comes in ragged little
    # bursts (a few hundred a second, no steady rate: nothing to hear as a pitch).
    rough = np.abs(lp(rng.standard_normal(n), 420, 2))
    rough = (rough / rough.mean()) ** 1.6
    grain = 0.3 + 0.7 * np.minimum(rough, 4.0) / 1.6
    # The friction itself: noise through a wide band that brightens with speed, a little air over it.
    noise = rng.standard_normal(n)
    centre = (1100 + 1300 * speed) * bright
    scratch = svf_bandpass(noise * grain, centre, 0.7)
    hiss = bp(rng.standard_normal(n) * grain, 3500, 7500, 1) * 0.07
    # The sheet on the desk: a soft papery body, wide, low in the mix.
    body = bp(noise * grain, 330, 760, 1) * 0.35
    x = (scratch + hiss + body) * speed ** 1.2
    # The lead catching the paper's tooth: a few tiny, dull ticks, only while it's moving.
    ticks = np.zeros(n)
    for _ in range(rng.integers(5, 9)):
        at = rng.uniform(0.03, total - 0.05)
        d = rng.uniform(0.0006, 0.0018)
        g = rng.uniform(0.4, 0.9) * speed[n_of(at)]
        tick = bp(rng.standard_normal(n_of(d)), 1500, 5200, 1) * np.hanning(n_of(d))
        place(ticks, tick, at, g)
    x += ticks * 0.55
    x = lp(hp(x, 250, 2), 5200, 2)
    # A soft lead never spikes: round off the few sharpest grains, so the three variants level alike.
    ceiling = 4.5 * np.sqrt(np.mean(x**2))
    x = ceiling * np.tanh(x / ceiling)
    return room(x, rng, rt60=0.12, wet=0.04)


def paper_fold(rng):
    """A sheet of paper folded over, creased and pressed flat: a short rustle into a soft, crisp crease.

    The sheet comes over (a rustle, 0 to 150 ms), the fold is pinched (the crease: a dense little
    run of fibre cracks at 160 ms, the haptic's beat, with the soft pat of paper on paper), then a
    fingertip runs along it, pressing it flat (a short, falling swipe with a few last cracks).
    """
    out = silence(0.56)
    # The sheet coming over: a soft band of noise rising 700 Hz to 2.2 kHz, a few light fibre cracks.
    n = n_of(0.17)
    over = svf_bandpass(rng.standard_normal(n), np.linspace(700, 2200, n), 1.0) * bell_env(n, 0.1) ** 1.2
    place(out, over, 0.0, 0.2)
    for _ in range(22):
        d = rng.uniform(0.0008, 0.003)
        lo = rng.uniform(1800, 4200)
        grain = bp(rng.standard_normal(n_of(d)) * np.hanning(n_of(d)), lo, lo * 1.9)
        place(out, grain, 0.02 + 0.13 * rng.random() ** 0.7, min(rng.pareto(2.6) * 0.06 + 0.02, 0.09))
    # The crease: fibres giving along the fold, densest at 160 ms and thinning over 60 ms.
    for _ in range(46):
        at = 0.16 + 0.07 * rng.random() ** 2.2
        d = rng.uniform(0.0005, 0.0022)
        lo = rng.uniform(2200, 5200)
        grain = bp(rng.standard_normal(n_of(d)) * np.hanning(n_of(d)), lo, lo * 1.8)
        place(out, grain, at, min(rng.pareto(2.2) * 0.25 + 0.1, 0.5) * (1 - (at - 0.16) / 0.09))
    # Paper meeting paper as it's pinched: a soft, dull pat, no ring.
    pat = lp(rng.standard_normal(n_of(0.03)), 1400) * env(n_of(0.03), 0.0015, 0.006)
    place(out, pat + 0.5 * hit([(340, 0.009, 1.0), (760, 0.006, 0.5)], 0.03, 0.0025), 0.158, 0.4)
    # Pressed flat: a fingertip along the crease, the band falling 2.6 kHz to 1.3 kHz, a few last cracks.
    n = n_of(0.27)
    press_ = svf_bandpass(rng.standard_normal(n), np.geomspace(2600, 1300, n), 0.9) * bell_env(n, 0.08) ** 1.1
    place(out, press_, 0.21, 0.11)
    for _ in range(10):
        d = rng.uniform(0.0006, 0.002)
        lo = rng.uniform(2400, 4800)
        grain = bp(rng.standard_normal(n_of(d)) * np.hanning(n_of(d)), lo, lo * 1.8)
        place(out, grain, 0.24 + 0.17 * rng.random() ** 1.4, rng.uniform(0.02, 0.07))
    out = lp(out, 9000)
    return room(out, rng, rt60=0.16, wet=0.07)


# The music box's comb: six teeth, C major pentatonic from C5 to C6 (any of them, in any order, agree).
MUSIC_NOTES = [("C5", 523.25), ("D5", 587.33), ("E5", 659.26), ("G5", 783.99), ("A5", 880.0), ("C6", 1046.5)]
# The box the comb is screwed to: a small wooden case, knocked by every pluck.
MUSIC_BOX = [(318, 0.022, 0.6), (545, 0.018, 1.0), (910, 0.012, 0.55), (1480, 0.007, 0.25)]


def music_note(rng, index=0):
    """One tooth of a music box's steel comb, plucked by a pin: a bright, bell-like ting that rings ~1.2 s.

    A tooth is a steel bar clamped at one end, so its overtones aren't harmonics: they sit at 6.27
    and 17.55 times the note (a clamped bar's modes), which is the glassy "ting" on top, gone in
    a tenth of a second, while the note itself sings on. The pin lets go all at once (no mallet:
    the attack is a few samples), a little off-centre (a faint twin a few cents sharp, so the note
    shimmers instead of standing still), and the pluck knocks the wooden box the comb sits on (a
    soft, short tock under it; the box also lends the note a breath of its octave).
    """
    _, f = MUSIC_NOTES[index]
    total = 1.5
    n = n_of(total)
    t = times(n)
    # The note rings longer on the long, low teeth: -60 dB after ~1.4 s (C5) to ~1.1 s (C6).
    tau = 0.2 * (523.25 / f) ** 0.35
    partials = [
        (1.0, 1.0, tau),           # the note
        (1.0028, 0.16, tau * 0.9), # its off-centre twin: a slow shimmer
        (2.0, 0.07, tau * 0.45),   # the box's soundboard adding a breath of the octave
        (6.267, 0.24, 0.05),       # the clamped bar's second mode: the ting
        (17.55, 0.05, 0.014),      # and its third: the glint of the pin letting go
    ]
    y = np.zeros(n)
    for ratio, g, d in partials:
        fp = f * ratio
        if fp >= 11000:
            continue
        y += g * np.sin(TAU * fp * t + rng.uniform(0, 0.4)) * np.exp(-t / d)
    # The pin lets go: the tooth springs from bent to ringing in a third of a millisecond.
    a = n_of(0.00035)
    y[:a] *= 0.5 - 0.5 * np.cos(np.pi * np.arange(a) / a)
    # It dies away rather than stopping.
    fade = n // 3
    y[-fade:] *= np.cos(0.5 * np.pi * np.arange(fade) / fade) ** 2
    out = silence(total)
    place(out, y, 0.0, 1.0)
    # The pluck through the comb's bedplate into the box: a soft wooden tock, and the pin's tiny tick.
    place(out, hit(MUSIC_BOX, 0.12, 0.0007), 0.0, 0.3)
    place(out, hit([(4300, 0.0025, 1.0), (6100, 0.0018, 0.5)], 0.02, 0.0002), 0.0, 0.05)
    out = lp(out, 9000, 2)
    return room(out, rng, rt60=0.3, wet=0.1, tone=5000)


def wax_crack(rng):
    """A wax seal cracking in two as an envelope is opened: a short dry snap, then a brittle crumble.

    Sealing wax is hard and dead: it doesn't ring, it snaps (a hard contact into a few high, very
    short modes, with a dry burst of noise), the crack runs across it a few milliseconds later, and
    the crumbs it sheds tick down onto the paper, thinning out. Small and close: almost no room.
    """
    out = silence(0.4)
    wax = [(1850, 0.004, 0.7), (3100, 0.0035, 1.0), (4650, 0.0025, 0.7), (6400, 0.0018, 0.4)]
    # The snap: the seal gives, and the crack runs to its other edge 11 ms later.
    place(out, hit(wax, 0.04, 0.00025, rng, 0.35), 0.0, 1.0)
    n = n_of(0.01)
    place(out, hp(rng.standard_normal(n), 1800, 2) * env(n, 0.0002, 0.0018), 0.0, 0.5)
    place(out, hit(scale_bank(wax, 1.22), 0.03, 0.0003, rng, 0.35), 0.011, 0.55)
    place(out, hp(rng.standard_normal(n), 2400, 2) * env(n, 0.0002, 0.0014), 0.011, 0.25)
    # The stiff paper under it takes the snap: a dull little pat, no ring.
    pat = lp(rng.standard_normal(n_of(0.03)), 1300) * env(n_of(0.03), 0.001, 0.006)
    place(out, pat + 0.6 * hit([(420, 0.008, 1.0), (880, 0.005, 0.5)], 0.03, 0.0015), 0.0, 0.35)
    # The crumble: crumbs of wax breaking off and ticking onto the paper, dense at first, then a few.
    for _ in range(34):
        at = 0.02 + 0.27 * rng.random() ** 2.0
        fk = rng.uniform(0.85, 1.9)
        g = rng.uniform(0.1, 0.42) * (1 - 0.75 * (at - 0.02) / 0.27)
        crumb = hit(scale_bank(wax, fk, 1.0, 0.7), 0.012, rng.uniform(0.0002, 0.0005), rng, 0.3)
        place(out, crumb, at, g)
    # Under the first of it, the fine dry crackle of the break's edges rubbing as the halves part.
    n = n_of(0.12)
    edges = (rng.random(n) < 0.03) * rng.standard_normal(n)
    place(out, bp(edges, 2200, 7500) * env(n, 0.004, 0.035), 0.012, 0.3)
    out = lp(out, 9500)
    return room(out, rng, rt60=0.1, wet=0.04)


# Where the string comes off each button, in seconds (the haptics tick on the same beats), and the flap.
STRING_TURNS = (0.0, 0.16, 0.3)
STRING_FLAP = 0.4


def string_off(rng):
    """Waxed string unwound from an envelope's two card buttons, then the flap lifting.

    Each turn is a quick soft whirr (the thread dragging round the card disc: friction in ragged
    little bursts, the band rising as it speeds up) ending in a tick as it flips free of the button;
    three turns, each quicker and lighter than the last; then the flap's paper flexing open.
    """
    out = silence(0.66)
    card = [(720, 0.006, 0.8), (1380, 0.005, 1.0), (2250, 0.003, 0.5)]
    for k, at in enumerate(STRING_TURNS):
        d = (0.11, 0.095, 0.08)[k]
        g = (1.0, 0.85, 0.7)[k]
        n = n_of(d)
        # The thread sticking and slipping on the card as it comes round.
        rough = np.abs(lp(rng.standard_normal(n), 300, 2))
        rough = (rough / rough.mean()) ** 1.8
        drag = rng.standard_normal(n) * (0.25 + 0.75 * np.minimum(rough, 4.0) / 1.6)
        whirr = svf_bandpass(drag, np.geomspace(950, 2300 + 250 * k, n), 1.3) * bell_env(n, d * 0.7) ** 1.2
        place(out, lp(whirr, 4200, 2), at, 0.2 * g)
        # It flips free of the button: a small, dull tick of thread on card.
        place(out, hit(scale_bank(card, 1 + 0.12 * k), 0.03, 0.0006, rng, 0.2), at + d * 0.86, 0.4 * g)
    # The flap lifting: paper flexing open, a few fibre cracks along its crease.
    n = n_of(0.24)
    flex = svf_bandpass(rng.standard_normal(n), np.linspace(700, 2100, n), 1.0) * bell_env(n, 0.09) ** 1.2
    place(out, flex, STRING_FLAP, 0.26)
    for _ in range(26):
        d = rng.uniform(0.0008, 0.003)
        lo = rng.uniform(1900, 4400)
        grain = bp(rng.standard_normal(n_of(d)) * np.hanning(n_of(d)), lo, lo * 1.9)
        place(out, grain, STRING_FLAP + 0.02 + 0.17 * rng.random() ** 1.3, min(rng.pareto(2.5) * 0.07 + 0.025, 0.11))
    out = lp(out, 9000)
    return room(out, rng, rt60=0.14, wet=0.06)


def door_out(rng):
    """A heavy panelled door swung open onto a rainy street at night (the noir ending).

    The latch lets go (0 s: brass, and the door's weight leaving its frame); the old hinges give a
    low, short creak as it swings (to ~0.75 s: a slow stick-slip, low and uneven, through the
    door's panels; never a rising squeal); and the outside comes in as the gap widens, muffled at
    first, then open: steady rain on cobbles (a hiss of small drops, fatter splats on the stones)
    and the city's distant hum, held to ~1.9 s and fading out by 2.4 s.
    """
    total = 2.4
    n = n_of(total)
    t = times(n)
    inside = silence(total)
    # The latch: the bolt drawn back, its click, and the door's own low knock as it leaves the frame.
    place(inside, hit(scale_bank(BRASS_BOLT, 1.15, 1.0, 0.8), 0.25, 0.0009), 0.0, 0.55)
    place(inside, hit(LATCH, 0.06, 0.0004), 0.035, 0.22)
    door = [(92, 0.06, 0.6), (171, 0.05, 0.8), (318, 0.035, 1.0), (590, 0.022, 0.6), (1040, 0.012, 0.3)]
    place(inside, hit(door, 0.35, 0.0018), 0.045, 0.6)
    # The creak: the hinge pin sticking and slipping, slow and uneven, a little faster mid-swing.
    m = n_of(0.7)
    tc = times(m)
    arc = np.sin(np.pi * tc / 0.7)
    rate = (26 + 30 * arc ** 1.5) * (1 + 0.5 * lp(rng.standard_normal(m), 12, 1) * 6)
    slips = np.diff(np.floor(np.cumsum(np.maximum(rate, 8)) / SR), prepend=0)
    slips *= np.exp(0.35 * rng.standard_normal(m))  # every slip a different size
    panels = [(205, 0.016, 0.6), (372, 0.014, 1.0), (640, 0.01, 0.7), (1120, 0.006, 0.3)]
    creak = modes(lp(slips, 2500, 1) * 0.28, panels, 0.7) * arc ** 0.8
    creak += bp(rng.standard_normal(m), 250, 900, 1) * 0.003 * arc  # the dry rub under it
    place(inside, creak, 0.07, 1.0)
    # The door sweeping the air.
    sweep = lp(rng.standard_normal(n_of(0.75)), 420, 2) * bell_env(n_of(0.75), 0.3) ** 1.5
    place(inside, sweep, 0.08, 0.05)
    inside = room(inside, rng, rt60=0.35, wet=0.14)[:n]

    # Outside: rain. A steady hiss of small drops...
    white = rng.standard_normal(n)
    hiss = bp(lp(white, 3000, 1) + 0.3 * white, 1100, 8000, 2)
    hiss *= 1 + 0.25 * lp(rng.standard_normal(n), 2.5, 1) * 25  # it comes in gusts, a little
    rain = hiss * 0.5
    # ...single drops ticking on stone and puddle...
    for _ in range(int(total * 110)):
        d = rng.uniform(0.0006, 0.0025)
        lo = rng.uniform(2200, 6000)
        drop = bp(rng.standard_normal(n_of(d)) * np.hanning(n_of(d)), lo, lo * 1.7)
        place(rain, drop, rng.uniform(0, total - 0.01), rng.uniform(0.3, 1.2))
    # ...and fatter splats on the cobbles: lower, rounder.
    for _ in range(int(total * 16)):
        f0 = rng.uniform(550, 1500)
        splat = hit([(f0, 0.004, 1.0), (f0 * 2.3, 0.003, 0.4)], 0.02, 0.0007, rng, 0.3)
        place(rain, splat, rng.uniform(0, total - 0.03), rng.uniform(0.25, 0.7))
    # The city, far off: a low hum (its upper partials are what a phone can play) and a soft rumble.
    hum = sum(g * np.sin(TAU * f * t + rng.uniform(0, TAU)) * (1 + 0.3 * np.sin(TAU * b * t))
              for f, g, b in ((110.0, 1.0, 0.31), (164.8, 0.6, 0.23), (220.5, 0.5, 0.41), (329.0, 0.3, 0.17)))
    rumble = lp(np.cumsum(rng.standard_normal(n)) / 40, 300, 2)
    rumble = hp(rumble, 60, 2)
    far = 0.012 * hum + 0.06 * rumble / max(np.abs(rumble).max(), 1e-9)
    outside = rain + far
    # It comes in as the gap widens: muffled through the door, then open; held, then fading.
    gap = np.sin(0.5 * np.pi * np.clip((t - 0.1) / 0.75, 0, 1)) ** 2
    muffled = lp(outside, 700, 2)
    outside = muffled * (0.25 + 0.75 * (1 - gap)) * np.clip(t / 0.25, 0, 1) * 0.6 + outside * gap ** 1.8
    hold = np.cos(0.5 * np.pi * np.clip((t - 1.85) / (total - 1.85), 0, 1)) ** 2
    return inside + 0.45 * outside * hold


# Where the flame goes out, in seconds into candle_out (the haptic's beat).
CANDLE_PUFF = 0.45


def candle_out(rng):
    """A candle guttering and going out: the flame flutters, a small puff takes it, the wick hisses faintly.

    A flame's flutter is air, not a tone: soft low turbulence beating unevenly, quicker and wilder
    as it gutters (to 0.45 s); the puff is one short breath of low air; the wick's ember hisses
    for a moment and is gone.
    """
    out = silence(0.82)
    # The flutter: soft turbulence, beating ~11 to 19 times a second, more ragged as it goes.
    n = n_of(CANDLE_PUFF + 0.03)
    t = times(n)
    rate = (11 + 8 * (t / t[-1]) ** 1.5) * (1 + 0.6 * lp(rng.standard_normal(n), 8, 1) * 8)
    beat = (0.5 + 0.5 * np.cos(TAU * np.cumsum(np.maximum(rate, 5)) / SR)) ** 2
    lick = 0.2 + 0.8 * beat * (1 + 0.5 * lp(rng.standard_normal(n), 30, 1) * 4)
    air = rng.standard_normal(n)
    flutter = (bp(air, 260, 900, 1) + 0.25 * bp(air, 900, 2400, 1)) * lick
    flutter *= np.clip(t / 0.06, 0, 1) * (0.55 + 0.45 * t / t[-1])
    place(out, lp(flutter, 2400, 2), 0.0, 0.5)
    # The puff: a short breath of air, falling as it spends itself.
    n = n_of(0.2)
    puff = svf_bandpass(rng.standard_normal(n), np.geomspace(1100, 420, n), 0.8) * env(n, 0.014, 0.045)
    place(out, puff, CANDLE_PUFF, 1.0)
    place(out, lp(rng.standard_normal(n), 380, 2) * env(n, 0.02, 0.05), CANDLE_PUFF, 0.5)
    # The wick: a faint hiss as the ember dies, a tick or two in it.
    n = n_of(0.3)
    ember = bp(rng.standard_normal(n), 3800, 8500, 2) * env(n, 0.02, 0.075)
    ember *= 1 + 0.4 * lp(rng.standard_normal(n), 60, 1) * 3
    place(out, ember, CANDLE_PUFF + 0.05, 0.1)
    for at in (0.07, 0.13):
        tick = hp(rng.standard_normal(n_of(0.0012)), 3000) * np.hanning(n_of(0.0012))
        place(out, tick, CANDLE_PUFF + at + rng.uniform(-0.01, 0.01), 0.1)
    out = lp(out, 9000)
    return room(out, rng, rt60=0.2, wet=0.07)


# name: (builder, seed, output file)
CUES = {
    "press": (press, 11, "press.m4a"),
    "knock": (knock, 12, "knock.m4a"),
    "paper": (paper, 13, "paper.m4a"),
    "pickup": (pickup, 14, "pickup.m4a"),
    "snap": (snap, 15, "snap.m4a"),
    "detent": (detent, 16, "detent.m4a"),
    "unlock": (unlock, 17, "unlock.m4a"),
    "wrong-code": (wrong_code, 18, "wrong-code.m4a"),
    "stamp": (stamp, 19, "stamp.m4a"),
    "solved": (solved, 20, "solved.m4a"),
    "drawer": (drawer, 21, "drawer.m4a"),
    "cloth": (cloth, 22, "cloth.m4a"),
    "uv-switch": (uv_switch, 23, "uv-switch.m4a"),
    "lens-up": (lens_up, 24, "lens-up.m4a"),
    "lens-down": (lens_down, 25, "lens-down.m4a"),
    "purr": (purr, 26, "purr.m4a"),
    "mug-break": (mug_break, 27, "mug-break.m4a"),
    "pencil-rub-1": (lambda rng: pencil_rub(rng, 0), 28, "pencil-rub-1.m4a"),
    "pencil-rub-2": (lambda rng: pencil_rub(rng, 1), 29, "pencil-rub-2.m4a"),
    "pencil-rub-3": (lambda rng: pencil_rub(rng, 2), 30, "pencil-rub-3.m4a"),
    "paper-fold": (paper_fold, 31, "paper-fold.m4a"),
    **{f"music-note-{i}": ((lambda rng, i=i: music_note(rng, i)), 32 + i, f"music-note-{i}.m4a") for i in range(6)},
    "wax-crack": (wax_crack, 38, "wax-crack.m4a"),
    "string-off": (string_off, 39, "string-off.m4a"),
    "door-out": (door_out, 40, "door-out.m4a"),
    "candle-out": (candle_out, 41, "candle-out.m4a"),
}


def write_wav(path: Path, x: np.ndarray, seed: int) -> None:
    """16-bit mono PCM with seeded TPDF dither."""
    rng = np.random.default_rng(seed)
    d = (rng.random(len(x)) - rng.random(len(x))) / 32768
    pcm = np.clip(np.round((x + d) * 32767), -32767, 32767).astype(np.int16)
    wavfile.write(path, SR, pcm)


# Encoder settings, tried in order. ffmpeg's default AAC coder (twoloop) now and
# then mangles one sharp low transient (the stamp came back 4 dB over full
# scale), so every encode is decoded and checked, and the next setting is
# tried if it overshoots full scale or drifts from the source (waveform error
# worse than -12 dB; a clean perceptual encode of these sits near -17 dB).
CODERS = (["-b:a", BITRATE], ["-b:a", BITRATE, "-aac_coder", "fast"], ["-b:a", "160k"])


def decode(path: Path, work: Path) -> np.ndarray:
    raw = work / "check.raw"
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(path),
                    "-ac", "1", "-ar", str(SR), "-f", "f32le", str(raw)], check=True)
    return np.fromfile(raw, dtype=np.float32).astype(float)


def encode(src: Path, dst: Path, x: np.ndarray, work: Path) -> str:
    """Encode src to AAC in dst; returns the setting used. Raises if none decodes back cleanly."""
    for opts in CODERS:
        subprocess.run(
            ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(src),
             "-ac", "1", "-ar", str(SR), "-c:a", "aac", *opts,
             "-map_metadata", "-1", "-fflags", "+bitexact", "-flags:a", "+bitexact", "-movflags", "+faststart",
             str(dst)],
            check=True,
        )
        y = decode(dst, work)[: len(x)]
        y = np.pad(y, (0, len(x) - len(y)))
        peak = 20 * np.log10(max(np.abs(y).max(), 1e-12))
        err = 10 * np.log10(max(np.sum((y - x) ** 2), 1e-20) / max(np.sum(x**2), 1e-20))
        if peak <= -0.5 and err <= -12:
            return " ".join(opts)
    raise RuntimeError(f"{dst.name}: no encoder setting decodes back cleanly (peak {peak:.1f} dBFS, error {err:.1f} dB)")


def build(name: str, work: Path) -> None:
    fn, seed, file = CUES[name]
    x = fn(np.random.default_rng(seed))
    x = finish(np.asarray(x, dtype=float))
    if not np.all(np.isfinite(x)):
        raise ValueError(f"{name}: non-finite samples")
    x, lufs, peak = level(x)
    src = work / f"{name}.wav"
    write_wav(src, x, 7)
    dst = OUT / file
    coder = encode(src, dst, x, work)
    if os.environ.get("WAV_DIR"):
        keep = Path(os.environ["WAV_DIR"])
        keep.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(src, keep / f"{name}.wav")
    kb = dst.stat().st_size / 1024
    # How much of it a phone speaker can play: the share of energy above 300 Hz.
    phone = 100 * np.sum(hp(x, 300, 4) ** 2) / max(np.sum(x**2), 1e-12)
    print(f"{file:16} {len(x) / SR:5.2f} s  {kb:5.1f} KB  {lufs:6.1f} LUFS(M max)  {peak:5.1f} dBTP  {phone:3.0f}% >300 Hz  [{coder}]")


def main(argv: list[str]) -> None:
    # A name is a cue, or a set of numbered variants ("pencil-rub" builds pencil-rub-1, -2 and -3).
    variants = lambda name: [c for c in CUES if c.rpartition("-")[0] == name and c.rpartition("-")[2].isdigit()]  # noqa: E731
    names = [c for name in argv for c in ([name] if name in CUES else variants(name) or [name])] or list(CUES)
    unknown = [n for n in names if n not in CUES]
    if unknown:
        sys.exit(f"no cue called {', '.join(unknown)}; have {', '.join(CUES)}")
    OUT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="escapd-foley-") as tmp:
        for name in names:
            build(name, Path(tmp))


if __name__ == "__main__":
    main(sys.argv[1:])

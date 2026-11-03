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
    """The cat, rubbed: a short, low, soft purr. One breath out, one in, faded at both ends."""
    total = 1.6
    n = n_of(total)
    t = times(n)
    # The breath: out (louder, ~25 Hz) for 0.85 s, a short catch, then in (softer, a touch faster).
    out_breath = (t < 0.85).astype(float)
    in_breath = ((t > 0.92) & (t < 1.6)).astype(float)
    rate = np.where(t < 0.88, 25.0, 27.5) * (1 + 0.08 * rng.standard_normal(n).cumsum() / np.sqrt(n))
    phase = np.cumsum(rate) / SR
    pulse = (0.5 + 0.5 * np.cos(TAU * phase)) ** 4
    breath = lp(out_breath, 25, 1) + 0.6 * lp(in_breath, 25, 1)
    src = rng.standard_normal(n) * 0.35 + signal.sawtooth(TAU * phase * 2) * 0.4
    src = src * pulse * breath
    # The voice through the cat: chest and nose resonances, kept well under 1.2 kHz.
    body = modes(src * 0.004, [(180, 0.02, 0.55), (330, 0.016, 1.0), (620, 0.012, 0.75), (980, 0.007, 0.35)], total)
    air = bp(src, 250, 1100) * 0.4
    x = (body + air) * bell_env(n, 0.25) ** 0.6
    x = lp(x, 1200, 2)
    return room(x, rng, rt60=0.18, wet=0.05)


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
    names = argv or list(CUES)
    unknown = [n for n in names if n not in CUES]
    if unknown:
        sys.exit(f"no cue called {', '.join(unknown)}; have {', '.join(CUES)}")
    OUT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="escapd-foley-") as tmp:
        for name in names:
            build(name, Path(tmp))


if __name__ == "__main__":
    main(sys.argv[1:])

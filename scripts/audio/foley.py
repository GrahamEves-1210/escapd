#!/usr/bin/env python3
"""Builds the game's few sound effects in assets/audio/ from nothing.

The game is mostly silent: a touch is felt (the haptics), not heard. A sound
is kept only where something physical happens and the player earned it: a
lock giving way, a drawer, a page turned, a stamp, the camera's shutter, the
ending's door or candle, and the music box (an instrument). Each is quiet,
short and natural, mixed well under the user's music (src/game/sound.ts).

Everything is synthesized here (no samples, nothing downloaded; docs/AUDIO.md):

- an impact is layered noise: a fraction of a millisecond of contact click, a
  bright burst for the hard part that dies in a few ms, low-passed noise for
  the weight, and at most a few body modes that are gone in under 10 ms, so
  it has a material but never a pitch;
- rubs, slides, air and rain are seeded noise through wide (low-order)
  band-passes, fixed or swept, let through in grains and shaped by envelopes;
- every cue sits in a small furnished room (sparse early reflections, a dense
  tail whose top decays first) with the faint air of the room under it, then
  a 40 Hz high-pass and a top roll-off; it is levelled to a common momentary
  loudness with a peak ceiling, faded to exact zero and encoded to AAC (.m4a).
- the music box's notes are the one tonal thing: a clamped steel tooth's modes.

    python3 scripts/audio/foley.py                 # every cue
    python3 scripts/audio/foley.py drawer unlock   # just these
    python3 scripts/audio/foley.py music-note      # a numbered set (music-note-0 to -5)
    WAV_DIR=/tmp/wavs python3 scripts/audio/foley.py   # also keep the 16-bit WAVs
    OUT_DIR=/tmp/out python3 scripts/audio/foley.py    # write the .m4a files there instead
    python3 scripts/audio/contact_sheet.py /tmp/wavs     # waveforms + spectrograms PNG

Needs Python 3.10+, numpy, scipy, and ffmpeg (native aac encoder) on PATH.
The output is deterministic (seeded noise, bit-exact encode), so a rebuild
changes only what you edit.
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
# OUT_DIR builds somewhere else first (to listen-check, or to swap files in under a running app).
OUT = Path(os.environ["OUT_DIR"]) if os.environ.get("OUT_DIR") else ROOT / "assets" / "audio"
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
# Building blocks for the physical cues. Everything here is noise shaped in
# time and frequency: a struck or rubbed object is heard as a burst of
# broadband energy coloured by a wide, heavily damped body, not as a ringing
# pitch. Sustained modes (a resonator with a long decay) are what made the old
# set read as synthesizer clunks, so a mode here never rings longer than a few
# milliseconds, and the colour comes from low-order, low-Q band-passes.
# ---------------------------------------------------------------------------


def burst(rng, sec: float, lo: float, hi: float, attack: float, tau: float, order: int = 1) -> np.ndarray:
    """A band of noise struck once: a raised-cosine attack and an exponential fall (tau s)."""
    n = n_of(sec)
    x = rng.standard_normal(n)
    x = bp(x, lo, hi, order) if lo > 0 else lp(x, hi, order)
    return x * env(n, attack, tau)


def click(rng, sec: float = 0.0006, cut: float = 1500) -> np.ndarray:
    """The instant of contact: a fraction of a millisecond of high-passed noise, windowed (no step, no tone)."""
    n = max(4, n_of(sec))
    return hp(rng.standard_normal(n), cut, 1) * np.hanning(n)


def damped(exc_sec: float, bank, sec: float) -> np.ndarray:
    """A few body modes, each gone in a few ms (bank: freq Hz, tau s <= ~0.008, level): weight, not pitch."""
    return modes(contact(exc_sec), bank, sec)


def space(x: np.ndarray, rng: np.random.Generator, rt60: float = 0.3, wet: float = 0.1, size: float = 1.0) -> np.ndarray:
    """A small, furnished room: sparse early reflections, then a dense diffuse tail whose top dies first.

    The tail is two bands of decaying noise: under 1.8 kHz it decays over rt60, above it in half
    that (soft furnishings and air soak up the top), so the space sounds like wood and cloth, not a
    tiled box. It grows in over the first few ms, after the early reflections.
    """
    n = n_of(rt60 * 1.2)
    t = times(n)
    noise = rng.standard_normal(n)
    low = lp(noise, 1800, 2) * np.exp(-6.91 * t / rt60)
    high = hp(noise, 1800, 2) * np.exp(-6.91 * t / (rt60 * 0.5))
    tail = lp(low + 0.6 * high, 7000, 1)
    grow = n_of(0.012 * size)
    tail[:grow] *= np.sin(0.5 * np.pi * np.arange(grow) / grow) ** 2
    ir = 0.6 * tail / np.sqrt(np.sum(tail**2))
    for delay, g in ((0.0024, 0.42), (0.0041, -0.33), (0.0063, 0.27), (0.0087, -0.2), (0.0118, 0.16), (0.0152, -0.11)):
        i = n_of(delay * size)
        ir[i] += g * (1 + 0.15 * rng.standard_normal())
    ir /= np.sqrt(np.sum(ir**2))
    w = signal.fftconvolve(x, ir)
    return np.concatenate([x, np.zeros(len(w) - len(x))]) + wet * w


def room_tone(n: int, rng: np.random.Generator, level: float) -> np.ndarray:
    """The air of the room under a cue: soft, dark, steady noise that fades in with it and out with its tail."""
    t = times(n)
    total = n / SR
    bed = lp(np.cumsum(rng.standard_normal(n)) * 0.02 + rng.standard_normal(n) * 0.3, 2500, 2)
    bed = hp(bed, 120, 2)
    bed /= max(np.sqrt(np.mean(bed**2)), 1e-12)
    up = np.sin(0.5 * np.pi * np.clip(t / 0.02, 0, 1)) ** 2
    down = np.cos(0.5 * np.pi * np.clip((t - total * 0.45) / (total * 0.55), 0, 1)) ** 2
    return level * bed * up * down


def with_room_tone(x: np.ndarray, rng: np.random.Generator, db: float = -52.0) -> np.ndarray:
    """Lay the room's air under a cue, `db` under its peak: a cue then sits in a place instead of in digital silence.

    The cue is moved 4 ms in, so a contact at its very start isn't softened by finish()'s fade-in.
    """
    x = np.concatenate([np.zeros(n_of(0.004)), x])
    return x + room_tone(len(x), rng, np.abs(x).max() * 10 ** (db / 20))


# ---------------------------------------------------------------------------
# The cues. Few, quiet, and only where something physical happens and the
# player earned it: a lock giving way, a drawer, a page, a stamp, the camera,
# the ending's door or candle, and the music box (the box is an instrument).
# ---------------------------------------------------------------------------

# Where the latch drops in unlock, in seconds (the light haptic's beat).
UNLOCK_LATCH = 0.11


def unlock(rng):
    """A lock giving way: the bolt drawn back with a short metal rub and a solid clack, the latch dropping at 110 ms.

    Brass on steel in a wooden case. The clack is a click of contact, a bright metal burst gone in
    a few ms and the case's dull thunk (low-passed noise and two body modes that die in under
    10 ms); the latch is the same, smaller and higher, with one tiny bounce. No chime.
    """
    out = silence(0.42)
    # The bolt withdrawn: a short, rising metal rub just ahead of the clack.
    n = n_of(0.03)
    rub = bp(rng.standard_normal(n), 1600, 5200, 1) * np.linspace(0, 1, n) ** 2
    place(out, rub, 0.0, 0.05)
    # The bolt reaching its stop.
    at = 0.014
    place(out, click(rng, 0.0005, 2000), at, 0.35)
    place(out, burst(rng, 0.03, 1900, 5200, 0.0003, 0.0035), at, 0.5)
    place(out, burst(rng, 0.03, 4200, 9000, 0.0002, 0.0018), at, 0.22)
    place(out, burst(rng, 0.06, 0, 1100, 0.0009, 0.008, 2), at, 0.45)
    place(out, burst(rng, 0.05, 350, 1500, 0.0006, 0.006), at, 0.6)
    place(out, damped(0.0012, [(210, 0.007, 0.35), (520, 0.005, 0.7), (1050, 0.004, 0.45)], 0.06), at, 0.5)
    # The latch dropping into its keep, and settling.
    at = UNLOCK_LATCH
    place(out, click(rng, 0.0004, 2600), at, 0.2)
    place(out, burst(rng, 0.025, 2600, 7000, 0.0002, 0.0024), at, 0.28)
    place(out, burst(rng, 0.04, 500, 2000, 0.0005, 0.004), at, 0.3)
    place(out, click(rng, 0.0003, 3000), at + 0.009, 0.1)
    out = lp(out, 10000, 2)
    return with_room_tone(space(out, rng, rt60=0.24, wet=0.11, size=0.8), rng)


# Where the drawer meets its stop, in seconds (the firm haptic's beat).
DRAWER_STOP_AT = 0.17


def drawer(rng):
    """A wooden drawer pulled out: wood sliding on its runners, then its soft knock against the stop at 170 ms.

    The slide is friction: noise let through in uneven stick-slip grains (~35 to 60 a second, each
    a different size), coloured by the drawer box (a wide band round 500 Hz) and swelling as it
    speeds up. The stop is a dull wooden knock: a click, low-passed noise, a short mid-band body;
    then what's inside shifts, two tiny taps.
    """
    out = silence(0.5)
    n = n_of(DRAWER_STOP_AT + 0.01)
    t = times(n)
    rate = 34 + 26 * (t / t[-1])
    ticks = np.diff(np.floor(np.cumsum(rate * (1 + 0.35 * rng.standard_normal(n))) / SR), prepend=0)
    grains = lp(np.abs(ticks) * np.exp(0.4 * rng.standard_normal(n)), 220, 1) * 60
    friction = bp(rng.standard_normal(n), 260, 2400, 1) * (0.8 + 0.6 * np.clip(grains, 0, 2.5))
    box = bp(friction, 330, 800, 1)
    slide = (0.55 * friction + 0.8 * box) * np.sin(0.5 * np.pi * np.clip(t / 0.12, 0, 1)) ** 1.5
    slide *= np.cos(0.5 * np.pi * np.clip((t - (DRAWER_STOP_AT - 0.012)) / 0.02, 0, 1)) ** 2
    place(out, lp(slide, 3000, 2), 0.0, 0.16)
    # The stop.
    at = DRAWER_STOP_AT
    place(out, click(rng, 0.0008, 900), at, 0.2)
    place(out, burst(rng, 0.09, 0, 800, 0.0015, 0.013, 2), at, 0.6)
    place(out, burst(rng, 0.06, 300, 1300, 0.0008, 0.008), at, 0.7)
    place(out, damped(0.0016, [(165, 0.009, 0.5), (390, 0.007, 0.7), (760, 0.005, 0.4)], 0.07), at, 0.7)
    # Inside: a pencil and a key shifting.
    for after, g in ((0.028, 0.07), (0.061, 0.045)):
        place(out, click(rng, 0.0006, 1800), at + after, g)
        place(out, burst(rng, 0.01, 1500, 5000, 0.0002, 0.0014), at + after, 0.4 * g)
    out = lp(out, 9000, 2)
    return with_room_tone(space(out, rng, rt60=0.26, wet=0.1), rng)


def paper(rng):
    """A page turned: lifted at its corner, swung over through the air, laid down flat.

    The corner lifting is a short dry rub; as the sheet buckles a few soft fibre ticks; the swing
    is air moving past paper (noise through a wide band sweeping up and back down, swelling and
    falling); the landing a soft flat slap. Sparse and soft: a page, not a crisp packet.
    """
    out = silence(0.4)
    # The corner taken up.
    n = n_of(0.035)
    rub = bp(rng.standard_normal(n), 2200, 7000, 1) * bell_env(n, 0.012)
    place(out, rub, 0.0, 0.18)
    # The sheet buckling: a handful of soft ticks, early.
    for _ in range(9):
        d = rng.uniform(0.0006, 0.0018)
        lo = rng.uniform(1800, 3800)
        grain = rng.standard_normal(n_of(d)) * np.hanning(n_of(d))
        place(out, bp(grain, lo, lo * 2.2, 1), 0.01 + 0.12 * rng.random() ** 1.4, rng.uniform(0.05, 0.16))
    # The swing: air past the sheet.
    n = n_of(0.26)
    t = times(n)
    centre = 700 + 1500 * np.sin(np.pi * np.clip(t / 0.22, 0, 1)) ** 1.2
    swing = svf_bandpass(rng.standard_normal(n), centre, 0.7) * bell_env(n, 0.1) ** 1.3
    swing *= 1 + 0.25 * lp(rng.standard_normal(n), 25, 1) * 6  # the sheet flutters a little as it goes
    place(out, swing, 0.03, 0.42)
    # Laid down.
    at = 0.27
    place(out, burst(rng, 0.05, 0, 1800, 0.002, 0.009, 2), at, 0.4)
    place(out, burst(rng, 0.03, 1800, 6000, 0.0008, 0.004), at, 0.08)
    out = lp(out, 8500, 2)
    return with_room_tone(space(out, rng, rt60=0.18, wet=0.07, size=0.7), rng)


def stamp(rng):
    """A rubber stamp pressed onto paper on a wooden desk, and lifted with a faint sticky peel.

    A soft, heavy, dull thump: the rubber spreads the blow, so there is almost no click; the desk
    answers with low-passed noise and a short, wide body; the sheet under it adds a little flat
    slap; at 160 ms the rubber leaves the paper with a few sticky crackles.
    """
    out = silence(0.36)
    place(out, burst(rng, 0.1, 0, 700, 0.0025, 0.012, 2), 0.0, 0.6)
    place(out, burst(rng, 0.06, 280, 1300, 0.0016, 0.007), 0.0, 0.7)
    place(out, damped(0.0022, [(130, 0.009, 0.35), (340, 0.007, 0.8), (700, 0.005, 0.5)], 0.08), 0.0, 0.7)
    place(out, burst(rng, 0.02, 1400, 5000, 0.0008, 0.0022), 0.001, 0.09)
    # The peel.
    n = n_of(0.05)
    sticky = (rng.random(n) < 0.015) * rng.standard_normal(n)
    peel = bp(sticky + 0.06 * rng.standard_normal(n), 1600, 5500, 1) * bell_env(n, 0.015)
    place(out, peel, 0.16, 0.12)
    out = lp(out, 8000, 2)
    return with_room_tone(space(out, rng, rt60=0.22, wet=0.09), rng)


def shutter(rng):
    """A film camera's shutter: the first curtain's crisp release, the second's at 55 ms, the mechanism settling.

    Small steel parts in a metal-and-leatherette body: each curtain is a click and a bright burst
    gone in a couple of ms over a short, hollow body (a wide band round 1.4 kHz); then a soft,
    low knock as the mirror and the gear come to rest.
    """
    out = silence(0.24)
    for at, g in ((0.0, 1.0), (0.055, 0.75)):
        place(out, click(rng, 0.0004, 2500), at, 0.8 * g)
        place(out, burst(rng, 0.02, 3000, 9000, 0.0002, 0.0016), at, 0.35 * g)
        place(out, burst(rng, 0.03, 900, 2600, 0.0004, 0.0042), at, 0.45 * g)
    place(out, burst(rng, 0.05, 0, 900, 0.0012, 0.007, 2), 0.072, 0.4)
    place(out, click(rng, 0.0005, 1800), 0.09, 0.12)
    out = lp(out, 11000, 2)
    return with_room_tone(space(out, rng, rt60=0.14, wet=0.05, size=0.5), rng)


def door_out(rng):
    """A heavy panelled door opened onto a rainy street at night (the noir ending).

    The latch lets go (a heavier version of unlock's: a click, a short metal burst and a dull
    thunk), the door's weight leaves its frame (a low, soft knock), the hinges give a brief, low,
    dry creak as it swings (stick-slip grains through the panels' wide body, never a squeal and
    never a pitch), and the outside comes in through the widening gap, muffled first, then open:
    rain on the street, a hiss of small drops and a few fatter splats, under the door and fading by 1.8 s.
    No hum, no tones.
    """
    total = 1.8
    n = n_of(total)
    t = times(n)
    inside = silence(total)
    # The latch.
    place(inside, click(rng, 0.0006, 1800), 0.0, 0.3)
    place(inside, burst(rng, 0.03, 1500, 4800, 0.0003, 0.004), 0.0, 0.35)
    place(inside, burst(rng, 0.08, 0, 600, 0.0012, 0.012, 2), 0.0, 0.7)
    # The door leaving its frame.
    place(inside, burst(rng, 0.12, 0, 600, 0.004, 0.025, 2), 0.04, 0.55)
    place(inside, burst(rng, 0.08, 250, 950, 0.002, 0.012), 0.04, 0.5)
    place(inside, damped(0.003, [(95, 0.012, 0.6), (190, 0.009, 0.8), (380, 0.006, 0.5)], 0.1), 0.04, 0.6)
    # The creak: the hinge pin sticking and slipping, slow and uneven, a little quicker mid-swing.
    m = n_of(0.6)
    tc = times(m)
    arc = np.sin(np.pi * tc / 0.6)
    rate = (22 + 26 * arc**1.5) * (1 + 0.45 * rng.standard_normal(m))
    slips = np.diff(np.floor(np.cumsum(np.maximum(rate, 6)) / SR), prepend=0) * np.exp(0.4 * rng.standard_normal(m))
    slips = np.minimum(slips, 2.0)
    grain = np.convolve(slips, np.hanning(n_of(0.004)), mode="same")
    creak = lp(bp(grain * (0.6 + 0.4 * rng.standard_normal(m)), 220, 1100, 1), 1800, 2) * arc**0.8
    creak += bp(rng.standard_normal(m), 260, 900, 1) * 0.004 * arc
    place(inside, creak, 0.08, 0.3)
    # The door sweeping the air.
    sweep = lp(rng.standard_normal(n_of(0.7)), 380, 2) * bell_env(n_of(0.7), 0.3) ** 1.5
    place(inside, sweep, 0.1, 0.06)
    inside = space(inside, rng, rt60=0.35, wet=0.13)[:n]

    # Outside: rain on the street. A steady hiss of small drops...
    white = rng.standard_normal(n)
    hiss = bp(lp(white, 3200, 1) + 0.25 * white, 900, 7500, 2)
    hiss *= 1 + 0.2 * lp(rng.standard_normal(n), 2.0, 1) * 25  # it comes in soft gusts
    rain = hiss * 0.45
    # ...single drops ticking on stone and puddle...
    for _ in range(int(total * 90)):
        d = rng.uniform(0.0006, 0.002)
        lo = rng.uniform(2000, 5500)
        drop = bp(rng.standard_normal(n_of(d)) * np.hanning(n_of(d)), lo, lo * 1.8, 1)
        place(rain, drop, rng.uniform(0, total - 0.01), rng.uniform(0.25, 1.0))
    # ...and fatter splats: lower and rounder, still noise.
    for _ in range(int(total * 14)):
        lo = rng.uniform(500, 1200)
        splat = burst(rng, 0.02, lo, lo * 2.6, 0.0004, 0.003)
        place(rain, splat, rng.uniform(0, total - 0.03), rng.uniform(0.3, 0.8))
    # The city far off: a soft, low rumble of traffic (noise only).
    rumble = hp(lp(np.cumsum(rng.standard_normal(n)) / 40, 260, 2), 60, 2)
    outside = rain + 0.05 * rumble / max(np.abs(rumble).max(), 1e-9)
    # The gap widening: muffled through the door, then open; held, then fading.
    gap = np.sin(0.5 * np.pi * np.clip((t - 0.12) / 0.7, 0, 1)) ** 2
    muffled = lp(outside, 650, 2)
    outside = muffled * (1 - gap) * np.clip(t / 0.25, 0, 1) * 0.3 + outside * gap**1.8
    hold = np.cos(0.5 * np.pi * np.clip((t - 1.0) / (total - 1.0), 0, 1)) ** 2
    out = inside + 0.13 * outside * hold
    return with_room_tone(lp(out, 9500, 2), rng)

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
    "paper": (paper, 13, "paper.m4a"),
    "unlock": (unlock, 17, "unlock.m4a"),
    "stamp": (stamp, 19, "stamp.m4a"),
    "drawer": (drawer, 21, "drawer.m4a"),
    "shutter": (shutter, 42, "shutter.m4a"),
    **{f"music-note-{i}": ((lambda rng, i=i: music_note(rng, i)), 32 + i, f"music-note-{i}.m4a") for i in range(6)},
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

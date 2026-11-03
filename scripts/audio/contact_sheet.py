#!/usr/bin/env python3
"""A listen-check proxy: draws each WAV's waveform and spectrogram into one contact sheet.

    WAV_DIR=/tmp/wavs python3 scripts/audio/foley.py
    python3 scripts/audio/contact_sheet.py /tmp/wavs [out.png]

Look for: a clean start (no step), a tail that fades to nothing, energy where
a phone speaker plays it (300 Hz to 8 kHz), nothing harsh above 9 kHz, and
the timing of each layer. Needs numpy, scipy and matplotlib.
"""

import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
from scipy import signal  # noqa: E402
from scipy.io import wavfile  # noqa: E402


def main(folder: str, out: str | None = None) -> None:
    files = sorted(Path(folder).glob("*.wav"))
    if not files:
        sys.exit(f"no .wav files in {folder}")
    fig, axes = plt.subplots(len(files), 2, figsize=(14, 2.1 * len(files)), squeeze=False)
    for row, path in zip(axes, files):
        sr, x = wavfile.read(path)
        x = x.astype(float) / 32768
        t = np.arange(len(x)) / sr
        row[0].plot(t, x, lw=0.5, color="#5b2a86")
        row[0].set_ylim(-1, 1)
        row[0].set_xlim(0, max(t[-1], 0.05))
        row[0].set_title(f"{path.stem}  {len(x) / sr:.2f} s  peak {20 * np.log10(np.abs(x).max() + 1e-9):.1f} dBFS", fontsize=9, loc="left")
        f, tt, s = signal.spectrogram(x, sr, nperseg=512, noverlap=448)
        row[1].pcolormesh(tt, f, 10 * np.log10(s + 1e-12), vmin=-120, vmax=-30, shading="auto", cmap="magma")
        row[1].set_ylim(0, 12000)
        row[1].set_xlim(0, max(t[-1], 0.05))
    fig.tight_layout()
    dest = out or str(Path(folder) / "contact-sheet.png")
    fig.savefig(dest, dpi=80)
    print(dest)


if __name__ == "__main__":
    main(*sys.argv[1:3])

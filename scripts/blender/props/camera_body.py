# The camera's body (src/capture/ui/Rangefinder.tsx): what lies behind every fitting.
#   leather   the body's covering as a grain alone: a square that repeats without a seam, light on
#             the pebbles and dark in the creases, clear between. The app lays it over the mode's
#             own ground, so the leather is plum, oxblood or indigo with the mode.
#   light     the studio's light across the whole back: warm from the upper left, plum toward
#             the lower right. A soft picture the app stretches over the screen.
#
#   <bpy python> scripts/blender/props/camera_body.py        # ONLY=leather for one
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from camera_common import M, Stage, kit, mc, totals, wanted  # noqa: E402
import numpy as np  # noqa: E402
from PIL import Image, ImageFilter  # noqa: E402

import export  # noqa: E402

TILE = 120     # the repeating square, points
LAP = 24       # rendered this much bigger, folded back over its own far side so the edges meet


def leather():
    S = TILE + LAP
    st = Stage(S, S, ss=1)
    hide = st.slab(-20, -20, S + 40, S + 40, d=0, back=-4, bevel=0, name="hide")
    kit.assign(hide, M.leather("hide", color=(0.12, 0.12, 0.12), grain=1.0, wear=0.0, scale=0.62))
    st.light()
    kit.no_outline()
    src = mc.scratch("leather")
    kit.render(src)
    a = np.asarray(export.load(src)).astype(np.float32) / 255.0
    lum = a[..., 0] * 0.3 + a[..., 1] * 0.6 + a[..., 2] * 0.1
    # Keep the grain, drop the studio's slow falloff across the hide (the `light` picture carries that).
    k = lum.shape[0] / S
    soft = np.asarray(Image.fromarray((lum * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(10 * k))).astype(np.float32) / 255.0
    g = lum - soft
    # Fold the lap back: the first LAP points fade from the picture's far side into its near side.
    t, lap = round(TILE * k), round(LAP * k)
    ramp = np.linspace(0, 1, lap, dtype=np.float32)
    g[:, :lap] = g[:, :lap] * ramp[None, :] + g[:, t:t + lap] * (1 - ramp[None, :])
    g[:lap, :] = g[:lap, :] * ramp[:, None] + g[t:t + lap, :] * (1 - ramp[:, None])
    g = g[:t, :t]
    sd = float(g.std()) or 1.0
    up = np.clip(g / (sd * 3.2), 0, 1) ** 0.9 * 0.20          # light on a pebble
    down = np.clip(-g / (sd * 2.6), 0, 1) * 0.55              # dark in a crease
    out = np.zeros(g.shape + (4,), np.float32)
    lit = up * 0.55 >= down * 0.2
    for i, (w, d) in enumerate(zip((255, 232, 214), (10, 5, 12))):
        out[..., i] = np.where(lit, w, d)
    out[..., 3] = np.where(lit, up, down) * 255
    im = Image.fromarray(out.clip(0, 255).astype(np.uint8), "RGBA")
    mc.save(im, "leather", (TILE, TILE))


def light():
    """No render: the studio's own geometry, as a gradient (key upper left, plum fill lower right)."""
    w, h = 48, 104
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    u, v = x / (w - 1), y / (h - 1)
    key = np.clip(1 - np.hypot(u * 0.9, v * 1.15) / 0.95, 0, 1) ** 1.6 * 0.10
    fall = np.clip((np.hypot((1 - u) * 0.8, (1 - v)) * -1 + 1.0), 0, 1) ** 1.4 * 0.34
    out = np.zeros((h, w, 4), np.float32)
    lit = key >= fall
    for i, (a, b) in enumerate(zip((255, 226, 196), (8, 4, 12))):
        out[..., i] = np.where(lit, a, b)
    out[..., 3] = np.where(lit, key, fall) * 255
    im = Image.fromarray(out.clip(0, 255).astype(np.uint8), "RGBA").filter(ImageFilter.GaussianBlur(1.2))
    path = os.path.join(export.REPO, mc.OUT, "light.png")
    im.save(path + ".tmp", "PNG", optimize=True)
    os.replace(path + ".tmp", path)
    print(f"  {mc.OUT}/light.png  {w}x{h}  {os.path.getsize(path) / 1024:.1f} KB")
    mc._totals["files"] += 1
    mc._totals["bytes"] += os.path.getsize(path)


if __name__ == "__main__":
    if wanted("leather"):
        leather()
    if wanted("light"):
        light()
    print("camera body:", totals())

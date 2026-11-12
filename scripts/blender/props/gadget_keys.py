# The key ring (src/play2/mechanisms/KeyRing.tsx, gadgets/KeyImpression.tsx). A key's bitting is five
# cuts of four depths (0..3), and rooms are generated, so no key is rendered whole: the same brass
# blank is rendered four times, each with all five cuts at one depth, and the app shows each cut's
# slice of the blade from the render with that cut's depth (gadgets/keys.ts: KEY.cuts). Between two
# cuts the blade always comes back to its full height, so any slices meet without a seam.
#   key-0 .. key-3       the key lying bow left, blade right, its cuts all at depth 0 (a blank) .. 3
#   soap-0 .. soap-3     a bar of soap with that key pressed into it (the same slices; mirrored, as a
#                        pressing is: bow right)
#   key-ring             the split ring the keys hang on
#   key-way              the lock's keyway, a brass collar on its side
#
#   <bpy python> scripts/blender/props/gadget_keys.py        # all; ONLY=key-2,soap-2 for some
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gadget_common import M, Stage, brass, circle, cut, kit, rounded_rect, totals, wanted  # noqa: E402

KW, KH = 120, 40                 # a key's box (gadgets/keys.ts KEY)
HOLE = (11, 20, 5.5)             # the hole the ring goes through
CUTS = [56 + 12 * i for i in range(5)]   # the cuts' centres along the blade; a slice is 12 wide
TOP, STEP = 13.0, 2.2            # the blade's top edge; a depth level
FLAT, RUN = 1.2, 0.55            # half a cut's flat bottom; its flanks' run per point of depth: the deepest cut is back at the
                                 # top edge more than a point short of its slice's edge, so slices can lap without a notch
SOAP = (200, 124)
PRESS = 1.3                      # the impression's size against the key's
INKY = (0.022, 0.013, 0.016)


def key_outline(depth, ox=0.0, oy=0.0, k=1.0, mirror=None):
    """The key's outline (clockwise as seen), every cut at `depth` (0..3)."""
    D = STEP * depth
    pts = [(34.9, 14), (40, 14), (40, 10), (44, 10), (44, TOP)]
    for x in CUTS:
        if D > 0:
            pts += [(x - FLAT - RUN * D, TOP), (x - FLAT, TOP + D), (x + FLAT, TOP + D), (x + FLAT + RUN * D, TOP)]
    pts += [(112, TOP), (118.4, 18.6), (118.4, 22), (113.5, 27), (44, 27), (44, 30), (40, 30), (40, 26), (34.9, 26)]
    a0, a1 = math.asin(6 / 17), 2 * math.pi - math.asin(6 / 17)
    for i in range(1, 40):
        a = a0 + (a1 - a0) * i / 40
        pts.append((19 + 17 * math.cos(a), 20 + 17 * math.sin(a)))
    out = [(ox + x * k, oy + y * k) for x, y in pts]
    if mirror is not None:
        out = [(mirror - x, y) for x, y in reversed(out)]
    return out


def key(depth):
    st = Stage(KW, KH, ss=2)
    hx, hy, hr = HOLE
    body = st.extrude(key_outline(depth), d=3.0, back=0, bevel=0.55, name="key", holes=[circle(hx, hy, hr, 28)])
    # (Satin: a polished flat face square to the eye would mirror the dark of the room and go brown.)
    kit.assign(body, brass("key", color=(0.84, 0.58, 0.22), age=0.15, brushed=0.9, rough=0.5, wear=0.8, axis="X"))
    st.plain.append(body)
    # The milled groove along the blade, and the rim struck round the bow.
    groove = st.slab(46, 22.4, 67, 1.5, d=3.12, back=2.4, r=0.7, bevel=0, name="groove")
    kit.assign(groove, M.rubber("groove", (0.10, 0.055, 0.02), rough=0.5))
    st.no_ink.append(groove)
    rim = st.ring(circle(19, 20, 14.2, 48), circle(19, 20, 13.2, 48), d=3.14, back=2.4, bevel=0, name="rim")
    kit.assign(rim, M.rubber("rim", (0.12, 0.065, 0.025), rough=0.5))
    st.no_ink.append(rim)
    st.light()
    st.ink(2.4)
    st.shoot(f"key-{depth}")


def soap(depth):
    w, h = SOAP
    st = Stage(w, h)
    bar = st.slab(5, 5, w - 10, h - 10, d=16, r=30, bevel=7, name="soap", segments=5, corner=14)
    kw, kh = KW * PRESS, KH * PRESS
    ox, oy = (w - kw) / 2, (h - kh) / 2
    press = st.extrude(key_outline(depth, ox, oy, PRESS, mirror=w), d=22, back=12.6, bevel=0, name="press")
    bar = cut(bar, press)
    kit.shade(bar, 30)
    kit.assign(bar, M.wax("soap", (0.80, 0.74, 0.60), translucency=0.0, gloss=0.3))   # (no light inside it: four renders of it, on a busy machine)
    st.light(shadow=0, strength=0.6, reach=7)
    st.ink(3, crease_angle=150)
    st.shoot(f"soap-{depth}")


def ring():
    S = 44
    st = Stage(S, S, ss=2)
    pts = [(S / 2 + 18 * math.sin(2 * math.pi * i / 24), S / 2 - 18 * math.cos(2 * math.pi * i / 24), 2.0) for i in range(24)]
    r = st.rod(pts, 1.9, "ring", closed=True, resolution=8)
    kit.assign(r, M.steel("ring", color=(0.30, 0.31, 0.34), blue=0.3, rough=0.22, brushed=0.2, wear=0.6, edge=(0.8, 0.8, 0.82)))
    st.light()
    st.ink(2)
    st.shoot("key-ring")


def keyway():
    w, h = 16, 30
    st = Stage(w, h, ss=2)
    b = brass("keyway", age=0.4, brushed=0.6, axis="X")
    kit.assign(st.slab(-6, 3, 13, 24, d=9, r=3, bevel=1.0, name="collar"), b)
    kit.assign(st.slab(5, 6.5, 9.6, 17, d=7.5, r=2.6, bevel=1.0, name="nose"), b)
    st.light()
    st.ink(2)
    st.shoot("key-way")


if __name__ == "__main__":
    for d in range(4):
        if wanted(f"key-{d}"):
            key(d)
    for name, fn in (("key-ring", ring), ("key-way", keyway)):
        if wanted(name):
            fn()
    for d in range(4):
        if wanted(f"soap-{d}"):
            soap(d)
    print("keys:", totals())

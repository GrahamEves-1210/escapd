# The balance (src/play2/mechanisms/Balance.tsx), seen square on, in layers the app tilts:
#   balance-stand    the walnut base, the brass pillar, the knife edge the beam rests on
#   balance-beam     the brass beam, level; the app turns it about its middle
#   balance-pan      a pan on its chains, hung from an end of the beam (the app keeps it plumb)
#   balance-weight   a brass weight; its symbol is stamped on it by the app
#
#   <bpy python> scripts/blender/props/gadget_balance.py        # all; ONLY=balance-beam for one
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gadget_common import M, Stage, at_2x, brass, circle, kit, rounded_rect, totals, wanted  # noqa: E402
from mech_drawer import WALNUT  # noqa: E402

W, H = 340, 276                  # Balance's BOX
PIVOT = (170, 62)                # where the beam turns
ARM = 118                        # from the pivot to where a pan hangs
BEAM = (260, 36)                 # the beam's box, the pivot at its middle
PAN = (92, 118)                  # a pan's box: its hook at the top middle
WEIGHT = (34, 42)                # a weight's box, standing on its bottom edge


def stand():
    st = Stage(W, H, samples=48)
    cx, cy = PIVOT
    wood = M.walnut("base", axis="X", color=WALNUT, figure=0.7, gloss=0.6)
    kit.assign(st.slab(52, 226, 236, 22, d=30, back=0, r=5, bevel=2.2, name="base"), wood)
    kit.assign(st.slab(64, 218, 212, 10, d=26, back=2, r=3, bevel=1.6, name="step"), wood)
    b = brass("pillar", age=0.45, brushed=0.5)
    # The pillar: a turned column, seen from the side (a lathe about its own upright axis).
    prof = [(0, 0), (17, 0), (17, 4), (12, 6), (9, 12), (6.5, 20), (5.2, 60), (4.6, 120), (5.4, 138), (7.5, 142), (7.5, 146), (4.5, 150), (3.6, 156), (0, 156)]
    col = kit.lathe([(r / st.u, z / st.u) for r, z in prof], name="pillar", segments=64)
    col.location = st.at(cx, 218, 14)
    kit.assign(col, b)
    # The knife edge's fork at the top.
    kit.assign(st.slab(cx - 9, cy - 6, 18, 12, d=20, back=8, r=3, bevel=1.2, name="fork"), b)
    kit.assign(st.extrude([(cx - 4, cy + 2), (cx + 4, cy + 2), (cx, cy - 4)], d=22, back=20, bevel=0.4, name="edge"),
               M.steel("edge", color=(0.3, 0.32, 0.36), blue=0.3, rough=0.2))
    st.light(shadow=0, strength=0.7, reach=8)
    at_2x(st, 4)
    st.shoot("balance-stand", scales=(1, 2))


def beam():
    w, h = BEAM
    st = Stage(w, h)
    b = brass("beam", age=0.35, brushed=0.5, wear=0.8, axis="X")
    c, y = w / 2, h / 2
    # Swelling to the middle, a ring at each end for a pan's hook, a pointer boss at the pivot.
    pts = [(c - ARM - 5, y - 2), (c - 60, y - 4.2), (c - 14, y - 7), (c + 14, y - 7), (c + 60, y - 4.2), (c + ARM + 5, y - 2),
           (c + ARM + 5, y + 2), (c + 60, y + 3.4), (c + 14, y + 5), (c - 14, y + 5), (c - 60, y + 3.4), (c - ARM - 5, y + 2)]
    kit.assign(st.extrude(pts, d=6, back=0, bevel=1.0, name="beam"), b)
    for x in (c - ARM, c + ARM):
        kit.assign(st.ring(circle(x, y + 1, 5.6, 32), circle(x, y + 1, 2.6, 32), d=6.6, back=0, bevel=0.6, name="eye"), b)
    kit.assign(st.turned([(0, 3.2), (4.2, 2.6), (6.4, 0)], c, y - 1, 6, "boss", segments=48), b)
    st.light()
    st.ink(3)
    st.shoot("balance-beam")


def pan():
    w, h = PAN
    st = Stage(w, h)
    c = w / 2
    b = brass("pan", age=0.4, brushed=0.4, wear=0.7)
    chain = M.steel("chain", color=(0.50, 0.38, 0.20), blue=0.2, rough=0.3, wear=0.3, edge=(0.8, 0.66, 0.4))
    # The hook, three chains (two seen at the rim, one behind), the dish seen edge on.
    kit.assign(st.rod([(c, 2, 3), (c, 8, 3), (c + 3, 11, 3), (c, 14, 3), (c - 3, 11, 3)], 1.2, "hook"), b)
    for x in (c - 37, c + 37, c + 4):
        ch = st.rod([(c, 13, 3), ((c + x) / 2, 55, 3), (x, 98, 3)], 0.9, "chain")
        kit.assign(ch, chain)
        st.no_ink.append(ch)
    dish = st.extrude([(c - 42, 96), (c + 42, 96), (c + 41, 99), (c + 30, 106), (c + 12, 110), (c - 12, 110), (c - 30, 106), (c - 41, 99)], d=10, back=-4, bevel=1.4, name="dish")
    kit.assign(dish, b)
    st.light()
    st.ink(3)
    st.shoot("balance-pan")


def weight():
    w, h = WEIGHT
    st = Stage(w, h, ss=2)
    b = brass("weight", color=(0.70, 0.47, 0.18), age=0.35, brushed=0.6, wear=0.8)
    c = w / 2
    # A turned weight standing on the bottom of its box: a drum, a waist, a knob (a lathe about its upright axis).
    prof = [(0, 0), (14.4, 0), (15, 1.2), (15, 21), (14, 23), (9, 25), (4.6, 27), (4.2, 30), (6.6, 33), (7.2, 36), (5.4, 38.6), (0, 39.4)]
    body = kit.lathe([(r / st.u, z / st.u) for r, z in prof], name="weight", segments=64)
    body.location = st.at(c, h - 1.2, 0)
    kit.assign(body, b)
    st.light()
    st.ink(2.4)
    st.shoot("balance-weight")


if __name__ == "__main__":
    for name, fn in (("balance-weight", weight), ("balance-beam", beam), ("balance-pan", pan), ("balance-stand", stand)):
        if wanted(name):
            fn()
    print("balance:", totals())

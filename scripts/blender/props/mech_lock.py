# The padlock (src/play2/mechanisms/CombinationLock.tsx, Wheels.tsx): a blued-steel shackle
# (its own sprite: the app lifts and swings it when the code is right), and two plates that
# stretch to whatever they hold (the app cuts each into nine: corners kept, edges and middle
# stretched, sprites.tsx NineSlice): the lock's japanned-iron body, riveted, a brass line let
# into its face; and the iron bed the brass drums turn in.
#
#   <bpy python> scripts/blender/props/mech_lock.py        # all; ONLY=lock-shackle for one
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mech_common import M, Stage, kit, rounded_rect, totals, wanted  # noqa: E402

BODY = 120      # the body plate as rendered: corners of 40 points kept, the 40 between stretched
BED = 66        # the drums' bed: corners of 22


def iron(name="iron", **kw):
    """Japanned iron: black lacquer gone a little dull, bare metal on its edges."""
    return M.steel(name, **{"color": (0.030, 0.027, 0.036), "blue": 1.0, "rough": 0.42, "brushed": 0.15, "wear": 0.6, "edge": (0.34, 0.30, 0.30), **kw})


def body():
    st = Stage(BODY, BODY)
    plate = st.slab(1.2, 1.2, BODY - 2.4, BODY - 2.4, d=9, r=19, bevel=2.6, name="body", segments=4)
    kit.assign(plate, iron())
    line = st.ring(rounded_rect(4.6, 4.6, BODY - 9.2, BODY - 9.2, 15.6, 10), rounded_rect(6.0, 6.0, BODY - 12, BODY - 12, 14.2, 10), d=9.35, back=8, bevel=0.3, name="line")
    kit.assign(line, M.brass("line", age=0.5, brushed=0.2))
    st.no_ink.append(line)
    for i, (x, y) in enumerate(((13, 13), (BODY - 13, 13), (13, BODY - 13), (BODY - 13, BODY - 13))):
        st.screw(x, y, 9, r=4.0, turn=(35, -20, 80, 10)[i])
    st.light()
    st.ink(3)
    st.shoot("lock-body")


def bed():
    st = Stage(BED, BED)
    rim = st.ring(rounded_rect(1.0, 1.0, BED - 2, BED - 2, 12.5, 10), rounded_rect(6.0, 6.0, BED - 12, BED - 12, 8.5, 10), d=5, back=-3, bevel=1.1, name="rim")
    kit.assign(rim, iron("bed_rim", rough=0.36))
    floor = st.slab(4, 4, BED - 8, BED - 8, d=0.5, back=-3, r=9, bevel=0, name="floor")
    kit.assign(floor, iron("bed_floor", color=(0.012, 0.010, 0.014), rough=0.6, wear=0.0))
    st.no_ink.append(floor)
    for i, (x, y) in enumerate(((6.5, 6.5), (BED - 6.5, 6.5), (6.5, BED - 6.5), (BED - 6.5, BED - 6.5))):
        s = st.screw(x, y, 4.6, r=2.3, turn=(20, -40, 70, -15)[i])
        st.no_ink.append(s)
    st.light()
    st.ink(3)
    st.shoot("lock-bed")


def shackle():
    # CombinationLock's SHACKLE: 132 wide, legs 8.5 in from each side, 13 thick; 8 points of headroom
    # above the app's old box (the bow's crown), its legs running out of the bottom into the body.
    W, H, TOP = 132, 68, 8
    st = Stage(W, H)
    a, b, r = 8.5, W - 8.5, 6.4
    pts = [(a, H + 10, 4), (a, H - 8, 4)]
    p0, c1, c2, p3 = (a, TOP + 30), (a, TOP - 7), (b, TOP - 7), (b, TOP + 30)
    for i in range(0, 25):
        t = i / 24
        u = 1 - t
        pts.append((u ** 3 * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t ** 3 * p3[0],
                    u ** 3 * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t ** 3 * p3[1], 4))
    pts += [(b, H - 8, 4), (b, H + 10, 4)]
    bow = st.rod(pts, r, "shackle", resolution=16)
    kit.assign(bow, M.steel("shackle", color=(0.085, 0.115, 0.20), blue=0.85, rough=0.26, brushed=0.3, wear=0.5, edge=(0.55, 0.60, 0.70)))
    st.light()
    st.ink(3)
    st.shoot("lock-shackle")


if __name__ == "__main__":
    for name, fn in (("lock-shackle", shackle), ("lock-body", body), ("lock-bed", bed)):
        if wanted(name):
            fn()
    print("lock:", totals())

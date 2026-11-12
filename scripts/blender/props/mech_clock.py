# The wall clock (src/play2/mechanisms/ClockHands.tsx), in layers the app stacks and turns:
#   clock-dial        the brass bezel, the enamel dial with its minute track, the hatch shut
#   clock-hatch       the same hatch let down on the dark inside (laid over the dial when it opens)
#   clock-hand-hour / clock-hand-minute   blued-steel hands pointing up, turned by the app about their arbor
#   clock-glass       over the hands: the brass boss they turn on and the glass's highlight
# The numerals stay the app's (each mode's own face).
#
#   <bpy python> scripts/blender/props/mech_clock.py        # all; ONLY=clock-glass for one
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mech_common import M, Stage, circle, kit, totals, wanted  # noqa: E402
from mech_drawer import brass  # noqa: E402

D = 196                     # ClockHands' D
R, BEZEL = D / 2, 9
r = R - BEZEL               # the dial's radius
HW, HH = 21, 22             # the hatch: half its width, its height
HY = R + r * 0.2            # its top
HATCH_BOX = (72, 112, 52, 40)   # the part of the dial the open hatch replaces (points)
INKY = (0.022, 0.013, 0.016)


def arch(grow=0.0):
    """The hatch's outline: a low arch under the centre."""
    x0, x1, y0, y1 = R - HW - grow, R + HW + grow, HY - grow, HY + HH + grow
    pts = [(x0, y1)]
    for i in range(7):
        a = math.radians(180 + 90 * i / 6)
        pts.append((x0 + 8 + 8 * math.cos(a), y0 + 8 + 8 * math.sin(a)))
    for i in range(7):
        a = math.radians(270 + 90 * i / 6)
        pts.append((x1 - 8 + 8 * math.cos(a), y0 + 8 + 8 * math.sin(a)))
    pts.append((x1, y1))
    return pts


def dial(panel):
    st = Stage(D, D)
    bz = st.turned([(r - 1.5, 0), (r - 1.2, 3.0), (r + 0.4, 4.4), (r + 2.0, 4.6), (r + 3.0, 6.6), (r + 5.0, 7.6), (r + 6.8, 6.8), (R - 1.4, 3.6), (R - 1.2, 0)],
                   R, R, 0, "bezel", segments=160)
    kit.assign(bz, brass("bezel", age=0.45, brushed=0.5, wear=0.7))
    # Cream enamel. The studio keeps matte things dim (so brass can shine): the dial gives a little of its own
    # light back, or it would read as tan card.
    enamel = M.lit(M.enamel("enamel", (0.95, 0.86, 0.66), gloss=0.35), (1.0, 0.90, 0.70), 0.38)
    face = st.extrude(circle(R, R, r - 0.8, 96), d=1.0, back=-2, bevel=0, name="dial", holes=[arch(0.5)])
    kit.assign(face, enamel)
    st.no_ink.append(face)
    ink = M.ink("track", INKY)
    for i in range(60):
        a = math.radians(i * 6)
        five = i % 5 == 0
        ln, wd = (6.0, 1.7) if five else (3.0, 0.8)
        rm = r - 3 - ln / 2
        t = kit.box((st.L(wd), st.L(0.3), st.L(ln)), st.at(R + math.sin(a) * rm, R - math.cos(a) * rm, 1.05), "tick", bevel_width=0)
        t.rotation_euler = (0, a, 0)
        kit.assign(t, ink)
        st.no_ink.append(t)
    ringline = st.ring(circle(R, R, r - 10.7, 96), circle(R, R, r - 11.3, 96), d=1.12, back=0.9, bevel=0, name="ringline")
    kit.assign(ringline, M.ink("ringline", (0.20, 0.15, 0.13)))
    st.no_ink.append(ringline)
    pin_mat = brass("pin", age=0.2, brushed=0.1)
    if panel:
        # Open: the dark inside, and the little door let down on its hinge under it.
        well = st.extrude(arch(1.5), d=-6, back=-8, bevel=0, name="well")
        kit.assign(well, M.rubber("well", (0.010, 0.007, 0.006)))
        st.no_ink.append(well)
        flap = st.extrude([(R - HW, HY + HH + 0.4), (R + HW, HY + HH + 0.4), (R + HW - 4.5, HY + HH + 9.5), (R - HW + 4.5, HY + HH + 9.5)], d=3.2, back=1.6, bevel=0.5, name="flap")
        kit.assign(flap, M.lit(M.enamel("flap", (0.80, 0.70, 0.50), gloss=0.3), (1.0, 0.90, 0.70), 0.22))
        pin = st.turned([(0, 1.6), (1.2, 1.3), (1.9, 0)], R, HY + HH + 5.4, 3.2, "pin", segments=24)
    else:
        door = st.extrude(arch(0.0), d=1.0, back=-1, bevel=0.35, name="hatch")
        kit.assign(door, enamel)
        pin = st.turned([(0, 1.7), (1.3, 1.4), (2.1, 0)], R, HY + 7, 1.0, "pin", segments=24)
    kit.assign(pin, pin_mat)
    st.no_ink.append(pin)
    st.light()
    st.ink(3)
    if panel:
        st.shoot("clock-hatch", crop=HATCH_BOX)
    else:
        st.shoot("clock-dial")


def hand(hour):
    # Its box: 26 wide, the arbor 13 in and (length + 3) down; a tail of 13 past the arbor.
    length = R * (0.5 if hour else 0.74)
    w, h = 26, math.ceil(length + 3 + 13 + 6)
    px, py = 13, length + 3
    st = Stage(w, h, ss=2)
    tip = py - length
    if hour:
        half = [(0.0, 0.0), (2.4, 0.045), (5.2, 0.12), (6.9, 0.20), (7.2, 0.26), (6.2, 0.33), (3.6, 0.39), (2.0, 0.43), (2.0, 0.60), (2.5, 0.90), (4.6, 0.95), (5.0, 1.0)]
    else:
        half = [(0.0, 0.0), (1.0, 0.03), (1.9, 0.80), (2.4, 0.93), (4.2, 0.96), (4.6, 1.0)]
    right = [(px + dx, tip + t * length) for dx, t in half]
    hub = 5.0 if hour else 4.6
    tail = [(px + hub, py + 2.0), (px + 3.4, py + 5.0), (px + 3.0, py + 13), (px, py + 13.6)]
    outline = right + tail
    pts = outline + [(2 * px - x, y) for x, y in reversed(outline[1:-1])]
    blade = st.extrude(pts, d=2.6 if hour else 3.6, back=1.6 if hour else 2.6, bevel=0.35, name="hand")
    kit.assign(blade, M.steel("blued", color=(0.055, 0.095, 0.26), blue=1.0, rough=0.24, brushed=0.1, wear=0.55, edge=(0.42, 0.52, 0.78)))
    st.light(shadow=0.0, reach=3.0, strength=0.5)
    st.ink(2)
    st.shoot("clock-hand-hour" if hour else "clock-hand-minute")
    print("  arbor at", (px, round(py, 2)), "in", (w, h))


def glass():
    st = Stage(D, D, ss=1, glass=True, samples=128)
    g = st.turned([(0, 9.0), (30, 8.6), (55, 7.4), (74, 5.4), (r - 4, 3.2), (r - 2.2, 1.6), (r - 2.2, 0.6), (0, 0.6)], R, R, 5.0, "glass", segments=128)
    kit.assign(g, M.glass("glass", tint=(1.0, 0.98, 0.94), haze=0.02, rim=0.35))
    st.no_ink.append(g)
    boss = st.turned([(0, 4.6), (2.2, 4.4), (4.6, 3.4), (5.8, 2.0), (6.4, 0)], R, R, 4.2, "boss", segments=48)
    kit.assign(boss, brass("boss", age=0.3, brushed=0.3))
    st.light()
    st.ink(3)
    st.shoot("clock-glass", glass=True)


if __name__ == "__main__":
    for name, fn in (("clock-dial", lambda: dial(False)), ("clock-hatch", lambda: dial(True)), ("clock-hand-hour", lambda: hand(True)),
                     ("clock-hand-minute", lambda: hand(False)), ("clock-glass", glass)):
        if wanted(name):
            fn()
    print("clock:", totals())

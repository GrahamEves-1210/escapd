# The safe dial (src/play2/mechanisms/SafeDial.tsx), in layers the app stacks and turns:
#   safe-door        a blackened-steel door, riveted: the dial's brass collar with its index mark,
#                    three tell-tale windows, the handle's boss
#   safe-dial        the brass dial, 0 to 39 engraved clockwise, a tick each, and its knurled knob;
#                    lit square on, because the app turns it
#   safe-dial-light  the studio's light on that dial, still, laid over it as it turns
#   safe-handle      the brass lever, pointing right, turned by the app about its hub
#   safe-telltale    a small brass flag that drops into a window as a number registers
#
#   <bpy python> scripts/blender/props/gadget_safe.py        # all; ONLY=safe-dial for one
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gadget_common import M, Stage, brass, circle, front_light, grey_metal, iron, kit, light_layer, rounded_rect, text, totals, wanted  # noqa: E402
import numpy as np  # noqa: E402

W, H = 330, 250                 # SafeDial's DOOR
DIAL = (128, 130, 88)           # the dial's centre on the door, half its box
N = 40                          # numbers round the dial
HUB = (260, 158)                # the handle's hub
FLAGS = ((240, 62), (260, 62), (280, 62))   # the tell-tale windows' centres
FLAG = (12, 18)                 # a window
INKY = (0.022, 0.013, 0.016)


def door():
    st = Stage(W, H)
    plate = st.slab(1.5, 1.5, W - 3, H - 3, d=8, r=16, bevel=2.6, name="door", segments=4)
    kit.assign(plate, iron("door", color=(0.020, 0.021, 0.031), rough=0.40, brushed=0.3))
    frame = st.ring(rounded_rect(7, 7, W - 14, H - 14, 12, 10), rounded_rect(19, 19, W - 38, H - 38, 5, 10), d=11, back=7, bevel=1.4, name="frame")
    kit.assign(frame, iron("frame", color=(0.024, 0.024, 0.034), rough=0.36, wear=0.8))
    # Rivets round the frame.
    rv = iron("rivet", rough=0.34, wear=1.0, edge=(0.46, 0.42, 0.40))
    xs = [13 + i * (W - 26) / 8 for i in range(9)]
    ys = [13 + i * (H - 26) / 6 for i in range(7)]
    for x in xs:
        for y in (13, H - 13):
            kit.assign(st.turned([(0, 2.6), (2.0, 2.3), (3.4, 1.2), (3.9, 0)], x, y, 11, "rivet", segments=24), rv)
    for y in ys[1:-1]:
        for x in (13, W - 13):
            kit.assign(st.turned([(0, 2.6), (2.0, 2.3), (3.4, 1.2), (3.9, 0)], x, y, 11, "rivet", segments=24), rv)
    b = brass("collar", age=0.5, brushed=0.5)
    cx, cy, r = DIAL
    # The dial's collar: a brass ring round it, and the dark it turns in.
    well = st.extrude(circle(cx, cy, r + 3, 96), d=8.3, back=7, bevel=0, name="well")
    kit.assign(well, iron("well", color=(0.010, 0.008, 0.012), rough=0.7, wear=0.0))
    st.no_ink.append(well)
    collar = st.turned([(r + 1.5, 0), (r + 2.2, 3.4), (r + 4.4, 4.6), (r + 8.4, 4.2), (r + 10.4, 2.6), (r + 11, 0)], cx, cy, 8, "collar", segments=160)
    kit.assign(collar, b)
    # The index: a steel arrowhead on the collar at twelve, pointing down at the number that counts.
    tip, base, half = cy - r - 0.5, cy - r - 13.5, 6.2
    mark = st.extrude([(cx - half, base), (cx + half, base), (cx, tip)], d=13.6, back=11, bevel=0.5, name="index")
    kit.assign(mark, M.enamel("index", (0.50, 0.035, 0.03), gloss=0.5))
    # Tell-tale windows: three little slots in a brass plate.
    fw, fh = FLAG
    px0, px1 = FLAGS[0][0] - fw / 2 - 7, FLAGS[-1][0] + fw / 2 + 7
    py0, py1 = FLAGS[0][1] - fh / 2 - 6, FLAGS[0][1] + fh / 2 + 6
    holes = [rounded_rect(x - fw / 2, y - fh / 2, fw, fh, 2.5, 4) for x, y in FLAGS]
    plate2 = st.extrude(rounded_rect(px0, py0, px1 - px0, py1 - py0, 6, 8), d=10.6, back=8, bevel=0.8, name="plate", holes=holes)
    kit.assign(plate2, brass("plate", color=(0.70, 0.48, 0.19), age=0.35, brushed=0.7, axis="X"))
    st.plain.append(plate2)
    floor = st.slab(px0 + 2, py0 + 2, px1 - px0 - 4, py1 - py0 - 4, d=8.4, back=8, r=4, bevel=0, name="floor")
    kit.assign(floor, iron("floor", color=(0.008, 0.006, 0.010), rough=0.8, wear=0.0))
    st.no_ink.append(floor)
    for x in (px0 + 3.6, px1 - 3.6):
        st.no_ink.append(st.screw(x, (py0 + py1) / 2, 10.6, r=1.5, turn=x * 5))
    # The handle's boss.
    hx, hy = HUB
    boss = st.turned([(8, 3.4), (20, 3.4), (23, 2.4), (24.5, 0)], hx, hy, 8, "boss", segments=96)
    kit.assign(boss, b)
    st.light()
    st.ink(4)
    st.shoot("safe-door", scales=(1, 2))


def dial_body(st, smooth=False):
    c = DIAL[2]
    R = c - 2.2
    kn = 43.0
    disp = None if smooth else (lambda a, z, r: -(1.5 / st.u) * (0.5 - 0.5 * np.cos(a * 44)) ** 2 * ((r > (kn - 1.2) / st.u) & (z > 8.5 / st.u) & (z < 22.5 / st.u)))
    prof = [(R, 0), (R, 2.6), (R - 1.6, 4.6), (62, 7.4), (59.5, 7.6), (58.6, 6.4), (56.5, 6.4), (55.4, 7.8), (kn + 3.5, 8.0), (kn, 8.6),
            (kn, 22.0), (kn - 1.6, 23.6), (kn - 6, 24.2), (kn - 8, 23.2), (kn - 9.5, 23.0), (15, 20.4), (9, 21.6), (0, 22.0)]
    body = st.turned(prof, c, c, 0, "dial", segments=352, max_len=None if smooth else 1.2 / st.u, displace=disp)
    return body, R


def dial():
    S = DIAL[2] * 2
    st = Stage(S, S)
    c = S / 2
    body, R = dial_body(st)
    kit.assign(body, brass("dial", color=(0.70, 0.47, 0.18), age=0.3, brushed=0.6, wear=0.5, axis="Y"))
    st.plain.append(body)
    ink = M.ink("engraved", INKY)
    for i in range(N):
        a = math.radians(i * 360 / N)
        five = i % 5 == 0
        ln, wd = (9.0, 1.9) if five else (5.6, 1.1)
        rm = R - 3.4 - ln / 2
        # The face falls away toward the rim: each mark lies on it.
        d = 4.6 + (R - 1.6 - rm) / (R - 1.6 - 62) * 2.8 + 0.25
        t = kit.box((st.L(wd), st.L(0.5), st.L(ln)), st.at(c + math.sin(a) * rm, c - math.cos(a) * rm, d), "tick", bevel_width=0)
        t.rotation_euler = (0, a, 0)
        kit.assign(t, ink)
        st.no_ink.append(t)
        if five:
            rn = 68.0
            n = text(st, str(i), c + math.sin(a) * rn, c - math.cos(a) * rn, 7.3, 13.5, turn=math.degrees(a), depth=0.6)
            kit.assign(n, ink)
            st.no_ink.append(n)
    front_light(st, ambient=0.6, strength=0.5)
    st.ink(3)
    st.shoot("safe-dial")


def dial_light():
    S = DIAL[2] * 2
    st = Stage(S, S, samples=48)
    body, _ = dial_body(st, smooth=True)
    kit.assign(body, grey_metal())
    st.light()
    kit.no_outline()
    light_layer(st, "safe-dial-light", gain=(1.0, 0.9), scales=(1, 2))


def handle():
    S = 136
    st = Stage(S, S)
    c = S / 2
    b = brass("lever", age=0.4, brushed=0.4, wear=0.8)
    hub = st.turned([(18.5, 0), (18.5, 5), (16.5, 7.4), (9, 8.6), (7.5, 10.6), (0, 11)], c, c, 0, "hub", segments=96)
    kit.assign(hub, b)
    # The lever: a bar swelling to a ball at its end.
    bar = st.rod([(c + 6, c, 9.0), (c + 22, c, 9.8), (c + 38, c, 9.8)], 5.6, "bar")
    kit.assign(bar, b)
    end = st.ball(c + 42, c, 9.8, 9.6, "grip", squash=(1.12, 1, 1))
    kit.assign(end, b)
    st.light()
    st.ink(3)
    st.shoot("safe-handle")


def telltale():
    fw, fh = FLAG
    st = Stage(fw, fh, ss=2)
    flag = st.slab(0.9, 0.9, fw - 1.8, fh - 1.8, d=2, r=2.0, bevel=0.5, name="flag")
    kit.assign(flag, brass("flag", color=(0.78, 0.55, 0.22), age=0.15, brushed=0.6, axis="X"))
    dot = st.turned([(0, 0.7), (1.3, 0.5), (1.9, 0)], fw / 2, fh / 2, 2, "dot", segments=24)
    kit.assign(dot, M.enamel("dot", (0.50, 0.035, 0.03), gloss=0.5))
    st.no_ink.append(dot)
    st.light()
    st.ink(2)
    st.shoot("safe-telltale")


if __name__ == "__main__":
    for name, fn in (("safe-telltale", telltale), ("safe-handle", handle), ("safe-dial", dial), ("safe-dial-light", dial_light), ("safe-door", door)):
        if wanted(name):
            fn()
    print("safe:", totals())

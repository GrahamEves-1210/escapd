# The brass things a player finds: a skeleton key, a coin, a ring, a pocket
# watch, the cipher disc and the red gel in its ring. One brass for all of them
# (the magnifier's and the flashlight's), aged and worn bright on the edges.
#
#   <bpy python> scripts/blender/props/items_all.py key coin ...   (items_all.py renders and exports)
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from items_common import (WAXRED, Item, M, cyl, fillet, kit, paint, place, plate, sphere, star, text, torus, tube, turned)  # noqa: E402


def _brass(name="brass", **kw):
    return M.brass(name, **{"age": 0.45, "brushed": 0.35, "wear": 0.9, **kw})


def key():
    """A skeleton key: a fat ring of a bow, two collars, a square bit with worn teeth."""
    brass = _brass("key")
    z = 0.15
    bow = paint(torus(0.37, 0.15, (-0.70, 0, z), "bow", scale=(1, 1, 0.85)), brass)
    shaft = turned([(0, -0.36), (0.11, -0.36), (0.11, -0.31), (0.185, -0.30), (0.20, -0.25), (0.185, -0.20), (0.125, -0.19), (0.125, -0.12), (0.17, -0.11), (0.17, -0.05), (0.125, -0.04),
                    (0.125, 0.98), (0.10, 1.02), (0, 1.02)], brass, axis="X", location=(0, 0, z), segments=48, name="shaft")
    # The bit: a plate hanging off the shaft's end, two wards cut in it, its corners rounded by a century of locks.
    out = [(0.44, 0.02), (0.44, -0.62), (0.58, -0.62), (0.58, -0.40), (0.69, -0.40), (0.69, -0.62), (0.98, -0.62), (0.98, -0.30), (0.86, -0.30), (0.86, 0.02)]
    bit = paint(plate(fillet(out, 0.035), 0.15, z=z - 0.075, round_=0.04, name="bit"), brass)
    return Item([bow, shaft, bit], roll=38)


def coin():
    """A gold piece: a raised rim, a ring of beads, a star struck in it, a milled edge."""
    gold = M.brass("gold", color=(0.84, 0.56, 0.18), age=0.2, brushed=0.15, wear=0.9, rough=0.36)
    R, T = 0.95, 0.20
    body = kit.lathe([(0, 0), (R - 0.03, 0), (R, 0.03), (R, T - 0.03), (R - 0.03, T), (R - 0.15, T), (R - 0.19, T - 0.045), (0, T - 0.045)], segments=160, max_len=0.03, name="coin",
                     displace=lambda a, z, r: kit.flutes(40, 0.022)(a, z, r) * ((r > R - 0.01) & (z > 0.02) & (z < T - 0.02)))
    kit.bevel(body, 0.008)
    paint(body, gold)
    face = T - 0.045
    beads = [paint(sphere(0.055, (0.63 * math.cos(a), 0.63 * math.sin(a), face), (1, 1, 0.7), "bead"), gold) for a in [2 * math.pi * i / 14 for i in range(14)]]
    st = paint(plate(fillet(star(0.47, 0.215), 0.02), 0.08, z=face - 0.01, round_=0.035, name="star"), gold)
    # Turned a little to the lamp: its face catches the edge of the light (square to it, it burns out white; turned away, it's brown).
    return Item([body, st] + beads, lean=40, yaw=-6, roll=-12, plain=beads)


def ring():
    """A gold ring standing on its band, a cut stone in a claw setting."""
    gold = M.brass("ring_gold", color=(0.80, 0.52, 0.16), age=0.2, brushed=0.1, wear=0.8, rough=0.22)
    R = 0.60
    band = paint(torus(R, 0.105, (0, 0, 0), "band", scale=(1, 1, 1.5)), gold)
    top = R + 0.06
    collet = turned([(0, 0), (0.12, 0), (0.16, 0.05), (0.26, 0.20), (0.22, 0.22), (0, 0.16)], gold, axis="Y", location=(0, top, 0), segments=32, name="collet")
    # The stone: a brilliant cut, eight-sided so its facets flash.
    stone = kit.lathe([(0, 0.06), (0.30, 0.30), (0.33, 0.34), (0.19, 0.46), (0, 0.46)], segments=8, name="stone", smooth=False)
    stone.rotation_euler = (-math.pi / 2, 0, 0)
    kit.apply_transforms(stone)
    stone.location = (0, top, 0)
    paint(stone, M.lit(M.gel("stone", color=(0.45, 0.80, 0.95), rough=0.02, density=0.75), (0.35, 0.75, 1.0), 0.35))
    claws = []
    for i in range(4):
        a = math.pi / 4 + i * math.pi / 2
        x, zc = 0.27 * math.cos(a), 0.27 * math.sin(a)
        claws.append(paint(tube([(x * 0.7, top + 0.12, zc * 0.7), (x * 1.08, top + 0.28, zc * 1.08), (x * 1.0, top + 0.37, zc * 1.0)], 0.035, "claw", smooth=False), gold))
    return Item([band, collet, stone] + claws, lean=64, yaw=34, tip=-8, plain=claws, no_line=[])


def watch():
    """A pocket watch: a brass case, an enamel dial, blued hands at ten past ten, the crown and its bow."""
    brass = _brass("watch")
    R = 0.80
    case = kit.lathe([(0, 0), (R - 0.10, 0), (R - 0.02, 0.05), (R, 0.13), (R - 0.02, 0.21), (R - 0.08, 0.25), (R - 0.14, 0.24), (R - 0.16, 0.19), (0, 0.19)], segments=96, name="case")
    kit.bevel(case, 0.01)
    paint(case, brass)
    dial = paint(cyl(R - 0.165, 0.02, (0, 0, 0.195), name="dial", segments=64, bevel=0.004), M.ceramic("dial", color=(0.88, 0.83, 0.70), glaze=0.6, speckle=0.0))
    dark = M.ink("numerals", (0.05, 0.035, 0.045))
    ticks = []
    for i in range(12):
        a = math.pi / 2 - i * math.pi / 6
        big = i % 3 == 0
        t = kit.box((0.05 if big else 0.032, 0.15 if big else 0.09, 0.006), (0, 0, 0), "tick", bevel_width=0)
        r = R - 0.165 - 0.05 - (0.075 if big else 0.045)
        place(t, (r * math.cos(a), r * math.sin(a), 0.208), (0, 0, math.degrees(a) - 90))
        ticks.append(paint(t, dark))
    blue = M.steel("hands", blue=1.0, rough=0.3, wear=0.2)
    hands = []
    for length, width, hour in ((0.34, 0.075, 10.17), (0.50, 0.055, 2.0)):
        h = plate(fillet([(-width / 2, -0.07), (width / 2, -0.07), (width * 0.3, length * 0.8), (0, length), (-width * 0.3, length * 0.8)], 0.01), 0.018, z=0.212 + (0.02 if length > 0.4 else 0), round_=0.006, name="hand")
        place(h, rotation=(0, 0, -hour * 30))
        hands.append(paint(h, blue))
    pin = paint(cyl(0.05, 0.03, (0, 0, 0.245), name="pin", segments=24, bevel=0.008), brass)
    # The pendant: a neck, a knurled crown, the bow it hangs by.
    neck = turned([(0, 0), (0.10, 0), (0.10, 0.10), (0.07, 0.12), (0.07, 0.16), (0.14, 0.17), (0.14, 0.27), (0.07, 0.29), (0, 0.29)], brass, axis="Y", location=(0, R - 0.03, 0.125),
                  segments=48, max_len=0.02, name="crown", displace=lambda a, z, r: kit.flutes(16, 0.02)(a, z, r) * ((z > 0.175) & (z < 0.265) & (r > 0.13)))
    bow = paint(torus(0.20, 0.045, (0, R + 0.38, 0.125), "bow"), brass)
    return Item([case, dial, pin, neck, bow] + ticks + hands, roll=-10, lean=44, no_line=ticks, plain=hands)


def wheel():
    """The cipher disc: a brass wheel with the plain alphabet round its rim, an enamel disc turning in it with
    the cipher alphabet in ink, a knurled boss to turn it by, an index at twelve."""
    brass = _brass("wheel", brushed=0.5)
    R = 1.0
    rim = kit.lathe([(0, 0), (R - 0.04, 0), (R, 0.04), (R, 0.13), (R - 0.03, 0.16), (R - 0.07, 0.16), (R - 0.09, 0.13), (0.70, 0.13), (0, 0.13)], segments=128, name="wheel")
    kit.bevel(rim, 0.008)
    paint(rim, brass)
    disc = kit.lathe([(0, 0.13), (0.685, 0.13), (0.685, 0.175), (0.665, 0.195), (0, 0.195)], segments=96, name="disc")
    kit.bevel(disc, 0.006)
    paint(disc, M.enamel("disc", color=(0.86, 0.84, 0.78), gloss=0.5))
    boss = kit.lathe([(0, 0.19), (0.25, 0.19), (0.27, 0.21), (0.27, 0.33), (0.25, 0.355), (0.12, 0.36), (0.10, 0.34), (0, 0.34)], segments=120, max_len=0.02, name="boss",
                     displace=lambda a, z, r: kit.flutes(20, 0.025)(a, z, r) * ((z > 0.215) & (z < 0.325) & (r > 0.26)))
    paint(boss, brass)
    dark = M.ink("engraved", (0.11, 0.06, 0.03))
    pen = M.ink("cipher_ink", (0.07, 0.045, 0.06))
    font = "playfair-display/700Bold/PlayfairDisplay_700Bold.ttf"
    letters = []
    for i, ch in enumerate("ABCDEFGHIJKLMNOPQRSTUVWXYZ"):
        a = math.pi / 2 - 2 * math.pi * i / 26
        letters.append(paint(text(ch, font, 0.155, (0.815 * math.cos(a), 0.815 * math.sin(a), 0.13), 0.003, rotation=a - math.pi / 2), dark))
        ch2 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[(i + 5) % 26]
        letters.append(paint(text(ch2, font, 0.125, (0.565 * math.cos(a), 0.565 * math.sin(a), 0.195), 0.003, rotation=a - math.pi / 2), pen))
    # Division lines between the letters on the rim, and a ring ruling off the inner alphabet.
    marks = []
    for i in range(26):
        a = math.pi / 2 - 2 * math.pi * (i + 0.5) / 26
        marks.append(paint(tube([(0.72 * math.cos(a), 0.72 * math.sin(a), 0.131), (0.90 * math.cos(a), 0.90 * math.sin(a), 0.131)], 0.007, "div", flat=0.4, smooth=False), dark))
    marks.append(paint(tube([(0.455 * math.cos(t), 0.455 * math.sin(t), 0.196) for t in [2 * math.pi * k / 48 for k in range(48)]], 0.008, "ring", cyclic=True, flat=0.4), pen))
    # The index: a bracket over the rim at twelve, a red arrowhead pointing in.
    idx = paint(plate(fillet([(-0.13, 0.80), (0.13, 0.80), (0.16, 1.07), (-0.16, 1.07)], 0.03), 0.07, z=0.15, round_=0.02, name="index"), _brass("index", age=0.2))
    arrow = paint(plate(fillet([(-0.085, 1.0), (0.085, 1.0), (0.0, 0.84)], 0.015), 0.03, z=0.22, round_=0.012, name="arrow"), M.enamel("arrow", color=WAXRED, gloss=0.8))
    return Item([rim, disc, boss, idx, arrow] + letters + marks, lean=46, roll=-8, no_line=letters + marks, plain=[boss])


def lens():
    """The red lens: a round gel of red film in a brass ring, a ring-pull to carry it by."""
    brass = _brass("lens_ring", age=0.35)
    R = 0.74
    ring_ = paint(torus(R, 0.115, (0, 0, 0.1), "ring", scale=(1, 1, 0.9)), brass)
    gel = kit.lathe([(0, 0.07), (R - 0.02, 0.07), (R - 0.02, 0.10), (R * 0.6, 0.125), (0, 0.135)], segments=96, name="gel")
    red = M.lit(M.enamel("gel", color=(0.55, 0.01, 0.02), gloss=1.0), (1.0, 0.03, 0.03), 0.16)
    paint(gel, red)
    # The pull: a lug on the ring's lower right and a loop through it.
    a = math.radians(-42)
    ux, uy = math.cos(a), math.sin(a)
    lug = paint(place(cyl(0.085, 0.2, (0, 0, 0), "X", "lug", segments=24, bevel=0.02), ((R + 0.16) * ux, (R + 0.16) * uy, 0.1), (0, 0, math.degrees(a))), brass)
    loop = paint(torus(0.19, 0.05, ((R + 0.42) * ux, (R + 0.42) * uy, 0.1), "pull"), brass)
    return Item([ring_, gel, lug, loop], lean=46, no_line=[], plain=[])

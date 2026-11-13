# The gadgets' held things: a bar of soap and a lump of candle wax with a key pressed into them, the
# pocket balance, one of its brass weights (the symbol is in its name: the tray's picture is the weight),
# a music box and a typewriter ribbon. Posed, lit, lined and exported exactly as the other items are
# (items_common.py; items_all.py renders and exports them).
#
#   <bpy python> scripts/blender/props/items_all.py soap wax balance weight music-box ribbon
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from items_common import (WAXRED, Item, M, bpy, circle, cyl, fillet, kit, paint, place, plate, rounded, sphere, torus, tube, turned)  # noqa: E402


def _brass(name, **kw):
    return M.brass(name, **{"age": 0.4, "brushed": 0.4, "wear": 0.8, **kw})


def _key_outline(long=1.25, cx=0.0, cy=0.0):
    """A flat key's outline (bow left, blade right, five cuts along its top edge), `long` units long, centred."""
    k = long / 120.0
    pts = [(34.9, 14), (40, 14), (40, 10), (44, 10), (44, 13)]
    for x, d in zip((56, 68, 80, 92, 104), (4.4, 2.2, 6.6, 2.2, 4.4)):
        pts += [(x - 1.2 - 0.55 * d, 13), (x - 1.2, 13 + d), (x + 1.2, 13 + d), (x + 1.2 + 0.55 * d, 13)]
    pts += [(112, 13), (118.4, 18.6), (118.4, 22), (113.5, 27), (44, 27), (44, 30), (40, 30), (40, 26), (34.9, 26)]
    a0, a1 = math.asin(6 / 17), 2 * math.pi - math.asin(6 / 17)
    for i in range(1, 28):
        a = a0 + (a1 - a0) * i / 28
        pts.append((19 + 17 * math.cos(a), 20 + 17 * math.sin(a)))
    # Mirrored, as a pressing is (bow right), y up the page.
    return [(cx + (60 - x) * k, cy + (20 - y) * k) for x, y in pts]


def _pressed(body, top, depth=0.07, long=1.25, cx=0.0, cy=0.0):
    """Press a key into the top of `body` (its top face at height `top`)."""
    cutter = plate(_key_outline(long, cx, cy), depth + 0.3, z=top - depth, round_=0.0, name="press")
    m = body.modifiers.new("press", "BOOLEAN")
    m.operation, m.object, m.solver = "DIFFERENCE", cutter, "EXACT"
    with bpy.context.temp_override(object=body, active_object=body):
        bpy.ops.object.modifier_apply(modifier="press")
    bpy.data.objects.remove(cutter)
    kit.shade(body, 35)
    return body


def soap():
    """A bar of soap, a key pressed into it."""
    T = 0.46
    bar = plate(rounded(1.9, 1.22, 0.3, n=10), T, round_=0.13, name="soap", resolution=5)
    _pressed(bar, T)
    paint(bar, M.wax("soap", (0.80, 0.74, 0.60), translucency=0.0, gloss=0.3))
    return Item([bar], roll=-14, lean=46)


def wax():
    """A lump of candle wax, flattened under a thumb, a key pressed into it."""
    T = 0.42
    blob = [(0.98 * math.cos(a) * (1 + 0.07 * math.sin(3 * a + 0.6) + 0.04 * math.sin(5 * a)), 0.70 * math.sin(a) * (1 + 0.08 * math.sin(2 * a + 1.1) + 0.05 * math.sin(7 * a)))
            for a in [2 * math.pi * i / 72 for i in range(72)]]
    lump = plate(blob, T, round_=0.17, name="wax", resolution=5)
    _pressed(lump, T, long=1.2)
    paint(lump, M.wax("candle", (0.82, 0.62, 0.30), translucency=0.0, gloss=0.5))
    return Item([lump], roll=12, lean=46)


def weight():
    """A brass weight: a drum, a waist, a knob to lift it by."""
    prof = [(0, 0), (0.72, 0), (0.76, 0.06), (0.76, 1.02), (0.70, 1.13), (0.46, 1.24), (0.24, 1.33), (0.21, 1.47), (0.33, 1.62), (0.36, 1.76), (0.27, 1.90), (0, 1.94)]
    body = turned(prof, _brass("weight", color=(0.70, 0.47, 0.18), brushed=0.6), segments=72, name="weight", bevel=0.012)
    return Item([body], lean=10, tip=-6)


def balance():
    """A pocket balance: a brass beam on a pillar, a pan hung from each end, a walnut foot."""
    b = _brass("balance", brushed=0.3)
    wood = M.walnut("foot", axis="X", figure=0.7, gloss=0.5, wear=0.6)
    foot = paint(kit.box((1.5, 0.62, 0.14), (0, 0, 0.07), "foot", bevel_width=0.03), wood)
    pillar = turned([(0, 0), (0.17, 0), (0.17, 0.05), (0.09, 0.10), (0.06, 0.3), (0.05, 1.2), (0.09, 1.26), (0.09, 1.32), (0.04, 1.40), (0, 1.42)], b, location=(0, 0, 0.14), segments=40, name="pillar")
    zb = 1.52
    beam = paint(kit.box((2.0, 0.09, 0.12), (0, 0, zb), "beam", bevel_width=0.03), b)
    boss = paint(sphere(0.085, (0, 0, zb), name="boss"), b)
    parts = [foot, pillar, beam, boss]
    plain = []
    for sx, dz in ((-1, -0.06), (1, 0.06)):
        x = sx * 0.93
        # (The beam leans a touch: a balance at rest is never dead level.)
        zp = 0.62 + dz
        pan = turned([(0, 0), (0.32, 0), (0.44, 0.05), (0.47, 0.09), (0.42, 0.09), (0.30, 0.04), (0, 0.04)], b, location=(x, 0, zp), segments=48, name="pan", bevel=0.004)
        parts.append(pan)
        for a in (math.radians(200), math.radians(340), math.radians(90)):
            ch = paint(tube([(x, 0, zb - 0.02 + dz * 0.9), (x + 0.42 * math.cos(a), 0.42 * math.sin(a), zp + 0.08)], 0.022, "chain", smooth=False), b)
            parts.append(ch)
            plain.append(ch)
    beam.rotation_euler = (0, math.radians(3.6), 0)
    return Item(parts, lean=8, yaw=-14, plain=plain)


def music_box():
    """A music box: a small walnut box on brass feet, a crank at its side, a brass lyre let into its lid."""
    W, D, H = 1.5, 1.05, 0.62
    wood = M.walnut("music", axis="X", figure=0.75, gloss=0.6, wear=0.5)
    b = _brass("music_brass", brushed=0.3)
    body = paint(kit.box((W, D, H), (0, 0, 0.08 + H / 2), "body", bevel_width=0.04), wood)
    lid = paint(kit.box((W + 0.06, D + 0.06, 0.16), (0, 0, 0.08 + H + 0.08), "lid", bevel_width=0.05, segments=4), wood)
    feet = [paint(sphere(0.09, (sx * (W / 2 - 0.12), sy * (D / 2 - 0.12), 0.07), (1, 1, 0.8), "foot"), b) for sx in (-1, 1) for sy in (-1, 1)]
    top = 0.08 + H + 0.16
    star = [(0.30 * (1 if i % 2 == 0 else 0.42) * math.cos(math.pi / 2 + math.pi * i / 5), 0.30 * (1 if i % 2 == 0 else 0.42) * math.sin(math.pi / 2 + math.pi * i / 5)) for i in range(10)]
    # (A flat face square to the eye mirrors the dark of the room: the inlay is satin, so it stays gold.)
    inlay = paint(plate(fillet(star, 0.012), 0.03, z=top - 0.006, round_=0.012, name="inlay"), _brass("inlay", color=(0.86, 0.60, 0.24), rough=0.6, brushed=0.9, age=0.1))
    # The crank: out of the right-hand end, cranked down, a little turned knob.
    x0, zc = W / 2, 0.08 + H * 0.55
    crank = paint(tube([(x0, 0, zc), (x0 + 0.22, 0, zc), (x0 + 0.22, 0, zc - 0.30), (x0 + 0.44, 0, zc - 0.30)], 0.045, "crank", smooth=False), b)
    boss = paint(cyl(0.11, 0.06, (x0 + 0.02, 0, zc), "X", "boss", segments=32), b)
    knob = paint(sphere(0.105, (x0 + 0.47, 0, zc - 0.30), (1.25, 1, 1), "knob"), M.ebony("knob"))
    return Item([body, lid, inlay, crank, boss, knob] + feet, roll=-24, lean=8)


def ribbon():
    """A typewriter ribbon: two black spool flanges, the ribbon wound between them (black over red), a tail let out."""
    R, T = 0.92, 0.46
    iron = M.steel("spool", color=(0.035, 0.032, 0.040), blue=1.0, rough=0.36, brushed=0.3, wear=0.8, edge=(0.42, 0.40, 0.42))
    holes = [circle(0.19, 20, 0.52 * math.cos(a), 0.52 * math.sin(a)) for a in [2 * math.pi * i / 5 + 0.3 for i in range(5)]]
    lower = paint(plate(circle(R, 72), 0.05, z=0.0, round_=0.018, name="flange"), iron)
    upper = paint(plate(circle(R, 72), 0.05, holes=holes + [circle(0.09, 16)], z=T - 0.05, round_=0.018, name="flange"), iron)
    cloth_black = M.felt("ribbon_black", (0.02, 0.018, 0.022), nap=0.25)
    cloth_red = M.felt("ribbon_red", WAXRED, nap=0.25)
    wound = [paint(cyl(0.78, (T - 0.1) / 2, (0, 0, 0.05 + (T - 0.1) / 4), name="wound", segments=64, bevel=0.004), cloth_red),
             paint(cyl(0.78, (T - 0.1) / 2, (0, 0, 0.05 + (T - 0.1) * 3 / 4), name="wound", segments=64, bevel=0.004), cloth_black)]
    hub = paint(cyl(0.16, T + 0.04, (0, 0, T / 2), name="hub", segments=32), _brass("hub", brushed=0.2))
    # The tail: off the spool's edge and away, on its edge, curling.
    tail = []
    for k, (mat, z0) in enumerate(((cloth_red, 0.05), (cloth_black, 0.05 + (T - 0.1) / 2))):
        pts = [(0.78 * math.cos(a), 0.78 * math.sin(a)) for a in [math.radians(250 + 6 * i) for i in range(6)]]
        x, y = pts[-1]
        for i in range(1, 15):
            x += 0.085
            y += 0.05 * math.sin(i * 0.55) - 0.012
            pts.append((x, y))
        outer = pts + [(px, py - 0.034) for px, py in reversed(pts)]
        tail.append(paint(plate(outer, (T - 0.1) / 2, z=z0, round_=0.004, name="tail"), mat))
    return Item([lower, upper, hub] + wound + tail, roll=-20, lean=30, plain=tail)


ITEMS = {"soap": soap, "wax": wax, "balance": balance, "weight": weight, "music-box": music_box, "ribbon": ribbon}

# The other things a player finds: a book, a small walnut box (whatever else it
# is, it's kept safe), an apothecary's vial, a matchbook, a chewed pencil stub,
# and the flashlights (the kit's own torch, props/flashlight.py, as a held item:
# plain brass, and the UV one, off and on).
#
#   <bpy python> scripts/blender/props/items_all.py book box ...   (items_all.py renders and exports)
import math
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import flashlight  # noqa: E402  (the kit's torch)
from items_common import (CREAM, VERMILION, WAXRED, WHITE, Item, M, bpy, circle, cyl, fillet, kit, mesh, paint, place, plate, rounded, sphere, tube)  # noqa: E402


def book():
    """A clothbound book lying shut: bottle-green boards, a gilt frame and title, the pages' edge, a red ribbon."""
    W, H, T = 1.40, 1.92, 0.40
    cloth = M.leather("cloth", color=(0.012, 0.085, 0.052), grain=0.35, wear=0.45)
    gilt = M.brass("gilt", color=(0.80, 0.56, 0.20), age=0.2, brushed=0.1, wear=0.5, rough=0.3)
    boards = [paint(plate(rounded(W, H, 0.05, 0.02, 0), 0.06, z=z, round_=0.025, name="board"), cloth) for z in (0.0, T - 0.06)]
    pages = paint(kit.box((W - 0.14, H - 0.12, T - 0.12), (0.0, 0, T / 2), "pages", bevel_width=0.015), M.paper("pages", color=(0.84, 0.77, 0.62), age=0.2, fibre=1.0))
    spine = paint(kit.box((0.16, H, T), (-W / 2 + 0.06, 0, T / 2), "spine", bevel_width=0.075, segments=4), cloth)
    bands = [paint(kit.box((0.19, 0.07, T + 0.02), (-W / 2 + 0.06, y, T / 2), "band", bevel_width=0.03), gilt) for y in (-0.62, 0.62)]
    z = T + 0.001
    frame = paint(tube([(x, y, z) for x, y in rounded(W - 0.42, H - 0.34, 0.06, 0.08, 0)], 0.018, "frame", cyclic=True, flat=0.5, smooth=False), gilt)
    title = paint(plate(rounded(0.62, 0.34, 0.04, 0.08, 0.36), 0.02, z=T - 0.004, round_=0.008, name="title"), gilt)
    lines = [paint(tube([(0.08 - w, y, T + 0.017), (0.08 + w, y, T + 0.017)], 0.014, "title_line", flat=0.4, smooth=False), M.ink("title_ink", (0.03, 0.10, 0.07))) for y, w in ((0.42, 0.2), (0.31, 0.13))]
    gem = paint(plate(fillet([(0.08, -0.26), (0.20, -0.42), (0.08, -0.58), (-0.04, -0.42)], 0.01), 0.02, z=T - 0.004, round_=0.008, name="lozenge"), gilt)
    rb = plate([(-0.07, 0.1), (0.07, 0.1), (0.07, -0.36), (0.0, -0.28), (-0.07, -0.36)], 0.02, round_=0.007, name="ribbon")
    paint(rb, M.felt("ribbon", color=WAXRED, nap=0.3))
    place(rb, (0.32, -H / 2 + 0.02, T / 2 + 0.02), (0, 0, -6))
    return Item(boards + [pages, spine, frame, title, gem, rb] + bands + lines, roll=10, lean=30, no_line=[frame] + lines)


def box():
    """A small walnut box with a brass clasp and corners."""
    W, D, H = 1.7, 1.12, 0.62
    wood = M.walnut("box", axis="X", figure=0.7, gloss=0.5, wear=0.6)
    brass = M.brass("box_brass", age=0.45, brushed=0.3, wear=0.9)
    body = paint(kit.box((W, D, H), (0, 0, H / 2), "body", bevel_width=0.04), wood)
    lid = paint(kit.box((W + 0.05, D + 0.05, 0.34), (0, 0, H + 0.03 + 0.17), "lid", bevel_width=0.07, segments=4), wood)
    gap = paint(kit.box((W - 0.04, D - 0.04, 0.05), (0, 0, H + 0.01), "gap", bevel_width=0), M.ink("gap", (0.03, 0.018, 0.02)))
    f = -D / 2
    hasp = paint(kit.box((0.30, 0.05, 0.30), (0, f - 0.04, H + 0.07), "hasp", bevel_width=0.022), brass)
    plate_ = paint(kit.box((0.36, 0.045, 0.30), (0, f - 0.012, H - 0.20), "lockplate", bevel_width=0.02), brass)
    hole = paint(cyl(0.045, 0.03, (0, f - 0.045, H - 0.2), "Y", "keyhole", segments=20, bevel=0), M.ink("keyhole", (0.03, 0.018, 0.02)))
    stud = paint(sphere(0.05, (0, f - 0.07, H + 0.10), (1, 0.6, 1), "stud"), brass)
    corners = []
    for sx in (-1, 1):
        # A strap wrapped round each front corner of the lid and the body.
        for zc, hh in ((H + 0.20, 0.36), (0.15, 0.30)):
            corners.append(paint(kit.box((0.26, 0.26, hh), (sx * (W / 2 - 0.085), f + 0.085, zc), "corner", bevel_width=0.03), brass))
        for zc, hh in ((H + 0.20, 0.36), (0.15, 0.30)):
            corners.append(paint(kit.box((0.26, 0.26, hh), (sx * (W / 2 - 0.085), -f - 0.085, zc), "corner", bevel_width=0.03), brass))
    return Item([body, lid, gap, hasp, plate_, hole, stud] + corners, roll=-30, lean=8, no_line=[hole])


def bottle():
    """An apothecary's vial: green glass, a cork, a paper label."""
    R = 0.50
    glass = M.lit(M.gel("vial", color=(0.05, 0.36, 0.16), rough=0.04, density=0.92), (0.05, 0.40, 0.16), 0.10)
    body = kit.lathe([(0, 0), (R - 0.08, 0), (R, 0.07), (R, 1.02), (R - 0.05, 1.16), (0.27, 1.32), (0.21, 1.38), (0.21, 1.56), (0.29, 1.59), (0.29, 1.68), (0.22, 1.71), (0, 1.71)], segments=64, name="vial")
    kit.bevel(body, 0.012)
    paint(body, glass)
    cork = kit.lathe([(0, 1.66), (0.185, 1.66), (0.215, 1.95), (0.20, 1.99), (0, 1.99)], segments=32, name="cork")
    kit.bevel(cork, 0.012)
    paint(cork, M.paper("cork", color=(0.52, 0.34, 0.18), age=0.6, fibre=1.0))
    # The label: a strip of paper round the front of the glass.
    r, z0, z1, span = R + 0.014, 0.28, 0.86, math.radians(56)
    verts, faces, n = [], [], 24
    for j in range(2):
        for i in range(n + 1):
            a = -math.pi / 2 - span + 2 * span * i / n
            verts.append((r * math.cos(a), r * math.sin(a), z0 if j == 0 else z1))
    faces = [(i, i + 1, n + 2 + i, n + 1 + i) for i in range(n)]
    label = mesh(verts, faces, "label", smooth=True)
    m = label.modifiers.new("solid", "SOLIDIFY")
    m.thickness, m.offset = 0.02, 0.0
    paint(label, M.paper("label", color=CREAM, age=0.3))
    pen = M.ink("label_ink", (0.10, 0.065, 0.075))
    ink = []
    for z, half in ((0.68, 0.7), (0.56, 0.75), (0.42, 0.45)):
        pts = [((r + 0.014) * math.cos(a), (r + 0.014) * math.sin(a), z + 0.012 * math.sin(k * 1.7)) for k, a in enumerate(np.linspace(-math.pi / 2 - span * half, -math.pi / 2 + span * half, 14))]
        ink.append(paint(tube(pts, 0.013, "label_line"), pen))
    return Item([body, cork, label] + ink, lean=6, roll=6, tip=-10, no_line=ink)


def matchbook():
    """A matchbook, open: a comb of red-headed matches standing against the dark of the cover, the red flap with its striker folded up over their feet."""
    W, H = 1.46, 1.96
    back = paint(plate(rounded(W, H, 0.06), 0.055, round_=0.02, name="cover"), M.paper("cover_inside", color=(0.055, 0.06, 0.10), age=0.0, fibre=0.6))
    wood = M.paper("match", color=(0.86, 0.76, 0.56), age=0.1, fibre=1.0)
    head = M.wax("match_head", color=VERMILION, translucency=0.1, gloss=0.25)
    parts = [back]
    n = 6
    for i in range(n):
        x = -W / 2 + 0.18 + (W - 0.36) * i / (n - 1)
        top = 0.66 + 0.035 * math.sin(i * 2.3)
        parts.append(paint(kit.box((0.125, top + 0.35, 0.075), (x, (top - 0.35) / 2, 0.055 + 0.0375), "match", bevel_width=0.015), wood))
        parts.append(paint(sphere(0.105, (x, top + 0.03, 0.10), (0.95, 1.3, 0.8), "head"), head))
    flap_h = 0.92
    red = M.paper("flap", color=(0.60, 0.055, 0.04), age=0.1, fibre=0.5)
    flap = paint(plate(rounded(W + 0.02, flap_h, 0.06, 0, -H / 2 + flap_h / 2), 0.06, z=0.135, round_=0.022, name="flap"), red)
    strike = paint(plate(rounded(W + 0.02, 0.24, 0.05, 0, -H / 2 + 0.12), 0.02, z=0.19, round_=0.008, name="striker"), M.rubber("striker", color=(0.075, 0.05, 0.045), rough=0.95, dust=0.8))
    disc = paint(plate(circle(0.25, 40, 0, -H / 2 + 0.56), 0.016, z=0.192, round_=0.006, name="roundel"), M.paper("roundel", color=WHITE, age=0.1, fibre=0.3))
    # A flame: a teardrop, round at the foot, its tip leaning.
    side = [(0.24 * math.sqrt(t) * (1 - t) ** 0.7, t) for t in [i / 14 for i in range(15)]]
    fy = -H / 2 + 0.40
    fl = [(w + 0.035 * t * t, fy + 0.34 * t) for w, t in side] + [(-w + 0.035 * t * t, fy + 0.34 * t) for w, t in reversed(side[1:-1])]
    flame = paint(plate(fl, 0.01, z=0.206, round_=0.003, name="flame"), M.ink("flame", (0.80, 0.22, 0.03)))
    return Item(parts + [flap, strike, disc, flame], roll=7, lean=42, no_line=[flame], plain=[disc])


def pencil():
    """A soft pencil worn to a stub and chewed at the end: yellow paint, a brass ferrule, a red rubber, a blunt lead."""
    R = 0.215
    hexagon = lambda a: R * (math.cos(math.pi / 6) / np.cos((a % (math.pi / 3)) - math.pi / 6) - 1.0)  # noqa: E731
    bites = [(0.26, 0.9, 0.05), (0.38, 2.6, 0.045), (0.2, 4.4, 0.05), (0.5, 5.3, 0.035), (0.33, 0.1, 0.04)]

    def chewed(a, z, r):
        d = hexagon(a)
        for (bz, ba, depth) in bites:
            da = np.minimum(np.abs(a - ba), 2 * math.pi - np.abs(a - ba))
            d = d - depth * np.exp(-((z - bz) / 0.035) ** 2 - (da / 0.45) ** 2)
        return d
    L0, L1 = 0.0, 0.98
    barrel = kit.lathe([(0, L0), (R, L0), (R, L1), (0, L1)], segments=96, max_len=0.012, name="barrel", displace=lambda a, z, r: chewed(a, z, r) * (r > R - 0.001), sharp=25)
    paint(barrel, M.enamel("pencil_paint", color=(0.80, 0.50, 0.045), gloss=0.55, chips=0.5, scale=0.6))
    cone = kit.lathe([(0, L1 - 0.01), (R * 0.9, L1 - 0.01), (R * 0.86, L1 + 0.04), (0.085, L1 + 0.40), (0, L1 + 0.40)], segments=48, name="wood")
    paint(cone, M.paper("pencil_wood", color=(0.78, 0.58, 0.36), age=0.3, fibre=1.0))
    lead = kit.lathe([(0, L1 + 0.39), (0.088, L1 + 0.39), (0.06, L1 + 0.50), (0.035, L1 + 0.535), (0, L1 + 0.54)], segments=32, name="lead")
    paint(lead, M.steel("graphite", color=(0.05, 0.05, 0.06), blue=0.2, rough=0.5, wear=0.2))
    ferrule = kit.lathe([(0, -0.30), (R + 0.012, -0.30), (R + 0.012, -0.235), (R - 0.01, -0.225), (R - 0.01, -0.20), (R + 0.012, -0.19), (R + 0.012, -0.11), (R - 0.01, -0.10), (R - 0.01, -0.075),
                         (R + 0.012, -0.065), (R + 0.012, 0.01), (0, 0.01)], segments=48, name="ferrule")
    kit.bevel(ferrule, 0.006)
    paint(ferrule, M.brass("ferrule", age=0.35, brushed=0.5, wear=0.8))
    rubber = kit.lathe([(0, -0.52), (R * 0.6, -0.52), (R - 0.03, -0.47), (R - 0.015, -0.29), (0, -0.29)], segments=48, name="rubber")
    kit.bevel(rubber, 0.02)
    paint(rubber, M.rubber("eraser", color=(0.44, 0.10, 0.065), rough=0.9, dust=0.25))
    parts = [barrel, cone, lead, ferrule, rubber]
    for ob in parts:  # laid along x, the lead to the right
        ob.rotation_euler = (0, math.pi / 2, 0)
        kit.apply_transforms(ob)
        ob.location = (-0.5, 0, R)
    return Item(parts, roll=42, lean=40, plain=[barrel])


# ---------------------------------------------------------------- the flashlights


def _torch(uv=False, glow=1.0):
    """The kit's torch; glow scales its bulb and the light on its reflector (0: switched off)."""
    parts, glassy, plain = flashlight.build(uv)
    root = parts[0].parent
    for m in bpy.data.materials:
        for n in (m.node_tree.nodes if m.node_tree else []):
            if n.type == "EMISSION" and m.name.startswith("bulb"):
                n.inputs["Strength"].default_value *= glow
            if n.type == "BSDF_PRINCIPLED" and m.name.startswith("reflector"):
                for link in n.inputs["Emission Strength"].links:
                    for k in ("To Min", "To Max"):
                        link.from_node.inputs[k].default_value *= glow
    return parts, glassy, plain, root


def _beam(z0, r0, length=0.75, r1=0.80, color=(0.45, 0.22, 1.0)):
    """The light leaving the lens: a short cone of violet that thins to nothing."""
    cone = kit.lathe([(r0, z0), (r1, z0 + length)], segments=64, max_len=0.05, name="beam")
    t = M.Tree("beam")
    tc = t.node("ShaderNodeTexCoord")
    sep = t.node("ShaderNodeSeparateXYZ")
    t.link(tc.outputs["Object"], sep.inputs[0])
    h = t.math("DIVIDE", t.math("SUBTRACT", sep.outputs["Z"], z0), length, clamp=True)
    fade = t.math("POWER", t.math("SUBTRACT", 1.0, h), 2.0)
    e = t.node("ShaderNodeEmission")
    t.set(e.inputs["Color"], color)
    e.inputs["Strength"].default_value = 3.2
    tr = t.node("ShaderNodeBsdfTransparent")
    mix = t.node("ShaderNodeMixShader")
    t.link(t.math("MULTIPLY", fade, 0.8), mix.inputs[0])
    t.link(tr.outputs[0], mix.inputs[1])
    t.link(e.outputs[0], mix.inputs[2])
    paint(cone, t.surface(mix))
    cone.visible_shadow = False
    return cone


def _torch_item(uv, glow, beam=False, margin=1.06, shift=(0.0, 0.0)):
    parts, glassy, plain, root = _torch(uv, glow)
    extra = []
    z = flashlight.build.lens_z
    if beam:
        b = _beam(z - 0.02, 0.40, length=0.46, r1=0.64)
        b.parent = root
        extra.append(b)
    if glow < 0.1:
        # Switched off: nothing lit behind the glass, only the dark of the barrel.
        dark = paint(cyl(0.415, 0.02, (0, 0, z - 0.08), name="unlit", segments=64, bevel=0), M.enamel("unlit", color=(0.03, 0.012, 0.09), gloss=0.3))
        dark.parent = root
        extra.append(dark)
    # Framed on the torch alone, so the lit and unlit pictures register (the beam fades out inside the frame).
    # The blackened one is dark on dark felt: more of the cool rim and the fill, so its barrel keeps an edge.
    return Item(parts + extra + [root], lean=0, tip=-40, no_line=glassy + extra, plain=plain, line=3.4, frame=parts, margin=margin, shift=shift,
                rim=1.8 if uv else 1.0, fill=1.8 if uv else 1.0)


def torch():
    """The brass flashlight, lit."""
    return _torch_item(False, 0.16)


def uv_light():
    """The UV flashlight, off: blackened brass, a dark violet glass."""
    return _torch_item(True, 0.03, margin=1.2, shift=(-0.045, -0.045))


def uv_light_on():
    """The UV flashlight in use: its lens lit, its beam out."""
    return _torch_item(True, 1.0, beam=True, margin=1.2, shift=(-0.045, -0.045))

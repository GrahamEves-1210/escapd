# The app icon and the splash emblem: one brass object on plum velvet, in the
# kit's look, lying flat under the house light (a flat lay, like the charms).
#
# Three were tried (`explore` renders them all):
#   a  "eye":   a classic keyhole plate, one of the cat's eyes at the keyhole;
#   b  "lens":  the player's magnifier lying on the velvet, the cat looking back
#               out of its lens, dark against candlelight, its eyes lit;
#   c  "cat":   the wordmark's keyhole as an escutcheon, the keyhole cut as the
#               cat sitting (round head, ears, the flare its body), its eyes lit.
# CHOSEN is the one the app ships: b. At 60 px it is the one that still says both
# "detective" and "cat" (a ring, a black face, two yellow eyes); a reads as a lock
# with a yellow dot, c as a cat in a gold frame, and both are mostly brass.
#
# The emblem is rendered once on clear film (with its contact shadow) and the
# velvet once without it; the icon, Android's adaptive layers and the splash are
# all put together from those two pictures, so they are the same object.
#
#   <bpy python> scripts/blender/props/brand_icon.py            # the chosen one -> assets/icon.png, android-icon-*.png, splash-icon.png
#   <bpy python> scripts/blender/props/brand_icon.py explore    # all three as icons into the scratch dir (nothing written to assets/); ONLY=ab picks
#   PX=384 SAMPLES=32 ... for a quick look; REUSE=1 puts the files together again from the last renders.
# Needs shapely in the bpy Python, as the charms scripts do. No Freestyle here: on the shadow ground
# it finds no outer contour (see ink_line), so SS stays 1.
import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
import bmesh  # noqa: E402
import numpy as np  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402
from PIL import Image, ImageChops, ImageDraw, ImageFilter  # noqa: E402
from shapely import affinity  # noqa: E402
from shapely.geometry import Point, Polygon  # noqa: E402
from shapely.ops import unary_union  # noqa: E402

import export  # noqa: E402
import items_common as I  # noqa: E402
import kit  # noqa: E402
import materials as M  # noqa: E402

CHOSEN = "b"
SPAN = 2.4                    # the icon's side in units: the emblem is about 1.9 of it
PX = int(os.environ.get("PX", 1024))
SS = int(os.environ.get("SS", 1))
SAMPLES = int(os.environ.get("SAMPLES", 144))
LINE = 6.5                    # the ink line in px at 1024 (about 1.1 px on a 180 px home-screen icon; modelled, see ink_line)
OUT = os.environ.get("OUT") or export.scratch("brand")

VELVET = "#33213D"            # the icon's ground: the shelf's plum, lifted so the icon keeps an edge on a black wallpaper
SHELF = "#130D18"             # the app's first screen (ref.color.void): the splash's ground
EYE = "#FBC15C"               # the cat's eyes (assets/characters/cat_sit.png)


def lin(hex_):
    c = [int(hex_[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


# ---------------------------------------------------------------- shapes (2D, units, y up)


def disc(cx, cy, r, sx=1.0, sy=1.0, turn=0.0):
    g = affinity.scale(Point(0, 0).buffer(r, 48), sx, sy)
    return affinity.translate(affinity.rotate(g, turn, origin=(0, 0)), cx, cy)


def soften(g, convex=0.012, concave=0.03):
    """Round a shape's inside corners (where an ear meets the head) more than its points."""
    g = g.buffer(concave, 16).buffer(-concave, 16)
    return g.buffer(-convex, 16).buffer(convex, 16)


def keyhole(cy, r, top_w, bottom_w, bottom_y):
    """A keyhole: a round hole and the flare under it."""
    stem = Polygon([(-top_w / 2, cy), (top_w / 2, cy), (bottom_w / 2, bottom_y), (-bottom_w / 2, bottom_y)])
    return soften(unary_union([Point(0, cy).buffer(r, 64), stem]), convex=0.03, concave=0.05)


def ears(cx, cy, r, at=38.0, half=25.0, tip=1.75, lean=6.0, sy=1.0):
    """The cat's ears on a round head: big, pointed, set wide. `at`: where an ear sits, in degrees
    out from the top of the head; `half`: half its base; `tip`: how far its point is from the
    head's middle (in radii), `lean` degrees further out than its base."""
    out = []
    for side in (1, -1):
        ang = lambda deg: math.radians(90 - side * deg)
        base = [(cx + r * 0.92 * math.cos(ang(a)), cy + r * 0.92 * sy * math.sin(ang(a))) for a in np.linspace(at - half, at + half, 8)]
        out.append(Polygon(base + [(cx + r * tip * math.cos(ang(at + lean)), cy + r * tip * math.sin(ang(at + lean)))]))
    return out


def slit(h, w, cx=0.0, cy=0.0, turn=0.0):
    """A cat's pupil: a pointed slit."""
    R = (h * h / 4 + w * w / 4) / w
    g = Point(-(R - w / 2), 0).buffer(R, 64).intersection(Point(R - w / 2, 0).buffer(R, 64))
    return affinity.translate(affinity.rotate(g, turn, origin=(0, 0)), cx, cy)


def polys(g):
    return [g] if g.geom_type == "Polygon" else [p for p in g.geoms if p.geom_type == "Polygon" and p.area > 1e-5]


# ---------------------------------------------------------------- parts


def plate(g, thick, z, round_=0.02, name="plate", dome=0.0, step=0.05):
    """A shapely shape as a solid lying on the velvet, its edges rounded; with `dome`, bowed
    like a struck plate (its middle that much higher than a point one unit out) so the
    light grades across its face instead of the face going one flat tone."""
    made = []
    for p in polys(g):
        p = p.simplify(0.002)
        ob = I.plate(list(p.exterior.coords)[:-1], thick, holes=[list(h.coords)[:-1] for h in p.interiors], z=z, round_=round_, name=name)
        if dome:
            bm = bmesh.new()
            bm.from_mesh(ob.data)
            for axis, no in ((0, (1, 0, 0)), (1, (0, 1, 0))):
                v = -SPAN / 2
                while v < SPAN / 2:
                    co = [0, 0, 0]
                    co[axis] = v
                    bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=co, plane_no=no, dist=1e-6)
                    v += step
            for v in bm.verts:
                w = ob.matrix_world @ v.co
                v.co.z += dome * (0.6 - w.x ** 2 - w.y ** 2)
            bm.to_mesh(ob.data)
            bm.free()
            kit.shade(ob, 40)
        made.append(ob)
    return made


def screw(x, y, z, r=0.062, turn=30.0, mat=None, dark=None):
    """A slotted, domed screw head."""
    prof = [(0.0, z + r * 0.52)] + [(r * math.sin(a), z + r * 0.52 * math.cos(a) ** 0.8) for a in np.linspace(0.12, math.pi / 2, 8)] + [(r, z - 0.01), (0.0, z - 0.01)]
    head = kit.lathe(prof, segments=40, name="screw")
    head.location = (x, y, 0)
    kit.assign(head, mat)
    slot = kit.box((r * 1.7, r * 0.24, r * 0.3), location=(x, y, z + r * 0.5), name="slot", bevel_width=0.003)
    slot.rotation_euler = (0, 0, math.radians(turn))
    kit.assign(slot, dark)
    return [head, slot]


def eye(g, z, pupil, parts, glows, shine=True):
    """One of the cat's eyes: its yellow, a little domed and wet, lit from inside so it
    shines out of the dark; the slit pupil; a glint toward the key."""
    iris_mat = M.lit(M.enamel("iris", color=tuple(c * 0.55 for c in lin(EYE)), gloss=0.8), color=lin(EYE), strength=0.62)
    iris = plate(g, 0.016, z, round_=0.005, name="iris")
    for ob in iris:
        kit.assign(ob, iris_mat)
    pup = plate(pupil, 0.008, z + 0.016, round_=0.002, name="pupil")
    for ob in pup:
        kit.assign(ob, M.ink("pupil"))
    parts += iris + pup
    glows += iris + pup
    if shine:
        b = g.bounds
        w, h = b[2] - b[0], b[3] - b[1]
        dot = plate(disc(b[0] + w * 0.30, b[1] + h * 0.74, min(w, h) * 0.085), 0.005, z + 0.025, round_=0.002, name="glint")
        for ob in dot:
            kit.assign(ob, M.glow("glint", color=(1.0, 0.95, 0.85), strength=1.6))
        parts += dot
        glows += dot


def ink_line(g, weight=LINE):
    """The kit's ink line as a shape: `g` grown by the line's weight (px at 1024), flat ink, to
    lie under the emblem. (Freestyle's outer line is the outline against empty film; a flat lay
    on the kit's shadow ground has none, so the line is modelled, as charms_pins does.)"""
    return g.buffer(weight * SPAN / 1024, 16)


def brasses():
    face = M.brass("brass", color=(0.66, 0.41, 0.14), age=AGE, brushed=BRUSHED, wear=0.6, rough=ROUGH, axis="Z")
    trim = M.brass("brass_trim", color=(0.72, 0.47, 0.17), age=0.3, brushed=0.3, wear=0.7, rough=0.24, axis="Z")
    return face, trim


def escutcheon(outline, hole, screws, rim=0.085, thick=0.11, dome=0.10):
    """A keyhole plate: a bowed brass plate with a raised border and a raised lip round the
    keyhole, on a dark backing (what is behind the door), held by slotted screws.
    Returns (parts, metal, backing height)."""
    face, trim = brasses()
    dark = M.felt("dark", color=(0.006, 0.004, 0.008), nap=0.3)
    parts, metal = [], []
    line = plate(ink_line(outline), 0.012, 0.0, round_=0.003, name="ink")
    for ob in line:
        kit.assign(ob, M.ink())
    parts += line
    back = plate(outline.buffer(-0.04), 0.02, 0.0, round_=0.004, name="backing")
    for ob in back:
        kit.assign(ob, dark)
    body = plate(outline.difference(hole), thick, 0.02, round_=0.03, name="plate", dome=dome)
    border = plate(outline.difference(outline.buffer(-rim)), 0.05, 0.02 + thick - 0.012, round_=0.024, name="border", dome=dome)
    lip = plate(hole.buffer(0.062).difference(hole), 0.045, 0.02 + thick - 0.012, round_=0.02, name="lip", dome=dome)
    for ob in body:
        kit.assign(ob, face)
    for ob in border + lip:
        kit.assign(ob, trim)
    metal += body + border + lip
    slot = M.ink("slot", (0.03, 0.018, 0.012))
    for i, (x, y) in enumerate(screws):
        zz = 0.02 + thick + dome * (0.6 - x * x - y * y) - 0.004
        s = screw(x, y, zz, turn=(28, -52, 74, 10)[i % 4], mat=trim, dark=slot)
        metal.append(s[0])
        parts += s
    parts += back + metal[:len(body + border + lip)]
    return parts, metal, 0.02


# ---------------------------------------------------------------- the three


def build_a():
    """A classic keyhole plate; the cat's eye at the keyhole."""
    outline = unary_union([Point(0, 0.30).buffer(0.70, 64), Point(0, -0.60).buffer(0.44, 64)]).convex_hull
    hole = keyhole(0.30, 0.345, 0.30, 0.46, -0.50)
    parts, metal, z = escutcheon(outline, hole, [(0, 0.815), (0, -0.83)])
    glows = []
    iris, pupil = disc(0.01, 0.30, 0.255, 0.84, 1.0, turn=-8), slit(0.42, 0.09, 0.02, 0.30, turn=-10)
    eye(iris, z, pupil, parts, glows)
    return {"parts": parts, "metal": metal, "glows": glows, "eyes": [iris], "pupils": [pupil],
            "mono": unary_union([outline.difference(hole), iris.intersection(hole).difference(pupil)])}


def cat_head(cx, cy, r, tilt=0.0, wide=1.16):
    """The cat's head from the front, as a silhouette: wide skull, big ears."""
    g = unary_union([disc(cx, cy, r, wide, 0.92)] + ears(cx, cy, r, at=44, half=24, tip=1.9, lean=10, sy=0.92))
    return affinity.rotate(soften(g, concave=0.075), tilt, origin=(cx, cy))


def cat_eyes(cx, cy, r, tilt=0.0, gap=0.46, size=0.33):
    """(iris, pupil) pairs for a head at (cx, cy) of radius r."""
    out = []
    for side in (-1, 1):
        ex, ey = cx + side * r * gap, cy - r * 0.02
        iris = disc(ex, ey, r * size, 0.86, 1.0, turn=side * -16)
        pupil = slit(r * size * 1.62, r * size * 0.36, ex + side * r * 0.01, ey, turn=side * -16)
        out.append((affinity.rotate(iris, tilt, origin=(cx, cy)), affinity.rotate(pupil, tilt, origin=(cx, cy))))
    return out


def build_b():
    """The magnifier lying on the velvet; the cat looks back out of its lens."""
    face, trim = brasses()
    R = 0.70
    cx, cy = 0.15, 0.15
    parts, metal, glows = [], [], []
    # What the lens shows: a candle-lit room, the cat's head dark against it.
    t = M.Tree("room")
    tc = t.node("ShaderNodeTexCoord")
    ln = t.node("ShaderNodeVectorMath", operation="DISTANCE")
    t.link(tc.outputs["Object"], ln.inputs[0])
    ln.inputs[1].default_value = (cx - 0.10, cy + 0.14, 0.02)
    grade = t.ramp(ln.outputs["Value"], [(0.0, 1.0), (0.40, 0.60), (0.92, 0.0)])
    col = t.mix(grade, (0.028, 0.010, 0.038), (0.66, 0.27, 0.09))
    e = t.node("ShaderNodeEmission")
    t.link(col, e.inputs["Color"])
    e.inputs["Strength"].default_value = 1.0
    room = plate(disc(cx, cy, R + 0.01), 0.02, 0.0, round_=0.004, name="room")
    for ob in room:
        kit.assign(ob, t.surface(e))
    lens_view = disc(cx, cy, R - 0.005)
    hx, hy, hr = cx + 0.0, cy - 0.10, 0.32
    head = cat_head(hx, hy, hr, tilt=-9)
    shoulders = disc(hx + 0.03, hy - 0.62, 0.42, 1.0, 1.0)
    whiskers = []
    for side in (-1, 1):
        for dy, turn, length in ((-0.05, 7, 0.27), (-0.10, -9, 0.25)):
            x0, y0 = hx + side * hr * 0.92, hy + dy
            a = math.radians(turn)
            tip = (x0 + side * length * math.cos(a), y0 + length * math.sin(a))
            whiskers.append(affinity.rotate(Polygon([(x0, y0 + 0.011), tip, (x0, y0 - 0.011)]), -9, origin=(hx, hy)))
    catg = unary_union([soften(unary_union([head, shoulders]))] + whiskers).intersection(lens_view)
    cat = plate(catg, 0.012, 0.02, round_=0.004, name="cat")
    for ob in cat:
        kit.assign(ob, M.felt("fur", color=(0.008, 0.005, 0.010), nap=0.4))
    parts += room + cat
    glows += room + cat
    eyes = cat_eyes(hx, hy, hr, tilt=-9)
    for iris, pupil in eyes:
        eye(iris, 0.032, pupil, parts, glows, shine=False)
    # The lens and its rim.
    n = 14
    front = [(R * i / n, 0.115 + 0.05 * (1 - (i / n) ** 2)) for i in range(n + 1)]
    lens = kit.lathe(front + [(R, 0.08), (0.0, 0.08)], segments=128, name="lens")
    lens.location = (cx, cy, 0)
    kit.assign(lens, M.glass("lens", tint=(0.84, 0.94, 1.0), ior=1.2, haze=0.003, rim=0.03, radius=R))
    ring = [(R - 0.012, 0.03), (R - 0.012, 0.19)]
    for i in range(0, 25):
        a = math.pi * i / 24
        ring.append((R + 0.055 + 0.075 * math.sin(a) ** 0.8, 0.11 + 0.10 * math.cos(a)))
    ring.append(ring[0])
    rim = kit.lathe(ring, segments=192, name="rim")
    rim.location = (cx, cy, 0)
    kit.bevel(rim, 0.006)
    kit.assign(rim, face)
    # The handle, down to the left (the way the game's magnifier is held).
    d = Vector((-1, -1, 0)).normalized()
    z0 = R + 0.10
    neck = [(0.0, z0 - 0.05), (0.07, z0 - 0.05), (0.07, z0 + 0.03), (0.105, z0 + 0.05), (0.115, z0 + 0.08), (0.115, z0 + 0.17), (0.10, z0 + 0.19), (0.0, z0 + 0.19)]
    h0, h1 = z0 + 0.18, z0 + 0.74
    prof = []
    for i in range(31):
        k = i / 30
        r = 0.112 + 0.045 * math.sin(math.pi * min(1.0, k * 1.2)) ** 1.5 * (1 - 0.2 * k) + 0.012 * k
        for c, w, h in ((0.08, 0.03, 0.016), (0.92, 0.03, 0.014)):
            r += h * math.exp(-((k - c) / w) ** 2)
        prof.append((r, h0 + (h1 - h0) * k))
    cap = [(0.10, h1 - 0.02), (0.135, h1 - 0.01), (0.14, h1 + 0.01), (0.14, h1 + 0.05), (0.12, h1 + 0.08), (0.06, h1 + 0.105), (0.0, h1 + 0.11)]
    wood = M.walnut("handle", axis="Z", color=(0.15, 0.050, 0.020), figure=0.7, gloss=float(os.environ.get("WGLOSS", 0.85)), wear=0.3, scale=0.6)
    basis = Matrix((Vector((0, 0, 1)), d.cross(Vector((0, 0, 1))), d)).transposed().to_4x4()  # the lathe's Z laid along d
    basis.translation = (cx, cy, 0.115)
    shadow = [disc(cx, cy, R + 0.13)]   # the silhouette, for the ink line
    for name, p, mat in (("neck", neck, trim), ("handle", [(0.0, h0)] + prof + [(0.0, h1)], wood), ("cap", cap, trim)):
        n_ = Vector((-d.y, d.x))
        side = [(cx + d.x * z + n_.x * r, cy + d.y * z + n_.y * r) for r, z in p]
        shadow.append(Polygon(side + [(cx + d.x * z - n_.x * r, cy + d.y * z - n_.y * r) for r, z in reversed(p)]).buffer(0))
        ob = kit.lathe(p, segments=64, name=name)
        ob.matrix_world = basis
        if mat is not wood:
            kit.bevel(ob, 0.005)
            metal.append(ob)
        kit.assign(ob, mat)
        parts.append(ob)
    silhouette = unary_union(shadow)
    line = plate(ink_line(silhouette), 0.012, 0.0, round_=0.003, name="ink")
    for ob in line:
        kit.assign(ob, M.ink())
    parts += [lens, rim] + line
    metal.append(rim)
    glows.append(lens)
    return {"parts": parts, "metal": metal, "glows": glows, "eyes": [i for i, _ in eyes], "pupils": [p_ for _, p_ in eyes], "lens": lens, "at": (cx, cy, 0.165),
            "mono": unary_union([silhouette.difference(disc(cx, cy, R)), catg.difference(unary_union([i for i, _ in eyes]))])}


def cat_keyhole():
    """The wordmark's keyhole cut as the cat sitting: the round hole its head, the flare its body."""
    hy, r = 0.12, 0.33
    g = unary_union([keyhole(hy, r, 0.30, 0.64, -0.70)] + ears(0, hy, r, at=34, half=21, tip=1.72, lean=5))
    return soften(g, convex=0.014, concave=0.035), hy, r


def build_c():
    """The wordmark's keyhole as an escutcheon; the keyhole is the cat."""
    # The plate: an arch (the A's shape, and the old icon's doorway).
    w, top, bottom = 1.44, 0.98, -0.98
    arch = unary_union([Point(0, top - w / 2).buffer(w / 2, 96), Polygon(I.rounded(w, (top - w / 2) - bottom, 0.16, 0, (top - w / 2 + bottom) / 2))])
    arch = unary_union([arch, Polygon([(-w / 2, top - w / 2), (w / 2, top - w / 2), (w / 2, 0), (-w / 2, 0)])])
    hole, hy, r = cat_keyhole()
    parts, metal, z = escutcheon(arch, hole, [(0, 0.86), (-0.53, -0.80), (0.53, -0.80)])
    glows = []
    eyes = cat_eyes(0, hy + 0.01, r, gap=0.47, size=0.36)
    for iris, pupil in eyes:
        eye(iris, z, pupil, parts, glows)
    return {"parts": parts, "metal": metal, "glows": glows, "eyes": [i for i, _ in eyes], "pupils": [p_ for _, p_ in eyes],
            "mono": unary_union([arch.difference(hole)] + [i.difference(p_) for i, p_ in eyes])}


BUILD = {"a": build_a, "b": build_b, "c": build_c}
SHAPES = {}   # what each build returned, by option (the eyes and the flat shape, for the glow and the themed icon)
NAMES = {"a": "A  eye at the keyhole", "b": "B  cat in the lens", "c": "C  the keyhole is the cat"}


# ---------------------------------------------------------------- the shot


AMBIENT = float(os.environ.get("AMBIENT", 0.28))   # the room, against the house 1: a plate lying flat mirrors the studio's ceiling, and goes pale gold all over
CARD = float(os.environ.get("CARD", 1.1))
KEY = float(os.environ.get("KEY", 0.6))
RIM = float(os.environ.get("RIM", 0.5))
AGE, BRUSHED, ROUGH = (float(os.environ.get(k, v)) for k, v in (("AGE", 0.75), ("BRUSHED", 0.45), ("ROUGH", 0.26)))


def card(metal, strength=CARD):
    """A white card over the lens, as a jeweller shoots a flat plate: brass facing the camera
    mirrors what is behind the camera, which in the house studio is the dark. Seen only in
    reflections and only by the metal; it grades from bright by the key (upper left) to dim
    at the far corner, so the bowed plate carries one soft highlight. (As charms_pins.card.)"""
    bpy.ops.mesh.primitive_plane_add(size=9.0, location=(0, 0, 5.0))
    p = bpy.context.object
    p.name = "card"
    p["kit_rig"] = True
    for ray in ("camera", "diffuse", "shadow", "transmission", "volume_scatter"):
        setattr(p, "visible_" + ray, False)
    t = M.Tree("card")
    tc = t.node("ShaderNodeTexCoord")
    dot = t.node("ShaderNodeVectorMath", operation="DOT_PRODUCT")
    t.link(tc.outputs["Object"], dot.inputs[0])
    dot.inputs[1].default_value = (-0.16, 0.16, 0.0)
    grade = t.ramp(t.math("ADD", dot.outputs["Value"], 0.5), [(0.0, 0.04), (0.5, 0.16), (0.78, 0.62), (1.0, 1.15)])
    e = t.node("ShaderNodeEmission")
    t.set(e.inputs["Color"], (1.0, 0.93, 0.84))
    t.link(t.math("MULTIPLY", grade, strength), e.inputs["Strength"])
    p.data.materials.append(t.surface(e))
    seen = bpy.data.collections.new("card_lights")
    for ob in metal:
        seen.objects.link(ob)
    p.light_linking.receiver_collection = seen
    return p


def shoot(option, path, px=PX, samples=SAMPLES, ss=SS):
    """The emblem on clear film with its contact shadow, the icon's framing (SPAN across)."""
    kit.reset()
    kit.setup(size=(px, px), samples=samples, ss=ss)
    made = BUILD[option]()
    SHAPES[option] = made
    metal = made["metal"]
    cam = kit.camera("top", span=SPAN, azim=-90)
    kit.studio(cam, span=2.0, target=(0, 0, 0), key=KEY, warm=(1.0, 0.86, 0.68), rim=RIM, ambient=AMBIENT, shadow=0.0, shadow_strength=0.75, shadow_reach=0.10)
    card(metal)
    if "lens" in made:  # the room's window in its glass
        kit.window(cam, at=made["at"], normal=(0, 0, 1), toward=(-0.74, 0.74), spread=27, size=0.6, strength=0.8, span=2.0, only=[made["lens"]])
    kit.no_outline()        # the line is modelled (ink_line): Freestyle has no outer contour against the shadow ground
    kit.render(path)
    im = export.load(path)
    return im.resize((px, px), Image.LANCZOS) if ss != 1 else im


def velvet(path, px=512, samples=48):
    """The ground: plum velvet under the same light, a little uneven like a padded board."""
    kit.reset()
    kit.setup(size=(px, px), samples=samples, ss=1)
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=120, y_subdivisions=120, size=1.0)
    ob = bpy.context.object
    ob.scale = (SPAN * 1.2, SPAN * 1.2, 1)
    kit.apply_transforms(ob)
    rng = np.random.default_rng(11)
    bumps = [(rng.uniform(-1.3, 1.3), rng.uniform(-1.3, 1.3), rng.uniform(0.5, 1.0), rng.uniform(-0.03, 0.03)) for _ in range(12)]
    for v in ob.data.vertices:
        v.co.z = sum(a * np.exp(-((v.co.x - x) ** 2 + (v.co.y - y) ** 2) / (r * r)) for x, y, r, a in bumps)
    kit.shade(ob, 180)
    kit.assign(ob, M.felt("velvet", color=lin(VELVET), nap=0.9, scale=1.0))
    cam = kit.camera("top", span=SPAN, azim=-90)
    kit.studio(cam, span=2.0, target=(0, 0, 0), key=1.5, warm=(1.0, 0.90, 0.76))
    kit.no_outline()
    kit.render(path)
    return grade_velvet(Image.open(path).convert("RGB"))


def grade_velvet(im, size=1024):
    """Felt shades very flat under the studio (charms_board.py): keep the render's nap and
    padding, hold its middle at VELVET, and draw out the fall from the key (upper left)
    to the far corner so the ground is lit like everything on it."""
    a = np.asarray(im.resize((size, size), Image.LANCZOS), dtype=np.float32)
    target = np.array([int(VELVET[i:i + 2], 16) for i in (1, 3, 5)], dtype=np.float32)
    a = a * (target / a.reshape(-1, 3).mean(0))
    a = target + (a - target) * 3.0
    yy, xx = np.mgrid[0:size, 0:size] / (size - 1)
    pool = np.exp(-(((xx - 0.30) / 0.62) ** 2 + ((yy - 0.24) / 0.62) ** 2))          # the lamp's pool
    edge = np.clip(np.hypot(xx - 0.5, yy - 0.5) / 0.707, 0, 1) ** 2.2               # the corners fall away
    k = (0.74 + 0.62 * pool) * (1 - 0.34 * edge)
    warm = np.array([1.05, 0.98, 0.94]) * pool[..., None] + np.array([0.96, 0.98, 1.06]) * (1 - pool[..., None])
    a = np.clip(a * k[..., None] * warm, 0, 255)
    return Image.fromarray(a.astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6))


# ---------------------------------------------------------------- putting the files together


def raster(g, px, ss=4):
    """A shape (units, the icon's framing) as an 8-bit mask px square."""
    n = px * ss
    m = Image.new("L", (n, n), 0)
    d = ImageDraw.Draw(m)
    to = lambda pts: [((x / SPAN + 0.5) * n, (0.5 - y / SPAN) * n) for x, y in pts]
    for p in polys(g):
        d.polygon(to(p.exterior.coords), fill=255)
        for h in p.interiors:
            d.polygon(to(h.coords), fill=0)
    return m.resize((px, px), Image.LANCZOS)


def glow_eyes(im, option):
    """The halo round the eyes: only the eyes may glow (brass glints don't)."""
    a = np.asarray(im, dtype=np.float32) / 255
    sh = shapes(option)
    iris = np.asarray(raster(unary_union(sh["eyes"]), im.width), dtype=np.float32) / 255
    pupil = np.asarray(raster(unary_union(sh["pupils"]).buffer(0.004), im.width), dtype=np.float32) / 255
    hot = iris * (1 - pupil) * np.clip((a[..., :3].max(-1) - 0.45) / 0.3, 0, 1)
    src = (a[..., :3] * hot[..., None])
    out = a.copy()
    glow = np.zeros_like(src)
    for rad, w in ((0.012, 0.5), (0.035, 0.5)):
        for c in range(3):
            ch = Image.fromarray((np.clip(src[..., c], 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(rad * im.width))
            glow[..., c] += w * np.asarray(ch, dtype=np.float32) / 255
    glow = np.clip(glow * 1.1, 0, 1) * (1 - 0.85 * iris[..., None]) * (1 - pupil[..., None])   # the halo is round the eye, not over it; the slit stays ink
    out[..., :3] = 1 - (1 - a[..., :3]) * (1 - glow * a[..., 3:4])   # only over the emblem: nothing spills onto clear film
    return Image.fromarray((np.clip(out, 0, 1) * 255 + 0.5).astype(np.uint8), "RGBA")


def cast(emblem, ground, offset=(0.016, 0.022), blur=0.022, strength=0.55):
    """The emblem on the velvet: the shadow the key throws (down and to the right), then the emblem."""
    n = ground.width
    e = emblem if emblem.width == n else emblem.resize((n, n), Image.LANCZOS)
    solid = e.getchannel("A").point(lambda v: 255 if v > 242 else 0)
    sh = ImageChops.offset(solid, round(offset[0] * n), round(offset[1] * n)).filter(ImageFilter.GaussianBlur(blur * n))
    ink = Image.new("RGB", (n, n), (0x0C, 0x06, 0x10))
    out = Image.composite(ink, ground.convert("RGB"), sh.point(lambda v: int(v * strength)))
    out.paste(e.convert("RGB"), (0, 0), e.getchannel("A"))
    return out


def scaled(emblem, fraction, size=1024, of=None):
    """The emblem trimmed to its solid part and centred in a clear square, its longer side `fraction` of it.
    `of`: another picture in the emblem's framing to cut the same way instead (the themed icon's flat shape)."""
    box = emblem.getchannel("A").point(lambda v: 255 if v > 242 else 0).getbbox()
    pad = round(0.06 * emblem.width)   # room for its shadow
    box = (max(0, box[0] - pad), max(0, box[1] - pad), min(emblem.width, box[2] + pad), min(emblem.height, box[3] + pad))
    crop = (of or emblem).crop(box)
    k = fraction * size / (max(box[2] - box[0], box[3] - box[1]) - 2 * pad)
    crop = export.resize(crop, (round(crop.width * k), round(crop.height * k)))
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.alpha_composite(crop, ((size - crop.width) // 2, (size - crop.height) // 2))
    return out


def mono(emblem, option, fraction, size=1024):
    """Android's themed icon: the emblem as one flat shape (the brass; the keyhole stays cut out, the eyes stay in)."""
    m = raster(shapes(option)["mono"], emblem.width)
    flat = Image.new("RGBA", m.size, (255, 255, 255, 0))
    flat.putalpha(m)
    return scaled(emblem, fraction, size, of=flat)


def shapes(option):
    """The option's 2D shapes; built (in an empty scene) if this run hasn't rendered it."""
    if option not in SHAPES:
        kit.reset()
        SHAPES[option] = BUILD[option]()
    return SHAPES[option]


def save(im, rel, squeeze=True):
    """Write a PNG into the repo. squeeze=False leaves it as Pillow wrote it (oxipng turns a flat
    white shape into a palette image; the themed icon stays plain RGBA for every build tool)."""
    dest = os.path.join(export.REPO, rel)
    im.save(dest, "PNG", optimize=True)
    if squeeze:
        try:
            import oxipng
            oxipng.optimize(dest, level=4)
        except Exception:
            pass
    print(f"  {rel}  {im.width}x{im.height} {im.mode}  {os.path.getsize(dest) / 1024:.1f} KB")
    return os.path.getsize(dest)


def renders(option, px=PX, samples=SAMPLES, ss=SS):
    e_path, v_path = os.path.join(OUT, f"emblem-{option}-{px}.png"), os.path.join(OUT, "velvet.png")
    if os.environ.get("REUSE") and os.path.exists(e_path):
        emblem = export.load(e_path)
        emblem = emblem.resize((px, px), Image.LANCZOS) if emblem.width != px else emblem
    else:
        emblem = shoot(option, e_path, px, samples, ss)
    g_path = os.path.join(OUT, "velvet-graded.png")
    if os.path.exists(g_path) and os.environ.get("REUSE"):
        ground = Image.open(g_path).convert("RGB")
    else:
        ground = velvet(v_path)
        ground.save(g_path)
    return glow_eyes(emblem, option), ground


def final(option=CHOSEN):
    emblem, ground = renders(option)
    total = 0
    icon = cast(emblem, ground)                                   # iOS: 1024, opaque, full bleed (the system rounds it)
    total += save(icon.convert("RGB"), "assets/icon.png")
    total += save(ground.convert("RGB"), "assets/android-icon-background.png")
    fg = scaled(emblem, 0.445)                                    # inside Android's safe zone (the middle 61%) under any mask
    total += save(fg, "assets/android-icon-foreground.png")
    total += save(mono(emblem, option, 0.445), "assets/android-icon-monochrome.png", squeeze=False)
    total += save(scaled(emblem, 0.88), "assets/splash-icon.png")  # the emblem alone, clear film, for the splash's plum
    print(f"total {total / 1024:.1f} KB")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "explore":
        px = int(os.environ.get("PX", 512))
        for o in (os.environ.get("ONLY") or "abc"):
            emblem, ground = renders(o, px=px, samples=int(os.environ.get("SAMPLES", 64)), ss=int(os.environ.get("SS", 1)))
            cast(emblem, ground.resize((px, px), Image.LANCZOS)).save(os.path.join(OUT, f"icon-{o}.png"))
            print("explored", o)
    else:
        final(sys.argv[1] if len(sys.argv) > 1 else CHOSEN)

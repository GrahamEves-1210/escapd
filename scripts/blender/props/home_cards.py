# Home's three mode cards as small dioramas (src/screens/hub/art/ModeScene.tsx):
# each card's cover is a little 3D scene on a table against a wall, rendered
# from one camera in three depth layers that slide against each other inside
# the card's frame as the phone tilts:
#   back   the wall, and what is on it or falls across it   (a JPEG)
#   mid    the table and what stands on it                  (the table a JPEG, what stands up past its far edge a PNG)
#   front  the thing nearest us, big and soft                (a PNG)
#
# - noir: a desk corner at night. Streetlight through rain-streaked blinds
#   lies in bars across the wall and the desk; a banker's lamp with its green
#   glass shade, lit; a rocks glass; a case file with its typed tab; a
#   matchbook; and, nearest, a fedora.
# - crime: the evidence table under the investigation board: pinned photos and
#   cards joined with red string; numbered markers, a photo scale, a brass
#   key; and, nearest, the magnifier.
# - moonlit: a seance table: a tilted mirror on the wall holding a pale
#   glow, two candles, a planchette on its cloth; and, nearest, mist.
#
# The camera looks straight at the wall from ELEV above, orthographic; the
# table meets the wall JOIN of the way down the card, so what matters stands
# in the card's upper part (the lower part of the upper two cards lies under
# the next card) and to the right of the title. Every layer has BLEED points
# of picture beyond the card on all sides (it slides).
#
#   <bpy python> scripts/blender/props/home_cards.py              # all three -> assets/home/cards/
#   <bpy python> scripts/blender/props/home_cards.py noir         # one mode (or: noir back, noir mid front)
#   QUICK=1 ...                                                   # a third of the samples
import json
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import home_parts as P  # noqa: E402  (puts scripts/blender on the path)
import bpy  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402
from PIL import Image, ImageFilter  # noqa: E402

import export  # noqa: E402
import kit  # noqa: E402
import materials as M  # noqa: E402

CARD = (358, 268)            # a card's cover, points (three wide by four... the covers' own 4:3)
BLEED = 8                    # each layer's picture reaches this far past the card, points
BOX = (CARD[0] + 2 * BLEED, CARD[1] + 2 * BLEED)
ELEV = 24.0
E = math.radians(ELEV)
WIDE = 4.3                   # units across the picture
UNIT = BOX[0] / WIDE         # points a unit
JOIN = 0.50                  # the table meets the wall this far down the card (where the words' plate ends)
WALL = 1.0                   # the wall's y
ZT = (WALL * math.sin(E) + (JOIN * CARD[1] + BLEED - BOX[1] / 2) / UNIT) / math.cos(E)   # the camera's target height
QUICK = bool(os.environ.get("QUICK"))
DENSITY = int(os.environ.get("DENSITY", 3))   # pixels a point (1 for a quick look at a composition)
DEST = "assets/home/cards"


def tag(objects, layer):
    for ob in objects if isinstance(objects, (list, tuple)) else [objects]:
        ob["layer"] = layer
    return objects


def at(ob, location, turn=0.0):
    ob.location = location
    ob.rotation_euler = (0, 0, math.radians(turn))
    return ob


def plaster(name, colour, mottle=0.5):
    """A wall: matte, a little uneven."""
    t = M.Tree(name)
    n = t.noise(t.coords((0.7, 0.7, 0.7)), scale=1.0, detail=4, rough=0.6)
    col = t.mix(t.math("MULTIPLY", n, mottle), colour, tuple(c * 0.55 for c in colour))
    return t.surface(t.principled(**{"Base Color": col, "Roughness": 0.92, "Specular IOR Level": 0.1}))


def room(wall_mat, table_mat):
    """The wall (back) and the table (mid), wider than the picture."""
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, WALL, 1.6))
    wall = bpy.context.object
    wall.name = "wall"
    wall.scale = (9, 4.4, 1)
    wall.rotation_euler = (math.radians(90), 0, 0)
    kit.apply_transforms(wall)
    kit.assign(wall, wall_mat)
    table = kit.box((9, 5.2, 0.3), (0, WALL - 2.6, -0.15), "table", bevel_width=0.02)
    kit.assign(table, table_mat)
    return tag(wall, "back"), tag(table, "mid")


def practical(name, location, colour, power, radius=0.08):
    """A light that belongs to the scene (a lamp's bulb, a flame)."""
    data = bpy.data.lights.new(name, "POINT")
    data.energy, data.color, data.shadow_soft_size = power, colour, radius
    ob = bpy.data.objects.new(name, data)
    ob.location = location
    ob["kit_rig"] = True
    bpy.context.scene.collection.objects.link(ob)
    return ob


# ---------------------------------------------------------------- noir


def fedora():
    felt = M.felt("fedora", color=(0.022, 0.020, 0.026), nap=0.2)
    crown = kit.lathe([(0, 0.62), (0.20, 0.64), (0.36, 0.60), (0.43, 0.50), (0.46, 0.25), (0.47, 0.05), (0.47, 0.0)], name="hat_crown", segments=72,
                      displace=lambda a, z, r: -0.07 * (z > 0.35) * (abs(((a + 1.57) % 6.283) - 3.1416) < 0.5) * (r > 0.2))
    for v in crown.data.vertices:   # the crease along its top, the pinch at its front
        if v.co.z > 0.5:
            v.co.z -= 0.09 * math.exp(-(v.co.x / 0.12) ** 2)
    crown.scale = (1.0, 1.22, 1.0)
    brim = kit.lathe([(0.46, 0.03), (0.60, 0.0), (0.78, 0.02), (0.86, 0.07), (0.87, 0.09), (0.78, 0.045), (0.60, 0.03), (0.46, 0.06)], name="hat_brim", segments=72)
    brim.scale = (1.0, 1.18, 1.0)
    band = kit.lathe([(0.475, 0.04), (0.482, 0.06), (0.476, 0.20), (0.468, 0.21)], name="hat_band", segments=72)
    band.scale = (1.0, 1.22, 1.0)
    for ob in (crown, brim):
        kit.assign(ob, felt)
    kit.assign(band, M.felt("hat_band", color=P.srgb("#3A1426"), nap=0.4))
    return [crown, brim, band]


def noir():
    wall, table = room(plaster("wall", P.srgb("#2A1D33")), M.walnut("desk", axis="X", color=(0.16, 0.065, 0.03), figure=0.6, gloss=0.55, scale=3.0))
    mid, front, glassy = [], [], []
    brass = M.brass("lamp_brass", age=0.45, brushed=0.4, wear=0.7)
    # The banker's lamp: a weighted foot, a stem that bends over, the green glass trough alight.
    lx, ly = 1.12, -0.12
    foot = kit.lathe([(0, 0), (0.40, 0), (0.44, 0.03), (0.40, 0.07), (0.20, 0.10), (0.09, 0.13), (0.07, 0.18), (0, 0.18)], name="lamp_foot", segments=64)
    foot.scale = (1.25, 0.8, 1)
    top = 0.74   # the arm's height
    stem = P.tube(P.smooth_path([(0, 0, 0.15), (0, 0.02, 0.4), (0, 0.0, top - 0.2), (0, -0.10, top - 0.02), (0, -0.20, top)], steps=8), 0.045, "lamp_stem", segments=16)
    arm = P.tube([(-0.62, -0.20, top), (0.62, -0.20, top)], 0.035, "lamp_arm", segments=12)
    ends = [P.ball(0.06, (s * 0.64, -0.20, top), "lamp_end") for s in (-1, 1)]
    for ob in [foot, stem, arm] + ends:
        kit.assign(ob, brass)
    # The shade: a half round of green glass along the arm, open underneath.
    verts, faces = [], []
    n, m, r, half = 28, 2, 0.26, 0.60
    for j in range(m):
        for i in range(n + 1):
            a = math.radians(-20 + 220 * i / n)
            verts.append(((-half if j == 0 else half), -0.20 + r * math.cos(a) * 0.95, top - 0.08 + r * math.sin(a)))
    for i in range(n):
        faces.append((i, i + 1, n + 1 + i + 1, n + 1 + i))
    me = bpy.data.meshes.new("lamp_shade")
    me.from_pydata(verts, [], faces)
    shade = bpy.data.objects.new("lamp_shade", me)
    bpy.context.scene.collection.objects.link(shade)
    shade.modifiers.new("thick", "SOLIDIFY").thickness = 0.03
    kit.shade(shade, 60)
    # Green cased glass: the tube's light comes through it, deepest where the glass turns away.
    kit.assign(shade, M.lit(M.gel("green_glass", color=(0.0, 0.42, 0.16), rough=0.18, density=0.97), (0.02, 0.55, 0.20), 0.10))
    caps = []
    for s in (-1, 1):
        cap = kit.lathe([(0, 0), (r + 0.01, 0), (r + 0.01, 0.03), (0, 0.035)], name="lamp_cap", segments=40)
        cap.rotation_euler = (0, math.radians(90 * s), 0)
        cap.location = (s * (half + 0.0), -0.20, top - 0.08)
        cap.scale = (1, 0.95, 1)
        caps.append(kit.assign(cap, brass))
    tube = P.tube([(-0.5, -0.20, top - 0.10), (0.5, -0.20, top - 0.10)], 0.05, "lamp_tube", segments=12)
    kit.assign(tube, M.glow("lamp_tube", (1.0, 0.80, 0.50), 5.0))
    chain = P.tube(P.smooth_path([(0.42, -0.36, top - 0.14), (0.43, -0.37, top - 0.32), (0.42, -0.36, top - 0.48)], steps=4), 0.012, "lamp_chain", segments=8)
    pull = P.ball(0.035, (0.42, -0.36, top - 0.52), "lamp_pull", scale=(1, 1, 1.4))
    for ob in (chain, pull):
        kit.assign(ob, brass)
    lamp = [foot, stem, arm, shade, tube, chain, pull] + ends + caps
    root = kit.group(lamp, "lamp")
    root.location = (lx, ly, 0)
    mid += lamp
    practical("lamp_light", (lx, ly - 0.22, top - 0.26), (1.0, 0.74, 0.42), 22, radius=0.25)
    # A rocks glass: two fingers of whisky, ice.
    gx, gy = 0.25, -1.15
    glass = kit.lathe([(0, 0.0), (0.19, 0.0), (0.215, 0.02), (0.235, 0.42), (0.225, 0.425), (0.205, 0.07), (0, 0.06)], name="rocks_glass", segments=64)
    kit.assign(glass, M.glass("rocks", tint=(0.92, 0.96, 1.0), ior=1.45, haze=0.03, rim=0.4))
    whisky = kit.lathe([(0, 0.065), (0.203, 0.072), (0.212, 0.20), (0, 0.20)], name="whisky", segments=48)
    kit.assign(whisky, M.gel("whisky", color=(0.85, 0.42, 0.06), rough=0.02, density=0.85))
    ice = [kit.box((0.13, 0.13, 0.12), (dx, dy, 0.17 + dz), "ice", bevel_width=0.025) for dx, dy, dz in ((-0.05, 0.02, 0.0), (0.07, -0.03, 0.03))]
    for i, ob in enumerate(ice):
        ob.rotation_euler = (0.3 * i, 0.4, 0.8 * i + 0.3)
        kit.assign(ob, M.glass("ice", tint=(0.9, 0.95, 1.0), ior=1.31, rough=0.15, haze=0.12, rim=0.3))
    drink = [glass, whisky] + ice
    for ob in drink:
        ob.location = Vector(ob.location) + Vector((gx, gy, 0))
    mid += drink
    glassy += [glass] + ice
    # The case file: a manila folder, sheets and a photograph's corner out of it, its typed tab, a paperclip.
    manila = M.paper("manila", color=(0.62, 0.44, 0.24), fibre=0.5, age=0.5)
    cover = kit.box((1.55, 1.08, 0.022), (0, 0, 0.045), "file_cover", bevel_width=0.006)
    under = kit.box((1.55, 1.08, 0.018), (0.01, 0.01, 0.009), "file_back", bevel_width=0.006)
    tab = kit.box((0.5, 0.12, 0.018), (0.38, 0.59, 0.009), "file_tab", bevel_width=0.006)
    for ob in (cover, under, tab):
        kit.assign(ob, manila)
    sheets = [kit.assign(kit.box((1.42, 1.0, 0.006), (0.07 + 0.03 * i, 0.03 - 0.02 * i, 0.022 + 0.006 * i), "file_sheet", bevel_width=0), M.paper("sheet", color=(0.84, 0.78, 0.66))) for i in range(2)]
    for i, ob in enumerate(sheets):
        ob.rotation_euler = (0, 0, math.radians(2.5 - 4 * i))
    photo = kit.assign(kit.box((0.5, 0.62, 0.008), (0.62, -0.36, 0.036), "file_photo", bevel_width=0), M.paper("photo", color=(0.08, 0.07, 0.09), fibre=0.1, age=0.0))
    photo.rotation_euler = (0, 0, math.radians(-14))
    words = P.lettering("CASE No. 13", "special-elite/400Regular/SpecialElite_400Regular.ttf", 0.2, "file_words", depth=0.002)
    words.rotation_euler = (math.radians(-90), 0, 0)   # lying on the cover
    kit.apply_transforms(words)
    k = 0.62 / max(1e-6, words.dimensions.x)
    words.scale = (k, k, 1)
    kit.apply_transforms(words)
    words.location = (-0.30, -0.22, 0.058)
    kit.assign(words, M.ink("typed", (0.05, 0.03, 0.04)))
    clip = P.tube(P.smooth_path([(-0.60, 0.50, 0.06), (-0.60, 0.20, 0.06), (-0.55, 0.16, 0.06), (-0.50, 0.20, 0.06), (-0.50, 0.44, 0.06), (-0.545, 0.47, 0.06), (-0.575, 0.44, 0.06),
                                 (-0.575, 0.26, 0.06)], steps=5), 0.011, "file_clip", segments=8)
    kit.assign(clip, M.silver("clip", rough=0.2, tarnish=0.3))
    file = [cover, under, tab, photo, words, clip] + sheets
    root = kit.group(file, "file")
    root.location = (-0.95, -0.45, 0)
    root.rotation_euler = (0, 0, math.radians(11))
    mid += file
    # A matchbook, shut, by the glass.
    book = kit.assign(kit.box((0.36, 0.27, 0.05), (0, 0, 0.025), "matchbook", bevel_width=0.012), M.enamel("matchbook", color=P.srgb("#5B1F3A"), gloss=0.5))
    strike = kit.assign(kit.box((0.36, 0.045, 0.052), (0, -0.115, 0.026), "matchbook_strike", bevel_width=0.006), M.rubber("strike", color=(0.05, 0.035, 0.03)))
    star = kit.assign(kit.box((0.09, 0.09, 0.006), (0, 0.03, 0.052), "matchbook_mark", bevel_width=0.002), brass)
    star.rotation_euler = (0, 0, math.radians(45))
    matches = [book, strike, star]
    root = kit.group(matches, "matchbook")
    root.location = (1.25, -1.45, 0)
    root.rotation_euler = (0, 0, math.radians(-24))
    mid += matches
    # Nearest: a fedora, set down.
    hat = fedora()
    root = kit.group(hat, "fedora")
    root.location = (-1.5, -2.5, 0)
    root.rotation_euler = (0, 0, math.radians(28))
    root.scale = (1.25, 1.25, 1.25)
    front += hat
    # The street's light through the blinds, from the left: bars across the wall and the desk, rain running down the glass.
    sun = bpy.data.lights.new("street", "SUN")
    sun.energy, sun.color, sun.angle = 2.2, (0.72, 0.74, 1.0), math.radians(2.0)
    street = bpy.data.objects.new("street", sun)
    way = Vector((1.0, 0.62, -0.42)).normalized()
    street.rotation_euler = way.to_track_quat("-Z", "Y").to_euler()
    street["kit_rig"] = True
    bpy.context.scene.collection.objects.link(street)
    origin = Vector((-3.4, -1.2, 2.3))
    side = way.cross(Vector((0, 0, 1))).normalized()
    up = side.cross(way).normalized()
    blinds = []
    for i in range(-9, 10):
        slat = kit.box((0.02, 6.0, 0.16), (0, 0, 0), "slat", bevel_width=0)
        slat.matrix_world = Matrix.Translation(origin + up * (i * 0.30)) @ way.to_track_quat("X", "Z").to_matrix().to_4x4() @ Matrix.Rotation(math.radians(18), 4, "Y")
        blinds.append(slat)
    rng = random.Random(4)
    for i in range(9):
        x = rng.uniform(-2.6, 2.6)
        pts = [origin - way * 0.4 + side * (x + 0.05 * math.sin(t * 2.2 + i)) + up * (t - 3.0) for t in [j * 0.4 for j in range(16)]]
        blinds.append(P.tube(pts, rng.uniform(0.012, 0.03), "rain", segments=6))
    for ob in blinds:   # they only shape the light
        ob.visible_camera = ob.visible_glossy = ob.visible_diffuse = False
        ob["kit_rig"] = True
    tag(mid, "mid")
    tag(front, "front")
    return {"glass": glassy, "plain": [table], "target": (0.4, -0.6, 0.5), "studio": {"key": 0.10, "fill": 0.35, "rim": 0.5, "ambient": 0.35}}


# ---------------------------------------------------------------- crime scene


def prism(w, h, d, name="tent"):
    """A folded card standing like a tent: `w` wide, `h` tall, `d` deep at its feet."""
    me = bpy.data.meshes.new(name)
    x, y = w / 2, d / 2
    me.from_pydata([(-x, -y, 0), (x, -y, 0), (x, 0, h), (-x, 0, h), (-x, y, 0), (x, y, 0)], [], [(0, 1, 2, 3), (5, 4, 3, 2), (0, 3, 4), (1, 5, 2)])
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    ob.modifiers.new("card", "SOLIDIFY").thickness = 0.012
    return ob


def marker(number, where, turn):
    """A numbered evidence marker: a yellow tent, its number on the face toward us."""
    w, h, d = 0.36, 0.38, 0.30
    tent = kit.assign(prism(w, h, d, "marker"), M.enamel("marker", color=(0.90, 0.62, 0.03), gloss=0.35))
    slope = math.atan2(d / 2, h)
    digit = P.lettering(str(number), "archivo/900Black/Archivo_900Black.ttf", 0.26, "marker_number", depth=0.004)
    digit.rotation_euler = (-slope, 0, 0)
    digit.location = (0, -d / 4 - 0.012, h / 2 - 0.01)
    kit.assign(digit, M.ink("numeral", (0.02, 0.016, 0.02)))
    root = kit.group([tent, digit], "marker")
    root.location = (where[0], where[1], 0)
    root.rotation_euler = (0, 0, math.radians(turn))
    return [tent, digit]


def pinned(kind, x, z, turn, pin):
    """Something pinned to the board: a photograph or a card, and its pin. Returns (parts, the pin's place)."""
    y = WALL - 0.075
    parts = []
    if kind == "photo":
        card = kit.assign(kit.box((0.52, 0.012, 0.62), (0, 0, 0), "photo", bevel_width=0), M.paper("photo_card", color=(0.84, 0.80, 0.72), fibre=0.2, age=0.3))
        shot = kit.assign(kit.box((0.44, 0.012, 0.44), (0, -0.004, 0.06), "photo_shot", bevel_width=0), M.enamel("photo_shot", color=(0.035, 0.03, 0.045), gloss=0.7))
        parts = [card, shot]
        top = 0.26
    else:
        card = kit.assign(kit.box((0.66, 0.012, 0.42), (0, 0, 0), "card", bevel_width=0), M.paper("card", color=(0.80, 0.74, 0.60), fibre=0.4, age=0.5))
        rows = [kit.assign(kit.box((0.5 - 0.12 * (i % 2), 0.012, 0.022), (-0.02 - 0.06 * (i % 2), -0.004, 0.11 - 0.075 * i), "card_line", bevel_width=0), M.ink("typed", (0.06, 0.04, 0.05))) for i in range(4)]
        parts = [card] + rows
        top = 0.16
    head = kit.assign(P.ball(0.038, (0, -0.03, top), "pin", scale=(1, 0.8, 1)), pin)
    parts.append(head)
    root = kit.group(parts, "pinned")
    root.location = (x, y, z)
    root.rotation_euler = (0, math.radians(turn), 0)
    bpy.context.view_layer.update()
    return parts, root.matrix_world @ Vector((0, -0.05, top))


def crime():
    wall, table = room(plaster("wall", P.srgb("#2B171B")), M.ebony("table", axis="X", gloss=0.35, scale=3.0))
    back, mid, front = [], [], []
    # The investigation board: cork in a wooden frame, photographs and cards pinned to it, red string from pin to pin.
    cx, cz, bw, bh = 1.0, 1.22, 3.3, 1.9
    cork = kit.assign(kit.box((bw, 0.05, bh), (cx, WALL - 0.03, cz), "cork", bevel_width=0), M.leather("cork", color=(0.33, 0.20, 0.10), grain=1.0, wear=0.0, scale=0.5))
    frame = M.walnut("board_frame", axis="X", color=(0.13, 0.055, 0.03), gloss=0.4)
    rails = [kit.box((bw + 0.14, 0.09, 0.08), (cx, WALL - 0.05, cz + s * bh / 2), "board_rail", bevel_width=0.012) for s in (-1, 1)]
    rails += [kit.box((0.08, 0.09, bh + 0.14), (cx + s * bw / 2, WALL - 0.05, cz), "board_stile", bevel_width=0.012) for s in (-1, 1)]
    for ob in rails:
        kit.assign(ob, frame)
    back += [cork] + rails
    red = M.enamel("pin_red", color=P.srgb("#C83D50"), gloss=0.8)
    brass = M.brass("pin_brass", age=0.2, brushed=0.1, wear=0.8)
    pins = []
    for kind, x, z, turn, pin in (("photo", 0.15, 1.55, 5, red), ("card", 1.05, 1.18, -4, brass), ("photo", 1.85, 1.62, -6, red), ("card", 2.25, 0.95, 5, brass), ("photo", 0.55, 0.78, -3, brass)):
        parts, where = pinned(kind, x, z, turn, pin)
        back += parts
        pins.append(where)
    string = M.felt("string", color=P.srgb("#B22A3D"), nap=0.2)
    for a, b in ((0, 1), (1, 2), (1, 3), (0, 4)):
        p, q = pins[a], pins[b]
        sag = (p + q) / 2 + Vector((0, -0.02, -0.05))
        back.append(kit.assign(P.tube(P.smooth_path([p, sag, q], steps=8), 0.011, "string", segments=6), string))
    # The evidence table: a sheet of brown paper, numbered markers by what was found, a photo scale.
    sheet = kit.assign(kit.box((3.6, 2.6, 0.006), (0.75, -0.55, 0.003), "evidence_sheet", bevel_width=0), M.paper("kraft", color=(0.50, 0.38, 0.25), fibre=0.8, age=0.4, scale=2.0))
    mid.append(sheet)
    mid += marker(1, (-0.05, 0.42), 8)
    mid += marker(2, (1.5, 0.3), -10)
    mid += marker(3, (0.85, -1.2), 4)
    # 1: a brass key.
    key_brass = M.brass("key", color=(0.72, 0.47, 0.17), age=0.35, brushed=0.3, wear=0.8)
    bow = P.ring(0.085, 0.024, "key_bow", segments=40)
    shaft = P.tube([(0.085, 0, 0), (0.50, 0, 0)], 0.022, "key_shaft", segments=12)
    bit = kit.box((0.10, 0.12, 0.03), (0.44, -0.07, 0), "key_bit", bevel_width=0.006)
    key = [bow, shaft, bit]
    for ob in key:
        kit.assign(ob, key_brass)
    root = kit.group(key, "key")
    root.location = (0.38, 0.22, 0.03)
    root.rotation_euler = (0, 0, math.radians(-24))
    mid += key
    # 2: a torn note, folded once.
    note = kit.assign(kit.box((0.52, 0.36, 0.008), (0, 0, 0.01), "note", bevel_width=0), M.paper("note", color=(0.84, 0.78, 0.64), age=0.5))
    flap = kit.assign(kit.box((0.52, 0.2, 0.008), (0, 0.24, 0.05), "note_flap", bevel_width=0), M.paper("note", color=(0.84, 0.78, 0.64), age=0.5))
    flap.rotation_euler = (math.radians(24), 0, 0)
    lines = [kit.assign(kit.box((0.36 - 0.1 * (i % 2), 0.018, 0.004), (-0.03, 0.08 - 0.07 * i, 0.016), "note_line", bevel_width=0), M.ink("pen", (0.05, 0.04, 0.10))) for i in range(3)]
    root = kit.group([note, flap] + lines, "note")
    root.location = (2.05, -0.1, 0)
    root.rotation_euler = (0, 0, math.radians(17))
    mid += [note, flap] + lines
    # 3: a button, lost in a hurry.
    button = kit.lathe([(0, 0.0), (0.085, 0.0), (0.10, 0.012), (0.10, 0.028), (0.085, 0.04), (0.05, 0.03), (0, 0.03)], name="button", segments=40)
    at(button, (1.32, -1.4, 0.006))
    mid.append(kit.assign(button, M.brass("button", age=0.3, brushed=0.2, wear=0.7)))
    # The photographer's scale: an L of black and white squares.
    white, black = M.enamel("scale_white", color=(0.82, 0.80, 0.74), gloss=0.3), M.enamel("scale_black", color=(0.02, 0.02, 0.025), gloss=0.3)
    scale = []
    for i in range(8):
        scale.append(kit.assign(kit.box((0.11, 0.09, 0.012), (i * 0.11, 0, 0.012), "scale", bevel_width=0), white if i % 2 else black))
    for i in range(1, 5):
        scale.append(kit.assign(kit.box((0.09, 0.11, 0.012), (-0.01, i * 0.11 - 0.01, 0.012), "scale", bevel_width=0), black if i % 2 else white))
    root = kit.group(scale, "scale")
    root.location = (-0.75, -0.75, 0)
    root.rotation_euler = (0, 0, math.radians(-8))
    mid += scale
    # Nearest: the magnifier, laid down (the game's own: props/magnifier.py).
    import magnifier
    parts, lens, *_ = magnifier.build()
    root = parts[0].parent
    root.matrix_world = Matrix.Translation((-1.25, -2.25, 0.14)) @ Matrix.Rotation(math.radians(-38), 4, "Z") @ Matrix.Rotation(math.radians(-90), 4, "X") @ Matrix.Scale(0.95, 4)
    front += parts
    # The desk lamp, out of the picture on the right: its light across the table and up the board.
    practical("desk_lamp", (2.9, -1.2, 1.5), (1.0, 0.80, 0.52), 110, radius=0.3)
    tag(back, "back")
    tag(mid, "mid")
    tag(front, "front")
    return {"glass": [lens], "plain": [table, sheet], "target": (0.6, -0.6, 0.6), "studio": {"key": 0.22, "fill": 0.4, "rim": 0.5, "ambient": 0.4}, "film_glass": True}


# ---------------------------------------------------------------- paranormal


def taper(height, where):
    """A candle in a small brass holder, alight. Returns (parts, its flame, the flame's place)."""
    brass = M.brass("holder", age=0.6, brushed=0.4, wear=0.6)
    holder = kit.assign(kit.lathe([(0, 0), (0.20, 0), (0.22, 0.02), (0.20, 0.04), (0.10, 0.05), (0.085, 0.10), (0.105, 0.12), (0.105, 0.15), (0.07, 0.15), (0.07, 0.06), (0, 0.06)],
                                  name="holder", segments=48), brass)
    wax = kit.assign(kit.lathe([(0, 0.06), (0.065, 0.06), (0.065, height - 0.02), (0.055, height), (0.03, height - 0.015), (0, height - 0.02)], name="taper", segments=32),
                     M.wax("taper", color=(0.86, 0.74, 0.56), translucency=0.7, gloss=0.4))
    wick = kit.assign(P.tube([(0, 0, height - 0.02), (0.005, 0, height + 0.05)], 0.008, "wick", segments=6), M.rubber("wick", color=(0.02, 0.014, 0.012)))
    h = 0.24
    flame = kit.lathe([(0, 0.0)] + [(0.055 * math.sin(math.pi * t) ** 0.8 * (1 - 0.55 * t), h * t) for t in [j / 16 for j in range(1, 16)]] + [(0, h)], name="flame", segments=24)
    flame.location = (0, 0, height + 0.03)
    kit.assign(flame, M.flame(strength=1.0, height=h))
    parts = [holder, wax, wick, flame]
    for ob in parts:
        ob.location = Vector(ob.location) + Vector((where[0], where[1], 0))
    spot = (where[0], where[1] - 0.02, height + 0.13)
    practical("candle", spot, (1.0, 0.58, 0.24), 9, radius=0.05)
    return parts, flame, spot


def moonlit():
    wall, table = room(plaster("wall", P.srgb("#1A1E45")), M.felt("cloth", color=P.srgb("#2B2560"), nap=0.8, scale=3.0))
    back, mid = [], []
    # The mirror: an oval of old glass in a brass frame, hung a little askew, holding a pale light of its own.
    rim = P.ring(0.62, 0.075, "mirror_frame", segments=72, section=16)
    bead = P.ring(0.54, 0.03, "mirror_bead", segments=72, section=10)
    glass = kit.lathe([(0, 0.0), (0.55, 0.0)], name="mirror_glass", segments=72)
    crest = kit.lathe([(0, 0), (0.13, 0), (0.15, 0.03), (0.10, 0.07), (0.05, 0.12), (0, 0.14)], name="mirror_crest", segments=32)
    crest.location = (0, 0.70, 0.02)
    for ob in (rim, bead, crest):
        kit.assign(ob, M.brass("mirror_brass", age=0.7, brushed=0.3, wear=0.6))
    # Old glass, dark at its edge, a pale light of its own gathering in its middle.
    kit.assign(glass, M.lit(M.enamel("mirror_glass", color=(0.015, 0.03, 0.05), gloss=1.0), (0.50, 0.95, 0.85), 1.1, radial=(0.04, 0.50), edge=0.10))
    mirror = [rim, bead, glass, crest]
    root = kit.group(mirror, "mirror")
    root.matrix_world = Matrix.Translation((1.15, WALL - 0.09, 1.0)) @ Matrix.Rotation(math.radians(-9), 4, "Y") @ Matrix.Rotation(math.radians(90), 4, "X") @ Matrix.Diagonal((0.86, 1.12, 0.86, 1.0))
    back += mirror
    practical("mirror_light", (1.15, 0.3, 1.0), (0.45, 1.0, 0.85), 14, radius=0.5)
    # The talking board on the cloth, the planchette on it.
    board = kit.assign(kit.box((2.7, 1.6, 0.05), (0, 0, 0.025), "board", bevel_width=0.02), M.walnut("board", axis="X", color=(0.40, 0.21, 0.085), figure=0.5, gloss=0.6, scale=1.5))
    burnt = M.ink("burnt", (0.02, 0.01, 0.008))
    words = []
    for text, size, y in (("A B C D E F G H I J K L M", 2.2, 0.30), ("N O P Q R S T U V W X Y Z", 2.2, -0.02), ("YES              NO", 1.7, 0.60), ("1 2 3 4 5 6 7 8 9 0", 1.5, -0.36)):
        row = P.lettering(text, "im-fell-english/400Regular/IMFellEnglish_400Regular.ttf", 0.2, "board_words", depth=0.002)
        row.rotation_euler = (math.radians(-90), 0, 0)
        kit.apply_transforms(row)
        k = size / max(1e-6, row.dimensions.x)
        row.scale = (k, k, 1)
        kit.apply_transforms(row)
        row.location = (0, y, 0.052)
        words.append(kit.assign(row, burnt))
    set_ = [board] + words
    root = kit.group(set_, "talking_board")
    root.location = (0.25, -0.55, 0)
    root.rotation_euler = (0, 0, math.radians(-7))
    mid += set_
    # The planchette: a pointed leaf of pale wood on three felt feet, a glass eye to read through.
    outline = []
    for i in range(48):
        a = 2 * math.pi * i / 48
        r = 0.30 * (1 + 0.55 * max(0.0, math.cos(a)) ** 3)
        outline.append((r * math.cos(a), 0.26 * math.sin(a) * (1 - 0.25 * max(0.0, math.cos(a)))))
    me = bpy.data.meshes.new("planchette")
    me.from_pydata([(x, y, 0.0) for x, y in outline], [], [tuple(range(48))])
    leaf = bpy.data.objects.new("planchette", me)
    bpy.context.scene.collection.objects.link(leaf)
    leaf.modifiers.new("thick", "SOLIDIFY").thickness = 0.035
    kit.bevel(leaf, 0.008)
    kit.assign(leaf, M.walnut("planchette", axis="X", color=(0.42, 0.22, 0.09), figure=0.4, gloss=0.7, scale=0.6))
    eye_rim = kit.assign(P.ring(0.085, 0.016, "planchette_rim", segments=32), M.brass("eye", age=0.3, brushed=0.2, wear=0.7))
    eye = kit.assign(kit.lathe([(0, 0.012), (0.08, 0.0)], name="planchette_eye", segments=32), M.glow("eye_light", (0.55, 1.0, 0.85), 0.5))
    feet = [kit.assign(P.ball(0.03, (fx, fy, -0.05), "planchette_foot"), M.felt("foot", color=(0.05, 0.05, 0.1))) for fx, fy in ((0.36, 0), (-0.14, 0.15), (-0.14, -0.15))]
    for ob in (eye_rim, eye):
        ob.location = (-0.04, 0, 0.012)
    planchette = [leaf, eye_rim, eye] + feet
    root = kit.group(planchette, "planchette")
    root.location = (0.65, -0.7, 0.125)
    root.rotation_euler = (0, 0, math.radians(152))
    mid += planchette
    # Two candles.
    flames = []
    for height, where in ((0.85, (2.02, 0.45)), (0.55, (1.72, 0.05)), (0.7, (-1.75, 0.4))):
        parts, flame, _ = taper(height, where)
        mid += parts
        flames.append(flame)
    tag(back, "back")
    tag(mid, "mid")
    return {"glass": flames + [glass, eye], "plain": [table], "target": (0.8, -0.6, 0.6), "studio": {"key": 0.08, "fill": 0.3, "rim": 0.8, "ambient": 0.3},
            "mist": True}


SCENES = {"noir": noir, "crime": crime, "moonlit": moonlit}


def mist(size, seed=5):
    """Paranormal's nearest layer: mist lying low over the table, thicker toward the foot, in the mode's spirit mint and lavender."""
    import numpy as np
    w, h = size
    rng = np.random.default_rng(seed)
    field = np.zeros((h, w), np.float32)
    for scale, weight in ((5, 0.6), (3, 0.4)):
        small = rng.random((max(2, h * scale // 256) + 2, max(2, w * scale // 256) + 2)).astype(np.float32)
        field += weight * np.asarray(Image.fromarray((small * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC), dtype=np.float32) / 255.0
    yy = np.linspace(0, 1, h, dtype=np.float32)[:, None]
    low = np.clip((yy - 0.46) / 0.42, 0, 1) ** 1.3          # nothing above the table's far edge, most at the foot
    alpha = np.clip((field - 0.30) * 1.7, 0, 1) * low * 0.6
    xx = np.linspace(0, 1, w, dtype=np.float32)[None, :]
    mint, lavender = np.array([150, 235, 215], np.float32), np.array([184, 170, 247], np.float32)
    col = mint[None, None, :] * (1 - xx[..., None]) + lavender[None, None, :] * xx[..., None]
    col = np.broadcast_to(col, (h, w, 3))
    out = np.dstack([col, alpha[..., None] * 255]).astype(np.uint8)
    return Image.fromarray(out, "RGBA").filter(ImageFilter.GaussianBlur(w / 40))


# ---------------------------------------------------------------- render


def shoot(genre, layers, out):
    kit.reset()
    samples = 64
    kit.setup(size=(BOX[0] * DENSITY, BOX[1] * DENSITY), ss=1, samples=samples // 3 if QUICK else samples)
    scene = SCENES[genre]()
    cam = kit.camera("front", target=(0, 0, ZT), span=WIDE, elev=ELEV)
    kit.studio(cam, span=3.0, target=scene["target"], **scene["studio"])
    s = bpy.context.scene
    tagged = [o for o in s.objects if "layer" in o.keys()]
    for name in layers:
        for ob in tagged:
            ob.visible_camera = ob["layer"] == name
        fs = bpy.context.view_layer.freestyle_settings
        for ls in list(fs.linesets):
            ls.collection = None
            fs.linesets.remove(ls)
        for col in list(bpy.data.collections):
            bpy.data.collections.remove(col)
        if name == "back":
            kit.no_outline()
        else:
            skip = {o.name: o for o in scene["glass"] + [o for o in tagged if o["layer"] != name and o.type == "MESH"]}
            kit.outline(2.0, exclude=list(skip.values()), plain=[o for o in scene["plain"] if o.name not in skip])
        path = os.path.join(out, f"{genre}_{name}.png")
        if name == "front" and scene.get("mist"):
            mist((BOX[0] * DENSITY, BOX[1] * DENSITY)).save(path)   # nothing stands nearest here: the mist is made, not rendered
        elif name == "front" and scene.get("film_glass"):
            kit.setup(size=(BOX[0] * DENSITY, BOX[1] * DENSITY), ss=1, samples=samples // 3 if QUICK else samples, transparent_glass=True)
            kit.outline(2.0, exclude=list(skip.values()), plain=[o for o in scene["plain"] if o.name not in skip])
            kit.render(path, exr=True)
            export.lift_glass(path).save(path)
        else:
            kit.render(path)
        print("layer", genre, name, path, flush=True)


def write(genre, out):
    """Trim and write a mode's layers, and say where each lies on the card (points; it may reach past it).
    The table's layer is written in two pictures that lie in the one layer: what stands up above the
    table's far edge keeps its alpha (a PNG); from there down it is the whole table, opaque (a JPEG)."""
    places = {}
    total = 0
    os.makedirs(os.path.join(P.REPO, DEST), exist_ok=True)

    def jpeg(im, name):
        path = os.path.join(P.REPO, DEST, f"{genre}-{name}.jpg")
        flat = Image.new("RGB", im.size, (0, 0, 0))
        flat.paste(im, mask=im.getchannel("A"))
        flat.save(path, quality=86, optimize=True, progressive=True)
        print(f"  {DEST}/{genre}-{name}.jpg  {im.width}x{im.height}  {os.path.getsize(path) / 1024:.1f} KB  (jpeg)")
        return os.path.getsize(path)

    def png(im, name):
        data, how = export.encode(im, quantise=True, max_error=24)
        open(os.path.join(P.REPO, DEST, f"{genre}-{name}.png"), "wb").write(data)
        print(f"  {DEST}/{genre}-{name}.png  {im.width}x{im.height}  {len(data) / 1024:.1f} KB  ({how})")
        return len(data)

    for name in ("back", "mid", "front"):
        im = export.load(os.path.join(out, f"{genre}_{name}.png"))
        k = im.width / BOX[0]   # pixels a point, as rendered
        place = lambda box: [round(box[0] / k - BLEED, 2), round(box[1] / k - BLEED, 2), round((box[2] - box[0]) / k, 2), round((box[3] - box[1]) / k, 2)]   # noqa: E731
        if name == "front" and genre != "moonlit":   # nearest: out of focus
            im = im.convert("RGBA").convert("RGBa").filter(ImageFilter.GaussianBlur(k)).convert("RGBA")
        if name == "mid" and genre == "moonlit":   # the candles' halos
            im = export.bloom(im, radius=0.03, strength=0.8, threshold=0.75, inside=0.5)
        if name == "back":
            box = (0, 0, im.width, im.height)
            total += jpeg(im, "back")
            places["back"] = place(box)
        elif name == "mid":
            import numpy as np
            alpha = np.asarray(im.getchannel("A"))
            solid = np.where(alpha.min(axis=1) == 255)[0]
            cut = int(solid[0]) + 2          # the first row that is all table, and a little under it
            assert (alpha[cut:].min() == 255), "the table should be whole from its far edge down"
            box = (0, cut, im.width, im.height)
            total += jpeg(im.crop(box), "table")
            places["table"] = place(box)
            top = export.bounds(im.crop((0, 0, im.width, cut + 3)), 3)   # (three rows over the table: no seam shows between the two)
            total += png(im.crop(top), "mid")
            places["mid"] = place(top)
        else:
            box = export.bounds(im, 3)
            total += png(im.crop(box), "front")
            places["front"] = place(box)
    print(f"  {genre}: {total / 1024:.0f} KB")
    path = os.path.join(P.REPO, DEST, "cards.json")
    meta = json.load(open(path)) if os.path.exists(path) else {"card": list(CARD), "bleed": BLEED, "modes": {}}
    meta["modes"][genre] = places
    json.dump(meta, open(path, "w"), indent=1)
    return total


if __name__ == "__main__":
    args = sys.argv[1:]
    genres = [a for a in args if a in SCENES] or list(SCENES)
    layers = [a for a in args if a in ("back", "mid", "front")] or ["back", "mid", "front"]
    out = export.scratch("home_cards")
    os.makedirs(out, exist_ok=True)
    for genre in genres:
        if "--write" not in args:   # (--write: only trim and write what was rendered before)
            shoot(genre, layers, out)
        if not os.environ.get("NO_WRITE"):
            write(genre, out)

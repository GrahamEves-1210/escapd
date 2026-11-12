# Home's set (src/screens/hub/WindowBackdrop.tsx): the reading nook's window on a
# rainy night, built once in 3D and rendered from one camera, under one lighting,
# as depth layers the app slides against each other as the phone tilts
# (src/screens/hub/parallax). Back to front:
#
#   sky      the night sky, the moon and its veil: the set's painted backcloth
#            (scripts/brand/window.py paints it to this camera's framing)
#   far      a far line of pines in the haze, a cottage with one lit window
#   near     a nearer, darker line of pines
#            [the app's drifting cloud and the rain on the glass]
#   glass    the wet glass: beads, runs, the room's reflections (window.py)
#   frame    the window: plum-stained wood with real depth (stepped bars), a
#            brass latch on the middle bar, the window's key hung from it
#   sill     the sill, a deep board with a rounded nosing, and the still life
#            on it: three cloth-bound mysteries lying askew, one per mode, their
#            names foil-stamped on the spines in the modes' own faces, a ribbon
#            marker, round spectacles folded on top; a brass chamberstick with a
#            stub of candle, its top pooled, drips down its side
#            [the app's flame, the cat and its mug]
#   fore     the velvet curtains' edges, nearest of all
#
# Light: the kit's studio turned down to a dark room (its cool rim is the moon
# behind the glass), the moon through the panes along the sill, and the candle's
# own flame (a small warm light where the app draws the live flame). Each layer
# is rendered whole, with what stands in front of it hidden from the camera but
# still shading it, and with BLEED pixels of picture beyond the art on every
# side, so a layer can slide without showing an edge or a hole.
#
# The camera looks straight at the window from ELEV above, orthographic.
# Everything is placed in the art's pixels (1290 x 2796: X(), Z()).
#
#   <bpy python> scripts/blender/props/home_set.py              # every layer, then scripts/brand/window.py -> assets/home/set/
#   <bpy python> scripts/blender/props/home_set.py sill frame   # only these layers (then window.py again)
#   <bpy python> scripts/blender/props/home_set.py --flame      # the candle flame's frames -> assets/home/flame.png
#   QUICK=1 ...                                                 # half the pixels, a third of the samples
import json
import random
import math
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import home_parts as P  # noqa: E402  (puts scripts/blender on the path)
import bpy  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

import export  # noqa: E402
import kit  # noqa: E402
import materials as M  # noqa: E402

W, H = 1290, 2796            # the art, pixels (WINDOW_ART in art/nook.ts)
PXU = 165.0                  # pixels a unit: the stack of books is about 2 units long
E = math.radians(P.ELEV)
SILL = 150                   # the sill's top (its back edge, at the glass) above the art's foot, px
F = 64                       # the frame at the sides and the top, px
MUL = 46                     # the bars between the panes, px
DEPTH = 0.22                 # how far the bars stand in front of the glass (y = 0), units
SILL_DEPTH = 1.5
BLEED = 60                   # every layer has this much picture beyond the art, px
CW, CH = W + 2 * BLEED, H + 2 * BLEED
ZT = (H / 2 - SILL) / PXU / math.cos(E)   # the camera's target height: the sill's top is z = 0

# The modes' cloth and foil (docs/ART_DIRECTION.md's palettes, deepened to dyed bookcloth).
CLOTH = {"noir": P.srgb("#6E2D5F"), "crime": P.srgb("#7E1F2C"), "moonlit": P.srgb("#2A3580")}
FOIL = {"noir": (0.90, 0.60, 0.46), "crime": (0.80, 0.56, 0.20), "moonlit": (0.64, 0.74, 0.80)}
CHERRY = P.srgb("#C83D50")
PLUM_WOOD = (0.105, 0.046, 0.056)

# Where things stand on the sill (units; x across, y toward us is negative).
BOOKS = (-2.36, -0.74)
CANDLE = (-0.93, -0.70)
WICK = 1.16                  # the wick's tip above the sill
FLAME = 0.36                 # the flame's height


def X(px):
    return (px - W / 2) / PXU


def Z(px, y=0.0):
    """The height that lands on the art's row `px` (from its top), for a point `y` in front of the glass."""
    return ZT + ((H / 2 - px) / PXU - y * math.sin(E)) / math.cos(E)


def tag(objects, layer):
    """Say which layer of the set these belong to."""
    for ob in objects:
        ob["layer"] = layer
    return objects


# ---------------------------------------------------------------- the window


def frame():
    made = []

    def wood(axis):
        return M.walnut("frame_" + axis, axis=axis, color=PLUM_WOOD, figure=0.55, gloss=0.3, wear=0.5, scale=3.0)

    upright, level = wood("Z"), wood("X")
    step, back = 0.055, 0.10

    def bar(x0, x1, z0, z1, mat, name, along):
        """A bar of the frame: a wider back and a narrower face standing proud of it (a stepped moulding)."""
        inset = (step, 0) if along == "Z" else (0, step)
        a = kit.box((x1 - x0, back + 0.04, z1 - z0), ((x0 + x1) / 2, -back / 2 + 0.02, (z0 + z1) / 2), name, bevel_width=0.02)
        b = kit.box((x1 - x0 - 2 * inset[0], DEPTH - back + 0.02, z1 - z0 - 2 * inset[1]),
                    ((x0 + x1) / 2, -(DEPTH + back) / 2 + 0.01, (z0 + z1) / 2), name + "_face", bevel_width=0.028)
        for ob in (a, b):
            kit.assign(ob, mat)
        made.extend([a, b])

    # Out into the bleed on every side, and down behind the sill (the frame may slide a little against it).
    out, top, foot = BLEED + 50, Z(-BLEED - 50), -0.7
    bar(X(-out), X(F), foot, top, upright, "jamb_left", "Z")
    bar(X(W - F), X(W + out), foot, top, upright, "jamb_right", "Z")
    bar(X(W / 2 - MUL / 2), X(W / 2 + MUL / 2), foot, top, upright, "bar_upright", "Z")
    bar(X(-out), X(W + out), Z(F, -DEPTH) - step, top, level, "rail_top", "X")
    bar(X(F) - 0.05, X(W - F) + 0.05, Z(H / 2 + MUL / 2, -DEPTH) - step, Z(H / 2 - MUL / 2, 0), level, "bar_level", "X")
    return tag(made, "frame")


def sill():
    """The sill: a deep board with a rounded nosing, a bead under it, the apron below."""
    wood = M.walnut("sill", axis="X", color=PLUM_WOOD, figure=0.6, gloss=0.22, wear=0.6, scale=3.0)
    wide = X(W + BLEED + 50) - X(-BLEED - 50)
    board = kit.box((wide, SILL_DEPTH + 0.06, 0.24), (0, -SILL_DEPTH / 2 + 0.03, -0.12), "sill", bevel_width=0.07, segments=4)
    bead = kit.box((wide, 0.12, 0.11), (0, -SILL_DEPTH + 0.13, -0.285), "sill_bead", bevel_width=0.04)
    apron = kit.box((wide, 0.3, 2.2), (0, -SILL_DEPTH + 0.30, -1.3), "apron", bevel_width=0.02)
    for ob in (board, bead, apron):
        kit.assign(ob, wood)
    return tag([board, bead, apron], "sill")


def latch():
    """A brass casement latch on the middle bar, the window's key hung from its knob on a ribbon."""
    brass = M.brass("latch", age=0.55, brushed=0.4, wear=0.7)
    bright = M.brass("key", color=(0.72, 0.47, 0.17), age=0.35, brushed=0.3, wear=0.8, rough=0.26)
    y = -DEPTH
    zc = Z(2212, y)
    made = []
    plate = kit.box((0.17, 0.035, 0.50), (0, y - 0.012, zc), "latch_plate", bevel_width=0.05, segments=4)
    made.append(plate)
    for dz in (-0.19, 0.19):
        screw = kit.lathe([(0, 0.0), (0.022, 0.0), (0.026, 0.006), (0.02, 0.014), (0, 0.016)], name="latch_screw", segments=20)
        screw.rotation_euler = (math.radians(90), 0, 0)
        screw.location = (0, y - 0.028, zc + dz)
        made.append(screw)
    knob = kit.lathe([(0, 0.0), (0.05, 0.0), (0.055, 0.02), (0.04, 0.05), (0.038, 0.075), (0.066, 0.095), (0.072, 0.125), (0.05, 0.15), (0, 0.155)],
                     name="latch_knob", segments=40)
    knob.rotation_euler = (math.radians(90), 0, 0)
    knob.location = (0, y - 0.025, zc + 0.03)
    made.append(knob)
    # The lever: down from the knob, a teardrop end.
    arm = P.tube([(0, y - 0.07, zc + 0.03), (0.015, y - 0.075, zc - 0.10), (0.02, y - 0.07, zc - 0.21)], [0.034, 0.028, 0.03], "latch_arm", segments=12)
    drop = P.ball(0.05, (0.02, y - 0.07, zc - 0.235), "latch_drop", scale=(1, 0.8, 1.25))
    made += [arm, drop]
    for ob in made:
        kit.assign(ob, brass)
    # The key: a ring bow, a collar, the shaft, a notched bit. It hangs a little askew.
    kz = zc - 0.52
    bow = P.ring(0.088, 0.027, "key_bow", segments=40)
    bow.rotation_euler = (math.radians(90), 0, 0)
    kit.apply_transforms(bow)
    collar = kit.lathe([(0, 0.0), (0.03, 0.0), (0.042, 0.012), (0.042, 0.03), (0.03, 0.045), (0, 0.045)], name="key_collar", segments=24)
    collar.location = (0, 0, -0.088 - 0.06)
    shaft = kit.lathe([(0, 0.0), (0.025, 0.0), (0.025, 0.40), (0.018, 0.42), (0, 0.425)], name="key_shaft", segments=20)
    shaft.rotation_euler = (math.radians(180), 0, 0)
    shaft.location = (0, 0, -0.088 - 0.02)
    bit = kit.box((0.11, 0.035, 0.13), (0.065, 0, -0.088 - 0.02 - 0.33), "key_bit", bevel_width=0.008)
    notch = kit.box((0.05, 0.05, 0.035), (0.10, 0, -0.088 - 0.02 - 0.33), "key_notch", bevel_width=0)
    cut = bit.modifiers.new("notch", "BOOLEAN")
    cut.operation, cut.object = "DIFFERENCE", notch
    notch.hide_render = True
    notch.display_type = "WIRE"
    key = [bow, collar, shaft, bit]
    for ob in key:
        kit.assign(ob, bright)
    root = kit.group(key + [notch], "key")
    root.matrix_world = Matrix.Translation((0.012, y - 0.075, kz)) @ Matrix.Rotation(math.radians(-7), 4, "Y")
    # The ribbon: a loop over the knob, through the bow.
    silk = M.felt("ribbon", color=CHERRY, nap=0.9)
    hang = Vector((0.012, y - 0.085, kz + 0.07))
    loop = P.smooth_path([hang, (-0.035, y - 0.10, zc - 0.2), (-0.05, y - 0.105, zc + 0.01), (0.0, y - 0.115, zc + 0.085),
                          (0.05, y - 0.105, zc + 0.01), (0.04, y - 0.10, zc - 0.2), hang + Vector((0.008, 0, 0))], steps=6)
    ribbon = P.tube(loop, 0.02, "key_ribbon", segments=10, flat=0.3)
    kit.assign(ribbon, silk)
    return tag(made + key + [ribbon], "frame"), tag([notch], "frame")


# ---------------------------------------------------------------- the still life


def book(name, size, cloth, foil, title, font, at, turn):
    """A cloth-bound hardback lying flat, its spine to us: boards a little proud of the
    page block, foil bands and its name stamped on the spine. Returns its parts."""
    w, d, t = size
    board, over = 0.036, 0.05
    cover = M.felt(name + "_cloth", color=cloth, nap=0.3)
    stamp = M.brass(name + "_foil", color=foil, age=0.1, brushed=0.1, wear=0.0, rough=0.27)
    pages = M.paper(name + "_pages", color=(0.80, 0.72, 0.58), fibre=0.9, age=0.5)
    parts = []
    for z in (board / 2, t - board / 2):
        parts.append(kit.assign(kit.box((w, d, board), (0, 0, z), name + "_board", bevel_width=0.012), cover))
    parts.append(kit.assign(kit.box((w, board + 0.012, t), (0, -d / 2 + (board + 0.012) / 2, t / 2), name + "_spine", bevel_width=0.016), cover))
    parts.append(kit.assign(kit.box((w - 2 * over, d - over - board, t - 2 * board + 0.004), (0, (board - over) / 2, t / 2), name + "_pages", bevel_width=0.004), pages))
    face = -d / 2 - 0.002
    for side in (-1, 1):
        for inset, wide in ((0.10, 0.03), (0.155, 0.014)):
            parts.append(kit.assign(kit.box((wide, 0.008, t - 0.075), (side * (w / 2 - inset), face, t / 2), name + "_band", bevel_width=0.002), stamp))
        gem = kit.box((0.055, 0.008, 0.055), (side * (w / 2 - 0.27), face, t / 2), name + "_gem", bevel_width=0.002)
        gem.rotation_euler = (0, math.radians(45), 0)
        parts.append(kit.assign(gem, stamp))
    words = P.lettering(title, font, 0.2, name + "_title", depth=0.004)
    k = min((w - 0.80) / words.dimensions.x, t * 0.46 / words.dimensions.z)
    words.scale = (k, 1, k)
    kit.apply_transforms(words)
    words.location = (0, face - 0.001, t / 2)
    parts.append(kit.assign(words, stamp))
    root = kit.group(parts, name)
    root.location = at
    root.rotation_euler = (0, 0, math.radians(turn))
    return parts


def books():
    x, y = BOOKS
    stack = [
        ("noir", (1.84, 1.16, 0.34), "DETECTIVE NOIR", "playfair-display/900Black/PlayfairDisplay_900Black.ttf", (0.0, 0.0), 2.5),
        ("crime", (1.66, 1.08, 0.30), "CRIME SCENE", "fraunces/900Black/Fraunces_900Black.ttf", (0.06, -0.03), -6.5),
        ("moonlit", (1.52, 1.0, 0.27), "Paranormal", "fraunces/600SemiBold_Italic/Fraunces_600SemiBold_Italic.ttf", (-0.05, 0.02), 4.5),
    ]
    made, z = [], 0.0
    for name, size, title, font, (dx, dy), turn in stack:
        made += book(name, size, CLOTH[name], FOIL[name], title, font, (x + dx, y + dy, z), turn)
        z += size[2]
    # A ribbon marker out of the top book's tail, down over the ends of the others.
    top = stack[-1]
    turn = math.radians(top[5])
    end = Vector((x + top[4][0], y + top[4][1], 0)) + Matrix.Rotation(turn, 3, "Z") @ Vector((top[1][0] / 2 - 0.02, -top[1][1] / 2 + 0.2, 0))
    zt = z - top[1][2] / 2
    path = P.smooth_path([end + Vector((-0.12, 0, zt)), end + Vector((0.05, -0.01, zt + 0.005)), end + Vector((0.13, -0.05, zt - 0.10)),
                          end + Vector((0.12, -0.10, zt - 0.34)), end + Vector((0.17, -0.13, zt - 0.56)), end + Vector((0.14, -0.15, zt - 0.70))], steps=6)
    ribbon = P.tube(path, 0.05, "marker", segments=12, flat=0.16)
    kit.assign(ribbon, M.felt("marker", color=CHERRY, nap=0.9))
    made.append(ribbon)
    return tag(made, "sill"), z


def spectacles(z):
    """Round wire spectacles, folded, resting on the top book and leaning back on their arms."""
    wire = M.brass("spectacles", color=(0.70, 0.46, 0.17), age=0.3, brushed=0.2, wear=0.6, rough=0.24)
    r, gap = 0.2, 0.25
    lens_mat = M.glass("spectacle_lens", tint=(0.86, 0.94, 1.0), ior=1.3, haze=0.05, rim=0.35, radius=r, axis="Z")
    parts, lenses = [], []
    for side in (-1, 1):
        rim = P.ring(r, 0.024, "spectacle_rim", segments=48)
        rim.rotation_euler = (math.radians(90), 0, 0)
        kit.apply_transforms(rim)
        rim.location = (side * gap, 0, 0)
        parts.append(rim)
        lens = kit.lathe([(0, 0.012), (r * 0.7, 0.008), (r, 0.0), (r * 0.7, -0.008), (0, -0.012)], name="spectacle_lens", segments=48)
        lens.rotation_euler = (math.radians(90), 0, 0)
        lens.location = (side * gap, 0, 0)
        kit.assign(lens, lens_mat)
        lenses.append(lens)
        # The hinge and the arm, folded across behind the lenses.
        hinge = kit.box((0.05, 0.07, 0.045), (side * (gap + r + 0.02), 0.03, 0.03), "spectacle_hinge", bevel_width=0.01)
        parts.append(hinge)
        y = 0.07 + (0.03 if side > 0 else 0.0)
        arm = P.tube(P.smooth_path([(side * (gap + r + 0.02), 0.05, 0.03), (side * 0.2, y, 0.02), (-side * 0.25, y + 0.01, 0.0),
                                    (-side * 0.42, y, -0.06), (-side * 0.47, y - 0.01, -0.14)], steps=6), 0.019, "spectacle_arm", segments=10)
        parts.append(arm)
    bridge = P.tube(P.smooth_path([(-gap + r * 0.92, 0, 0.07), (-0.03, -0.01, 0.125), (0.03, -0.01, 0.125), (gap - r * 0.92, 0, 0.07)], steps=5), 0.02, "spectacle_bridge", segments=10)
    parts.append(bridge)
    for ob in parts:
        kit.assign(ob, wire)
    root = kit.group(parts + lenses, "spectacles")
    lean = Matrix.Rotation(math.radians(-34), 4, "X")
    x, y = BOOKS
    root.matrix_world = Matrix.Translation((x - 0.08, y - 0.12, z + r + 0.024 - 0.035)) @ Matrix.Rotation(math.radians(-13), 4, "Z") @ lean
    return tag(parts, "sill"), tag(lenses, "sill")


def candle():
    """A brass chamberstick (a drip pan, a socket, a finger ring) and a stub of candle: its top
    pooled round the wick, one long drip run down to the pan, shorter ones beside it.
    Returns (parts, the drips: wax on wax, no ink line between them)."""
    brass = M.brass("chamberstick", age=0.6, brushed=0.5, wear=0.7)
    wax = M.wax("wax", color=(0.86, 0.72, 0.52), translucency=0.7, gloss=0.5)
    cx, cy = CANDLE
    made, soft = [], []
    pan = kit.lathe([(0, 0.0), (0.38, 0.0), (0.43, 0.012), (0.49, 0.065), (0.52, 0.12), (0.515, 0.14), (0.49, 0.135), (0.45, 0.085), (0.38, 0.055),
                     (0.25, 0.05), (0.23, 0.07), (0.20, 0.10), (0.195, 0.14), (0.215, 0.18), (0.235, 0.30), (0.265, 0.325), (0.265, 0.345),
                     (0.24, 0.35), (0.20, 0.335), (0.185, 0.30), (0.185, 0.16), (0, 0.16)], name="chamberstick", segments=96)
    kit.bevel(pan, 0.006)
    made.append(pan)
    # The finger ring on the pan's rim, toward us on the right, and its thumb rest.
    a = math.radians(-38)
    out = Vector((math.cos(a), math.sin(a), 0))
    ring = P.ring(0.125, 0.03, "chamberstick_ring", segments=40)
    ring.matrix_world = Matrix.Translation(out * 0.58 + Vector((0, 0, 0.16))) @ Matrix.Rotation(a, 4, "Z") @ Matrix.Rotation(math.radians(90), 4, "X")
    thumb = kit.lathe([(0, 0.0), (0.085, 0.0), (0.10, 0.012), (0.085, 0.026), (0, 0.03)], name="chamberstick_thumb", segments=32)
    thumb.matrix_world = Matrix.Translation(out * 0.57 + Vector((0, 0, 0.285))) @ Matrix.Rotation(a, 4, "Z") @ Matrix.Rotation(math.radians(-14), 4, "Y")
    made += [ring, thumb]
    for ob in made:
        kit.assign(ob, brass)
    # The candle: a stub, its rim uneven where the wax has run over, the top dished.
    r, top = 0.17, WICK - 0.13
    side = P.smooth_path([(r, 0.16, 0), (r, 0.5, 0), (r, top - 0.06, 0)], steps=6)
    stub = kit.lathe([(0, 0.16)] + [(p.x, p.y) for p in side] + [(r - 0.004, top - 0.02), (r - 0.02, top), (r - 0.045, top - 0.012), (r - 0.08, top - 0.04), (0, top - 0.05)],
                     name="candle", segments=64)
    for v in stub.data.vertices:   # the rim: higher at the back, a low lip where it overflowed
        if v.co.z > top - 0.07:
            ang = math.atan2(v.co.y, v.co.x)
            v.co.z += 0.024 * math.sin(ang * 2 + 0.6) + 0.014 * math.sin(ang * 5 + 2.0) - 0.035 * math.exp(-((ang + 1.15) / 0.35) ** 2)
    made.append(kit.assign(stub, wax))
    pool = P.disc(r - 0.055, top - 0.036, "candle_pool", segments=32)
    made.append(kit.assign(pool, M.wax("molten", color=(0.95, 0.74, 0.40), translucency=0.9, gloss=1.0)))

    def drip(angle, length, fat, bead):
        elements = []
        n = max(3, int(length / 0.035))
        for i in range(n + 1):
            t = i / n
            wob = 0.03 * math.sin(t * 5 + angle * 3)
            at = Vector((math.cos(angle + wob) * (r + 0.004), math.sin(angle + wob) * (r + 0.004), top - 0.02 - t * length))
            elements.append((at, fat * (1.0 - 0.3 * math.sin(t * math.pi)) * 2))
        elements.append((elements[-1][0] + Vector((0, 0, -0.012)), bead * 2))
        return P.blobs(elements, "candle_drip", resolution=0.012)

    soft += [drip(-1.15, 0.60, 0.034, 0.05), drip(-1.8, 0.22, 0.03, 0.042), drip(-0.4, 0.36, 0.028, 0.04)]
    # Wax that has reached the pan.
    soft.append(P.blobs([(Vector((math.cos(-1.15) * 0.27, math.sin(-1.15) * 0.27, 0.345)), 0.12), (Vector((math.cos(-0.95) * 0.29, math.sin(-0.95) * 0.29, 0.33)), 0.08)],
                        "candle_puddle", resolution=0.012))
    # Run wax: duller than the candle it ran down, and lit from within as the candle is (light doesn't pass between two meshes).
    run = M.lit(M.wax("run_wax", color=(0.88, 0.74, 0.54), translucency=0.35, gloss=0.0), (1.0, 0.60, 0.30), float(os.environ.get("RUN", 0.3)))
    for ob in soft:
        kit.assign(ob, run)
    wick = P.tube(P.smooth_path([(0, 0, top - 0.05), (0.004, 0, top + 0.04), (0.02, -0.005, WICK - 0.03), (0.045, -0.01, WICK)], steps=4), [0.016] * 12 + [0.009], "wick", segments=8)
    made.append(kit.assign(wick, M.rubber("wick", color=(0.02, 0.014, 0.012))))
    for ob in made + soft:
        if ob.parent is None:
            ob.matrix_world = Matrix.Translation((cx, cy, 0)) @ ob.matrix_world
    return tag(made, "sill"), tag(soft, "sill")


def flame_at():
    """The middle of the candle's flame (the app draws it, home_sill.py --flame; here it only gives light)."""
    return Vector((CANDLE[0] + 0.02, CANDLE[1], WICK + FLAME * 0.42))


# ---------------------------------------------------------------- outside, and the curtains


def flat(name, colour):
    """A silhouette's paint: its own colour whatever the light (what stands against a night sky has no modelling)."""
    t = M.Tree(name)
    e = t.node("ShaderNodeEmission")
    t.set(e.inputs["Color"], colour)
    return t.surface(e)


def pine(x, base, tall, y, mat, turn):
    """A pine `tall` px high standing on the art's row `base` at column `x`, `y` units behind the glass."""
    h, r = tall / PXU / math.cos(E), tall * 0.22 / PXU
    tiers = 6
    prof = [(0, h)]
    for i in range(tiers):
        zb = h - (i + 1) * h * 0.84 / tiers
        prof += [(r * (i + 1) / tiers, zb), (r * (i + 1) / tiers * 0.42, zb + h * 0.01)]
    prof += [(r * 0.09, h * 0.15), (r * 0.09, -0.4), (0, -0.4)]
    ob = kit.lathe(prof, segments=9, name="pine", smooth=False)
    ob.location = (X(x), y, Z(base, y))
    ob.rotation_euler = (0, 0, turn)
    return kit.assign(ob, mat)


def ridge(rows, y, mat, name):
    """The ground a line of trees stands on: its skyline through the art's rows `rows` (x px -> row px),
    running down behind the sill."""
    xs = list(range(-BLEED - 90, W + BLEED + 91, 30))
    verts = [(X(x), y, Z(rows(x), y)) for x in xs] + [(X(x), y, Z(H + BLEED + 200, y)) for x in xs]
    n = len(xs)
    faces = [(i, i + 1, n + i + 1, n + i) for i in range(n - 1)]
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return kit.assign(ob, mat)


def outside():
    """Beyond the glass: a far line of pines in the haze on a low rise, a cottage among them (one
    window lit), and a nearer, darker line. The ground under each runs down behind the sill."""
    rng = random.Random(7)
    far_mat, near_mat = flat("far", P.srgb("#3F2A55")), flat("near", P.srgb("#1E1429"))
    far, near = [], []
    far_rows = lambda x: 2580 - 26 * math.sin(x / 260 + 0.8) - 12 * math.sin(x / 97)     # noqa: E731
    near_rows = lambda x: 2640 - 18 * math.sin(x / 210 + 2.4) - 8 * math.sin(x / 61)     # noqa: E731
    for row, mat, y, rows, count, lo, hi in ((far, far_mat, 24.0, far_rows, 30, 70, 215), (near, near_mat, 12.0, near_rows, 19, 105, 250)):
        x = -BLEED - 70.0
        while x < W + BLEED + 70:
            tall = rng.uniform(lo, hi)
            # The cottage shows through a gap in both lines.
            if not (650 < x < 830):
                row.append(pine(x, rows(x) + 6, tall, y + rng.uniform(-1, 1), mat, rng.uniform(0, 6)))
            x += rng.uniform(0.25, 1.0) * (W + 2 * BLEED) / count * 1.6
        row.append(ridge(rows, y, mat, "ground"))
    # The cottage: walls, a gable roof, a chimney, one window with the lamp still on.
    cx, y, z = X(742), 22.0, Z(far_rows(742) + 4, 22.0)
    wall, roof = flat("cottage", P.srgb("#34243F")), flat("cottage_roof", P.srgb("#251933"))
    far.append(kit.assign(kit.box((0.62, 0.5, 0.34), (cx, y, z + 0.17), "cottage", bevel_width=0), wall))
    me = bpy.data.meshes.new("cottage_roof")
    me.from_pydata([(-0.37, -0.29, 0.32), (0.37, -0.29, 0.32), (0, -0.29, 0.62), (-0.37, 0.29, 0.32), (0.37, 0.29, 0.32), (0, 0.29, 0.62)], [],
                   [(0, 1, 2), (3, 5, 4), (0, 2, 5, 3), (1, 4, 5, 2), (0, 3, 4, 1)])
    gable = bpy.data.objects.new("cottage_roof", me)
    bpy.context.scene.collection.objects.link(gable)
    gable.location = (cx, y, z)
    far.append(kit.assign(gable, roof))
    far.append(kit.assign(kit.box((0.07, 0.07, 0.2), (cx + 0.19, y, z + 0.54), "chimney", bevel_width=0), roof))
    far.append(kit.assign(kit.box((0.10, 0.02, 0.12), (cx - 0.13, y - 0.26, z + 0.17), "lit_window", bevel_width=0), M.glow("lamplight", (1.0, 0.52, 0.16), 2.6)))
    for ob in far + near:
        ob.visible_shadow = ob.visible_diffuse = ob.visible_glossy = False   # the night outside lends the room nothing but the moon
    return tag(far, "far"), tag(near, "near")


def curtain(x0, x1, hem, name):
    """A velvet curtain's edge, hanging the whole height of the picture between the art's columns
    x0 and x1, nearer the camera than anything else. hem: +1 its free edge is on the right, -1 on the left."""
    y0, nx, nz = -3.2, 44, 36
    top, foot = Z(-BLEED - 80, y0), Z(H + BLEED + 80, y0)
    verts, faces = [], []
    for j in range(nz + 1):
        v = j / nz
        for i in range(nx + 1):
            u = i / nx
            free = u if hem > 0 else 1 - u            # 0 at the wall .. 1 at the free edge
            x = X(x0) + (X(x1) - X(x0)) * u + hem * 0.07 * free * math.sin(v * 7.0 + 1.0)
            fold = 0.17 * math.sin(free * 16.0 + 0.6 * math.sin(v * 5.0) + (0.0 if hem > 0 else 2.0)) * (0.55 + 0.45 * free)
            verts.append((x, y0 + fold, foot + (top - foot) * v))
    for j in range(nz):
        for i in range(nx):
            a = j * (nx + 1) + i
            faces.append((a, a + 1, a + nx + 2, a + nx + 1))
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    thick = ob.modifiers.new("cloth", "SOLIDIFY")
    thick.thickness = 0.04
    kit.subsurf(ob, 1)
    kit.shade(ob, 80)
    return kit.assign(ob, M.felt("velvet", color=P.srgb("#4E1D40"), nap=1.0, scale=3.0))


def curtains():
    """The curtains' edges, and the room's glow raking across their folds (lit only for their own layer)."""
    drapes = [curtain(-BLEED - 60, 58, 1, "curtain_left"), curtain(W - 58, W + BLEED + 60, -1, "curtain_right")]   # a sliver of each jamb shows past them
    lamps = []
    for side, colour, power in ((-1, (1.0, 0.58, 0.40), 520), (1, (0.62, 0.66, 1.0), 560)):
        data = bpy.data.lights.new("drape_light", "AREA")
        data.shape, data.size, data.size_y = "RECTANGLE", 1.5, 16.0
        data.energy, data.color = power, colour
        lamp = bpy.data.objects.new("drape_light", data)
        # From the middle of the room, level with the cloth: it rakes across the folds.
        at = Vector((side * 1.2, -4.6, ZT))
        lamp.location = at
        lamp.rotation_euler = (Vector((side * 4.2, -3.1, ZT)) - at).to_track_quat("-Z", "Y").to_euler()
        lamp["kit_rig"] = True
        bpy.context.scene.collection.objects.link(lamp)
        lamps.append(lamp)
    return tag(drapes, "fore"), lamps


# ---------------------------------------------------------------- light, camera, render


def lights(cam):
    middle = (-1.7, -0.7, 0.55)
    # The house studio, turned down to a room at night: the warm key is the room's lamp glow, the cool rim the moon.
    kit.studio(cam, span=3.2, target=middle, key=float(os.environ.get("KEY", 0.22)), fill=0.45, rim=1.2, ambient=0.5)
    # The candle: a small warm light where its flame burns.
    data = bpy.data.lights.new("candle", "POINT")
    data.energy = float(os.environ.get("CANDLE", 190))
    data.color = (1.0, 0.56, 0.22)
    data.shadow_soft_size = 0.1
    lamp = bpy.data.objects.new("candle", data)
    lamp.location = flame_at()
    lamp["kit_rig"] = True
    bpy.context.scene.collection.objects.link(lamp)
    # The moon, low behind the right-hand panes: its light through the glass lies along the sill.
    sun = bpy.data.lights.new("moon", "SUN")
    sun.energy = float(os.environ.get("MOON", 1.6))
    sun.color = kit.COOL
    sun.angle = math.radians(3.0)
    moon = bpy.data.objects.new("moon", sun)
    moon.rotation_euler = Vector((-0.42, -1.0, -0.42)).to_track_quat("-Z", "Y").to_euler()
    moon["kit_rig"] = True
    bpy.context.scene.collection.objects.link(moon)


QUICK = bool(os.environ.get("QUICK"))
# Each layer's pass: supersampling, samples, whether it gets the ink line, and the part of the
# canvas it is rendered in (left, right, top, bottom, px of the canvas: art px + BLEED).
PASSES = {
    "far": {"ss": 1, "samples": 32, "line": False, "boxes": {"far": (0, CW, CH - 600, CH)}},
    "near": {"ss": 1, "samples": 32, "line": False, "boxes": {"near": (0, CW, CH - 560, CH)}},
    # (The whole frame at the art's own size: twice that is more memory than the line needs; the latch and its key again, finer.)
    "frame": {"ss": 1, "samples": 64, "line": True, "boxes": {"frame": (0, CW, 0, CH), "frame-latch": (BLEED + 580, BLEED + 710, BLEED + 2150, BLEED + 2480, 2)}},
    "sill": {"ss": 2, "samples": 96, "line": True, "boxes": {"sill": (0, CW, CH - 530, CH)}},
    "fore": {"ss": 1, "samples": 48, "line": False, "boxes": {"fore-left": (0, 200, 0, CH), "fore-right": (CW - 200, CW, 0, CH)}},
}


def shoot(layers, out):
    kit.reset()
    kit.setup(size=(CW, CH), transparent_glass=True)
    wood, board = frame(), sill()
    brass, hidden = latch()
    stack, top = books()
    glasses, lenses = spectacles(top)
    stick, drips = candle()
    outside()
    drapes, drape_lamps = curtains()
    cam = kit.camera("front", target=(0, 0, ZT), span=CH / PXU, elev=P.ELEV)
    lights(cam)
    s = bpy.context.scene
    tagged = [o for o in s.objects if "layer" in o.keys()]
    meta_path = os.path.join(out, "set_raw.json")
    meta = json.load(open(meta_path)) if os.path.exists(meta_path) else {}
    art = lambda p: (round(p[0] * CW - BLEED, 1), round(p[1] * CH - BLEED, 1))   # noqa: E731
    meta["anchors"] = {
        "flame": art(kit.project(cam, flame_at())),
        "wick": art(kit.project(cam, (CANDLE[0] + 0.045, CANDLE[1] - 0.01, WICK))),
        "sill": art(kit.project(cam, (0, 0, 0))),
        "sillFront": art(kit.project(cam, (0, -SILL_DEPTH, 0))),
        "paneLeft": art(kit.project(cam, (X(F), 0, Z(F, -DEPTH)))),
        "key": art(kit.project(cam, (0, -DEPTH, Z(2212, -DEPTH)))),
    }
    meta["canvas"] = {"art": [W, H], "bleed": BLEED}
    print("anchors (art px)", meta["anchors"], flush=True)
    for name in layers:
        cfg = PASSES[name]
        ss = max(1, cfg["ss"] // 2) if QUICK else cfg["ss"]
        kit.setup(size=(CW, CH), ss=ss, samples=cfg["samples"] // 3 if QUICK else cfg["samples"], transparent_glass=True)
        for ob in tagged:
            ob.visible_camera = ob["layer"] == name
        for ob in drapes + drape_lamps:   # nearest the camera: in the way of every other layer's line, so only there for their own
            ob.hide_render = name != "fore"
        fs = bpy.context.view_layer.freestyle_settings
        for ls in list(fs.linesets):
            ls.collection = None
            fs.linesets.remove(ls)
        for col in list(bpy.data.collections):
            bpy.data.collections.remove(col)
        if cfg["line"]:
            others = [o for o in tagged if o["layer"] != name and o.type == "MESH"]
            skip = {o.name: o for o in lenses + hidden + drips + others}   # each once
            kit.outline(2.0, exclude=list(skip.values()), plain=[o for o in wood + board if o.name not in skip])
        else:
            kit.no_outline()
        for key, (x0, x1, y0, y1, *finer) in cfg["boxes"].items():
            if finer and not QUICK:
                kit.setup(size=(CW, CH), ss=finer[0], samples=cfg["samples"], transparent_glass=True)
                kit.outline(2.0, exclude=list(skip.values()), plain=[o for o in wood + board if o.name not in skip])
            s.render.use_border = s.render.use_crop_to_border = True
            s.render.border_min_x, s.render.border_max_x = x0 / CW, x1 / CW
            s.render.border_min_y, s.render.border_max_y = 1 - y1 / CH, 1 - y0 / CH
            raw = os.path.join(out, key + "_raw.png")
            kit.render(raw, exr=name == "sill")
            im = export.lift_glass(raw) if name == "sill" else export.load(raw)
            export.resize(im, (x1 - x0, y1 - y0)).save(os.path.join(out, key + ".png"))
            meta[key] = [x0, y0]
            json.dump(meta, open(meta_path, "w"), indent=1)
            print("layer", key, im.size, "->", (x1 - x0, y1 - y0), "at", (x0, y0), flush=True)
        if name == "frame":   # the finer latch, laid into the frame (its edges feathered)
            whole, part = export.load(os.path.join(out, "frame.png")), export.load(os.path.join(out, "frame-latch.png"))
            mask = export.Image.new("L", part.size, 0)
            mask.paste(255, (8, 8, part.width - 8, part.height - 8))
            from PIL import ImageFilter
            whole.paste(part, tuple(meta["frame-latch"]), mask.filter(ImageFilter.GaussianBlur(4)))
            whole.save(os.path.join(out, "frame.png"))
    return meta


# ---------------------------------------------------------------- the flame


FLAME_PT = (13, 24)          # a frame's box in points (three art px each): the flame and a little air (FLAME in art/nook.ts)
FLAME_FOOT = 0.92            # the wick's tip, this far down a frame
# Eight frames, a loop at 12 fps: how tall (x its rest), how far its tip leans (units), how fat.
FLICKER = [(1.0, 0.0, 1.0), (1.06, 0.012, 0.97), (1.12, 0.03, 0.93), (1.04, 0.045, 0.98), (0.94, 0.02, 1.05), (0.9, -0.015, 1.07), (0.97, -0.03, 1.02), (1.03, -0.012, 0.99)]


def flames(out):
    """The candle's flame, frame by frame: a teardrop of light (materials.flame), no line,
    at the set's scale and from its camera's height."""
    paths = []
    span = FLAME_PT[1] * 3 / PXU
    for i, (tall, lean, fat) in enumerate(FLICKER):
        kit.reset()
        kit.setup(size=(FLAME_PT[0] * 3, FLAME_PT[1] * 3), ss=4, samples=48)
        h = FLAME * tall
        prof = [(0, 0.0)] + [(0.085 * fat * math.sin(math.pi * t) ** 0.8 * (1 - 0.55 * t), h * t) for t in [j / 24 for j in range(1, 24)]] + [(0, h)]
        ob = kit.lathe(prof, name="flame", segments=40)
        for v in ob.data.vertices:
            v.co.x += lean * (v.co.z / h) ** 2
        kit.assign(ob, M.flame(strength=float(os.environ.get("FLAME", 0.95)), height=h))
        kit.camera("front", target=(0, 0, (FLAME_FOOT - 0.5) * span / math.cos(E)), span=span, elev=P.ELEV)
        kit.no_outline()
        paths.append(kit.render(os.path.join(out, f"flame_{i}.png")))
    return paths


if __name__ == "__main__":
    args = sys.argv[1:]
    out = export.scratch("home_set")
    os.makedirs(out, exist_ok=True)
    if args and args[0] == "--flame":
        # Every frame whole, in a row (not trimmed: the wick's tip keeps its place in each).
        w, h = FLAME_PT[0] * 3, FLAME_PT[1] * 3
        sheet = export.Image.new("RGBA", (w * len(FLICKER), h), (0, 0, 0, 0))
        for i, path in enumerate(flames(out)):
            sheet.paste(export.resize(export.load(path), (w, h)), (i * w, 0))
        export.write(sheet, os.path.join(P.REPO, "assets/home/flame.png"))
        print("flame: frames", len(FLICKER), "each", (w, h), "px, the wick's tip", FLAME_FOOT, "down")
    else:
        shoot(args or list(PASSES), out)
        if not os.environ.get("NO_COMPOSE"):
            subprocess.run([sys.executable, os.path.join(P.REPO, "scripts/brand/window.py"), out], check=True)

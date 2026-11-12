# The charm board's small things (src/screens/collection):
# - the cat's wardrobe, as the objects themselves: a leather collar with its brass
#   bell, a knitted scarf, round brass spectacles, a tweed deerstalker, and a paw
#   for "just the cat" (the tiles on the board; the cats draw the outfits on
#   themselves, these only show the choice);
# - home's charm chip: a brass skeleton key on its jump ring.
#
#   <bpy python> scripts/blender/props/charms_wardrobe.py [names...]   # -> assets/charms/wear-*.png, chip-key*.png
import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
from shapely import affinity  # noqa: E402
from shapely.ops import unary_union  # noqa: E402

import export  # noqa: E402
import kit  # noqa: E402
import materials as M  # noqa: E402
from charms_designs import circ, lin, shape  # noqa: E402

ICON = 40      # points: a wardrobe tile's picture (CollectionScreen's WEAR)
CHIP = 24      # points: the key in home's chip (CharmChip's KEY)
OUT = os.environ.get("OUT") or export.scratch("charms")
SAMPLES = int(os.environ.get("SAMPLES", 96))


def torus(major, minor, location=(0, 0, 0), rotation=(0, 0, 0), name="torus", scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=72, minor_segments=20, location=location, rotation=rotation)
    ob = bpy.context.object
    ob.name = name
    ob.scale = scale
    kit.shade(ob)
    return ob


def ball(radius, location=(0, 0, 0), scale=(1, 1, 1), name="ball"):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=radius, location=location, segments=48, ring_count=24)
    ob = bpy.context.object
    ob.name = name
    ob.scale = scale
    kit.shade(ob)
    return ob


def rod(radius, a, b, name="rod"):
    """A round bar from a to b."""
    from mathutils import Vector
    a, b = Vector(a), Vector(b)
    bpy.ops.mesh.primitive_cylinder_add(radius=radius, depth=(b - a).length, vertices=32, location=(a + b) / 2)
    ob = bpy.context.object
    ob.name = name
    ob.rotation_euler = (b - a).to_track_quat("Z", "Y").to_euler()
    kit.shade(ob)
    kit.bevel(ob, radius * 0.4)
    return ob


# ---------------------------------------------------------------- the outfits


def collar():
    """A leather collar, buckled, its brass bell hanging at the front."""
    leather = M.leather("collar", color=lin("#7A3F24"), grain=0.5, wear=0.7)
    brass = M.brass("bell", color=(0.80, 0.55, 0.19), age=0.2, brushed=0.15, wear=0.6, rough=0.2)
    dark = M.rubber("slit", (0.02, 0.012, 0.016))
    band = kit.lathe([(0.74, 0.0), (0.84, 0.0), (0.87, 0.04), (0.87, 0.26), (0.84, 0.30), (0.74, 0.30), (0.71, 0.26), (0.71, 0.04), (0.74, 0.0)], name="band", segments=120)
    kit.bevel(band, 0.012)
    kit.assign(band, leather)
    parts = [band]
    # The buckle, round to the right of the front.
    a = math.radians(42)
    frame = kit.box((0.30, 0.06, 0.40), (0.875 * math.sin(a), -0.875 * math.cos(a), 0.15), "buckle", bevel_width=0.025)
    frame.rotation_euler = (0, 0, a)
    kit.assign(frame, brass)
    tongue = kit.box((0.22, 0.05, 0.07), (0.90 * math.sin(a), -0.90 * math.cos(a), 0.15), "tongue", bevel_width=0.02)
    tongue.rotation_euler = (0, 0, a)
    kit.assign(tongue, brass)
    hole = kit.box((0.17, 0.08, 0.26), (0.885 * math.sin(a), -0.885 * math.cos(a), 0.15), "buckle_in", bevel_width=0.02)
    hole.rotation_euler = (0, 0, a)
    kit.assign(hole, leather)
    # The bell on its ring.
    y = -0.93
    ring = torus(0.085, 0.024, (0, y + 0.03, -0.02), (0, math.radians(90), 0), "ring")
    kit.assign(ring, brass)
    bell = ball(0.30, (0, y, -0.36), name="bell")
    kit.assign(bell, brass)
    waist = torus(0.30, 0.026, (0, y, -0.36), name="waist")
    kit.assign(waist, brass)
    slit = kit.box((0.045, 0.2, 0.22), (0, y - 0.22, -0.52), "slit", bevel_width=0.015)
    kit.assign(slit, dark)
    eye = ball(0.05, (0, y - 0.285, -0.42), name="eye")
    kit.assign(eye, dark)
    parts += [frame, hole, tongue, ring, bell, waist, slit, eye]
    return parts, dict(view="held", elev=30.0)


def striped(material, color, mask):
    """Paint stripes into a shelf material: `mask(tree, position)` returns 0..1 (1 = stripe)."""
    nt = material.node_tree
    pr = [n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"][0]
    base = pr.inputs["Base Color"].links[0].from_socket
    t = M.Tree.__new__(M.Tree)
    t.mat, t.nt = material, nt
    tc = t.node("ShaderNodeTexCoord")
    mix = t.mix(mask(t, tc.outputs["Object"]), base, color)
    nt.links.new(mix, pr.inputs["Base Color"])
    return material


def scarf():
    """A knitted scarf, wound once and knotted, its two ends hanging: cream with plum stripes."""
    cream, plum = lin("#E6D8BC"), lin("#5A2E4A")

    def round_the_loop(t, pos):  # stripes by the angle round the neck
        sep = t.node("ShaderNodeSeparateXYZ")
        t.link(pos, sep.inputs[0])
        ang = t.math("ARCTAN2", sep.outputs["Y"], sep.outputs["X"])
        return t.math("GREATER_THAN", t.math("SINE", t.math("MULTIPLY", ang, 7.0)), 0.45)

    def down_the_end(t, pos):  # stripes along its length
        sep = t.node("ShaderNodeSeparateXYZ")
        t.link(pos, sep.inputs[0])
        return t.math("GREATER_THAN", t.math("SINE", t.math("ADD", t.math("MULTIPLY", sep.outputs["Z"], 17.0), 1.2)), 0.45)

    loop = torus(0.60, 0.25, (0, 0, 0.0), name="loop", scale=(1.08, 0.92, 0.8))
    kit.assign(loop, striped(M.felt("wool", color=cream, nap=0.5), plum, round_the_loop))
    parts = [loop]
    knot = ball(0.26, (0.02, -0.60, -0.10), (1.05, 0.8, 0.85), "knot")
    kit.assign(knot, M.felt("knot", color=cream, nap=0.5))
    parts.append(knot)
    ends = striped(M.felt("ends", color=cream, nap=0.5), plum, down_the_end)
    for x, length, lean in ((-0.17, 0.98, -17), (0.20, 0.76, 15)):
        root = bpy.data.objects.new("end", None)
        bpy.context.scene.collection.objects.link(root)
        root.location = (x, -0.66, -0.16)
        root.rotation_euler = (math.radians(6), math.radians(lean), 0)
        end = kit.box((0.40, 0.13, length), (0, 0, -length / 2), "end", bevel_width=0.05, segments=4)
        kit.assign(end, ends)
        end.parent = root
        parts.append(end)
        for i in range(4):  # a fringe
            tuft = kit.box((0.06, 0.07, 0.13), (-0.14 + i * 0.093, 0, -length - 0.04), "tuft", bevel_width=0.02)
            kit.assign(tuft, M.felt("tuft", color=cream, nap=0.5))
            tuft.parent = root
            parts.append(tuft)
    return parts, dict(view="held", elev=24.0)


def specs():
    """Round brass spectacles, their arms folded open behind."""
    brass = M.brass("specs", color=(0.80, 0.55, 0.19), age=0.15, brushed=0.1, wear=0.5, rough=0.2)
    t = M.Tree("lens")
    gl = t.principled(**{"Base Color": (0.85, 0.92, 1.0), "Roughness": 0.05, "Specular IOR Level": 1.0, "Coat Weight": 1.0})
    tr = t.node("ShaderNodeBsdfTransparent")
    mix = t.node("ShaderNodeMixShader")
    t.set(mix.inputs[0], t.math("ADD", 0.045, t.math("MULTIPLY", t.math("POWER", t.facing(0.4), 2.0), 0.35), clamp=True))
    t.link(tr.outputs[0], mix.inputs[1])
    t.link(gl.outputs[0], mix.inputs[2])
    lens_mat = t.surface(mix)
    parts, glassy = [], []
    up = (math.radians(90), 0, 0)
    for x in (-0.52, 0.52):
        rim = torus(0.40, 0.058, (x, 0, 0), up, "rim")
        kit.assign(rim, brass)
        lens = kit.lathe([(0, 0.02), (0.39, 0.005), (0.39, -0.005), (0, -0.02)], name="lens", segments=64)
        lens.rotation_euler = up
        lens.location = (x, 0, 0)
        kit.assign(lens, lens_mat)
        glassy.append(lens)
        side = 1 if x > 0 else -1
        hinge = kit.box((0.10, 0.10, 0.12), (x + side * 0.45, 0.02, 0.05), "hinge", bevel_width=0.02)
        kit.assign(hinge, brass)
        arm = rod(0.035, (x + side * 0.47, 0.03, 0.05), (x + side * 0.50, 0.95, 0.02), "arm")
        kit.assign(arm, brass)
        tip = rod(0.04, (x + side * 0.50, 0.93, 0.03), (x + side * 0.50, 1.12, -0.16), "tip")
        kit.assign(tip, brass)
        parts += [rim, hinge, arm, tip]
    bridge = torus(0.16, 0.045, (0, 0, 0.02), up, "bridge")
    # Only the top half of the bridge's ring: cut the rest away.
    cut = bridge.modifiers.new("cut", "BOOLEAN")
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, -0.48))
    box = bpy.context.object
    box.scale = (1, 1, 1)
    box.hide_render = True
    box["kit_rig"] = True
    cut.object, cut.operation = box, "DIFFERENCE"
    kit.assign(bridge, brass)
    parts.append(bridge)
    return parts + glassy, dict(view="product", elev=16.0, azim=24.0, glassy=glassy, hidden=[box])


def deerstalker():
    """A tweed deerstalker, seen from its side: a peak fore and aft, the ear flap tied
    up over the crown with a bow."""
    tweed = M.felt("tweed", color=lin("#9A7648"), nap=0.35)
    flap = M.felt("flap", color=lin("#6A4A2C"), nap=0.35)
    crown = kit.lathe([(0, 0), (0.66, 0), (0.67, 0.14), (0.62, 0.34), (0.49, 0.52), (0.27, 0.63), (0, 0.66)], name="crown", segments=96)
    crown.scale = (1, 1.14, 1)
    kit.assign(crown, tweed)
    parts = [crown]
    for side in (-1, 1):
        peak = kit.lathe([(0, 0), (0.50, 0), (0.54, 0.04), (0.50, 0.08), (0, 0.09)], name="peak", segments=72)
        peak.scale = (0.95, 0.9, 1)
        peak.location = (0, side * 0.78, 0.0)
        peak.rotation_euler = (math.radians(-side * 17), 0, 0)
        kit.assign(peak, flap)
        parts.append(peak)
        ear = ball(0.34, (side * 0.585, 0, 0.26), (0.26, 1.0, 1.0), "ear")
        ear.rotation_euler = (0, math.radians(side * 17), 0)
        kit.assign(ear, flap)
        parts.append(ear)
        # The bow's loops, fore and aft of the knot.
        tie = torus(0.10, 0.032, (0, side * 0.11, 0.70), (math.radians(90 + side * 28), 0, math.radians(90)), "tie")
        kit.assign(tie, flap)
        parts.append(tie)
    knot = ball(0.07, (0, 0, 0.69), (1, 1, 0.8), "knot")
    kit.assign(knot, flap)
    parts.append(knot)
    return parts, dict(view="product", elev=13.0, azim=74.0)


def paw():
    """Just the cat: a paw's pads, plump, in the cat's cream."""
    import charms_pins as P
    pad = "M20 21 C25.5 21 29.5 26 29.5 29.5 C29.5 32.5 27 33.5 24.5 32.8 C22.5 32.3 21.5 31.6 20 31.6 C18.5 31.6 17.5 32.3 15.5 32.8 C13 33.5 10.5 32.5 10.5 29.5 C10.5 26 14.5 21 20 21 Z"
    pads = [shape(pad), shape(circ(10.6, 18.2, 2.9)), shape(circ(16.4, 13.0, 2.9)), shape(circ(23.6, 13.0, 2.9)), shape(circ(29.4, 18.2, 2.9))]
    # The 40 box, grown to fill the charms' 64 box (the pin builder's units).
    place = lambda g: affinity.translate(affinity.scale(g, 2.25, 2.25, origin=(20, 22.5)), 12, 9.5)
    pads = [place(p) for p in pads]
    cream = M.wax("pad", color=lin("#E9DCCB"), translucency=0.25, gloss=0.25)
    parts = []
    line = P.slab(unary_union(pads).buffer(0.55 * 64 / (ICON * 3) * 2.0, 16), 0.012, name="ink", dome=0)
    kit.assign(line, M.ink())
    parts.append(line)
    for p in pads:
        ob = P.slab(p.simplify(0.05), 0.20, name="pad", dome=0)
        kit.bevel(ob, 0.085, segments=5, angle=40)
        kit.shade(ob, 50)
        kit.assign(ob, cream)
        parts.append(ob)
    return parts, dict(view="top", azim=-90.0, flat=0.85)


def key():
    """Home's charm chip: a brass skeleton key hanging on its jump ring, chunky enough to read at 24 pt."""
    # Bright, barely aged, a little satin: at 24 pt on the chip's near-black disc it has to read as gold at a glance.
    brass = M.brass("key", color=(0.95, 0.68, 0.26), age=0.0, brushed=0.3, wear=0.8, rough=0.34)
    up = (math.radians(90), 0, 0)
    ring = torus(0.20, 0.068, (0, 0.04, 0.80), up, "ring")
    bow = torus(0.36, 0.135, (0, 0, 0.22), up, "bow")
    shaft = rod(0.125, (0, 0, -0.10), (0, 0, -1.0), "shaft")
    bead = torus(0.15, 0.07, (0, 0, -0.24), name="bead")
    bit1 = kit.box((0.40, 0.19, 0.24), (0.26, 0, -0.62), "bit", bevel_width=0.05)
    bit2 = kit.box((0.32, 0.19, 0.19), (0.22, 0, -0.90), "bit", bevel_width=0.05)
    parts = [ring, bow, shaft, bead, bit1, bit2]
    for p in parts:
        kit.assign(p, brass)
    root = kit.group(parts, "key")
    root.rotation_euler = (0, math.radians(16), 0)
    return parts, dict(view="front", key=1.5, fill=2.5)


THINGS = {"collar": (collar, ICON, "wear-collar"), "scarf": (scarf, ICON, "wear-scarf"), "specs": (specs, ICON, "wear-specs"),
          "deerstalker": (deerstalker, ICON, "wear-deerstalker"), "none": (paw, ICON, "wear-none"), "key": (key, CHIP, "chip-key")}


def shoot(name):
    build, pts, file = THINGS[name]
    kit.reset()
    kit.setup(size=(pts * 3, pts * 3), samples=SAMPLES)
    parts, opt = build()
    cam = kit.camera(opt.get("view", "product"), elev=opt.get("elev"), azim=opt.get("azim"))
    kit.fit(cam, parts, margin=1.1)
    span = cam.data.ortho_scale
    if opt.get("flat"):
        # A flat lay like the pins (charms_pins.py): its ink line is modelled, its shadow the board's.
        kit.studio(cam, span=span, target=(0, 0, 0), key=opt["flat"], warm=(1.0, 0.90, 0.76), shadow=0.0, shadow_strength=0.5, shadow_reach=0.06)
        kit.no_outline()
    else:
        kit.studio(cam, span=span, target=(0, 0, 0), key=opt.get("key", 1.0), fill=opt.get("fill", 1.0))
        kit.outline(2.0, exclude=opt.get("glassy", ()), plain=[o for o in bpy.context.scene.objects if o.get("seam")])
    src = kit.render(os.path.join(OUT, file + ".png"))
    return export.export(src, f"assets/charms/{file}.png", sizes=(pts, pts))


if __name__ == "__main__":
    names = [a for a in sys.argv[1:] if a in THINGS] or list(THINGS)
    total = sum(shoot(n) for n in names)
    items = [(n, os.path.join(export.REPO, f"assets/charms/{THINGS[n][2]}@3x.png")) for n in names]
    print("sheet", export.sheet(items, os.path.join(OUT, "wardrobe-sheet.png"), grounds=((0x1E, 0x15, 0x25), "noir", "paper"), height=240, also_actual=ICON))
    print(f"total {len(names) * 3} files, {total / 1024:.1f} KB")

# Noir's way out (src/play2/Ending.tsx, the moment before the reply letter):
# the door swings open onto a wet street at night.
# - end-noir-street.jpg: what's outside, seen from the doorway: rain, the far
#   side of the street with a few lit windows, a streetlamp and its light run
#   down the wet road toward the door.
# - end-noir-door.jpg, end-noir-casing.png: the door from inside, shut, and the
#   casing round it (the opening cut clear). The app hangs the leaf in the
#   casing and swings it on its hinges (a 3D turn of the flat picture), the
#   street behind it.
#
#   <bpy python> scripts/blender/props/moment_noir.py [street] [door]
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import moment_common as C  # noqa: E402
from moment_common import I, M, Matrix, Vector, bpy, export, kit  # noqa: E402

STREET = (280, 560)            # points: the street fills the doorway and a margin for the push in; exported at x1.5
LEAF = (240, 504)              # points: the door's leaf (the opening)
CASING = 26                    # points: the casing's width round it
DW, DH = 1.0, 2.1              # the leaf, units


def flat(name, colour, strength=1.0):
    t = M.Tree(name)
    e = t.node("ShaderNodeEmission")
    t.set(e.inputs["Color"], colour)
    e.inputs["Strength"].default_value = strength
    return t.surface(e)


def wet(name):
    """A wet road: nearly black, a mirror broken up by its cobbles, standing water smoother still."""
    t = M.Tree(name)
    cob = t.node("ShaderNodeTexVoronoi", feature="DISTANCE_TO_EDGE")
    t.link(t.coords((4.6, 7.0, 1.0)), cob.inputs["Vector"])
    cob.inputs["Scale"].default_value = 1.0
    joints = t.ramp(cob.outputs["Distance"], [(0.0, 0.0), (0.08, 1.0)])
    pool = t.ramp(t.noise(t.coords((0.35, 0.22, 1.0)), scale=1.0, detail=2), [(0.42, 0.0), (0.6, 1.0)])
    rough = t.math("ADD", 0.09, t.math("MULTIPLY", t.math("SUBTRACT", 1.0, pool), 0.17))
    b = t.principled(**{"Base Color": (0.012, 0.010, 0.016), "Roughness": rough, "Specular IOR Level": 0.9,
                        "Normal": t.bump(t.math("MULTIPLY", joints, t.math("SUBTRACT", 1.0, pool)), strength=0.32, distance=0.02)})
    return t.surface(b)


def street(path):
    w, h = int(STREET[0] * 1.5), int(STREET[1] * 1.5)
    C.setup((w, h), samples=int(os.environ.get("SAMPLES", 64)))
    s = bpy.context.scene
    s.render.film_transparent = False
    world = bpy.data.worlds.new("night")
    s.world = world
    world.use_nodes = True
    nt = world.node_tree
    nt.nodes.clear()
    sky = nt.nodes.new("ShaderNodeBackground")
    sky.inputs["Color"].default_value = (0.010, 0.010, 0.026, 1)
    sky.inputs["Strength"].default_value = 1.0
    nt.links.new(sky.outputs[0], nt.nodes.new("ShaderNodeOutputWorld").inputs["Surface"])
    rnd = random.Random(7)

    road = I.mesh([(-30, -8, 0), (30, -8, 0), (30, 7.2, 0), (-30, 7.2, 0)], [(0, 1, 2, 3)], "road")
    kit.assign(road, wet("wet"))
    kerb = kit.box((60, 2.4, 0.16), (0, 8.4, 0.08), "kerb", bevel_width=0.03)
    kit.assign(kerb, M.rubber("kerb", color=(0.035, 0.03, 0.04), rough=0.5))
    # The far side: a dark front, its windows lit, a shop's door under an awning.
    brick = M.rubber("brick", color=(0.030, 0.020, 0.030), rough=0.85, dust=0.6, scale=6)
    front = kit.box((30, 0.6, 12), (0, 9.9, 6), "front", bevel_width=0.0)
    kit.assign(front, brick)
    made = [kerb, front]
    glows = []
    panes = [(-2.9, 4.6, 0.9), (-1.1, 4.6, 0.25), (0.7, 4.6, 0.0), (2.6, 4.6, 0.7), (-2.9, 7.4, 0.0), (-1.1, 7.4, 0.5), (0.7, 7.4, 0.0), (2.6, 7.4, 0.0), (-1.9, 1.75, 0.35)]
    for x, z, lit in panes:
        wide, tall = (1.9, 2.2) if z < 3 else (1.0, 1.7)
        sill = kit.box((wide + 0.3, 0.2, 0.12), (x, 9.55, z - tall / 2 - 0.06), "sill", bevel_width=0.02)
        head = kit.box((wide + 0.2, 0.16, 0.14), (x, 9.57, z + tall / 2 + 0.07), "head", bevel_width=0.02)
        for ob in (sill, head):
            kit.assign(ob, brick)
            made.append(ob)
        pane = I.mesh([(x - wide / 2, 9.58, z - tall / 2), (x + wide / 2, 9.58, z - tall / 2), (x + wide / 2, 9.58, z + tall / 2), (x - wide / 2, 9.58, z + tall / 2)], [(0, 1, 2, 3)], "pane")
        kit.assign(pane, flat("pane%d" % len(glows), (1.0, 0.62, 0.30) if lit else (0.02, 0.025, 0.05), 2.2 * lit if lit else 1.0))
        glows.append(pane)
        for bar in ((0.05, tall, 0, 0), (wide, 0.05, 0, 0.12 * tall)):
            m = kit.box((bar[0], 0.05, bar[1]), (x + bar[2], 9.54, z + bar[3]), "bar", bevel_width=0.0)
            kit.assign(m, brick)
            made.append(m)
    awning = I.mesh([(-3.2, 9.6, 3.25), (-0.6, 9.6, 3.25), (-0.6, 8.5, 2.85), (-3.2, 8.5, 2.85)], [(0, 1, 2, 3)], "awning")
    kit.assign(awning, M.felt("awning", color=(0.10, 0.02, 0.06)))
    made.append(awning)

    # The lamp: a cast-iron post on the far kerb, its lantern alight.
    iron = M.steel("iron", color=(0.02, 0.02, 0.03), blue=0.3, rough=0.5, wear=0.2)
    lx, ly = 0.98, 2.7
    post = kit.lathe([(0, 0.16), (0.17, 0.16), (0.17, 0.5), (0.10, 0.62), (0.07, 0.9), (0.055, 3.3), (0.09, 3.36), (0.09, 3.44), (0.05, 3.5), (0, 3.5)], name="post", segments=24)
    arm = kit.box((0.5, 0.035, 0.035), (0, 0, 3.05), "arm", bevel_width=0.01)
    cap = kit.lathe([(0, 4.14), (0.03, 4.12), (0.06, 4.02), (0.26, 3.94), (0.27, 3.9), (0, 3.9)], name="cap", segments=4, smooth=False)
    cage = kit.lathe([(0.10, 3.5), (0.12, 3.52), (0.235, 3.9), (0.225, 3.9), (0.11, 3.54), (0.10, 3.5)], name="cage", segments=4, smooth=False)
    for ob in (post, arm, cap, cage):
        kit.assign(ob, iron)
        made.append(ob)
    C.move([post, arm, cap, cage], Matrix.Translation((lx, ly, 0)))
    cage.display_type = "WIRE"
    wire = cage.modifiers.new("wire", "WIREFRAME")
    wire.thickness = 0.022
    bulb = I.sphere(0.115, (lx, ly, 3.7), (1, 1, 1.25), "bulb")
    kit.assign(bulb, M.glow("bulb", (1.0, 0.74, 0.40), 26.0))
    glows.append(bulb)
    data = bpy.data.lights.new("lamp", "POINT")
    data.energy, data.color, data.shadow_soft_size = 700, (1.0, 0.70, 0.40), 0.12
    lamp = bpy.data.objects.new("lamp", data)
    s.collection.objects.link(lamp)
    lamp.location = (lx, ly - 0.3, 3.62)
    # Our side's pavement, the lamp standing at its edge.
    near = kit.box((60, 6.0, 0.14), (0, -0.4, 0.07), "pavement", bevel_width=0.03)
    kit.assign(near, wet("flags"))
    C.move([post, arm, cap, cage], Matrix.Translation((0, 0, 0.14)))
    # A cold wash from up the street, so the road and the front aren't lost.
    kit._area("moon", (-9, 2, 10), (0, 7, 1), 6.0, 900, (0.45, 0.55, 1.0), None)

    # Rain: short pale strokes falling a little aslant, nearer ones longer.
    rain = flat("rain", (0.55, 0.62, 0.80), 0.55)
    for _ in range(170):
        y = rnd.uniform(-3.0, 8.5)
        x, z = rnd.uniform(-5.5, 5.5) * (0.4 + (y + 3) / 14), rnd.uniform(0.2, 8.5)
        ln = rnd.uniform(0.25, 0.5)
        drop = I.paint(I.tube([(x, y, z), (x + 0.08 * ln, y, z - ln)], 0.0045 + 0.002 * rnd.random(), "rain", smooth=False), rain)
        glows.append(drop)

    cam = kit.camera("front", target=(0.2, 8.0, 2.75))
    cam.data.type = "PERSP"
    cam.data.lens = 50
    cam.data.sensor_fit = "VERTICAL"
    cam.data.sensor_height = 36
    cam.location = (0.0, -5.2, 1.7)
    cam.rotation_euler = (Vector((0.3, 8.0, 1.8)) - cam.location).to_track_quat("-Z", "Y").to_euler()
    C.line(1.6, exclude=glows + [road, near], plain=[front])
    kit.render(path)
    return path


def door(path):
    """The leaf shut in its casing, straight on. Returns the opening's box as shares of the picture."""
    pt = LEAF[0] / DW                                   # points a unit
    size = (LEAF[0] + 2 * CASING, LEAF[1] + CASING)     # the casing has no foot: the door stands on the floor
    C.setup((size[0] * 2, size[1] * 2), samples=int(os.environ.get("SAMPLES", 16)))
    wood = M.walnut("door", axis="Z", color=(0.085, 0.030, 0.030), figure=0.5, gloss=0.35, wear=0.25, scale=1.4)
    trim = M.walnut("casing", axis="Z", color=(0.060, 0.022, 0.026), figure=0.4, gloss=0.3, wear=0.2, scale=1.4)
    brass = M.brass("knob", age=0.6, wear=0.7)
    made, plain = [], []
    # Stiles and rails round four sunk panels.
    st, rail = 0.13, 0.15
    holes = []
    for (y0, y1) in ((0.17, 0.92), (1.10, 1.93)):
        for (x0, x1) in ((-DW / 2 + st, -0.045), (0.045, DW / 2 - st)):
            holes.append(I.rounded(x1 - x0, y1 - y0, 0.012, (x0 + x1) / 2, (y0 + y1) / 2))
    frame = I.plate(I.rounded(DW - 0.012, DH - 0.012, 0.006, 0, DH / 2), 0.05, holes=holes, z=0, round_=0.012, name="leaf")
    panels = I.plate(I.rounded(DW - 0.1, DH - 0.1, 0.006, 0, DH / 2), 0.022, z=0, round_=0.004, name="panels")
    for ob in (frame, panels):
        ob.rotation_euler = (math.pi / 2, 0, 0)         # stood up, facing the camera
        kit.apply_transforms(ob)
        ob.location = (0, 0, 0)
        kit.assign(ob, wood)
        made.append(ob)
    knob = kit.lathe([(0, 0.0), (0.05, 0.0), (0.052, 0.012), (0.022, 0.02), (0.02, 0.05), (0.045, 0.066), (0.058, 0.09), (0.05, 0.116), (0.02, 0.128), (0, 0.13)], name="knob", segments=40)
    knob.rotation_euler = (math.pi / 2, 0, 0)
    knob.location = (DW / 2 - st / 2, -0.025, 1.01)
    plate = I.plate(I.rounded(0.05, 0.13, 0.02, DW / 2 - st / 2, 0.84), 0.01, z=0, round_=0.004, name="escutcheon")
    plate.rotation_euler = (math.pi / 2, 0, 0)
    plate.location = (0, -0.03, 0)
    hole = I.plate(I.circle(0.011, 12, DW / 2 - st / 2, 0.85) , 0.004, z=0, round_=0.001, name="keyhole")
    hole.rotation_euler = (math.pi / 2, 0, 0)
    hole.location = (0, -0.037, 0)
    kit.assign(hole, M.ink("keyhole"))
    for ob in (knob, plate):
        kit.assign(ob, brass)
        made.append(ob)
    # The casing: two jambs and a head, moulded.
    c = CASING / pt
    ring = [(-DW / 2 - c, 0), (-DW / 2 - c, DH + c), (DW / 2 + c, DH + c), (DW / 2 + c, 0), (DW / 2, 0), (DW / 2, DH), (-DW / 2, DH), (-DW / 2, 0)]
    for thick, grow in ((0.05, 0.0), (0.075, -0.035)):
        from shapely.geometry import Polygon
        g = Polygon(ring).buffer(grow, join_style=2)
        ob = I.plate(list(g.exterior.coords)[:-1], thick, z=0, round_=0.008, name="casing")
        ob.rotation_euler = (math.pi / 2, 0, 0)
        kit.apply_transforms(ob)
        ob.location = (0, 0, 0)
        kit.assign(ob, trim)
        made.append(ob)
    cam = kit.camera("front", target=(0, 0, (DH + c) / 2), span=(DH + c))
    kit.studio(cam, span=2.0, target=(0, 0, DH / 2), key=0.5, fill=0.7, rim=0.5, ambient=0.6)
    C.line(3.0, exclude=[hole])
    kit.render(path)
    a, b = kit.project(cam, (-DW / 2, 0, DH)), kit.project(cam, (DW / 2, 0, 0))
    return (a[0], a[1], b[0], b[1])


if __name__ == "__main__":
    what = sys.argv[1:] or ["street", "door"]
    total = 0
    if "street" in what:
        src = street(C.scratch("noir_street.png"))
        im = export.load(src)
        if not C.PREVIEW:
            im = export.bloom(im, radius=0.05, strength=0.9, threshold=0.82)   # the lamp's halo in the wet air
        im = im.convert("RGB")
        if C.PREVIEW:
            print("preview", src)
        else:
            dest = os.path.join(export.REPO, C.OUT, "end-noir-street.jpg")
            im.save(dest, quality=84, optimize=True, progressive=True)
            total += os.path.getsize(dest)
            print(f"  {C.OUT}/end-noir-street.jpg {im.size} {os.path.getsize(dest) / 1024:.1f} KB (shown at {STREET} pt)")
    if "door" in what:
        src = C.scratch("noir_door.png")
        box = door(src)
        im = export.load(src)
        x0, y0, x1, y1 = [round(v * n) for v, n in zip(box, (im.width, im.height, im.width, im.height))]
        print("the opening, as shares of the casing's picture:", [round(v, 4) for v in box], "leaf", LEAF, "pt, casing", (LEAF[0] + 2 * CASING, LEAF[1] + CASING), "pt")
        if C.PREVIEW:
            print("preview", src)
        else:
            leaf = im.crop((x0, y0, x1, y1))
            back = export.Image.new("RGBA", leaf.size, (12, 6, 8, 255))
            back.alpha_composite(leaf)
            dest = os.path.join(export.REPO, C.OUT, "end-noir-door.jpg")
            back.convert("RGB").save(dest, quality=84, optimize=True)
            total += os.path.getsize(dest)
            print(f"  {C.OUT}/end-noir-door.jpg {leaf.size} {os.path.getsize(dest) / 1024:.1f} KB")
            casing = im.copy()
            casing.paste((0, 0, 0, 0), (x0 + 2, y0 + 2, x1 - 2, im.height))
            total += export.write(casing, os.path.join(export.REPO, C.OUT, "end-noir-casing.png"))
    print(f"total {total / 1024:.1f} KB")

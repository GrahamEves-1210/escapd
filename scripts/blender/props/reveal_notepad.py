# The spiral notepad's binding (src/play2/tools/RubSheet.tsx): the wire coil through its
# punched holes and the stub of the sheet that was torn off, as one strip the game lays over
# the top of its live page (the page stays drawn: the rubbing goes down on it). The stub's
# torn edge lifts a little and throws a soft shadow on the page, kept in the alpha.
#
# The picture is the pad's top band seen from above: the pad is 290 pt wide (RubSheet's padW
# on a phone; narrower pads scale the strip), its top-left corner at PAD in the picture.
#
#   <bpy python> scripts/blender/props/reveal_notepad.py [outdir]   # writes assets/reveal/notepad-binding*.png, prints PAD
import random

from reveal_common import *  # noqa: F401,F403

PT = 100.0             # points per unit
PAD_W = 290.0          # the pad's width in points
BIND = 34.0            # the band the wire runs through (RubSheet.BIND)
MARGIN_X, ABOVE, BELOW = 6.0, 16.0, 50.0
W, H = PAD_W + 2 * MARGIN_X, ABOVE + BELOW
LOOPS = int((PAD_W - 20) // 17)          # as RubSheet counted them: 15
STEP = (PAD_W - 20) / LOOPS


def build():
    rnd = random.Random(23)
    # The stub is a sheet of the pad: it has to come out the live page's cream (RubSheet.PAGE, #F4EEDD), and
    # the studio lights matte things low and warm (white paper renders tan). So most of its colour is its
    # own (lit), and what the lights add falls on a cooler, darker base that cancels the key's orange.
    paper = M.lit(M.paper("stub", color=(0.55, 0.60, 0.70), fibre=0.3, age=0.0, scale=1.5), (0.905, 0.855, 0.72), 0.6)
    wire = M.silver("wire", color=(0.74, 0.75, 0.80), rough=0.2, tarnish=0.2, scale=1.5)
    hole = M.ink("hole", (0.022, 0.014, 0.020))
    hw = PAD_W / 2 / PT
    lift = 0.022  # the stub lies this far above the page
    # The stub: straight along the pad's top, torn along its foot: long shallow rips, a few sharp teeth.
    xs, foot = [-hw], [BIND + 3]
    x = -PAD_W / 2
    while x < PAD_W / 2 - 3:
        x = min(PAD_W / 2, x + rnd.uniform(2.5, 9))
        xs.append(x / PT)
        foot.append(BIND + 2 + (rnd.uniform(-9, -3) if rnd.random() < 0.2 else rnd.uniform(0, 7)))
    verts, faces = [], []
    rows = 5
    for i, (x, f) in enumerate(zip(xs, foot)):
        curl = rnd.uniform(-0.002, 0.005)  # the torn edge stands a hair off the page, here up, there down
        for r in range(rows + 1):
            t = r / rows
            verts.append((x, -lift - curl * t ** 3, -f / PT * t))
    for i in range(len(xs) - 1):
        for r in range(rows):
            a, b = i * (rows + 1) + r, (i + 1) * (rows + 1) + r
            faces.append((a, b, b + 1, a + 1))
    stub = mesh_object("stub", verts, faces, sharp=60.0)   # a single sheet: no thickness to round its edge over
    kit.assign(stub, paper)

    holes, loops = [], []
    r, th = 12.5 / PT, 1.75 / PT   # the coil's radius, the wire's
    turn = math.radians(28)        # each loop turned so it shows as a loop from above
    for i in range(LOOPS):
        cx = (-PAD_W / 2 + 10 + STEP * (i + 0.5)) / PT
        h = kit.box((4.8 / PT, 0.004, 7.0 / PT), (cx + 0.004, -lift - 0.004, -15.6 / PT), "hole", bevel_width=0.0)
        hb = h.modifiers.new("round", "BEVEL")   # a punched hole: round-cornered
        hb.width, hb.segments, hb.limit_method, hb.angle_limit = 0.017, 4, "ANGLE", math.radians(60)
        kit.assign(h, hole)
        holes.append(h)
        bpy.ops.mesh.primitive_torus_add(major_radius=r, minor_radius=th, major_segments=56, minor_segments=14, location=(cx - 0.004, 0.0, -3.5 / PT))
        loop = bpy.context.object
        loop.name = "loop"
        loop.rotation_euler = (math.radians(90), 0, math.radians(90) + turn + math.radians(rnd.uniform(-2.5, 2.5)))
        kit.shade(loop)
        kit.assign(loop, wire)
        # Under the studio's big soft key fifteen loops shade the whole stub to a dull tan: the wire throws no
        # shadow (the stub stays the page's cream), and sits in its holes by their dark and its own ink line.
        loop.visible_shadow = False
        loops.append(loop)
    return stub, holes, loops


def shoot(path):
    scene(W, H)
    stub, holes, loops = build()
    cam = flat_camera(W, H, PT, centre=(0.0, -(H / 2 - ABOVE) / PT))
    kit.studio(cam, span=2.9, target=(0, 0, -0.2), fill=1.2)
    hw = PAD_W / 2 / PT
    wall_shadow(0.0, -hw, hw, -(BELOW + 30) / PT, 0.0, reach=0.075, strength=0.75)
    kit.outline(2.0, exclude=[stub] + holes)
    kit.render(path)
    return anchor(cam, (-hw, 0, 0), W, H)


if __name__ == "__main__":
    out = out_dir()
    src = os.path.join(out, "notepad-binding.png")
    pad = shoot(src)
    print("binding  PAD =", pad, " size =", (W, H), " for a pad", PAD_W, "pt wide")
    total = ship(src, "assets/reveal/notepad-binding.png", (round(W), round(H)))
    print(f"total {total / 1024:.1f} KB")

# The desk lamp the lemon-juice letter is held up to (src/play2/tools/Reveal.tsx): a brass
# gooseneck lamp, its bell shade seen from a little below so the bulb shows in its mouth, the
# ribbed neck arching over and away down to the right (its foot stands off the picture). Two
# pictures with one framing: `lamp` (off: an opal bulb in a dim shade) and `lamp-lit` (the bulb
# glowing, the shade's enamel lining lit, warm light under its rim). The pool of light on the
# desk stays the game's own gradient.
#
# The game places the picture by the bulb's centre (BULB, printed at the end).
#
#   <bpy python> scripts/blender/props/reveal_lamp.py [outdir]   # writes assets/reveal/lamp*.png, prints BULB
from reveal_common import *  # noqa: F401,F403

PT = 80.0              # points per unit: the shade is 144 pt across
W, H = 312, 216        # the picture, in points
ELEV = -10.0           # seen from a little below: into the shade's mouth
BULB_R = 17.0 / PT     # Reveal.BULB_R
BULB_Z = -0.11         # the bulb hangs a little out of the mouth
CENTRE = (0.93, 0.02)  # the picture's middle, in (x, z): the shade sits to the left, the neck runs off right


def spline(points, per=110):
    """A smooth curve through 2D points (Catmull-Rom), as a dense polyline."""
    pts = [points[0]] + list(points) + [points[-1]]
    out = []
    for i in range(1, len(pts) - 2):
        p0, p1, p2, p3 = [Vector(p) for p in pts[i - 1:i + 3]]
        for k in range(per):
            t = k / per
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    out.append(Vector(points[-1]))
    return out


def hot_bulb():
    """The lit bulb: amber at its edge, cream across it, white where the filament is (it clips there, as a lamp does)."""
    t = M.Tree("bulb_lit")
    core = t.math("SUBTRACT", 1.0, t.facing(0.5))   # 1 facing the camera .. 0 at the edge
    col = t.ramp(core, [(0.0, (1.0, 0.50, 0.16)), (0.35, (1.0, 0.72, 0.36)), (1.0, (1.0, 0.88, 0.62))])
    e = t.node("ShaderNodeEmission")
    t.link(col, e.inputs["Color"])
    t.link(t.math("ADD", 0.95, t.math("MULTIPLY", t.math("POWER", core, 3.0), 2.6)), e.inputs["Strength"])
    return t.surface(e)


def build(lit):
    brass = M.brass("brass", age=0.5, brushed=0.6, wear=0.6)
    trim = M.brass("brass_trim", color=(0.70, 0.45, 0.16), age=0.35, brushed=0.35, wear=0.8, rough=0.25)
    neck_brass = M.brass("neck", age=0.6, brushed=0.3, wear=0.9, rough=0.28)
    lining = M.enamel("lining", color=(0.72, 0.66, 0.52), gloss=0.35)
    if lit:
        lining = M.lit(lining, (1.0, 0.68, 0.34), 0.9)
    parts = []

    def turned(name, profile, mat, **kw):
        ob = kit.lathe(profile, name=name, **kw)
        kit.assign(ob, mat)
        parts.append(ob)
        return ob

    # The shade: a bell, a rolled rim, a stepped crown the socket screws into.
    n = 26
    TOP = 0.70  # where the bell ends and the crown begins
    bell = [(0.21 + 0.69 * (i / n) ** 0.95, TOP * (1 - (i / n) ** 1.7)) for i in range(n + 1)]   # a dome: a shoulder, then steeper to the rim
    crown = [(0.0, TOP + 0.165), (0.125, TOP + 0.165), (0.15, TOP + 0.145), (0.15, TOP + 0.09), (0.168, TOP + 0.078), (0.18, TOP + 0.058),
             (0.168, TOP + 0.04), (0.185, TOP + 0.03), (0.225, TOP + 0.018), (0.232, TOP + 0.004)]
    rim = [(0.925, -0.004), (0.945, -0.022), (0.945, -0.042), (0.925, -0.058), (0.895, -0.058), (0.875, -0.04)]
    shade = turned("shade", crown + bell[1:] + rim, brass, segments=160)
    kit.bevel(shade, 0.005)
    # Its lining: cream enamel, to throw the light down.
    # A bead round the shoulder: something for the light to catch.
    bpy.ops.mesh.primitive_torus_add(major_radius=0.21 + 0.69 * 0.3 ** 0.95 + 0.004, minor_radius=0.015, major_segments=128, minor_segments=12,
                                     location=(0, 0, TOP * (1 - 0.3 ** 1.7)))
    bead = bpy.context.object
    kit.shade(bead)
    kit.assign(bead, trim)
    parts.append(bead)
    inner = [(0.19 + 0.685 * (i / n) ** 0.95, (TOP - 0.025) * (1 - (i / n) ** 1.7) - 0.012) for i in range(n + 1)]
    turned("lining", [(0.0, TOP - 0.02)] + inner + [(0.88, -0.04)], lining, segments=128)

    # The bulb: a round opal lamp, its neck up in the socket.
    k = 18
    globe = [(BULB_R * math.sin(math.pi * i / k * 0.84), BULB_Z - BULB_R * math.cos(math.pi * i / k * 0.84)) for i in range(k + 1)]
    bulb = turned("bulb", globe + [(0.085, BULB_Z + 0.26), (0.085, 0.46), (0.0, 0.46)], None, segments=64)
    kit.assign(bulb, hot_bulb() if lit else M.ceramic("bulb_opal", color=(0.80, 0.78, 0.72), glaze=1.0, speckle=0.0))
    turned("socket", [(0.0, 0.58), (0.115, 0.58), (0.125, 0.56), (0.125, 0.40), (0.11, 0.38), (0.0, 0.38)], trim, segments=48)

    # The knuckle on the crown, then the gooseneck: a ribbed brass hose that arches over and runs away down to the right.
    turned("stem", [(0.0, TOP + 0.23), (0.055, TOP + 0.23), (0.06, TOP + 0.21), (0.06, TOP + 0.165), (0.0, TOP + 0.165)], trim, segments=40)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.092, location=(0.0, 0.0, TOP + 0.265), segments=40, ring_count=20)
    ball = bpy.context.object
    ball.name = "knuckle"
    kit.shade(ball)
    kit.assign(ball, trim)
    parts.append(ball)
    k0 = TOP + 0.265
    path = spline([(0.03, k0 + 0.04), (0.14, k0 + 0.20), (0.40, k0 + 0.30), (0.76, k0 + 0.255), (1.22, k0 - 0.02), (1.72, 0.50), (2.16, -0.16), (2.56, -0.92), (2.90, -1.66)])
    path3 = [(p.x, 0.0, p.y) for p in path]
    sleeve = 0.20  # a smooth ferrule where the hose leaves the knuckle

    def hose(s):
        if s < sleeve:
            return 0.074 if s < sleeve - 0.03 else 0.074 - 0.012 * (s - (sleeve - 0.03)) / 0.03
        return 0.052 + 0.011 * (0.5 + 0.5 * math.cos(2 * math.pi * (s - sleeve) / 0.064))

    neck = tube(path3, hose, segments=28, name="gooseneck")
    kit.assign(neck, neck_brass)
    parts.append(neck)
    return parts, bulb, neck


def shoot(path, lit):
    scene(W, H, samples=max(SAMPLES, 128) if lit else SAMPLES)
    parts, bulb, neck = build(lit)
    cam = flat_camera(W, H, PT, centre=CENTRE, elev=ELEV)
    kit.studio(cam, span=2.2, target=(0.0, 0.0, 0.45))
    kit.outline(3.0, exclude=[bulb] if lit else [], plain=[neck])
    kit.render(path)
    return anchor(cam, (0, 0, BULB_Z), W, H)


if __name__ == "__main__":
    out = out_dir()
    total = 0
    for name, lit in (("lamp", False), ("lamp-lit", True)):
        src = os.path.join(out, name + ".png")
        bulb = shoot(src, lit)
        print(name, " BULB =", bulb, " size =", (W, H), " bulb radius =", round(BULB_R * PT, 1), "pt")
        # A palette from the start (brushed brass and the bulb's glow at error <= 20, looked at on the dark and on paper): a third the bytes.
        total += ship(src, f"assets/reveal/{name}.png", (W, H), errors=(20.0, 28.0))
    print(f"total {total / 1024:.1f} KB")

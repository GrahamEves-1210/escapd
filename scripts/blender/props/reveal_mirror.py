# The wall mirror the backwards note is read in (src/play2/tools/Reveal.tsx): an arched frame
# of dark carved walnut (a gadrooned moulding, a crest, two rosettes) with a gilt slip and a
# row of gilt pearls round the glass. Two pictures:
#
#   mirror-frame   the frame alone, its opening empty: the game draws the silvered glass and the
#                  note's reflection in the opening, behind this.
#   mirror-glass   what lies on the glass, to draw over the reflection: the window's soft streaks,
#                  the bright bevel along the lit edges, the frame's shadow inside its top and
#                  left, the silvering gone dark and speckled toward the edges.
#
# The mirror is 300 x 336 pt (Reveal's Mirror on a phone; smaller ones scale both pictures), its
# glass inset 22 pt. BOX is the mirror's top-left corner in the frame's picture; the glass picture
# is the opening plus BLEED on every side.
#
#   <bpy python> scripts/blender/props/reveal_mirror.py [outdir] [--frame|--glass]
import numpy as np
from PIL import Image

from reveal_common import *  # noqa: F401,F403

PT = 100.0
MW, MH, F = 300.0, 336.0, 22.0       # Reveal.Mirror: width, height (width x 1.12), the frame's width
PAD_X, PAD_TOP, PAD_BOTTOM = 8.0, 18.0, 8.0
W, H = MW + 2 * PAD_X, MH + PAD_TOP + PAD_BOTTOM
BLEED = 2.0                          # the glass picture runs this far under the frame
GW, GH = MW - 2 * F + 2 * BLEED, MH - 2 * F + 2 * BLEED

HW = MW / 2 / PT                     # the frame's half width
ZC = (MH - MW / 2) / PT              # the arch's centre, up from the mirror's foot
RG = (MW / 2 - F) / PT               # the glass's half width / arch radius
Z0 = F / PT                          # the glass's foot


def arch(inset, step=0.012, bottom=True):
    """The arch `inset` units inside the mirror's outline, anticlockwise from its bottom left, densely sampled."""
    r = HW - inset
    pts = []
    n = max(2, int((ZC - inset) / step))
    pts += [(r, inset + (ZC - inset) * i / n) for i in range(n)]                       # up the right side
    m = max(8, int(math.pi * r / step))
    pts += [(r * math.cos(math.pi * i / m), ZC + r * math.sin(math.pi * i / m)) for i in range(m)]   # over the top
    pts += [(-r, ZC - (ZC - inset) * i / n) for i in range(n)]                         # down the left
    if bottom:
        k = max(2, int(2 * r / step))
        pts += [(-r + 2 * r * i / k, inset) for i in range(k)]                           # along the foot
    return pts


def spheres(name, centres, radius, segments=12):
    bm = bmesh.new()
    for c in centres:
        bmesh.ops.create_uvsphere(bm, u_segments=segments, v_segments=segments // 2 + 2, radius=radius, matrix=Matrix.Translation(c))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return kit.shade(ob)


def build_frame():
    wood = M.walnut("frame", axis="Z", color=(0.042, 0.016, 0.010), figure=0.75, gloss=0.7, wear=0.22, scale=1.6)
    gilt = M.brass("gilt", color=(0.78, 0.52, 0.17), age=0.35, brushed=0.15, wear=0.8, rough=0.26, scale=1.6)
    f = F / PT
    parts, plain = [], []
    # The carved moulding, from the slip outward: a channel for the pearls, a cove, a gadrooned
    # bolection (the carving: a row of lobes), a fillet, the outer edge.
    profile = [(0.030, 0.0), (0.030, 0.034), (0.086, 0.034), (0.090, 0.060), (0.104, 0.072), (0.116, 0.078),
               (0.128, 0.094), (0.146, 0.112), (0.164, 0.116), (0.182, 0.106), (0.196, 0.086),
               (0.202, 0.070), (f - 0.006, 0.066), (f - 0.001, 0.058), (f + 0.002, 0.03), (f + 0.006, 0.0)]
    lobe = 0.118  # the gadroons' pitch along the frame

    def carve(s, j):
        if 6 <= j <= 10:
            crest = (0.0, 0.5, 1.0, 0.6, 0.15)[j - 6]
            return 0.036 * crest * (abs(math.sin(math.pi * s / lobe)) ** 0.5 - 0.55)
        return 0.0

    body = moulding(arch(f), profile, "moulding", bump=carve)
    kit.assign(body, wood)
    parts.append(body)
    plain.append(body)   # its lobes are shaded, not inked: a line in every valley is a row of stitches
    # The gilt slip against the glass and the pearls in their channel.
    slip = moulding(arch(f), [(-0.026, 0.0), (-0.020, 0.030), (-0.010, 0.046), (0.012, 0.050), (0.030, 0.040), (0.034, 0.0)], "slip")
    kit.assign(slip, gilt)
    path = arch(f - 0.059, step=0.004)
    pitch, run, at, centres = 0.0555, 0.0, 0.0, []
    for a, b in zip(path, path[1:] + path[:1]):
        d = math.hypot(b[0] - a[0], b[1] - a[1])
        while at <= run + d:
            t = (at - run) / d
            centres.append((a[0] + (b[0] - a[0]) * t, -0.040, a[1] + (b[1] - a[1]) * t))
            at += pitch
        run += d
    pearls = spheres("pearls", centres[:-1], 0.0225)
    kit.assign(pearls, gilt)
    parts += [slip, pearls]
    plain += [pearls]

    # The crest: a carved shell on the crown of the arch (a fan of lobes round a gilt boss), a leaf either side.
    top = ZC + HW
    fan = []
    for i in range(7):
        a = math.radians(-66 + 22 * i)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=1.0, segments=24, ring_count=12, location=(0.118 * math.sin(a), -0.090, top - 0.092 + 0.118 * math.cos(a)))
        leaf = bpy.context.object
        leaf.scale = (0.040, 0.036, 0.122)
        leaf.rotation_euler = (0, a, 0)
        kit.shade(leaf)
        kit.assign(leaf, wood)
        fan.append(leaf)
    for sx in (-1, 1):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=1.0, segments=24, ring_count=12, location=(sx * 0.29, -0.105, top - 0.098))
        leaf = bpy.context.object
        leaf.scale = (0.17, 0.045, 0.052)
        leaf.rotation_euler = (0, sx * math.radians(14), 0)
        kit.shade(leaf)
        kit.assign(leaf, wood)
        fan.append(leaf)
    parts += fan
    boss = kit.lathe([(0.0, 0.058), (0.022, 0.054), (0.040, 0.040), (0.046, 0.022), (0.060, 0.018), (0.064, 0.008), (0.064, 0.0), (0.0, 0.0)], segments=48, name="boss")
    boss.rotation_euler = (math.radians(90), 0, 0)
    boss.location = (0.0, -0.112, top - 0.105)
    kit.assign(boss, gilt)
    parts.append(boss)
    # The foot's corners: a square block each, a gilt rosette on it.
    for sx in (-1, 1):
        x, z = sx * (HW - f / 2 + 0.004), f / 2 - 0.002
        block = kit.box((f + 0.03, 0.15, f + 0.02), (x, -0.07, z), "block", bevel_width=0.022, segments=3)
        kit.assign(block, wood)
        ros = kit.lathe([(0.0, 0.050), (0.022, 0.047), (0.036, 0.034), (0.042, 0.020), (0.062, 0.022), (0.082, 0.014), (0.086, 0.0), (0.0, 0.0)],
                        segments=64, name="rosette", displace=lambda a, z, r: kit.flutes(8, 0.016)(a, z, r) * (r > 0.05))
        ros.rotation_euler = (math.radians(90), 0, 0)
        ros.location = (x, -0.145, z)
        kit.assign(ros, gilt)
        parts += [block, ros]
    return parts, plain


def old_glass():
    """What lies on the glass, on transparent film: clear in the middle; reflections where the
    pane is tilted to the window (its bevel, two wavy streaks); the frame's shadow, the edges
    darkening, and foxing, as flat dark colour with its own alpha."""
    t = M.Tree("old_glass")
    tc = t.node("ShaderNodeTexCoord")
    sep = t.node("ShaderNodeSeparateXYZ")
    t.link(tc.outputs["Object"], sep.inputs[0])
    x, z = sep.outputs["X"], sep.outputs["Z"]

    def edge(dx=0.0, dz=0.0):
        """Distance in from the opening's edge at (x + dx, z + dz): negative under the frame."""
        xx = t.math("ADD", x, dx)
        zz = t.math("ADD", z, dz)
        up = t.math("MAXIMUM", t.math("SUBTRACT", zz, ZC), 0.0)
        rad = t.math("SQRT", t.math("ADD", t.math("MULTIPLY", xx, xx), t.math("MULTIPLY", up, up)))
        return t.math("MINIMUM", t.math("SUBTRACT", RG, rad), t.math("SUBTRACT", zz, Z0))

    def smooth(v, lo, hi):
        mr = t.node("ShaderNodeMapRange", interpolation_type="SMOOTHSTEP")
        t.set(mr.inputs["Value"], v)
        t.set(mr.inputs["From Min"], lo)
        t.set(mr.inputs["From Max"], hi)
        return mr.outputs[0]

    d = edge()
    # The frame stands proud of the glass and the light is upper left: its shadow lies inside the top and the left.
    cast = t.math("MULTIPLY", t.math("SUBTRACT", 1.0, smooth(edge(-0.055, 0.075), -0.01, 0.075)), 0.62)
    close = t.math("MULTIPLY", t.math("SUBTRACT", 1.0, smooth(d, 0.0, 0.05)), 0.5)          # all round, tight in the corner
    # The silvering going: a broad darkening toward the edge, mottled; then specks, thick at the edge, a few further in.
    mottle = t.noise(tc.outputs["Object"], scale=3.2, detail=3, rough=0.6)
    reach = t.math("ADD", 0.16, t.math("MULTIPLY", mottle, 0.34))
    vignette = t.math("MULTIPLY", t.math("POWER", t.math("SUBTRACT", 1.0, smooth(d, 0.0, reach)), 1.6), 0.46)
    fine = t.noise(tc.outputs["Object"], scale=46.0, detail=2, rough=0.5)
    blot = t.noise(tc.outputs["Object"], scale=13.0, detail=3, rough=0.65)
    near = t.math("SUBTRACT", 1.0, smooth(d, 0.02, 0.46))
    specks = t.math("MULTIPLY", smooth(t.math("ADD", fine, t.math("MULTIPLY", near, 0.20)), 0.74, 0.79), 0.5)
    blots = t.math("MULTIPLY", smooth(t.math("ADD", blot, t.math("MULTIPLY", near, 0.16)), 0.70, 0.76), 0.34)
    dark = t.math("MAXIMUM", t.math("MAXIMUM", cast, close), t.math("MAXIMUM", vignette, t.math("MAXIMUM", specks, blots)), clamp=True)
    tint = t.mix(t.math("MAXIMUM", specks, blots), (0.006, 0.008, 0.020), (0.030, 0.026, 0.030))
    stain = t.node("ShaderNodeEmission")
    t.link(tint, stain.inputs["Color"])

    # Reflections: the pane's own normal on the bevel; in two diagonal bands the old glass waves toward the window.
    q = t.math("ADD", t.math("MULTIPLY", x, 0.83), t.math("MULTIPLY", z, -0.55))    # across the streaks (they run up to the right)
    wave = t.noise(tc.outputs["Object"], scale=1.1, detail=1, rough=0.4)
    q = t.math("ADD", q, t.math("MULTIPLY", t.math("SUBTRACT", wave, 0.5), 0.12))

    def band(at, width):
        g = t.math("DIVIDE", t.math("SUBTRACT", q, at), width)
        return t.math("POWER", 2.718, t.math("MULTIPLY", t.math("MULTIPLY", g, g), -1.0))

    lean = t.math("ADD", t.math("MULTIPLY", band(-1.50, 0.17), 0.56), t.math("MULTIPLY", band(-1.03, 0.045), 0.50))
    lean = t.math("MULTIPLY", lean, smooth(d, 0.07, 0.30))    # the streaks die away before the bevel
    geo = t.node("ShaderNodeNewGeometry")
    toward = t.node("ShaderNodeVectorMath", operation="SCALE")
    toward.inputs[0].default_value = (-0.50, 0.0, 0.62)       # up and to the left: where the window is
    t.link(lean, toward.inputs["Scale"])
    bent = t.node("ShaderNodeVectorMath", operation="ADD")
    t.link(geo.outputs["Normal"], bent.inputs[0])
    t.link(toward.outputs[0], bent.inputs[1])
    nrm = t.node("ShaderNodeVectorMath", operation="NORMALIZE")
    t.link(bent.outputs[0], nrm.inputs[0])
    shine = t.node("ShaderNodeBsdfGlossy")
    shine.inputs["Roughness"].default_value = 0.2
    inside = smooth(d, 0.06, 0.16)     # the streaks are fainter than the bevel's edge of light
    t.link(t.mix(inside, (0.060, 0.062, 0.068), (0.020, 0.021, 0.024)), shine.inputs["Color"])
    t.link(nrm.outputs[0], shine.inputs["Normal"])
    clear = t.node("ShaderNodeBsdfTransparent")
    pane = t.node("ShaderNodeAddShader")
    t.link(clear.outputs[0], pane.inputs[0])
    t.link(shine.outputs[0], pane.inputs[1])
    m = t.node("ShaderNodeMixShader")
    t.set(m.inputs[0], dark)
    t.link(pane.outputs[0], m.inputs[1])
    t.link(stain.outputs[0], m.inputs[2])
    return t.surface(m)


def build_glass():
    """The pane: the opening and a little more, its edge ground to a bevel that falls away to the frame."""
    b = BLEED / PT
    hw, z0, bevel, drop = RG + b, Z0 - b, 0.085, 0.045
    nu, nv = 150, 170
    verts, faces = [], []
    for j in range(nv + 1):
        for i in range(nu + 1):
            u = -1 + 2 * i / nu
            x = hw * u
            top = ZC + math.sqrt(max(0.0, hw * hw - x * x))
            z = z0 + (top - z0) * j / nv
            up = max(z - ZC, 0.0)
            dist = min(hw - math.hypot(x, up), z - z0)
            y = drop * max(0.0, 1.0 - dist / bevel)     # the bevel slopes back (away from the camera) to the edge
            verts.append((x, y, z))
    for j in range(nv):
        for i in range(nu):
            a = j * (nu + 1) + i
            faces.append((a, a + 1, a + nu + 2, a + nu + 1))
    pane = mesh_object("pane", verts, faces, sharp=20.0)
    # Faces must look at the camera (-Y).
    if sum(p.normal.y for p in pane.data.polygons) > 0:
        pane.data.flip_normals()
    kit.assign(pane, old_glass())
    return pane


def frame_camera():
    return flat_camera(W, H, PT, centre=(0.0, (MH / 2 + (PAD_TOP - PAD_BOTTOM) / 2) / PT))


def shoot_frame(path):
    scene(W, H)
    parts, plain = build_frame()
    cam = frame_camera()
    kit.studio(cam, span=3.2, target=(0, 0, MH / 2 / PT))
    kit.outline(4.0, plain=plain)
    kit.render(path)
    return anchor(cam, (-HW, 0, MH / PT), W, H)


def shoot_glass(path):
    scene(GW, GH, samples=max(SAMPLES, 128), glass=True)
    build_glass()
    cam = flat_camera(GW, GH, PT, centre=(0.0, MH / 2 / PT))
    kit.studio(cam, span=3.2, target=(0, 0, MH / 2 / PT))
    kit.no_outline()
    kit.render(path, exr=True)
    im = export.lift_glass(path)
    # Half the pane is film noise at 1 to 3 parts in 255: nothing to see, and half the file. Clear it.
    a = np.asarray(im).copy()
    a[a[..., 3] < 8] = 0
    return Image.fromarray(a, "RGBA")


if __name__ == "__main__":
    out = out_dir()
    which = [a for a in sys.argv[1:] if a.startswith("--")]
    total = 0
    if not which or "--frame" in which:
        src = os.path.join(out, "mirror-frame.png")
        box = shoot_frame(src)
        print("mirror-frame  BOX =", box, " size =", (W, H), " for a mirror", (MW, MH))
        total += ship(src, "assets/reveal/mirror-frame.png", (round(W), round(H)))
    if not which or "--glass" in which:
        im = shoot_glass(os.path.join(out, "mirror-glass.png"))
        im.save(os.path.join(out, "mirror-glass_lifted.png"))
        print("mirror-glass  size =", (GW, GH), " = the opening + ", BLEED, "pt all round")
        total += ship(im, "assets/reveal/mirror-glass.png", (round(GW), round(GH)))
    print(f"total {total / 1024:.1f} KB")

# The things you lift to look under (src/play2/mechanisms/LiftUnder.tsx): a tufted velvet
# cushion, a cloth-bound book, a walnut box with brass corners, a glazed pot with a fern.
# The cushion, the book and the pot take the mode's dye, so each is rendered once per mode.
# No shadow in the pictures: the app lifts them and thins their shadow under them itself.
#
#   <bpy python> scripts/blender/props/mech_lift.py        # all; ONLY=cushion-noir,box for some
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
import numpy as np  # noqa: E402
from mech_common import M, SAMPLES, THREADS, export, kit, save, scratch, to_mesh, totals, wanted  # noqa: E402
from mech_drawer import WALNUT, brass  # noqa: E402

# Each mode's cloth (materials.tsx DYES), linear.
DYES = {"noir": (0.195, 0.030, 0.058), "crime": (0.033, 0.095, 0.069), "paranormal": (0.089, 0.063, 0.275)}
GILT = (0.55, 0.36, 0.12)
H = 104  # LiftUnder's H: every thing's box is this tall


def shoot(name, parts, w, view="held", elev=None, azim=None, margin=1.05, line=3.0, no_ink=(), plain=(), target=(0, 0, 0.4), key=1.0):
    cam = kit.camera(view, elev=elev, azim=azim)
    kit.fit(cam, parts, margin=margin)
    kit.studio(cam, span=2.0, target=target, key=key)
    kit.outline(line, exclude=list(no_ink), plain=list(plain))
    save(export.load(kit.render(scratch(name))), name, (w, H))


def start(w):
    kit.reset()
    kit.setup(size=(w * 3, H * 3), ss=1, samples=SAMPLES, threads=THREADS)


def cushion(mode):
    start(168)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=128, ring_count=64, radius=1)
    ob = bpy.context.object
    co = np.array([v.co[:] for v in ob.data.vertices])
    x, y, z = co[:, 0], co[:, 1], co[:, 2]
    r = np.hypot(x, y)
    a = np.arctan2(y, x)
    n = 3.4  # a rounded square, its corners drawn out a little
    sq = (np.abs(np.cos(a)) ** n + np.abs(np.sin(a)) ** n) ** (-1 / n)
    ears = 1 + 0.07 * (np.abs(np.sin(2 * a)) ** 6) * r
    X, Y = x * sq * ears * 1.0, y * sq * ears * 0.74
    Z = 0.30 * np.sign(z) * np.abs(z) ** 0.62
    # Tufted to a button in the middle, four soft folds running to it from the corners.
    rr = np.hypot(X, Y / 0.74)
    top = z > 0
    Z -= top * 0.20 * np.exp(-(rr / 0.16) ** 2)
    diag = np.minimum(np.abs(X - Y / 0.74), np.abs(X + Y / 0.74)) / math.sqrt(2)
    Z -= top * 0.035 * np.exp(-(diag / 0.05) ** 2) * np.clip(1 - rr * 0.9, 0, 1) * np.clip(rr * 4, 0, 1)
    for v, c in zip(ob.data.vertices, np.stack([X, Y, Z + 0.30], axis=1)):
        v.co = c
    kit.shade(ob, 60)
    kit.assign(ob, M.felt("velvet", DYES[mode], nap=1.0))
    # Piping round its seam, the button.
    t = np.linspace(0, 2 * math.pi, 120, endpoint=False)
    s2 = (np.abs(np.cos(t)) ** n + np.abs(np.sin(t)) ** n) ** (-1 / n) * (1 + 0.07 * np.abs(np.sin(2 * t)) ** 6)
    cu = bpy.data.curves.new("piping", "CURVE")
    cu.dimensions, cu.bevel_depth, cu.bevel_resolution = "3D", 0.028, 4
    sp = cu.splines.new("POLY")
    sp.points.add(len(t) - 1)
    for p, tt, ss in zip(sp.points, t, s2):
        p.co = (math.cos(tt) * ss * 1.005, math.sin(tt) * ss * 0.745, 0.30, 1)
    sp.use_cyclic_u = True
    pipe = bpy.data.objects.new("piping", cu)
    bpy.context.scene.collection.objects.link(pipe)
    pipe = to_mesh(pipe)   # (a curve's own bounds are loose: kit.fit would frame it small)
    kit.assign(pipe, M.felt("piping", GILT, nap=0.2))
    button = kit.lathe([(0, 0.045), (0.035, 0.04), (0.06, 0.02), (0.066, 0.0)], name="button", segments=32)
    button.location = (0, 0, 0.60 - 0.205)
    kit.assign(button, brass("button", age=0.3, brushed=0.1))
    shoot(f"cushion-{mode}", [ob, pipe, button], 168, "held", elev=52, margin=1.04, plain=[ob])


def book(mode):
    start(150)
    cloth = M.leather("cloth", DYES[mode], grain=0.35, wear=0.6, scale=1.0)
    gilt = brass("gilt", age=0.2, brushed=0.1, wear=0.2)
    L, Wd, T = 1.56, 1.12, 0.26
    pages = kit.box((L - 0.07, Wd - 0.08, T - 0.06), (0.02, 0, T / 2), "pages", bevel_width=0.008)
    kit.assign(pages, M.paper("pages", (0.84, 0.76, 0.60), fibre=0.9, age=0.4))
    top = kit.box((L, Wd, 0.034), (0, 0, T - 0.017), "cover", bevel_width=0.012)
    bottom = kit.box((L, Wd, 0.034), (0, 0, 0.017), "back", bevel_width=0.012)
    spine = kit.box((0.07, Wd, T), (-L / 2 + 0.02, 0, T / 2), "spine", bevel_width=0.03)
    for o in (top, bottom, spine):
        kit.assign(o, cloth)
    parts = [pages, top, bottom, spine]
    # Gilt on the cover: a frame and two bars of title, stamped a hair proud.
    z = T + 0.001
    fx, fy = L / 2 - 0.20, Wd / 2 - 0.12
    for (sx, sy, cx, cy) in ((2 * fx, 0.022, 0.06, fy), (2 * fx, 0.022, 0.06, -fy), (0.022, 2 * fy, 0.06 - fx, 0), (0.022, 2 * fy, 0.06 + fx, 0),
                             (0.62, 0.05, 0.06, 0.10), (0.40, 0.05, 0.06, -0.06)):
        b = kit.box((sx, sy, 0.006), (cx, cy, z), "gilt", bevel_width=0.002)
        kit.assign(b, gilt)
        parts.append(b)
    ribbon = kit.box((0.085, 0.30, 0.008), (0.42, -Wd / 2 - 0.10, 0.10), "ribbon", bevel_width=0.003)
    ribbon.rotation_euler = (math.radians(-20), 0, math.radians(-6))
    kit.assign(ribbon, M.felt("ribbon", (0.33, 0.035, 0.05), nap=0.3))
    parts.append(ribbon)
    root = kit.group(parts, "book")
    root.rotation_euler = (0, 0, math.radians(9))
    shoot(f"book-{mode}", parts, 150, "held", elev=50, margin=1.04, no_ink=parts[4:10], target=(0, 0, 0.13))


def box():
    start(124)
    L, Wd, Hb, Hl = 1.42, 0.98, 0.56, 0.26
    body = kit.box((L, Wd, Hb), (0, 0, Hb / 2), "body", bevel_width=0.025)
    kit.assign(body, M.walnut("body", axis="X", color=(0.145, 0.058, 0.025), figure=0.65, gloss=0.4))
    lid = kit.box((L + 0.07, Wd + 0.07, Hl), (0, 0, Hb + Hl / 2 + 0.01), "lid", bevel_width=0.035)
    kit.assign(lid, M.walnut("lid", axis="X", color=WALNUT, figure=0.75, gloss=0.55))
    parts = [body, lid]
    mat = brass("corner", age=0.45, brushed=0.3)
    for sx in (-1, 1):
        for sy in (-1, 1):
            c = kit.box((0.20, 0.20, Hl + 0.03), (sx * (L / 2 - 0.045), sy * (Wd / 2 - 0.045), Hb + Hl / 2 + 0.01), "corner", bevel_width=0.03)
            kit.assign(c, mat)
            parts.append(c)
    clasp = kit.box((0.20, 0.03, 0.26), (0, -Wd / 2 - 0.03, Hb + 0.02), "clasp", bevel_width=0.012)
    kit.assign(clasp, mat)
    stud = kit.lathe([(0, 0.035), (0.03, 0.03), (0.045, 0.0)], name="stud", segments=24)
    stud.rotation_euler = (math.radians(90), 0, 0)
    stud.location = (0, -Wd / 2 - 0.045, Hb - 0.04)
    kit.assign(stud, brass("stud", age=0.2))
    parts += [clasp, stud]
    shoot("box", parts, 124, "product", elev=30, azim=22, margin=1.05, target=(0, 0, 0.4))


def pot(mode):
    start(124)
    glaze = M.ceramic("glaze", DYES[mode], glaze=0.9, speckle=0.12)
    body = kit.lathe([(0, 0), (0.40, 0), (0.46, 0.03), (0.60, 0.42), (0.66, 0.74), (0.66, 0.80), (0.72, 0.83), (0.74, 0.90), (0.72, 0.97), (0.66, 0.99),
                      (0.62, 0.96), (0.60, 0.86), (0, 0.86)], name="pot", segments=96, max_len=0.05)
    kit.bevel(body, 0.008)
    kit.assign(body, glaze)
    band = kit.lathe([(0.652, 0.66), (0.665, 0.672), (0.667, 0.70), (0.655, 0.712)], name="band", segments=96)
    kit.assign(band, brass("band", age=0.3, brushed=0.2))
    soil = kit.lathe([(0, 0.875), (0.61, 0.875), (0.61, 0.86), (0, 0.86)], name="soil", segments=48)
    kit.assign(soil, M.rubber("soil", (0.035, 0.022, 0.014), rough=0.95, dust=0.6))
    parts = [body, band, soil]
    # A fern: arching blades from the middle, folded along their rib.
    rnd = np.random.default_rng(7)
    leaf_a = M.wax("leaf_a", (0.090, 0.21, 0.065), translucency=0.25, gloss=0.5)
    leaf_b = M.wax("leaf_b", (0.19, 0.36, 0.10), translucency=0.25, gloss=0.5)
    blades = [(-70, 0.95, 0.72), (70, 0.92, 0.70), (-38, 1.08, 0.42), (40, 1.05, 0.44), (4, 1.12, 0.12), (-110, 0.8, 0.9), (112, 0.78, 0.92), (170, 0.9, 0.5), (-18, 0.9, 0.3), (20, 0.86, 0.28)]
    for i, (az, length, lean) in enumerate(blades):
        n = 14
        verts, faces = [], []
        for k in range(n + 1):
            t = k / n
            out = length * (lean * t + 0.25 * lean * t * t)          # how far from the middle
            up = length * (t * (1 - 0.55 * lean * t))                 # arching over as it goes
            wdt = 0.115 * math.sin(math.pi * min(1.0, t * 1.08 + 0.04)) ** 0.7 * (1 - 0.25 * t)
            fold = 0.035 * (1 - t)
            verts += [(-wdt, out, up + fold), (0, out, up), (wdt, out, up + fold)]
            if k:
                b0 = (k - 1) * 3
                faces += [(b0, b0 + 1, b0 + 4, b0 + 3), (b0 + 1, b0 + 2, b0 + 5, b0 + 4)]
        me = bpy.data.meshes.new("leaf")
        me.from_pydata(verts, [], faces)
        lf = bpy.data.objects.new("leaf", me)
        bpy.context.scene.collection.objects.link(lf)
        so = lf.modifiers.new("solid", "SOLIDIFY")
        so.thickness = 0.012
        kit.subsurf(lf, 2)
        kit.shade(lf, 80)
        lf.location = (0.05 * math.sin(math.radians(az)), -0.05 * math.cos(math.radians(az)), 0.86)
        lf.rotation_euler = (0, 0, math.radians(az + rnd.uniform(-6, 6)) + math.pi)
        kit.assign(lf, leaf_b if i % 2 else leaf_a)
        parts.append(lf)
    shoot(f"pot-{mode}", parts, 124, "held", elev=14, margin=1.04, target=(0, 0, 0.7))


if __name__ == "__main__":
    jobs = [("box", box)]
    for mode in DYES:
        jobs += [(f"cushion-{mode}", lambda m=mode: cushion(m)), (f"book-{mode}", lambda m=mode: book(m)), (f"pot-{mode}", lambda m=mode: pot(m))]
    for name, fn in jobs:
        if wanted(name):
            fn()
    print("lift:", totals())

# The pencil of the pencil rubbing (src/play2/tools/RubSheet.tsx): a chewed stub of soft
# pencil, wine-red paint over cedar, whittled to a blunt point with a knife, a crimped brass
# ferrule and what is left of its rubber. It lies along +x with its point at the picture's
# left; the game draws it with its point on the finger and turns it about that point.
#
#   <bpy python> scripts/blender/props/reveal_pencil.py [outdir]   # writes assets/reveal/pencil*.png, prints TIP
import random

import numpy as np

from reveal_common import *  # noqa: F401,F403

PT = 75.0              # points per unit: the stub is 2 units (150 pt) long
W, H = 158, 34         # the picture, in points
LENGTH = 2.0
ROLL = 22.0            # turned on its axis: a lit facet above, a shaded one below


def cedar():
    t = M.Tree("cedar")
    fib = t.noise(t.coords((6, 6, 0.5)), scale=9.0, detail=3, rough=0.7)
    col = t.mix(fib, (0.78, 0.50, 0.26), (0.55, 0.30, 0.13))
    return t.surface(t.principled(**{"Base Color": col, "Roughness": 0.78, "Specular IOR Level": 0.2,
                                     "Normal": t.bump(fib, strength=0.2, distance=0.004)}))


def graphite():
    t = M.Tree("graphite")
    n = t.noise(t.coords((40, 40, 40)), scale=1.0, detail=2)
    return t.surface(t.principled(**{"Base Color": (0.035, 0.035, 0.042), "Metallic": 0.55,
                                     "Roughness": t.math("ADD", 0.34, t.math("MULTIPLY", n, 0.2))}))


def build():
    rnd = random.Random(7)
    paint = M.enamel("paint", color=(0.20, 0.010, 0.030), gloss=0.3)
    wood, lead = cedar(), graphite()
    brass = M.brass("ferrule", age=0.45, brushed=0.5, wear=0.7)
    rubber = M.rubber("rubber", color=(0.50, 0.22, 0.19), rough=0.9, dust=0.5)

    rc = 0.150  # the hexagon, across its corners
    body = kit.lathe([(0, -0.02), (rc, -0.02), (rc, 1.63), (0, 1.63)], segments=6, name="body", smooth=False)
    kit.assign(body, paint)
    # Whittled: a cone of knife cuts (uneven flats), blunt at the lead; what it leaves of the hexagon is scalloped.
    cuts = 7
    wobble = [1.0 + rnd.uniform(-0.10, 0.12) for _ in range(cuts)]

    def knife(angle, z, r):
        i = np.round(angle / (2 * math.pi) * cuts).astype(int) % cuts
        return r * (np.array([wobble[j] for j in i]) - 1.0) * ((z > 0.10) & (z < 0.50))

    cone = kit.lathe([(0, 0), (0.016, 0.004), (0.034, 0.03), (0.052, 0.13), (0.168, 0.46), (0.4, 0.47), (0.4, 1.8), (0, 1.8)],
                     segments=cuts, name="whittle", smooth=False, displace=knife)
    cone.data.materials.append(wood)
    cone.data.materials.append(lead)
    for poly in cone.data.polygons:
        poly.material_index = 1 if poly.center.z < 0.125 else 0
    boolean(body, cone, "INTERSECT")
    cutters = [cone]
    # Chewed: tooth dents through the paint near the ferrule end, bare wood in them (angles 170..260 face the light and the camera).
    for z, a, r in ((1.27, 212, 0.030), (1.36, 228, 0.034), (1.45, 206, 0.030), (1.40, 262, 0.024), (1.50, 240, 0.022)):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=r, segments=16, ring_count=8,
                                             location=((rc * 0.97) * math.cos(math.radians(a)), (rc * 0.97) * math.sin(math.radians(a)), z))
        tooth = bpy.context.object
        tooth.scale = (1.0, 1.0, 1.5)
        kit.assign(tooth, wood)
        boolean(body, tooth, "DIFFERENCE")
        cutters.append(tooth)
    kit.bevel(body, 0.006, segments=2, angle=25)

    # The ferrule: crimped brass, three ridges; then the rubber, worn down and rounded off.
    f0 = 1.60
    ferrule = kit.lathe([(0.10, f0), (0.158, f0), (0.160, f0 + 0.02), (0.152, f0 + 0.045), (0.160, f0 + 0.07), (0.152, f0 + 0.095), (0.160, f0 + 0.12),
                         (0.152, f0 + 0.145), (0.158, f0 + 0.17), (0.158, f0 + 0.215), (0.150, f0 + 0.225), (0.10, f0 + 0.225)], segments=48, name="ferrule")
    kit.bevel(ferrule, 0.004)
    kit.assign(ferrule, brass)
    r0 = f0 + 0.215
    rub = kit.lathe([(0.10, r0), (0.138, r0), (0.140, r0 + 0.09), (0.128, r0 + 0.14), (0.095, r0 + 0.172), (0.04, r0 + 0.185), (0, r0 + 0.186)], segments=40, name="rubber")
    kit.assign(rub, rubber)
    parts = [body, ferrule, rub]
    root = kit.group(parts + cutters, "pencil")  # the cutters turn with what they cut
    # Along +x, point at the origin, rolled on its own axis.
    root.matrix_world = Matrix.Rotation(math.radians(90), 4, "Y") @ Matrix.Rotation(math.radians(ROLL), 4, "Z")
    bpy.context.view_layer.update()
    return parts


def shoot(path):
    scene(W, H)
    parts = build()
    cam = flat_camera(W, H, PT, centre=(LENGTH / 2 + 0.01, 0.0))
    kit.studio(cam, span=2.0, target=(LENGTH / 2, 0, 0))
    kit.outline(2.5)
    kit.render(path)
    return anchor(cam, (0, 0, 0), W, H)


if __name__ == "__main__":
    out = out_dir()
    src = os.path.join(out, "pencil.png")
    tip = shoot(src)
    print("pencil  TIP =", tip, " size =", (W, H))
    total = export.export(src, "assets/reveal/pencil.png", sizes=(W, H), canvas=True)
    print(f"total {total / 1024:.1f} KB")

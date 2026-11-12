# The player's magnifier: a chunky brass rim round real glass (see-through in the
# middle, a soft window highlight, a denser rim where the lens bends the light),
# on a turned walnut handle with brass ferrules.
#
# Held up and to the right, handle down to the left, as src/play2/Tools.tsx
# expects (it is picked up by the handle and looks through the lens: the lens
# centre printed at the end is LENS there, as fractions from the picture's centre).
#
#   <bpy python> scripts/blender/props/magnifier.py [outdir]   # renders + writes assets/brand/magnifier*.png
import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import bpy  # noqa: E402
from mathutils import Matrix  # noqa: E402

import export  # noqa: E402
import kit  # noqa: E402
import materials as M  # noqa: E402

SIZE = 88            # points in the app (Tools.TOOL)
ROLL = 42.0          # the handle swung down to the left
TILT = -16.0         # the lens leaning back a little: the rim shows its depth
YAW = 14.0
R = 0.84             # the lens's radius: the lens is the star, the handle short and stout


def build():
    brass = M.brass("brass", age=0.5, brushed=0.5, wear=0.7, axis="Y")
    trim = M.brass("brass_trim", color=(0.70, 0.45, 0.16), age=0.4, brushed=0.4, wear=0.7, rough=0.25)
    wood = M.walnut("handle", axis="Z", color=(0.20, 0.075, 0.032), figure=0.7, gloss=0.75, wear=0.5, scale=0.6)
    lens_mat = M.glass("lens", tint=(0.80, 0.93, 1.0), ior=1.28, haze=0.018, rim=0.22, radius=R)
    parts = []

    def turned(name, profile, mat, face=False, **kw):
        ob = kit.lathe(profile, name=name, **kw)
        if face:  # turned round Z, then stood up to face the camera (axis along Y)
            ob.rotation_euler = (math.radians(90), 0, 0)
            if mat is not lens_mat:  # the lens keeps its own Z as its axis (its glass's rim is measured from it)
                kit.apply_transforms(ob)
        kit.assign(ob, mat)
        parts.append(ob)
        return ob

    # The rim: a fat brass ring with a bead on its outside and a step where the lens sits.
    # (One smooth fat section, no beads: its outline stays a single clean line at any tilt.)
    ring = [(R - 0.012, -0.05), (R - 0.012, 0.05)]
    for i in range(0, 25):
        a = math.pi * i / 24  # from the back lip, round the outside, to the front lip
        ring.append((R + 0.065 + 0.08 * math.sin(a) ** 0.8, 0.115 * math.cos(a)))
    ring.append(ring[0])
    rim = turned("rim", ring, brass, face=True, segments=192)
    kit.bevel(rim, 0.006)
    # The lens: biconvex, thick in the middle.
    n = 18
    front = [(R * i / n, 0.03 + 0.085 * (1 - (i / n) ** 2)) for i in range(n + 1)]
    glass = turned("lens", front + [(r, -z) for r, z in reversed(front)], lens_mat, face=True, segments=128)

    # The handle, down from the rim: a brass neck and ferrule, turned walnut, a brass cap.
    z0 = -(R + 0.12)
    neck = turned("neck", [(0.0, z0 + 0.06), (0.075, z0 + 0.06), (0.075, z0 - 0.02), (0.095, z0 - 0.035), (0.10, z0 - 0.06), (0.085, z0 - 0.085),
                           (0.072, z0 - 0.10), (0.072, z0 - 0.14), (0.125, z0 - 0.15), (0.135, z0 - 0.17), (0.135, z0 - 0.30), (0.125, z0 - 0.315),
                           (0.125, z0 - 0.33), (0.135, z0 - 0.345), (0.135, z0 - 0.37), (0.10, z0 - 0.38), (0.0, z0 - 0.38)], trim, segments=96)
    kit.bevel(neck, 0.005)
    h0, h1 = z0 - 0.37, z0 - 1.12
    prof = []
    for i in range(41):
        t = i / 40
        r = 0.128 + 0.055 * math.sin(math.pi * min(1.0, t * 1.25)) ** 1.5 * (1 - 0.25 * t) + 0.012 * t
        # two turned beads near the ferrule, one near the cap
        for c, w, h in ((0.07, 0.022, 0.016), (0.13, 0.016, 0.010), (0.93, 0.022, 0.014)):
            r += h * math.exp(-((t - c) / w) ** 2)
        prof.append((r, h0 + (h1 - h0) * t))
    turned("handle", [(0.0, h0)] + prof + [(0.0, h1)], wood, segments=96)
    cap = turned("cap", [(0.10, h1 + 0.02), (0.142, h1 + 0.015), (0.148, h1 - 0.005), (0.148, h1 - 0.05), (0.135, h1 - 0.075), (0.09, h1 - 0.105),
                         (0.045, h1 - 0.118), (0.0, h1 - 0.12)], trim, segments=96)
    kit.bevel(cap, 0.005)

    root = kit.group(parts, "magnifier")
    rot = Matrix.Rotation(math.radians(YAW), 4, "Z") @ Matrix.Rotation(math.radians(TILT), 4, "X") @ Matrix.Rotation(math.radians(ROLL), 4, "Y")
    root.matrix_world = rot
    bpy.context.view_layer.update()
    centre = (rot @ Matrix.Translation((0, -0.115, 0))).to_translation()  # the middle of the lens's front
    normal = (rot.to_3x3() @ Matrix.Translation((0, -1, 0)).to_translation())
    grip = (rot @ Matrix.Translation((0, 0, (h0 + h1) / 2))).to_translation()
    return parts, glass, centre, normal, grip


def shoot(path, samples=int(os.environ.get("SAMPLES", 160)), size=SIZE * 3, line=2.0):
    kit.reset()
    kit.setup(size=(size, size), samples=samples, transparent_glass=True)
    parts, glass, centre, normal, grip = build()
    cam = kit.camera("front")
    kit.fit(cam, parts, margin=1.02)  # fills its square: the lens is what the player aims with
    kit.studio(cam, span=2.2, target=tuple(centre))
    kit.window(cam, at=centre, normal=normal, toward=(-0.62, 0.62), spread=15, strength=3.2, span=2.2, only=[glass])
    kit.outline(line, exclude=[glass])
    kit.render(path, exr=True)
    return export.lift_glass(path), {"lens": kit.project(cam, centre), "grip": kit.project(cam, grip)}


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else export.scratch("magnifier")
    im, anchors = shoot(os.path.join(out, "magnifier.png"))
    im.save(os.path.join(out, "magnifier_lifted.png"))
    lx, ly = anchors["lens"]
    print("magnifier", {k: (round(x, 3), round(y, 3)) for k, (x, y) in anchors.items()}, "LENS =", (round(lx - 0.5, 3), round(ly - 0.5, 3)))
    total = export.export(im, "assets/brand/magnifier.png", sizes=(SIZE, SIZE), canvas=True)
    print(f"total {total / 1024:.1f} KB")

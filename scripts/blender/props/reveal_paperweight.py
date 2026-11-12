# The paperweight on the fold-in page (src/play2/tools/FoldSheet.tsx): a turned brass desk
# weight with a knob, seen from above, standing on the page's top-left corner. It is why the
# left of the page lies still while the right is folded in. Its soft shadow is in the alpha.
#
#   <bpy python> scripts/blender/props/reveal_paperweight.py [outdir]   # writes assets/reveal/paperweight*.png, prints CENTRE
from reveal_common import *  # noqa: F401,F403

PT = 21.0              # points per unit: the weight is 42 pt across
W, H = 60, 60


def build():
    brass = M.brass("brass", age=0.55, brushed=0.8, wear=0.7)
    trim = M.brass("knob", color=(0.70, 0.45, 0.16), age=0.3, brushed=0.3, wear=0.8, rough=0.22)
    base = kit.lathe([(0.0, 0.0), (0.97, 0.0), (1.0, 0.03), (1.0, 0.12), (0.955, 0.19), (0.86, 0.21), (0.80, 0.25), (0.74, 0.30), (0.66, 0.30),
                      (0.60, 0.25), (0.52, 0.215), (0.40, 0.21), (0.0, 0.21)], segments=128, name="weight")
    kit.bevel(base, 0.012)
    kit.assign(base, brass)
    knob = kit.lathe([(0.0, 0.20), (0.33, 0.20), (0.29, 0.27), (0.21, 0.33), (0.19, 0.42), (0.27, 0.50), (0.335, 0.58), (0.35, 0.68), (0.31, 0.79),
                      (0.22, 0.87), (0.10, 0.905), (0.0, 0.91)], segments=96, name="knob")
    kit.assign(knob, trim)
    parts = [base, knob]
    lay_flat(parts, "paperweight")
    return parts


def shoot(path):
    scene(W, H)
    build()
    cam = flat_camera(W, H, PT, centre=(0.08, -0.08))
    kit.studio(cam, span=2.0, target=(0, 0, 0))
    wall_shadow(0.0, -1.5, 1.5, -1.5, 1.5, reach=0.6, strength=1.0)
    kit.outline(2.0)
    ink_over_shadow()
    kit.render(path)
    return anchor(cam, (0, 0, 0), W, H)


if __name__ == "__main__":
    out = out_dir()
    src = os.path.join(out, "paperweight.png")
    centre = shoot(src)
    print("paperweight  CENTRE =", centre, " size =", (W, H))
    total = export.export(src, "assets/reveal/paperweight.png", sizes=(W, H), canvas=True)
    print(f"total {total / 1024:.1f} KB")

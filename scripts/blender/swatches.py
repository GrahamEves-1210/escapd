# Every material on the shelf, on the same turned finial, in the house studio:
# a quick way to see what a parameter does and to check a new material against
# the others.
#   <bpy python> scripts/blender/swatches.py [out.png]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402

import export  # noqa: E402
import kit  # noqa: E402
import materials as M  # noqa: E402

SHELF = [
    ("brass", lambda: M.brass()), ("brass age=1", lambda: M.brass(age=1.0, brushed=0.8)), ("steel (blued)", lambda: M.steel()),
    ("silver", lambda: M.silver()), ("walnut", lambda: M.walnut()), ("ebony", lambda: M.ebony()),
    ("glass", lambda: M.glass()), ("gel (red)", lambda: M.gel()), ("enamel", lambda: M.enamel()),
    ("felt", lambda: M.felt()), ("paper", lambda: M.paper()), ("leather", lambda: M.leather()),
    ("wax", lambda: M.wax()), ("ceramic", lambda: M.ceramic()), ("rubber", lambda: M.rubber()),
    ("glow", lambda: M.glow(strength=4.0, falloff=0.3)), ("flame", lambda: M.flame(height=1.5, base=0.05)), ("toon", lambda: M.toon()),
]


def finial():
    """A turned knob on a stepped foot: round, flat and edged surfaces in one shape."""
    prof = [(0, 0), (0.62, 0), (0.66, 0.04), (0.66, 0.16), (0.6, 0.2), (0.44, 0.22), (0.36, 0.3), (0.34, 0.42), (0.40, 0.5), (0.40, 0.56), (0.30, 0.62)]
    import math
    prof += [(0.58 * math.sin(math.radians(a)), 1.12 - 0.58 * math.cos(math.radians(a))) for a in range(30, 181, 10)]
    ob = kit.lathe(prof, segments=96, max_len=0.03)
    kit.bevel(ob, 0.012)
    return ob


def main(out):
    tmp = os.path.join(os.path.dirname(out), "swatches")
    cells = []
    for label, make in SHELF:
        kit.reset()
        glassy = label.split()[0] in ("glass", "gel", "flame")
        kit.setup(size=(150, 150), samples=64, transparent_glass=glassy)
        if label == "flame":
            import math
            ob = kit.lathe([(0, 0.05)] + [(0.34 * math.sin(math.pi * t) ** 0.8 * (1 - t) ** 0.55 * 1.9, 0.05 + 1.5 * t) for t in [i / 24 for i in range(1, 24)]] + [(0, 1.55)], segments=48)
        else:
            ob = finial()
        kit.assign(ob, make())
        cam = kit.camera("product")
        kit.fit(cam, [ob], margin=1.12)
        kit.studio(cam, span=1.7, target=(0, 0, 0.85))
        if label.split()[0] in ("glass", "flame", "glow"):
            kit.no_outline()
        else:
            kit.outline(2.0)
        path = os.path.join(tmp, label.replace(" ", "_") + ".png")
        kit.render(path, exr=glassy)
        im = export.lift_glass(path) if glassy else export.load(path)
        cells.append((label, export.resize(im, (150, 150))))
    export.sheet(cells[:9], out.replace(".png", "_1.png"), grounds=("noir", "paper"), height=150, also_actual=0, title="scripts/blender/materials.py (1/2)")
    export.sheet(cells[9:], out.replace(".png", "_2.png"), grounds=("noir", "paper"), height=150, also_actual=0, title="scripts/blender/materials.py (2/2)")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else export.scratch("swatches.png"))

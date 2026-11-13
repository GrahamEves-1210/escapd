# The music box of the "tune" reveal (src/play2/tools/TuneSheet.tsx), seen from above with its
# lid thrown open behind it: a walnut case lined in wine felt, a brass bedplate, the brass
# cylinder (bare: the game draws its pins live, so it can turn), a steel comb of six teeth, long
# for the low notes on the left to short for the high on the right, each engraved with its mark
# (the door's wheel symbols, low to high), a worm and gear, and the boss the crank turns on.
# Two pictures:
#
#   musicbox        the box with everything but the crank's arm
#   musicbox-crank  the crank's arm and knob, pointing right from its pivot: the game turns it
#                   about the pivot under the finger
#
# Everything the game needs to draw over the picture is printed at the end (points from the
# picture's top left): the cylinder's axis and radius, the teeth's columns and marks, the pivot.
#
#   <bpy python> scripts/blender/props/reveal_musicbox.py [outdir] [--box|--crank]
import numpy as np

from reveal_common import *  # noqa: F401,F403

PT = 100.0
W, H = 330, 300
# In points, from the picture's top left.
CASE = (10, 50, 320, 292)            # the case's outside
WALL = 13
CYL = {"x0": 44, "x1": 232, "y": 128, "r": 30}
TEETH = 6
COMB = {"x0": 40, "x1": 236, "tip": 159, "root0": 214, "root1": 190, "foot": 248, "mark_y": 181, "mark": 15}
PIVOT = (278, 152)
ARM = 26                             # pivot to knob
CW, CH, CPIVOT = 64, 36, (15, 18)    # the crank's picture and the pivot in it

MARKS = {  # the wheel symbols in a 24-point box, as revealText.SYMBOL draws them
    "triangle": [(12.3, 3.2), (21.4, 20.2), (2.8, 20.8)],
    "circle": [(12 + 8.7 * math.cos(math.radians(a)), 12 + 8.7 * math.sin(math.radians(a))) for a in range(0, 360, 12)],
    "diamond": [(12.1, 2.6), (21, 12.1), (11.8, 21.5), (3, 11.9)],
    "square": [(4.2, 4.5), (19.9, 4.0), (20.2, 19.9), (3.9, 20.2)],
    "star": [(12, 2.8), (14.6, 9.2), (21.3, 9.5), (16.1, 13.8), (17.9, 20.6), (12.1, 16.8), (6.2, 20.7), (8, 13.9), (2.8, 9.6), (9.5, 9.1)],
    "cross": [(9.4, 3.2), (14.6, 3.2), (14.5, 9.4), (20.8, 9.5), (20.8, 14.6), (14.6, 14.5), (14.7, 20.8), (9.4, 20.8), (9.5, 14.6), (3.2, 14.7), (3.2, 9.4), (9.5, 9.5)],
}
ORDER = ["triangle", "circle", "diamond", "square", "star", "cross"]   # low to high


def X(px):
    return (px - W / 2) / PT


def Z(py):
    return (H / 2 - py) / PT


def slab(px0, py0, px1, py1, d0, d1, mat, name="slab", bevel=0.012):
    """A block lying on the desk: its outline in points, from d0 to d1 units above the desk."""
    ob = kit.box(((px1 - px0) / PT, d1 - d0, (py1 - py0) / PT), (X((px0 + px1) / 2), -(d0 + d1) / 2, Z((py0 + py1) / 2)), name, bevel_width=bevel)
    kit.assign(ob, mat)
    return ob


def prism(points, d0, d1, mat, name="prism"):
    """An outline in points (any polygon, in order), from d0 to d1 above the desk."""
    n = len(points)
    verts = [(X(px), -d1, Z(py)) for px, py in points] + [(X(px), -d0, Z(py)) for px, py in points]
    faces = [tuple(range(n))] + [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
    ob = mesh_object(name, verts, faces, smooth=False)
    kit.assign(ob, mat)
    return ob


def turned_up(profile, px, py, mat, name="turned", **kw):
    """A lathe part standing on the desk at a point (its axis toward the camera)."""
    ob = kit.lathe(profile, name=name, **kw)
    ob.rotation_euler = (math.radians(90), 0, 0)
    ob.location = (X(px), 0.0, Z(py))
    kit.assign(ob, mat)
    return ob


def turned_along(profile, px0, py, d, mat, name="shaft", **kw):
    """A lathe part lying along +x from px0, its axis d above the desk (profile z = distance along it, in units)."""
    ob = kit.lathe(profile, name=name, **kw)
    ob.rotation_euler = (0, math.radians(90), 0)
    ob.location = (X(px0), -d, Z(py))
    kit.assign(ob, mat)
    return ob


def tooth_columns():
    pitch = (COMB["x1"] - COMB["x0"]) / TEETH
    return [(COMB["x0"] + i * pitch + 2.2, COMB["x0"] + (i + 1) * pitch - 2.2) for i in range(TEETH)]


def root_at(px):
    return COMB["root0"] + (COMB["root1"] - COMB["root0"]) * (px - COMB["x0"]) / (COMB["x1"] - COMB["x0"])


def build_box():
    walnut = M.walnut("case", axis="X", color=(0.115, 0.045, 0.022), figure=0.5, gloss=0.6, wear=0.35, scale=1.6)
    felt = M.felt("lining", color=(0.085, 0.016, 0.035), nap=0.7, scale=6.0)   # a coarse, quiet nap: fine fibre noise is most of a PNG's weight
    brass = M.brass("bedplate", age=0.6, brushed=0.7, wear=0.5, axis="X", scale=1.5)
    bright = M.brass("cylinder", color=(0.72, 0.47, 0.17), age=0.25, brushed=0.6, wear=0.6, rough=0.24, scale=1.5)
    trim = M.brass("trim", color=(0.70, 0.45, 0.16), age=0.35, brushed=0.3, wear=0.8, rough=0.25, scale=1.5)
    steel = M.steel("comb", color=(0.50, 0.53, 0.59), blue=1.0, rough=0.3, brushed=0.7, wear=0.85, edge=(0.86, 0.87, 0.90), axis="Z", scale=1.5)
    arbor = M.steel("arbor", blue=0.6, rough=0.3, wear=0.4, scale=1.5)
    dark = M.ink("engraved", (0.016, 0.014, 0.022))
    parts, plain = [], []

    x0, y0, x1, y1 = CASE
    # The case: four mitred walls on a plinth, the felt floor between them.
    walls = moulding([(X(x0 + WALL), Z(y1 - WALL)), (X(x1 - WALL), Z(y1 - WALL)), (X(x1 - WALL), Z(y0 + WALL)), (X(x0 + WALL), Z(y0 + WALL))],
                     [(0.0, 0.05), (0.004, 0.47), (0.018, 0.50), (0.112, 0.50), (0.126, 0.475), (0.132, 0.11), (0.148, 0.08), (0.156, 0.0)], "walls")
    kit.assign(walls, walnut)
    kit.bevel(walls, 0.008)
    parts.append(walls)
    parts.append(slab(x0 + WALL - 1, y0 + WALL - 1, x1 - WALL + 1, y1 - WALL + 1, 0.0, 0.05, felt, "floor", bevel=0.0))
    # The lid, thrown open: it stands at the back, leaning away, so from above it is its far edge and a sliver of its lined inside.
    lid_len, lean = (y1 - y0) / PT, math.radians(-10)
    lid = kit.box(((x1 - x0) / PT, lid_len, 0.12), (0, -lid_len / 2, 0.06), "lid", bevel_width=0.02)
    kit.assign(lid, walnut)
    lining = kit.box(((x1 - x0 - 30) / PT, lid_len - 0.3, 0.012), (0, -lid_len / 2, -0.004), "lid_lining", bevel_width=0.0)
    kit.assign(lining, felt)
    # (The house key comes from the picture's upper left, which here is from behind the box: a lid this tall
    # would lay its shadow over the whole movement. It throws none.)
    lid.visible_shadow = lining.visible_shadow = False
    hinge = kit.group([lid, lining], "lid_hinge")
    hinge.rotation_euler = (lean, 0, 0)
    hinge.location = (0, -0.50, Z(y0) + 0.01)
    parts += [lid, lining]
    for px in (x0 + 52, x1 - 52):
        parts.append(turned_along([(0, 0), (0.03, 0), (0.034, 0.01), (0.034, 0.17), (0.03, 0.18), (0, 0.18)], px - 9, y0 - 1, 0.50, trim, "hinge", segments=24))

    # The movement: a brass bedplate, the cylinder in its two bearings, the gear and the worm that turn it.
    parts.append(slab(30, 88, 256, 264, 0.05, 0.085, brass, "bedplate"))
    parts.append(slab(258, 118, 304, 186, 0.05, 0.085, brass, "crank_plate"))
    c = CYL
    length = (c["x1"] - c["x0"]) / PT
    r = c["r"] / PT
    axis = 0.085 + r + 0.035
    cyl = turned_along([(0, 0), (r - 0.035, 0), (r, 0.03), (r, length - 0.03), (r - 0.035, length), (0, length)], c["x0"], c["y"], axis, bright, "cylinder", segments=128)
    kit.bevel(cyl, 0.006)
    parts.append(cyl)
    parts.append(turned_along([(0, 0), (0.045, 0), (0.045, 2.3), (0, 2.3)], 30, c["y"], axis, arbor, "arbor", segments=24))
    for px in (31, c["x1"] + 14):
        parts.append(slab(px, c["y"] - 17, px + 10, c["y"] + 17, 0.085, axis + 0.09, trim, "bearing", bevel=0.02))
    gear = turned_along([(0, 0), (0.17, 0), (0.19, 0.012), (0.19, 0.078), (0.17, 0.09), (0, 0.09)], c["x1"] + 2.5, c["y"], axis, trim, "gear", segments=120,
                        max_len=0.02, displace=lambda a, z, rr: kit.flutes(20, 0.03)(a, z, rr) * (rr > 0.18))
    parts.append(gear)
    plain.append(gear)
    parts.append(turned_along([(0, 0), (0.05, 0), (0.05, 0.44), (0, 0.44)], c["x1"] + 24, c["y"], axis, arbor, "worm", segments=24,
                              max_len=0.01, displace=lambda a, z, rr: 0.012 * np.sin(z * 2 * math.pi / 0.045 + a) * (rr > 0.04)))
    # The crank's gear and the boss its arm sits on.
    boss = turned_up([(0, 0.085), (0.19, 0.085), (0.205, 0.10), (0.205, 0.15), (0.19, 0.165), (0.11, 0.17), (0.085, 0.19), (0.085, 0.30), (0.07, 0.315), (0, 0.315)],
                     PIVOT[0], PIVOT[1], trim, "boss", segments=120, max_len=0.02, displace=lambda a, z, rr: kit.flutes(22, 0.028)(a, z, rr) * (rr > 0.19))
    parts.append(boss)
    plain.append(boss)

    # The comb: a steel bar screwed to the bedplate, six teeth reaching to the cylinder, long (low) to short (high), a mark on each.
    cb = COMB
    parts.append(prism([(cb["x0"], cb["root0"]), (cb["x1"], cb["root1"]), (cb["x1"], cb["foot"]), (cb["x0"], cb["foot"])], 0.085, 0.155, steel, "comb_bar"))
    for i, (xl, xr) in enumerate(tooth_columns()):
        tooth = prism([(xl + 1.6, cb["tip"]), (xr - 1.6, cb["tip"]), (xr, root_at(xr) + 3), (xl, root_at(xl) + 3)], 0.095, 0.138, steel, "tooth")
        kit.bevel(tooth, 0.006)
        parts.append(tooth)
        k = cb["mark"] / 24.0
        cx = (xl + xr) / 2
        pts = [(cx + (px - 12) * k, cb["mark_y"] + (py - 12) * k) for px, py in MARKS[ORDER[i]]]
        mark = prism(pts, 0.137, 0.1395, dark, "mark")
        parts.append(mark)
        plain.append(mark)
    for px, py in ((66, 235), (138, 229), (210, 222)):
        parts.append(turned_up([(0, 0.155), (0.05, 0.155), (0.056, 0.165), (0.05, 0.182), (0.02, 0.19), (0, 0.19)], px, py, arbor, "screw", segments=24))
    return parts, plain


def shoot_box(path):
    scene(W, H)
    parts, plain = build_box()
    cam = flat_camera(W, H, PT)
    kit.studio(cam, span=3.2, target=(0, 0, 0))
    x0, y0, x1, y1 = CASE
    wall_shadow(0.0, X(x0 - 40), X(x1 + 40), Z(y1 + 40), Z(y0 - 40), reach=0.16, strength=0.85)
    kit.outline(3.0, plain=plain)
    ink_over_shadow()
    kit.render(path)


def build_crank():
    trim = M.brass("arm", color=(0.70, 0.45, 0.16), age=0.35, brushed=0.4, wear=0.8, rough=0.25, scale=0.5)
    knob_wood = M.ceramic("knob", color=(0.80, 0.73, 0.58), glaze=0.7, speckle=0.0, scale=0.4)   # a bone knob: the one pale thing in the box, what the hand goes to
    px0, py0 = CPIVOT
    x = lambda px: (px - CW / 2) / PT   # noqa: E731
    z = lambda py: (CH / 2 - py) / PT   # noqa: E731
    arm = kit.box(((ARM + 6) / PT, 0.035, 0.07), (x(px0 + ARM / 2), -0.0175, z(py0)), "arm", bevel_width=0.016)
    kit.assign(arm, trim)
    cap = kit.lathe([(0, 0.0), (0.075, 0.0), (0.082, 0.012), (0.082, 0.045), (0.065, 0.062), (0.03, 0.07), (0.022, 0.085), (0, 0.086)], segments=48, name="cap")
    cap.rotation_euler = (math.radians(90), 0, 0)
    cap.location = (x(px0), 0, z(py0))
    kit.assign(cap, trim)
    knob = kit.lathe([(0, 0.03), (0.05, 0.03), (0.062, 0.05), (0.066, 0.08), (0.092, 0.11), (0.102, 0.16), (0.098, 0.22), (0.08, 0.262), (0.045, 0.284), (0, 0.29)],
                     segments=64, name="knob")
    knob.rotation_euler = (math.radians(90), 0, 0)
    knob.location = (x(px0 + ARM), 0, z(py0))
    kit.assign(knob, knob_wood)
    return [arm, cap, knob]


def shoot_crank(path):
    scene(CW, CH)
    build_crank()
    cam = flat_camera(CW, CH, PT)
    kit.studio(cam, span=0.7, target=(0, 0, 0))
    kit.outline(2.0)
    kit.render(path)


if __name__ == "__main__":
    out = out_dir()
    which = [a for a in sys.argv[1:] if a.startswith("--")]
    total = 0
    if not which or "--box" in which:
        src = os.path.join(out, "musicbox.png")
        shoot_box(src)
        total += ship(src, "assets/reveal/musicbox.png", (W, H), errors=(10.0, 14.0, 20.0, 28.0))
    if not which or "--crank" in which:
        src = os.path.join(out, "musicbox-crank.png")
        shoot_crank(src)
        total += ship(src, "assets/reveal/musicbox-crank.png", (CW, CH))
    cols = [(round(a, 2), round(b, 2)) for a, b in tooth_columns()]
    print("musicbox  size =", (W, H), " CYL =", CYL, " COMB =", COMB, " columns =", cols, " roots =", [round(root_at((a + b) / 2), 1) for a, b in cols],
          " PIVOT =", PIVOT, " ARM =", ARM, " crank size =", (CW, CH), " crank pivot =", CPIVOT)
    print(f"total {total / 1024:.1f} KB")

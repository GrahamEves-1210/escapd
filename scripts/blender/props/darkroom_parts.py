# The darkroom's loose parts (the build wait, src/screens/develop/Darkroom.tsx):
#
#   line          the drying line strung across the top: a twisted jute cord, sagging a little
#   peg, peg-<mode>   a sprung wooden clothes-peg; one a mode has its handles dipped in that mode's accent
#   print         a dry sheet of photo paper with a window where the player's photo goes (hung on the line)
#   print-wet     the same sheet lying in the tray under the safelight (red-lit, flat), and
#   print-blank   that sheet with nothing on it yet: laid over the photo and faded out as it develops
#
# The line, the pegs and the dry print are in the house light (the app dims them while the room is
# dark and lets them show when the lights come up); the wet sheets are lit like the tray.
#
#   <bpy python> scripts/blender/props/darkroom_parts.py [line] [pegs] [prints]     # default: all
#   (the files in assets/develop: PX=3 SS=2 SAMPLES=64)
from darkroom_common import *  # noqa: F401,F403

OUT = os.environ.get("DRAFT_DIR")
RAW = export.scratch("darkroom")
dest = (lambda name: os.path.join(OUT, name)) if OUT else (lambda name: "assets/develop/" + name)

# The line: LINE_W x LINE_H points, hung from beyond both edges, SAG lower in the middle than at the picture's edges.
LINE_W, LINE_H, LINE_TOP, SAG, LINE_PT = 440, 22, 6.0, 8.0, 40.0
# A peg: PEG_W x PEG_H points.
PEG_W, PEG_H, PEG_PT = 16, 40, 21.0
# The sheets: hung dry at DRY_W points across, lying wet at SHEET_W * PT; each picture has MARGIN points of air round the paper.
DRY_W, MARGIN = 58.0, 2.0
ACCENTS = {"noir": "#E9B8A6", "crime_scene": "#C83D50", "paranormal": "#B8A6F7", "shell": "#F2B8C9"}


def front(w_pt, h_pt, pt, centre=(0.0, 0.0), elev=0.0, azim=0.0):
    return kit.camera("front", target=(centre[0], 0.0, centre[1]), span=max(w_pt, h_pt) / pt, elev=elev, azim=azim)


def line():
    scene(LINE_W, LINE_H)
    half = LINE_W / 2 / LINE_PT
    def z(x):
        return -(SAG / LINE_PT) * (1 - (x / half) ** 2)
    strands = []
    r_helix, r_strand, pitch = 0.6 / LINE_PT, 0.72 / LINE_PT, 6.0 / LINE_PT
    n = int((2 * half + 1.0) / pitch * 14)
    for k in range(3):
        pts = []
        for i in range(n + 1):
            x = -half - 0.5 + (2 * half + 1.0) * i / n
            a = 2 * math.pi * (x / pitch + k / 3)
            pts.append((x, r_helix * math.cos(a), z(x) + r_helix * math.sin(a)))
        s = tube(pts, r_strand, segments=8, name="strand", cap=False)
        kit.assign(s, M.paper("jute", color=(0.46, 0.34, 0.19), fibre=1.0, age=0.5, scale=0.25))
        strands.append(s)
    cam = front(LINE_W, LINE_H, LINE_PT, centre=(0.0, -(LINE_H / 2 - LINE_TOP) / LINE_PT))
    kit.studio(cam, span=6.0, target=(0, 0, 0))
    kit.outline(1.5, plain=strands)
    src = kit.render(os.path.join(RAW, "line.png"))
    print("LINE: y(x) =", LINE_TOP, "+", SAG, "* (1 - ((x - w/2) / (w/2))^2), points from the picture's top; picture", (LINE_W, LINE_H))
    return ship(src, dest("line.png"), (LINE_W, LINE_H), scales=SCALES)


def peg(name, paint):
    """A sprung peg seen a little from the right, so both its halves and the spring between show."""
    scene(PEG_W, PEG_H)
    wood = M.walnut("beech", axis="Z", color=(0.50, 0.33, 0.16), figure=0.3, gloss=0.15, wear=0.5, scale=1.0)
    dip = M.enamel("dip", color=srgb(paint), gloss=0.55, chips=0.2) if paint else None
    parts = []
    tall, wide, thick = 1.62, 0.34, 0.13
    lean = math.radians(4.2)
    for side in (-1, 1):
        # The halves pinch at the jaws and stand apart at the handles.
        at = Vector((0, side * (thick / 2 + 0.012 + tall / 2 * math.sin(lean)), tall / 2))
        half = kit.box((wide, thick, tall), (0, 0, 0), name="half", bevel_width=0.03)
        kit.assign(half, wood)
        half.location = at
        half.rotation_euler = (-side * lean, 0, 0)
        parts.append(half)
        if dip:
            up = Vector((0, side * math.sin(lean), math.cos(lean)))
            cap = kit.box((wide + 0.014, thick + 0.014, tall * 0.34), (0, 0, 0), name="dip", bevel_width=0.034)
            kit.assign(cap, dip)
            cap.location = at + up * (tall * 0.33 + 0.004)
            cap.rotation_euler = (-side * lean, 0, 0)
            parts.append(cap)
    steel = M.steel("spring", color=(0.42, 0.43, 0.46), blue=0.2, rough=0.3, wear=0.6)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.085, depth=wide + 0.06, location=(0, 0, 0.74), rotation=(0, math.radians(90), 0), vertices=24)
    coil = bpy.context.object
    kit.shade(coil)
    kit.assign(coil, steel)
    parts.append(coil)
    for side in (-1, 1):
        y = side * (thick + 0.075)
        wire = tube([(-wide / 2 - 0.03, 0, 0.74), (-wide / 2 - 0.035, y * 0.9, 0.66), (-wide / 2 - 0.02, y, 0.52), (0, y * 1.02, 0.50), (wide / 2 + 0.02, y, 0.52)], 0.022, segments=10, name="wire")
        kit.assign(wire, steel)
        parts.append(wire)
    bpy.context.view_layer.update()
    cam = front(PEG_W, PEG_H, PEG_PT, centre=(0.0, tall / 2 + 0.03), elev=6.0, azim=32.0)
    kit.studio(cam, span=1.8, target=(0, 0, tall / 2))
    kit.outline(2.0)
    src = kit.render(os.path.join(RAW, f"{name}.png"))
    grip = anchor(cam, (0, 0, 0.36), PEG_W, PEG_H)
    bite = anchor(cam, (0, 0, 0.10), PEG_W, PEG_H)
    print(name, " GRIP (the line) =", grip, " BITE (the paper's top edge) =", bite, " size =", (PEG_W, PEG_H))
    return ship(src, dest(f"{name}.png"), (PEG_W, PEG_H), scales=SCALES)


def sheet(name, wet, hole):
    """A sheet of photo paper facing the camera. hole: the picture's window cut out. wet: flat, lit by
    the safelight; dry: curled a little at its foot, in the house light."""
    pt = SHEET_W * PT / SHEET_W if wet else DRY_W / 1.5
    w = SHEET_W if wet else 1.5
    h = w * SHEET_H / SHEET_W
    b = w * BORDER / SHEET_W
    W, H = w * pt + 2 * MARGIN, h * pt + 2 * MARGIN
    scene(W, H)
    nx, ny = 30, 40
    verts = {}
    faces = []
    def vert(i, j):
        if (i, j) not in verts:
            x, z = -w / 2 + w * i / nx, -h / 2 + h * j / ny
            lift = 0.0 if wet else 0.07 * w * (1 - j / ny) ** 2.4 * (0.35 + 0.65 * abs(2 * i / nx - 1) ** 1.5)
            verts[(i, j)] = (len(verts), (x, -lift, z))
        return verts[(i, j)][0]
    for i in range(nx):
        for j in range(ny):
            cx, cz = -w / 2 + w * (i + 0.5) / nx, -h / 2 + h * (j + 0.5) / ny
            if hole and abs(cx) < w / 2 - b and abs(cz) < h / 2 - b:
                continue
            faces.append((vert(i, j), vert(i + 1, j), vert(i + 1, j + 1), vert(i, j + 1)))
    order = sorted(verts.values())
    # The window's edge exactly on the border (the grid's cells are close to it, not on it).
    def snap(p):
        x, y, z = p
        if hole:
            for edge in (w / 2 - b, -(w / 2 - b)):
                if abs(x - edge) < w / nx * 0.51 and abs(z) <= h / 2 - b + h / ny * 0.51:
                    x = edge
            for edge in (h / 2 - b, -(h / 2 - b)):
                if abs(z - edge) < h / ny * 0.51 and abs(x) <= w / 2 - b + 1e-6:
                    z = edge
        return (x, y, z)
    paper = mesh_object("sheet", [snap(p) for _, p in order], faces, smooth=True, sharp=50.0)
    mod = paper.modifiers.new("thick", "SOLIDIFY")
    mod.thickness = 0.012 * w
    mod.offset = 1.0
    kit.assign(paper, M.paper("photo_paper", color=(0.90, 0.875, 0.82), fibre=0.25, age=0.06, scale=w / 2))
    cam = front(W, H, pt)
    if wet:
        kit.studio(cam, span=w * 1.6, target=(0, 0, 0), key=1.7, fill=0.12, rim=0.3, ambient=0.3, warm=(1.0, 0.24, 0.12), cool=(0.80, 0.20, 0.26))
    else:
        kit.studio(cam, span=w * 1.6, target=(0, 0, 0))
    kit.outline(2.0 if not wet else 3.0, creases=False)
    src = kit.render(os.path.join(RAW, f"{name}.png"))
    print(name, " picture =", (round(W, 1), round(H, 1)), " paper =", (round(w * pt, 1), round(h * pt, 1)), " border =", round(b * pt, 2), " margin =", MARGIN)
    return ship(src, dest(f"{name}.png"), (W, H), scales=SCALES)


if __name__ == "__main__":
    which = [a for a in sys.argv[1:] if a in ("line", "pegs", "prints")] or ["line", "pegs", "prints"]
    total = 0
    if "line" in which:
        total += line()
    if "pegs" in which:
        total += peg("peg", None)
        for mode, colour in ACCENTS.items():
            total += peg(f"peg-{mode.replace('_', '-')}", colour)
    if "prints" in which:
        total += sheet("print", wet=False, hole=True)
        total += sheet("print-wet", wet=True, hole=True)
        total += sheet("print-blank", wet=True, hole=False)
    print(f"total {total / 1024:.1f} KB")

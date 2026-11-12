# The held items' icons (src/play2/icons): shared pose, framing and modelling
# helpers. Each item is modelled "lying on the desk" (x right, y up the page,
# z toward whoever is looking at it), about 2 units on its long side, then posed
# by pose(): leaned back so its near edge shows, turned a little like a thing
# put down, never square to the frame.
#
# One picture per item, square, the thing filling it (so the set is one scale in
# the tray), no baked shadow: the app lays its own under each (GroundShadow) and
# carries them about. Shown at 22 to 50 pt in the tray, on tags and on the
# close-up's table, 104 pt when examined: exported for 104 pt, the ink line a
# little heavier than the house weight so it still holds at 36.
import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

import export  # noqa: E402
import kit  # noqa: E402
import materials as M  # noqa: E402

SIZE = 104          # points: the largest the app shows one (examined, InspectView); @3x = 312 px
LINE = 4.2          # px at @3x: 1.4 pt examined, 0.56 pt in a 42 pt well (paper things: PAPER_LINE)
PAPER_LINE = 5.4    # flat pale things are held by their line alone on a paper tag: a pen pressed harder
LEAN = 40.0         # degrees the desk is tipped up toward the camera (64 would be face-on)
MARGIN = 1.08
FONTS = os.path.join(export.REPO, "node_modules", "@expo-google-fonts")

# The set's own colours (linear RGB): they must read on plum, oxblood and indigo felt and on cream paper.
CREAM = (0.78, 0.72, 0.60)        # letter paper (the key light warms it)
BUFF = (0.80, 0.64, 0.40)         # envelopes, card
WHITE = (0.90, 0.86, 0.76)        # a pad's fresh sheet, a photograph's border
PEN = (0.16, 0.10, 0.10)          # handwriting: a soft brown-black
WAXRED = (0.52, 0.035, 0.045)     # sealing wax, a ribbon, a pointer
VERMILION = (0.74, 0.10, 0.045)   # match heads, red print


# ---------------------------------------------------------------- shapes


def mesh(verts, faces, name="mesh", smooth=False):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], faces)
    me.update()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    if smooth:
        kit.shade(ob, 40)
    return ob


def to_mesh(ob):
    with bpy.context.temp_override(active_object=ob, object=ob, selected_objects=[ob], selected_editable_objects=[ob]):
        bpy.ops.object.convert(target="MESH")
    return ob


def plate(outline, thick=0.1, holes=(), z=0.0, round_=0.02, name="plate", resolution=3):
    """A flat shape cut from sheet: `outline` (and `holes`) are closed lists of (x, y), given
    thickness `thick` upward from z, its edges rounded by `round_`."""
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "2D"
    cu.fill_mode = "BOTH"
    round_ = min(round_, thick / 2 - 1e-4)
    cu.extrude = thick / 2 - round_
    cu.bevel_depth = round_
    cu.bevel_resolution = resolution
    for ring in (outline, *holes):
        sp = cu.splines.new("POLY")
        sp.points.add(len(ring) - 1)
        for p, (x, y) in zip(sp.points, ring):
            p.co = (x - 0.0, y, 0.0, 1.0)
        sp.use_cyclic_u = True
    ob = bpy.data.objects.new(name, cu)
    bpy.context.scene.collection.objects.link(ob)
    ob.location = (0, 0, z + thick / 2)
    to_mesh(ob)
    kit.shade(ob, 40)
    return ob


def circle(r, n=64, cx=0.0, cy=0.0, start=0.0, sx=1.0, sy=1.0):
    return [(cx + r * sx * math.cos(start + 2 * math.pi * i / n), cy + r * sy * math.sin(start + 2 * math.pi * i / n)) for i in range(n)]


def rounded(w, h, r, cx=0.0, cy=0.0, n=6):
    """A rounded rectangle's outline."""
    r = min(r, w / 2, h / 2)
    pts = []
    for qx, qy, a0 in ((1, 1, 0), (-1, 1, 90), (-1, -1, 180), (1, -1, 270)):
        for i in range(n + 1):
            a = math.radians(a0 + 90 * i / n)
            pts.append((cx + qx * (w / 2 - r) + r * math.cos(a), cy + qy * (h / 2 - r) + r * math.sin(a)))
    return pts


def fillet(pts, r, n=4):
    """Round every corner of a closed outline by about r."""
    out = []
    m = len(pts)
    for i in range(m):
        a, p, b = Vector(pts[i - 1]), Vector(pts[i]), Vector(pts[(i + 1) % m])
        t = min(r, 0.45 * (a - p).length, 0.45 * (b - p).length)
        q1, q2 = p + (a - p).normalized() * t, p + (b - p).normalized() * t
        for k in range(n + 1):
            f = k / n
            c = q1 * (1 - f) ** 2 + p * 2 * f * (1 - f) + q2 * f ** 2
            out.append((c.x, c.y))
    return out


def star(R, r, points=5, cx=0.0, cy=0.0, start=math.pi / 2):
    return [(cx + (R if i % 2 == 0 else r) * math.cos(start + math.pi * i / points), cy + (R if i % 2 == 0 else r) * math.sin(start + math.pi * i / points))
            for i in range(points * 2)]


def sheet(w, h, thick=0.03, left=None, right=None, top=None, bottom=None, bend=None, nx=40, ny=40, z=0.0, cx=0.0, cy=0.0, name="sheet"):
    """A sheet of paper or card, w x h, centred, lying at height z. left/right(v) and
    top/bottom(u) move an edge in or out (v, u run 0..1 up and across): a ragged tear,
    a dog-ear, a deckle. bend(x, y) lifts it (a crease, a curl); pass the same function
    as `surf` to writing() for what's written on it. cx, cy move its middle."""
    verts, faces = [], []
    for j in range(ny + 1):
        v = j / ny
        xl = -w / 2 + (left(v) if left else 0.0)
        xr = w / 2 + (right(v) if right else 0.0)
        for i in range(nx + 1):
            u = i / nx
            x = cx + xl + (xr - xl) * u
            yb = -h / 2 + (bottom(u) if bottom else 0.0)
            yt = h / 2 + (top(u) if top else 0.0)
            y = cy + yb + (yt - yb) * v
            verts.append((x, y, z + (bend(x, y) if bend else 0.0)))
    for j in range(ny):
        for i in range(nx):
            a = j * (nx + 1) + i
            faces.append((a, a + 1, a + nx + 2, a + nx + 1))
    ob = mesh(verts, faces, name, smooth=True)
    m = ob.modifiers.new("solid", "SOLIDIFY")
    m.thickness, m.offset = thick, -1.0
    return ob


def tube(points, radius=0.02, name="tube", cyclic=False, flat=1.0, resolution=3, smooth=True):
    """A wire through 3D points (string, a spiral binding, a pen stroke). flat < 1 squashes it in z."""
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = radius
    cu.bevel_resolution = resolution
    cu.use_fill_caps = True
    sp = cu.splines.new("NURBS" if smooth and len(points) > 3 else "POLY")
    sp.points.add(len(points) - 1)
    for p, co in zip(sp.points, points):
        p.co = (co[0], co[1], co[2] / flat, 1.0)
    sp.use_cyclic_u = cyclic
    if sp.type == "NURBS":
        sp.use_endpoint_u = not cyclic
        sp.order_u = 3
        sp.resolution_u = 6
    ob = bpy.data.objects.new(name, cu)
    bpy.context.scene.collection.objects.link(ob)
    to_mesh(ob)
    if flat != 1.0:
        ob.scale = (1, 1, flat)
        kit.apply_transforms(ob)
    kit.shade(ob, 60)
    return ob


def _rand(seed):
    """A small repeatable random stream (0..1)."""
    state = [(seed * 2654435761 + 12345) & 0xFFFFFFFF]

    def nxt():
        state[0] = (state[0] * 1664525 + 1013904223) & 0xFFFFFFFF
        return state[0] / 0xFFFFFFFF
    return nxt


def writing(rows, surf=None, z=0.0, radius=0.013, color=PEN, seed=1, wobble=0.014, gaps=True, name="writing"):
    """Lines of handwriting too small to read: rows = [(y, x0, x1), ...], each a wavering
    stroke broken into words. surf(x, y) is the height of what they're written on.
    Returns the strokes (pass them to outline's exclude: ink has no ink line)."""
    rnd = _rand(seed)
    mat = M.ink("pen_%d" % seed, color)
    out = []
    for (y, x0, x1) in rows:
        x = x0
        while x < x1 - 0.06:
            ln = min(x1 - x, (0.22 + 0.42 * rnd()) if gaps else (x1 - x))
            n = max(4, int(ln / 0.045))
            ph = rnd() * 6.28
            pts = []
            for i in range(n + 1):
                px = x + ln * i / n
                py = y + wobble * math.sin(ph + i * 1.9) + wobble * 0.6 * math.sin(ph * 2 + i * 0.7)
                pts.append((px, py, z + (surf(px, py) if surf else 0.0) + radius * 0.35))
            st = tube(pts, radius, name, flat=0.45)
            kit.assign(st, mat)
            out.append(st)
            x += ln + 0.07 + 0.05 * rnd()
    return out


def text(body, font, size=0.3, location=(0, 0, 0), thick=0.01, align="CENTER", name="text", rotation=0.0, spacing=1.0):
    """Lettering from a font already in the repo (node_modules/@expo-google-fonts/<font path>), a little proud."""
    cu = bpy.data.curves.new(name, "FONT")
    cu.body = body
    cu.font = bpy.data.fonts.load(os.path.join(FONTS, font), check_existing=True)
    cu.size = size
    cu.extrude = thick
    cu.align_x = align
    cu.align_y = "CENTER"
    cu.space_character = spacing
    ob = bpy.data.objects.new(name, cu)
    bpy.context.scene.collection.objects.link(ob)
    ob.location = location
    ob.rotation_euler = (0, 0, rotation)
    to_mesh(ob)
    return ob


def cyl(r, depth, location=(0, 0, 0), axis="Z", name="cyl", segments=48, bevel=0.01):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, vertices=segments, location=location)
    ob = bpy.context.object
    ob.name = name
    if axis == "X":
        ob.rotation_euler = (0, math.pi / 2, 0)
    elif axis == "Y":
        ob.rotation_euler = (math.pi / 2, 0, 0)
    kit.apply_transforms(ob)
    if bevel:
        kit.bevel(ob, bevel)
    kit.shade(ob, 40)
    return ob


def sphere(r, location=(0, 0, 0), scale=(1, 1, 1), name="sphere"):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=location, segments=32, ring_count=16)
    ob = bpy.context.object
    ob.name = name
    ob.scale = scale
    kit.apply_transforms(ob)
    kit.shade(ob, 60)
    return ob


def torus(R, r, location=(0, 0, 0), name="torus", scale=(1, 1, 1), major=64, minor=20):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, major_segments=major, minor_segments=minor, location=location)
    ob = bpy.context.object
    ob.name = name
    ob.scale = scale
    kit.apply_transforms(ob)
    kit.shade(ob, 60)
    return ob


def turned(profile, mat, axis="Z", location=(0, 0, 0), name="turned", bevel=0.008, **kw):
    """kit.lathe, laid along an axis and moved into place."""
    ob = kit.lathe(profile, name=name, **kw)
    if axis == "X":
        ob.rotation_euler = (0, math.pi / 2, 0)
    elif axis == "Y":
        ob.rotation_euler = (-math.pi / 2, 0, 0)
    kit.apply_transforms(ob)
    ob.location = location
    if bevel:
        kit.bevel(ob, bevel)
    kit.assign(ob, mat)
    return ob


def place(ob, location=None, rotation=None, scale=None):
    if location is not None:
        ob.location = location
    if rotation is not None:
        ob.rotation_euler = [math.radians(a) for a in rotation]
    if scale is not None:
        ob.scale = scale if isinstance(scale, (tuple, list)) else (scale,) * 3
    return ob


def paint(ob, mat):
    kit.assign(ob, mat)
    return ob


# ---------------------------------------------------------------- pose and shoot


ELEV = 26.0  # the camera: kit's "held" view


def pose(objects, roll=0.0, yaw=0.0, lean=LEAN, tip=0.0, name="item"):
    """Put the thing down for its portrait: turned `roll` degrees on the desk
    (anticlockwise), the desk tipped `lean` degrees toward the camera (0: a thing standing
    on it, seen from a little above; 64: flat to the picture), swung `yaw` degrees about
    the upright, then the whole picture turned `tip` degrees (anticlockwise)."""
    inner = kit.group(objects, name)
    inner.rotation_euler = (0, 0, math.radians(roll))
    outer = bpy.data.objects.new(name + "_pose", None)
    bpy.context.scene.collection.objects.link(outer)
    inner.parent = outer
    outer.rotation_euler = (math.radians(lean), 0, math.radians(yaw))
    top = bpy.data.objects.new(name + "_tip", None)
    bpy.context.scene.collection.objects.link(top)
    outer.parent = top
    top.rotation_mode = "AXIS_ANGLE"
    e = math.radians(ELEV)
    # About the line of sight (the camera sits on -Y, ELEV degrees up).
    top.rotation_axis_angle = (math.radians(tip), 0.0, -math.cos(e), math.sin(e))
    bpy.context.view_layer.update()
    return top


class Item:
    """What a build function returns: the objects, how they're posed, which get no line."""

    def __init__(self, parts, roll=0.0, yaw=0.0, lean=LEAN, tip=0.0, no_line=(), plain=(), line=LINE, samples=96, margin=MARGIN, key=1.0, fill=1.0, rim=1.0, frame=None, shift=(0.0, 0.0)):
        self.parts, self.roll, self.yaw, self.lean, self.tip = [p for p in parts if p is not None], roll, yaw, lean, tip
        self.no_line, self.plain, self.line, self.samples, self.margin = list(no_line), list(plain), line, samples, margin
        self.key, self.fill, self.rim = key, fill, rim
        self.frame = list(frame) if frame else None  # what the camera frames (default: every mesh)
        self.shift = shift  # then moved in the picture by these fractions of it (right, up)


def shoot(build, path, size=SIZE * 3, samples=None, line=None):
    """Render one item (build() -> Item) to `path`, square, the thing filling the frame.
    SAMPLES and SS in the environment make quick drafts."""
    kit.reset()
    kit.setup(size=(size, size), samples=int(os.environ.get("SAMPLES", samples or 96)), ss=int(os.environ.get("SS", 2)))
    item = build()
    if samples is None and item.samples != 96 and "SAMPLES" not in os.environ:
        bpy.context.scene.cycles.samples = item.samples
    pose(item.parts, item.roll, item.yaw, item.lean, item.tip)
    cam = kit.camera("held", elev=ELEV)
    solid = item.frame or [o for o in item.parts if o.type == "MESH"]
    kit.fit(cam, solid, margin=item.margin)
    if any(item.shift):
        cam.location -= cam.matrix_world.to_3x3() @ Vector((item.shift[0] * cam.data.ortho_scale, item.shift[1] * cam.data.ortho_scale, 0.0))
        bpy.context.view_layer.update()
    kit.studio(cam, span=2.2, target=tuple(cam.location - (cam.matrix_world.to_3x3() @ Vector((0, 0, 1))) * 20.0), key=item.key, fill=item.fill, rim=item.rim)
    kit.outline((line or item.line) * size / (SIZE * 3), exclude=item.no_line, plain=item.plain)
    return kit.render(path)

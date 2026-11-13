# Shared by the darkroom (the build wait, src/screens/develop/Darkroom.tsx): the bench with its
# enamel tray under a red safelight (darkroom_set.py) and the things on the drying line
# (darkroom_parts.py). The app lays the scene out in points on a 358 x 440 stage, so the scripts
# work in points too:
#
#   the bench picture is PIC_W x PIC_H points, shot from ELEV degrees above, straight on (no turn:
#   a sheet lying flat in the tray is then a plain rectangle, squashed by SQUASH top to bottom, and
#   the app can lay the player's photo into it with one transform);
#   PT points to a Blender unit; the tray stands at the origin on the bench top (z = 0).
import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import bpy  # noqa: E402
import bmesh  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

import export  # noqa: E402
import kit  # noqa: E402
import materials as M  # noqa: E402
from reveal_common import anchor, mesh_object, ship, tube  # noqa: E402

SAMPLES = int(os.environ.get("SAMPLES", 96))
SS = int(os.environ.get("SS", 2))   # SS=1 SAMPLES=32 for a quick draft
PX = int(os.environ.get("PX", 3))   # pixels a point: 3 for the files in assets/, PX=1 for a quick look

PT = 120.0                 # points per unit on the bench
ELEV = 52.0                # the camera's height over the bench
SQUASH = math.sin(math.radians(ELEV))
PIC_W, PIC_H = 440, 320    # the bench picture (wider than the stage: the app centres it and the frame crops it)
EDGE_Y = 60.0              # the bench's back edge, points from the picture's top
TRAY_Y = 195.0             # the tray's middle (on the bench top), points from the picture's top

# The camera looks at (0, TARGET_Y, 0); the bench's back edge is at y = BENCH_BACK.
TARGET_Y = (TRAY_Y - PIC_H / 2) / PT / SQUASH
BENCH_BACK = TARGET_Y + (PIC_H / 2 - EDGE_Y) / PT / SQUASH

# The tray: its inner floor's half width and depth, corner radius, and the liquid's level.
TRAY = dict(hw=1.08, hd=0.70, r=0.16, level=0.118, level_out=0.088)
# A sheet of photo paper in the tray, in units (the app shows it PT times this, squashed): 3 : 4 picture, a border all round.
SHEET_W, BORDER = 1.0, 0.06
SHEET_H = (SHEET_W - 2 * BORDER) * 4 / 3 + 2 * BORDER

# The safelight's red, and the amber its hot middle goes to (linear).
SAFE = (1.0, 0.11, 0.04)
SAFE_KEY = (1.0, 0.20, 0.09)


SCALES = tuple(k for k in (1, 2, 3) if k <= PX)


def srgb(hex_):
    """A token's hex colour as linear RGB."""
    h = hex_.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


def scene(w_pt, h_pt, samples=SAMPLES):
    kit.reset()
    kit.setup(size=(round(w_pt * PX), round(h_pt * PX)), ss=SS, samples=samples)


def bench_camera():
    """The bench picture's camera: PIC_W x PIC_H points at PT points a unit."""
    return kit.camera("front", target=(0.0, TARGET_Y, 0.0), span=max(PIC_W, PIC_H) / PT, elev=ELEV)


def rrect(hw, hd, r, corner=8, straight=10):
    """A rounded rectangle's outline, anticlockwise from the right side's middle, evenly dense along its straights."""
    r = max(1e-4, min(r, hw - 1e-4, hd - 1e-4))
    pts = []
    corners = ((hw - r, hd - r, 0), (-(hw - r), hd - r, 90), (-(hw - r), -(hd - r), 180), (hw - r, -(hd - r), 270))
    for k, (cx, cy, a0) in enumerate(corners):
        arc = [(cx + r * math.cos(math.radians(a0 + 90 * i / corner)), cy + r * math.sin(math.radians(a0 + 90 * i / corner))) for i in range(corner + 1)]
        pts.extend(arc)
        nx, ny, na = corners[(k + 1) % 4]
        nxt = (nx + r * math.cos(math.radians(na)), ny + r * math.sin(math.radians(na)))
        for i in range(1, straight):
            t = i / straight
            pts.append((arc[-1][0] + (nxt[0] - arc[-1][0]) * t, arc[-1][1] + (nxt[1] - arc[-1][1]) * t))
    return pts


def loft(profile, hw, hd, r, name="loft", cap_first=True, cap_last=True, materials=None, split=None):
    """A rounded-rectangular dish: `profile` is [(out, z), ...] where `out` is how far outside the
    hw x hd outline that ring sits. materials=(a, b) with split=(i0, i1): the bands between
    profile points i0..i1 take b (a tray's coloured rim)."""
    rings = [rrect(hw + o, hd + o, r + o) for o, _ in profile]
    n = len(rings[0])
    verts = [(x, y, z) for ring, (_, z) in zip(rings, profile) for x, y in ring]
    faces = []
    for i in range(len(profile) - 1):
        for j in range(n):
            j2 = (j + 1) % n
            faces.append((i * n + j, i * n + j2, (i + 1) * n + j2, (i + 1) * n + j))
    bands = len(faces)
    if cap_first:
        faces.append(tuple(range(n)))
    if cap_last:
        faces.append(tuple(range((len(profile) - 1) * n, len(profile) * n)))
    ob = mesh_object(name, verts, faces, sharp=40.0)
    if materials:
        for m in materials:
            ob.data.materials.append(m)
        if split:
            for f in ob.data.polygons:
                if f.index < bands and split[0] <= f.index // n < split[1]:
                    f.material_index = 1
    return ob


def camera_only(objects, shown):
    """Only `shown` are seen by the camera; the rest still light and shadow the scene."""
    for ob in objects:
        ob.visible_camera = ob in shown


__all__ = ["bpy", "bmesh", "Matrix", "Vector", "export", "kit", "M", "math", "os", "sys", "SAMPLES", "SS", "PX", "SCALES", "PT", "ELEV", "SQUASH", "PIC_W", "PIC_H",
           "EDGE_Y", "TRAY_Y", "TARGET_Y", "BENCH_BACK", "TRAY", "SHEET_W", "SHEET_H", "BORDER", "SAFE", "SAFE_KEY", "srgb", "scene", "bench_camera",
           "rrect", "loft", "camera_only", "anchor", "mesh_object", "ship", "tube"]

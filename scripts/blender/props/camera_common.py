# Shared by the camera's chrome (props/camera_*.py -> assets/capture; the capture screen,
# src/capture/ui/Rangefinder.tsx): a leather-and-brass camera back whose fittings sit round the
# live preview. Each fitting is modelled in the app's own points on a mech_common.Stage (framed
# exactly, straight on), so a picture drops onto its control 1:1; the sizes they share with the
# app live in src/capture/ui/look.ts (CHROME).
#   sweep(st, x, y, w, h, r, profile)   a moulded frame round a rounded rectangle: the profile
#                                       [(out, proud), ...] in points, swept round the opening
#   clear(im, st, x, y, w, h, r)        wipe the picture inside an opening (nothing of a frame, its
#                                       line or its shadow may lie over the live preview)
#   shoot(st, name, post)               render, post-process, export at x1 / x2 / x3
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mech_common as mc  # noqa: E402
from gadget_common import M, Stage, bakelite, brass, circle, kit, rounded_rect, totals, wanted  # noqa: E402,F401
import bpy  # noqa: E402
import bmesh  # noqa: E402
import numpy as np  # noqa: E402
from PIL import Image, ImageDraw, ImageFilter  # noqa: E402

import export  # noqa: E402

mc.OUT = "assets/capture"
mc.SAMPLES = int(os.environ.get("SAMPLES", 72))

INKY = (0.020, 0.013, 0.022)


def enamel(name="enamel", **kw):
    """The camera's black paint: plum-black lacquer with a soft polish, brass showing at its edges."""
    return M.enamel(name, INKY, **{"gloss": 0.6, "chips": 0.5, **kw})


def sweep(st, x, y, w, h, r, profile, name="frame", corner=14, bevel=0.0):
    """A moulding round the rounded rectangle (x, y, w, h, r): `profile` is its section,
    [(out, proud), ...] in points from the opening's edge outward."""
    loops = [rounded_rect(x - o, y - o, w + 2 * o, h + 2 * o, r + o, corner) for o, _ in profile]
    n = len(loops[0])
    bm = bmesh.new()
    rows = [[bm.verts.new(st.at(px, py, d)) for px, py in loop] for loop, (_, d) in zip(loops, profile)]
    for a, b in zip(rows, rows[1:]):
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((a[i], a[j], b[j], b[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    # The faces must look at the camera (-Y) on the flats.
    if sum(p.normal.y for p in ob.data.polygons) > 0:
        ob.data.flip_normals()
    if bevel:
        kit.bevel(ob, bevel / st.u, 2, angle=40)
    kit.shade(ob, 38)
    return ob


def mask(st, im, x, y, w, h, r=0.0):
    """An antialiased mask (0..1) of a rounded rectangle given in points, at the picture's size."""
    k = im.width / st.w
    big = 4
    m = Image.new("L", (im.width * big, im.height * big), 0)
    ImageDraw.Draw(m).rounded_rectangle([x * k * big, y * k * big, (x + w) * k * big, (y + h) * k * big], radius=r * k * big, fill=255)
    return np.asarray(m.resize(im.size, Image.LANCZOS)).astype(np.float32) / 255.0


def clear(st, im, x, y, w, h, r=0.0):
    """The picture with everything inside the opening wiped to clear."""
    a = np.asarray(im).astype(np.float32)
    a[..., 3] *= 1.0 - mask(st, im, x, y, w, h, r)
    return Image.fromarray(a.clip(0, 255).astype(np.uint8), "RGBA")


def shoot(st, name, post=None, crop=None, scales=(1, 2, 3), loose=None):
    """Render the stage and export it to assets/capture, keeping the app's box; `post(im)` first."""
    src = mc.scratch(name)
    kit.render(src)
    im = export.load(src)
    if post:
        im = post(im)
    size = (st.w, st.h)
    if crop:
        k = im.width / st.w
        cx, cy, cw, ch = crop
        im = im.crop((round(cx * k), round(cy * k), round((cx + cw) * k), round((cy + ch) * k)))
        size = (cw, ch)
    return mc.save(im, name, size, scales, loose)

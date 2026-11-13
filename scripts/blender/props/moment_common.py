# The bookend moments (src/play2/Brief.tsx's arrival, src/play2/Ending.tsx's
# moment): what the four prop scripts moment_open.py, moment_noir.py,
# moment_crime.py and moment_moon.py share. Colours are the letters' own
# (src/theme/payoff.ts LETTER), linear here.
#
#   PREVIEW=1 <bpy python> scripts/blender/props/moment_*.py   # half size, few samples, no export: a contact sheet in $ESCAPD_RENDER_DIR
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import items_common as I  # noqa: E402  (puts scripts/blender on the path)
import bpy  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

import export  # noqa: E402
import kit  # noqa: E402
import materials as M  # noqa: E402

PREVIEW = bool(os.environ.get("PREVIEW"))
OUT = "assets/moments"
ELEV = 64.0          # things lying on the desk are seen from here: nearly flat, but a lifted flap still reads


def srgb(hex_, k=1.0):
    """A hex colour from the app's tokens, linear (times k: paper under the key light bleaches, so it is taken down a little)."""
    n = int(hex_.lstrip("#"), 16)
    return tuple(k * (((c / 255 + 0.055) / 1.055) ** 2.4 if c / 255 > 0.04045 else c / 255 / 12.92) for c in ((n >> 16) & 255, (n >> 8) & 255, n & 255))


def setup(px, samples=40, ss=1, **kw):
    """Render settings for a picture `px` (w, h) pixels as exported; a preview is half that."""
    kit.reset()
    if PREVIEW:
        px, samples, ss = (px[0] // 2, px[1] // 2), 10, 1
    kit.setup(size=px, ss=ss, samples=samples, **kw)


def line(weight, **kw):
    """The ink line, `weight` px in the exported picture (kit.outline counts in px before supersampling)."""
    kit.outline(weight * (0.5 if PREVIEW else 1.0), **kw)


def scratch(name):
    d = export.scratch("moments")
    os.makedirs(d, exist_ok=True)
    return os.path.join(d, name)


def hide_from_camera(objects):
    for ob in objects:
        ob.visible_camera = False


def move(objects, matrix):
    for ob in objects:
        ob.matrix_world = matrix @ ob.matrix_world


def bezier(p0, p1, p2, p3, n=8):
    return [tuple((1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t ** 2 * c + t ** 3 * d for a, b, c, d in zip(p0, p1, p2, p3)) for t in [i / n for i in range(n)]]


def path(start, curves, n=8):
    """A closed outline from an SVG-like run of cubic curves: start, then [(c1, c2, end), ...]."""
    pts, at = [], start
    for c1, c2, end in curves:
        pts += bezier(at, c1, c2, end, n)
        at = end
    return pts


def small(im, dest, max_kb=600):
    """A big picture of paper as a palette PNG. The exporter keeps full colour wherever a palette would be
    off by more than a hair, which fibrous paper always is (and it then weighs megabytes); an envelope is a
    few dozen creams, so a palette without dither is indistinguishable and a fifth of the size."""
    import io
    import subprocess
    path = dest if os.path.isabs(dest) else os.path.join(export.REPO, dest)
    buf = io.BytesIO()
    im.save(buf, "PNG")
    data, how = buf.getvalue(), "rgba"
    exe = export._pngquant()
    if exe:
        p = subprocess.run([exe, "--nofs", "--posterize", "2", "--quality", "45-98", "--speed", "1", "--strip", "-"], input=data, capture_output=True)
        if p.returncode == 0 and p.stdout:
            data, how = p.stdout, "pngquant"
    try:
        import oxipng
        data = oxipng.optimize_from_memory(data, level=6, strip=oxipng.StripChunks.safe())
    except Exception:
        pass
    with open(path, "wb") as f:
        f.write(data)
    kb = len(data) / 1024
    print(f"  {os.path.relpath(path, export.REPO)}  {im.width}x{im.height}  {kb:.1f} KB  ({how})" + ("  ** over budget **" if kb > max_kb else ""))
    return len(data)


def export_fit(src, dest, sizes, max_kb=150, **kw):
    """export.export, then any size of it that came out over budget written again through a palette (dithered:
    brass and wax have gradients). Returns the bytes written."""
    import io
    import subprocess
    export.export(src, dest, sizes=sizes, max_kb=10 ** 6, **kw)
    base, ext = os.path.splitext(os.path.join(export.REPO, dest))
    total = 0
    for k in kw.get("scales", (1, 2, 3)):
        path = base + ("" if k == 1 else f"@{k}x") + ext
        if not os.path.exists(path):
            continue
        if os.path.getsize(path) > max_kb * 1024 and export._pngquant():
            p = subprocess.run([export._pngquant(), "--quality", "55-96", "--speed", "1", "--strip", "-"], input=open(path, "rb").read(), capture_output=True)
            if p.returncode == 0 and p.stdout:
                data = p.stdout
                try:
                    import oxipng
                    data = oxipng.optimize_from_memory(data, level=6, strip=oxipng.StripChunks.safe())
                except Exception:
                    pass
                open(path, "wb").write(data)
                print(f"  {os.path.relpath(path, export.REPO)}  again through a palette: {len(data) / 1024:.1f} KB" + ("  ** over budget **" if len(data) > max_kb * 1024 else ""))
        total += os.path.getsize(path)
    return total


def strip(frames, dest, columns, max_kb=600):
    """Whole frames (no trimming: the app places them by the canvas) on a grid, left to right, top to bottom."""
    ims = [export.load(f) if isinstance(f, str) else f for f in frames]
    w, h = ims[0].size
    rows = math.ceil(len(ims) / columns)
    sheet = export.Image.new("RGBA", (w * columns, h * rows), (0, 0, 0, 0))
    for i, im in enumerate(ims):
        sheet.paste(im, ((i % columns) * w, (i // columns) * h))
    n = small(sheet, dest, max_kb=max_kb)
    print(f"  sheet {dest}: {len(ims)} frames of {w}x{h} px, {columns} columns, {rows} rows")
    return n


def contact(frames, name, ground=(0x18, 0x12, 0x1D)):
    """A preview: the frames in a row on the mode's ground."""
    ims = [export.load(f) if isinstance(f, str) else f for f in frames]
    w, h = ims[0].size
    out = export.Image.new("RGBA", (w * len(ims), h), tuple(ground) + (255,))
    for i, im in enumerate(ims):
        out.alpha_composite(im.convert("RGBA"), (i * w, 0))
    p = scratch(name)
    out.convert("RGB").save(p)
    print("preview", p)
    return p

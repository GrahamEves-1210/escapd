# From a render to a file the app ships: trim -> scale to the app's sizes ->
# quantise / optimise -> write under assets/. Also contact sheets (a render on the
# game's dark and light grounds) so every asset is looked at before it goes in.
#
#   export.export(render_png, "assets/brand/flashlight.png", sizes=(88, 88), canvas=True)
#     -> flashlight.png (88), flashlight@2x.png (176), flashlight@3x.png (264)
#   export.sheet([("flashlight", path), ...], "sheet.png")
#
# Needs Pillow; uses pngquant (pip: pngquant-cli) and oxipng (pip: pyoxipng) when
# they're there, Pillow otherwise. Runs in the bpy Python or any other.
import io
import os
import shutil
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
# The grounds assets are judged on: each mode's ground, the shell, and the paper.
GROUNDS = {
    "noir": (0x18, 0x12, 0x1D), "crime": (0x1C, 0x0F, 0x12), "moonlit": (0x10, 0x12, 0x2A),
    "shelf": (0x13, 0x0D, 0x18), "paper": (0xEF, 0xE4, 0xD0), "walnut": (0x4A, 0x2C, 0x1C),
}


def scratch(*parts):
    """Where raw renders go (never the repo): $ESCAPD_RENDER_DIR or the system temp dir."""
    import tempfile
    d = os.path.join(os.environ.get("ESCAPD_RENDER_DIR") or os.path.join(tempfile.gettempdir(), "escapd-renders"), *parts)
    os.makedirs(os.path.dirname(d) if os.path.splitext(d)[1] else d, exist_ok=True)
    return d


# ---------------------------------------------------------------- pixels


def load(path):
    return Image.open(path).convert("RGBA")


def _premult(im):
    a = np.asarray(im, dtype=np.float32) / 255.0
    a[..., :3] *= a[..., 3:4]
    return a


def _unpremult(a):
    out = a.copy()
    al = np.clip(out[..., 3:4], 1e-6, 1)
    out[..., :3] = np.where(out[..., 3:4] > 1e-4, out[..., :3] / al, 0)
    return Image.fromarray((np.clip(out, 0, 1) * 255 + 0.5).astype(np.uint8), "RGBA")


def resize(im, size):
    """Scale with premultiplied alpha (no dark or light fringes on edges), Lanczos."""
    if im.size == tuple(size):
        return im
    a = _premult(im)
    chans = [Image.fromarray(a[..., i], "F").resize(size, Image.LANCZOS) for i in range(4)]
    return _unpremult(np.stack([np.asarray(c) for c in chans], axis=-1))


def bounds(im, threshold=6):
    """The box holding everything more opaque than `threshold` (0..255)."""
    return im.getchannel("A").point(lambda v: 255 if v > threshold else 0).getbbox()


def trim(im, pad=0, threshold=6):
    """Crop to the picture (plus `pad` pixels)."""
    box = bounds(im, threshold)
    if not box:
        return im
    l, t, r, b = box
    return im.crop((max(0, l - pad), max(0, t - pad), min(im.width, r + pad), min(im.height, b + pad)))


def lift_glass(png_path, exr_path=None):
    """Keep glass highlights on transparent film. A reflection on see-through glass is
    light *added* over whatever is behind (bright colour, almost no alpha); a PNG's
    straight alpha can't hold that and the highlight all but vanishes. This reads the
    linear, premultiplied render (kit.render(exr=True)) and raises alpha wherever the
    added light is brighter than the alpha allows, so the highlight survives, and
    returns the corrected image."""
    import bpy
    im = load(png_path)
    img = bpy.data.images.load(exr_path or png_path + ".exr")
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    bpy.data.images.remove(img)
    lin = px.reshape(h, w, 4)[::-1]
    # Premultiplied light brighter than its alpha is light added on top: the smallest alpha
    # that can carry it is the light's own (linear) peak.
    peak = np.clip(lin[..., :3].max(axis=-1), 0, 1)
    a = np.asarray(im).copy()
    alpha = a[..., 3].astype(np.float32) / 255.0
    lifted = np.maximum(alpha, peak)
    a[..., 3] = (lifted * 255 + 0.5).astype(np.uint8)
    # Where the PNG had no alpha at all its colour is black: give those pixels the light's colour.
    bare = (alpha < 1 / 255) & (lifted >= 1 / 255)
    if bare.any():
        col = lin[..., :3] / np.maximum(lifted[..., None], 1e-6)
        col = np.clip(col, 0, 1)
        col = np.where(col <= 0.0031308, col * 12.92, 1.055 * np.power(col, 1 / 2.4) - 0.055)
        a[..., :3][bare] = (col[bare] * 255 + 0.5).astype(np.uint8)
    return Image.fromarray(a, "RGBA")


def bloom(im, radius=0.03, strength=0.7, threshold=0.8, within=None, inside=0.7):
    """The soft halo round something lit (a lens, a flame, a lamp): Cycles has no bloom of
    its own. Pixels brighter than `threshold` (0..1) are blurred by `radius` (a fraction
    of the picture's width) and screened back over the picture, alpha included, so the
    glow spills past the object's edge onto whatever is behind. within=(x, y, r), all
    fractions of the width, limits what may glow to a circle (so brass glints elsewhere
    don't). inside (0..1) is how much the glow is held back over the object itself.
    Do it on the full-size render, before export scales it down."""
    from PIL import ImageFilter
    a = _premult(im)
    luma = a[..., :3].max(axis=-1)
    src = a[..., :3] * np.clip((luma - threshold) / max(1e-6, 1 - threshold), 0, 1)[..., None]
    if within:
        yy, xx = np.mgrid[0:im.height, 0:im.width]
        d = np.hypot(xx - within[0] * im.width, yy - within[1] * im.width) / (within[2] * im.width)
        src *= np.clip(1.5 - d * 1.5, 0, 1)[..., None] ** 0.5
    r = radius * im.width
    glow = np.zeros_like(src)
    for k, w in ((1.0, 0.6), (2.6, 0.4)):  # a tight core and a wide skirt
        for c in range(3):
            ch = Image.fromarray((np.clip(src[..., c], 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r * k))
            glow[..., c] += w * np.asarray(ch, dtype=np.float32) / 255.0
    # Mostly a spill past the edge: over the object itself the glow is held back, so the lit
    # thing keeps its own drawing (a reflector's bowl, a flame's core) and its ink line.
    glow = np.clip(glow * strength * 2.2, 0, 1) * (1 - inside * a[..., 3:4])
    out = a.copy()
    out[..., :3] = 1 - (1 - a[..., :3]) * (1 - glow)
    out[..., 3] = np.maximum(a[..., 3], glow.max(axis=-1))
    return _unpremult(out)


# ---------------------------------------------------------------- files


def _pngquant():
    exe = shutil.which("pngquant") or os.path.join(os.path.dirname(sys.executable), "pngquant")
    return exe if os.path.exists(exe) else None


def _error(a, b):
    """How far a quantised image is from the original: worst error of a lightly blurred
    difference (banding shows up as broad steps, dither noise doesn't), 0..255, premultiplied."""
    from PIL import ImageFilter
    pa, pb = _premult(a), _premult(b.convert("RGBA"))
    d = np.abs(pa - pb).max(axis=-1)
    blur = Image.fromarray((d * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2))
    return float(np.asarray(blur).max())


def encode(im, quantise=True, max_error=7.0):
    """PNG bytes, as small as they go without visible banding: tries a 256-colour palette
    (pngquant, else Pillow's), keeps it only if it's faithful, then oxipng. Returns (bytes, how)."""
    buf = io.BytesIO()
    im.save(buf, "PNG", optimize=True)
    best, how = buf.getvalue(), "rgba"
    if quantise:
        cand = None
        exe = _pngquant()
        if exe:
            p = subprocess.run([exe, "--quality", "75-98", "--speed", "1", "--strip", "-"], input=best, capture_output=True)
            if p.returncode == 0 and p.stdout:
                cand, tag = p.stdout, "pngquant"
        if cand is None:
            q = im.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.FLOYDSTEINBERG)
            b2 = io.BytesIO()
            q.save(b2, "PNG", optimize=True)
            cand, tag = b2.getvalue(), "pillow-quant"
        if len(cand) < len(best) and _error(im, Image.open(io.BytesIO(cand))) <= max_error:
            best, how = cand, tag
    try:
        import oxipng
        small = oxipng.optimize_from_memory(best, level=6, strip=oxipng.StripChunks.safe())
        if len(small) < len(best):
            best, how = small, how + "+oxipng"
    except Exception:
        pass
    return best, how


def write(im, path, quantise=True, max_kb=150):
    data, how = encode(im, quantise)
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with open(path, "wb") as f:
        f.write(data)
    kb = len(data) / 1024
    flag = "  ** over budget **" if kb > max_kb else ""
    print(f"  {os.path.relpath(path, REPO)}  {im.width}x{im.height}  {kb:.1f} KB  ({how}){flag}")
    return len(data)


def export(src, dest, sizes, scales=(1, 2, 3), canvas=False, pad=0, quantise=True, max_kb=150):
    """Write a render into the app at the sizes it's shown.

    src: a render (path or Image), at least as big as the @3x size.
    dest: path under the repo for the @1x file ("assets/brand/thing.png"); @2x / @3x
      are written beside it (React Native picks the right one). scales=(3,) with a
      dest that has no suffix convention writes just one file at 3x.
    sizes: (w, h) in points, the size the app shows it at (@3x = that x3, never bigger).
    canvas: False = trim to the picture, then fit inside sizes keeping its shape (the
      written size is smaller than `sizes` on one side); True = keep the render's
      framing exactly (for things positioned by fractions of their box: a pivot, a lens)."""
    im = load(src) if isinstance(src, str) else src
    if not os.path.isabs(dest):
        dest = os.path.join(REPO, dest)
    if not canvas:
        im = trim(im, pad)
    total = 0
    base, ext = os.path.splitext(dest)
    for k in scales:
        bw, bh = sizes[0] * k, sizes[1] * k
        if canvas:
            w, h = bw, bh
        else:
            f = min(bw / im.width, bh / im.height)
            w, h = max(1, round(im.width * f)), max(1, round(im.height * f))
        out = resize(im, (w, h))
        name = dest if (k == 1 or len(scales) == 1) else f"{base}@{k}x{ext}"
        total += write(out, name, quantise, max_kb)
    return total


def sprite_sheet(frames, dest, size, columns=None, scale=3, quantise=True, max_kb=600):
    """Frames of an animation (paths or Images, all rendered with the same framing) as one
    sheet, left to right, top to bottom, for the game's 12 fps stop-motion. Every frame is
    cropped to the box that holds the whole animation, scaled to fit `size` points x `scale`,
    and laid on a grid. Returns {"frame": (w, h) px, "columns", "rows", "count", "bytes"}:
    put those numbers beside the require() in the app."""
    ims = [load(f) if isinstance(f, str) else f for f in frames]
    boxes = [b for b in (bounds(im) for im in ims) if b]
    box = (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))
    ims = [im.crop(box) for im in ims]
    f = min(size[0] * scale / ims[0].width, size[1] * scale / ims[0].height)
    w, h = max(1, round(ims[0].width * f)), max(1, round(ims[0].height * f))
    columns = columns or int(np.ceil(np.sqrt(len(ims))))
    rows = int(np.ceil(len(ims) / columns))
    out = Image.new("RGBA", (w * columns, h * rows), (0, 0, 0, 0))
    for i, im in enumerate(ims):
        out.paste(resize(im, (w, h)), ((i % columns) * w, (i // columns) * h))
    if not os.path.isabs(dest):
        dest = os.path.join(REPO, dest)
    n = write(out, dest, quantise, max_kb)
    return {"frame": (w, h), "columns": columns, "rows": rows, "count": len(ims), "bytes": n}


# ---------------------------------------------------------------- sheets


def _font(size):
    for p in ("node_modules/@expo-google-fonts/plus-jakarta-sans/600SemiBold/PlusJakartaSans_600SemiBold.ttf",
              "node_modules/@expo-google-fonts/plus-jakarta-sans/PlusJakartaSans_600SemiBold.ttf"):
        f = os.path.join(REPO, p)
        if os.path.exists(f):
            return ImageFont.truetype(f, size)
    return ImageFont.load_default()


def on(im, ground, size=None, pad=12):
    """An image composited on a ground colour (a name from GROUNDS or an RGB), centred in a cell."""
    col = GROUNDS.get(ground, ground) if isinstance(ground, str) else ground
    w, h = size or (im.width + pad * 2, im.height + pad * 2)
    cell = Image.new("RGBA", (w, h), tuple(col) + (255,))
    cell.alpha_composite(im, ((w - im.width) // 2, (h - im.height) // 2))
    return cell


def sheet(items, path, grounds=("noir", "moonlit", "paper"), height=264, also_actual=88, title=None):
    """A contact sheet: each item (label, path or Image) in a column, once per ground at
    `height` px tall, then at `also_actual` px (the size on a phone at 1x) to check
    the silhouette still reads. Returns the path."""
    ims = [(label, load(p) if isinstance(p, str) else p) for label, p in items]
    font, small = _font(15), _font(12)
    cells = []
    for label, im in ims:
        f = height / im.height
        cells.append((label, resize(im, (max(1, round(im.width * f)), height)),
                      resize(im, (max(1, round(im.width * also_actual / im.height)), also_actual)) if also_actual else None))
    gap, top = 14, 34 + (22 if title else 0)
    colw = [max(c[1].width, 120) + gap * 2 for c in cells]
    rowh = height + gap * 2
    act = (also_actual + gap * 2) if also_actual else 0
    W = sum(colw) + gap
    H = top + len(grounds) * rowh + act + gap
    out = Image.new("RGBA", (W, H), (0x0D, 0x09, 0x10, 255))
    d = ImageDraw.Draw(out)
    if title:
        d.text((gap, 8), title, font=font, fill=(0xF2, 0xE6, 0xD6, 255))
    x = gap
    for (label, big, tiny), cw in zip(cells, colw):
        d.text((x + 4, top - 22), label, font=small, fill=(0xD9, 0xB2, 0x6A, 255))
        for gi, g in enumerate(grounds):
            out.alpha_composite(on(big, g, (cw - gap, rowh - 6)), (x, top + gi * rowh))
        if tiny is not None:
            y = top + len(grounds) * rowh
            half = (cw - gap) // 2
            out.alpha_composite(on(tiny, grounds[0], (half, act - 6)), (x, y))
            out.alpha_composite(on(tiny, grounds[-1], (cw - gap - half, act - 6)), (x + half, y))
        x += cw
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    out.convert("RGB").save(path)
    return path


def side_by_side(items, path, height=None, gap=10, ground=(0x0D, 0x09, 0x10), labels=True):
    """Pictures in a row with labels (before / after screenshots, look comparisons)."""
    ims = [(label, load(p) if isinstance(p, str) else p) for label, p in items]
    height = height or max(im.height for _, im in ims)
    ims = [(label, im if im.height == height else resize(im, (round(im.width * height / im.height), height))) for label, im in ims]
    font = _font(14)
    top = 28 if labels else gap
    W = sum(im.width for _, im in ims) + gap * (len(ims) + 1)
    out = Image.new("RGBA", (W, height + top + gap), tuple(ground) + (255,))
    d = ImageDraw.Draw(out)
    x = gap
    for label, im in ims:
        out.alpha_composite(im, (x, top))
        if labels:
            d.text((x + 2, 6), label, font=font, fill=(0xD9, 0xB2, 0x6A, 255))
        x += im.width + gap
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    out.convert("RGB").save(path)
    return path

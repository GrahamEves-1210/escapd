# Home's set (docs/ART_DIRECTION.md, "velvet & ink"): her reading nook's window
# on a rainy night, as depth layers the app slides against each other when the
# phone tilts (src/screens/hub/WindowBackdrop.tsx, src/screens/hub/parallax).
#
# The set is built and rendered in Blender (scripts/blender/props/home_set.py:
# the far and near pines, the window's frame, the sill and its still life, the
# curtains; one camera, one lighting). This script finishes it:
# - paints the set's backcloth to the same camera's framing: a midnight-indigo
#   sky going plum toward a dusky mauve horizon under a low, rainy overcast, a
#   full moon low on the right veiled by thin cloud, a few stars in the gaps;
# - paints the wet glass: beads and runs of rain (lavender, catching the room's
#   warm light on their lower rims), the frame's shadow at each pane's top and
#   left, a faint sheen across it, the candle's flame mirrored in it;
# - softens what is far away or very near (seen through wet glass; out of focus);
# - trims each layer, writes it under assets/home/set/ (the sky a JPEG, the
#   soft layers at half size, the rest palette PNGs where that doesn't band),
#   and writes set.json: where each layer lies on the art, the moon, the flame.
#
# Every layer has `bleed` pixels of picture beyond the art (1290 x 2796) on all
# sides, so it can slide without showing an edge.
#
# Usage: <python with numpy, Pillow> scripts/brand/window.py <dir of rendered layers>
#   (home_set.py runs it; needs that dir's far.png, near.png, frame.png, sill.png,
#   fore-left.png, fore-right.png and set_raw.json)
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.insert(0, os.path.join(REPO, "scripts", "blender"))
import export  # noqa: E402

src = sys.argv[1]
raw = json.load(open(os.path.join(src, "set_raw.json")))
W, H = raw["canvas"]["art"]
B = raw["canvas"]["bleed"]
CW, CH = W + 2 * B, H + 2 * B
rng = np.random.default_rng(11)
F = 64            # frame on the sides and top (art px), as home_set.py
SILL = 150        # the sill at the foot
M = 46            # mullion width
MY = H // 2       # the cross's height
# The moon behind the lower right pane (art px): centre and radius.
MOON = (868, 2254, 84)
FLAME = raw["anchors"]["flame"]
DEST = os.path.join(REPO, "assets", "home", "set")
os.makedirs(DEST, exist_ok=True)

# Canvas coordinates: art px + B.
yy, xx = np.mgrid[0:CH, 0:CW].astype(np.float32)
v = (yy - B) / H


def ramp(t, stops):
    """Colour at t (an array) through (offset, rgb) stops."""
    out = np.zeros(t.shape + (3,), np.float32)
    offs = [s[0] for s in stops]
    cols = [np.array(s[1], np.float32) for s in stops]
    out[:] = cols[0]
    for i in range(len(stops) - 1):
        a, b = offs[i], offs[i + 1]
        k = np.clip((t - a) / (b - a), 0, 1)[..., None]
        sel = (t >= a)[..., None]
        out = np.where(sel, cols[i] + (cols[i + 1] - cols[i]) * k, out)
    return out


def noise(scale):
    small = rng.random((CH // scale + 2, CW // scale + 2))
    return np.array(Image.fromarray((small * 255).astype(np.uint8)).resize((CW, CH), Image.BICUBIC)).astype(np.float32) / 255.0


def soft_disc(cx, cy, r, power=2.0):
    d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) / r
    return np.clip(1 - d, 0, 1) ** power


def clear():
    return Image.new("RGBA", (CW, CH), (0, 0, 0, 0))


# ---------------------------------------------------------------- the sky

sky = ramp(v, [
    (0.0, (14, 13, 38)),
    (0.35, (26, 19, 52)),
    (0.62, (44, 26, 66)),
    (0.80, (78, 46, 92)),
    (0.90, (112, 68, 112)),
    (1.0, (124, 80, 118)),
])
# A low, rainy overcast: soft cloud everywhere, thicker in long drifting bands.
clouds = np.clip((0.55 * noise(300) + 0.3 * noise(120) + 0.15 * noise(40) - 0.36) * 1.7, 0, 1)
sky += clouds[..., None] * np.array([40, 28, 54], np.float32) * (0.45 + 0.55 * np.clip(v, 0, 1)[..., None])
mx, my, mr = MOON[0] + B, MOON[1] + B, MOON[2]
# The moon's light through the cloud: a wide, soft corona, lighting the cloud round it most.
halo = soft_disc(mx, my, mr * 6.5, 1.8)
sky += halo[..., None] * np.array([46, 38, 70], np.float32) * (0.6 + 0.8 * clouds[..., None])
img = Image.fromarray(np.clip(sky, 0, 255).astype(np.uint8)).convert("RGBA")

# The moon: a soft full moon, faint maria, a bright rim.
moon = clear()
ImageDraw.Draw(moon).ellipse([mx - mr, my - mr, mx + mr, my + mr], fill=(236, 224, 222, 230))
marks = Image.new("L", (CW, CH), 0)
mk = ImageDraw.Draw(marks)
for (ox, oy, rr) in [(-30, -24, 34), (22, 10, 26), (-8, 38, 20), (40, -36, 14), (-46, 22, 12)]:
    mk.ellipse([mx + ox - rr, my + oy - rr, mx + ox + rr, my + oy + rr], fill=60)
marks = marks.filter(ImageFilter.GaussianBlur(9))
shade = Image.new("RGBA", (CW, CH), (196, 170, 196, 0))
shade.putalpha(marks)
moon = Image.alpha_composite(moon, Image.composite(shade, clear(), moon.getchannel("A")))
glow = moon.filter(ImageFilter.GaussianBlur(22))
glow.putalpha(glow.getchannel("A").point(lambda a: int(a * 0.6)))
img = Image.alpha_composite(img, glow)
img = Image.alpha_composite(img, moon.filter(ImageFilter.GaussianBlur(2.5)))
# The veil: thin cloud across the moon's face, lit silver where it crosses it, plum away from it.
veil = clear()
vd = ImageDraw.Draw(veil)
for (ox, oy, rx, ry, a) in [(-60, 52, 300, 44, 225), (90, 30, 220, 26, 170), (-30, -34, 230, 14, 150), (150, -58, 150, 10, 110),
                            (-280, 70, 220, 26, 120), (260, 6, 200, 16, 100)]:
    vd.ellipse([mx + ox - rx, my + oy - ry, mx + ox + rx, my + oy + ry], fill=(128, 100, 146, a))
veil = veil.filter(ImageFilter.GaussianBlur(14))
lit_veil = clear()
ImageDraw.Draw(lit_veil).ellipse([mx - mr * 1.6, my - mr * 1.6, mx + mr * 1.6, my + mr * 1.6], fill=(255, 255, 255, 255))
lit_veil = lit_veil.filter(ImageFilter.GaussianBlur(40)).getchannel("A")
va = np.asarray(veil).astype(np.float32)
k = (np.asarray(lit_veil).astype(np.float32) / 255.0)[..., None]
va[..., :3] = va[..., :3] * (1 - k) + np.array([206, 190, 220], np.float32) * k
img = Image.alpha_composite(img, Image.fromarray(np.clip(va, 0, 255).astype(np.uint8), "RGBA"))
img = img.filter(ImageFilter.GaussianBlur(6))   # seen through wet glass
# A few stars, only high up and only in the gaps of the cloud (it's a rainy night): tiny, dim.
stars = clear()
sd = ImageDraw.Draw(stars)
for _ in range(140):
    x, y = float(rng.uniform(0, CW)), float(rng.uniform(0, CH * 0.8))
    if rng.random() < 0.5:
        y *= 0.55
    r = float(rng.choice([1.5, 2, 2.5, 3.5], p=[.4, .3, .2, .1]))
    gap = 1 - clouds[min(CH - 1, int(y)), min(CW - 1, int(x))]
    if y > CH * 0.45 or gap < 0.75:
        continue
    a = int(rng.uniform(90, 170) * (1 - y / CH) * gap)
    sd.ellipse([x - r, y - r, x + r, y + r], fill=(255, 238, 228, a))
img = Image.alpha_composite(img, stars.filter(ImageFilter.GaussianBlur(1.2)))
sky_layer = Image.alpha_composite(img, stars)

# ---------------------------------------------------------------- the glass

glass = clear()
g = ImageDraw.Draw(glass)
for _ in range(980):
    cx, cy = int(rng.integers(0, CW)), int(rng.integers(0, CH))
    r = float(rng.choice([2, 3, 4, 5, 6, 8, 11], p=[.24, .24, .2, .13, .09, .07, .03]))
    g.ellipse([cx - r, cy - r * 1.15, cx + r, cy + r * 1.15], fill=(200, 186, 236, 28))
    g.arc([cx - r, cy - r * 1.15, cx + r, cy + r * 1.15], 15, 165, fill=(255, 226, 212, 120), width=max(1, int(r / 2.5)))
    g.arc([cx - r, cy - r * 1.15, cx + r, cy + r * 1.15], 195, 345, fill=(12, 8, 26, 80), width=max(1, int(r / 3)))
for _ in range(24):
    cx = int(rng.integers(0, CW)); y0 = int(rng.integers(0, CH - 300)); L = int(rng.integers(140, 640))
    amp = rng.uniform(2, 12); per = rng.uniform(20, 60); ph = rng.uniform(0, 6); wdt = int(rng.integers(3, 6))
    pts = [(cx + amp * np.sin(t / per + ph), y0 + t) for t in range(0, L, 5)]
    g.line(pts, fill=(214, 200, 246, 52), width=wdt)
    g.line([(x + wdt / 2, y) for x, y in pts], fill=(255, 236, 226, 70), width=1)
    ex, ey = pts[-1]; r = wdt + 3
    g.ellipse([ex - r, ey - r * 1.2, ex + r, ey + r * 1.2], fill=(214, 200, 246, 70))
    g.arc([ex - r, ey - r * 1.2, ex + r, ey + r * 1.2], 15, 165, fill=(255, 238, 228, 170), width=2)
# A faint sheen across the panes: the room, dimly, in the glass.
sheen = clear()
sh = ImageDraw.Draw(sheen)
for (x0, wide, a) in [(-200, 150, 16), (60, 60, 11), (760, 210, 14), (1080, 70, 10)]:
    lean = CH * 0.36
    sh.polygon([(x0 + lean, 0), (x0 + lean + wide, 0), (x0 + wide, CH), (x0, CH)], fill=(226, 214, 255, a))
haze = sheen.filter(ImageFilter.GaussianBlur(26))   # the soft things on the glass are a layer of their own (small: they have no edges)
# The frame's shadow on the glass, at each pane's top and left.
shadow = clear()
sh = ImageDraw.Draw(shadow)
CX, SILL_TOP = W // 2, H - SILL
for (x0, y0, x1, y1) in [(F, F, CX - M // 2, MY - M // 2), (CX + M // 2, F, W - F, MY - M // 2),
                         (F, MY + M // 2, CX - M // 2, SILL_TOP), (CX + M // 2, MY + M // 2, W - F, SILL_TOP)]:
    sh.rectangle([x0 + B - 30, y0 + B - 30, x1 + B, y0 + B + 26], fill=(10, 4, 16, 120))
    sh.rectangle([x0 + B - 30, y0 + B - 30, x0 + B + 20, y1 + B], fill=(10, 4, 16, 90))
haze = Image.alpha_composite(haze, shadow.filter(ImageFilter.GaussianBlur(14)))
# The candle in the glass: its flame mirrored a little above itself, and a warm bloom on the wet pane round it.
fx, fy = FLAME[0] + B, FLAME[1] + B
warm = clear()
wd = ImageDraw.Draw(warm)
wd.ellipse([fx - 230, fy - 300, fx + 230, fy + 150], fill=(255, 176, 110, 34))
wd.ellipse([fx - 90, fy - 150, fx + 90, fy + 40], fill=(255, 190, 120, 46))
haze = Image.alpha_composite(haze, warm.filter(ImageFilter.GaussianBlur(60)))
ghost = clear()
gd = ImageDraw.Draw(ghost)
gd.ellipse([fx - 12, fy - 56 - 26, fx + 12, fy - 56 + 20], fill=(255, 200, 130, 70))
gd.ellipse([fx - 5, fy - 56 - 14, fx + 5, fy - 56 + 12], fill=(255, 236, 200, 90))
haze = Image.alpha_composite(haze, ghost.filter(ImageFilter.GaussianBlur(7)))

# ---------------------------------------------------------------- the rendered layers


def rendered(name, blur=0.0):
    """A rendered layer on the full canvas (it was rendered in a box of it)."""
    im = Image.open(os.path.join(src, name + ".png")).convert("RGBA")
    full = clear()
    full.paste(im, tuple(raw[name]))
    if blur:
        full = full.convert("RGBa").filter(ImageFilter.GaussianBlur(blur)).convert("RGBA")   # premultiplied: no dark fringe
    return full


layers = [
    # name, picture, the scale it is written at, its file's type, how far a 256-colour palette may stray (0: never one)
    ("sky", sky_layer, 1.0, "jpg", 0),
    ("far", rendered("far", 6.0), 0.5, "png", 9),
    ("near", rendered("near", 3.5), 0.5, "png", 9),
    ("haze", haze, 0.125, "png", 0),
    ("glass", glass, 1.0, "png", 30),
    ("frame", rendered("frame"), 1.0, "png", 26),
    ("sill", rendered("sill"), 1.0, "png", 12),
    ("fore-left", rendered("fore-left", 2.0), 0.5, "png", 9),
    ("fore-right", rendered("fore-right", 2.0), 0.5, "png", 9),
]

# ---------------------------------------------------------------- write

out = {"art": [W, H], "bleed": B, "moon": [MOON[0] / W, MOON[1] / H, MOON[2] / W], "flame": [FLAME[0] / W, FLAME[1] / H],
       "wick": [raw["anchors"]["wick"][0] / W, raw["anchors"]["wick"][1] / H], "layers": {}}
total = 0
print("assets/home/set:")
for name, im, scale, kind, stray in layers:
    box = (0, 0, CW, CH) if kind == "jpg" else export.bounds(im, 3)
    # Whole pixels at the written scale.
    step = round(1 / scale)
    box = (box[0] // step * step, box[1] // step * step, min(CW, -(-box[2] // step) * step), min(CH, -(-box[3] // step) * step))
    cut = im.crop(box)
    if scale != 1.0:
        cut = export.resize(cut, (cut.width // step, cut.height // step))
    path = os.path.join(DEST, f"{name}.{kind}")
    if kind == "jpg":
        cut.convert("RGB").save(path, quality=84, optimize=True, progressive=True)
        how = "jpeg"
    else:
        data, how = export.encode(cut, quantise=stray > 0, max_error=stray)
        open(path, "wb").write(data)
    n = os.path.getsize(path)
    print(f"  {os.path.relpath(path, REPO)}  {cut.width}x{cut.height}  {n / 1024:.1f} KB  ({how})")
    total += n
    out["layers"][name] = {"rect": [box[0] - B, box[1] - B, box[2] - box[0], box[3] - box[1]]}
json.dump(out, open(os.path.join(DEST, "set.json"), "w"), indent=1)
print(f"total {total / 1024:.0f} KB; set.json: flame {out['flame']}, moon {out['moon']}")


def composite(shift=(0.0, 0.0)):
    """The whole set as the app lays it, the layers slid by `shift` (-1..1 each way) times their depth (art px)."""
    depth = {"sky": 21, "far": 16, "near": 12, "haze": 6, "glass": 6, "frame": 3.6, "sill": 0, "fore-left": -42, "fore-right": -42}
    pic = Image.new("RGBA", (CW, CH), (0, 0, 0, 255))
    for name, im, *_ in layers:
        moved = clear()
        moved.paste(im, (round(shift[0] * depth[name]), round(shift[1] * depth[name] * 0.6)))
        pic = Image.alpha_composite(pic, moved)
    return pic.crop((B, B, B + W, B + H)).convert("RGB")


composite().save(os.path.join(src, "set_rest.jpg"), quality=90)
tilts = [("left", (-1, 0)), ("right", (1, 0)), ("centre", (0, 0)), ("up", (0, -1)), ("down", (0, 1))]
strip = Image.new("RGB", (5 * (W // 3) + 40, H // 3), (13, 9, 16))
for i, (_, t) in enumerate(tilts):
    strip.paste(composite(t).resize((W // 3, H // 3), Image.LANCZOS), (i * (W // 3 + 10), 0))
strip.save(os.path.join(src, "set_tilts.jpg"), quality=88)
print("previews", os.path.join(src, "set_rest.jpg"), os.path.join(src, "set_tilts.jpg"))

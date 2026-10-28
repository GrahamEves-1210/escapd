# Home's backdrop (docs/ART_DIRECTION.md, "velvet & ink"): her reading nook on
# a rainy night. A four-pane window fills the phone, its frame and sill on the
# screen's edges and a cross of mullions, the wood painted a deep plum-brown
# and warmed by candlelight from the sill. Behind the glass: a midnight-indigo
# sky going plum toward a dusky mauve horizon, a few stars, a full moon rising
# over a soft treeline in the lower right pane (the cat sits in front of it),
# all seen through wet glass, beaded with rain. On the sill at the left, a
# little stack of books with a lit candle on top; its light pools on the sill
# and the frame. The app animates the flame's glow, the rain, the fairy lights
# and the far-off lightning over it (src/screens/hub/WindowBackdrop.tsx).
#
# Usage: python3 scripts/brand/window.py assets/backdrop/window.jpg
# The geometry (F, SILL, M, MY, the candle's flame) is mirrored as fractions in
# src/screens/hub/art/nook.ts: change both together.
import sys, numpy as np
from PIL import Image, ImageDraw, ImageFilter

W, H = 1290, 2796
rng = np.random.default_rng(11)
F = 64            # frame on the sides and top (px)
SILL = 150        # the sill at the foot
M = 46            # mullion width
MY = int(H * 0.50)  # the cross's height
SILL_TOP = H - SILL
CX = W // 2
# The candle on the sill (its flame's centre), and the moon behind the lower right pane.
FLAME = (290, SILL_TOP - 270)
MOON = (1000, SILL_TOP - 318, 88)

yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
v = yy / H


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


def noise(scale, seed_rng=rng):
    small = seed_rng.random((H // scale + 2, W // scale + 2))
    return np.array(Image.fromarray((small * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC)).astype(np.float32) / 255.0


def soft_disc(cx, cy, r, power=2.0):
    d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) / r
    return np.clip(1 - d, 0, 1) ** power


# 1. The sky: midnight indigo at the top, plum through the middle, a dusky mauve glow low behind the trees.
sky = ramp(v, [
    (0.0, (14, 13, 38)),
    (0.35, (26, 19, 52)),
    (0.62, (44, 26, 66)),
    (0.80, (78, 46, 92)),
    (0.90, (112, 68, 112)),
    (1.0, (124, 80, 118)),
])
clouds = np.clip((0.6 * noise(300) + 0.4 * noise(120) - 0.48) * 2.0, 0, 1)
sky += clouds[..., None] * np.array([34, 22, 46], np.float32) * (0.35 + 0.65 * v[..., None])
# The moon's halo lifts the sky round it, warm lavender.
halo = soft_disc(MOON[0], MOON[1], MOON[2] * 5.2, 1.6)
sky += halo[..., None] * np.array([52, 40, 74], np.float32)
img = Image.fromarray(np.clip(sky, 0, 255).astype(np.uint8)).convert("RGBA")
d = ImageDraw.Draw(img)

# 2. The moon: a soft full moon, faint maria, a bright rim.
mx, my, mr = MOON
moon = Image.new("RGBA", (W, H), (0, 0, 0, 0))
md = ImageDraw.Draw(moon)
md.ellipse([mx - mr, my - mr, mx + mr, my + mr], fill=(250, 238, 226, 255))
marks = Image.new("L", (W, H), 0)
mk = ImageDraw.Draw(marks)
for (ox, oy, rr) in [(-30, -24, 34), (22, 10, 26), (-8, 38, 20), (40, -36, 14), (-46, 22, 12)]:
    mk.ellipse([mx + ox - rr, my + oy - rr, mx + ox + rr, my + oy + rr], fill=60)
marks = marks.filter(ImageFilter.GaussianBlur(9))
shade = Image.new("RGBA", (W, H), (196, 170, 196, 0))
shade.putalpha(marks)
moon = Image.alpha_composite(moon, Image.composite(shade, Image.new("RGBA", (W, H), (0, 0, 0, 0)), moon.getchannel("A")))
glow = moon.filter(ImageFilter.GaussianBlur(22)); glow.putalpha(glow.getchannel("A").point(lambda a: int(a * 0.6)))
img = Image.alpha_composite(img, glow)
img = Image.alpha_composite(img, moon)

# 3. The treeline: two soft rows of pines low across the panes, the far row hazed plum.
d = ImageDraw.Draw(img)


def pine(cx, base, h, w, colour):
    tiers = 6
    for t in range(tiers):
        top = base - h + t * h / tiers * 0.9
        bot = top + h / tiers * 1.6
        half = w * (t + 1) / tiers / 2
        d.polygon([(cx, top), (cx - half, bot), (cx + half, bot)], fill=colour)
    d.rectangle([cx - w * 0.04, base - h * 0.12, cx + w * 0.04, base + 40], fill=colour)


for base, colour, n, hmin, hmax in [
    (int(H * 0.915), (56, 36, 74), 18, 110, 280),
    (int(H * 0.94), (28, 18, 38), 14, 150, 330),
]:
    for _ in range(n):
        cx = int(rng.integers(-60, W + 60))
        h = int(rng.integers(hmin, hmax))
        pine(cx, base, h, h * 0.44, colour)
    d.rectangle([0, base, W, H], fill=colour)
img = img.filter(ImageFilter.GaussianBlur(7))   # seen through wet glass

# Stars, sparse and mostly high up: tiny warm-white points, a few with a glow.
stars = Image.new("RGBA", (W, H), (0, 0, 0, 0))
sd = ImageDraw.Draw(stars)
for _ in range(120):
    x, y = float(rng.uniform(0, W)), float(rng.uniform(0, H * 0.8) ** 1.0)
    if rng.random() < 0.5:
        y *= 0.55
    r = float(rng.choice([1.5, 2, 2.5, 3.5], p=[.4, .3, .2, .1]))
    a = int(rng.uniform(120, 230) * (1 - y / H))
    sd.ellipse([x - r, y - r, x + r, y + r], fill=(255, 238, 228, a))
img = img.convert('RGBA')
img = Image.alpha_composite(img, stars.filter(ImageFilter.GaussianBlur(1.2)))
img = Image.alpha_composite(img, stars)


# 4. Rain on the glass: fewer, softer beads (lavender, catching the warm room light on their lower rims) and a few runs.
glass = Image.new("RGBA", (W, H), (0, 0, 0, 0))
g = ImageDraw.Draw(glass)
for _ in range(900):
    cx, cy = int(rng.integers(0, W)), int(rng.integers(0, H))
    r = float(rng.choice([2, 3, 4, 5, 6, 8, 11], p=[.24, .24, .2, .13, .09, .07, .03]))
    g.ellipse([cx - r, cy - r * 1.15, cx + r, cy + r * 1.15], fill=(200, 186, 236, 28))
    g.arc([cx - r, cy - r * 1.15, cx + r, cy + r * 1.15], 15, 165, fill=(255, 226, 212, 120), width=max(1, int(r / 2.5)))
    g.arc([cx - r, cy - r * 1.15, cx + r, cy + r * 1.15], 195, 345, fill=(12, 8, 26, 80), width=max(1, int(r / 3)))
for _ in range(22):
    cx = int(rng.integers(0, W)); y0 = int(rng.integers(0, H - 300)); L = int(rng.integers(140, 640))
    amp = rng.uniform(2, 12); per = rng.uniform(20, 60); ph = rng.uniform(0, 6); wdt = int(rng.integers(3, 6))
    pts = [(cx + amp * np.sin(t / per + ph), y0 + t) for t in range(0, L, 5)]
    g.line(pts, fill=(214, 200, 246, 52), width=wdt)
    g.line([(x + wdt / 2, y) for x, y in pts], fill=(255, 236, 226, 70), width=1)
    ex, ey = pts[-1]; r = wdt + 3
    g.ellipse([ex - r, ey - r * 1.2, ex + r, ey + r * 1.2], fill=(214, 200, 246, 70))
    g.arc([ex - r, ey - r * 1.2, ex + r, ey + r * 1.2], 15, 165, fill=(255, 238, 228, 170), width=2)
img = Image.alpha_composite(img.convert("RGBA"), glass)

# 5. The window: painted plum-brown wood round the screen, a cross of mullions, a deep sill at the foot.
frame = Image.new("RGBA", (W, H), (0, 0, 0, 0))
f = ImageDraw.Draw(frame)
dark, mid, lit = (26, 16, 24), (54, 34, 44), (104, 70, 74)


def bar(x0, y0, x1, y1):
    f.rectangle([x0, y0, x1, y1], fill=mid)
    # A rounded profile: lit on the top/left edge, dark on the bottom/right.
    if x1 - x0 > y1 - y0:
        f.rounded_rectangle([x0, y0 + 1, x1, y0 + 7], 3, fill=lit)
        f.line([(x0, y1 - 3), (x1, y1 - 3)], fill=dark, width=6)
    else:
        f.rounded_rectangle([x0 + 1, y0, x0 + 7, y1], 3, fill=lit)
        f.line([(x1 - 3, y0), (x1 - 3, y1)], fill=dark, width=6)


bar(0, 0, W, F); bar(0, 0, F, H); bar(W - F, 0, W, H)
bar(CX - M // 2, F, CX + M // 2, SILL_TOP); bar(F, MY - M // 2, W - F, MY + M // 2)
# The sill: a deeper ledge, its lip catching the candle.
f.rectangle([0, SILL_TOP, W, H], fill=mid)
f.rectangle([0, SILL_TOP, W, SILL_TOP + 28], fill=(78, 50, 58))
f.line([(0, SILL_TOP + 2), (W, SILL_TOP + 2)], fill=(150, 104, 100), width=5)
f.rectangle([0, SILL_TOP + 28, W, SILL_TOP + 38], fill=dark)
img = Image.alpha_composite(img, frame)
# The frame's shadow on the glass, round each pane.
shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0)); sh = ImageDraw.Draw(shadow)
for (x0, y0, x1, y1) in [(F, F, CX - M // 2, MY - M // 2), (CX + M // 2, F, W - F, MY - M // 2),
                         (F, MY + M // 2, CX - M // 2, SILL_TOP), (CX + M // 2, MY + M // 2, W - F, SILL_TOP)]:
    sh.rectangle([x0, y0, x1, y0 + 26], fill=(10, 4, 16, 120)); sh.rectangle([x0, y0, x0 + 20, y1], fill=(10, 4, 16, 90))
img = Image.alpha_composite(img, shadow.filter(ImageFilter.GaussianBlur(14)))

# 6. On the sill, at the left: two books, the candle on top in a little brass dish, and a mug of tea.
props = Image.new("RGBA", (W, H), (0, 0, 0, 0))
p = ImageDraw.Draw(props)
fx, fy = FLAME
base = SILL_TOP + 6
# Two books lying spine-out: the bottom one plum, the top one teal and a little shorter,
# each with gilt bands and a foil title plate, their page edges just showing on top.
GILT = (226, 182, 128)


def book(x0, x1, top, bottom, cover, shade):
    p.rectangle([x0 + 8, top - 6, x1 - 10, top + 4], fill=(236, 220, 198))
    for k in range(3):
        p.line([(x0 + 10, top - 4 + k * 3), (x1 - 12, top - 4 + k * 3)], fill=(204, 182, 160), width=1)
    p.rounded_rectangle([x0, top, x1, bottom], 9, fill=cover)
    p.rounded_rectangle([x0, bottom - 10, x1, bottom], 6, fill=shade)
    for gx in (x0 + 26, x0 + 36, x1 - 36, x1 - 26):
        p.line([(gx, top + 8), (gx, bottom - 8)], fill=GILT, width=3)
    mid_x = (x0 + x1) // 2
    p.rounded_rectangle([mid_x - 62, top + (bottom - top) // 2 - 9, mid_x + 62, top + (bottom - top) // 2 + 9], 4, outline=GILT, width=3)
    p.line([(mid_x - 40, top + (bottom - top) // 2), (mid_x + 40, top + (bottom - top) // 2)], fill=GILT, width=4)


b1 = (fx - 160, base - 58, fx + 160, base)
book(b1[0], b1[2], b1[1], b1[3], (98, 44, 86), (70, 28, 62))
b2 = (fx - 132, b1[1] - 52, fx + 138, b1[1] - 4)
book(b2[0], b2[2], b2[1], b2[3], (28, 80, 88), (18, 56, 64))
# The dish and the candle: a warm cream pillar, a couple of drips, a dark wick.
dish_y = b2[1] - 4
p.ellipse([fx - 62, dish_y - 16, fx + 62, dish_y + 8], fill=(176, 124, 84))
p.ellipse([fx - 56, dish_y - 18, fx + 56, dish_y - 2], fill=(222, 170, 118))
cw, ch = 34, 128
ctop = dish_y - 8 - ch
p.rounded_rectangle([fx - cw, ctop, fx + cw, dish_y - 6], 10, fill=(236, 212, 184))
p.ellipse([fx - cw, ctop - 9, fx + cw, ctop + 9], fill=(246, 228, 204))
for (dx, L) in [(-20, 40), (14, 24), (26, 54)]:
    p.rounded_rectangle([fx + dx - 5, ctop, fx + dx + 5, ctop + L], 5, fill=(246, 228, 204))
p.line([(fx, ctop - 2), (fx + 1, ctop - 18)], fill=(40, 26, 30), width=4)
# A mug of tea beside them: blush pink, a little heart on it, its handle to the right.
mx0, mx1 = fx + 196, fx + 296
mtop = base - 118
p.rounded_rectangle([mx1 - 14, mtop + 26, mx1 + 34, mtop + 84], 22, outline=(190, 114, 140), width=12)
p.rounded_rectangle([mx0, mtop, mx1, base - 2], 16, fill=(208, 128, 156))
p.rounded_rectangle([mx0 + 60, mtop + 4, mx1, base - 2], 16, fill=(180, 104, 132))
p.ellipse([mx0, mtop - 10, mx1, mtop + 12], fill=(186, 110, 138))
p.ellipse([mx0 + 8, mtop - 5, mx1 - 8, mtop + 8], fill=(120, 66, 44))
hx, hy = mx0 + 42, mtop + 54
p.polygon([(hx, hy + 14), (hx - 16, hy - 2), (hx - 9, hy - 11), (hx, hy - 4), (hx + 9, hy - 11), (hx + 16, hy - 2)], fill=(252, 232, 236))
# Shading on the candle: dark on the right, away from the room's light.
cs = Image.new("L", (W, H), 0)
ImageDraw.Draw(cs).rectangle([fx + 8, ctop, fx + cw, dish_y - 6], fill=90)
cs = cs.filter(ImageFilter.GaussianBlur(10))
props_alpha = props.getchannel("A")
shade_l = Image.composite(cs, Image.new("L", (W, H), 0), props_alpha)
props = Image.alpha_composite(props, Image.merge("RGBA", (Image.new("L", (W, H), 70), Image.new("L", (W, H), 30), Image.new("L", (W, H), 50), shade_l)))
# The books' shadow on the sill.
bs = Image.new("RGBA", (W, H), (0, 0, 0, 0))
ImageDraw.Draw(bs).ellipse([fx - 200, base - 18, fx + 340, base + 22], fill=(12, 4, 14, 150))
img = Image.alpha_composite(img, bs.filter(ImageFilter.GaussianBlur(12)))
img = Image.alpha_composite(img, props)

# 7. The candlelight: a warm pool over the sill, the books and the frame round the candle, falling off up the screen.
rgb = np.asarray(img.convert("RGB")).astype(np.float32)
warm = np.array([255, 190, 130], np.float32) / 255.0
reach = soft_disc(fx, fy, 1500, 1.7)
near = soft_disc(fx, fy, 420, 1.4)
rgb = rgb * (1 + (warm[None, None, :] - 0.35) * (0.55 * reach + 0.9 * near)[..., None])
rgb += np.array([255, 196, 140], np.float32)[None, None, :] * (0.14 * near + 0.04 * reach)[..., None]
# The room's corners fall away into plum.
corner = np.clip((np.sqrt(((xx - W / 2) / (W * 0.75)) ** 2 + ((yy - H * 0.62) / (H * 0.7)) ** 2) - 0.55) * 1.4, 0, 1)
rgb = rgb * (1 - 0.45 * corner[..., None]) + np.array([24, 12, 30], np.float32) * (0.45 * corner[..., None])
img = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8)).convert("RGBA")

# 8. The flame itself (the app lays a flickering glow over it): a bright core, a warm halo.
fl = Image.new("RGBA", (W, H), (0, 0, 0, 0))
fd = ImageDraw.Draw(fl)
fd.ellipse([fx - 70, fy - 80, fx + 70, fy + 60], fill=(255, 200, 120, 90))
fl = fl.filter(ImageFilter.GaussianBlur(30))
img = Image.alpha_composite(img, fl)
flame = Image.new("RGBA", (W, H), (0, 0, 0, 0))
fd = ImageDraw.Draw(flame)
fd.polygon([(fx, fy - 46), (fx - 15, fy + 2), (fx - 12, fy + 14), (fx, fy + 20), (fx + 12, fy + 14), (fx + 15, fy + 2)], fill=(255, 176, 92, 255))
fd.polygon([(fx, fy - 28), (fx - 8, fy + 4), (fx, fy + 14), (fx + 8, fy + 4)], fill=(255, 244, 214, 255))
img = Image.alpha_composite(img, flame.filter(ImageFilter.GaussianBlur(2.2)))

img.convert("RGB").save(sys.argv[1], quality=88)
img.convert("RGB").resize((W // 4, H // 4)).save(sys.argv[2] if len(sys.argv) > 2 else "preview.png")
print("panes", F / W, F / H, SILL / H, M / W, MY / H, "flame", fx / W, fy / H, "moon", mx / W, my / H, mr / W)

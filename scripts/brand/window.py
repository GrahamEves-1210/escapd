# Home's backdrop: a four-pane window filling the phone, its frame and sill
# on the screen's edges and a cross of mullions; behind the glass a deep blue
# rainy dusk over dark pines; rain beaded and running on the glass. The app
# animates more drops landing and running over it.
import sys, numpy as np
from PIL import Image, ImageDraw, ImageFilter
W, H = 1290, 2796
rng = np.random.default_rng(11)
F = 64            # frame on the sides and top (px)
SILL = 150        # the sill at the foot
M = 46            # mullion width
MY = int(H * 0.50)  # the cross's height

# Sky: deep blue at the top, a brighter blue band low behind the trees.
y = np.linspace(0, 1, H)[:, None, None]
c0 = np.array([14, 22, 70]); c1 = np.array([40, 66, 150]); c2 = np.array([92, 120, 196])
sky = np.where(y < 0.55, c0 + (c1 - c0) * (y / 0.55), c1 + (c2 - c1) * np.clip((y - 0.55) / 0.2, 0, 1))
sky = np.broadcast_to(sky, (H, W, 3)).astype(float).copy()
def noise(scale):
    small = rng.random((H // scale + 2, W // scale + 2))
    return np.array(Image.fromarray((small * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC)) / 255.0
clouds = np.clip((0.6 * noise(260) + 0.4 * noise(110) - 0.5) * 2.2, 0, 1)
sky += clouds[..., None] * np.array([18, 24, 40]) * (1 - y[..., 0][..., None])
img = Image.fromarray(np.clip(sky, 0, 255).astype(np.uint8))

# Pines: layered silhouettes across the lower part, the far row lighter.
d = ImageDraw.Draw(img)
def pine(cx, base, h, w, colour):
    tiers = 6
    for t in range(tiers):
        top = base - h + t * h / tiers * 0.9
        bot = top + h / tiers * 1.6
        half = w * (t + 1) / tiers / 2
        d.polygon([(cx, top), (cx - half, bot), (cx + half, bot)], fill=colour)
    d.rectangle([cx - w * 0.04, base - h * 0.12, cx + w * 0.04, base + 40], fill=colour)
for row, (base, colour, n, hmin, hmax) in enumerate([
    (int(H * 0.78), (24, 34, 72), 14, 380, 700),
    (int(H * 0.86), (10, 14, 32), 11, 520, 980),
]):
    for _ in range(n):
        cx = int(rng.integers(-60, W + 60)); h = int(rng.integers(hmin, hmax))
        pine(cx, base, h, h * 0.42, colour)
    d.rectangle([0, base, W, H], fill=colour)
img = img.filter(ImageFilter.GaussianBlur(7))   # seen through wet glass

# Rain on the glass: beads with a bright lower rim and a dark upper one, and runs.
glass = Image.new("RGBA", (W, H), (0, 0, 0, 0))
g = ImageDraw.Draw(glass)
for _ in range(1400):
    cx, cy = int(rng.integers(0, W)), int(rng.integers(0, H))
    r = float(rng.choice([2, 3, 4, 5, 6, 8, 11], p=[.22, .22, .2, .14, .1, .08, .04]))
    g.ellipse([cx - r, cy - r * 1.15, cx + r, cy + r * 1.15], fill=(170, 190, 240, 40))
    g.arc([cx - r, cy - r * 1.15, cx + r, cy + r * 1.15], 15, 165, fill=(235, 242, 255, 170), width=max(1, int(r / 2.5)))
    g.arc([cx - r, cy - r * 1.15, cx + r, cy + r * 1.15], 195, 345, fill=(4, 8, 24, 110), width=max(1, int(r / 3)))
for _ in range(34):
    cx = int(rng.integers(0, W)); y0 = int(rng.integers(0, H - 300)); L = int(rng.integers(140, 760))
    amp = rng.uniform(2, 12); per = rng.uniform(20, 60); ph = rng.uniform(0, 6); wdt = int(rng.integers(3, 7))
    pts = [(cx + amp * np.sin(t / per + ph), y0 + t) for t in range(0, L, 5)]
    g.line(pts, fill=(200, 215, 250, 70), width=wdt)
    g.line([(x + wdt / 2, yy) for x, yy in pts], fill=(240, 246, 255, 90), width=1)
    ex, ey = pts[-1]; r = wdt + 3
    g.ellipse([ex - r, ey - r * 1.2, ex + r, ey + r * 1.2], fill=(200, 215, 250, 90))
    g.arc([ex - r, ey - r * 1.2, ex + r, ey + r * 1.2], 15, 165, fill=(245, 248, 255, 200), width=2)
img = Image.alpha_composite(img.convert("RGBA"), glass)

# The window: frame round the screen, a cross of mullions, a sill at the foot.
frame = Image.new("RGBA", (W, H), (0, 0, 0, 0))
f = ImageDraw.Draw(frame)
dark, mid, lit = (20, 16, 15), (40, 32, 29), (78, 64, 56)
def bar(x0, y0, x1, y1):
    f.rectangle([x0, y0, x1, y1], fill=mid)
    # a rounded profile: lit on the top/left edge, dark on the bottom/right
    if x1 - x0 > y1 - y0:
        f.line([(x0, y0 + 2), (x1, y0 + 2)], fill=lit, width=4)
        f.line([(x0, y1 - 3), (x1, y1 - 3)], fill=dark, width=6)
    else:
        f.line([(x0 + 2, y0), (x0 + 2, y1)], fill=lit, width=4)
        f.line([(x1 - 3, y0), (x1 - 3, y1)], fill=dark, width=6)
bar(0, 0, W, F); bar(0, 0, F, H); bar(W - F, 0, W, H)
cx = W // 2
bar(cx - M // 2, F, cx + M // 2, H - SILL); bar(F, MY - M // 2, W - F, MY + M // 2)
# the sill: a deeper ledge, its lip catching the light
f.rectangle([0, H - SILL, W, H], fill=mid)
f.rectangle([0, H - SILL, W, H - SILL + 26], fill=(56, 46, 41)); f.line([(0, H - SILL), (W, H - SILL)], fill=(104, 88, 78), width=5)
f.rectangle([0, H - SILL + 26, W, H - SILL + 36], fill=dark)
img = Image.alpha_composite(img, frame)
# the frame's shadow on the glass, round each pane
shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0)); sd = ImageDraw.Draw(shadow)
for (x0, y0, x1, y1) in [(F, F, cx - M // 2, MY - M // 2), (cx + M // 2, F, W - F, MY - M // 2),
                         (F, MY + M // 2, cx - M // 2, H - SILL), (cx + M // 2, MY + M // 2, W - F, H - SILL)]:
    sd.rectangle([x0, y0, x1, y0 + 26], fill=(0, 0, 0, 120)); sd.rectangle([x0, y0, x0 + 20, y1], fill=(0, 0, 0, 90))
img = Image.alpha_composite(img, shadow.filter(ImageFilter.GaussianBlur(14)))
img.convert("RGB").save(sys.argv[1], quality=88)
img.convert("RGB").resize((W // 4, H // 4)).save("preview.png")
print("panes", F / W, F / H, SILL / H, M / W, MY / H)

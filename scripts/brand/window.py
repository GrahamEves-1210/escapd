# The home screen's backdrop: a rainy night through a window whose frame and
# sill run round the screen's edges. Static layer; rain and lightning are
# animated over it in the app.
import sys, numpy as np
from PIL import Image, ImageDraw, ImageFilter
W, H = 1290, 2796
rng = np.random.default_rng(7)

# Sky: deep storm blue-grey, lighter low on the horizon (city glow).
y = np.linspace(0, 1, H)[:, None]
top = np.array([10, 13, 20]); mid = np.array([22, 28, 40]); low = np.array([44, 44, 52])
sky = np.where(y < 0.6, top + (mid - top) * (y / 0.6), mid + (low - mid) * ((y - 0.6) / 0.4))
sky = np.repeat(sky[:, None, :].reshape(H, 1, 3), W, axis=1).astype(float)
# Clouds: soft noise, brighter under a far-off glow.
def noise(scale):
    small = rng.random((H // scale + 2, W // scale + 2))
    return np.array(Image.fromarray((small * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC)) / 255.0
clouds = 0.55 * noise(220) + 0.3 * noise(90) + 0.15 * noise(35)
clouds = np.clip((clouds - 0.45) * 1.8, 0, 1) * (1 - y[:, :]) * 0.9
sky += clouds[..., None] * np.array([26, 30, 40])
img = Image.fromarray(np.clip(sky, 0, 255).astype(np.uint8))

# A distant skyline: dark blocks along the lower third, a few warm windows.
d = ImageDraw.Draw(img)
base = int(H * 0.80)
x = -40
while x < W + 40:
    bw = int(rng.integers(60, 230)); bh = int(rng.integers(90, 640)) if rng.random() < 0.85 else int(rng.integers(700, 900))
    shade = int(rng.integers(12, 22))
    d.rectangle([x, base - bh, x + bw, H], fill=(shade, shade + 2, shade + 6))
    for _ in range(int(rng.integers(2, 9))):
        wx = x + int(rng.integers(8, max(9, bw - 16))); wy = base - bh + int(rng.integers(10, max(11, bh - 20)))
        warm = rng.random() < 0.8
        d.rectangle([wx, wy, wx + 7, wy + 10], fill=(214, 172, 96) if warm else (150, 180, 200))
    x += bw + int(rng.integers(0, 20))
img = img.filter(ImageFilter.GaussianBlur(9))   # the glass is wet: everything outside is soft

# Raindrops on the glass: small lenses, a bright rim low and a dark one high.
glass = Image.new("RGBA", (W, H), (0, 0, 0, 0))
g = ImageDraw.Draw(glass)
for _ in range(900):
    cx, cy = rng.integers(0, W), rng.integers(0, H)
    r = float(rng.choice([2, 3, 3, 4, 5, 6, 8, 10], p=[.2, .2, .2, .15, .1, .07, .05, .03]))
    g.ellipse([cx - r, cy - r * 1.1, cx + r, cy + r * 1.1], fill=(200, 210, 230, 26))
    g.arc([cx - r, cy - r * 1.1, cx + r, cy + r * 1.1], 20, 160, fill=(230, 236, 248, 120), width=max(1, int(r / 3)))
    g.arc([cx - r, cy - r * 1.1, cx + r, cy + r * 1.1], 200, 340, fill=(0, 0, 0, 70), width=max(1, int(r / 3)))
# A few trickles: drops that ran, leaving a clear trail.
for _ in range(14):
    cx = int(rng.integers(0, W)); y0 = int(rng.integers(0, H - 600)); L = int(rng.integers(120, 520))
    amp = rng.uniform(2, 14); per = rng.uniform(25, 70); ph = rng.uniform(0, 6)
    pts = [(cx + amp * np.sin(t / per + ph) + t * rng.uniform(-0.02, 0.02), y0 + t) for t in range(0, L, 6)]
    g.line(pts, fill=(210, 220, 240, 34), width=4)
    ex, ey = pts[-1]; g.ellipse([ex - 6, ey - 7, ex + 6, ey + 7], fill=(220, 230, 245, 60))
img = Image.alpha_composite(img.convert("RGBA"), glass.filter(ImageFilter.GaussianBlur(0.6)))

# The window: frame round every edge, a deeper sill at the foot, painted wood with a bevel.
frame = Image.new("RGBA", (W, H), (0, 0, 0, 0))
f = ImageDraw.Draw(frame)
T, S = 104, 250   # side/top frame, sill
wood = (46, 34, 28)
f.rectangle([0, 0, W, T], fill=wood); f.rectangle([0, 0, T, H], fill=wood)
f.rectangle([W - T, 0, W, H], fill=wood); f.rectangle([0, H - S, W, H], fill=wood)
# bevels: a lit inner edge on the top/left of the opening's frame, shadow on the lower/right
# an inner moulding: a raised strip just inside the frame, lit top-left, shaded bottom-right
f.rectangle([T - 24, T - 24, W - T + 24, H - S + 24], outline=(60, 46, 38), width=24)
f.line([(T - 24, T - 24), (W - T + 24, T - 24)], fill=(96, 76, 62), width=4)
f.line([(T - 24, T - 24), (T - 24, H - S + 24)], fill=(84, 66, 54), width=4)
f.line([(T, T), (W - T, T)], fill=(20, 15, 12), width=6)
f.line([(T, T), (T, H - S)], fill=(20, 15, 12), width=6)
f.line([(W - T, T), (W - T, H - S)], fill=(10, 7, 6), width=8)
f.line([(T, H - S), (W - T, H - S)], fill=(10, 7, 6), width=10)
# the sill's lip catches the light
f.rectangle([0, H - S + 24, W, H - S + 70], fill=(66, 50, 41)); f.line([(0, H - S + 24), (W, H - S + 24)], fill=(118, 94, 76), width=5)
f.rectangle([0, H - S + 70, W, H - S + 84], fill=(24, 18, 15))
# wood grain
for _ in range(240):
    gx = int(rng.integers(0, W)); gy = int(rng.integers(0, H)); L = int(rng.integers(60, 260))
    tone = (int(rng.integers(26, 44)),) * 1
    on_side = gx < T or gx > W - T
    if on_side:
        f.line([(gx, gy), (gx, gy + L)], fill=(44, 34, 28, 120), width=2)
    elif gy < T or gy > H - S:
        f.line([(gx, gy), (gx + L, gy)], fill=(44, 34, 28, 120), width=2)
img = Image.alpha_composite(img, frame)
# a shadow the frame casts on the glass, inside the opening
shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0)); sd = ImageDraw.Draw(shadow)
sd.rectangle([T, T, W - T, T + 40], fill=(0, 0, 0, 110)); sd.rectangle([T, T, T + 30, H - S], fill=(0, 0, 0, 90))
img = Image.alpha_composite(img, shadow.filter(ImageFilter.GaussianBlur(18)))
img.convert("RGB").save(sys.argv[1], quality=88)
img.convert("RGB").resize((W // 4, H // 4)).save("preview.png")

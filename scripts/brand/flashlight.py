# The game's flashlight, drawn to match the 3D magnifier (assets/brand/magnifier*.png):
# a brass head and bands, a dark wood grip, a warm glass lens, lit from the upper left.
# Points straight up; the game turns it toward the beam. Writes 96/192/288 px PNGs.
# Usage: python3 scripts/brand/flashlight.py
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

S = 288 * 2  # drawn at 2x, then downsampled
img = np.zeros((S, S, 4), float)

def cylinder(x0, x1, y0, y1, base, light=1.0):
    """A vertical cylinder section: shaded across its width (dark edges, a highlight left of centre)."""
    w = x1 - x0
    xs = (np.arange(x0, x1) - x0) / max(1, w - 1)
    shade = 0.35 + 0.9 * np.exp(-((xs - 0.32) ** 2) / 0.05) + 0.25 * np.sin(xs * np.pi)
    shade = np.clip(shade * light, 0, 1.6)
    col = np.clip(np.array(base)[None, :] * shade[:, None], 0, 255)
    img[y0:y1, x0:x1, :3] = col[None, :, :]
    img[y0:y1, x0:x1, 3] = 255

BRASS = (200, 150, 70)
WOOD = (92, 52, 30)
cx = S // 2
# tail cap
cylinder(cx - 46, cx + 46, int(S * 0.86), int(S * 0.93), BRASS)
# grip (wood) with brass bands
cylinder(cx - 50, cx + 50, int(S * 0.42), int(S * 0.86), WOOD, 1.1)
for y in (0.50, 0.78):
    cylinder(cx - 54, cx + 54, int(S * y), int(S * y) + 18, BRASS)
# neck widening into the head
for i, y in enumerate(range(int(S * 0.30), int(S * 0.42))):
    t = i / (S * 0.12)
    half = int(50 + (88 - 50) * (1 - t))
    cylinder(cx - half, cx + half, y, y + 1, BRASS, 0.95)
# head
cylinder(cx - 92, cx + 92, int(S * 0.16), int(S * 0.30), BRASS, 1.05)

im = Image.fromarray(img.astype(np.uint8), "RGBA")
d = ImageDraw.Draw(im)
# the lens face, seen a little from above: rim ring, glass, glow
top = int(S * 0.16)
d.ellipse([cx - 92, top - 30, cx + 92, top + 30], fill=(214, 168, 86, 255))
d.ellipse([cx - 78, top - 23, cx + 78, top + 23], fill=(255, 236, 170, 255))
d.ellipse([cx - 52, top - 14, cx + 30, top + 8], fill=(255, 250, 225, 255))
# a dark outline round the whole silhouette, like the magnifier's
alpha = im.split()[3]
edge = alpha.filter(ImageFilter.MaxFilter(9))
outline = Image.new("RGBA", im.size, (40, 26, 14, 255))
outline.putalpha(edge)
outline.alpha_composite(im)
im = outline
# soft drop shadow
shadow = Image.new("RGBA", im.size, (0, 0, 0, 0))
sh = im.split()[3].filter(ImageFilter.GaussianBlur(10)).point(lambda a: int(a * 0.45))
shadow.putalpha(sh)
canvas = Image.new("RGBA", im.size, (0, 0, 0, 0))
canvas.alpha_composite(shadow, (8, 10))
canvas.alpha_composite(im)
for size, suffix in ((96, ""), (192, "@2x"), (288, "@3x")):
    canvas.resize((size, size), Image.LANCZOS).save(f"assets/brand/flashlight{suffix}.png")

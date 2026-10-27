# Cuts the app icon, Android adaptive layers, splash and home logo out of the brand art.
# Usage: python3 scripts/brand/make.py <brand-art.png|webp> <out-dir>   (then copy the PNGs into assets/; wordmark.png goes to assets/brand/)
import sys
from PIL import Image, ImageFilter, ImageDraw
import numpy as np
SRC, OUT = sys.argv[1], sys.argv[2]
im = Image.open(SRC).convert('RGB')
a = np.asarray(im).astype(np.float32)

# 1. App icon: a square inside the rounded square (clear of its rim and corners), full bleed.
x0, y0, size = 367, 222, 515
icon = im.crop((x0, y0, x0 + size, y0 + size)).resize((1024, 1024), Image.LANCZOS)
icon = icon.filter(ImageFilter.UnsharpMask(radius=2, percent=60, threshold=2))
icon.save(f'{OUT}/icon.png')

# 2. Android adaptive: background = the art's edge colour; foreground = the art in the
#    safe zone (central 66 %), feathered to that colour so no square edge shows.
edge = np.concatenate([np.asarray(icon)[:8].reshape(-1, 3), np.asarray(icon)[-8:].reshape(-1, 3),
                       np.asarray(icon)[:, :8].reshape(-1, 3), np.asarray(icon)[:, -8:].reshape(-1, 3)]).mean(0)
bg = tuple(int(c) for c in edge)
Image.new('RGBA', (1024, 1024), bg + (255,)).save(f'{OUT}/android-icon-background.png')
inner = int(1024 * 0.70)
art = icon.resize((inner, inner), Image.LANCZOS).convert('RGBA')
yy, xx = np.mgrid[0:inner, 0:inner]
d = np.minimum.reduce([xx, yy, inner - 1 - xx, inner - 1 - yy]).astype(np.float32)
feather = np.clip(d / (inner * 0.12), 0, 1) ** 1.5
art.putalpha(Image.fromarray((feather * 255).astype(np.uint8)))
fg = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
fg.paste(art, ((1024 - inner) // 2, (1024 - inner) // 2), art)
fg.save(f'{OUT}/android-icon-foreground.png')
# Monochrome: the lit doorway as the shape (the door and cat stay cut out of it).
lum = np.asarray(art.convert('L')).astype(np.float32)
mono_a = np.clip((lum - 90) / 120, 0, 1) * feather
mono = Image.new('RGBA', (inner, inner), (255, 255, 255, 0))
mono.putalpha(Image.fromarray((mono_a * 255).astype(np.uint8)))
m = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0)); m.paste(mono, ((1024 - inner) // 2, (1024 - inner) // 2), mono)
m.save(f'{OUT}/android-icon-monochrome.png')

def key_dark(region, floor, ceil):
    """Dark background to transparent: alpha from the brightest channel, colour un-blended from black."""
    r = region.astype(np.float32)
    mx = r.max(axis=2)
    alpha = np.clip((mx - floor) / (ceil - floor), 0, 1)
    rgb = np.where(alpha[..., None] > 0, np.clip(r / np.maximum(alpha[..., None], 1e-3), 0, 255), 0)
    out = np.dstack([rgb, alpha * 255]).astype(np.uint8)
    return Image.fromarray(out, 'RGBA')

# 3. Splash: the rounded icon with its glow, the dark page keyed out.
sx0, sy0, ss = 249, 100, 750
splash = key_dark(a[sy0:sy0 + ss, sx0:sx0 + ss], floor=10, ceil=70)
# The glow runs past the crop: fade it out toward the border so no edge shows.
sa = np.asarray(splash).astype(np.float32)
gy, gx = np.mgrid[0:ss, 0:ss]
edge_d = np.minimum.reduce([gx, gy, ss - 1 - gx, ss - 1 - gy]).astype(np.float32)
sa[..., 3] *= np.clip(edge_d / (ss * 0.09), 0, 1) ** 1.6
splash = Image.fromarray(sa.astype(np.uint8), 'RGBA')
splash.resize((1024, 1024), Image.LANCZOS).save(f'{OUT}/splash-icon.png')

# 4. Wordmark: ESCAPD, its dark page keyed out, trimmed with a little room for its glow.
wy0, wy1 = 850, 1015
wx0, wx1 = 150, 1105
word = key_dark(a[wy0:wy1, wx0:wx1], floor=26, ceil=200)
bbox = word.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
pad = 6
word = word.crop((max(0, bbox[0] - pad), max(0, bbox[1] - pad), min(word.width, bbox[2] + pad), min(word.height, bbox[3] + pad)))
word.save(f'{OUT}/wordmark.png')
print('bg', bg, 'wordmark', word.size)

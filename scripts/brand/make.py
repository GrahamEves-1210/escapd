# Cuts the home logo (the ESCAPD wordmark) out of the brand art.
# Usage: python3 scripts/brand/make.py <brand-art.png|webp> <out-dir>   (then copy wordmark.png into assets/brand/)
#
# The app icon, Android's adaptive layers and the splash emblem used to be cut from the same art here
# (git history has them); they are now rendered in the game's brass-and-plum look by
# scripts/blender/props/brand_icon.py, which writes assets/icon.png, android-icon-*.png and splash-icon.png.
import sys
from PIL import Image
import numpy as np
SRC, OUT = sys.argv[1], sys.argv[2]
im = Image.open(SRC).convert('RGB')
a = np.asarray(im).astype(np.float32)

def key_dark(region, floor, ceil):
    """Dark background to transparent: alpha from the brightest channel, colour un-blended from black."""
    r = region.astype(np.float32)
    mx = r.max(axis=2)
    alpha = np.clip((mx - floor) / (ceil - floor), 0, 1)
    rgb = np.where(alpha[..., None] > 0, np.clip(r / np.maximum(alpha[..., None], 1e-3), 0, 255), 0)
    out = np.dstack([rgb, alpha * 255]).astype(np.uint8)
    return Image.fromarray(out, 'RGBA')

# Wordmark: ESCAPD, its dark page keyed out, trimmed with a little room for its glow.
wy0, wy1 = 850, 1015
wx0, wx1 = 150, 1105
word = key_dark(a[wy0:wy1, wx0:wx1], floor=26, ceil=200)
bbox = word.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
pad = 6
word = word.crop((max(0, bbox[0] - pad), max(0, bbox[1] - pad), min(word.width, bbox[2] + pad), min(word.height, bbox[3] + pad)))
word.save(f'{OUT}/wordmark.png')
print('wordmark', word.size)

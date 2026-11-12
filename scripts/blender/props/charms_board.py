# The charm board's velvet (src/screens/collection/CollectionScreen.tsx): a pin
# board's plum velvet under the house key light, a little uneven the way a
# padded board is, pooling darker toward the corner away from the lamp. The
# pins' hollows (charms_pins.py) are pressed into this same velvet.
#
# One picture stretched over the board (it has no edges or features to distort,
# and velvet is soft: it is rendered at 1.5x the board's points, not 3x).
#
#   <bpy python> scripts/blender/props/charms_board.py   # -> assets/charms/board-velvet.jpg
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
import numpy as np  # noqa: E402
from PIL import Image, ImageFilter  # noqa: E402

import export  # noqa: E402
import kit  # noqa: E402
import materials as M  # noqa: E402
from charms_designs import lin  # noqa: E402

W, H = 358, 470            # the board in points (a 390 pt phone; taller or wider boards stretch it)
VELVET = "#2A1D31"         # CollectionScreen's VELVET: the picture's middle tone
OUT = os.environ.get("OUT") or export.scratch("charms")


def shoot(path, scale=1.5, samples=int(os.environ.get("SAMPLES", 64))):
    kit.reset()
    kit.setup(size=(round(W * scale), round(H * scale)), samples=samples, ss=1)
    span = 6.0  # the board's height in units: the nap and the padding are sized to it
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=120, y_subdivisions=160, size=1.0)
    ob = bpy.context.object
    ob.scale = (span * W / H * 1.1, span * 1.1, 1)
    kit.apply_transforms(ob)
    # The padding: soft swells, a few millimetres.
    rng = np.random.default_rng(7)
    bumps = [(rng.uniform(-2.5, 2.5), rng.uniform(-3, 3), rng.uniform(0.9, 1.8), rng.uniform(-0.05, 0.05)) for _ in range(14)]
    for v in ob.data.vertices:
        v.co.z = sum(a * np.exp(-((v.co.x - x) ** 2 + (v.co.y - y) ** 2) / (r * r)) for x, y, r, a in bumps)
    kit.shade(ob, 180)
    kit.assign(ob, M.felt("velvet", color=lin(VELVET), nap=0.9, scale=span / 2))
    cam = kit.camera("top", span=span, azim=-90)
    kit.studio(cam, span=span, target=(0, 0, 0), key=1.5, warm=(1.0, 0.90, 0.76))
    kit.no_outline()
    return kit.render(path)


if __name__ == "__main__":
    src = os.path.join(OUT, "board-velvet.png")
    if not (os.environ.get("REUSE") and os.path.exists(src)):  # REUSE=1: only grade and export the last render again
        shoot(src)
    im = Image.open(src).convert("RGB")
    # Keep the board's tone: its middle is the app's VELVET, so labels and hollows sit on it as designed.
    a = np.asarray(im, dtype=np.float32)
    target = np.array([int(VELVET[i:i + 2], 16) for i in (1, 3, 5)], dtype=np.float32)
    a = np.clip(a * (target / a.reshape(-1, 3).mean(0)), 0, 255)
    # ... and its light legible: felt's shading is very flat under the studio (it is the point of
    # felt), so the fall from the warm key (upper left) to the cool rim (lower right) is drawn out.
    a = np.clip(target + (a - target) * float(os.environ.get("CONTRAST", 4.0)), 0, 255)
    im = Image.fromarray(a.astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.4))
    dest = os.path.join(export.REPO, "assets/charms/board-velvet.jpg")
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    im.save(dest, "JPEG", quality=78, optimize=True, progressive=True)
    print(f"  assets/charms/board-velvet.jpg  {im.width}x{im.height}  {os.path.getsize(dest) / 1024:.1f} KB")

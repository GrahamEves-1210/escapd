# The camera's viewfinder (src/capture/ui/rangefinder/Viewfinder.tsx): the frame round the live
# preview. The app scales each picture with the preview's box, so a frame's opening is exactly
# the preview on every screen; nothing of it lies over what the player frames with.
#   finder        the brass frame round the 3:4 preview (1x), bevelled down to the glass
#   finder-wide   the same round the tall 9:16 preview (0.5x)
#   glass         the finder's glass: a slight darkening into its corners. Soft, so the app
#                 stretches one picture over either preview
#
#   <bpy python> scripts/blender/props/camera_finder.py        # ONLY=finder for one
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from camera_common import Stage, brass, clear, kit, mc, shoot, sweep, totals, wanted  # noqa: E402
import numpy as np  # noqa: E402
from PIL import Image, ImageFilter  # noqa: E402

import export  # noqa: E402

W = {"finder": 365.0, "finder-wide": 273.75}   # the preview's width each frame is drawn for (393-wide screens)
ASPECTS = {"finder": 0.75, "finder-wide": 0.5625}
R = 26.0 / 365.0             # the preview's corner, as a share of its width
M = 13.0                       # the picture's margin round the preview: the frame (9) and its shadow
PROFILE = [(0, 0.4), (1.7, 5.0), (2.5, 5.8), (7.0, 5.8), (8.2, 4.8), (8.8, 2.6), (9.0, 0)]


def finder(name):
    w = W[name]
    h = w / ASPECTS[name]
    r = R * w
    st = Stage(w + 2 * M, h + 2 * M)
    b = brass("finder", age=0.5, brushed=0.55, wear=0.85)
    frame = sweep(st, M, M, w, h, r, PROFILE, "finder", corner=18)
    kit.assign(frame, b)
    # A screw at the middle of each side.
    for sx, sy in ((M + w / 2, M - 4.75), (M + w / 2, M + h + 4.75), (M - 4.75, M + h / 2), (M + w + 4.75, M + h / 2)):
        st.screw(sx, sy, 5.8, r=1.7, turn=sx + sy)
    st.light(shadow=0.0, reach=3.5)
    st.ink(4)
    shoot(st, name, lambda im: clear(st, im, M + 0.5, M + 0.5, w - 1.0, h - 1.0, r - 0.5))


def glass():
    """No render: a vignette, darkest in the corners, clear over the middle."""
    w, h = 150, 200
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    u, v = (x / (w - 1) - 0.5) * 2, (y / (h - 1) - 0.5) * 2
    d = (np.abs(u) ** 2.6 + np.abs(v) ** 2.6) ** (1 / 2.6)
    a = np.clip((d - 0.62) / 0.5, 0, 1) ** 1.8 * 0.34
    out = np.zeros((h, w, 4), np.float32)
    out[..., 0], out[..., 1], out[..., 2] = 14, 7, 16
    out[..., 3] = a * 255
    im = Image.fromarray(out.clip(0, 255).astype(np.uint8), "RGBA").filter(ImageFilter.GaussianBlur(1.0))
    path = os.path.join(export.REPO, mc.OUT, "glass.png")
    im.save(path + ".tmp", "PNG", optimize=True)
    os.replace(path + ".tmp", path)
    print(f"  {mc.OUT}/glass.png  {w}x{h}  {os.path.getsize(path) / 1024:.1f} KB")
    mc._totals["files"] += 1
    mc._totals["bytes"] += os.path.getsize(path)


if __name__ == "__main__":
    for name in ASPECTS:
        if wanted(name):
            finder(name)
    if wanted("glass"):
        glass()
    print("camera finder:", totals())

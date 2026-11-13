# Paranormal's way out (src/play2/Ending.tsx, the moment before the reply
# letter): the candle gutters and goes out, a wisp of smoke curls up (the app
# draws the smoke), the room settles.
# - end-moon-candle-lit.png, end-moon-candle-out.png: home's brass chamberstick
#   and its stub of candle (home_set.py's), alight (its wax glowing, the brass
#   warm) and out (cold, in what moonlight there is), from one camera;
# - end-moon-flame.png: the flame guttering, frame by frame (12 fps): steady,
#   torn sideways, shrunk to a blue bead.
#
#   <bpy python> scripts/blender/props/moment_moon.py [candle] [flame]
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import moment_common as C  # noqa: E402
from moment_common import I, M, Matrix, Vector, bpy, export, kit  # noqa: E402
import home_set as HS  # noqa: E402

CANDLE = (284, 284)       # points: the picture of the candle
PT = 187.0                # points a unit
FRAME = (108, 162)        # points: a frame of the flame
FOOT = 0.9                # the wick's tip, this far down a frame
ELEV = 16.0
# (height, lean, girth) of the flame, frame by frame: three to idle on, then it gutters and is gone.
GUTTER = [(1.0, 0.0, 1.0), (1.1, 0.03, 0.94), (0.94, -0.025, 1.05), (0.72, 0.11, 0.9), (1.02, -0.05, 0.86), (0.5, 0.14, 0.8), (0.3, -0.06, 0.7), (0.14, 0.01, 0.55)]


def candle(path, lit):
    C.setup((CANDLE[0] * 3, CANDLE[1] * 3), samples=int(os.environ.get("SAMPLES", 28)))
    made, soft = HS.candle()
    cx, cy = HS.CANDLE
    cam = kit.camera("front", target=(cx + 0.04, cy, 0.52), span=CANDLE[1] / PT, elev=ELEV)
    if lit:
        kit.studio(cam, span=1.3, target=(cx, cy, 0.5), key=0.5, fill=0.6, rim=0.6, ambient=0.6)
        data = bpy.data.lights.new("flame", "POINT")
        data.energy, data.color, data.shadow_soft_size = 14, (1.0, 0.62, 0.30), 0.05
        lamp = bpy.data.objects.new("flame", data)
        bpy.context.scene.collection.objects.link(lamp)
        lamp.location = (cx + 0.02, cy - 0.04, HS.WICK + 0.16)
    else:
        kit.studio(cam, span=1.3, target=(cx, cy, 0.5), key=0.16, fill=0.5, rim=1.5, ambient=0.5, warm=(0.62, 0.74, 1.0))
        for ob in soft:      # the run wax no longer glows
            kit.assign(ob, M.wax("run_wax_cold", color=(0.88, 0.74, 0.54), translucency=0.35, gloss=0.0))
    C.line(3.0, plain=soft)
    kit.render(path)
    return kit.project(cam, (cx + 0.045, cy - 0.01, HS.WICK))


def flames():
    paths = []
    span = FRAME[1] / PT
    for i, (tall, lean, fat) in enumerate(GUTTER):
        C.setup((FRAME[0] * 2, FRAME[1] * 2), samples=32, ss=2)
        h = HS.FLAME * tall
        prof = [(0, 0.0)] + [(0.085 * fat * math.sin(math.pi * t) ** 0.8 * (1 - 0.55 * t), h * t) for t in [j / 24 for j in range(1, 24)]] + [(0, h)]
        ob = kit.lathe(prof, name="flame", segments=40)
        for v in ob.data.vertices:
            v.co.x += lean * (v.co.z / h) ** 2
        kit.assign(ob, M.flame(strength=0.95 * (0.55 + 0.45 * min(1.0, tall)), height=h))
        kit.camera("front", target=(0, 0, (FOOT - 0.5) * span / math.cos(math.radians(ELEV))), span=span, elev=ELEV)
        kit.no_outline()
        paths.append(kit.render(C.scratch(f"moon_flame_{i}.png")))
    return paths


if __name__ == "__main__":
    what = sys.argv[1:] or ["candle", "flame"]
    total = 0
    if "candle" in what:
        for lit in (True, False):
            name = "lit" if lit else "out"
            src = C.scratch(f"moon_candle_{name}.png")
            wick = candle(src, lit)
            print(f"candle {name}: the wick's tip at (shares of the picture)", [round(v, 4) for v in wick])
            if not C.PREVIEW:
                total += C.export_fit(src, f"{C.OUT}/end-moon-candle-{name}.png", CANDLE, canvas=True)
    if "flame" in what:
        paths = flames()
        if C.PREVIEW:
            C.contact(paths, "moon_flame_preview.png", (0x10, 0x12, 0x2A))
        else:
            total += C.strip(paths, f"{C.OUT}/end-moon-flame.png", columns=len(paths))
            print(f"flame: {len(paths)} frames of {FRAME} pt, the wick's tip {FOOT} down a frame")
    print(f"total {total / 1024:.1f} KB")

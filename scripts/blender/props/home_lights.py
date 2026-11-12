# The string lights across the top of home's window (src/screens/hub/StringLights.tsx):
# a dark cord drooping in three swags from brass cup hooks, small glass bulbs in
# brass caps hung along it: warm white, and a few in the modes' colours (noir's
# rose gold, crime scene's cherry, paranormal's spirit mint).
#
# Rendered in parts, so the app can keep them alive:
# - the cord and its hooks, one picture the width of the phone and a little more
#   (lights/cord.png; it slides with the tilt like the set's other layers);
# - one bulb per colour, unlit (lights/bulb-<colour>.png): clear or tinted glass,
#   a dark filament, the cap; and the same bulb alight with its halo
#   (lights/bulb-<colour>-lit.png), in the same box, so the app lays the lit one
#   over the unlit one and breathes its opacity (each bulb twinkles on its own),
#   and swings each bulb from its cap as the phone tilts;
# - lights.json: the design's width, where each bulb hangs on the cord and in
#   which colour, and the bulb's box.
#
#   <bpy python> scripts/blender/props/home_lights.py          # everything -> assets/home/lights/
#   <bpy python> scripts/blender/props/home_lights.py cord     # or only: cord, bulbs
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import home_parts as P  # noqa: E402  (puts scripts/blender on the path)
import bpy  # noqa: E402

import export  # noqa: E402
import kit  # noqa: E402
import materials as M  # noqa: E402

DESIGN = 430                 # the phone's width the string is drawn for, points
BLEED = 20                   # and this much more each side (it slides with the tilt)
PT = 3 / 165.0               # a point in units (three art pixels to a point, 165 to a unit: the set's scale)
SWAGS = 3
SAG = 15.0                   # how far each swag droops, points
PIN = 6.0                    # the hooks, this far down the cord's picture, points
CORD_BOX = (DESIGN + 2 * BLEED, 30)          # the cord's picture, points
PITCH = 21.5                 # a bulb every this many points along the string
BULB = 11.0                  # a bulb's height from the cord to its tip, points
BULB_BOX = (34, 38)          # a bulb's picture (room for its halo), points
ATTACH = (0.5, 0.2)          # where it hangs from, as shares of that picture
# The colours: warm white, and the modes' (docs/ART_DIRECTION.md): the glass's tint unlit, its light lit.
COLOURS = {
    "warm": {"tint": (1.0, 0.90, 0.74), "haze": 0.10, "light": (1.0, 0.74, 0.40), "power": 2.4},
    "noir": {"tint": (1.0, 0.55, 0.42), "haze": 0.14, "light": (1.0, 0.42, 0.26), "power": 1.7},
    "crime": {"tint": (0.90, 0.10, 0.14), "haze": 0.14, "light": (1.0, 0.10, 0.09), "power": 1.9},
    "moonlit": {"tint": (0.35, 1.0, 0.78), "haze": 0.14, "light": (0.30, 1.0, 0.70), "power": 1.5},
}
# Which bulbs are coloured (the rest are warm white): a few, spread out, none two together.
COLOURED = {2: "moonlit", 6: "crime", 10: "noir", 14: "moonlit", 18: "crime", 21: "noir"}
DEST = "assets/home/lights"


def cord_y(x):
    """The cord's height (points down its picture) at x points from the phone's left edge."""
    span = (DESIGN + 2 * BLEED + 20) / SWAGS
    k = ((x + BLEED + 10) % span) / span
    return PIN + SAG * 4 * k * (1 - k)


def hangs():
    """Where each bulb hangs: x from the phone's left edge and y down the cord's picture (points), and its colour."""
    count = int((DESIGN + 2 * BLEED - 12) // PITCH)
    start = -BLEED + (DESIGN + 2 * BLEED - (count - 1) * PITCH) / 2
    out = []
    for i in range(count):
        x = start + i * PITCH
        out.append({"x": round(x, 2), "y": round(cord_y(x) + 0.6, 2), "colour": COLOURED.get(i, "warm")})
    return out


def shoot_cord(out):
    kit.reset()
    w, h = CORD_BOX
    kit.setup(size=(w * 3, h * 3), ss=2, samples=64)
    # x in points from the phone's left edge -> units, centred; y points down -> z.
    at = lambda x, y, depth=0.0: ((x + BLEED - w / 2) * PT, depth, (h / 2 - y) * PT)   # noqa: E731
    xs = [-BLEED - 12 + i * 2.0 for i in range(int((w + 24) / 2.0) + 1)]
    cord = P.tube([at(x, cord_y(x)) for x in xs], 0.6 * PT, "cord", segments=10)
    kit.assign(cord, M.rubber("cord", color=(0.020, 0.014, 0.022), rough=0.55, dust=0.15, scale=0.3))
    # A second, thinner strand twisted round it: a flex, not a wire.
    twist = P.tube([at(x, cord_y(x) + 0.45 * math.sin(x * 1.1), -0.5 * PT * math.cos(x * 1.1)) for x in xs], 0.42 * PT, "cord_twist", segments=8)
    kit.assign(twist, M.rubber("cord_twist", color=(0.045, 0.028, 0.040), rough=0.5, dust=0.2, scale=0.3))
    parts = [cord, twist]
    brass = M.brass("hook", age=0.5, brushed=0.3, wear=0.7, scale=0.3)
    span = (w + 20) / SWAGS
    for i in range(1, SWAGS):
        x = -BLEED - 10 + i * span
        # A cup hook screwed into the frame: a rose, a shank, the hook the cord lies in.
        rose = kit.lathe([(0, 0), (2.0 * PT, 0), (2.3 * PT, 0.5 * PT), (1.4 * PT, 1.1 * PT), (0, 1.2 * PT)], name="hook_rose", segments=32)
        rose.rotation_euler = (math.radians(90), 0, 0)
        rose.location = at(x, PIN - 3.4, 1.2 * PT)
        ring = P.tube(P.smooth_path([at(x, PIN - 3.2, 0.2 * PT), at(x - 0.4, PIN - 1.4, -0.9 * PT), at(x, PIN + 1.2, -1.2 * PT), at(x + 1.6, PIN + 1.3, -0.4 * PT),
                                     at(x + 1.9, PIN - 0.4, 0.2 * PT)], steps=6), 0.5 * PT, "hook", segments=10)
        for ob in (rose, ring):
            kit.assign(ob, brass)
        parts += [rose, ring]
    cam = kit.camera("front", target=(0, 0, 0), span=w * PT)
    kit.studio(cam, span=w * PT, target=(0, 0, 0))
    kit.outline(2.0, plain=[cord, twist])
    src = kit.render(os.path.join(out, "cord.png"))
    return export.export(src, f"{DEST}/cord.png", sizes=CORD_BOX, canvas=True, scales=(3,))


def bulb(colour, lit):
    """A fairy-light bulb hanging from z = 0: a socket and a ribbed brass cap, a small pear of glass, its filament."""
    spec = COLOURS[colour]
    k = BULB * PT / 2.0     # the model is 2 units tall; this brings it to the string's scale
    parts = []
    socket = kit.lathe([(0, 0.0), (0.16, 0.0), (0.23, -0.04), (0.25, -0.13), (0.22, -0.16), (0, -0.16)], name="socket", segments=40)
    kit.assign(socket, M.rubber("socket", color=(0.022, 0.016, 0.024), rough=0.5))
    ribs = [(0.0, -0.14)]
    for i in range(4):
        z = -0.16 - i * 0.105
        ribs += [(0.255, z), (0.285, z - 0.03), (0.255, z - 0.06)]
    ribs += [(0.24, -0.60), (0.20, -0.64), (0, -0.64)]
    cap = kit.lathe(ribs, name="cap", segments=48)
    kit.assign(cap, M.brass("cap", color=(0.80, 0.54, 0.20), age=0.1, brushed=0.2, wear=0.8, rough=0.24, scale=0.4))
    profile = [(0.19, -0.62)] + [(p.x, p.y) for p in P.smooth_path([(0.20, -0.66, 0), (0.30, -0.86, 0), (0.50, -1.22, 0), (0.56, -1.50, 0), (0.44, -1.80, 0),
                                                                    (0.22, -1.96, 0), (0.0, -2.0, 0)], steps=6)]
    glass = kit.lathe(profile, name="glass", segments=64)
    if lit:
        kit.assign(glass, M.glow("alight", spec["light"], spec["power"], falloff=0.25))
    else:
        kit.assign(glass, M.glass("bulb_glass", tint=spec["tint"], ior=1.4, haze=spec["haze"], rim=0.55, density=0.0 if colour == "warm" else 0.75))
    # The filament: a little arch on two stems.
    wire = P.tube(P.smooth_path([(-0.07, 0, -0.70), (-0.10, 0, -1.10), (-0.16, 0, -1.34), (0.0, 0, -1.48), (0.16, 0, -1.34), (0.10, 0, -1.10), (0.07, 0, -0.70)], steps=5),
                  0.022, "filament", segments=8)
    kit.assign(wire, M.glow("hot", (1.0, 0.86, 0.6), 6.0) if lit else M.steel("filament", blue=0.2, rough=0.5, wear=0.0))
    parts = [socket, cap, glass, wire]
    root = kit.group(parts, "bulb")
    root.scale = (k, k, k)
    return parts, glass, wire


def shoot_bulb(out, colour, lit):
    kit.reset()
    w, h = BULB_BOX
    kit.setup(size=(w * 3, h * 3), ss=4, samples=96, transparent_glass=not lit)
    parts, glass, wire = bulb(colour, lit)
    # The picture's middle, so the hanging point lands on ATTACH.
    cam = kit.camera("front", target=((0.5 - ATTACH[0]) * w * PT, 0, -(0.5 - ATTACH[1]) * h * PT), span=h * PT)
    middle = (0, 0, -BULB * PT * 0.62)
    kit.studio(cam, span=BULB * PT, target=middle, key=1.0, rim=1.0)
    if not lit:
        kit.window(cam, at=(0, -0.26 * BULB * PT / 2, -BULB * PT * 0.68), normal=(0, -1, 0), toward=(-0.5, 0.5), spread=24, strength=2.2, span=BULB * PT, only=[glass])
    kit.outline(2.0, exclude=[glass, wire])
    name = f"bulb-{colour}{'-lit' if lit else ''}"
    src = kit.render(os.path.join(out, name + ".png"), exr=not lit)
    im = export.load(src) if lit else export.lift_glass(src)
    if lit:
        # Its halo: wide and soft, the bulb itself kept.
        im = export.bloom(im, radius=0.085, strength=1.0, threshold=0.45, within=(0.5, (ATTACH[1] + BULB * 0.62 / h) * h / w, 0.42), inside=0.35)
    return export.export(im, f"{DEST}/{name}.png", sizes=BULB_BOX, canvas=True)


if __name__ == "__main__":
    what = sys.argv[1:] or ["cord", "bulbs"]
    out = export.scratch("home_lights")
    os.makedirs(out, exist_ok=True)
    total = 0
    if "cord" in what:
        total += shoot_cord(out)
    if "bulbs" in what:
        for colour in [c for c in what if c in COLOURS] or list(COLOURS):
            for lit in (False, True):
                total += shoot_bulb(out, colour, lit)
    meta = {"design": DESIGN, "bleed": BLEED, "cord": {"width": CORD_BOX[0], "height": CORD_BOX[1]},
            "bulb": {"width": BULB_BOX[0], "height": BULB_BOX[1], "attach": list(ATTACH), "hang": BULB}, "bulbs": hangs()}
    path = os.path.join(P.REPO, DEST, "lights.json")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    json.dump(meta, open(path, "w"), indent=1)
    print(f"{len(meta['bulbs'])} bulbs; total {total / 1024:.1f} KB (+ lights.json)")

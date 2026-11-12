# The player's flashlight: a chunky vintage brass torch (knurled grip, a slide
# switch on a brass plate, a reeded bezel round a glass lens you can see down
# into: a silvered reflector and a lit bulb), and its UV twin (blackened brass,
# a Wood's-glass lens glowing violet).
#
# It points straight up, seen from a little above ("held" view), so the game can
# turn it about its handle toward the beam (src/play2/Tools.tsx: the pivot and the
# lens centre printed at the end are fractions of the square picture).
#
#   <bpy python> scripts/blender/props/flashlight.py [outdir]     # renders + writes assets/brand/flashlight*.png
#   <bpy python> scripts/blender/props/flashlight.py --looks dir  # the three trial looks (README: "why this look")
import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import bpy  # noqa: E402

import export  # noqa: E402
import kit  # noqa: E402
import materials as M  # noqa: E402

SIZE = 88           # points in the app (Tools.TOOL); the picture is its square
ELEV = 28.0         # how far above: enough to look into the reflector
TURN = -24.0        # the torch turned on its axis so the switch sits off-centre (3/4)
PIVOT_Z = 0.30      # low on the handle: where the hand holds it, what it turns about


def build(uv=False, look="real"):
    """The torch, standing on z = 0, pointing up +Z. Returns (objects, glass, plain)."""
    toon = look == "toon"
    if uv:
        body = M.steel("blackened", color=(0.030, 0.028, 0.042), blue=1.0, rough=0.36, brushed=0.5, wear=0.32, edge=(0.72, 0.46, 0.17))
        # Black and brass: the barrel blackened, the rings left bare (so it still reads on a dark shelf).
        trim = M.brass("brass_trim", color=(0.62, 0.39, 0.14), age=0.7, brushed=0.4, wear=0.7, rough=0.27)
        slider = M.brass("slider", age=0.3, brushed=0.3)
        bulb_col, bulb_power = (0.42, 0.16, 1.0), 30.0
        lens = M.glass("woods_glass", tint=(0.62, 0.45, 1.0), haze=0.10, rim=0.5, density=1.0)
        reflector = M.lit(M.silver("reflector", color=(0.80, 0.74, 0.95), rough=0.12, tarnish=0.1), (0.36, 0.12, 1.0), 2.4, radial=(0.08, 0.40), edge=0.22)
    else:
        body = M.brass("brass", age=0.55, brushed=0.6, wear=0.6)
        trim = M.brass("brass_trim", color=(0.70, 0.45, 0.16), age=0.4, brushed=0.4, wear=0.7, rough=0.25)
        slider = M.steel("slider", blue=0.8, rough=0.3, wear=0.0)
        bulb_col, bulb_power = (1.0, 0.74, 0.40), 30.0
        lens = M.glass("lens", tint=(1.0, 0.96, 0.9), haze=0.04, rim=0.4, density=1.0)
        reflector = M.lit(M.silver("reflector", rough=0.12, tarnish=0.15), (1.0, 0.60, 0.20), 2.0, radial=(0.08, 0.40), edge=0.2)
    if toon:
        base = (0.10, 0.09, 0.13) if uv else (0.80, 0.50, 0.16)
        body = M.toon("toon_body", base)
        trim = M.toon("toon_trim", tuple(min(1, c * 1.15) for c in base))
        slider = M.toon("toon_slider", (0.80, 0.50, 0.16) if uv else (0.12, 0.13, 0.18))
        reflector = M.toon("toon_reflector", (0.75, 0.70, 0.9) if uv else (0.95, 0.84, 0.62))

    parts, plain = [], []

    def turned(name, profile, mat, **kw):
        ob = kit.lathe(profile, name=name, **kw)
        kit.assign(ob, mat)
        parts.append(ob)
        return ob

    R = 0.262  # the barrel
    # Tail cap: a domed end, a reeded band to unscrew it by, a ferrule.
    cap = turned("cap", [(0, 0.0), (0.13, 0.004), (0.215, 0.025), (0.262, 0.065), (R + 0.018, 0.10), (R + 0.018, 0.215),
                         (R + 0.006, 0.228), (R + 0.006, 0.238), (R + 0.034, 0.245), (R + 0.038, 0.262), (R + 0.034, 0.285), (R + 0.006, 0.292), (0.20, 0.292)],
                 trim, segments=144, max_len=0.02,
                 displace=lambda a, z, r: kit.flutes(36, 0.016)(a, z, r) * ((z > 0.105) & (z < 0.21)))
    kit.bevel(cap, 0.006)
    # The grip: diamond knurling.
    G = 0.98  # where the grip ends
    grip = turned("grip", [(0.20, 0.285), (R - 0.006, 0.288), (R, 0.30), (R, G), (R - 0.006, G + 0.012), (0.20, G + 0.015)], body,
                  segments=230, max_len=0.009,
                  displace=lambda a, z, r: kit.knurl(46, 0.011)(a, z, r) * ((z > 0.30) & (z < G)))
    plain.append(grip)
    # The barrel's smooth band (the switch sits here) between two ferrules, the bell of the neck, the head, the bezel.
    B = G + 0.34  # where the band ends and the neck begins
    H = B + 0.30  # the head's shoulder
    neck = [(R + (0.445 - R) * (t ** 2.2), B + (H - B) * t) for t in [i / 14 for i in range(15)]]
    head = turned("head", [(0.20, G + 0.005), (R + 0.026, G + 0.008), (R + 0.034, G + 0.022), (R + 0.034, G + 0.052), (R + 0.026, G + 0.066), (R, G + 0.072),
                           (R, B - 0.055), (R + 0.02, B - 0.047), (R + 0.026, B - 0.03), (R + 0.02, B - 0.01), (R, B)] + neck[1:] +
                  [(0.458, H + 0.01), (0.458, H + 0.075), (0.448, H + 0.083), (0.448, H + 0.097), (0.458, H + 0.105), (0.458, H + 0.235),
                   (0.448, H + 0.243), (0.448, H + 0.257), (0.482, H + 0.267)],
                  body, segments=144)
    kit.bevel(head, 0.005)
    T = H + 0.26  # the bezel's foot
    bezel = turned("bezel", [(0.42, T), (0.490, T + 0.003), (0.496, T + 0.02), (0.496, T + 0.14), (0.486, T + 0.17), (0.462, T + 0.183),
                             (0.436, T + 0.18), (0.424, T + 0.163), (0.420, T + 0.125), (0.420, T + 0.075)],
                   trim, segments=192, max_len=0.02,
                   displace=lambda a, z, r: kit.flutes(48, 0.012)(a, z, r) * ((z > T + 0.03) & (z < T + 0.135) & (r > 0.48)))
    kit.bevel(bezel, 0.004)
    # Down the throat: a silvered parabolic reflector, the bulb in its collar.
    Z0 = T - 0.20  # the reflector's floor
    bowl = [(0.075 + (0.418 - 0.075) * (i / 20), Z0 + 0.02 + 0.29 * ((i / 20) ** 1.9)) for i in range(21)]
    turned("reflector", [(0.0, Z0), (0.075, Z0)] + bowl + [(0.43, Z0 + 0.31), (0.43, Z0 - 0.04), (0.0, Z0 - 0.04)], reflector, segments=128)
    turned("collar", [(0, Z0 + 0.06), (0.062, Z0 + 0.06), (0.062, Z0), (0, Z0)], trim, segments=48)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.085, location=(0, 0, Z0 + 0.14), segments=32, ring_count=16)
    bulb = bpy.context.object
    bulb.name = "bulb"
    bulb.scale = (1, 1, 1.25)
    kit.shade(bulb)
    kit.assign(bulb, M.glow("bulb", bulb_col, bulb_power))
    parts.append(bulb)
    # The lens: a thick disc, a little domed, seated under the bezel's lip.
    L = T + 0.155
    glass = turned("lens", [(0, L), (0.20, L - 0.004), (0.35, L - 0.016), (0.418, L - 0.032), (0.422, L - 0.048), (0.418, L - 0.063), (0, L - 0.058)],
                   lens, segments=128)

    # The switch: a brass plate screwed to the barrel, a dark thumb slide, pushed up (on).
    y = -(R - 0.004)
    zc = (G + 0.072 + B - 0.055) / 2
    plate = kit.box((0.19, 0.05, 0.20), (0, y, zc), "switch_plate", bevel_width=0.026, segments=3)
    kit.assign(plate, trim)
    slot = kit.box((0.075, 0.03, 0.135), (0, y - 0.018, zc), "switch_slot", bevel_width=0.012)
    kit.assign(slot, M.rubber("slot", (0.02, 0.016, 0.02)))
    thumb = kit.box((0.115, 0.06, 0.088), (0, y - 0.036, zc + 0.024), "switch_thumb", bevel_width=0.018, segments=3)
    kit.assign(thumb, slider)
    ridges = [kit.box((0.118, 0.018, 0.014), (0, y - 0.066, zc + 0.024 + dz), "ridge", bevel_width=0.006) for dz in (-0.026, 0.0, 0.026)]
    for r_ in ridges:
        kit.assign(r_, slider)
    parts += [plate, slot, thumb] + ridges
    build.lens_z = L
    root = kit.group(parts, "flashlight")
    root.rotation_euler = (0, 0, math.radians(TURN))
    return parts, [glass, bulb], plain


def shoot(path, uv=False, look="real", line=2.0, samples=int(os.environ.get("SAMPLES", 96)), size=SIZE * 3):
    kit.reset()
    kit.setup(size=(size, size), samples=samples, look=os.environ.get("LOOK", "standard"))
    parts, glassy, plain = build(uv, look)
    cam = kit.camera("held", elev=ELEV)
    # Fixed framing (both twins register): the torch centred, filling the square's height.
    kit.fit(cam, parts, margin=1.07)
    kit.studio(cam, span=2.1, target=(0, 0, 0.95))
    if look != "bare":
        kit.outline(line * (1.6 if look == "toon" else 1.0), exclude=glassy, plain=plain)
    kit.render(path)
    return {"pivot": kit.project(cam, (0, 0, PIVOT_Z)), "lens": kit.project(cam, (0, 0, build.lens_z)), "tail": kit.project(cam, (0, 0, 0))}


if __name__ == "__main__":
    args = sys.argv[1:]
    if args and args[0] == "--looks":
        out = args[1]
        for look in ("toon", "real", "bare"):
            print(look, shoot(os.path.join(out, f"flashlight_{look}.png"), look=look))
    else:
        out = args[0] if args else export.scratch("flashlight")
        total = 0
        for name, uv in (("flashlight", False), ("flashlight-uv", True)):
            src = os.path.join(out, name + ".png")
            anchors = shoot(src, uv=uv)
            print(name, {k: (round(x, 3), round(y, 3)) for k, (x, y) in anchors.items()})
            # It's on: the lens's light spills a little past the bezel.
            lx, ly = anchors["lens"]
            lit = export.bloom(export.load(src), radius=0.02, strength=0.5, threshold=0.75, within=(lx, ly + 0.01, 0.2))
            lit.save(os.path.join(out, name + "_lit.png"))
            total += export.export(lit, f"assets/brand/{name}.png", sizes=(SIZE, SIZE), canvas=True)
        print(f"total {total / 1024:.1f} KB")

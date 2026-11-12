# The lamp (src/play2/mechanisms/Light.tsx): a pleated cloth shade trimmed in brass on a turned
# brass stem and foot. Rendered cold in each mode's cloth, and alight (the app fades the lit
# picture in over the cold one): the cloth lets the bulb's light through, so the shade glows
# from inside and the brass under it catches it. The ultraviolet lamp's light is its own violet.
# Its pull chain and fob are separate sprites the app slides.
#
#   <bpy python> scripts/blender/props/mech_lamp.py        # all; ONLY=lamp-noir,lamp-uv for some
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
from mech_common import M, SAMPLES, THREADS, Stage, export, kit, save, scratch, totals, wanted  # noqa: E402
from mech_drawer import brass  # noqa: E402
from mech_lift import DYES  # noqa: E402

BOX = (170, 172)   # Light.tsx LAMP.w, LAMP.h
# The light each lit lamp gives (tokens.ts modeThemes[genre].glow; Light.tsx UV), linear.
LIGHTS = {"noir": (1.0, 0.69, 0.39), "crime": (1.0, 0.76, 0.37), "paranormal": (0.35, 0.89, 0.69), "uv": (0.26, 0.15, 1.0)}


def cloth(color, light=None):
    """A lampshade's cloth: matte outside, and it lets light through from inside (warmed toward the
    light's own colour, so a wine shade glows amber-red, not pink)."""
    t = M.Tree("shade")
    weave = t.noise(t.coords((60, 60, 8)), scale=1.0, detail=3, rough=0.7)
    col = t.mix(t.math("MULTIPLY", weave, 0.3), color, M._dim(color, 0.7))
    d = t.principled(**{"Base Color": col, "Roughness": 0.9, "Specular IOR Level": 0.1, "Sheen Weight": 0.6, "Sheen Roughness": 0.5,
                        "Sheen Tint": tuple(min(1, c * 2.5 + 0.2) for c in color), "Normal": t.bump(weave, strength=0.3, distance=0.004)})
    tr = t.node("ShaderNodeBsdfTranslucent")
    lc = light or (0.3, 0.3, 0.3)
    t.set(tr.inputs["Color"], tuple(min(1.0, c * 1.3 + 0.42 * k) for c, k in zip(color, lc)))
    m = t.node("ShaderNodeMixShader")
    m.inputs[0].default_value = 0.55
    t.link(d.outputs[0], m.inputs[1])
    t.link(tr.outputs[0], m.inputs[2])
    return t.surface(m)


def lamp(name, dye, light=None):
    kit.reset()
    kit.setup(size=(BOX[0] * 3, BOX[1] * 3), ss=1, samples=max(SAMPLES, 96) if light else SAMPLES, threads=THREADS)
    metal = brass("lamp", age=0.45, brushed=0.5, wear=0.7)
    parts = []

    def turned(prof, nm, mat=metal, **kw):
        ob = kit.lathe(prof, name=nm, **kw)
        kit.assign(ob, mat)
        parts.append(ob)
        return ob

    turned([(0, 0), (0.50, 0), (0.555, 0.02), (0.565, 0.055), (0.53, 0.085), (0.40, 0.105), (0.33, 0.125), (0.315, 0.16), (0.24, 0.185), (0.12, 0.215), (0.085, 0.26),
            (0.060, 0.30), (0.060, 0.40), (0.085, 0.425), (0.125, 0.47), (0.125, 0.50), (0.085, 0.545), (0.060, 0.57), (0.060, 0.70), (0.085, 0.725), (0.115, 0.76),
            (0.115, 0.785), (0.085, 0.82), (0.060, 0.845), (0.060, 0.95), (0.10, 0.97), (0.10, 1.12), (0, 1.12)], "stem", segments=96)
    kit.bevel(parts[-1], 0.006)
    # The shade: a pleated drum, wider below, bound in brass at both rims.
    z0, z1, r0, r1 = 0.98, 1.84, 0.80, 0.37
    shade = kit.lathe([(r0, z0), (r1, z1)], name="shade", segments=360, max_len=0.03,
                      displace=lambda a, z, r: -0.034 * r * (0.5 - 0.5 * __import__("numpy").cos(a * 30)) ** 0.8)
    so = shade.modifiers.new("solid", "SOLIDIFY")
    so.thickness, so.offset = 0.012, 0
    kit.assign(shade, cloth(dye, light))
    parts.append(shade)
    for rr, zz in ((r0 - 0.005, z0), (r1 - 0.002, z1)):
        turned([(rr - 0.022, zz - 0.012), (rr + 0.012, zz - 0.02), (rr + 0.022, zz), (rr + 0.012, zz + 0.02), (rr - 0.022, zz + 0.012)], "rim", segments=128)
    # The spider that holds the shade, and the bulb.
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.115, location=(0, 0, 1.25), segments=32, ring_count=16)
    bulb = bpy.context.object
    bulb.scale = (1, 1, 1.25)
    kit.shade(bulb)
    kit.assign(bulb, M.glow("bulb", light, 85.0) if light else M.glass("bulb", tint=(0.9, 0.88, 0.84), haze=0.5))
    parts.append(bulb)
    cam = kit.camera("held", elev=9)
    kit.fit(cam, parts, margin=1.035)
    kit.studio(cam, span=2.0, target=(0, 0, 0.95), key=0.55 if light else 1.0, fill=0.7 if light else 1.0)
    kit.outline(3.0, exclude=[bulb], plain=[shade])
    save(export.load(kit.render(scratch(name))), name, BOX)
    px = lambda p: tuple(round(v * s, 1) for v, s in zip(kit.project(cam, p), BOX))  # noqa: E731
    cx = 0.36
    print(f"  {name}: chain leaves the shade at {px((cx, -math.sqrt(r0 * r0 - cx * cx), z0))}, shade bottom {px((0, -r0, z0))}, top {px((0, 0, z1))}, foot {px((0, 0, 0))}")


def chain():
    st = Stage(8, 88, ss=2)   # Light.tsx: CHAIN + PULL long, a bead every 5 points
    mat = brass("bead", age=0.3, brushed=0.1, wear=0.3)
    link = st.rod([(4, -2, 0), (4, 44, 0), (4, 90, 0)], 0.45, "link")
    kit.assign(link, brass("link", age=0.7))
    st.no_ink.append(link)
    for i in range(18):
        b = st.ball(4, 2.5 + i * 5, 0, 1.9)
        kit.assign(b, mat)
    st.light()
    st.ink(1.6)
    st.shoot("lamp-chain")


def fob():
    st = Stage(18, 26, ss=2)
    prof = [(0, 0), (3.2, 0.3), (5.6, 2.2), (7.0, 5.6), (7.2, 9.4), (6.2, 13.2), (4.2, 16.6), (2.4, 18.8), (1.9, 20.2), (2.4, 21.2), (1.8, 22.6), (0, 23.0)]
    ob = kit.lathe([(a / st.u, b / st.u) for a, b in prof], name="fob", segments=64)
    ob.location = st.at(9, 24.6)
    kit.bevel(ob, 0.3 / st.u)
    kit.assign(ob, brass("fob", age=0.35, brushed=0.4))
    st.light()
    st.ink(2)
    st.shoot("lamp-fob")


if __name__ == "__main__":
    jobs = [("lamp-chain", chain), ("lamp-fob", fob)]
    for mode in DYES:
        jobs.append((f"lamp-{mode}", lambda m=mode: lamp(f"lamp-{m}", DYES[m])))
        jobs.append((f"lamp-{mode}-lit", lambda m=mode: lamp(f"lamp-{m}-lit", DYES[m], LIGHTS[m])))
    jobs.append(("lamp-uv-lit", lambda: lamp("lamp-uv-lit", DYES["paranormal"], LIGHTS["uv"])))
    for name, fn in jobs:
        if wanted(name):
            fn()
    print("lamp:", totals())

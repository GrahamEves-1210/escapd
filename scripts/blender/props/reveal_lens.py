# The red lens of the printed card (src/play2/tools/LensSheet.tsx): a round red gel in a fat
# brass ring with a ring-pull, lying flat, seen from above. The gel is see-through: the game
# draws the card under it (through its own red filter) and this picture over that, so the gel
# here is only the glass itself: a thin red body that deepens toward its edge, the window's
# highlight, a glint. The game puts the gel's centre (GEL, printed at the end) where the lens is.
#
#   <bpy python> scripts/blender/props/reveal_lens.py [outdir]   # writes assets/reveal/lens*.png, prints GEL
import numpy as np
from PIL import Image

from reveal_common import *  # noqa: F401,F403

PT = 62.0              # points per unit
W, H = 152, 152        # the picture, in points
R = 56.0 / PT          # the gel's radius (LensSheet.R)
RING = 9.5 / PT        # the brass ring's width (LensSheet.RING)
PULL = (56.0 + 9.0 + 11.0) / PT   # the ring-pull's centre from the gel's, down to the right


def red_gel(body=0.0, rim=0.55):
    """Red glass on transparent film: mostly clear, a red body that thickens to the edge, a glossy face."""
    t = M.Tree("red_gel")
    tc = t.node("ShaderNodeTexCoord")
    flat = t.node("ShaderNodeVectorMath", operation="MULTIPLY")
    flat.inputs[1].default_value = (1, 1, 0)
    t.link(tc.outputs["Object"], flat.inputs[0])
    ln = t.node("ShaderNodeVectorMath", operation="LENGTH")
    t.link(flat.outputs[0], ln.inputs[0])
    edge = t.math("POWER", t.math("DIVIDE", ln.outputs["Value"], R, clamp=True), 4.0)   # 0 in the middle .. 1 at the ring
    amount = t.math("ADD", body, t.math("MULTIPLY", edge, rim - body), clamp=True)
    col = t.mix(edge, (0.30, 0.008, 0.008), (0.10, 0.002, 0.004))
    red = t.principled(**{"Base Color": col, "Roughness": 0.4, "Specular IOR Level": 0.2})
    clear = t.node("ShaderNodeBsdfTransparent")
    m = t.node("ShaderNodeMixShader")
    t.set(m.inputs[0], amount)
    t.link(clear.outputs[0], m.inputs[1])
    t.link(red.outputs[0], m.inputs[2])
    # The face's reflections at full strength whatever the body's (glass shines however thin its colour).
    gloss = t.node("ShaderNodeBsdfGlossy")
    gloss.inputs["Roughness"].default_value = 0.05
    t.set(gloss.inputs["Color"], (0.075, 0.068, 0.068))
    add = t.node("ShaderNodeAddShader")
    t.link(m.outputs[0], add.inputs[0])
    t.link(gloss.outputs[0], add.inputs[1])
    return t.surface(add)


def build():
    brass = M.brass("brass", age=0.5, brushed=0.55, wear=0.7)
    trim = M.brass("brass_trim", color=(0.70, 0.45, 0.16), age=0.35, brushed=0.3, wear=0.8, rough=0.24)
    parts = []
    # The ring: a fat bezel, a bead round its outside, a step down to the gel.
    r0, r1 = R - 0.012, R + RING
    # (Its outside is a true round: seen straight on, a flat wall there would have no one silhouette for the ink line.)
    outside = [(r1 - 0.045 + 0.045 * math.cos(a), 0.045 + 0.045 * math.sin(a)) for a in [math.radians(d) for d in range(75, -91, -15)]]
    ring = kit.lathe([(r0, 0.0), (r0, 0.075), (r0 + 0.02, 0.10), (r0 + 0.06, 0.112), (r1 - 0.075, 0.112), (r1 - 0.06, 0.10), (r1 - 0.056, 0.084)] + outside,
                     segments=160, name="ring")
    kit.bevel(ring, 0.005, angle=40)
    kit.assign(ring, brass)
    parts.append(ring)
    # The gel: a cabochon, nearly flat across the middle, its shoulder rolling down to the ring: the shoulder
    # is what catches the window (a bright arc upper left) and the rim light (a glint lower right).
    n = 40
    flat, top, low = 0.70, 0.118, 0.022

    def face(u):  # height at u = r / R
        if u <= flat:
            return top - 0.012 * (u / flat) ** 2
        v = (u - flat) / (1 - flat)
        return top - 0.012 - (top - 0.012 - low) * v ** 2.2

    gel = kit.lathe([(0, top)] + [(R * i / n, face(i / n)) for i in range(1, n + 1)] + [(R, 0.012), (0, 0.012)], segments=128, name="gel")
    kit.assign(gel, red_gel())
    parts.append(gel)
    # The pull: a lug on the ring, a loop of brass wire through it.
    a = math.radians(-45)
    ux, uy = math.cos(a), math.sin(a)
    lug = kit.lathe([(0, 0.0), (0.075, 0.0), (0.085, 0.02), (0.085, 0.06), (0.07, 0.085), (0.03, 0.095), (0, 0.096)], segments=40, name="lug")
    lug.location = ((r1 + 0.012) * ux, (r1 + 0.012) * uy, 0.0)
    kit.assign(lug, trim)
    bpy.ops.mesh.primitive_torus_add(major_radius=10.0 / PT, minor_radius=2.9 / PT, major_segments=64, minor_segments=20,
                                     location=(PULL * ux, PULL * uy, 0.05))
    loop = bpy.context.object
    loop.name = "pull"
    loop.rotation_euler = (math.radians(14), math.radians(-10), 0)  # it lies a little askew, one side on the lug
    kit.shade(loop)
    kit.assign(loop, trim)
    parts += [lug, loop]
    lay_flat(parts, "lens")
    return parts, gel


def shoot(path):
    scene(W, H, samples=max(SAMPLES, 128), glass=True)
    parts, gel = build()
    off = 3.0 / PT  # the pull hangs off to the lower right: the gel sits a little up and left of the picture's centre
    cam = flat_camera(W, H, PT, centre=(off, -off))
    kit.studio(cam, span=2.3, target=(0, 0, 0))
    kit.outline(3.0, exclude=[gel])
    kit.render(path, exr=True)
    im = export.lift_glass(path)
    # What is left of the film in the gel's clear middle is noise: nothing there.
    a = np.asarray(im).copy()
    a[a[..., 3] < 10] = 0
    return Image.fromarray(a, "RGBA"), anchor(cam, (0, 0, 0), W, H)


if __name__ == "__main__":
    out = out_dir()
    im, gel = shoot(os.path.join(out, "lens.png"))
    im.save(os.path.join(out, "lens_lifted.png"))
    print("lens  GEL =", gel, " size =", (W, H), " gel radius =", round(R * PT, 1), "pt")
    # A palette at error <= 10 (a faint dither in the gel's haze, checked on red, on paper and on the dark) is a third the bytes.
    total = ship(im, "assets/reveal/lens.png", (W, H), errors=(10.0, 14.0, 20.0))
    print(f"total {total / 1024:.1f} KB")

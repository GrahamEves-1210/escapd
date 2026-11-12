# Shared by the gadgets' sprites (props/gadget_*.py -> assets/gadgets): the close-up
# mechanisms' stage (mech_common.Stage: the app's own box in points, framed exactly), plus two
# things a part the app TURNS needs:
#   front_light(st)   lit square on and evenly (as the radio's knob is), so its light doesn't
#                     swing round with it;
#   light_layer(...)  the studio's light on that part as its own still picture: warm where the
#                     key falls, plum where it doesn't, clear elsewhere. The app lays it over
#                     the turning part and leaves it still, so the brass turns under a fixed light.
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mech_common as mc  # noqa: E402
from mech_common import M, Stage, circle, cut, kit, rounded_rect, to_mesh, totals, wanted  # noqa: E402,F401
import bpy  # noqa: E402
import numpy as np  # noqa: E402
from PIL import Image, ImageFilter  # noqa: E402

import export  # noqa: E402

mc.OUT = "assets/gadgets"
FONT = os.path.join(export.REPO, "node_modules/@expo-google-fonts/playfair-display/700Bold/PlayfairDisplay_700Bold.ttf")


def brass(name="brass", **kw):
    return M.brass(name, **{"age": 0.5, "brushed": 0.35, "wear": 0.7, **kw})


def iron(name="iron", **kw):
    """Japanned iron (the padlock's): black lacquer gone a little dull, bare metal on its edges."""
    return M.steel(name, **{"color": (0.030, 0.027, 0.036), "blue": 1.0, "rough": 0.42, "brushed": 0.15, "wear": 0.6, "edge": (0.34, 0.30, 0.30), **kw})


def bakelite(name="bakelite", color=(0.030, 0.019, 0.017), **kw):
    """Bakelite: near-black with a brown heart, a soft polish."""
    return M.enamel(name, color, **{"gloss": 0.55, **kw})


def front_light(st, ambient=0.8, strength=1.0):
    kit.studio(st.cam, span=2.0, target=(0, 0, 0), key=0.0, rim=0.0, fill=0.0, ambient=ambient)
    for s, e, col in ((5.0, 30.0 * strength, kit.WARM), (1.2, 45.0 * strength, (1.0, 0.95, 0.9))):
        data = bpy.data.lights.new("front", "AREA")
        data.shape, data.size, data.energy, data.color = "DISK", s, e, col
        lamp = bpy.data.objects.new("front", data)
        bpy.context.scene.collection.objects.link(lamp)
        lamp.location = (0, -5.0, 0)
        lamp.rotation_euler = (math.radians(90), 0, 0)


def grey_metal(name="shade", rough=0.34):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (0.5, 0.5, 0.5, 1)
    b.inputs["Metallic"].default_value = 1.0
    b.inputs["Roughness"].default_value = rough
    return m


def text(st, body, x, y, d, size, turn=0.0, depth=0.3, name="numeral", font=FONT):
    """Lettering lying on the surface at (x, y), `d` proud, its top turned `turn` degrees clockwise."""
    cu = bpy.data.curves.new(name, "FONT")
    cu.body = body
    cu.font = bpy.data.fonts.load(font, check_existing=True)
    cu.size = size / st.u
    cu.align_x, cu.align_y = "CENTER", "CENTER"
    cu.extrude = depth / st.u / 2
    cu.resolution_u = 6
    ob = bpy.data.objects.new(name, cu)
    bpy.context.scene.collection.objects.link(ob)
    ob.location = st.at(x, y, d)
    ob.rotation_euler = (math.radians(90), math.radians(turn), 0)
    return to_mesh(ob)


def light_layer(st, name, warm=(255, 236, 196), cool=(30, 16, 28), gain=(0.85, 0.7), blur=1.2, scales=(1, 2, 3)):
    """Render the stage (grey metal parts under the house studio) and keep only its light: brighter
    than its middle grey becomes warm white, darker becomes plum, each as alpha."""
    src = mc.scratch(name)
    kit.render(src)
    im = export.load(src).convert("RGBA")
    im = im.filter(ImageFilter.GaussianBlur(blur * im.width / st.w))
    a = np.asarray(im).astype(np.float32) / 255.0
    lum = a[..., 0] * 0.3 + a[..., 1] * 0.6 + a[..., 2] * 0.1
    solid = a[..., 3] > 0.5
    mid = float(np.median(lum[solid]))
    up = np.clip((lum - mid) / max(1e-3, 1 - mid), 0, 1) * gain[0]
    down = np.clip((mid - lum) / max(1e-3, mid), 0, 1) * gain[1]
    out = np.zeros_like(a)
    lit = up >= down
    for i in range(3):
        out[..., i] = np.where(lit, warm[i], cool[i]) / 255.0
    out[..., 3] = np.where(lit, up, down) * a[..., 3]
    res = Image.fromarray((out * 255).astype(np.uint8), "RGBA")
    return mc.save(res, name, (st.w, st.h), scales)


def at_2x(st, weight):
    """A big backdrop the app never shows at 3x (it would be over the budget, and it is slow): render it at
    2x, the ink line (pixels at 3x) thinned to match. Call it last before shoot(..., scales=(1, 2))."""
    st.ink(weight * 2 / 3)
    bpy.context.scene.render.resolution_percentage = 67

# The wireless (src/play2/mechanisms/TuningDial.tsx): a walnut cabinet with a brass-rimmed
# window for the dial (clear: the app's lit band and needle show through), a speaker grille
# (clear between its brass bars: the app's cloth, in the mode's colour, lies behind), the
# brass plate the frequency is engraved on, and the collar of the tuning knob. The knob's cap
# is its own sprite, turned by the app: it is lit square on (from the camera's side, evenly),
# not by the studio's key, so its light doesn't swing round as it turns.
#
#   <bpy python> scripts/blender/props/mech_radio.py        # both; ONLY=radio-knob for one
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
from mech_common import M, Stage, circle, kit, rounded_rect, totals, wanted  # noqa: E402
from mech_drawer import WALNUT, brass  # noqa: E402

W, H, PAD = 340, 196, 14                     # TuningDial: the panel (at most), CABINET.h, CABINET.pad
DIAL = (PAD, PAD, W - 2 * PAD, 76)           # Scale's window
GRILLE = (PAD, 104, 152, 78)                 # the speaker
PLATE = (174, 121, 82, 44)                   # the frequency's plate
KNOB = (295, 143, 31)                        # the knob's centre and half its box (CABINET.knob / 2)


def cabinet():
    st = Stage(W, H)
    gx, gy, gw, gh = GRILLE
    dx, dy, dw, dh = DIAL
    body = st.extrude(rounded_rect(1.2, 1.2, W - 2.4, H - 2.4, 16, 12), d=12, back=0, bevel=2.4, name="cabinet", segments=4,
                      holes=[rounded_rect(dx - 1, dy - 1, dw + 2, dh + 2, 11, 6), rounded_rect(gx, gy, gw, gh, 9, 6)])
    kit.assign(body, M.walnut("cabinet", axis="X", color=WALNUT, figure=0.75, gloss=0.6))
    b = brass("trim", age=0.4, brushed=0.4)
    # The dial's rim: proud of the wood, lapping the window's edge.
    rim = st.ring(rounded_rect(dx - 4.5, dy - 4.5, dw + 9, dh + 9, 14, 8), rounded_rect(dx + 1.2, dy + 1.2, dw - 2.4, dh - 2.4, 9, 8), d=14.5, back=6, bevel=1.3, name="rim")
    kit.assign(rim, b)
    # The grille: a rim and three bars across the cloth.
    grim = st.ring(rounded_rect(gx - 3, gy - 3, gw + 6, gh + 6, 11.5, 8), rounded_rect(gx + 1.5, gy + 1.5, gw - 3, gh - 3, 7.5, 8), d=13.6, back=6, bevel=1.0, name="grille_rim")
    kit.assign(grim, b)
    for f in (0.26, 0.5, 0.74):
        bar = st.rod([(gx + 1, gy + gh * f, 10.5), (gx + gw / 2, gy + gh * f, 10.5), (gx + gw - 1, gy + gh * f, 10.5)], 2.9, "bar")
        kit.assign(bar, brass("bar", age=0.4, brushed=0.6, axis="X"))
    # The frequency's plate, a pin at each end.
    px, py, pw, ph = PLATE
    plate = st.slab(px, py, pw, ph, d=13.6, back=10, r=5, bevel=0.9, name="plate")
    kit.assign(plate, brass("plate", color=(0.74, 0.52, 0.22), age=0.25, brushed=0.7, wear=0.4, axis="X", rough=0.42))
    for x in (px + 5, px + pw - 5):
        st.no_ink.append(st.screw(x, py + ph / 2, 13.6, r=1.5, turn=x * 7))
    # The knob's collar on the wood (its cap is the sprite).
    kx, ky, kr = KNOB
    collar = st.turned([(kr - 14, 2.6), (kr - 4.5, 2.6), (kr - 2.6, 1.8), (kr - 2.0, 0)], kx, ky, 12, "collar", segments=96)
    kit.assign(collar, b)
    st.light()
    st.ink(4)
    st.shoot("radio-cabinet")


def knob():
    S = 62
    st = Stage(S, S, ss=2)
    c, rr = S / 2, S / 2 - 6
    import numpy as np
    body = st.turned([(rr, 0), (rr, 7.0), (rr - 1.4, 8.6), (rr - 4.6, 9.4), (rr - 5.4, 9.0), (rr - 6.0, 9.6), (rr - 10, 10.6), (6, 11.4), (0, 11.5)], c, c, 0, "knob", segments=288, max_len=0.6 / st.u,
                     displace=lambda a, z, r: -(0.9 / st.u) * (0.5 - 0.5 * np.cos(a * 36)) ** 2 * ((r > (rr - 1.0) / st.u)))
    kit.assign(body, M.rubber("bakelite", (0.050, 0.030, 0.024), rough=0.38, dust=0.15))
    st.plain.append(body)
    ring = st.ring(circle(c, c, rr - 5.6, 64), circle(c, c, rr - 7.0, 64), d=9.9, back=8.6, bevel=0.3, name="ring")
    kit.assign(ring, brass("ring", age=0.3, brushed=0.2))
    st.no_ink.append(ring)
    # The pointer: a brass line from the rim toward the middle (pointing up at rest).
    mark = st.slab(c - 1.3, c - rr + 8, 2.6, rr - 13, d=11.6, back=10, r=1.3, bevel=0.3, name="pointer")
    kit.assign(mark, M.enamel("pointer", (0.80, 0.66, 0.40), gloss=0.2))
    st.no_ink.append(mark)
    # Lit square on, evenly: the cap turns under the app's hand, and its light must not turn with it.
    kit.studio(st.cam, span=2.0, target=(0, 0, 0), key=0.0, rim=0.0, fill=0.0, ambient=0.8)
    for s, e, col in ((5.0, 30.0, kit.WARM), (1.2, 45.0, (1.0, 0.95, 0.9))):
        data = bpy.data.lights.new("front", "AREA")
        data.shape, data.size, data.energy, data.color = "DISK", s, e, col
        lamp = bpy.data.objects.new("front", data)
        bpy.context.scene.collection.objects.link(lamp)
        lamp.location = (0, -5.0, 0)
        lamp.rotation_euler = (math.radians(90), 0, 0)
    st.ink(2)
    st.shoot("radio-knob")


if __name__ == "__main__":
    for name, fn in (("radio-knob", knob), ("radio-cabinet", cabinet)):
        if wanted(name):
            fn()
    print("radio:", totals())

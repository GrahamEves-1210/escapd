# The camera's controls (src/capture/ui/rangefinder/*), each a brass fitting on the leather back,
# modelled in the app's points so the picture drops onto its control (sizes: look.ts CHROME):
#   shutter, shutter-down   the release: a reeded brass button with a black face in its collar,
#                           standing proud and pressed home (the collar's shadow falls across it)
#   lever                   the film-advance lever round the release: a hub ring and its arm,
#                           pointing right; the app swings it about the picture's centre
#   counter                 the frame counter's window: a brass bezel round the app's numerals
#   lens-track, lens-thumb  the lens selector: a brass-rimmed slot and the cursor that slides in it
#   button-square, button-round   black push buttons in brass rims (back / library, flash / grid)
#
#   <bpy python> scripts/blender/props/camera_controls.py        # ONLY=shutter,lever for some
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from camera_common import M, Stage, brass, clear, enamel, kit, mask, rounded_rect, shoot, sweep, totals, wanted  # noqa: E402
import numpy as np  # noqa: E402
from PIL import Image, ImageFilter  # noqa: E402

SHUTTER = 84            # the picture; the app's 75 box sits in its middle
LEVER = 150             # the lever's picture, the release's centre in its middle
COUNTER = (73, 52.5, 9, 8)       # the window (w, h, r) and the picture's margin round it
TRACK = (100, 40, 16, 6)
THUMB = (45, 32, 11, 3)
SQUARE = (44, 12, 4)
ROUND = (40, 4)


def recess(st, x, y, w, h, r, depth=3.0, strength=0.55):
    """post: wipe the opening, then lay the frame's own shadow just inside its upper left (the
    key's side), so the window reads as set back behind the brass."""
    def post(im):
        im = clear(st, im, x + 0.35, y + 0.35, w - 0.7, h - 0.7, max(0, r - 0.35))
        k = im.width / st.w
        inside = mask(st, im, x, y, w, h, r)
        moved = np.roll(np.roll(inside, round(depth * 0.8 * k), axis=1), round(depth * k), axis=0)
        soft = np.asarray(Image.fromarray((moved * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(depth * 0.55 * k))).astype(np.float32) / 255.0
        shade = inside * (1 - soft) * strength
        a = np.asarray(im).astype(np.float32) / 255.0
        ink = np.array([0.055, 0.03, 0.065], np.float32)
        out = a.copy()
        # Under what is there (the frame and its line), over nothing.
        alpha = a[..., 3] + shade * (1 - a[..., 3])
        for i in range(3):
            out[..., i] = np.where(alpha > 0, (a[..., i] * a[..., 3] + ink[i] * shade * (1 - a[..., 3])) / np.maximum(alpha, 1e-6), 0)
        out[..., 3] = alpha
        return Image.fromarray((out * 255).clip(0, 255).astype(np.uint8), "RGBA")
    return post


def shutter(down):
    st = Stage(SHUTTER, SHUTTER)
    c = SHUTTER / 2
    b = brass("release", age=0.4, brushed=0.45, wear=0.8)
    collar = st.turned([(34.4, 0), (34.7, 5.2), (35.4, 6.0), (36.7, 6.0), (37.4, 5.2), (37.5, 0)], c, c, 0, "collar", segments=160)
    kit.assign(collar, b)
    z = -2.2 if down else 3.6
    u = st.u
    reed = lambda a, zz, r: -(0.55 / u) * (0.5 - 0.5 * np.cos(a * 60)) ** 2 * ((r > 27.6 / u) & (r < 33.6 / u))  # noqa: E731
    rim = st.turned([(33.8, 0), (33.8, 2.6), (33.0, 3.6), (28.0, 5.6), (27.2, 5.6), (26.4, 4.6), (26.0, 0)], c, c, z, "rim", segments=360, max_len=0.5 / u, displace=reed)
    kit.assign(rim, b)
    st.plain.append(rim)
    face = st.turned([(26.6, 0), (26.6, 4.4), (25.2, 5.6), (18, 6.7), (9, 7.3), (0, 7.5)], c, c, z, "face", segments=128)
    kit.assign(face, enamel("face", gloss=0.8, chips=0.0))
    st.light(shadow=0.0, reach=3.0)
    st.ink(2)
    shoot(st, "shutter-down" if down else "shutter")


def lever():
    st = Stage(LEVER, LEVER)
    c = LEVER / 2
    b = brass("lever", age=0.45, brushed=0.5, wear=0.8)
    hub = st.turned([(38.0, 0), (38.3, 3.0), (39.2, 3.8), (42.6, 3.8), (43.6, 2.9), (44.0, 0)], c, c, 0, "hub", segments=192)
    kit.assign(hub, b)
    # The arm wraps the hub from its upper right round to a thumb rest standing out on the right:
    # a band that leaves the hub, widens and ends in the rest (angles clockwise from pointing right).
    a0, a1, n = -82.0, 12.0, 40
    inner, outer = [], []
    for i in range(n + 1):
        t = i / n
        a = math.radians(a0 + (a1 - a0) * t)
        ri = 43.0
        ro = 46.5 + 8.0 * t ** 0.8                      # widening toward the rest
        inner.append((c + ri * math.cos(a), c + ri * math.sin(a)))
        outer.append((c + ro * math.cos(a), c + ro * math.sin(a)))
    arm = st.extrude(outer + inner[::-1], d=5.6, back=0.5, bevel=1.2, name="arm")
    kit.assign(arm, b)
    # The thumb rest: a domed brass knob standing out past the arm's end.
    ae = math.radians(a1 - 5.0)
    px, py = c + 60.5 * math.cos(ae), c + 60.5 * math.sin(ae)
    pad = st.turned([(0, 5.6), (3.4, 5.3), (6.6, 4.0), (8.6, 1.8), (9.0, 0)], px, py, 3.0, "pad", segments=64)
    kit.assign(pad, brass("pad", age=0.3, brushed=0.2, wear=0.9))
    st.light(shadow=0.0, reach=3.0)
    st.ink(3)
    shoot(st, "lever")


def counter():
    w, h, r, m = COUNTER
    st = Stage(w + 2 * m, h + 2 * m)
    bezel = sweep(st, m, m, w, h, r, [(0, 0.5), (1.2, 3.6), (2.0, 4.4), (5.0, 4.4), (5.9, 3.5), (6.2, 0)], "bezel")
    kit.assign(bezel, brass("bezel", age=0.4, brushed=0.4, wear=0.8))
    st.light(shadow=0.0, reach=2.5)
    st.ink(2)
    shoot(st, "counter", recess(st, m, m, w, h, r, depth=3.2))


def lens_track():
    w, h, r, m = TRACK
    st = Stage(w + 2 * m, h + 2 * m)
    rim = sweep(st, m, m, w, h, r, [(0, 0.5), (1.0, 3.0), (1.7, 3.6), (3.6, 3.6), (4.4, 2.8), (4.7, 0)], "rim")
    kit.assign(rim, brass("rim", age=0.45, brushed=0.4, wear=0.8))
    st.light(shadow=0.0, reach=2.5)
    st.ink(3)
    shoot(st, "lens-track", recess(st, m, m, w, h, r, depth=2.6))


def lens_thumb():
    w, h, r, m = THUMB
    st = Stage(w + 2 * m, h + 2 * m)
    t = 3.0
    plate = st.slab(m + t - 0.5, m + t - 0.5, w - 2 * t + 1, h - 2 * t + 1, d=2.4, r=r - t + 0.5, bevel=0, name="plate")
    kit.assign(plate, enamel("plate", chips=0.0, gloss=0.5))
    st.no_ink.append(plate)
    rim = sweep(st, m + t, m + t, w - 2 * t, h - 2 * t, r - t, [(0, 2.2), (0.7, 3.6), (2.2, 3.6), (2.8, 2.8), (3.0, 0)], "cursor")
    kit.assign(rim, brass("cursor", age=0.3, brushed=0.3, wear=0.9))
    st.light(shadow=0.0, reach=2.0)
    st.ink(2)
    shoot(st, "lens-thumb")


def button_square():
    s, r, m = SQUARE
    st = Stage(s + 2 * m, s + 2 * m)
    t = 2.6
    cap = st.slab(m + t - 0.4, m + t - 0.4, s - 2 * t + 0.8, s - 2 * t + 0.8, d=3.0, r=r - t + 0.4, bevel=0.9, name="cap")
    kit.assign(cap, enamel("cap", chips=0.0, gloss=0.55))
    rim = sweep(st, m + t, m + t, s - 2 * t, s - 2 * t, r - t, [(0, 2.0), (0.6, 3.5), (1.9, 3.5), (2.5, 2.6), (2.6, 0)], "rim")
    kit.assign(rim, brass("rim", age=0.4, brushed=0.3, wear=0.9))
    st.light(shadow=0.0, reach=2.0)
    st.ink(2)
    shoot(st, "button-square")


def button_round():
    d, m = ROUND
    st = Stage(d + 2 * m, d + 2 * m)
    c = d / 2 + m
    cap = st.turned([(17.3, 0), (17.3, 2.2), (16.4, 3.0), (10, 3.5), (0, 3.7)], c, c, 0, "cap", segments=96)
    kit.assign(cap, enamel("cap", chips=0.0, gloss=0.55))
    rim = st.turned([(17.0, 0), (17.2, 3.0), (17.8, 3.6), (19.0, 3.6), (19.8, 2.8), (20.0, 0)], c, c, 0, "rim", segments=128)
    kit.assign(rim, brass("rim", age=0.4, brushed=0.3, wear=0.9))
    st.light(shadow=0.0, reach=2.0)
    st.ink(2)
    shoot(st, "button-round")


if __name__ == "__main__":
    for name, make in (("shutter", lambda: shutter(False)), ("shutter-down", lambda: shutter(True)), ("lever", lever), ("counter", counter),
                       ("lens-track", lens_track), ("lens-thumb", lens_thumb), ("button-square", button_square), ("button-round", button_round)):
        if wanted(name):
            make()
    print("camera controls:", totals())

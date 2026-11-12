# The rotary telephone (src/play2/mechanisms/Telephone.tsx), seen from above on the desk, in layers:
#   phone-body         the bakelite body: the cradle and its plungers, the dial's enamel number plate
#   phone-wheel        the brass finger wheel, ten holes, its card in the middle; lit square on (the app turns it)
#   phone-wheel-light  the studio's light on the wheel's rim and hub, still, laid over it as it turns
#   phone-stop         the finger stop, over the wheel
#   phone-handset      the handset on its cradle, its braided cord down the body's side
#   phone-handset-off  the handset lifted off and laid by the telephone
#
#   <bpy python> scripts/blender/props/gadget_phone.py        # all; ONLY=phone-wheel for one
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gadget_common import M, Stage, at_2x, bakelite, brass, circle, front_light, grey_metal, kit, light_layer, rounded_rect, text, totals, wanted  # noqa: E402

W, H = 340, 276                  # Telephone's BOX
C = (112, 176)                   # the dial's centre
RW = 66                          # the finger wheel's radius; its box is 140
HOLES = 51                       # the holes' circle
HOLE_R = 9.2
STOP = 125                       # the finger stop, degrees clockwise from twelve
INKY = (0.022, 0.013, 0.016)
CORD = (0.16, 0.075, 0.035)


def hole_angle(d):
    """Where digit d's hole rests, degrees clockwise from twelve: 1 at two o'clock, round anticlockwise to 0 at five."""
    return 90 - 30 * (d if d else 10)


def polar(a, r, c=C):
    return (c[0] + r * math.sin(math.radians(a)), c[1] - r * math.cos(math.radians(a)))


def rounded_poly(corners, r, n=8):
    pts = []
    m = len(corners)
    for i, c in enumerate(corners):
        p, q = corners[i - 1], corners[(i + 1) % m]
        def toward(o):
            dx, dy = o[0] - c[0], o[1] - c[1]
            ln = math.hypot(dx, dy)
            return (c[0] + dx / ln * r, c[1] + dy / ln * r)
        a, b = toward(p), toward(q)
        for k in range(n + 1):
            t = k / n
            pts.append(((1 - t) ** 2 * a[0] + 2 * t * (1 - t) * c[0] + t * t * b[0], (1 - t) ** 2 * a[1] + 2 * t * (1 - t) * c[1] + t * t * b[1]))
    return pts


def body():
    st = Stage(W, H, samples=48)
    bk = bakelite()
    shell = st.extrude(rounded_poly([(40, 66), (184, 66), (212, 268), (12, 268)], 26), d=22, back=0, bevel=6, name="body", segments=5)
    kit.assign(shell, bk)
    # The cradle: a saddle across the top, a post at each corner, the two plungers the handset holds down.
    saddle = st.slab(46, 70, 132, 36, d=30, back=20, r=10, bevel=3, name="saddle")
    kit.assign(saddle, bk)
    for x in (52, 150):
        for y in (70, 96):
            kit.assign(st.slab(x, y, 22, 10, d=38, back=28, r=4, bevel=1.6, name="post"), bk)
    for x in (94, 130):
        kit.assign(st.turned([(0, 5), (3.4, 4.6), (4.6, 3), (4.6, 0)], x, 88, 30, "plunger", segments=32), brass("plunger", age=0.3, brushed=0.2))
    # The dial's seat, and its enamel number plate.
    cx, cy = C
    seat = st.turned([(RW + 9, 0), (RW + 8, 3.6), (RW + 4.5, 5.2), (RW + 2, 5.2)], cx, cy, 22, "seat", segments=128)
    kit.assign(seat, bk)
    plate = st.extrude(circle(cx, cy, RW + 2.5, 96), d=27.6, back=22, bevel=0, name="plate")
    kit.assign(plate, M.lit(M.enamel("plate", (0.93, 0.85, 0.66), gloss=0.3), (1.0, 0.90, 0.70), 0.34))
    st.no_ink.append(plate)
    ink = M.ink("numeral", INKY)
    for d in range(10):
        x, y = polar(hole_angle(d), HOLES)
        n = text(st, str(d), x, y + 0.4, 27.7, 13.0, depth=0.3)
        kit.assign(n, ink)
        st.no_ink.append(n)
    # Where the cord comes out.
    kit.assign(st.turned([(0, 3), (4.4, 3), (5.6, 1.6), (5.6, 0)], 204, 244, 10, "grommet", segments=32), brass("grommet", age=0.5))
    st.light(shadow=0, strength=0.7, reach=9)
    at_2x(st, 4)
    st.shoot("phone-body", scales=(1, 2))


def wheel_parts(st, smooth=False):
    c = 70
    hub = st.turned([(31, 0), (31, 3.4), (29.4, 5.0), (25, 5.6), (24, 4.8), (0, 4.8)], c, c, 3, "hub", segments=128)
    if smooth:
        rim = st.ring(circle(c, c, RW, 96), circle(c, c, HOLES + HOLE_R + 2.2, 96), d=3, back=0, bevel=0.8, name="rim")
        return [hub, rim]
    holes = [circle(*polar(hole_angle(d), HOLES, (c, c)), HOLE_R, 28) for d in range(10)]
    disc = st.extrude(circle(c, c, RW, 128), d=3, back=0, bevel=0.8, name="wheel", holes=holes)
    return [hub, disc]


def wheel():
    st = Stage(140, 140)
    c = 70
    hub, disc = wheel_parts(st)
    b = brass("wheel", color=(0.70, 0.47, 0.18), age=0.3, brushed=0.6, wear=0.6, axis="Y")
    kit.assign(hub, b)
    kit.assign(disc, b)
    st.plain.append(disc)
    # The card in the middle, under its brass rim.
    card = st.extrude(circle(c, c, 23.6, 64), d=8.0, back=7, bevel=0, name="card")
    kit.assign(card, M.lit(M.paper("card", (0.90, 0.84, 0.70), age=0.4), (1.0, 0.9, 0.7), 0.25))
    st.no_ink.append(card)
    ring = st.ring(circle(c, c, 17, 48), circle(c, c, 16.1, 48), d=8.1, back=7.9, bevel=0, name="line")
    kit.assign(ring, M.ink("line", INKY))
    st.no_ink.append(ring)
    front_light(st, ambient=0.6, strength=0.5)
    st.ink(3)
    st.shoot("phone-wheel")


def wheel_light():
    st = Stage(140, 140, samples=48)
    for ob in wheel_parts(st, smooth=True):
        kit.assign(ob, grey_metal())
    st.light()
    kit.no_outline()
    light_layer(st, "phone-wheel-light", gain=(0.9, 0.8), scales=(1, 2))


def stop():
    st = Stage(W, H, ss=2, samples=48)
    b = brass("stop", age=0.3, brushed=0.3, wear=0.8)
    x0, y0 = polar(STOP, RW + 8)
    x1, y1 = polar(STOP - 5, HOLES - 6)
    xm, ym = polar(STOP - 1, RW - 4)
    bar = st.rod([(x0, y0, 27), (xm, ym, 33.5), (x1, y1, 33.5)], 2.5, "stop")
    kit.assign(bar, b)
    kit.assign(st.turned([(0, 2.4), (3.2, 2.0), (4.4, 0)], x0, y0, 27, "foot", segments=32), b)
    st.light()
    st.ink(3)
    st.shoot("phone-stop", crop=STOP_BOX)


STOP_BOX = (134, 196, 52, 44)


def handset_parts(st, off):
    """The handset: on its cradle across the top, or lifted off and laid down the right-hand side."""
    bk = bakelite("handset", gloss=0.6)
    if off:
        ear, mouth, z = (296, 50), (296, 212), 0
    else:
        ear, mouth, z = (34, 88), (190, 88), 30
    ax, ay = ear
    bx, by = mouth
    ux, uy = (bx - ax) / 156.0, (by - ay) / 156.0
    grip = st.rod([(ax + ux * 16, ay + uy * 16, z + 13), (ax + ux * 50, ay + uy * 50, z + 20), (ax + ux * 106, ay + uy * 106, z + 20), (bx - ux * 16, by - uy * 16, z + 13)], 10.5, "grip", resolution=14)
    kit.assign(grip, bk)
    parts = [grip]
    for (x, y), r in ((ear, 26.5), (mouth, 25)):
        cup = st.turned([(r, 0), (r, 9), (r - 2.5, 13), (r - 9, 15.5), (0, 16.5)], x, y, z, "cup", segments=96)
        kit.assign(cup, bk)
        band = st.turned([(r + 0.5, 0), (r + 0.5, 3.2), (r - 0.2, 3.6)], x, y, z + 2.4, "band", segments=96)
        kit.assign(band, brass("band", age=0.4, brushed=0.5))
        parts += [cup, band]
    # The braided cord, from the mouthpiece to the body's side.
    gx, gy = 204, 244
    if off:
        path = [(bx - 6, by + 22, 6), (bx - 16, by + 46, 3), (254, 266, 3), (228, 262, 3), (gx + 4, gy + 2, 8)]
    else:
        path = [(bx + 14, by + 16, z + 4), (bx + 34, by + 44, 12), (bx + 40, by + 96, 3), (bx + 30, by + 140, 3), (gx + 5, gy, 8)]
    cord = st.rod(path, 2.6, "cord", resolution=14)
    kit.assign(cord, M.felt("cord", CORD, nap=0.3))
    st.plain.append(cord)
    return parts


def handset(off):
    st = Stage(W, H, samples=48)
    handset_parts(st, off)
    st.light(shadow=0 if off else None, strength=0.6, reach=8)
    at_2x(st, 4)
    st.shoot("phone-handset-off" if off else "phone-handset", crop=OFF_BOX if off else ON_BOX, scales=(1, 2))


ON_BOX = (0, 54, 250, 204)
OFF_BOX = (196, 14, 144, 262)


if __name__ == "__main__":
    for name, fn in (("phone-stop", stop), ("phone-wheel", wheel), ("phone-wheel-light", wheel_light), ("phone-handset", lambda: handset(False)),
                     ("phone-handset-off", lambda: handset(True)), ("phone-body", body)):
        if wanted(name):
            fn()
    print("phone:", totals())

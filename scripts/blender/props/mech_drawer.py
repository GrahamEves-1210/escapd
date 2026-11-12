# The drawer's and the cupboard's furniture (src/play2/mechanisms/Drawer.tsx): the walnut
# carcass with the drawer below baked in, the drawer's front, the cupboard's carcass and its
# door (knob on), and the brass that goes on them as separate sprites the app lays over:
# a bail pull, a keyhole plate, a butt hinge. Sizes are the app's boxes in points.
#
#   <bpy python> scripts/blender/props/mech_drawer.py        # all; ONLY=pull,hinge for some
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mech_common import M, Stage, circle, cut, kit, rounded_rect, totals, wanted  # noqa: E402

W, FRONT_H, TRAVEL, PAD = 280, 96, 72, 8      # Drawer.tsx: w, h, TRAVEL, ref.space.sm
CARCASS_H = FRONT_H + TRAVEL + 16             # 184
FRONT_W = W - 2 * PAD                         # 264
DOOR_H = CARCASS_H - 2 * PAD                  # 168
CARCASS = (0.105, 0.042, 0.019)               # the same walnut, a shade down
WALNUT = (0.175, 0.070, 0.029)
E = 1.2                                       # the board's edge sits this far inside its box (room for the line)


def brass(name="brass", **kw):
    return M.brass(name, **{"age": 0.5, "brushed": 0.35, "wear": 0.7, **kw})


def routed(st, board, x, y, w, h, inset, width=3.2, depth=3.0, top=10.0, r=3.0):
    """Rout a moulding into a board's face: a groove `inset` in from the box."""
    outer = rounded_rect(x + inset, y + inset, w - 2 * inset, h - 2 * inset, r, 6)
    i2 = inset + width
    inner = rounded_rect(x + i2, y + i2, w - 2 * i2, h - 2 * i2, max(0.5, r - width * 0.6), 6)
    cutter = st.ring(outer, inner, d=top + 3, back=top - depth, bevel=0)
    return cut(board, cutter)


def pull(st, cx, cy, k=1.0, d=0.0):
    """A bail pull, `86 * k` points wide, centred on (cx, cy) (the middle of its box)."""
    mat, parts = brass("pull", age=0.45), []
    ax, y0 = 31 * k, cy - 8 * k
    for sx in (-1, 1):
        x = cx + sx * ax
        rose = st.turned([(0, 2.6 * k), (4.2 * k, 2.6 * k), (5.6 * k, 2.0 * k), (7.3 * k, 1.2 * k), (7.6 * k, 0.0)], x, y0, d, "rose")
        post = st.turned([(0, 6.6 * k), (2.3 * k, 6.4 * k), (3.0 * k, 5.4 * k), (3.0 * k, 4.2 * k), (2.0 * k, 3.4 * k), (2.0 * k, 0)], x, y0, d + 2 * k, "post", segments=32)
        parts += [rose, post]
    h = d + 4.6 * k
    path = [(cx - ax, y0, h), (cx - ax, y0 + 9 * k, h + 0.6 * k), (cx - ax + 3 * k, y0 + 17 * k, h + 1.2 * k), (cx - ax + 12 * k, y0 + 21.5 * k, h + 1.6 * k),
            (cx, y0 + 22.5 * k, h + 1.8 * k),
            (cx + ax - 12 * k, y0 + 21.5 * k, h + 1.6 * k), (cx + ax - 3 * k, y0 + 17 * k, h + 1.2 * k), (cx + ax, y0 + 9 * k, h + 0.6 * k), (cx + ax, y0, h)]
    bail = st.rod(path, 2.5 * k, "bail")
    parts.append(bail)
    for p in parts:
        kit.assign(p, mat)
    return parts


def knob(st, x, y, d=0.0, k=1.0):
    mat = brass("knob", age=0.4, brushed=0.5)
    rose = st.turned([(0, 2.4), (9.0, 2.4), (11.4, 1.6), (12.6, 0.8), (12.9, 0)], x, y, d, "rose")
    head = st.turned([(0, 13.5), (3.5, 13.2), (6.4, 12.0), (8.2, 10.0), (8.8, 8.0), (8.0, 6.2), (5.2, 5.0), (3.8, 3.6), (3.8, 1.0)], x, y, d + 1.5, "knob")
    for p in (rose, head):
        p.scale = (k, k, k)
        kit.assign(p, mat)
    return [rose, head]


def drawer_carcass():
    st = Stage(W, CARCASS_H)
    wood = M.walnut("carcass", axis="X", color=CARCASS, figure=0.5, gloss=0.35)
    low_y, low_h = PAD + FRONT_H + 5, CARCASS_H - FRONT_H - 2 * PAD - 5
    face = st.extrude(rounded_rect(E, E, W - 2 * E, CARCASS_H - 2 * E, 7), d=10, back=-6, bevel=1.6, name="carcass",
                      holes=[rounded_rect(PAD, PAD, FRONT_W, FRONT_H, 3, 4), rounded_rect(PAD, low_y, FRONT_W, low_h, 3, 4)])
    kit.assign(face, wood)
    # The dark inside (the app lays the felt over the top one).
    back = st.slab(2, 2, W - 4, CARCASS_H - 4, d=-5, back=-8, bevel=0)
    kit.assign(back, M.ink("dark", (0.010, 0.006, 0.007)))
    st.no_ink.append(back)
    # The drawer below, shut: a little back from the carcass's face.
    low = st.slab(PAD + 1, low_y + 1, FRONT_W - 2, low_h - 2, d=8.2, back=-4, r=3, bevel=1.2, name="lower")
    routed(st, low, PAD + 1, low_y + 1, FRONT_W - 2, low_h - 2, 7, top=8.2, depth=2.4, width=2.8)
    kit.assign(low, M.walnut("lower", axis="X", color=(0.145, 0.058, 0.025), figure=0.6, gloss=0.4))
    low.location.x += 0.37  # another board: another stretch of grain
    low.data.transform(__import__("mathutils").Matrix.Translation((-0.37, 0, 0)))
    pull(st, W / 2, low_y + low_h / 2 + 1, 64 / 86, d=8.2)
    st.light()
    st.ink(4)
    st.shoot("drawer-carcass")


def drawer_front():
    st = Stage(FRONT_W, FRONT_H)
    board = st.slab(E, E, FRONT_W - 2 * E, FRONT_H - 2 * E, d=11, back=0, r=5, bevel=1.8, name="front")
    routed(st, board, 0, 0, FRONT_W, FRONT_H, 10, top=11)
    kit.assign(board, M.walnut("front", axis="X", color=WALNUT, figure=0.7, gloss=0.5))
    st.light()
    st.ink(4)
    st.shoot("drawer-front")


def cabinet_carcass():
    st = Stage(W, CARCASS_H)
    face = st.extrude(rounded_rect(E, E, W - 2 * E, CARCASS_H - 2 * E, 7), d=10, back=-6, bevel=1.6, name="carcass",
                      holes=[rounded_rect(PAD, PAD, FRONT_W, DOOR_H, 3, 4)])
    kit.assign(face, M.walnut("carcass", axis="X", color=CARCASS, figure=0.5, gloss=0.35))
    back = st.slab(2, 2, W - 4, CARCASS_H - 4, d=-5, back=-8, bevel=0)
    kit.assign(back, M.ink("dark", (0.010, 0.006, 0.007)))
    st.no_ink.append(back)
    st.light()
    st.ink(4)
    st.shoot("cabinet-carcass")


def cabinet_door():
    st = Stage(FRONT_W, DOOR_H)
    board = st.slab(E, E, FRONT_W - 2 * E, DOOR_H - 2 * E, d=11, back=0, r=5, bevel=1.8, name="door")
    routed(st, board, 0, 0, FRONT_W, DOOR_H, 14, top=11, width=3.6)
    kit.assign(board, M.walnut("door", axis="X", color=WALNUT, figure=0.7, gloss=0.5))
    knob(st, FRONT_W - 12 - 15, DOOR_H / 2, d=11)
    st.light()
    st.ink(4)
    st.shoot("cabinet-door")


def pull_sprite():
    st = Stage(96, 44)   # the pull (86 wide) in the middle, room for its shadow
    pull(st, 48, 21)
    st.light(shadow=0, reach=6, strength=0.7)
    st.ink(2)
    st.shoot("pull")


def keyhole():
    st = Stage(24, 32)   # the plate is 18 x 26 in the middle
    ox, oy = 3, 3
    out = []
    for i in range(25):  # the round top, clockwise from its left shoulder
        a = math.radians(210 - 240 * i / 24)
        out.append((ox + 9 + 7.6 * math.cos(a), oy + 9.4 - 7.6 * math.sin(a)))
    out += [(ox + 14.2, oy + 18.5), (ox + 15.2, oy + 23.2), (ox + 14.2, oy + 24.6), (ox + 3.8, oy + 24.6), (ox + 2.8, oy + 23.2), (ox + 3.8, oy + 18.5)]
    plate = st.extrude(out, d=2.0, bevel=0.7, name="plate")
    kit.assign(plate, brass("plate", age=0.55))
    hole = [(ox + 9 + 2.7 * math.sin(math.radians(a)), oy + 9.6 - 2.7 * math.cos(math.radians(a))) for a in range(-140, 141, 20)]
    hole += [(ox + 11.5, oy + 19.4), (ox + 6.5, oy + 19.4)]
    slot = st.extrude(hole, d=2.15, back=1.0, bevel=0, name="keyhole")
    kit.assign(slot, M.rubber("hole", (0.006, 0.004, 0.006)))
    st.no_ink.append(slot)
    for y in (3.6, 22.4):
        pin = st.turned([(0, 0.8), (0.7, 0.6), (1.1, 0)], ox + 9, oy + y, 2.0, "pin", segments=24)
        kit.assign(pin, brass("pin", age=0.2))
        st.no_ink.append(pin)
    st.light(shadow=0, reach=3.5, strength=0.7)
    st.ink(2)
    st.shoot("keyhole")


def hinge():
    st = Stage(22, 36)   # the hinge is 16 x 30 in the middle
    ox, oy = 3, 3
    mat = brass("hinge", age=0.5, brushed=0.6, axis="Z")
    for x in (1.2, 9.2):
        leaf = st.slab(ox + x, oy + 2, 5.6, 26, d=1.6, r=1.2, bevel=0.5, name="leaf")
        kit.assign(leaf, mat)
    for i, (y0, y1) in enumerate(((0.8, 9.8), (10.6, 19.4), (20.2, 29.2))):
        k = st.rod([(ox + 8, oy + y0 + 1.2, 2.2), (ox + 8, oy + (y0 + y1) / 2, 2.2), (ox + 8, oy + y1 - 1.2, 2.2)], 2.0, "knuckle")
        kit.assign(k, mat)
    for x in (3.9, 12.1):
        for y in (7, 15, 23):
            s = st.screw(ox + x, oy + y, 1.6, r=1.25, turn=20 + 37 * y)
            st.no_ink.append(s)
    st.light(shadow=0, reach=3.0, strength=0.7)
    st.ink(2)
    st.shoot("hinge")


if __name__ == "__main__":
    for name, fn in (("drawer-carcass", drawer_carcass), ("drawer-front", drawer_front), ("cabinet-carcass", cabinet_carcass),
                     ("cabinet-door", cabinet_door), ("pull", pull_sprite), ("keyhole", keyhole), ("hinge", hinge)):
        if wanted(name):
            fn()
    print("drawer:", totals())

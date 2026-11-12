# The way out (src/play2/mechanisms/Door.tsx). Shut: a stretch of the door itself, walnut with
# a routed panel, its brass lock set (a long plate, a knob, a keyhole) beside where the app
# lays the wheels and their plaque. Open: the door standing ajar in its casing, the leaf swung
# in on its hinges; the opening is clear so the app's own light (the mode's) shows through it.
#
#   <bpy python> scripts/blender/props/mech_door.py        # both; ONLY=door-ajar for one
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
from mech_common import M, Stage, cut, kit, rounded_rect, totals, wanted  # noqa: E402
from mech_drawer import WALNUT, brass, routed  # noqa: E402

PANEL = (336, 282)   # Door.tsx: the panel's width (at most) and PANEL_H
E = 1.2


def lock_set(st, x, y, d):
    """A mortise lock's furniture: a long plate, a knob on its rose, a keyhole under it. (x, y): the plate's top left."""
    w, h = 26, 74
    plate = st.slab(x, y, w, h, d=d + 2.2, back=d - 1, r=6, bevel=0.9, name="lockplate")
    kit.assign(plate, brass("lockplate", age=0.6, brushed=0.6))
    cx = x + w / 2
    for sy in (7, h - 7):
        s = st.screw(cx, y + sy, d + 2.2, r=1.9, turn=25 + sy * 3)
        st.no_ink.append(s)
    mat = brass("doorknob", age=0.4, brushed=0.5)
    rose = st.turned([(0, 2.0), (8.2, 2.0), (10.0, 1.2), (10.6, 0)], cx, y + 26, d + 2.2, "rose")
    head = st.turned([(0, 15.0), (3.6, 14.7), (6.8, 13.3), (8.8, 11.0), (9.4, 8.8), (8.6, 6.8), (5.4, 5.4), (3.6, 4.0), (3.6, 1.0)], cx, y + 26, d + 3.4, "knob")
    kit.assign(rose, mat)
    kit.assign(head, mat)
    hole = [(cx + 2.4 * math.sin(math.radians(a)), y + 51 - 2.4 * math.cos(math.radians(a))) for a in range(-140, 141, 20)] + [(cx + 2.1, y + 59), (cx - 2.1, y + 59)]
    slot = st.extrude(hole, d=d + 2.35, back=d + 1, bevel=0, name="keyhole")
    kit.assign(slot, M.rubber("hole", (0.006, 0.004, 0.006)))
    st.no_ink.append(slot)


def door_panel():
    w, h = PANEL
    st = Stage(w, h)
    board = st.slab(E, E, w - 2 * E, h - 2 * E, d=11, back=0, r=6, bevel=1.8, name="door")
    routed(st, board, 0, 0, w, h, 9, top=11, width=3.4)
    kit.assign(board, M.walnut("door", axis="Z", color=WALNUT, figure=0.7, gloss=0.5))
    # The lock set: right of the plaque ("Try the door"), under the wheels.
    lock_set(st, 285, 196, 11)
    st.light()
    st.ink(4)
    st.shoot("door-panel", scales=(1, 2), loose=30.0)   # a backdrop behind the wheels, 1008 x 846 at 3x: twice over is plenty


def door_ajar():
    # Door.tsx Ajar: 250 x 214, the opening at (78, 16) 96 x 160, the leaf hung on its left.
    W, H = 250, 214
    ox, oy, ow, oh = 78, 16, 96, 160
    st = Stage(W, H)
    dark = M.walnut("casing", axis="Z", color=(0.105, 0.042, 0.019), figure=0.5, gloss=0.4)
    # The casing: an architrave round the opening, stepped (a flat, a bead by the opening).
    outer = [(ox - 15, oy + oh), (ox - 15, oy - 13), (ox + ow + 15, oy - 13), (ox + ow + 15, oy + oh)]
    mid = [(ox - 5, oy + oh), (ox - 5, oy - 4), (ox + ow + 5, oy - 4), (ox + ow + 5, oy + oh)]
    inner = [(ox, oy + oh), (ox, oy), (ox + ow, oy), (ox + ow, oy + oh)]

    def band(a, b, d, back, name, bevel=1.2):
        # An open frame (no sill): the band between two three-sided outlines, closed along the floor.
        import bmesh
        bm = bmesh.new()
        f = [bm.verts.new(st.at(x, y, d)) for x, y in a] + [bm.verts.new(st.at(x, y, d)) for x, y in reversed(b)]
        k = [bm.verts.new(st.at(x, y, back)) for x, y in a] + [bm.verts.new(st.at(x, y, back)) for x, y in reversed(b)]
        n = len(f)
        bm.faces.new(f)
        bm.faces.new(list(reversed(k)))
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((f[j], f[i], k[i], k[j]))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        me = bpy.data.meshes.new(name)
        bm.to_mesh(me)
        bm.free()
        ob = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(ob)
        kit.bevel(ob, bevel / st.u, 3, angle=40)
        kit.shade(ob, 40)
        kit.assign(ob, dark)
        return ob

    band(outer, mid, 12, -6, "architrave", 1.6)
    band(mid, inner, 8, -30, "jamb", 1.0)
    # The leaf: hung on the opening's left edge, swung in (away from you) most of the way.
    leaf = st.slab(0, oy + 1, ow - 1, oh - 1, d=0, back=-6, r=1, bevel=1.0, name="leaf")
    for y0, y1 in ((oy + 9, oy + oh * 0.47), (oy + oh * 0.51, oy + oh - 11)):
        routed(st, leaf, 9, y0, ow - 19, y1 - y0, 0, width=3.0, depth=2.4, top=0, r=2)
    kit.assign(leaf, M.walnut("leaf", axis="Z", color=WALNUT, figure=0.7, gloss=0.5))
    mat = brass("doorknob", age=0.35)
    kn = st.turned([(0, 10.0), (3.0, 9.6), (5.0, 8.4), (5.6, 6.6), (4.6, 5.0), (2.4, 3.8), (2.4, 0)], ow - 13, oy + oh * 0.52, 0, "knob", segments=32)
    kit.assign(kn, mat)
    hinge = bpy.data.objects.new("hinge", None)
    bpy.context.scene.collection.objects.link(hinge)
    hinge.location = st.at(0, 0, -8)
    for o in (leaf, kn):
        o.parent = hinge
    hinge.location = (st.X(ox + 1), st.L(8), 0)
    # Offset the leaf's mesh so its left edge is on the hinge line, then swing.
    for o in (leaf, kn):
        o.location.x -= st.X(0)
    hinge.rotation_euler = (0, 0, math.radians(69))
    # Hinges on the casing.
    for y in (oy + 26, oy + oh - 34):
        hg = st.slab(ox - 3.2, y, 6.4, 13, d=9.5, back=7, r=1.4, bevel=0.5, name="hinge")
        kit.assign(hg, brass("hinge", age=0.5))
    # The way out's light, behind the door: on the leaf's edge and the jambs (the app draws the light itself).
    bpy.ops.mesh.primitive_plane_add(size=1, location=(st.X(ox + ow * 0.62), st.L(120), st.Z(oy + oh * 0.55)))
    lamp = bpy.context.object
    lamp.scale = (st.L(ow * 1.1), st.L(oh * 0.9), 1)
    lamp.rotation_euler = (math.radians(90), 0, 0)
    lamp["kit_rig"] = True
    lamp.visible_camera = False
    lamp.visible_glossy = False   # (or the leaf's polish mirrors it and the walnut goes white)
    kit.assign(lamp, M.glow("wayout", (1.0, 0.93, 0.82), 3.0))
    # No rim light here: the leaf's face is turned toward where the studio's cool rim stands, and takes it full on.
    st.light(key=0.8, rim=0.0)
    st.ink(3)
    st.shoot("door-ajar")


if __name__ == "__main__":
    for name, fn in (("door-panel", door_panel), ("door-ajar", door_ajar)):
        if wanted(name):
            fn()
    print("door:", totals())

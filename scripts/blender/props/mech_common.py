# Shared by the close-up mechanisms' sprites (props/mech_*.py): parts that the
# app slides, turns and swaps over live drawing, so they must register with it
# to the point. Each part is modelled in the app's own coordinates: points,
# x right, y down from the top left of the box the app gives it, `d` points
# out of the surface toward you. The camera is straight on ("front") and frames
# that box exactly, so a rendered picture drops into the app's box 1:1.
#
#   st = Stage(264, 96)                      # the app's box, in points
#   board = st.slab(0, 0, 264, 96, d=10, r=5); kit.assign(board, M.walnut(axis="X"))
#   st.light(); st.ink(4)
#   st.shoot("drawer-front")                  # -> assets/mech/drawer-front{,@2x,@3x}.png
import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import bpy  # noqa: E402
import bmesh  # noqa: E402

import export  # noqa: E402
import kit  # noqa: E402
import materials as M  # noqa: E402

OUT = "assets/mech"
SAMPLES = int(os.environ.get("SAMPLES", 96))
THREADS = int(os.environ.get("THREADS", 4))
_totals = {"files": 0, "bytes": 0}


def scratch(name):
    return export.scratch("mech", name + ".png")


class Stage:
    """One sprite's scene: the app's box (w x h points), framed exactly."""

    def __init__(self, w, h, unit=None, ss=None, samples=None, glass=False, look="standard"):
        kit.reset()
        # Small brass is rendered twice over (a crisp line on a tiny part); anything bigger at its exported size.
        ss = ss or (1 if max(w, h) > 100 else 2)
        kit.setup(size=(round(w * 3), round(h * 3)), ss=ss, samples=samples or SAMPLES, transparent_glass=glass, look=look, threads=THREADS)
        self.w, self.h = w, h
        # Points per Blender unit: the box's long side is 2 units (what the materials are tuned for).
        self.u = unit or max(w, h) / 2.0
        self.cam = kit.camera("front", span=max(w, h) / self.u)
        self.glass = glass
        self.no_ink, self.plain = [], []

    # -- coordinates
    def X(self, px):
        return (px - self.w / 2) / self.u

    def Z(self, py):
        return (self.h / 2 - py) / self.u

    def L(self, pts):
        return pts / self.u

    def at(self, px, py, d=0.0):
        """A point of the app's box, `d` points proud of the surface, in world space."""
        return (self.X(px), -d / self.u, self.Z(py))

    # -- parts
    def slab(self, x, y, w, h, d=6.0, r=0.0, back=0.0, bevel=1.2, name="slab", segments=3, corner=10):
        """A plate lying in the picture plane: its box in points, from `back` to `d` points proud,
        corners rounded by `r`, its edges bevelled by `bevel` points."""
        pts = rounded_rect(x, y, w, h, r, corner)
        return self.extrude(pts, d, back, bevel, name, segments)

    def extrude(self, pts, d=6.0, back=0.0, bevel=1.2, name="plate", segments=3, holes=()):
        """A flat outline (points, clockwise as seen) pushed out from `back` to `d`. `holes`: outlines
        cut through it (each the same vertex count as... any: they are bridged by triangulation)."""
        bm = bmesh.new()
        vs = [bm.verts.new(self.at(px, py, d)) for px, py in pts]
        if holes:
            edges = [bm.edges.new((vs[i], vs[(i + 1) % len(vs)])) for i in range(len(vs))]
            for hole in holes:
                hv = [bm.verts.new(self.at(px, py, d)) for px, py in hole]
                edges += [bm.edges.new((hv[i], hv[(i + 1) % len(hv)])) for i in range(len(hv))]
            bmesh.ops.triangle_fill(bm, use_beauty=True, use_dissolve=False, edges=edges)
        else:
            bm.faces.new(vs)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        for f in bm.faces:  # front faces look at the camera (-Y)
            if f.normal.y > 0:
                f.normal_flip()
        ext = bmesh.ops.extrude_face_region(bm, geom=list(bm.faces))
        moved = [v for v in ext["geom"] if isinstance(v, bmesh.types.BMVert)]
        bmesh.ops.translate(bm, verts=moved, vec=(0, (d - back) / self.u, 0))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        me = bpy.data.meshes.new(name)
        bm.to_mesh(me)
        bm.free()
        ob = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(ob)
        if bevel:
            kit.bevel(ob, bevel / self.u, segments, angle=40)
        kit.shade(ob, 40)
        return ob

    def ring(self, outer, inner, d=6.0, back=0.0, bevel=1.0, name="ring", segments=3):
        """A frame: the band between two outlines with the same number of points."""
        assert len(outer) == len(inner)
        n = len(outer)
        bm = bmesh.new()
        fo = [bm.verts.new(self.at(px, py, d)) for px, py in outer]
        fi = [bm.verts.new(self.at(px, py, d)) for px, py in inner]
        bo = [bm.verts.new(self.at(px, py, back)) for px, py in outer]
        bi = [bm.verts.new(self.at(px, py, back)) for px, py in inner]
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((fo[i], fo[j], fi[j], fi[i]))
            bm.faces.new((bo[j], bo[i], bi[i], bi[j]))
            bm.faces.new((fo[j], fo[i], bo[i], bo[j]))
            bm.faces.new((fi[i], fi[j], bi[j], bi[i]))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        me = bpy.data.meshes.new(name)
        bm.to_mesh(me)
        bm.free()
        ob = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(ob)
        if bevel:
            kit.bevel(ob, bevel / self.u, segments, angle=40)
        kit.shade(ob, 40)
        return ob

    def turned(self, profile, x, y, d=0.0, name="turned", segments=64, **kw):
        """A lathe-turned part facing you: `profile` is [(radius, depth), ...] in points, its axis
        coming out of the surface at (x, y), its base `d` points proud."""
        ob = kit.lathe([(r / self.u, z / self.u) for r, z in profile], name=name, segments=segments, **kw)
        ob.rotation_euler = (math.radians(90), 0, 0)
        ob.location = self.at(x, y, d)
        return ob

    def rod(self, pts, radius, name="rod", closed=False, resolution=10):
        """A round bar along a path: pts are (x, y, d) in points; smooth through them."""
        cu = bpy.data.curves.new(name, "CURVE")
        cu.dimensions = "3D"
        cu.bevel_depth = radius / self.u
        cu.bevel_resolution = 6
        cu.resolution_u = resolution
        cu.use_fill_caps = True
        sp = cu.splines.new("NURBS")
        sp.points.add(len(pts) - 1)
        for p, (px, py, d) in zip(sp.points, pts):
            p.co = (*self.at(px, py, d), 1.0)
        sp.use_endpoint_u = not closed
        sp.use_cyclic_u = closed
        sp.order_u = min(4, len(pts))
        ob = bpy.data.objects.new(name, cu)
        bpy.context.scene.collection.objects.link(ob)
        return to_mesh(ob)

    def ball(self, x, y, d, r, name="ball", squash=(1, 1, 1)):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=r / self.u, location=self.at(x, y, d), segments=40, ring_count=20)
        ob = bpy.context.object
        ob.name = name
        ob.scale = squash
        kit.shade(ob)
        return ob

    def screw(self, x, y, d=0.0, r=3.0, turn=30.0, mat=None):
        """A domed brass screw head with its slot."""
        head = self.turned([(0, r * 0.62), (r * 0.5, r * 0.55), (r * 0.86, r * 0.34), (r, 0.0)], x, y, d, "screw", segments=32)
        kit.assign(head, mat or M.brass("screw", age=0.4, brushed=0.2, wear=0.7))
        slot = kit.box((self.L(r * 1.9), self.L(r * 0.6), self.L(r * 0.26)), self.at(x, y, d + r * 0.62), "slot", bevel_width=0)
        slot.rotation_euler = (0, math.radians(turn), 0)
        kit.assign(slot, M.rubber("slot", (0.03, 0.02, 0.015)))
        self.no_ink.append(slot)
        return head

    # -- light, line, shadow
    def light(self, shadow=None, strength=0.75, reach=5.0, **kw):
        """The house studio. `shadow`: draw a soft contact shadow on the surface behind (the wall or the
        wood the part is screwed to), `shadow` points behind the picture plane, fading out within
        `reach` points of the part."""
        rig = kit.studio(self.cam, span=2.0, target=(0, 0, 0), **kw)
        if shadow is not None:
            p = kit.contact_shadow(0.0, 2.0, (0, 0, 0), strength, reach / (3.0 * self.u))
            p.rotation_euler = (math.radians(90), 0, 0)
            p.location = (0, shadow / self.u, 0)
        return rig

    def ink(self, weight=3.0, **kw):
        kit.outline(weight, exclude=self.no_ink, plain=self.plain, **kw)

    def shoot(self, name, crop=None, sizes=None, glass=False, scales=(1, 2, 3), loose=None):
        """Render and export to assets/mech/<name>.png (+@2x, @3x), keeping the app's box.
        crop=(x, y, w, h) in points: keep just that part of the box (a sprite laid at that place)."""
        src = scratch(name)
        kit.render(src, exr=glass)
        im = export.lift_glass(src) if glass else export.load(src)
        k = im.width / self.w
        size = sizes or (self.w, self.h)
        if crop:
            x, y, w, h = crop
            im = im.crop((round(x * k), round(y * k), round((x + w) * k), round((y + h) * k)))
            size = sizes or (w, h)
        return save(im, name, size, scales, loose)


BUDGET_KB = 150
LOOSE = 20.0


def pack(im, loose=None):
    """PNG bytes for a sprite: the kit's encoder as it is; and where that leaves a full-colour file of any
    size (close-up sprites are big and there are forty of them; walnut's grain, a brushed bezel or a pleated
    shade is fine noise that full colour stores at three or four times the size), the same encoder with its
    banding limit loosened from 7 to 20. Looked at side by side at 3x on the game's grounds, the palette's
    steps hide in the grain, the brushing and the pleats."""
    data, how = export.encode(im, True)
    if "quant" not in how and len(data) > 30 * 1024:
        quant, how2 = export.encode(im, True, max_error=loose or LOOSE)
        if len(quant) < len(data):
            data, how = quant, how2 + ", loose"
    return data, how


def save(im, name, size, scales=(1, 2, 3), loose=None):
    """A render into assets/mech at the app's sizes, keeping its framing (export.export with canvas=True,
    encoded by pack). scales: (1, 2) for a very large backdrop that 3x would put over the budget;
    loose: that backdrop's own banding limit (a door's worth of grain behind the wheels)."""
    n = 0
    for k in scales:
        out = export.resize(im, (round(size[0] * k), round(size[1] * k)))
        data, how = pack(out, loose)
        path = os.path.join(export.REPO, OUT, name + ("" if k == 1 else f"@{k}x") + ".png")
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path + ".tmp", "wb") as f:
            f.write(data)
        os.replace(path + ".tmp", path)   # (never half a file where the app's bundler can see it)
        print(f"  {os.path.relpath(path, export.REPO)}  {out.width}x{out.height}  {len(data) / 1024:.1f} KB  ({how}){'  ** over budget **' if len(data) > BUDGET_KB * 1024 else ''}")
        n += len(data)
    _totals["files"] += len(scales)
    _totals["bytes"] += n
    return n


def rounded_rect(x, y, w, h, r=0.0, corner=10):
    """A rounded rectangle's outline in points, clockwise as seen (y down), starting on its top edge."""
    r = min(r, w / 2, h / 2)
    if r <= 0:
        return [(x, y), (x + w, y), (x + w, y + h), (x, y + h)]
    pts = []
    for cx, cy, a0 in ((x + w - r, y + r, -90), (x + w - r, y + h - r, 0), (x + r, y + h - r, 90), (x + r, y + r, 180)):
        for i in range(corner + 1):
            a = math.radians(a0 + 90 * i / corner)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def circle(cx, cy, r, n=64):
    return [(cx + r * math.sin(2 * math.pi * i / n), cy - r * math.cos(2 * math.pi * i / n)) for i in range(n)]


def to_mesh(ob):
    """A curve as a mesh (so bevels, pointiness and the ink line treat it like any other part)."""
    deps = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(deps))
    new = bpy.data.objects.new(ob.name, me)
    new.matrix_world = ob.matrix_world
    bpy.context.scene.collection.objects.link(new)
    bpy.data.objects.remove(ob)
    kit.shade(new, 50)
    return new


def cut(ob, cutter):
    """Boolean: `ob` minus `cutter` (which is removed)."""
    m = ob.modifiers.new("cut", "BOOLEAN")
    m.operation = "DIFFERENCE"
    m.object = cutter
    m.solver = "EXACT"
    # Keep it ahead of the bevel.
    with bpy.context.temp_override(object=ob, active_object=ob):
        bpy.ops.object.modifier_move_to_index(modifier="cut", index=0)
        bpy.ops.object.modifier_apply(modifier="cut")
    bpy.data.objects.remove(cutter)
    return ob


def totals():
    return f"{_totals['files']} files, {_totals['bytes'] / 1024:.0f} KB"


def wanted(name):
    """`ONLY=pull,knob script.py` renders just those."""
    only = os.environ.get("ONLY")
    return not only or name in only.split(",")

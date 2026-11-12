# Modelling helpers shared by home's still life (home_sill.py) and the cat's mug
# (home_mug.py): swept tubes, rings, blobs, foil lettering. Kit conventions
# (README.md): Blender units, Z up, the camera on -Y.
import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import bpy  # noqa: E402
import bmesh  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

import kit  # noqa: E402
import materials as M  # noqa: E402

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
# Home looks at its sill from a little above (the tops of things show: the tea, the wax, the books' boards).
ELEV = 14.0


def srgb(hex_colour):
    """A theme colour ("#RRGGBB", src/theme/tokens.ts) as linear RGB."""
    h = hex_colour.lstrip("#")
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255.0
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return tuple(out)


def smooth_path(points, steps=8, closed=False):
    """A Catmull-Rom curve through `points`, `steps` samples a span."""
    pts = [Vector(p) for p in points]
    n = len(pts)
    out = []
    spans = n if closed else n - 1
    for i in range(spans):
        p0 = pts[(i - 1) % n] if (closed or i > 0) else pts[0]
        p1, p2 = pts[i % n], pts[(i + 1) % n]
        p3 = pts[(i + 2) % n] if (closed or i + 2 < n) else pts[-1]
        for s in range(steps):
            t = s / steps
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    if not closed:
        out.append(pts[-1])
    return out


def tube(points, radius, name="tube", segments=14, closed=False, flat=1.0, up=(0, 1, 0), caps=True):
    """A round (or, with `flat` < 1, ribbon-like) section swept along `points`.
    radius: a number, or one per point. `flat` squashes the section along `up`'s side."""
    pts = [Vector(p) for p in points]
    n = len(pts)
    radii = radius if isinstance(radius, (list, tuple)) else [radius] * n
    verts, faces = [], []
    normal = None
    for i, p in enumerate(pts):
        a = pts[(i - 1) % n] if (closed or i > 0) else p
        b = pts[(i + 1) % n] if (closed or i < n - 1) else p
        t = (b - a).normalized()
        if normal is None:
            normal = Vector(up) - t * t.dot(Vector(up))
            if normal.length < 1e-4:
                normal = Vector((1, 0, 0)) - t * t.x
        normal = (normal - t * t.dot(normal)).normalized()
        side = t.cross(normal)
        for j in range(segments):
            ang = 2 * math.pi * j / segments
            verts.append(p + (normal * math.cos(ang) * flat + side * math.sin(ang)) * radii[i])
    rings = n if closed else n - 1
    for i in range(rings):
        for j in range(segments):
            a, b = i * segments + j, i * segments + (j + 1) % segments
            c, d = ((i + 1) % n) * segments + (j + 1) % segments, ((i + 1) % n) * segments + j
            faces.append((a, b, c, d))
    if caps and not closed:
        for i, flip in ((0, True), (n - 1, False)):
            ring = [i * segments + j for j in range(segments)]
            faces.append(tuple(reversed(ring)) if not flip else tuple(ring))
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], faces)
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    kit.shade(ob, 50)
    return ob


def ring(major, minor, name="ring", segments=64, section=14, squash=1.0):
    """A torus in the XY plane (its axis Z), `squash` flattening its section along Z."""
    pts = [(major * math.cos(2 * math.pi * i / segments), major * math.sin(2 * math.pi * i / segments), 0) for i in range(segments)]
    ob = tube(pts, minor, name, segments=section, closed=True, up=(0, 0, 1), flat=squash)
    return ob


def ball(radius, location, name="ball", scale=(1, 1, 1), segments=24):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=radius, location=location, segments=segments, ring_count=segments // 2)
    ob = bpy.context.object
    ob.name = name
    ob.scale = scale
    kit.shade(ob)
    return ob


def disc(radius, z, name="disc", segments=64):
    """A flat disc at height z (a liquid's surface)."""
    return kit.lathe([(0, z), (radius, z)], name=name, segments=segments)


def blobs(elements, name="blob", resolution=0.02):
    """Metaballs, (centre, radius) each, fused and turned into a mesh (liquid: a spill, a drip, pooled wax)."""
    mb = bpy.data.metaballs.new(name)
    mb.resolution = mb.render_resolution = resolution
    mb.threshold = 0.6
    for co, r in elements:
        el = mb.elements.new()
        el.co, el.radius = co, r
    ob = bpy.data.objects.new(name + "_meta", mb)
    bpy.context.scene.collection.objects.link(ob)
    bpy.context.view_layer.update()
    deps = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(deps))
    bpy.data.objects.remove(ob)
    out = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(out)
    kit.shade(out, 80)
    return out


def lettering(text, font, size, name="lettering", depth=0.004, spacing=1.0):
    """Words as a thin mesh lying in the XZ plane, facing -Y (the camera), centred on its
    own middle: foil stamped on a spine. `font`: a .ttf under node_modules/@expo-google-fonts."""
    cu = bpy.data.curves.new(name, "FONT")
    cu.body = text
    cu.font = bpy.data.fonts.load(os.path.join(REPO, "node_modules/@expo-google-fonts", font))
    cu.size = size
    cu.extrude = depth
    cu.space_character = spacing
    cu.align_x, cu.align_y = "CENTER", "CENTER"
    cu.resolution_u = 6
    ob = bpy.data.objects.new(name + "_text", cu)
    bpy.context.scene.collection.objects.link(ob)
    bpy.context.view_layer.update()
    deps = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(deps))
    bpy.data.objects.remove(ob)
    out = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(out)
    out.rotation_euler = (math.radians(90), 0, 0)
    kit.apply_transforms(out)
    return out


def place(ob, location=(0, 0, 0), turn=0.0):
    """Move an object and turn it about Z (degrees)."""
    ob.location = location
    ob.rotation_euler = (0, 0, math.radians(turn))
    return ob


def about(point, axis, degrees):
    """A rotation about an axis through a point."""
    p = Vector(point)
    return Matrix.Translation(p) @ Matrix.Rotation(math.radians(degrees), 4, Vector(axis)) @ Matrix.Translation(-p)


def coffee(name="coffee"):
    """Black coffee: a warm near-black that keeps its colour where the room would mirror in it."""
    t = M.Tree(name)
    b = t.principled(**{"Base Color": (0.050, 0.020, 0.008), "Roughness": 0.22, "Specular IOR Level": 0.25,
                        "Coat Weight": 0.35, "Coat Roughness": 0.05})
    return t.surface(b)

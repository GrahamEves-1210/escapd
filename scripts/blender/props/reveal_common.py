# Shared by the reveal props (the lamp, the mirror, the red lens, the pencil, the notepad's
# binding, the paperweight: src/play2/tools/*). They are all drawn into flat scenes the game
# lays out in points, so each script works in points too:
#
#   PT = <points per Blender unit>     # chosen so the prop is about 2 units big (the materials' scale)
#   cam = flat_camera(w_pt, h_pt, PT, centre=(x, z))   # a picture exactly w x h points, straight on
#   ... kit.studio(cam, ...); kit.outline(...); src = kit.render(...)
#   export.export(src, "assets/reveal/<name>.png", sizes=(w_pt, h_pt), canvas=True)
#
# Flat-lay props (things lying on the desk, seen from above) are built standing up, facing -Y,
# and shot with the "front" camera: the house key light is then upper left in the picture, as
# it is for everything else (a "top" camera would put it lower left).
import io
import math
import os
import subprocess
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import bpy  # noqa: E402
import bmesh  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

from PIL import Image  # noqa: E402

import export  # noqa: E402
import kit  # noqa: E402
import materials as M  # noqa: E402

SAMPLES = int(os.environ.get("SAMPLES", 96))
SS = int(os.environ.get("SS", 2))   # SS=1 SAMPLES=32 for a quick draft


def scene(w_pt, h_pt, samples=SAMPLES, glass=False):
    """A fresh scene whose picture is w x h points (rendered at 3x, supersampled 2x)."""
    kit.reset()
    kit.setup(size=(round(w_pt * 3), round(h_pt * 3)), ss=SS, samples=samples, transparent_glass=glass)


def flat_camera(w_pt, h_pt, pt, centre=(0.0, 0.0), elev=0.0):
    """Straight on (or `elev` degrees above/below), the picture exactly w x h points at `pt`
    points a unit, centred on (x, z) = centre."""
    cam = kit.camera("front", target=(centre[0], 0.0, centre[1]), span=max(w_pt, h_pt) / pt, elev=elev)
    return cam


def anchor(cam, point, w_pt, h_pt):
    """A world point as points from the picture's top left (what the app positions by)."""
    x, y = kit.project(cam, point)
    return (round(x * w_pt, 2), round(y * h_pt, 2))


def mesh_object(name, verts, faces, smooth=True, sharp=32.0):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    if smooth:
        kit.shade(ob, sharp)
    return ob


def tube(points, radius, segments=20, name="tube", cap=True):
    """A round tube along a 3D polyline. `radius` is a number or f(arc length) -> radius
    (ribs, a taper). Frames are carried along the path, so it doesn't twist."""
    pts = [Vector(p) for p in points]
    rf = radius if callable(radius) else (lambda s: radius)
    tangents = []
    for i in range(len(pts)):
        a, b = pts[max(0, i - 1)], pts[min(len(pts) - 1, i + 1)]
        tangents.append((b - a).normalized())
    up = Vector((0, 1, 0)) if abs(tangents[0].y) < 0.9 else Vector((1, 0, 0))
    n = (up - tangents[0] * up.dot(tangents[0])).normalized()
    verts, faces, s = [], [], 0.0
    for i, (p, t) in enumerate(zip(pts, tangents)):
        if i:
            s += (p - pts[i - 1]).length
        n = (n - t * n.dot(t)).normalized()
        b = t.cross(n)
        r = rf(s)
        for j in range(segments):
            a = 2 * math.pi * j / segments
            verts.append(tuple(p + (n * math.cos(a) + b * math.sin(a)) * r))
    for i in range(len(pts) - 1):
        for j in range(segments):
            j2 = (j + 1) % segments
            faces.append((i * segments + j, i * segments + j2, (i + 1) * segments + j2, (i + 1) * segments + j))
    if cap:
        faces.append(tuple(range(segments)))
        faces.append(tuple(range((len(pts) - 1) * segments, len(pts) * segments)))
    return mesh_object(name, verts, faces)


def moulding(path, profile, name="moulding", closed=True, bump=None):
    """A frame moulding: `profile` [(out, proud), ...] swept along `path` [(x, z), ...] in the
    wall's plane (y = 0, facing the camera on -Y). `out` is the distance outward from the path
    (the path runs anticlockwise seen from the camera, so outward is to its right... the sign is
    handled here: positive is away from the enclosed middle), `proud` how far it stands off
    the wall. Corners are mitred. bump(s, k) -> extra proud for path length s at profile point k
    (carving)."""
    n = len(path)
    area = sum(path[i][0] * path[(i + 1) % n][1] - path[(i + 1) % n][0] * path[i][1] for i in range(n))
    sign = 1.0 if area > 0 else -1.0  # anticlockwise in (x, z): outward is the right-hand normal
    verts, faces, s = [], [], 0.0
    k = len(profile)
    for i in range(n):
        p = Vector(path[i])
        a = Vector(path[(i - 1) % n]) if (closed or i > 0) else None
        b = Vector(path[(i + 1) % n]) if (closed or i < n - 1) else None
        d1 = (p - a).normalized() if a is not None else (b - p).normalized()
        d2 = (b - p).normalized() if b is not None else d1
        n1 = Vector((d1.y, -d1.x)) * sign
        n2 = Vector((d2.y, -d2.x)) * sign
        m = (n1 + n2)
        m = m.normalized() / max(0.3, m.normalized().dot(n1)) if m.length > 1e-6 else n1
        if i:
            s += (p - Vector(path[i - 1])).length
        for j, (out, proud) in enumerate(profile):
            q = p + m * out
            verts.append((q.x, -(proud + (bump(s, j) if bump else 0.0)), q.y))
    rings = n if closed else n - 1
    for i in range(rings):
        i2 = (i + 1) % n
        for j in range(k - 1):
            faces.append((i * k + j, i * k + j + 1, i2 * k + j + 1, i2 * k + j))
    return mesh_object(name, verts, faces, sharp=40.0)


def lay_flat(objects, name="prop"):
    """Parts turned round Z (kit.lathe) stood up to face the camera: what was +Z now points at -Y,
    so the picture is the part seen from above. Returns the group's empty."""
    root = kit.group(objects, name)
    root.rotation_euler = (math.radians(90), 0, 0)
    bpy.context.view_layer.update()
    return root


def wall_shadow(y, x0, x1, z0, z1, reach=0.08, strength=0.8):
    """The kit's contact shadow on an upright sheet at depth y (the desk or page a flat-lay prop
    lies on), only within the rectangle given: a soft plum shadow in the alpha where the prop
    sits close above it."""
    span = max(x1 - x0, z1 - z0)
    p = kit.contact_shadow(0.0, span=span, strength=strength, reach=reach / (span * 1.5))
    p.rotation_euler = (math.radians(90), 0, 0)
    p.scale = ((x1 - x0) / (span * 12), (z1 - z0) / (span * 12), 1)
    p.location = ((x0 + x1) / 2, y, (z0 + z1) / 2)
    bpy.context.view_layer.update()
    return p


def boolean(ob, cutter, operation="DIFFERENCE"):
    """Cut `ob` with `cutter` (kept hidden); faces the cutter leaves keep the cutter's material."""
    for m in cutter.data.materials:
        if m.name not in [x.name for x in ob.data.materials]:
            ob.data.materials.append(m)
    mod = ob.modifiers.new("cut", "BOOLEAN")
    mod.operation = operation
    mod.solver = "EXACT"
    mod.object = cutter
    try:
        mod.material_mode = "TRANSFER"
    except Exception:
        pass
    cutter.hide_render = True
    cutter.hide_viewport = True
    cutter["kit_rig"] = True
    return ob


def ink_over_shadow():
    """After kit.outline(), for a prop with a wall_shadow behind all of it: the outer line is the prop's
    whole silhouette (the kit's outer line is the edge against the empty film, and here the shadow's
    sheet is behind every edge, so there would be none)."""
    for ls in bpy.context.view_layer.freestyle_settings.linesets:
        if ls.name == "outer":
            ls.select_silhouette = True


def asset_path(dest):
    """Where a picture is written: under the repo, or (a draft: $REVEAL_DRAFT_DIR set) in that folder, so a
    half-made picture never lands in assets/ where the app or its tests would pick it up."""
    draft = os.environ.get("REVEAL_DRAFT_DIR")
    if draft:
        return os.path.join(draft, os.path.basename(dest))
    return dest if os.path.isabs(dest) else os.path.join(export.REPO, dest)


def fewer_colours(im, colours):
    """PNG bytes of `im` with a palette of `colours` (pngquant, then oxipng), or None without pngquant."""
    exe = export._pngquant()
    if not exe:
        return None
    buf = io.BytesIO()
    im.save(buf, "PNG")
    p = subprocess.run([exe, str(colours), "--speed", "1", "--strip", "-"], input=buf.getvalue(), capture_output=True)
    if p.returncode != 0 or not p.stdout:
        return None
    try:
        import oxipng
        return oxipng.optimize_from_memory(p.stdout, level=6, strip=oxipng.StripChunks.safe())
    except Exception:
        return p.stdout


def ship(src, dest, sizes, budget_kb=150, scales=(1, 2, 3), errors=(7.0, 10.0, 14.0, 20.0, 28.0)):
    """export.export(..., canvas=True) for pictures that may not fit the budget as they come: each size
    is written with the exporter's own encoder, which keeps a 256-colour palette only if it is faithful
    (error <= 7); a file still over the budget is tried again with a little more error allowed, as
    little as gets it under (`errors`: the steps tried; start above 7 for a picture whose palette has been
    looked at and is fine). Prints what it took. Look at the result: this is where banding would show."""
    im = export.load(src) if isinstance(src, str) else src
    dest = asset_path(dest)
    base, ext = os.path.splitext(dest)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    total = 0
    for k in scales:
        out = export.resize(im, (round(sizes[0] * k), round(sizes[1] * k)))
        for err in errors:
            data, how = export.encode(out, True, max_error=err)
            if len(data) / 1024 <= budget_kb:
                break
        if len(data) / 1024 > budget_kb:
            # Still over at the most error allowed: a smaller palette, as long as it is no further off than that.
            for colours in (192, 160, 128):
                small = fewer_colours(out, colours)
                if small and len(small) / 1024 <= budget_kb and export._error(out, Image.open(io.BytesIO(small))) <= errors[-1]:
                    data, how = small, f"pngquant {colours}+oxipng"
                    break
        name = dest if k == 1 else f"{base}@{k}x{ext}"
        with open(name, "wb") as f:
            f.write(data)
        kb = len(data) / 1024
        print(f"  {os.path.relpath(name, export.REPO)}  {out.width}x{out.height}  {kb:.1f} KB  ({how}, error <= {err:g})" + ("  ** over budget **" if kb > budget_kb else ""))
        total += len(data)
    return total


def out_dir(args=None):
    args = sys.argv[1:] if args is None else args
    return args[0] if args and not args[0].startswith("-") else export.scratch("reveal")


__all__ = ["bpy", "bmesh", "Matrix", "Vector", "export", "kit", "M", "math", "os", "sys", "SAMPLES", "scene", "flat_camera", "anchor",
           "mesh_object", "tube", "moulding", "lay_flat", "wall_shadow", "ink_over_shadow", "asset_path", "ship", "boolean", "out_dir"]

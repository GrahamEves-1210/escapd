# The cat in the darkroom (the build wait, src/screens/develop/Darkroom.tsx): Escapd's black cat
# sitting on the bench at the back, between the tray and the bottle, its head turned to the tray to
# watch the pictures come up. It is modelled here and rendered into the bench picture by
# darkroom_set.py (one camera, one safelight: it sits in the room's own perspective, scale and red
# light, and casts its shadow on the walnut). Its build: a big round head with wide-set pointed ears,
# a long neck, a slim upright body over its haunches, its forelegs straight down, the tail wrapped
# round its feet, and the two yellow eyes with slit pupils (the art's: assets/characters/cat_sit.png).
#
# Its eyes are separate objects so the bench can be rendered a second time with them shut
# (darkroom_set.py `lids`): the app cuts the head out of that render and shows it for a blink.
#
#   <bpy python> scripts/blender/props/darkroom_cat.py      # a quick look at the cat alone (DRAFT_DIR)
from darkroom_common import *  # noqa: F401,F403

# Where it sits on the bench (units; the tray's middle is the origin) and which way it faces.
SEAT = (0.60, BENCH_BACK - 0.31)
HEIGHT = 0.84                  # its ears' tips over the bench
FACE = 18.0                    # its body turned toward the tray, degrees from facing the camera
LOOK = 20.0                    # its head turned further, and tipped down to the liquid
TIP = 14.0
EYE = (0.984, 0.757, 0.361)    # #FBC15C, the art's eyes (linear below)
FUR = (0.018, 0.012, 0.021)      # a black cat's black, a touch of plum: its edges catch the red, the rest stays dark
INNER = (0.16, 0.11, 0.17)        # inside its ears, the art's dusty violet
GROW = float(os.environ.get("CAT_GROW", 1.8))


def _meta(name, elements):
    """A metaball body from (kind, centre, radius, size, rotation) parts, made into a mesh."""
    mb = bpy.data.metaballs.new(name)
    mb.resolution = 0.012
    mb.render_resolution = 0.012
    mb.threshold = 0.6
    ob = bpy.data.objects.new(name, mb)
    bpy.context.scene.collection.objects.link(ob)
    for kind, co, r, size, rot in elements:
        e = mb.elements.new(type=kind)
        e.co = co
        e.radius = r * GROW   # a lone ball's surface sits at about 0.47 of its radius at this threshold
        if size is not None:
            e.size_x, e.size_y, e.size_z = size
        if rot is not None:
            e.rotation = rot
    bpy.context.view_layer.update()
    deps = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(deps))
    bpy.data.objects.remove(ob)
    out = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(out)
    kit.shade(out, 80.0)
    return out


def _q(axis, deg):
    from mathutils import Quaternion
    return Quaternion(axis, math.radians(deg))


def _ear(side, head_c, r):
    """A big pointed ear: a cone flattened front to back, tipped outward, with a hollow facing forward."""
    h, base = 0.23, 0.095
    n = 24
    verts = [(0.0, 0.0, h)]
    for i in range(n):
        a = 2 * math.pi * i / n
        verts.append((base * math.cos(a), base * 0.42 * math.sin(a), 0.0))
    verts.append((0.0, 0.0, -0.02))
    faces = [(0, 1 + i, 1 + (i + 1) % n) for i in range(n)] + [(n + 1, 1 + (i + 1) % n, 1 + i) for i in range(n)]
    ob = mesh_object(f"ear{side}", verts, faces, smooth=True, sharp=70.0)
    ob.rotation_euler = (math.radians(-10), math.radians(side * 34), math.radians(side * 14))
    ob.location = (head_c[0] + side * r * 0.66, head_c[1] + 0.015, head_c[2] + r * 0.50)
    # Its hollow: a smaller, flatter cone just in front, in the inner ear's violet.
    k = 0.62
    inner = mesh_object(f"ear_inner{side}", [(x * k, y * 0.5 - 0.022, z * 0.80 + 0.012) for x, y, z in verts], faces, smooth=True, sharp=70.0)
    inner.rotation_euler = ob.rotation_euler
    inner.location = ob.location
    return ob, inner


def build_cat():
    """The cat, built facing -Y (the camera) at the origin; returns (body parts, eyes). The caller places it."""
    head_c = (0.0, -0.035, 0.63)
    hr = 0.135
    body = _meta("cat_body", [
        # Haunches, wide and low; the belly; the chest rising to a slim neck.
        ("ELLIPSOID", (0.0, 0.05, 0.13), 0.17, (1.0, 1.05, 0.85), None),
        ("ELLIPSOID", (-0.10, 0.04, 0.10), 0.10, (1.0, 1.25, 0.9), None),
        ("ELLIPSOID", (0.10, 0.04, 0.10), 0.10, (1.0, 1.25, 0.9), None),
        ("ELLIPSOID", (0.0, -0.01, 0.30), 0.12, (0.85, 0.80, 1.45), _q((1, 0, 0), -10)),
        ("BALL", (0.0, -0.035, 0.47), 0.075, None, None),
        # Forelegs, straight down to small round paws.
        ("CAPSULE", (-0.048, -0.075, 0.17), 0.052, (0.12, 1, 1), _q((0, 1, 0), 90)),
        ("CAPSULE", (0.048, -0.075, 0.17), 0.052, (0.12, 1, 1), _q((0, 1, 0), 90)),
        ("ELLIPSOID", (-0.05, -0.105, 0.03), 0.05, (1.0, 1.3, 0.6), None),
        ("ELLIPSOID", (0.05, -0.105, 0.03), 0.05, (1.0, 1.3, 0.6), None),
    ])
    head = _meta("cat_head", [
        ("ELLIPSOID", head_c, hr, (1.18, 0.92, 0.96), None),
        # Cheeks, and a small muzzle.
        ("ELLIPSOID", (-0.07, head_c[1] - 0.035, head_c[2] - 0.045), 0.07, (1.0, 0.8, 0.8), None),
        ("ELLIPSOID", (0.07, head_c[1] - 0.035, head_c[2] - 0.045), 0.07, (1.0, 0.8, 0.8), None),
        ("ELLIPSOID", (0.0, head_c[1] - 0.10, head_c[2] - 0.05), 0.045, (1.0, 0.8, 0.75), None),
    ])
    ears = [part for s in (-1, 1) for part in _ear(s, head_c, hr)]
    # The tail: from under the haunches round the right side to lie over the front paws.
    pts = []
    for i in range(25):
        t = i / 24
        a = math.radians(80 - 175 * t)
        rr = 0.19 - 0.02 * t
        pts.append((rr * math.cos(a), 0.04 + rr * math.sin(a), 0.024))
    tail = tube(pts, lambda s: 0.024 - 0.008 * min(1.0, s / 0.55), segments=16, name="cat_tail")
    # The eyes: big yellow almonds with slit pupils, set wide on the face, looking down at the tray.
    eyes = []
    for s in (-1, 1):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.044, segments=28, ring_count=14)
        eye = bpy.context.object
        eye.name = f"eye{s}"
        eye.scale = (1.0, 0.55, 1.08)
        eye.rotation_euler = (0, math.radians(s * -12), math.radians(s * 18))
        eye.location = (s * 0.062, head_c[1] - hr * 0.86, head_c[2] + 0.012)
        kit.shade(eye)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.040, segments=16, ring_count=8)
        pupil = bpy.context.object
        pupil.name = f"pupil{s}"
        pupil.scale = (0.16, 0.30, 0.86)
        pupil.rotation_euler = eye.rotation_euler
        pupil.location = (eye.location.x + s * 0.004, eye.location.y - 0.014, eye.location.z)
        kit.shade(pupil)
        eyes += [eye, pupil]
    return [body, head, tail] + ears, eyes


def place_cat():
    """The cat built and seated on the bench, turned to the tray. Returns (fur parts, eye whites, pupils)."""
    fur_parts, eyes = build_cat()
    bpy.context.view_layer.update()
    whites = [e for e in eyes if e.name.startswith("eye")]
    pupils = [e for e in eyes if e.name.startswith("pupil")]
    # The head and its parts turn further toward the tray and tip down to it, about the neck.
    neck = Vector((0.0, -0.035, 0.50))
    turn = Matrix.Translation(neck) @ (Matrix.Rotation(math.radians(-LOOK), 4, "Z") @ Matrix.Rotation(math.radians(-TIP), 4, "X")) @ Matrix.Translation(-neck)
    for ob in fur_parts + eyes:
        if ob.name.startswith(("cat_head", "ear", "eye", "pupil")):
            ob.matrix_world = turn @ ob.matrix_world
    bpy.context.view_layer.update()
    # Scale to HEIGHT and seat it, turned toward the tray.
    k = HEIGHT / 0.86
    seat = Matrix.Translation((SEAT[0], SEAT[1], 0.0)) @ Matrix.Rotation(math.radians(-FACE), 4, "Z") @ Matrix.Scale(k, 4)
    for ob in fur_parts + eyes:
        ob.matrix_world = seat @ ob.matrix_world
    fur = M.felt("cat_fur", color=FUR, nap=1.0, scale=0.4)
    violet = M.felt("cat_ear", color=INNER, nap=0.6, scale=0.4)
    for ob in fur_parts:
        kit.assign(ob, violet if ob.name.startswith("ear_inner") else fur)
    yellow = tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in EYE)
    for ob in whites:
        kit.assign(ob, M.glow("cat_eye", color=yellow, strength=1.6, falloff=0.35))
    for ob in pupils:
        kit.assign(ob, M.ink("cat_pupil"))
    return fur_parts, whites, pupils


def head_box(cam):
    """The cat's head in the bench picture (points), with air round it: where the blink is cut from."""
    pts = []
    for ob in bpy.data.objects:
        if ob.name.startswith(("cat_head", "ear", "eye", "pupil")):
            for v in ob.data.vertices:
                p = ob.matrix_world @ v.co
                x, y = kit.project(cam, tuple(p))
                pts.append((x * PIC_W, y * PIC_H))
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    pad = 3
    return (math.floor(min(xs) - pad), math.floor(min(ys) - pad), math.ceil(max(xs) + pad), math.ceil(max(ys) + pad))


if __name__ == "__main__":
    # A quick look at the cat alone, from the bench camera (CAT_VIEW=front: square on, unturned, close).
    front = os.environ.get("CAT_VIEW") == "front"
    scene(PIC_W, PIC_H, samples=32)
    if front:
        FACE = LOOK = TIP = 0.0
        SEAT = (0.0, 0.0)
    parts = place_cat()
    cam = kit.camera("front", target=(0.0, 0.0, 0.43), span=1.1, elev=8) if front else bench_camera()
    kit.studio(cam, span=3.0, target=(0.0, 0.0, 0.1))
    path = kit.render(os.path.join(export.scratch("darkroom"), "cat_alone.png"))
    print("rendered", path, "head box", head_box(cam))

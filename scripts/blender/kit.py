# Escapd's Blender kit: one studio, one camera language, one ink line, so every
# rendered prop looks like it came off the same desk. Headless (bpy as a Python
# module), Cycles on the CPU. Read README.md first.
#
#   import kit, materials as M, export
#   kit.reset(); kit.setup(size=(264, 264))
#   obj = kit.lathe([(0, 0), (0.5, 0), (0.5, 1), (0, 1)]); kit.assign(obj, M.brass())
#   cam = kit.camera("product"); kit.fit(cam); kit.studio(cam); kit.outline(2.0)
#   kit.render("/tmp/x.png"); export.export("/tmp/x.png", "assets/x/thing.png", sizes=(88, 88))
#
# Conventions (README.md has the why): metres are "units", an asset is about 2
# units on its long side, Z is up, the camera sits on -Y (so +X is screen
# right), the key light is warm and upper left *in the picture* whatever the
# camera's turn, the rim is cool and behind on the right.
import math
import os

import bpy  # isort: skip (bpy must load first: it provides bmesh and mathutils)
import bmesh
import numpy as np
from mathutils import Vector

# The cat's line: a plum-black ink, never pure black.
INK = (0.016, 0.010, 0.018)
# Light colours (linear): candle-warm key, moonlit rim, a fill that keeps shadows plum rather than grey.
WARM = (1.0, 0.82, 0.60)
COOL = (0.55, 0.70, 1.0)
FILL = (0.92, 0.80, 0.86)

_state = {"ss": 2, "size": (264, 264)}


# ---------------------------------------------------------------- scene


def reset():
    """An empty scene (no default cube, no leftover data)."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    s = bpy.context.scene
    s.unit_settings.system = "METRIC"
    return s


def setup(size=(264, 264), ss=2, samples=96, look="standard", transparent_glass=False, threads=4):
    """Render settings. `size` is the largest size the picture is exported at (the
    app's size x3); it is rendered `ss` times bigger and scaled down by export.py
    (cleaner edges and outline than more samples would buy).

    look: "standard" (the house look: Standard view + Medium High Contrast, which
    keeps brass saturated right up into its highlights), "agx" (AgX Punchy:
    gentler highlights, greyer brass; for glowing things that clip) or "neutral"
    (Khronos PBR Neutral)."""
    s = bpy.context.scene
    _state["ss"], _state["size"] = ss, size
    r = s.render
    r.engine = "CYCLES"
    r.resolution_x, r.resolution_y, r.resolution_percentage = size[0] * ss, size[1] * ss, 100
    r.film_transparent = True
    r.image_settings.file_format = "PNG"
    r.image_settings.color_mode = "RGBA"
    r.image_settings.color_depth = "8"
    r.image_settings.compression = 15
    r.threads_mode = "FIXED"
    r.threads = threads
    r.use_persistent_data = False
    c = s.cycles
    c.device = "CPU"
    c.samples = samples
    c.use_adaptive_sampling = True
    c.adaptive_threshold = 0.02
    c.use_denoising = True
    c.denoiser = "OPENIMAGEDENOISE"
    c.denoising_input_passes = "RGB_ALBEDO_NORMAL"
    # Small props: a few bounces are plenty; no caustics (fireflies for nothing).
    c.max_bounces, c.diffuse_bounces, c.glossy_bounces = 8, 2, 4
    c.transmission_bounces, c.transparent_max_bounces, c.volume_bounces = 8, 12, 0
    c.caustics_reflective = c.caustics_refractive = False
    c.sample_clamp_indirect = 6.0
    c.film_transparent_glass = transparent_glass
    c.film_transparent_roughness = 0.2
    c.pixel_filter_type = "BLACKMAN_HARRIS"
    c.filter_width = 1.5
    v = s.view_settings
    if look == "agx":
        v.view_transform, v.look = "AgX", "AgX - Punchy"
    elif look == "neutral":
        v.view_transform, v.look = "Khronos PBR Neutral", "None"
    else:
        v.view_transform, v.look = "Standard", "Medium High Contrast"
    v.exposure, v.gamma = 0.0, 1.0
    s.display_settings.display_device = "sRGB"
    return s


# ---------------------------------------------------------------- camera


VIEWS = {
    # name: (elevation, azimuth) in degrees. Azimuth turns the camera to the right of the object.
    "product": (28.0, 28.0),   # the 3/4 view: a little above, a little to the right, so the key (left) lights the near face
    "front": (0.0, 0.0),       # straight on (plates, dials, panels, anything read like a page)
    "held": (26.0, 0.0),       # straight on but from above: a thing held upright, seen down into its top
    "top": (90.0, 0.0),        # flat lay (paper, cards, things on a desk)
}


def camera(view="product", target=(0, 0, 0), span=2.4, elev=None, azim=None, distance=20.0):
    """An orthographic camera (no perspective: props keep their proportions at any
    size and line up with the game's flat paper). `span` is how many units fit
    across the picture's longer side; fit() sets it from the objects instead."""
    e, a = VIEWS[view]
    e = math.radians(e if elev is None else elev)
    a = math.radians(a if azim is None else azim)
    data = bpy.data.cameras.new("camera")
    data.type = "ORTHO"
    data.ortho_scale = span
    data.clip_start, data.clip_end = 0.1, distance * 3
    cam = bpy.data.objects.new("camera", data)
    bpy.context.scene.collection.objects.link(cam)
    t = Vector(target)
    d = Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e)))
    cam.location = t + d * distance
    cam.rotation_euler = (-d).to_track_quat("-Z", "Y").to_euler()
    cam["azim"] = a
    bpy.context.scene.camera = cam
    bpy.context.view_layer.update()
    return cam


def fit(cam, objects=None, margin=1.08):
    """Centre the camera on the objects (default: every mesh) and size its view to
    hold them with a margin (room for the outline and a shadow)."""
    bpy.context.view_layer.update()
    deps = bpy.context.evaluated_depsgraph_get()
    objects = objects or [o for o in bpy.context.scene.objects if o.type in {"MESH", "CURVE"} and not o.get("kit_rig")]
    inv = cam.matrix_world.inverted()
    pts = []
    for o in objects:
        ev = o.evaluated_get(deps)
        pts += [inv @ (ev.matrix_world @ Vector(c)) for c in ev.bound_box]
    xs, ys = [p.x for p in pts], [p.y for p in pts]
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    w, h = max(xs) - min(xs), max(ys) - min(ys)
    cam.location += cam.matrix_world.to_3x3() @ Vector((cx, cy, 0))
    rx, ry = _state["size"]
    cam.data.ortho_scale = margin * (max(w, h * rx / ry) if rx >= ry else max(h, w * ry / rx))
    bpy.context.view_layer.update()
    return cam


def project(cam, point):
    """Where a world point lands in the picture: (x, y) as fractions of its width and
    height from the top left. For anchors the app needs (a pivot, a lens centre, a wick)."""
    bpy.context.view_layer.update()
    p = cam.matrix_world.inverted() @ Vector(point)
    rx, ry = _state["size"]
    sx = cam.data.ortho_scale if rx >= ry else cam.data.ortho_scale * rx / ry
    sy = sx * ry / rx
    return (0.5 + p.x / sx, 0.5 - p.y / sy)


# ---------------------------------------------------------------- light


def _area(name, loc, target, size, energy, color, parent, shape="RECTANGLE", size_y=None, gloss=1.0):
    """An area light aimed at `target`. gloss > 1: reflections see it that many times brighter
    than matte surfaces do (a twin light that only glossy rays see)."""
    made = []
    for twin in (False, True):
        if twin and gloss <= 1.0:
            break
        data = bpy.data.lights.new(name, "AREA")
        data.shape = shape
        data.size = size
        if shape == "RECTANGLE":
            data.size_y = size_y or size
        data.energy = energy * (gloss - 1.0) if twin else energy
        data.color = color
        o = bpy.data.objects.new(name + ("_gloss" if twin else ""), data)
        bpy.context.scene.collection.objects.link(o)
        o.parent = parent
        o.location = loc
        o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
        o["kit_rig"] = True
        if twin:
            o.visible_diffuse = False
        made.append(o)
    return made[0]


def studio(cam=None, span=2.0, target=(0, 0, 0), key=1.0, fill=1.0, rim=1.0, ambient=1.0,
           gloss=2.4, shadow=None, shadow_strength=0.8, shadow_reach=0.3, warm=WARM, cool=COOL):
    """The house lighting, turned to face the camera so it reads the same in every picture:
    - key: a big warm softbox, upper left, a little in front (candle / desk lamp);
    - rim: a cool strip behind on the right (moonlight on the far edge);
    - fill: a wide, dim, slightly plum card low on the right (shadows stay coloured, never black);
    - a dim studio world so metal has something to reflect (dark floor, soft ceiling).
    `span` is the object's rough size in units (lights are placed and powered to it).
    key/fill/rim/ambient scale each part (1 = house look).
    gloss: how much brighter the lights are in reflections than on matte surfaces (the
    photographer's trick: brass and glass get rich highlights while paper, felt and
    enamel keep their colour instead of bleaching). Leave it alone unless a prop is
    all metal (lower it) or all matte (it makes no difference).
    shadow: a z height puts the ground there and draws a soft contact shadow on it, kept
    in the picture's alpha (see contact_shadow)."""
    s = bpy.context.scene
    k = span / 2.0
    rig = bpy.data.objects.new("studio", None)
    s.collection.objects.link(rig)
    rig["kit_rig"] = True
    rig.location = target
    rig.rotation_euler = (0, 0, cam.get("azim", 0.0) if cam else 0.0)
    e = k * k / gloss  # area lights: power for the same look scales with distance squared
    _area("key", (-2.6 * k, -2.4 * k, 3.4 * k), (0, 0, 0.1 * k), 3.2 * k, 520 * e * key, warm, rig, gloss=gloss)
    _area("rim", (2.9 * k, 2.6 * k, 1.6 * k), (0, 0, 0.2 * k), 0.9 * k, 420 * e * rim, cool, rig, size_y=3.6 * k, gloss=gloss)
    _area("fill", (3.0 * k, -3.2 * k, 0.4 * k), (0, 0, 0), 4.5 * k, 70 * e * fill, FILL, rig, gloss=gloss)
    # A small hard kicker high on the left: the crisp glint on brass and glass (reflections only).
    glint = _area("glint", (-1.5 * k, -3.0 * k, 4.2 * k), (0, 0, 0.3 * k), 0.5 * k, 110 * k * k * key, (1.0, 0.95, 0.88), rig, shape="DISK")
    glint.visible_diffuse = False

    w = bpy.data.worlds.new("studio")
    s.world = w
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld")
    bg = nt.nodes.new("ShaderNodeBackground")
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    mp = nt.nodes.new("ShaderNodeMapRange")
    mp.inputs["From Min"].default_value, mp.inputs["From Max"].default_value = -1.0, 1.0
    # Looking down: a dark plum floor. Horizon: a dim warm wall. Up: a soft warm ceiling.
    cr = ramp.color_ramp
    cr.elements[0].position, cr.elements[0].color = 0.0, (0.012, 0.008, 0.014, 1)
    cr.elements[1].position, cr.elements[1].color = 1.0, (0.50, 0.42, 0.36, 1)
    for pos, col in ((0.42, (0.030, 0.020, 0.028, 1)), (0.56, (0.16, 0.12, 0.11, 1)), (0.8, (0.34, 0.28, 0.24, 1))):
        el = cr.elements.new(pos)
        el.color = col
    nt.links.new(geo.outputs["Incoming"], sep.inputs[0])
    nt.links.new(sep.outputs["Z"], mp.inputs["Value"])
    nt.links.new(mp.outputs[0], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bg.inputs["Color"])
    lp = nt.nodes.new("ShaderNodeLightPath")
    dim = nt.nodes.new("ShaderNodeMapRange")  # matte surfaces see the room 1/gloss as bright
    dim.inputs["To Min"].default_value, dim.inputs["To Max"].default_value = 0.9 * ambient, 0.9 * ambient / gloss
    nt.links.new(lp.outputs["Is Diffuse Ray"], dim.inputs["Value"])
    nt.links.new(dim.outputs[0], bg.inputs["Strength"])
    nt.links.new(bg.outputs[0], out.inputs["Surface"])

    if shadow is not None:
        contact_shadow(shadow, span, target, shadow_strength, shadow_reach)
    return rig


def window(cam, at=(0, 0, 0), normal=(0, -1, 0), toward=(-0.6, 0.6), spread=13.0, size=1.1, strength=1.0,
           panes=2, span=2.0, only=None, color=(1.0, 0.95, 0.88)):
    """The highlight on flat glass (a lens, a watch crystal, a picture's glazing, a polished
    enamel face): a small paned window, seen only in reflections, placed where the surface
    at `at` with `normal` mirrors it back to the camera. The studio's softboxes sit too far
    round to show in glass that faces the viewer; this is the room's window behind them.
    toward: where on the glass the highlight sits, from its middle, in picture terms
    (x right, y up; (-0.6, 0.6) = upper left, the key's side). spread: how far (degrees)
    the window is swung that way: about the glass's edge slope puts it halfway out.
    panes: 2 = a four-pane window, 1 = a plain soft square.
    only: the glass objects; given, nothing else is lit by the window (brass round a
    lens would bleach). Give it."""
    k = span / 2.0
    n = Vector(normal).normalized()
    m = cam.matrix_world.to_3x3()
    right, up, view = m @ Vector((1, 0, 0)), m @ Vector((0, 1, 0)), m @ Vector((0, 0, 1))  # view: from the scene to the camera
    r = (2 * n.dot(view) * n - view).normalized()
    d = (r + math.tan(math.radians(spread)) * (toward[0] * right + toward[1] * up)).normalized()
    centre = Vector(at) + d * 4.0 * k
    # The window's own axes, facing the glass.
    wx = d.cross(up).normalized()
    wy = wx.cross(d).normalized()
    cell = size * k / panes
    made = []
    for i in range(panes):
        for j in range(panes):
            off = ((i - (panes - 1) / 2) * wx + (j - (panes - 1) / 2) * wy) * cell
            o = _area("window", centre + off, at, cell * 0.86, 60 * k * k * strength / (panes * panes), color, None)
            o.visible_diffuse = False
            made.append(o)
    if only:
        col = bpy.data.collections.new("window_lights_only")
        bpy.context.scene.collection.children.link(col)
        for ob in only:
            col.objects.link(ob)
        for o in made:
            o.light_linking.receiver_collection = col
    return made


def contact_shadow(z=0.0, span=2.0, target=(0, 0, 0), strength=0.8, reach=0.3, color=INK):
    """A soft shadow where the object meets the ground at height z, in the picture's
    alpha: plum ink that fades out within `reach` x span of the object, so it never
    hits the frame's edge and sits on any background (the art direction's "soft and
    coloured by the ground, not black"). It is ambient occlusion on an otherwise
    invisible ground, not a cast shadow: no long streak pointing away from the key,
    which would fight the app's own shadows and the prop's turn. The ground lights
    and reflects nothing. (Cycles' own shadow catcher gives a hard rectangle at the
    frame and a cast streak; this doesn't.)"""
    bpy.ops.mesh.primitive_plane_add(size=span * 12, location=(target[0], target[1], z))
    p = bpy.context.object
    p.name = "ground"
    p["kit_rig"] = True
    for ray in ("diffuse", "glossy", "transmission", "shadow", "volume_scatter"):
        setattr(p, "visible_" + ray, False)
    m = bpy.data.materials.new("contact_shadow")
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    ao = nt.nodes.new("ShaderNodeAmbientOcclusion")
    ao.samples = 24
    ao.inputs["Distance"].default_value = span * reach * 1.5
    inv = nt.nodes.new("ShaderNodeMath")
    inv.operation = "SUBTRACT"
    inv.inputs[0].default_value = 1.0
    shape = nt.nodes.new("ShaderNodeMath")
    shape.operation = "POWER"
    shape.inputs[1].default_value = 2.6
    amt = nt.nodes.new("ShaderNodeMath")
    amt.operation = "MULTIPLY"
    amt.use_clamp = True
    amt.inputs[1].default_value = strength * 3.0
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = tuple(color) + (1.0,)
    mix = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(ao.outputs["AO"], inv.inputs[1])
    nt.links.new(inv.outputs[0], shape.inputs[0])
    nt.links.new(shape.outputs[0], amt.inputs[0])
    nt.links.new(amt.outputs[0], mix.inputs[0])
    nt.links.new(tr.outputs[0], mix.inputs[1])
    nt.links.new(em.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs["Surface"])
    p.data.materials.append(m)
    return p


# ---------------------------------------------------------------- ink line


def outline(weight=2.0, color=INK, creases=True, crease_angle=125.0, borders=False, wobble=0.0, exclude=(), plain=(), run_on=0.0):
    """The ink line (Freestyle): the silhouette and, with `creases`, hard inner edges
    (a bezel's step, a drawer's lip) at 60% of the weight, like a pen pressing less
    inside a shape. `weight` is in pixels **at the exported @3x size** (so it means
    the same whatever the supersampling): house weights are in README.md.
    `wobble` (0..1) lets the line wander a touch, for hand-drawn things.
    Objects in `exclude` (glass, flames, glows) get no line; objects in `plain`
    (knurling, fur, anything busy) get the outer line but no inner ones."""
    s = bpy.context.scene
    ss = _state["ss"]
    s.render.use_freestyle = True
    s.render.line_thickness_mode = "ABSOLUTE"
    s.render.line_thickness = 1.0  # the linesets carry the weight
    vl = bpy.context.view_layer
    vl.use_freestyle = True
    fs = vl.freestyle_settings
    fs.crease_angle = math.radians(crease_angle)
    fs.use_smoothness = True
    for ls in list(fs.linesets):
        fs.linesets.remove(ls)
    def collection(name, objects):
        col = bpy.data.collections.new(name)
        s.collection.children.link(col)
        for o in objects:
            col.objects.link(o)
        return col

    exclude = list(exclude) + [o for o in s.objects if o.get("kit_rig") and o.type == "MESH"]  # the ground is never inked
    no_ink = collection("no_ink", exclude) if exclude else None
    no_inner = collection("no_inner_ink", list(exclude) + list(plain)) if (exclude or plain) else None

    def lineset(name, w, skip=None, **select):
        ls = fs.linesets.new(name)
        for k in ("silhouette", "border", "crease", "contour", "external_contour", "edge_mark",
                  "ridge_valley", "suggestive_contour", "material_boundary"):
            setattr(ls, "select_" + k, bool(select.get(k, False)))
        if skip is not None:
            ls.select_by_collection = True
            ls.collection = skip
            ls.collection_negation = "EXCLUSIVE"
        st = bpy.data.linestyles.new(name)
        ls.linestyle = st
        st.color = color
        st.thickness = w * ss
        st.thickness_position = "CENTER"
        st.caps = "ROUND"
        # Freestyle can break a contour where it hops from one edge loop to another; run_on lets
        # each outer stroke carry on a little so the pen doesn't visibly lift (it also leaves
        # small ticks where strokes meet at an angle, so it's off unless a prop shows gaps).
        if name == "outer" and run_on > 0:
            stretch = st.geometry_modifiers.new("run_on", "BACKBONE_STRETCHER")
            stretch.backbone_length = w * ss * run_on
        if wobble > 0:
            m = st.geometry_modifiers.new("wobble", "PERLIN_NOISE_1D")
            m.frequency, m.amplitude, m.octaves = 6.0, wobble * ss * 1.2, 2
        return ls

    lineset("outer", weight, skip=no_ink, external_contour=True, border=borders)
    if creases:
        lineset("inner", weight * 0.6, skip=no_inner, crease=True, edge_mark=True, contour=True)
    return fs


def no_outline():
    bpy.context.scene.render.use_freestyle = False


# ---------------------------------------------------------------- modelling


def lathe(profile, segments=96, name="lathe", max_len=None, displace=None, smooth=True, sharp=32.0):
    """A turned part: `profile` is a list of (radius, z) from one end to the other,
    spun round Z. Radius 0 at an end closes it with a cap point. `max_len` splits
    long runs (needed where `displace` should have something to move).
    displace(angle, z, r) -> extra radius (arrays in, array out): knurling, flutes, dents.
    UVs: u round the turn (0..1), v along the profile (in units), so textures and
    knurling can follow the lathe."""
    pts = [(float(r), float(z)) for r, z in profile]
    if max_len:
        dense = [pts[0]]
        for a, b in zip(pts, pts[1:]):
            n = max(1, int(math.ceil(math.hypot(b[0] - a[0], b[1] - a[1]) / max_len)))
            dense += [(a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n) for i in range(1, n + 1)]
        pts = dense
    ang = np.linspace(0, 2 * math.pi, segments, endpoint=False)
    verts, rings, vs = [], [], []
    v = 0.0
    for i, (r, z) in enumerate(pts):
        if i:
            v += math.hypot(r - pts[i - 1][0], z - pts[i - 1][1])
        vs.append(v)
        if r <= 1e-9:
            rings.append([len(verts)])
            verts.append((0.0, 0.0, z))
            continue
        rr = np.full(segments, r)
        if displace is not None:
            rr = rr + displace(ang, np.full(segments, z), rr)
        start = len(verts)
        verts += [(float(rr[j] * math.cos(ang[j])), float(rr[j] * math.sin(ang[j])), z) for j in range(segments)]
        rings.append(list(range(start, start + segments)))
    faces, uvs = [], []
    for i in range(len(rings) - 1):
        a, b = rings[i], rings[i + 1]
        va, vb = vs[i], vs[i + 1]
        for j in range(segments):
            j2 = (j + 1) % segments
            u0, u1 = j / segments, (j + 1) / segments
            if len(a) == 1 and len(b) == 1:
                continue
            if len(a) == 1:
                faces.append((a[0], b[j2], b[j]))
                uvs.append((((u0 + u1) / 2, va), (u1, vb), (u0, vb)))
            elif len(b) == 1:
                faces.append((a[j], a[j2], b[0]))
                uvs.append(((u0, va), (u1, va), ((u0 + u1) / 2, vb)))
            else:
                faces.append((a[j], a[j2], b[j2], b[j]))
                uvs.append(((u0, va), (u1, va), (u1, vb), (u0, vb)))
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    uv = me.uv_layers.new(name="UVMap")
    for poly, quad in zip(me.polygons, uvs):
        for li, co in zip(poly.loop_indices, quad):
            uv.data[li].uv = co
    me.update()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    # The profile runs bottom-up or top-down: make the normals point out either way.
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-7)  # a profile that ends where it began closes into a ring
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    if smooth:
        shade(ob, sharp)
    return ob


def knurl(count=44, depth=0.012, pitch=None):
    """A diamond knurl for lathe(displace=...): `count` diamonds round the turn,
    `depth` units proud. `pitch` is the diamond's height along the axis (default: square)."""
    def f(angle, z, r):
        p = pitch or float(np.mean(r)) * 2 * math.pi / count
        a = angle * count / (2 * math.pi)
        b = z / p
        # Two crossing helices of grooves leave diamonds standing.
        g = np.minimum(np.abs(((a + b) % 1.0) - 0.5), np.abs(((a - b) % 1.0) - 0.5)) * 2  # 0 in a groove .. 1 on a peak
        return depth * (np.clip(g * 1.6, 0, 1) - 1.0)
    return f


def flutes(count=18, depth=0.02):
    """Rounded grooves along the axis (a fluted grip, a reeded edge) for lathe(displace=...)."""
    def f(angle, z, r):
        return -depth * (0.5 - 0.5 * np.cos(angle * count)) ** 2
    return f


def shade(ob, sharp=32.0):
    """Smooth shading with edges sharper than `sharp` degrees kept crisp."""
    me = ob.data
    me.shade_smooth()
    try:
        me.set_sharp_from_angle(angle=math.radians(sharp))
    except Exception:
        pass
    return ob


def bevel(ob, width=0.01, segments=2, angle=35.0):
    """Round every hard edge a little: nothing real has a knife edge, and bevels are where
    the key light draws its highlights."""
    m = ob.modifiers.new("bevel", "BEVEL")
    m.width, m.segments, m.limit_method = width, segments, "ANGLE"
    m.angle_limit = math.radians(angle)
    m.harden_normals = False
    return ob


def subsurf(ob, levels=2):
    m = ob.modifiers.new("subsurf", "SUBSURF")
    m.levels = m.render_levels = levels
    return ob


def box(size=(1, 1, 1), location=(0, 0, 0), name="box", bevel_width=0.02, segments=3):
    """A box with rounded edges."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    ob = bpy.context.object
    ob.name = name
    ob.scale = size
    apply_transforms(ob)
    if bevel_width:
        bevel(ob, bevel_width, segments)
        shade(ob, 40)
    return ob


def apply_transforms(ob):
    with bpy.context.temp_override(active_object=ob, object=ob, selected_objects=[ob], selected_editable_objects=[ob]):
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    return ob


def assign(ob, material):
    """Give an object one material."""
    ob.data.materials.clear()
    ob.data.materials.append(material)
    return ob


def group(objects, name="group"):
    """Parent objects to one empty (turn or tilt the whole prop by moving the empty)."""
    e = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(e)
    for o in objects:
        if o.parent is None:
            o.parent = e
    return e


# ---------------------------------------------------------------- render


def render(path, exr=False):
    """Render to `path` (PNG, RGBA, at size x supersampling; export.py scales it down).
    With `exr`, also writes path + ".exr" (linear, premultiplied): export.lift_glass()
    reads it to keep glass highlights that straight-alpha PNG would lose."""
    s = bpy.context.scene
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    s.render.filepath = path
    bpy.ops.render.render(write_still=True)
    if exr:
        img = bpy.data.images["Render Result"]
        st = s.render.image_settings
        keep = (st.file_format, st.color_depth)
        st.file_format, st.color_depth = "OPEN_EXR", "32"
        img.save_render(path + ".exr", scene=s)
        st.file_format, st.color_depth = keep
    return path

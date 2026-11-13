# The darkroom (the build wait, src/screens/develop/Darkroom.tsx): a walnut bench under a red
# safelight, seen from above. On it an enamel developing tray of developer, print tongs, a brown
# glass bottle and the brass safelight itself, its ruby glass lit. One scene, one camera, three
# kinds of picture with the same framing:
#
#   bench       everything but the tray (which still casts its shadow): the still ground of the screen
#   tray        the tray and its liquid alone: the app rocks it, with the player's photos lying in it
#   sheen       twelve frames of the light on the liquid's surface (a loop of slow ripples), which the
#               app lays over the photos so they sit under the liquid (computed, not traced: sheen_frames)
#
# The player's photos are not here: the app lays them into the tray (SHEET, LIQUID and SQUASH,
# printed at the end, say where and how).
#
#   <bpy python> scripts/blender/props/darkroom_set.py [bench] [tray] [sheen]    # default: all three
# The files in assets/develop were made with:
#   PX=2 SS=1 SAMPLES=72 ... darkroom_set.py bench    # the ground is dark and soft: two sizes (the phone scales @2x up), under budget
#   PX=3 SS=1 SAMPLES=72 ... darkroom_set.py tray
#   ... darkroom_set.py sheen
#   PX=1 SS=1 SAMPLES=32 for a quick look; DRAFT_DIR=<dir> keeps drafts out of assets/
from darkroom_common import *  # noqa: F401,F403

OUT = os.environ.get("DRAFT_DIR")
RAW = export.scratch("darkroom")
FRAMES = 12
# The sheen's frame: the liquid's box in the bench picture, a little air round it (points).
LIQ_HW = (TRAY["hw"] + TRAY["level_out"]) * PT
LIQ_HD = (TRAY["hd"] + TRAY["level_out"]) * PT * SQUASH
LIQ_CY = TRAY_Y - TRAY["level"] * PT * math.cos(math.radians(ELEV))
SHEEN_W, SHEEN_H = 2 * round(LIQ_HW + 4), 2 * round(LIQ_HD + 4)
SHEEN_PX = 1.5   # soft light: one and a half pixels a point is plenty, and keeps the sheet of twelve under budget


def developer():
    """The liquid as the tray picture has it: clear, a touch amber, the floor showing through; its
    shine is the sheen frames' job, so here it only has a faint soft gloss."""
    t = M.Tree("developer")
    clear = t.node("ShaderNodeBsdfTransparent")
    t.set(clear.inputs["Color"], (0.60, 0.42, 0.28))
    gloss = t.node("ShaderNodeBsdfGlossy")
    t.set(gloss.inputs["Color"], (1.0, 0.9, 0.8))
    gloss.inputs["Roughness"].default_value = 0.22
    f = t.node("ShaderNodeFresnel")
    f.inputs["IOR"].default_value = 1.33
    mix = t.node("ShaderNodeMixShader")
    t.link(t.math("MULTIPLY", f.outputs[0], 0.8), mix.inputs["Fac"])
    t.link(clear.outputs[0], mix.inputs[1])
    t.link(gloss.outputs[0], mix.inputs[2])
    return t.surface(mix)


def bamboo(name):
    return M.walnut(name, axis="X", color=(0.46, 0.27, 0.10), figure=0.35, gloss=0.45, wear=0.5, scale=1.2)


def build():
    """Everything on the bench. Returns (all objects, {name: object or list})."""
    made, named = [], {}

    def keep(ob, mat=None, name=None):
        if mat is not None:
            kit.assign(ob, mat)
        made.append(ob)
        if name:
            named.setdefault(name, []).append(ob)
        return ob

    # The bench: four walnut boards running left to right, a hair's gap between them.
    depth, gap = 0.94, 0.014
    for i in range(4):
        y = BENCH_BACK - depth / 2 - i * (depth + gap)
        keep(kit.box((5.4, depth, 0.22), (0.0 + 0.3 * (i % 2), y, -0.11), name=f"board{i}", bevel_width=0.012),
             M.walnut(f"board{i}", axis="X", figure=0.45 + 0.12 * (i % 3), gloss=0.42, wear=0.35, scale=1.5), "bench")

    # The tray: white enamel, a dark rolled rim chipped back to the steel.
    hw, hd, r = TRAY["hw"], TRAY["hd"], TRAY["r"]
    profile = [(0.0, 0.030), (0.028, 0.038), (0.058, 0.072), (0.150, 0.222), (0.166, 0.244), (0.194, 0.250), (0.220, 0.238),
               (0.232, 0.214), (0.224, 0.194), (0.200, 0.188), (0.184, 0.180), (0.090, 0.0)]
    white = M.enamel("tray_enamel", color=(0.80, 0.78, 0.72), gloss=0.75, chips=0.25, scale=1.2)
    rim = M.enamel("tray_rim", color=(0.035, 0.05, 0.11), gloss=0.9, chips=0.9, scale=1.2)
    tray = keep(loft(profile, hw, hd, r, name="tray", materials=(white, rim), split=(3, 10)), name="tray")
    o = TRAY["level_out"]
    ring = rrect(hw + o, hd + o, r + o)
    liquid = keep(mesh_object("liquid", [(x, y, TRAY["level"]) for x, y in ring], [tuple(range(len(ring)))], smooth=False), developer(), "liquid")

    # The tongs: two bamboo slats bound at one end, rubber tips, lying on the bench in front of the tray.
    tongs = []
    for side in (-1, 1):
        slat = kit.box((1.46, 0.085, 0.024), (0.0, 0.0, 0.0), name="slat", bevel_width=0.008)
        slat.location = (0.0, side * 0.052, 0.0)
        slat.rotation_euler = (0, 0, side * math.radians(2.6))
        kit.assign(slat, bamboo("bamboo"))
        tip = kit.box((0.16, 0.092, 0.034), (-0.72, side * 0.085, 0.0), name="tip", bevel_width=0.01)
        tip.rotation_euler = (0, 0, side * math.radians(2.6))
        kit.assign(tip, M.rubber("tip", color=(0.16, 0.02, 0.02), rough=0.6, dust=0.2))
        tongs += [slat, tip]
    band = kit.box((0.10, 0.17, 0.05), (0.69, 0.0, 0.0), name="band", bevel_width=0.012)
    kit.assign(band, M.brass("band", age=0.4, brushed=0.4, wear=0.7))
    tongs.append(band)
    root = kit.group(tongs, "tongs")
    root.location = (0.60, -1.12, 0.02)
    root.rotation_euler = (0, math.radians(0.6), math.radians(4.5))
    for ob in tongs:
        keep(ob, name="tongs")

    # The safelight: a brass beehive lamp on a yoke and a round foot, its ruby glass toward the tray.
    brass = M.brass("safelight", age=0.55, brushed=0.6, wear=0.7)
    trim = M.brass("safelight_trim", color=(0.70, 0.45, 0.16), age=0.35, brushed=0.35, wear=0.8, rough=0.26)
    foot = (-1.04, BENCH_BACK - 0.27)
    pivot = Vector((foot[0], foot[1], 0.60))
    lamp = []
    n = 60
    body = [(0.0, 0.0)]
    for i in range(1, n + 1):
        z = 0.46 * i / n
        rr = 0.30 * (1 - (1 - i / n) ** 2.2) ** 0.62
        ribs = 0.013 * math.sin(2 * math.pi * z / 0.075) * (1 if 0.05 < z < 0.43 else 0)
        body.append((rr + ribs, z))
    body += [(0.325, 0.465), (0.335, 0.49), (0.325, 0.515), (0.30, 0.52), (0.292, 0.505)]
    shell = kit.lathe(body, segments=96, name="beehive")
    kit.assign(shell, brass)
    lamp.append(shell)
    glass = kit.lathe([(0.0, 0.497), (0.20, 0.497), (0.293, 0.492)], segments=64, name="ruby")
    lamp.append(glass)
    for ob in lamp:
        ob.location = pivot - Vector((0, 0, 0))
    aim = Vector((0.50, -0.86, -0.12)).normalized()
    turn = aim.to_track_quat("Z", "Y").to_euler()
    for ob in lamp:
        ob.rotation_euler = turn
        ob.location = pivot - aim * 0.24
    keep(shell, name="safelight")
    keep(glass, M.glow("ruby", color=(1.0, 0.08, 0.03), strength=4.6, falloff=0.2), "glass")
    side = aim.cross(Vector((0, 0, 1))).normalized()
    for s in (-1, 1):
        arm = tube([pivot + side * s * 0.335 + Vector((0, 0, 0.0)), pivot + side * s * 0.345 + Vector((0, 0, -0.2)), pivot + side * s * 0.25 + Vector((0, 0, -0.42)),
                    pivot + side * s * 0.06 + Vector((0, 0, -0.50))], 0.022, segments=14, name="yoke")
        keep(arm, trim, "safelight")
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.04, location=pivot + side * s * 0.335, segments=20, ring_count=10)
        knob = bpy.context.object
        kit.shade(knob)
        keep(knob, trim, "safelight")
    stand = kit.lathe([(0.0, 0.145), (0.035, 0.145), (0.04, 0.10), (0.05, 0.05), (0.09, 0.035), (0.20, 0.025), (0.215, 0.012), (0.215, 0.0), (0.0, 0.0)], segments=64, name="foot")
    stand.location = (foot[0], foot[1], 0.0)
    keep(stand, brass, "safelight")

    # The bottle of developer: brown glass, a cork, a paper label gone soft.
    bx, by = 1.26, BENCH_BACK - 0.25
    bottle = kit.lathe([(0.0, 0.0), (0.16, 0.0), (0.175, 0.02), (0.175, 0.42), (0.165, 0.47), (0.10, 0.56), (0.066, 0.60), (0.062, 0.70), (0.076, 0.705),
                        (0.076, 0.735), (0.05, 0.74), (0.0, 0.74)], segments=64, name="bottle")
    bottle.location = (bx, by, 0.0)
    keep(bottle, M.gel("brown_glass", color=(0.36, 0.13, 0.03), rough=0.08, density=0.95), "bottle")
    cork = kit.lathe([(0.0, 0.72), (0.05, 0.72), (0.058, 0.80), (0.052, 0.815), (0.0, 0.815)], segments=32, name="cork")
    cork.location = (bx, by, 0.0)
    keep(cork, M.walnut("cork", color=(0.42, 0.26, 0.12), figure=0.2, gloss=0.0), "bottle")
    label = kit.lathe([(0.1765, 0.12), (0.178, 0.125), (0.178, 0.355), (0.1765, 0.36)], segments=64, name="label")
    label.location = (bx, by, 0.0)
    keep(label, M.paper("label", color=(0.80, 0.72, 0.56), age=0.6), "bottle")
    return made, named, pivot + aim * 0.26


def light(cam, glass_at):
    """Red-amber, from the safelight's side: the house studio with its key turned red and low, the
    lamp's own light on the bench from where its glass is, and the room left dark."""
    kit.studio(cam, span=3.0, target=(0.0, 0.0, 0.1), key=0.40, fill=0.20, rim=0.5, ambient=0.45, warm=SAFE_KEY, cool=(0.80, 0.20, 0.26))
    data = bpy.data.lights.new("safelight", "SPOT")
    data.energy = 210.0
    data.color = SAFE
    data.spot_size = math.radians(150)
    data.spot_blend = 0.8
    data.shadow_soft_size = 0.18
    lamp = bpy.data.objects.new("safelight_light", data)
    bpy.context.scene.collection.objects.link(lamp)
    lamp.location = Vector(glass_at) + Vector((0.03, -0.05, 0.0))
    lamp.rotation_euler = (Vector((0.35, -0.55, -0.75)).normalized()).to_track_quat("-Z", "Y").to_euler()
    return lamp


def flat(objs):
    return [o for v in objs for o in (v if isinstance(v, list) else [v])]


def shoot(which):
    scene(PIC_W, PIC_H, samples=SAMPLES)
    made, named, glass_at = build()
    cam = bench_camera()
    light(cam, glass_at)
    tray = named["tray"] + named["liquid"]
    rest = [o for o in made if o not in tray]
    glow = named["glass"]
    out = {}
    if "bench" in which:
        camera_only(made, rest)
        kit.outline(3.5 * PX / 3, exclude=glow + tray, plain=named["bottle"])
        out["bench"] = kit.render(os.path.join(RAW, "bench.png"))
    if "tray" in which:
        camera_only(made, tray)
        kit.outline(3.5 * PX / 3, exclude=rest + named["liquid"])
        out["tray"] = kit.render(os.path.join(RAW, "tray.png"))
    anchors = {
        "EDGE_Y": EDGE_Y, "TRAY": (PIC_W / 2, TRAY_Y), "LIQUID": (PIC_W / 2, round(LIQ_CY, 2)), "LIQUID_HALF": (round(LIQ_HW, 1), round(LIQ_HD, 1)),
        "SQUASH": round(SQUASH, 4), "GLASS": anchor(cam, tuple(glass_at), PIC_W, PIC_H), "SHEET": (round(SHEET_W * PT, 1), round(SHEET_H * PT, 1)),
    }
    return out, anchors


def sheen_frames():
    """The light on the liquid, worked out rather than traced (a mirror with ripples is a few lines of
    arithmetic and loops exactly): slow swells cross the surface, each train moving a whole number of
    wavelengths over the loop; every point mirrors the room back to the camera along its own tilted
    normal, and is as bright as what it finds there: the safelight's glass (a small hot source, low at
    the back left) and the dim glow of the ceiling over the lamp. Returned as light to lay over the
    photos: the brightness is the alpha."""
    import numpy as np
    from PIL import Image, ImageFilter
    k = 2 * 2                                    # twice the points, supersampled twice
    w, h = SHEEN_W * k, SHEEN_H * k
    px, py = np.meshgrid((np.arange(w) + 0.5) / k - SHEEN_W / 2, (np.arange(h) + 0.5) / k - SHEEN_H / 2)
    x, y = px / PT, -py / (PT * SQUASH)          # the liquid's own plane, in units from its middle
    e = math.radians(ELEV)
    view = np.array([0.0, -math.cos(e), math.sin(e)])
    lamp = np.array([-1.04, BENCH_BACK - 0.27 - 0.2, 0.60 - TRAY["level"]])
    mirror = np.array([0.0, math.cos(e), math.sin(e)])            # where the liquid lying still sends the eye
    sky = mirror + np.array([-0.20, 0.02, 0.10])                   # the ceiling's glow: a little to the left of that, so only a crest finds it
    sky /= np.linalg.norm(sky)
    # Inside the liquid's rounded outline, a soft edge.
    hw, hd, r = TRAY["hw"] + TRAY["level_out"], TRAY["hd"] + TRAY["level_out"], TRAY["r"] + TRAY["level_out"]
    qx, qy = np.abs(x) - (hw - r), np.abs(y) - (hd - r)
    dist = np.hypot(np.maximum(qx, 0), np.maximum(qy, 0)) + np.minimum(np.maximum(qx, qy), 0) - r
    inside = np.clip(-dist / 0.035, 0, 1)
    trains = ((0.60, 30, 1, 0.078), (0.95, -38, -1, 0.030), (0.26, 64, 2, 0.016))   # wavelength, heading, turns a loop, slope
    frames = []
    for f in range(FRAMES):
        phase = 2 * math.pi * f / FRAMES
        sx, sy = np.zeros_like(x), np.zeros_like(x)
        for lam, head, turns, slope in trains:
            a = math.radians(head)
            c, s_ = math.cos(a), math.sin(a)
            along, across = x * c + y * s_, x * s_ - y * c
            bend = 1.2 * np.sin(1.25 * across + head + 0.8 * np.sin(0.9 * along - head)) + 0.35 * np.sin(2.7 * across - 1.3 * along)
            g = slope * np.cos(2 * math.pi * (x * c + y * s_) / lam + bend + turns * phase)
            sx += g * c
            sy += g * s_
        n = np.dstack([-sx, -sy, np.ones_like(sx)])
        n /= np.linalg.norm(n, axis=-1, keepdims=True)
        refl = 2 * (n @ view)[..., None] * n - view
        to_lamp = lamp - np.dstack([x, y, np.zeros_like(x)])
        far = np.linalg.norm(to_lamp, axis=-1, keepdims=True)
        to_lamp /= far
        hot = np.exp(-np.clip(1 - (refl * to_lamp).sum(-1), 0, 2) / 0.045 ** 2) / np.clip(far[..., 0], 0.5, 3) ** 1.2
        soft = np.exp(-np.clip(1 - refl @ sky, 0, 2) / 0.15 ** 2)
        light = np.clip(1.2 * hot + 0.62 * np.clip((soft - 0.5) / 0.5, 0, 1) ** 1.3, 0, 1) * inside
        rgb = np.array([1.0, 0.40, 0.22]) * (1 - light[..., None] ** 2) + np.array([1.0, 0.84, 0.62]) * light[..., None] ** 2
        im = Image.fromarray((np.dstack([rgb, np.clip(light, 0, 1) ** 0.9 * 0.8]) * 255 + 0.5).astype(np.uint8), "RGBA").filter(ImageFilter.GaussianBlur(k * 0.6))
        frames.append(export.resize(im, (round(SHEEN_W * SHEEN_PX), round(SHEEN_H * SHEEN_PX))))
    return frames


def soft_top(im, points=18):
    """The picture's top edge faded out over `points`: the lamp's halo reaches it, and must not end in a line."""
    import numpy as np
    from PIL import Image
    a = np.asarray(im, dtype=np.float32).copy()
    rows = round(points * im.height / PIC_H)
    a[:rows, :, 3] *= (np.arange(rows) / rows)[:, None] ** 1.5
    return Image.fromarray((a + 0.5).astype(np.uint8), "RGBA")


if __name__ == "__main__":
    which = [a for a in sys.argv[1:] if a in ("bench", "tray", "sheen")] or ["bench", "tray", "sheen"]
    out, anchors = shoot([w for w in which if w != "sheen"]) if which != ["sheen"] else ({}, {})
    dest = (lambda name: os.path.join(OUT, name)) if OUT else (lambda name: "assets/develop/" + name)
    total = 0
    if "bench" in out:
        # The lamp's halo, spilling past its bezel.
        gx, gy = anchors["GLASS"]
        im = soft_top(export.bloom(export.load(out["bench"]), radius=0.035, strength=0.8, threshold=0.72, within=(gx / PIC_W, gy / PIC_W, 0.16), inside=0.5))
        total += ship(im, dest("bench.png"), (PIC_W, PIC_H), budget_kb=150, scales=SCALES, errors=(10.0, 14.0, 20.0, 28.0, 40.0))
    if "tray" in out:
        total += ship(out["tray"], dest("tray.png"), (PIC_W, PIC_H), scales=SCALES, errors=(10.0, 14.0, 20.0, 28.0))
    if "sheen" in which:
        from PIL import Image
        frames = sheen_frames()
        fw, fh = frames[0].size
        sheet = Image.new("RGBA", (fw * 4, fh * 3), (0, 0, 0, 0))
        for i, f in enumerate(frames):
            sheet.paste(f, ((i % 4) * fw, (i // 4) * fh))
        total += export.write(sheet, dest("sheen.png") if OUT else os.path.join(export.REPO, dest("sheen.png")), max_kb=600)
        anchors["SHEEN"] = {"frame": (SHEEN_W, SHEEN_H), "columns": 4, "rows": 3, "count": FRAMES, "at": (PIC_W / 2, round(LIQ_CY, 2))}
    print("anchors (points in the bench picture):")
    for k_, v in anchors.items():
        print(f"  {k_} = {v}")
    print(f"total {total / 1024:.1f} KB")

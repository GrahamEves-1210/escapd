# The typewriter ribbon of the "ribbon" reveal (src/play2/tools/RibbonSheet.tsx): a nickel spool
# standing on the desk, seen from a little above, wound with a black-over-red ribbon. The game
# draws the ribbon itself live (it is pulled out to the right from the front of the winding, the
# typed line struck pale into it), so the pictures are the hard parts:
#
#   ribbon-spool   the lower flange, the wound ribbon, the shadow on the desk (under the live ribbon)
#   ribbon-flange  the top flange with its six holes and hub, as FRAMES pictures in a row of one
#                  sixth of a turn (it has six-fold symmetry): the game steps through them as the
#                  ribbon is pulled, over the live ribbon
#   ribbon-clip    the metal clip on the ribbon's end, what the hand pulls
#
# Printed at the end (points from each picture's top left): where the ribbon leaves the winding
# (its top and bottom edge there), the flange's centre, the winding's radius in points.
#
#   <bpy python> scripts/blender/props/reveal_ribbon.py [outdir] [--spool|--flange|--clip]
from PIL import Image

from reveal_common import *  # noqa: F401,F403

PT = 64.0
ELEV = 30.0
BAND = 56.0                               # the ribbon's height in the picture, in points
RIBBON = BAND / (PT * math.cos(math.radians(ELEV)))   # its width in units
RED = 26.0 / BAND                         # the red half's share (the lower)
FLANGE_R, FLANGE_T, WOUND_R = 1.3125, 0.035, 0.8125   # 84 pt and 52 pt: a flat spool, half its ribbon used
Z0, Z1 = FLANGE_T, FLANGE_T + RIBBON      # the winding, between the flanges
W, H = 190, 172                           # the spool's picture
FW, FH = 176, 100                         # one frame of the flange
FRAMES, COLUMNS = 8, 4                    # the frames' sheet: two rows of four
CW, CH = 40, 72                           # the clip's picture
CENTRE = (0.0, 0.46)                      # where the spool's picture looks, (x, z)
FCENTRE = (0.0, Z1 + 0.02)


def ribbon_fabric():
    """The wound ribbon: black above, red below, a dull inked cotton; its top face shows the windings as rings."""
    t = M.Tree("ribbon")
    tc = t.node("ShaderNodeTexCoord")
    sep = t.node("ShaderNodeSeparateXYZ")
    t.link(tc.outputs["Object"], sep.inputs[0])
    black = t.math("GREATER_THAN", sep.outputs["Z"], Z0 + RIBBON * RED)
    weave = t.noise(t.coords((90, 90, 90)), scale=1.0, detail=2, rough=0.6)
    rings = t.node("ShaderNodeTexWave", wave_type="RINGS", rings_direction="Z")
    t.link(tc.outputs["Object"], rings.inputs["Vector"])
    rings.inputs["Scale"].default_value = 26.0
    # (An inked black that is a dark grey in the lamp's light: true black is lost against the game's dark grounds.)
    col = t.mix(black, (0.46, 0.030, 0.040), (0.060, 0.054, 0.066))
    col = t.mix(t.math("MULTIPLY", weave, 0.25), col, (0.16, 0.14, 0.16))
    b = t.principled(**{"Base Color": col, "Roughness": 0.66, "Specular IOR Level": 0.3, "Sheen Weight": 0.5,
                        "Normal": t.bump(t.math("ADD", rings.outputs["Fac"], t.math("MULTIPLY", weave, 0.5)), strength=0.25, distance=0.004)})
    return t.surface(b)


def nickel(name="nickel"):
    return M.silver(name, color=(0.90, 0.89, 0.86), rough=0.2, tarnish=0.22)   # bright enough to stand off the game's dark grounds


def top_flange(turn=0.0):
    """The top flange: six round holes, a raised hub with the spindle's hole. Turned `turn` degrees."""
    metal = nickel("flange")
    disc = kit.lathe([(0, Z1), (FLANGE_R - 0.012, Z1), (FLANGE_R, Z1 + 0.012), (FLANGE_R, Z1 + FLANGE_T - 0.012), (FLANGE_R - 0.012, Z1 + FLANGE_T),
                      (0.36, Z1 + FLANGE_T), (0.34, Z1 + FLANGE_T + 0.03), (0.30, Z1 + FLANGE_T + 0.045), (0.20, Z1 + FLANGE_T + 0.045), (0.17, Z1 + FLANGE_T + 0.03),
                      (0.15, Z1 + FLANGE_T - 0.02), (0.13, Z1 + FLANGE_T - 0.02), (0.13, Z1), (0, Z1)], segments=144, name="top_flange")
    kit.assign(disc, metal)
    cutters = []
    for i in range(6):
        a = math.radians(60 * i + 30)
        bpy.ops.mesh.primitive_cylinder_add(radius=0.25, depth=0.4, vertices=48, location=(0.80 * math.cos(a), 0.80 * math.sin(a), Z1 + FLANGE_T / 2))
        cut = bpy.context.object
        kit.assign(cut, metal)
        boolean(disc, cut, "DIFFERENCE")
        cutters.append(cut)
    # Three small drive holes round the spindle, as dark dots.
    dots = []
    for i in range(3):
        a = math.radians(120 * i + 10)
        bpy.ops.mesh.primitive_cylinder_add(radius=0.028, depth=0.01, vertices=20, location=(0.25 * math.cos(a), 0.25 * math.sin(a), Z1 + FLANGE_T + 0.046))
        d = bpy.context.object
        kit.assign(d, M.ink("drive_hole", (0.02, 0.016, 0.022)))
        dots.append(d)
    kit.bevel(disc, 0.005)
    root = kit.group([disc] + cutters + dots, "flange")
    root.rotation_euler = (0, 0, math.radians(turn))
    bpy.context.view_layer.update()
    return disc, dots


def spool_base():
    metal = nickel("lower")
    lower = kit.lathe([(0, 0), (FLANGE_R - 0.012, 0), (FLANGE_R, 0.012), (FLANGE_R, FLANGE_T - 0.012), (FLANGE_R - 0.012, FLANGE_T), (0, FLANGE_T)], segments=144, name="lower_flange")
    kit.assign(lower, metal)
    wound = kit.lathe([(0.14, Z0), (WOUND_R - 0.01, Z0), (WOUND_R, Z0 + 0.01), (WOUND_R, Z1 - 0.012), (WOUND_R - 0.012, Z1), (0.14, Z1)], segments=128, name="winding")
    kit.assign(wound, ribbon_fabric())
    core = kit.lathe([(0, Z0), (0.14, Z0), (0.14, Z1), (0, Z1)], segments=32, name="core")
    kit.assign(core, M.ink("core", (0.018, 0.014, 0.02)))
    return lower, wound, core


def shoot_spool(path):
    scene(W, H)
    lower, wound, core = spool_base()
    # The top flange's shade on the winding without its holes (they turn; the shade doesn't): a plain disc the camera can't see.
    shade = kit.lathe([(0, Z1 + 0.01), (FLANGE_R, Z1 + 0.01), (FLANGE_R, Z1 + FLANGE_T), (0, Z1 + FLANGE_T)], segments=64, name="shade")
    shade.visible_camera = False
    cam = flat_camera(W, H, PT, centre=CENTRE, elev=ELEV)
    kit.studio(cam, span=2.6, target=(0, 0, 0.5), shadow=0.0, shadow_reach=0.22)
    kit.outline(3.0, exclude=[shade, core])
    kit.render(path)
    front = [anchor(cam, (0, -WOUND_R, z), W, H) for z in (Z1, Z0)]
    return {"leaves_x": front[0][0], "band_top": front[0][1], "band_bottom": front[1][1], "axis_top": anchor(cam, (0, 0, Z1 + FLANGE_T), W, H)}


def shoot_flange(path, turn):
    scene(FW, FH)
    disc, dots = top_flange(turn)
    cam = flat_camera(FW, FH, PT, centre=FCENTRE, elev=ELEV)
    kit.studio(cam, span=2.6, target=(0, 0, 0.5))
    kit.outline(3.0, exclude=dots)
    kit.render(path)
    return anchor(cam, (0, 0, Z1 + FLANGE_T), FW, FH)


def shoot_clip(path):
    """The clip: a nickel plate folded over the ribbon's end, an eye to hook it by. It hangs where the ribbon does (in front of the winding)."""
    scene(CW, CH)
    metal = nickel("clip")
    zc = (Z0 + Z1) / 2
    plate = kit.box((0.26, 0.05, RIBBON + 0.10), (0.0, -WOUND_R, zc), "plate", bevel_width=0.02)
    kit.assign(plate, metal)
    lip = kit.box((0.05, 0.075, RIBBON + 0.10), (-0.105, -WOUND_R, zc), "lip", bevel_width=0.018)
    kit.assign(lip, metal)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.13, minor_radius=0.034, major_segments=48, minor_segments=14, location=(0.20, -WOUND_R, zc))
    eye = bpy.context.object
    eye.rotation_euler = (math.radians(90), 0, 0)
    kit.shade(eye)
    kit.assign(eye, metal)
    for dz in (-0.3, 0.3):
        rivet = kit.lathe([(0, 0.0), (0.03, 0.0), (0.034, 0.008), (0.028, 0.022), (0, 0.026)], segments=24, name="rivet")
        rivet.rotation_euler = (math.radians(90), 0, 0)
        rivet.location = (0.02, -WOUND_R - 0.025, zc + dz)
        kit.assign(rivet, metal)
    cam = flat_camera(CW, CH, PT, centre=(0.10, zc - WOUND_R * math.tan(math.radians(ELEV)) * 0.0), elev=ELEV)
    kit.fit(cam, margin=1.0)
    cam.data.ortho_scale = max(CW, CH) / PT
    kit.studio(cam, span=1.2, target=(0.1, -WOUND_R, zc))
    kit.outline(2.0)
    kit.render(path)
    return {"ribbon_end": anchor(cam, (-0.13, -WOUND_R, zc), CW, CH), "top": anchor(cam, (0, -WOUND_R, Z1), CW, CH), "bottom": anchor(cam, (0, -WOUND_R, Z0), CW, CH)}


if __name__ == "__main__":
    out = out_dir()
    which = [a for a in sys.argv[1:] if a.startswith("--")]
    total = 0
    if not which or "--spool" in which:
        src = os.path.join(out, "ribbon-spool.png")
        at = shoot_spool(src)
        print("ribbon-spool  size =", (W, H), at, " winding radius =", round(WOUND_R * PT, 1), "pt")
        total += ship(src, "assets/reveal/ribbon-spool.png", (W, H))
    if not which or "--flange" in which:
        frames = []
        for i in range(FRAMES):
            src = os.path.join(out, f"ribbon-flange-{i}.png")
            centre = shoot_flange(src, 60.0 * i / FRAMES)
            frames.append(export.load(src))
        print("ribbon-flange  frame =", (FW, FH), " frames =", FRAMES, " columns =", COLUMNS, " centre =", centre)
        rows = -(-FRAMES // COLUMNS)
        for k, suffix in ((1, ""), (2, "@2x"), (3, "@3x")):
            sheet = Image.new("RGBA", (FW * k * COLUMNS, FH * k * rows), (0, 0, 0, 0))
            for i, im in enumerate(frames):
                sheet.alpha_composite(export.resize(im, (FW * k, FH * k)), ((i % COLUMNS) * FW * k, (i // COLUMNS) * FH * k))
            # As ship(): the exporter's palette if it is faithful, a little more error allowed only to fit the animation's budget.
            for err in (7.0, 10.0, 14.0, 20.0):
                data, how = export.encode(sheet, True, max_error=err)
                if len(data) <= 600 * 1024:
                    break
            name = asset_path(f"assets/reveal/ribbon-flange{suffix}.png")
            with open(name, "wb") as f:
                f.write(data)
            print(f"  {os.path.basename(name)}  {sheet.width}x{sheet.height}  {len(data) / 1024:.1f} KB  ({how}, error <= {err:g})")
            total += len(data)
    if not which or "--clip" in which:
        src = os.path.join(out, "ribbon-clip.png")
        at = shoot_clip(src)
        print("ribbon-clip  size =", (CW, CH), at)
        total += ship(src, "assets/reveal/ribbon-clip.png", (CW, CH))
    print(f"total {total / 1024:.1f} KB")

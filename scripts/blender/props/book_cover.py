# The casebook shut (src/play2/journal/Book.tsx): the front board in the mode's cloth with its
# foil stamp (a ruled frame, the title in the mode's own display face, a four-pointed spark, as
# on the little book in the game's rail), brass corners, the rounded spine at the left, the page
# block's foot and the ribbon's end out of it. Shot by book_open.py's camera, so the app lays it
# exactly over the open book and swings it about the hinge (x = GUT): what is under it is what
# is under the cover. Cut like the open book: a head (with the title), a foot (with the spark),
# and the strip between for the app to stretch.
#
#   <bpy python> scripts/blender/props/book_cover.py [noir crime-scene paranormal]   # writes assets/book/<mode>-cover-{head,strip,foot}*.png
from book_common import *  # noqa: F401,F403
from book_open import H, PAGE_H, PAGE_TOP

HEAD, FOOT = 100.0, 94.0
BETWEEN = (103.0, 119.0)
TB = TL + TR                      # the whole page block
TOP = 2 * BOARD + TB              # the front board's face, above the table
XE = PW + FAN + SQ                # the boards' fore edge
HINGE = 6.0                       # the front board starts here: the joint's groove lies between it and the spine


def foil():
    # Leaf pressed into cloth lies flat to the camera, where polished brass would only mirror the dark of the room:
    # most of its gold is its own.
    return M.lit(M.brass("foil", color=(0.78, 0.55, 0.20), age=0.08, brushed=0.12, wear=0.0, rough=0.3, scale=1.3), (0.72, 0.46, 0.13), 0.55)


def stamp(x0, x1, z0, z1, mat, name="rule"):
    """A foil line pressed into the cloth: a hair proud of it."""
    ob = kit.box((u(x1 - x0), u(0.5), u(z1 - z0)), (u((x0 + x1) / 2), -u(TOP + 0.05), u((z0 + z1) / 2)), name, bevel_width=0.0)
    kit.assign(ob, mat)
    return ob


def frame(x0, x1, z0, z1, w, mat):
    return [stamp(x0, x1, z1 - w, z1, mat), stamp(x0, x1, z0, z0 + w, mat), stamp(x0, x0 + w, z0 + w, z1 - w, mat), stamp(x1 - w, x1, z0 + w, z1 - w, mat)]


def title(body, font, size, x, z, mat, track=1.0):
    cu = bpy.data.curves.new("title", "FONT")
    cu.body = body
    cu.font = bpy.data.fonts.load(os.path.join(REPO, "node_modules/@expo-google-fonts", font))
    cu.size = u(size)
    cu.align_x, cu.align_y = "CENTER", "CENTER"
    cu.space_character = track
    cu.extrude = u(0.25)
    cu.resolution_u = 8
    ob = bpy.data.objects.new("title", cu)
    bpy.context.scene.collection.objects.link(ob)
    ob.location = (u(x), -u(TOP + 0.05), u(z))
    ob.rotation_euler = (math.radians(90), 0, 0)
    ob.data.materials.append(mat)
    return ob


def spark(x, z, r, mat, waist=0.3):
    """The four-pointed spark off the rail's little book."""
    pts = []
    for i in range(8):
        a = math.pi / 2 + i * math.pi / 4
        k = r if i % 2 == 0 else r * waist
        pts.append((x + math.cos(a) * k, z + math.sin(a) * k * (1.25 if i % 4 == 0 else 1.0)))
    verts = [(u(px), -u(TOP + 0.3), u(pz)) for px, pz in pts] + [(u(px), -u(TOP - 0.2), u(pz)) for px, pz in pts]
    faces = [tuple(range(8))] + [(i, (i + 1) % 8, 8 + (i + 1) % 8, 8 + i) for i in range(8)]
    ob = mesh_object("spark", verts, faces, smooth=False)
    kit.assign(ob, mat)
    return ob


def gusset(x, z, sz, mat, leg=36.0):
    """A brass corner on the front board's outer corner at (x, z): a triangle over the cloth, folded down the edges."""
    tri = [(x + 0.8, z - sz * 0.8), (x - leg, z - sz * 0.8), (x + 0.8, z + sz * leg)]
    top, under = TOP + 0.9, TOP - BOARD - 0.6
    verts = [(u(px), -u(top), u(pz)) for px, pz in tri] + [(u(px), -u(under), u(pz)) for px, pz in tri]
    faces = [(0, 1, 2), (3, 5, 4), (0, 3, 4, 1), (1, 4, 5, 2), (2, 5, 3, 0)]
    ob = mesh_object("gusset", verts, faces, smooth=False)
    kit.bevel(ob, u(0.5), 2)
    kit.assign(ob, mat)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=u(1.7), segments=20, ring_count=10, location=(u(x - 7.5), -u(top - 0.4), u(z + sz * 7.5)))
    rivet = bpy.context.object
    rivet.name = "rivet"
    kit.shade(rivet)
    kit.assign(rivet, mat)
    return [ob, rivet]


def build(mode):
    spec = MODES[mode]
    rnd = random.Random(11)
    cl = cloth("cloth", spec["cloth"], weave=0.8)
    gold = foil()
    brass = M.brass("corner", age=0.35, brushed=0.3, wear=0.5, scale=1.3)
    target = srgb(spec["paper"])
    own = tuple(0.5 * c for c in target)
    papers = [page_paper(f"leaf{i}", target, own, k, lines=True, hemmed=False) for i, k in enumerate((0.92, 0.8, 0.88, 0.76))]
    # The boards, the block between them, the spine round their backs.
    back = kit.assign(kit.box((u(XE + 2), u(BOARD), u(PAGE_H + 2 * SQ)), (u((XE - 2) / 2), -u(BOARD / 2), u(PAGE_H / 2)), "back", bevel_width=u(1.1)), cl)
    front = kit.assign(kit.box((u(XE - HINGE), u(BOARD), u(PAGE_H + 2 * SQ)), (u((XE + HINGE) / 2), -u(TOP - BOARD / 2), u(PAGE_H / 2)), "front", bevel_width=u(1.1)), cl)
    leaves = []
    n = 12
    for i in range(n):
        end = PW + rnd.uniform(-0.5, 0.5) - 2.0 * math.sin(math.pi * (i + 0.5) / n)   # a rounded back's fore edge is a little hollow
        ob = kit.box((u(end), u(TB / n), u(PAGE_H + rnd.uniform(-0.8, 0.8))), (u(end / 2), -u(BOARD + TB * (i + 0.5) / n), u(PAGE_H / 2 + rnd.uniform(-0.4, 0.4))), f"leaves{i}", bevel_width=0.0)
        kit.assign(ob, papers[i % len(papers)])
        leaves.append(ob)
    # The spine: a round back from board to board, and the joint's groove where the front board hinges.
    ry, cy = TOP / 2 + 0.4, TOP / 2
    arc = [(-2.0 - 10.0 * math.sin(a), cy - ry * math.cos(a)) for a in [math.pi * k / 20 for k in range(21)]]   # from the table up round to the top
    arc += [(1.0, TOP - 1.2), (3.2, TOP - 2.4), (5.2, TOP - 1.4), (HINGE + 1.5, TOP - 0.2)]
    z0, z1 = -SQ, PAGE_H + SQ
    verts = [(u(x), -u(lv), u(z)) for z in (z0, z1) for x, lv in arc]
    m = len(arc)
    faces = [(i, i + 1, m + i + 1, m + i) for i in range(m - 1)]
    spine = mesh_object("spine", verts, faces, sharp=50.0)
    so = spine.modifiers.new("thick", "SOLIDIFY")
    so.thickness = u(BOARD * 0.8)
    so.offset = -1.0
    kit.assign(spine, cl)
    # The stamp: a ruled frame, the title between rules, the spark.
    inset = 15.0
    fx0, fx1, fz0, fz1 = HINGE + inset, XE - inset, -SQ + inset, PAGE_H + SQ - inset
    stamps = frame(fx0, fx1, fz0, fz1, 1.7, gold) + frame(fx0 + 4.4, fx1 - 4.4, fz0 + 4.4, fz1 - 4.4, 0.7, gold)
    cx = (fx0 + fx1) / 2
    tz = PAGE_H - 56.0
    name = title(spec["title"], spec["font"], 40.0 if spec["title"].isupper() else 50.0, cx, tz, gold, spec["track"])
    half = 96.0
    for dz in (23.0, -23.0):
        stamps += [stamp(cx - half, cx + half, tz + dz - 0.6, tz + dz + 0.6, gold), stamp(cx - half * 0.72, cx + half * 0.72, tz + dz * 1.16 - 0.3, tz + dz * 1.16 + 0.3, gold)]
    stamps.append(spark(cx, 21.0, 8.0, gold))
    corners = gusset(XE, -SQ, 1, brass) + gusset(XE, PAGE_H + SQ, -1, brass)
    # The ribbon's end, out of the block's foot where it marks the place (between the two blocks: TR up).
    sat = satin("ribbon", spec["ribbon"])
    rx, lv = 17.0, BOARD + TR
    path = [(rx, lv, 6.0), (rx, lv, 0.0), (rx + 0.3, lv - 2.5, -3.0), (rx + 0.8, lv * 0.5, -7.5), (rx + 1.5, BOARD + 1.2, -10.5), (rx + 2.4, 1.2, -15.0),
            (rx + 4.2, 0.8, -22.0), (rx + 5.0, 0.8, -29.0), (rx + 4.0, 0.8, -36.0)]
    rib = ribbon_strip("ribbon", path, 9.0, sat, vee=5.5)
    return dict(back=back, front=front, leaves=leaves, spine=spine, stamps=stamps + [name], corners=corners, ribbon=rib)


def shoot(mode, path):
    book_scene(H)
    parts = build(mode)
    cam = book_camera(H, BOARD + TR, PAGE_TOP, PAGE_H)   # book_open.py's camera
    kit.studio(cam, span=2.6, target=(u(W / 2 - GUT), -0.1, u(PAGE_H / 2)), fill=1.25)
    wall_shadow(0.0, u(-80), u(XE + 40), u(-90), u(PAGE_H + 50), reach=0.06, strength=0.85)
    kit.outline(3.0, exclude=parts["stamps"], plain=parts["leaves"])
    kit.render(path)
    return dict(board_top=at(cam, H, XE, TOP, PAGE_H + SQ), board_foot=at(cam, H, XE, TOP, -SQ), hinge=at(cam, H, HINGE, TOP, PAGE_H / 2),
                spine=at(cam, H, -12.0, TOP / 2, PAGE_H / 2), title=at(cam, H, (HINGE + XE) / 2, TOP, PAGE_H - 56.0))


def cut(mode, src):
    im = picture(src, H)
    strip = strip_between(im, *BETWEEN)
    head = settle(rows(im, 0, HEAD), strip, at_top=True, over=3.0)
    foot = settle(rows(im, H - FOOT, H), strip, at_top=False, over=3.0)
    # Seen for a third of a second, swinging: x1 and x2 are all it needs.
    total = ship_cut(head, f"assets/book/{mode}-cover-head.png", HEAD, most=2)
    total += ship_cut(strip, f"assets/book/{mode}-cover-strip.png", 4, most=2)
    total += ship_cut(foot, f"assets/book/{mode}-cover-foot.png", FOOT, most=2)
    return total


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if a in MODES] or list(MODES)
    out = export.scratch("book")
    grand = 0
    for mode in args:
        src = os.path.join(out, f"{mode}-cover.png")
        if rendered(src):
            anchors = shoot(mode, src)
            print(f"{mode}: picture {W:g} x {H:g}, head {HEAD:g}, foot {FOOT:g}; anchors {anchors}")
        n = cut(mode, src)
        print(f"{mode}: {n / 1024:.1f} KB")
        grand += n
    print(f"total {grand / 1024:.1f} KB")

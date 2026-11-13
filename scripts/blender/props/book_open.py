# The casebook lying open at its ribbon (src/play2/journal/Book.tsx), one picture a mode, cut
# into a head, a foot and the strip between them that the app stretches to the page's height
# (book_common.py has the plan). The app writes on the right-hand page: PAGE below is that
# page's rectangle in the picture, in points.
#
#   <bpy python> scripts/blender/props/book_open.py [noir crime-scene paranormal]   # writes assets/book/<mode>-open-{head,strip,foot}*.png
#
# The page's paper is calibrated to the app's (journal/palette.ts): two quick renders measure
# what the studio makes of it and correct the leaf's own colour, so the page the app draws on
# and the page it turns (drawn live, in the palette's paper) are one paper.
from book_common import *  # noqa: F401,F403

H = 216.0             # the picture's height
PAGE_H = 150.0        # the page's height in the model (it is seen at COS of that)
PAGE_TOP = 26.0       # the right-hand page's head edge, from the picture's top
HEAD, FOOT = 56.0, 78.0   # the cuts
BETWEEN = (70.0, 126.0)    # rows that are the same all the way down


def build(mode, own):
    spec = MODES[mode]
    rnd = random.Random(7)
    target = srgb(spec["paper"])
    cl = cloth("cloth", spec["cloth"])
    brass = M.brass("corner", age=0.35, brushed=0.3, wear=0.5, scale=1.3)
    papers = [page_paper(f"leaf{i}", target, own, k, lines=True) for i, k in enumerate((1.0, 0.9, 0.96, 0.86))] + [page_paper("page", target, own)]
    right = block("right", 9, TR, PAGE_H, papers, rnd)
    left = block("left", 13, TL, PAGE_H, papers, rnd)
    cover = boards(PAGE_H, cl)
    xe = PW + FAN + SQ
    corners = corner(xe, -SQ, -1, 1, BOARD, brass) + corner(xe, PAGE_H + SQ, -1, -1, BOARD, brass)
    # The ribbon: out of the spine at the head, down the left-hand page beside the gutter, over the foot and
    # away across the table, its end cut in a V.
    sat = satin("ribbon", spec["ribbon"])
    rx = -17.0
    lvl = lambda x: BOARD + h_left(x) + 0.5  # noqa: E731
    path = [(-2.0, lvl(-2.0), PAGE_H + 3.0), (-5.0, lvl(-5.0), PAGE_H - 4.0), (-11.0, lvl(-11.0), PAGE_H - 13.0), (rx, lvl(rx), PAGE_H - 24.0)]
    path += [(rx, lvl(rx), z) for z in (PAGE_H - 40.0, 60.0, 20.0, 2.0)]
    path += [(rx - 0.3, lvl(rx) - 2.0, -2.5), (rx - 0.8, lvl(rx) * 0.55, -7.0), (rx - 1.5, BOARD + 1.2, -10.5), (rx - 2.4, 1.2, -15.0),
             (rx - 4.2, 0.8, -22.0), (rx - 5.0, 0.8, -29.0), (rx - 4.0, 0.8, -36.0)]
    rib = ribbon_strip("ribbon", path, 9.0, sat, vee=5.5)
    # The headband: a little roll of the ribbon's silk across the spine's head, where the ribbon is sewn in.
    bands = []
    for z in (PAGE_H + 1.2,):
        band = tube([(u(x), -u(BOARD + 2.4 - 1.6 * (x / 8.0) ** 2), u(z)) for x in (-8.0, -5.0, -2.0, 0.0, 2.0, 5.0, 8.0)], u(1.7), segments=14, name="headband")
        kit.assign(band, sat)
        bands.append(band)
    return dict(right=right, left=left, cover=cover, corners=corners, ribbon=rib, bands=bands)


def shoot(mode, own, path, draft=False):
    book_scene(H, samples=16 if draft else SAMPLES)
    if draft:
        s = bpy.context.scene
        s.render.resolution_x, s.render.resolution_y = round(W), round(H)
    parts = build(mode, own)
    cam = book_camera(H, BOARD + TR, PAGE_TOP, PAGE_H)
    kit.studio(cam, span=2.6, target=(u(W / 2 - GUT), -0.1, u(PAGE_H / 2)), fill=1.25)
    reach = PW + FAN + SQ
    wall_shadow(0.0, u(-reach - 40), u(reach + 40), u(-90), u(PAGE_H + 50), reach=0.06, strength=0.85)
    if draft:
        kit.no_outline()
    else:
        leaves = parts["right"][:-1] + parts["left"][:-1]
        kit.outline(3.0, plain=leaves + parts["bands"])
    kit.render(path)
    anchors = dict(
        page_top=at(cam, H, PW, BOARD + TR, PAGE_H), page_foot=at(cam, H, PW, BOARD + TR, 0.0),
        gutter=at(cam, H, 0.0, BOARD + TR * 0.1, PAGE_H), left_top=at(cam, H, -30.0, BOARD + TL, PAGE_H),
        board_top=at(cam, H, PW + FAN + SQ, BOARD, PAGE_H + SQ), board_foot=at(cam, H, PW + FAN + SQ, BOARD, -SQ),
    )
    return anchors


def measured(path):
    """What the flat of the page came out as (linear RGB): the middle of the right-hand page."""
    im = export.load(path)
    k = im.width / W
    box = im.crop((round(180 * k), round(60 * k), round(300 * k), round(130 * k)))
    a = np.asarray(box, dtype=np.float32)[..., :3] / 255.0
    mean = a.reshape(-1, 3).mean(axis=0)
    return tuple(float(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4) for c in mean)


def calibrate(mode, out, rounds=3):
    target = srgb(MODES[mode]["paper"])
    own = tuple(0.55 * c for c in target)
    for i in range(rounds):
        path = os.path.join(out, f"{mode}-calibrate.png")
        shoot(mode, own, path, draft=True)
        got = measured(path)
        own = tuple(max(0.0, o + (t - g) * 0.95) for o, t, g in zip(own, target, got))
        print(f"  calibrate {mode} {i}: page {tuple(round(c, 3) for c in got)} for {tuple(round(c, 3) for c in target)} -> own {tuple(round(c, 3) for c in own)}")
    return own


def cut(mode, src):
    im = picture(src, H)
    strip = strip_between(im, *BETWEEN)
    head = settle(rows(im, 0, HEAD), strip, at_top=True)
    foot = settle(rows(im, H - FOOT, H), strip, at_top=False)
    total = ship_cut(head, f"assets/book/{mode}-open-head.png", HEAD)
    total += ship_cut(strip, f"assets/book/{mode}-open-strip.png", 4)
    total += ship_cut(foot, f"assets/book/{mode}-open-foot.png", FOOT)
    return total


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if a in MODES] or list(MODES)
    out = export.scratch("book")
    grand = 0
    for mode in args:
        src = os.path.join(out, f"{mode}-open.png")
        if rendered(src):
            own = calibrate(mode, out)
            anchors = shoot(mode, own, src)
            print(f"{mode}: picture {W:g} x {H:g}, head {HEAD:g}, foot {FOOT:g}; anchors {anchors}")
        n = cut(mode, src)
        print(f"{mode}: {n / 1024:.1f} KB")
        grand += n
    print(f"total {grand / 1024:.1f} KB")

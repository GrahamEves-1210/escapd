# The game's flashlight, drawn to match the 3D magnifier (assets/brand/magnifier*.png):
# a turned brass head with a bevelled bezel round a glass lens (a silvered
# reflector and a lit bulb behind it), a knurled brass collar, a dark varnished
# wood barrel with brass ferrules, a knurled tail and a domed cap. Lit from the
# upper left like the magnifier, with a cool rim light on the right.
#
# Rendered, not drawn: the body is a surface of revolution (a profile turned
# round its axis, bumps for the knurling) seen a little from above, splatted
# into a z-buffer at 4x and shaded per point (brass: a studio environment
# reflected through a gold ramp; wood: grain, lambert and a varnish streak;
# glass: the reflector, the bulb, a window reflection and a fresnel rim), then
# downsampled with premultiplied alpha (antialiased edges).
#
# Points straight up; the game turns it toward the beam (pivot low on the barrel).
# Writes flashlight{,@2x,@3x}.png (warm lens) and flashlight-uv{,@2x,@3x}.png
# (the UV lens, violet).
# Usage: python3 scripts/brand/flashlight.py
import numpy as np
from PIL import Image, ImageFilter

N = 1152            # render size (4x the largest output)
ELEV = np.radians(24)   # the camera looks down on it this much: the lens shows as an ellipse
SA, CA = np.sin(ELEV), np.cos(ELEV)
rng = np.random.default_rng(7)

GLASS, BRASS, KNURL, WOOD, INNER = 0, 1, 2, 3, 4

# The profile, top to bottom: (radius, depth down the axis, material of the run that ends here).
# Units: the axis is about 1 long. Steps are short runs, so bevels come out of the smoothing.
P = [
    (0.000, 0.040, GLASS),
    (0.148, 0.040, GLASS),
    (0.148, 0.012, INNER),      # the bezel's inner wall
    (0.156, 0.000, BRASS),      # its rounded lip
    (0.172, 0.000, BRASS),
    (0.182, 0.012, BRASS),
    (0.182, 0.056, BRASS),      # the bezel
    (0.176, 0.062, BRASS),      # a groove between bezel and head
    (0.176, 0.070, BRASS),
    (0.180, 0.076, BRASS),
    (0.179, 0.150, BRASS),      # the head
]
# The flare from head to neck, an easing curve.
for t in np.linspace(0, 1, 14)[1:]:
    e = t * t * (3 - 2 * t)
    P.append((0.179 + (0.113 - 0.179) * e, 0.150 + 0.140 * t, BRASS))
P += [
    (0.121, 0.296, BRASS),      # the neck ring
    (0.121, 0.326, BRASS),
    (0.113, 0.332, BRASS),
    (0.113, 0.430, KNURL),      # the knurled collar (the grip under the thumb)
    (0.119, 0.436, BRASS),      # a ferrule
    (0.119, 0.458, BRASS),
    (0.106, 0.464, BRASS),
    (0.110, 0.560, WOOD),       # the wood barrel, a slight swell
    (0.111, 0.640, WOOD),
    (0.105, 0.790, WOOD),
    (0.115, 0.796, BRASS),      # the tail ferrule
    (0.115, 0.820, BRASS),
    (0.110, 0.826, BRASS),
    (0.110, 0.892, KNURL),      # the knurled tail
    (0.115, 0.898, BRASS),      # the cap
    (0.115, 0.922, BRASS),
    (0.108, 0.940, BRASS),
    (0.085, 0.956, BRASS),
    (0.040, 0.964, BRASS),
    (0.000, 0.966, BRASS),
]


def resample(points, step):
    """The profile as evenly spaced samples along its length (with a little corner rounding)."""
    pts = np.array([(r, y) for r, y, _ in points], float)
    mats = [m for _, _, m in points]
    # Chaikin twice on each joint, keeping the material of each run: soft bevels, crisp-ish rings.
    rs, ys, ms = [], [], []
    for i in range(len(pts) - 1):
        a, b = pts[i], pts[i + 1]
        seg = np.linalg.norm(b - a)
        n = max(2, int(seg / step))
        t = np.linspace(0, 1, n, endpoint=False)
        rs.append(a[0] + (b[0] - a[0]) * t)
        ys.append(a[1] + (b[1] - a[1]) * t)
        ms.append(np.full(n, mats[i + 1]))
    r = np.concatenate(rs); y = np.concatenate(ys); m = np.concatenate(ms)
    # Round the corners: a short moving average (a bevel about 0.004 wide), the axis ends pinned.
    k = max(1, int(0.004 / step))
    ker = np.ones(2 * k + 1) / (2 * k + 1)
    rp = np.convolve(np.pad(r, k, mode="edge"), ker, "valid")
    yp = np.convolve(np.pad(y, k, mode="edge"), ker, "valid")
    rp[m == GLASS] = r[m == GLASS]; yp[m == GLASS] = y[m == GLASS]
    return rp, yp, m


def tri(x):
    return 1 - 2 * np.abs(x - np.floor(x) - 0.5)


def bump(r, y, th, m):
    """Knurling: two crossed sets of helical grooves, little pyramids between them."""
    out = np.zeros_like(r)
    k = m == KNURL
    if k.any():
        pitch = 0.0125
        u = (th[k] * r[k] / pitch + y[k] / pitch)
        v = (th[k] * r[k] / pitch - y[k] / pitch)
        out[k] = 0.0032 * np.minimum(tri(u), tri(v))
    return out


def surface(r, y, th, m):
    rr = r + bump(r, y, th, m)
    return np.stack([rr * np.cos(th), y, rr * np.sin(th)], -1)


def normalize(v):
    return v / np.maximum(np.linalg.norm(v, axis=-1, keepdims=True), 1e-9)


V = np.array([0.0, -SA, CA])              # towards the camera (x right, y down, z out)
KEY = normalize(np.array([-0.62, -0.62, 0.55]))
RIM = normalize(np.array([0.85, -0.2, -0.35]))
HALF = normalize(KEY + V)


def smooth_noise(shape, scale, seed):
    g = np.random.default_rng(seed).random((max(2, int(shape[0] / scale[0])) + 2, max(2, int(shape[1] / scale[1])) + 2))
    im = Image.fromarray((g * 255).astype(np.uint8)).resize((shape[1], shape[0]), Image.BICUBIC)
    return np.asarray(im, float) / 255


# Grain and brush textures, looked up by (axis position, angle).
GRAIN = smooth_noise((64, 2048), (16, 40), 1) * 0.7 + smooth_noise((64, 2048), (6, 12), 2) * 0.3
STREAK = smooth_noise((2048, 64), (5, 24), 3)


def tex(t, a, y, th):
    i = np.clip((y * (t.shape[0] - 1)).astype(int), 0, t.shape[0] - 1)
    j = np.clip(((th / (2 * np.pi)) % 1 * (t.shape[1] - 1)).astype(int), 0, t.shape[1] - 1)
    return t[i, j] if a == 0 else t[i, j]


def gold(i):
    """The magnifier's brass, dark amber to pale gold to a near-white glint."""
    stops = np.array([0.0, 0.22, 0.5, 0.75, 0.92, 1.0])
    cols = np.array([(58, 34, 12), (118, 76, 28), (186, 132, 52), (222, 176, 86), (250, 224, 150), (255, 248, 222)], float)
    i = np.clip(i, 0, 1)
    return np.stack([np.interp(i, stops, cols[:, c]) for c in range(3)], -1)


def env(R):
    """A studio: a soft box up-left, a warm floor bounce, a dark band between, a strip light on the right."""
    box = np.exp(-np.sum((R - normalize(np.array([-0.55, -0.7, 0.45]))) ** 2, -1) / 0.10)
    strip = np.exp(-((R[..., 0] - 0.72) ** 2) / 0.02) * np.clip(-R[..., 1] + 0.6, 0, 1) * 0.55
    sky = np.clip(0.5 - 0.5 * R[..., 1], 0, 1) ** 1.6 * 0.42
    floor = np.clip(R[..., 1], 0, 1) * 0.28
    return 0.22 + box * 1.05 + strip + sky + floor


def shade(P, n, m, y, th, lens_uv):
    ndl = np.clip(n @ KEY, 0, 1)
    wrap = np.clip((n @ KEY + 0.35) / 1.35, 0, 1)
    ndv = np.clip(n @ V, 0, 1)
    ndh = np.clip(n @ HALF, 0, 1)
    rim = (1 - ndv) ** 3 * np.clip(n @ RIM + 0.3, 0, 1)
    R = 2 * (n @ V)[:, None] * n - V
    col = np.zeros((len(m), 3))

    b = (m == BRASS) | (m == KNURL) | (m == INNER)
    if b.any():
        e = env(R[b]) * (0.55 + 0.45 * wrap[b])
        streak = (tex(STREAK, 1, y[b], th[b]) - 0.5) * 0.07      # turned-brass streaks, round the axis
        e = e + streak
        e[m[b] == INNER] *= 0.55
        e[m[b] == KNURL] *= 0.92
        c = gold(e * 0.78)
        c += (ndh[b] ** 90)[:, None] * np.array([255, 245, 215]) * 0.9
        c += rim[b][:, None] * np.array([150, 170, 150]) * 0.55       # the magnifier's olive rim tint
        col[b] = c

    w = m == WOOD
    if w.any():
        g = tex(GRAIN, 0, y[w], th[w])
        base = np.array([64, 38, 28]) + (g[:, None] ** 1.5) * np.array([38, 26, 18])
        lit = base * (0.32 + 0.95 * wrap[w][:, None])
        # The varnish: a long soft streak of the soft box, and a sharper glint in it.
        box = np.exp(-np.sum((R[w] - normalize(np.array([-0.55, -0.7, 0.45]))) ** 2, -1) / 0.12)
        lit += box[:, None] * np.array([150, 118, 92]) * (0.7 + 0.25 * g[:, None])
        lit += (ndh[w] ** 60)[:, None] * np.array([255, 235, 210]) * 0.35
        lit += rim[w][:, None] * np.array([120, 110, 120]) * 0.45
        col[w] = lit

    gl = m == GLASS
    if gl.any():
        col[gl] = glass(P[gl], lens_uv)
    return col


R_LENS = 0.148


def glass(P, uv):
    """Through the glass: a silvered reflector in rings round a lit bulb; on it, a window and a fresnel rim."""
    x, z = P[:, 0] / R_LENS, P[:, 2] / R_LENS
    rho = np.sqrt(x * x + z * z)
    hot = np.array([255, 236, 190]) if not uv else np.array([206, 170, 255])
    mid = np.array([228, 190, 120]) if not uv else np.array([138, 92, 238])
    deep = np.array([120, 84, 40]) if not uv else np.array([52, 26, 112])
    # The reflector: lit from the bulb, brightest near the middle and at the far (upper) side's rim.
    rings = 0.5 + 0.5 * np.cos(rho * 26)
    far = np.clip(-z, 0, 1)
    t = np.clip(1.0 - rho * 0.85 + 0.18 * rings * rho + 0.25 * far * rho, 0, 1)
    c = deep[None] + (mid - deep)[None] * t[:, None] + (hot - mid)[None] * (np.clip(t - 0.55, 0, 1) / 0.45)[:, None]
    # The bulb, a small glowing pearl and its halo.
    bulb = np.exp(-(rho / 0.16) ** 2)
    c = c * (1 - bulb[:, None]) + np.array([255, 252, 240] if not uv else [236, 222, 255])[None] * bulb[:, None]
    c += (np.exp(-(rho / 0.42) ** 2) * 60)[:, None] * (hot / 255)[None]
    # The glass: a soft window reflection up-left, a thin crescent of light round the near edge.
    win = np.exp(-(((x + 0.42) / 0.30) ** 2 + ((z + 0.40) / 0.22) ** 2))
    c = c * (1 - 0.55 * win[:, None]) + 255 * 0.55 * win[:, None]
    fres = np.clip((rho - 0.86) / 0.14, 0, 1) ** 2 * np.clip(0.4 + z, 0, 1)
    c = c * (1 - 0.5 * fres[:, None]) + 255 * 0.5 * fres[:, None]
    return np.clip(c, 0, 255)


def render(uv):
    step = 0.6 / N
    r, y, m = resample(P, step)
    # The screen: world units to pixels, fitted to the square with a margin.
    height = 0.966 * CA + 0.182 * SA * 2
    scale = (0.90 * N) / height
    top = (N - height * scale) / 2 + 0.182 * SA * scale
    zbuf = np.full(N * N, -np.inf)
    rgb = np.zeros((N * N, 3))
    dth_t = 1e-4
    chunk = 120
    for s in range(0, len(r), chunk):
        rs, ys, ms = r[s:s + chunk], y[s:s + chunk], m[s:s + chunk]
        # Angles: dense enough for half a pixel round the widest ring.
        nth = int(np.ceil(2 * np.pi * max(rs.max(), 0.01) * scale / 0.45))
        th = np.linspace(0, 2 * np.pi, nth, endpoint=False)
        R_, T = np.meshgrid(rs, th, indexing="ij")
        Y_ = np.repeat(ys[:, None], nth, 1)
        M_ = np.repeat(ms[:, None], nth, 1)
        R_, Y_, T, M_ = R_.ravel(), Y_.ravel(), T.ravel(), M_.ravel()
        Pt = surface(R_, Y_, T, M_)
        # Normals from the surface's two tangents (the profile, the turn), by finite differences.
        i0 = np.arange(s, s + len(rs))
        i1 = np.minimum(i0 + 1, len(r) - 1); im = np.maximum(i0 - 1, 0)
        dr = np.repeat((r[i1] - r[im])[:, None], nth, 1).ravel()
        dy = np.repeat((y[i1] - y[im])[:, None], nth, 1).ravel()
        Pa = surface(R_ + dr * 0.5, Y_ + dy * 0.5, T, M_) - surface(R_ - dr * 0.5, Y_ - dy * 0.5, T, M_)
        Pb = surface(R_, Y_, T + dth_t, M_) - surface(R_, Y_, T - dth_t, M_)
        n = normalize(np.cross(Pb, Pa))
        # Orient each normal by the profile's own outward side (it runs top to bottom, out of the
        # axis at the lens and back into it at the cap): (dy, -dr) in (radial, down).
        radial = np.stack([np.cos(T), np.zeros_like(T), np.sin(T)], -1)
        out_dir = radial * dy[:, None] + np.array([0, 1.0, 0])[None] * -dr[:, None]
        flip = np.sum(n * out_dir, -1) < 0
        n[flip] *= -1
        # The glass is flat, facing up.
        n[M_ == GLASS] = np.array([0, -1.0, 0])
        vis = n @ V > -0.05
        Pt, n, M_, Y_, T = Pt[vis], n[vis], M_[vis], Y_[vis], T[vis]
        sx = N / 2 + Pt[:, 0] * scale
        sy = top + (Pt[:, 1] * CA + Pt[:, 2] * SA) * scale
        depth = Pt[:, 2] * CA - Pt[:, 1] * SA
        ix = np.floor(sx).astype(int); iy = np.floor(sy).astype(int)
        ok = (ix >= 0) & (ix < N) & (iy >= 0) & (iy < N)
        idx = iy[ok] * N + ix[ok]
        dep = depth[ok]
        order = np.argsort(dep)
        idx, dep = idx[order], dep[order]
        keep = dep > zbuf[idx]
        idx, dep = idx[keep], dep[keep]
        sel = np.nonzero(ok)[0][order][keep]
        col = shade(Pt[sel], n[sel], M_[sel], Y_[sel], T[sel], uv)
        zbuf[idx] = dep
        rgb[idx] = col
    alpha = np.isfinite(zbuf).reshape(N, N)
    img = rgb.reshape(N, N, 3)
    # Close any pinholes left between splats.
    a8 = Image.fromarray((alpha * 255).astype(np.uint8))
    closed = np.asarray(a8.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))) > 127
    holes = closed & ~alpha
    if holes.any():
        blur = np.asarray(Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3)), float)
        img[holes] = blur[holes]
    alpha = closed
    # A painterly softening, like the magnifier's brushwork: a touch of blur inside the shape.
    soft = np.asarray(Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2)), float)
    img = img * 0.55 + soft * 0.45
    out = np.dstack([np.clip(img, 0, 255), alpha * 255]).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def save(im, name):
    # Premultiplied while resizing, so the antialiased edge carries no dark fringe.
    pm = im.convert("RGBa")
    for size, suffix in ((96, ""), (192, "@2x"), (288, "@3x")):
        pm.resize((size, size), Image.LANCZOS).convert("RGBA").save(f"assets/brand/{name}{suffix}.png")


if __name__ == "__main__":
    save(render(False), "flashlight")
    save(render(True), "flashlight-uv")

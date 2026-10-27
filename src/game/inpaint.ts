// The taken object's fill (docs/DESIGN.md, Game feel · 4a: "Taken objects
// leave the room"). Pure TypeScript over RGBA bytes, so it runs the same in
// the app and in Jest, with no image library and no network.
//
// A region is a small crop of the treated photo round one object (its box
// plus a margin), at most a few hundred pixels on the long edge. The hole is
// the box padded a little, so the object's own edge goes too. It is filled
// by push-pull (a pyramid fill): the known pixels are averaged down level by
// level, each coarse pixel weighted by how much of it is known, until the
// hole is covered; then each level is filled from the one above, upsampled
// smoothly, blended in where its own pixels are missing and relaxed toward a
// smooth membrane (a few Gauss-Seidel sweeps per level, so the middle of a
// large hole meets its border instead of sinking to the mean). On the plain
// surfaces the chooser accepts (src/game/removal.ts) that reads as the wall,
// the shelf or the desk carrying on behind. Then grain matched to the ring
// round the hole goes over the fill, so it isn't smeared, and the alpha
// feathers off outside the hole, so the patch has no edge over the photo.
//
// Nothing outside the hole changes colour; only the patch's alpha falls off.

/** A rectangle in a region's pixels (x right, y down). */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A crop of a photo round one object: RGBA bytes, row by row, and the object's box in it. */
export interface PixelRegion {
  data: Uint8Array;
  width: number;
  height: number;
  box: Rect;
}

export const FILL = {
  /** The hole: the box padded by this fraction of its size each side. */
  holePad: 0.06,
  /** The ring measured for plainness and grain: from the hole out to this padding. */
  ringPad: 0.12,
  /** The alpha's falloff past the hole, as a fraction of the box. */
  feather: 0.08,
  /** Grain is matched to the ring, but never more than this (0..255). */
  maxGrain: 10,
  /** Relaxation sweeps per pyramid level, at most (see relax): 3 on the finest, 3 more a level up. */
  sweeps: 12,
  /** Fewer ring pixels than this can't be measured. */
  minRing: 24,
} as const;

/** `r` grown by `f` of its own size on each side. */
export function padRect(r: Rect, f: number): Rect {
  return { x: r.x - r.w * f, y: r.y - r.h * f, w: r.w * (1 + 2 * f), h: r.h * (1 + 2 * f) };
}

const inside = (px: number, py: number, r: Rect) => px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h;

/** 1 for each pixel whose centre is in the hole (the box padded by `pad`), else 0. */
export function holeMask(width: number, height: number, box: Rect, pad: number = FILL.holePad): Uint8Array {
  const hole = padRect(box, pad);
  const mask = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (inside(x + 0.5, y + 0.5, hole)) mask[y * width + x] = 1;
    }
  }
  return mask;
}

const luma = (d: Uint8Array, i: number) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];

export interface RingStats {
  /** Pixels measured. */
  count: number;
  /** Luminance spread round a fitted plane (0..255): a lit wall's gradient isn't busy; books, a pattern or an edge are. */
  residual: number;
  /** The fine noise in it (0..255): the film grain and the surface's own texture, for the fill to match. */
  noise: number;
}

/**
 * The ring round the hole (from the box padded by FILL.holePad out to
 * FILL.ringPad): how busy it is and how grainy. Null when too little of the
 * ring is in the region to say.
 */
export function ringStats(region: PixelRegion): RingStats | null {
  const { data, width, height, box } = region;
  const inner = padRect(box, FILL.holePad);
  const outer = padRect(box, FILL.ringPad);
  const xs: number[] = [];
  const ys: number[] = [];
  const ls: number[] = [];
  const inRing = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < width && y < height && inside(x + 0.5, y + 0.5, outer) && !inside(x + 0.5, y + 0.5, inner);
  let hpSum = 0;
  let hpSq = 0;
  let hpCount = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!inRing(x, y)) continue;
      const l = luma(data, (y * width + x) * 4);
      xs.push(x);
      ys.push(y);
      ls.push(l);
      // High-pass: the pixel less its four neighbours' mean, where all four are in the ring.
      if (inRing(x - 1, y) && inRing(x + 1, y) && inRing(x, y - 1) && inRing(x, y + 1)) {
        const around = (luma(data, (y * width + x - 1) * 4) + luma(data, (y * width + x + 1) * 4)
          + luma(data, ((y - 1) * width + x) * 4) + luma(data, ((y + 1) * width + x) * 4)) / 4;
        const hp = l - around;
        hpSum += hp;
        hpSq += hp * hp;
        hpCount += 1;
      }
    }
  }
  const n = ls.length;
  if (n < FILL.minRing) return null;

  // Least squares l = a + b·x + c·y, on centred coordinates.
  let mx = 0;
  let my = 0;
  let ml = 0;
  for (let i = 0; i < n; i++) {
    mx += xs[i];
    my += ys[i];
    ml += ls[i];
  }
  mx /= n;
  my /= n;
  ml /= n;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  let sxl = 0;
  let syl = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    const dl = ls[i] - ml;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
    sxl += dx * dl;
    syl += dy * dl;
  }
  const det = sxx * syy - sxy * sxy;
  const b = det > 1e-9 ? (sxl * syy - syl * sxy) / det : 0;
  const c = det > 1e-9 ? (syl * sxx - sxl * sxy) / det : 0;
  let rss = 0;
  for (let i = 0; i < n; i++) {
    const r = ls[i] - ml - b * (xs[i] - mx) - c * (ys[i] - my);
    rss += r * r;
  }
  // For independent noise of spread s, the high-pass has spread s·√1.25.
  const hpVar = hpCount > 1 ? Math.max(0, hpSq / hpCount - (hpSum / hpCount) ** 2) : 0;
  return { count: n, residual: Math.sqrt(rss / n), noise: Math.sqrt(hpVar / 1.25) };
}

/**
 * Fills the masked pixels (mask 1) by push-pull; every other pixel, and every
 * alpha, comes back as it was. A region with no known pixel is left alone.
 */
export function pushPullFill(data: Uint8Array, width: number, height: number, mask: Uint8Array): Uint8Array {
  const out = new Uint8Array(data);
  const n = width * height;
  // Level 0: colours (RGB, 0..255) and how much of each pixel is known.
  let w = width;
  let h = height;
  let color = new Float32Array(n * 3);
  let weight = new Float32Array(n);
  let known = 0;
  for (let i = 0; i < n; i++) {
    if (mask[i]) continue;
    color[i * 3] = data[i * 4];
    color[i * 3 + 1] = data[i * 4 + 1];
    color[i * 3 + 2] = data[i * 4 + 2];
    weight[i] = 1;
    known += 1;
  }
  if (known === 0 || known === n) return out;

  // Pull: down to one pixel, each level a [1 3 3 1] tent over the one below, weighted by what is known.
  const levels: { w: number; h: number; color: Float32Array; weight: Float32Array }[] = [{ w, h, color, weight }];
  const K = [1, 3, 3, 1];
  while (w > 1 || h > 1) {
    const nw = Math.max(1, Math.ceil(w / 2));
    const nh = Math.max(1, Math.ceil(h / 2));
    const nc = new Float32Array(nw * nh * 3);
    const nwt = new Float32Array(nw * nh);
    for (let Y = 0; Y < nh; Y++) {
      for (let X = 0; X < nw; X++) {
        let r = 0;
        let g = 0;
        let bl = 0;
        let sw = 0;
        let sk = 0;
        for (let j = 0; j < 4; j++) {
          const y = 2 * Y - 1 + j;
          if (y < 0 || y >= h) continue;
          for (let i = 0; i < 4; i++) {
            const x = 2 * X - 1 + i;
            if (x < 0 || x >= w) continue;
            const k = K[i] * K[j];
            const p = y * w + x;
            const kw = k * weight[p];
            r += kw * color[p * 3];
            g += kw * color[p * 3 + 1];
            bl += kw * color[p * 3 + 2];
            sw += kw;
            sk += k;
          }
        }
        const q = Y * nw + X;
        if (sw > 0) {
          nc[q * 3] = r / sw;
          nc[q * 3 + 1] = g / sw;
          nc[q * 3 + 2] = bl / sw;
        }
        nwt[q] = sk > 0 ? sw / sk : 0;
      }
    }
    w = nw;
    h = nh;
    color = nc;
    weight = nwt;
    levels.push({ w, h, color, weight });
  }

  // Push: each level filled from the one above, bilinear, where its own pixels are missing.
  let filled = levels[levels.length - 1].color;
  for (let L = levels.length - 2; L >= 0; L--) {
    const lv = levels[L];
    const up = levels[L + 1];
    const next = new Float32Array(lv.w * lv.h * 3);
    for (let y = 0; y < lv.h; y++) {
      const fy = Math.min(Math.max((y + 0.5) / 2 - 0.5, 0), up.h - 1);
      const y0 = Math.floor(fy);
      const y1 = Math.min(y0 + 1, up.h - 1);
      const ty = fy - y0;
      for (let x = 0; x < lv.w; x++) {
        const fx = Math.min(Math.max((x + 0.5) / 2 - 0.5, 0), up.w - 1);
        const x0 = Math.floor(fx);
        const x1 = Math.min(x0 + 1, up.w - 1);
        const tx = fx - x0;
        const p = y * lv.w + x;
        const a = lv.weight[p];
        for (let ch = 0; ch < 3; ch++) {
          const top = filled[(y0 * up.w + x0) * 3 + ch] * (1 - tx) + filled[(y0 * up.w + x1) * 3 + ch] * tx;
          const bottom = filled[(y1 * up.w + x0) * 3 + ch] * (1 - tx) + filled[(y1 * up.w + x1) * 3 + ch] * tx;
          const coarse = top * (1 - ty) + bottom * ty;
          next[p * 3 + ch] = a * lv.color[p * 3 + ch] + (1 - a) * coarse;
        }
      }
    }
    relax(next, lv.w, lv.h, lv.color, lv.weight, Math.min(FILL.sweeps, 3 * (L + 1)));
    filled = next;
  }

  for (let i = 0; i < n; i++) {
    if (!mask[i]) continue;
    for (let ch = 0; ch < 3; ch++) out[i * 4 + ch] = clampByte(filled[i * 3 + ch]);
  }
  return out;
}

/**
 * `sweeps` Gauss-Seidel sweeps of the membrane (Laplace) equation over a
 * level's missing pixels, each pulled toward its own known part by its
 * weight. Push-pull alone sinks a large hole's middle to the wider mean,
 * so its edges show as a frame; relaxing each level from the coarse fill
 * up (a multigrid solve) makes the fill meet its border smoothly.
 */
function relax(fill: Float32Array, w: number, h: number, own: Float32Array, weight: Float32Array, sweeps: number) {
  let count0 = 0;
  for (let p = 0; p < w * h; p++) if (weight[p] < 0.999) count0++;
  const open = new Int32Array(count0);
  for (let p = 0, k = 0; p < w * h; p++) if (weight[p] < 0.999) open[k++] = p;
  for (let sweep = 0; sweep < sweeps; sweep++) {
    for (let k = 0; k < open.length; k++) {
      const p = open[k];
      const x = p % w;
      const y = (p - x) / w;
      let count = 0;
      let r = 0;
      let g = 0;
      let b = 0;
      if (x > 0) {
        r += fill[(p - 1) * 3]; g += fill[(p - 1) * 3 + 1]; b += fill[(p - 1) * 3 + 2]; count++;
      }
      if (x < w - 1) {
        r += fill[(p + 1) * 3]; g += fill[(p + 1) * 3 + 1]; b += fill[(p + 1) * 3 + 2]; count++;
      }
      if (y > 0) {
        r += fill[(p - w) * 3]; g += fill[(p - w) * 3 + 1]; b += fill[(p - w) * 3 + 2]; count++;
      }
      if (y < h - 1) {
        r += fill[(p + w) * 3]; g += fill[(p + w) * 3 + 1]; b += fill[(p + w) * 3 + 2]; count++;
      }
      if (count === 0) continue;
      const a = weight[p];
      fill[p * 3] = a * own[p * 3] + (1 - a) * (r / count);
      fill[p * 3 + 1] = a * own[p * 3 + 1] + (1 - a) * (g / count);
      fill[p * 3 + 2] = a * own[p * 3 + 2] + (1 - a) * (b / count);
    }
  }
}

const clampByte = (v: number) => (Number.isFinite(v) ? Math.min(255, Math.max(0, Math.round(v))) : 0);

/** A small deterministic generator (mulberry32), so a room's patch is the same every time. */
function random(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Grey grain of spread `sigma` (0..255) over the masked pixels, in place: the same on each channel, as film grain is. */
export function addGrain(data: Uint8Array, mask: Uint8Array, sigma: number, seed: number): void {
  if (!(sigma > 0)) return;
  const next = random(seed);
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    // Box-Muller: a normal sample.
    const u = Math.max(next(), 1e-7);
    const v = next();
    const g = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * sigma;
    for (let ch = 0; ch < 3; ch++) data[i * 4 + ch] = clampByte(data[i * 4 + ch] + g);
  }
}

/**
 * The patch's alpha, in place: opaque over the hole, then falling smoothly
 * to clear over FILL.feather of the box past it, clear beyond.
 */
export function featherAlpha(data: Uint8Array, width: number, height: number, box: Rect): void {
  const hole = padRect(box, FILL.holePad);
  const fx = Math.max(1e-6, box.w * FILL.feather);
  const fy = Math.max(1e-6, box.h * FILL.feather);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const dx = Math.max(hole.x - px, 0, px - (hole.x + hole.w)) / fx;
      const dy = Math.max(hole.y - py, 0, py - (hole.y + hole.h)) / fy;
      const t = Math.min(1, Math.hypot(dx, dy));
      const s = t * t * (3 - 2 * t);
      data[(y * width + x) * 4 + 3] = Math.round(255 * (1 - s));
    }
  }
}

/**
 * The finished patch for a region: the hole filled, grain matched to the
 * ring, the alpha feathered. Same region and seed, same bytes.
 */
export function makePatch(region: PixelRegion, seed: number): Uint8Array {
  const { width, height, box } = region;
  const mask = holeMask(width, height, box);
  const out = pushPullFill(region.data, width, height, mask);
  const ring = ringStats(region);
  if (ring) addGrain(out, mask, Math.min(FILL.maxGrain, ring.noise), seed);
  featherAlpha(out, width, height, box);
  return out;
}

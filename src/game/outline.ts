// An object's real outline, traced on the device from the photo and its
// detection box, for rooms whose definition carries none (rooms generated
// since carry Gemini's, supabase/functions/_shared/v2/segment.ts). The glint
// hugs the object, not a box or an oval. Pure: pixels in, a polygon out.
//
// A small GrabCut (Rother et al. 2004), without the graph cut:
//   1. Colour models: a mixture for the background, from the pixels around the
//      box (the region is the box with a margin, src/game/removal.ts), and one
//      for the object, from the box's middle.
//   2. Each pixel in the box scores by how much likelier it is under the
//      object's model than the background's. A few rounds of mean-field
//      smoothing let neighbours agree, except across a colour edge, so the
//      split follows the object's real edge.
//   3. The models are refitted to that split and it is made again: background
//      caught in the box teaches the background model.
//   4. One-pixel gaps closed and whiskers dropped, the largest piece, its holes
//      filled, is traced and simplified (supabase/functions/_shared/v2/
//      outline.ts, shared with the server).
//
// An object filling its whole box keeps the box's edge, which is its own; a
// shape too small, or no clearer than the background's own noise, is null.
import { outlineOfMask, type Point } from "../../supabase/functions/_shared/v2/outline.ts";

export type { Point };

export interface OutlineRegion {
  /** RGBA, unpremultiplied, row-major. */
  data: Uint8Array;
  width: number;
  height: number;
  /** The object's box in the region's pixels. */
  box: { x: number; y: number; w: number; h: number };
}

const K = 5;
const ROUNDS = 5;
const SMOOTHING = { passes: 4, strength: 1.4 };
/** Pixels each colour model is fitted to, at most (evenly spaced). */
const FIT_SAMPLES = 1500;
/** A pixel's score is clamped to this (log-odds): one wild pixel can't outvote its neighbours. */
const CLAMP = 6;
/** A colour both models explain equally goes to the background. */
const BIAS = 0.5;
/** The object must score this much (mean log-odds) over the background to be trusted. */
const MIN_SEPARATION = 1.5;
/** A floor on a cluster's spread (per channel, squared): a flat colour isn't infinitely sure of itself. */
const MIN_VARIANCE = 36;

interface Mixture {
  k: number;
  /** Per cluster: log weight minus half the log of its variances' product. */
  bias: Float64Array;
  mean: Float64Array;   // k x 3
  /** Per cluster and channel: 1 / variance. */
  inv: Float64Array;    // k x 3
}

/** Outline points in the region's pixels, or null when no clear shape stands out. */
export function traceOutline(region: OutlineRegion): Point[] | null {
  const { data, width: W, height: H } = region;
  const bx0 = Math.max(0, Math.round(region.box.x));
  const by0 = Math.max(0, Math.round(region.box.y));
  const bx1 = Math.min(W, Math.round(region.box.x + region.box.w));
  const by1 = Math.min(H, Math.round(region.box.y + region.box.h));
  const bw = bx1 - bx0;
  const bh = by1 - by0;
  if (bw < 8 || bh < 8) return null;
  const n = bw * bh;
  // The box's pixels, RGB, row by row.
  const pix = new Float32Array(n * 3);
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      const s = ((y + by0) * W + x + bx0) * 4, d = (y * bw + x) * 3;
      pix[d] = data[s]; pix[d + 1] = data[s + 1]; pix[d + 2] = data[s + 2];
    }
  }

  // 1. Background: everything outside the box but its first pixel (a box
  // drawn tight may catch the object's blurred edge). A box that fills the
  // region has little outside it: then its own outermost ring as well.
  const outside: number[] = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (x < bx0 - 1 || x > bx1 || y < by0 - 1 || y > by1) {
        const s = (y * W + x) * 4;
        outside.push(data[s], data[s + 1], data[s + 2]);
      }
    }
  }
  if (outside.length < 60 * 3) {
    for (let y = 0; y < bh; y++) {
      for (let x = 0; x < bw; x++) {
        if (x < 2 || bw - 1 - x < 2 || y < 2 || bh - 1 - y < 2) {
          const d = (y * bw + x) * 3;
          outside.push(pix[d], pix[d + 1], pix[d + 2]);
        }
      }
    }
  }
  if (outside.length < 30 * 3) return null;
  const around = Float32Array.from(outside);
  // The object: the box's middle at first (a loose box's corners are background).
  const inner: number[] = [];
  const mx = Math.floor(bw * 0.15), my = Math.floor(bh * 0.15);
  for (let y = my; y < bh - my; y++) for (let x = mx; x < bw - mx; x++) inner.push(y * bw + x);
  let bg = fitMixture([{ px: around, idx: null }]);
  let fg = fitMixture([{ px: pix, idx: inner }]);

  // How alike each pixel is to its right and lower neighbours (the smoothing follows colour edges).
  const d2 = (i: number, j: number) => {
    const dr = pix[i * 3] - pix[j * 3], dg = pix[i * 3 + 1] - pix[j * 3 + 1], db = pix[i * 3 + 2] - pix[j * 3 + 2];
    return dr * dr + dg * dg + db * db;
  };
  let meanD = 0, pairs = 0;
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      const i = y * bw + x;
      if (x < bw - 1) { meanD += d2(i, i + 1); pairs++; }
      if (y < bh - 1) { meanD += d2(i, i + bw); pairs++; }
    }
  }
  const beta = 1 / (2 * Math.max(1, meanD / Math.max(1, pairs)));
  const right = new Float32Array(n), down = new Float32Array(n);
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      const i = y * bw + x;
      if (x < bw - 1) right[i] = Math.exp(-beta * d2(i, i + 1));
      if (y < bh - 1) down[i] = Math.exp(-beta * d2(i, i + bw));
    }
  }

  // 2-3. Score, smooth, split; refit and again.
  const score = new Float32Array(n);
  let mask: Uint8Array = new Uint8Array(n);
  for (let round = 0; round < ROUNDS; round++) {
    for (let i = 0; i < n; i++) {
      const s = logLikelihood(fg, pix, i) - logLikelihood(bg, pix, i) - BIAS;
      score[i] = s > CLAMP ? CLAMP : s < -CLAMP ? -CLAMP : s;
    }
    const q = smooth(score, right, down, bw, bh);
    for (let i = 0; i < n; i++) mask[i] = q[i] > 0.5 ? 1 : 0;
    if (round === ROUNDS - 1) break;
    const fgIdx: number[] = [], bgIdx: number[] = [];
    for (let i = 0; i < n; i++) (mask[i] ? fgIdx : bgIdx).push(i);
    if (fgIdx.length < 20) return null;
    fg = fitMixture([{ px: pix, idx: fgIdx }]);
    bg = fitMixture([{ px: around, idx: null }, { px: pix, idx: bgIdx }]);
  }

  // 4. Trust it only if it stands out; then trace it.
  let area = 0, objScore = 0;
  for (let i = 0; i < n; i++) if (mask[i]) { area++; objScore += score[i]; }
  if (area / n < 0.08 || objScore / Math.max(1, area) < MIN_SEPARATION) return null;
  mask = erode(dilate(mask, bw, bh), bw, bh);   // close one-pixel gaps (a lamp's stem under its shade)
  mask = dilate(erode(mask, bw, bh), bw, bh);   // drop one-pixel whiskers (a neighbour's edge along the box)
  const pts = outlineOfMask(mask, bw, bh);
  if (!pts) return null;
  return pts.map((p) => ({ x: p.x + bx0, y: p.y + by0 }));
}

/** Mean-field smoothing (a contrast-sensitive Ising prior): each pixel's chance of being the object. */
function smooth(score: Float32Array, right: Float32Array, down: Float32Array, w: number, h: number): Float32Array {
  let q = new Float32Array(score.length);
  let next = new Float32Array(score.length);
  for (let i = 0; i < q.length; i++) q[i] = 1 / (1 + Math.exp(-score[i]));
  for (let pass = 0; pass < SMOOTHING.passes; pass++) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        let field = 0;
        if (x < w - 1) field += right[i] * (2 * q[i + 1] - 1);
        if (x > 0) field += right[i - 1] * (2 * q[i - 1] - 1);
        if (y < h - 1) field += down[i] * (2 * q[i + w] - 1);
        if (y > 0) field += down[i - w] * (2 * q[i - w] - 1);
        next[i] = 1 / (1 + Math.exp(-(score[i] + SMOOTHING.strength * field)));
      }
    }
    [q, next] = [next, q];
  }
  return q;
}

/** RGB triplets, all of them (idx null) or those at the listed indices. */
type Source = { px: Float32Array; idx: number[] | null };

/**
 * A mixture of K colour clusters over the sources' pixels (k-means over at
 * most FIT_SAMPLES of them, evenly spaced, so the same photo always gives the
 * same outline; then each cluster's weight and spread).
 */
function fitMixture(sources: Source[]): Mixture {
  const total = sources.reduce((s, src) => s + (src.idx ? src.idx.length : src.px.length / 3), 0);
  const m = Math.min(total, FIT_SAMPLES);
  const pts = new Float32Array(m * 3);
  const step = total / m;
  for (let j = 0, src = 0, offset = 0; j < m; j++) {
    let at = Math.floor(j * step) - offset;
    let size = sources[src].idx ? sources[src].idx!.length : sources[src].px.length / 3;
    while (at >= size) { offset += size; at -= size; src++; size = sources[src].idx ? sources[src].idx!.length : sources[src].px.length / 3; }
    const { px, idx } = sources[src];
    const p = (idx ? idx[at] : at) * 3;
    pts[j * 3] = px[p]; pts[j * 3 + 1] = px[p + 1]; pts[j * 3 + 2] = px[p + 2];
  }
  const k = Math.max(1, Math.min(K, m));
  // Seeds spread by brightness, so a dark frame and a light face start apart.
  const order = Array.from({ length: m }, (_, j) => j).sort((a, b) =>
    pts[a * 3] + pts[a * 3 + 1] + pts[a * 3 + 2] - (pts[b * 3] + pts[b * 3 + 1] + pts[b * 3 + 2]));
  const mean = new Float64Array(k * 3);
  for (let c = 0; c < k; c++) {
    const j = order[Math.floor(((c + 0.5) * m) / k)] * 3;
    mean[c * 3] = pts[j]; mean[c * 3 + 1] = pts[j + 1]; mean[c * 3 + 2] = pts[j + 2];
  }
  const assign = new Int32Array(m);
  const sums = new Float64Array(k * 4);
  for (let iter = 0; iter < 6; iter++) {
    sums.fill(0);
    for (let j = 0; j < m; j++) {
      let bi = 0, bd = Infinity;
      for (let c = 0; c < k; c++) {
        const dr = pts[j * 3] - mean[c * 3], dg = pts[j * 3 + 1] - mean[c * 3 + 1], db = pts[j * 3 + 2] - mean[c * 3 + 2];
        const d = dr * dr + dg * dg + db * db;
        if (d < bd) { bd = d; bi = c; }
      }
      assign[j] = bi;
      sums[bi * 4] += pts[j * 3]; sums[bi * 4 + 1] += pts[j * 3 + 1]; sums[bi * 4 + 2] += pts[j * 3 + 2]; sums[bi * 4 + 3]++;
    }
    for (let c = 0; c < k; c++) {
      const cnt = sums[c * 4 + 3];
      if (cnt) for (let ch = 0; ch < 3; ch++) mean[c * 3 + ch] = sums[c * 4 + ch] / cnt;
    }
  }
  const count = new Float64Array(k);
  const vars = new Float64Array(k * 3);
  for (let j = 0; j < m; j++) {
    const c = assign[j];
    count[c]++;
    for (let ch = 0; ch < 3; ch++) {
      const dv = pts[j * 3 + ch] - mean[c * 3 + ch];
      vars[c * 3 + ch] += dv * dv;
    }
  }
  const bias = new Float64Array(k).fill(-Infinity);
  const inv = new Float64Array(k * 3);
  for (let c = 0; c < k; c++) {
    let logDet = 0;
    for (let ch = 0; ch < 3; ch++) {
      const v = Math.max(MIN_VARIANCE, count[c] ? vars[c * 3 + ch] / count[c] : MIN_VARIANCE);
      inv[c * 3 + ch] = 1 / v;
      logDet += Math.log(v);
    }
    if (count[c]) bias[c] = Math.log(count[c] / m) - 0.5 * logDet;
  }
  return { k, bias, mean, inv };
}

/** The log-likelihood of pixel i of `px` under a mixture (up to a constant shared by every mixture). */
function logLikelihood(mix: Mixture, px: Float32Array, i: number): number {
  const r = px[i * 3], g = px[i * 3 + 1], b = px[i * 3 + 2];
  const { k, bias, mean, inv } = mix;
  let best = -Infinity, sum = 0;
  for (let c = 0; c < k; c++) {
    if (bias[c] === -Infinity) continue;   // an empty cluster
    const dr = r - mean[c * 3], dg = g - mean[c * 3 + 1], db = b - mean[c * 3 + 2];
    const t = bias[c] - 0.5 * (dr * dr * inv[c * 3] + dg * dg * inv[c * 3 + 1] + db * db * inv[c * 3 + 2]);
    if (t > best) { sum = sum * Math.exp(best - t) + 1; best = t; }
    else sum += Math.exp(t - best);
  }
  return best + Math.log(sum);
}

function dilate(m: Uint8Array, w: number, h: number): Uint8Array {
  const out = new Uint8Array(m.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      out[i] = m[i] || (x > 0 && m[i - 1]) || (x < w - 1 && m[i + 1]) || (y > 0 && m[i - w]) || (y < h - 1 && m[i + w]) ? 1 : 0;
    }
  }
  return out;
}

function erode(m: Uint8Array, w: number, h: number): Uint8Array {
  const out = new Uint8Array(m.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      // The box's own edge doesn't erode: an object filling its box keeps its sides.
      out[i] = m[i] && (x === 0 || m[i - 1]) && (x === w - 1 || m[i + 1]) && (y === 0 || m[i - w]) && (y === h - 1 || m[i + w]) ? 1 : 0;
    }
  }
  return out;
}

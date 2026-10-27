// An object's real outline, traced on the device from the photo and its
// detection box (gameplay v2's glint hugs the object, not a box or an oval).
// Pure: pixels in, a polygon out.
//
//   1. The background's colours: k-means over the pixels around the box
//      (the region is the box with a margin, src/game/removal.ts).
//   2. Each pixel in the box scores by how unlike the background it is,
//      smoothed; Otsu's threshold splits object from background.
//   3. The mask is closed and opened, kept to its largest piece, its holes
//      filled.
//   4. Its edge is traced (Moore neighbour), simplified (Douglas-Peucker) and
//      rounded (Chaikin).
//
// A shape too small or filling nearly the whole box isn't trusted: null, and
// the glint falls back to its soft oval.

export interface OutlineRegion {
  /** RGBA, unpremultiplied, row-major. */
  data: Uint8Array;
  width: number;
  height: number;
  /** The object's box in the region's pixels. */
  box: { x: number; y: number; w: number; h: number };
}

export interface Point {
  x: number;
  y: number;
}

const K = 4;

/** Outline points in the region's pixels, or null when no clear shape stands out. */
export function traceOutline(region: OutlineRegion): Point[] | null {
  const { data, width: W, height: H } = region;
  const bx0 = Math.max(0, Math.floor(region.box.x));
  const by0 = Math.max(0, Math.floor(region.box.y));
  const bx1 = Math.min(W, Math.ceil(region.box.x + region.box.w));
  const by1 = Math.min(H, Math.ceil(region.box.y + region.box.h));
  const bw = bx1 - bx0;
  const bh = by1 - by0;
  if (bw < 8 || bh < 8) return null;
  const inBox = (x: number, y: number) => x >= bx0 && x < bx1 && y >= by0 && y < by1;

  // 1. Background samples: outside the box; if the box touches the region's
  // edges there may be few, so add the box's own outermost ring.
  const samples: number[][] = [];
  const step = Math.max(1, Math.floor(Math.sqrt((W * H) / 1500)));
  for (let y = 0; y < H; y += step) {
    for (let x = 0; x < W; x += step) {
      const ring = x - bx0 < 2 || bx1 - 1 - x < 2 || y - by0 < 2 || by1 - 1 - y < 2;
      if (!inBox(x, y) || ring) {
        const i = (y * W + x) * 4;
        samples.push([data[i], data[i + 1], data[i + 2]]);
      }
    }
  }
  if (samples.length < 12) return null;
  const centres = kmeans(samples, K);

  // 2. Scores: distance to the nearest background colour, box-blurred.
  const score = new Float32Array(bw * bh);
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      const i = ((y + by0) * W + (x + bx0)) * 4;
      let best = Infinity;
      for (const c of centres) {
        const dr = data[i] - c[0], dg = data[i + 1] - c[1], db = data[i + 2] - c[2];
        const d = dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11;
        if (d < best) best = d;
      }
      score[y * bw + x] = Math.sqrt(best);
    }
  }
  const smooth = blur(score, bw, bh, 2);
  const t = otsu(smooth);
  let mask: Uint8Array = new Uint8Array(bw * bh);
  for (let i = 0; i < mask.length; i++) mask[i] = smooth[i] > t ? 1 : 0;

  // 3. Clean it up.
  mask = erode(dilate(mask, bw, bh, 2), bw, bh, 2);   // close small gaps
  mask = dilate(erode(mask, bw, bh, 1), bw, bh, 1);   // drop specks
  mask = largestComponent(mask, bw, bh);
  mask = fillHoles(mask, bw, bh);
  let area = 0, objScore = 0, restScore = 0;
  for (let i = 0; i < mask.length; i++) {
    area += mask[i];
    if (mask[i]) objScore += score[i];
    else restScore += score[i];
  }
  const share = area / (bw * bh);
  if (share < 0.12 || share > 0.94) return null;
  // It must stand out: well above the background's own texture, not just its noise split in two.
  const objMean = objScore / area;
  const restMean = restScore / Math.max(1, mask.length - area);
  if (objMean < 22 || objMean < 2.2 * restMean) return null;

  // 4. Trace, simplify, round; back into the region's pixels.
  const edge = traceEdge(mask, bw, bh);
  if (edge.length < 8) return null;
  const simple = simplify(edge, Math.max(1, Math.min(bw, bh) / 60));
  if (simple.length < 4) return null;
  return chaikin(chaikin(simple)).map((p) => ({ x: p.x + bx0, y: p.y + by0 }));
}

function kmeans(points: number[][], k: number): number[][] {
  const centres = Array.from({ length: k }, (_, i) => [...points[Math.floor((i + 0.5) * points.length / k)]]);
  for (let iter = 0; iter < 8; iter++) {
    const sums = centres.map(() => [0, 0, 0, 0]);
    for (const p of points) {
      let bi = 0, bd = Infinity;
      for (let c = 0; c < k; c++) {
        const d = (p[0] - centres[c][0]) ** 2 + (p[1] - centres[c][1]) ** 2 + (p[2] - centres[c][2]) ** 2;
        if (d < bd) { bd = d; bi = c; }
      }
      const s = sums[bi];
      s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; s[3]++;
    }
    sums.forEach((s, c) => {
      if (s[3]) centres[c] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]];
    });
  }
  return centres;
}

function blur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0, n = 0;
      for (let d = -r; d <= r; d++) {
        const xx = x + d;
        if (xx >= 0 && xx < w) { s += src[y * w + xx]; n++; }
      }
      tmp[y * w + x] = s / n;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0, n = 0;
      for (let d = -r; d <= r; d++) {
        const yy = y + d;
        if (yy >= 0 && yy < h) { s += tmp[yy * w + x]; n++; }
      }
      out[y * w + x] = s / n;
    }
  }
  return out;
}

/** Otsu's threshold over a score map (64 bins). */
function otsu(values: Float32Array): number {
  let lo = Infinity, hi = -Infinity;
  for (const v of values) { if (v < lo) lo = v; if (v > hi) hi = v; }
  if (hi - lo < 1e-6) return hi;
  const bins = 64;
  const hist = new Array(bins).fill(0);
  for (const v of values) hist[Math.min(bins - 1, Math.floor(((v - lo) / (hi - lo)) * bins))]++;
  const total = values.length;
  let sum = 0;
  for (let i = 0; i < bins; i++) sum += i * hist[i];
  let sumB = 0, wB = 0, best = 0, at = 0;
  for (let i = 0; i < bins; i++) {
    wB += hist[i];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += i * hist[i];
    const mB = sumB / wB, mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > best) { best = between; at = i; }
  }
  return lo + ((at + 0.5) / bins) * (hi - lo);
}

function dilate(m: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const out = new Uint8Array(m.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let on = 0;
      for (let dy = -r; dy <= r && !on; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx >= 0 && xx < w && yy >= 0 && yy < h && m[yy * w + xx]) { on = 1; break; }
        }
      }
      out[y * w + x] = on;
    }
  }
  return out;
}

function erode(m: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const out = new Uint8Array(m.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let on = 1;
      for (let dy = -r; dy <= r && on; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || xx >= w || yy < 0 || yy >= h || !m[yy * w + xx]) { on = 0; break; }
        }
      }
      out[y * w + x] = on;
    }
  }
  return out;
}

function largestComponent(m: Uint8Array, w: number, h: number): Uint8Array {
  const label = new Int32Array(m.length).fill(-1);
  let best = -1, bestSize = 0, next = 0;
  const stack: number[] = [];
  for (let start = 0; start < m.length; start++) {
    if (!m[start] || label[start] >= 0) continue;
    let size = 0;
    stack.push(start);
    label[start] = next;
    while (stack.length) {
      const i = stack.pop()!;
      size++;
      const x = i % w, y = (i - x) / w;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || xx >= w || yy < 0 || yy >= h) continue;
        const j = yy * w + xx;
        if (m[j] && label[j] < 0) { label[j] = next; stack.push(j); }
      }
    }
    if (size > bestSize) { bestSize = size; best = next; }
    next++;
  }
  const out = new Uint8Array(m.length);
  for (let i = 0; i < m.length; i++) out[i] = label[i] === best ? 1 : 0;
  return out;
}

/** Everything not reachable from the border through background is inside. */
function fillHoles(m: Uint8Array, w: number, h: number): Uint8Array {
  const outside = new Uint8Array(m.length);
  const stack: number[] = [];
  const seed = (x: number, y: number) => {
    const i = y * w + x;
    if (!m[i] && !outside[i]) { outside[i] = 1; stack.push(i); }
  };
  for (let x = 0; x < w; x++) { seed(x, 0); seed(x, h - 1); }
  for (let y = 0; y < h; y++) { seed(0, y); seed(w - 1, y); }
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % w, y = (i - x) / w;
    if (x > 0) seed(x - 1, y);
    if (x < w - 1) seed(x + 1, y);
    if (y > 0) seed(x, y - 1);
    if (y < h - 1) seed(x, y + 1);
  }
  const out = new Uint8Array(m.length);
  for (let i = 0; i < m.length; i++) out[i] = outside[i] ? 0 : 1;
  return out;
}

/** The mask's outer edge as an ordered loop (Moore neighbour tracing). */
function traceEdge(m: Uint8Array, w: number, h: number): Point[] {
  const at = (x: number, y: number) => x >= 0 && x < w && y >= 0 && y < h && m[y * w + x] === 1;
  let sx = -1, sy = -1;
  for (let y = 0; y < h && sx < 0; y++) for (let x = 0; x < w; x++) if (at(x, y)) { sx = x; sy = y; break; }
  if (sx < 0) return [];
  const dirs = [[-1, 0], [-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1]];
  const out: Point[] = [{ x: sx, y: sy }];
  let cx = sx, cy = sy, back = 0;   // came from the west
  for (let guard = 0; guard < w * h * 4; guard++) {
    let found = false;
    for (let k = 1; k <= 8; k++) {
      const d = (back + k) % 8;
      const nx = cx + dirs[d][0], ny = cy + dirs[d][1];
      if (at(nx, ny)) {
        back = (d + 4) % 8;
        cx = nx; cy = ny;
        found = true;
        break;
      }
    }
    if (!found) break;
    if (cx === sx && cy === sy) break;
    out.push({ x: cx, y: cy });
  }
  return out;
}

function simplify(points: Point[], eps: number): Point[] {
  if (points.length < 3) return points;
  const dist = (p: Point, a: Point, b: Point) => {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / len;
  };
  const rec = (pts: Point[]): Point[] => {
    let max = 0, at = 0;
    for (let i = 1; i < pts.length - 1; i++) {
      const d = dist(pts[i], pts[0], pts[pts.length - 1]);
      if (d > max) { max = d; at = i; }
    }
    if (max <= eps) return [pts[0], pts[pts.length - 1]];
    const left = rec(pts.slice(0, at + 1));
    return [...left.slice(0, -1), ...rec(pts.slice(at))];
  };
  // A closed loop: split at its far point so both halves keep their shape.
  let far = 0, fd = 0;
  for (let i = 1; i < points.length; i++) {
    const d = Math.hypot(points[i].x - points[0].x, points[i].y - points[0].y);
    if (d > fd) { fd = d; far = i; }
  }
  const a = rec(points.slice(0, far + 1));
  const b = rec([...points.slice(far), points[0]]);
  return [...a.slice(0, -1), ...b.slice(0, -1)];
}

/** One round of corner cutting: a closed polygon, softened. */
function chaikin(points: Point[]): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i], q = points[(i + 1) % points.length];
    out.push({ x: 0.75 * p.x + 0.25 * q.x, y: 0.75 * p.y + 0.25 * q.y }, { x: 0.25 * p.x + 0.75 * q.x, y: 0.25 * p.y + 0.75 * q.y });
  }
  return out;
}

// An object's outline from a mask: the steps after segmentation, shared by the
// server (Gemini's masks, segment.ts) and the app (its on-device tracer for
// rooms without one, src/game/outline.ts). Pure TypeScript.
//
//   mask -> cleaned (a small opening drops whiskers and ears, keeping any thin
//   part that joins two big ones, a lamp's stem) -> its largest piece, holes
//   filled -> the edge, traced (Moore neighbour) -> smoothed a little (the
//   pixel steps) -> simplified (Douglas-Peucker) to at most `maxPoints`
//   corners -> cleaned again as a polygon (cleanOutline: spikes, notches and
//   self-crossings out) -> moved out half a pixel, from the edge pixels'
//   centres onto the mask's real edge.
//
// No corner cutting here: a drawer's outline keeps its corners, a rug its
// curve. The app draws the polygon as a smooth curve that keeps its corners
// (src/game/outline.ts, outlinePath).

export interface Point {
  x: number;
  y: number;
}

/** Most points an outline keeps (the stored definition carries them). */
export const MAX_OUTLINE_POINTS = 64;

/**
 * The outline of a mask's largest piece, in the mask's pixels (pixel i spans
 * i..i+1). Null when there is no piece.
 */
export function outlineOfMask(mask: Uint8Array, w: number, h: number, maxPoints = MAX_OUTLINE_POINTS): Point[] | null {
  const piece = fillHoles(largestComponent(cleanMask(mask, w, h), w, h), w, h);
  const edge = traceEdge(piece, w, h);
  if (edge.length < 4) return null;
  const smooth = smoothLoop(edge, edge.length > 40 ? 2 : 1);
  const simple = simplifyLoop(smooth, Math.max(0.6, Math.min(w, h) / 160), maxPoints);
  const pts = cleanOutline(simple);
  if (pts.length < 3) return null;
  // Edge pixels' centres (i + 0.5), then half a pixel outward: onto the mask's edge.
  return offsetLoop(pts.map((p) => ({ x: p.x + 0.5, y: p.y + 0.5 })), 0.5)
    .map((p) => ({ x: Math.min(w, Math.max(0, p.x)), y: Math.min(h, Math.max(0, p.y)) }));
}

/** A piece's appendage smaller than this share of the mask is an ear, not a part. */
const EAR = 0.04;

/**
 * A mask with its whiskers and small ears gone: opened (eroded, then dilated)
 * by a small square, and of what that took away, only the bits that join two
 * pieces (a stem) or are a real share of the shape are put back.
 */
export function cleanMask(m: Uint8Array, w: number, h: number): Uint8Array {
  const r = Math.max(1, Math.round(Math.min(w, h) / 48));
  const opened = dilateSquare(erodeSquare(m, w, h, r), w, h, r);
  let total = 0, kept = 0;
  for (let i = 0; i < m.length; i++) { total += m[i]; kept += opened[i]; }
  if (!kept || kept === total) return kept ? opened : m;
  const pieces = labels(opened, w, h);
  const rest = new Uint8Array(m.length);
  for (let i = 0; i < m.length; i++) rest[i] = m[i] && !opened[i] ? 1 : 0;
  const bits = labels(rest, w, h);
  // Per bit: its size, and which pieces it touches (eight neighbours).
  const size = new Map<number, number>();
  const touches = new Map<number, Set<number>>();
  for (let i = 0; i < m.length; i++) {
    const b = bits.label[i];
    if (b < 0) continue;
    size.set(b, (size.get(b) ?? 0) + 1);
    const x = i % w, y = (i - x) / w;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || xx >= w || yy < 0 || yy >= h) continue;
        const p = pieces.label[yy * w + xx];
        if (p >= 0) {
          let set = touches.get(b);
          if (!set) touches.set(b, (set = new Set()));
          set.add(p);
        }
      }
    }
  }
  const out = Uint8Array.from(opened);
  for (let i = 0; i < m.length; i++) {
    const b = bits.label[i];
    if (b < 0) continue;
    if ((touches.get(b)?.size ?? 0) >= 2 || (size.get(b) ?? 0) >= EAR * total) out[i] = 1;
  }
  return out;
}

function labels(m: Uint8Array, w: number, h: number): { label: Int32Array; count: number } {
  const label = new Int32Array(m.length).fill(-1);
  let next = 0;
  const stack: number[] = [];
  for (let start = 0; start < m.length; start++) {
    if (!m[start] || label[start] >= 0) continue;
    stack.push(start);
    label[start] = next;
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % w, y = (i - x) / w;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || xx >= w || yy < 0 || yy >= h) continue;
          const j = yy * w + xx;
          if (m[j] && label[j] < 0) { label[j] = next; stack.push(j); }
        }
      }
    }
    next++;
  }
  return { label, count: next };
}

/** Separable min (erode) or max (dilate) over a (2r+1) square; outside the mask counts as `edge`. */
function squareFilter(m: Uint8Array, w: number, h: number, r: number, max: boolean, edge: number): Uint8Array {
  const tmp = new Uint8Array(m.length);
  const out = new Uint8Array(m.length);
  const pick = (a: number, b: number) => (max ? (a > b ? a : b) : a < b ? a : b);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = max ? 0 : 1;
      for (let d = -r; d <= r; d++) {
        const xx = x + d;
        v = pick(v, xx < 0 || xx >= w ? edge : m[y * w + xx]);
      }
      tmp[y * w + x] = v;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = max ? 0 : 1;
      for (let d = -r; d <= r; d++) {
        const yy = y + d;
        v = pick(v, yy < 0 || yy >= h ? edge : tmp[yy * w + x]);
      }
      out[y * w + x] = v;
    }
  }
  return out;
}
// The mask's own border doesn't erode: an object filling its box (or a mask) keeps its sides.
const erodeSquare = (m: Uint8Array, w: number, h: number, r: number) => squareFilter(m, w, h, r, false, 1);
const dilateSquare = (m: Uint8Array, w: number, h: number, r: number) => squareFilter(m, w, h, r, true, 0);

/** An excursion (a spike out, a notch in) this much longer than the gap it spans, and this small, is noise. */
const SPIKE = { ratio: 2.4, area: 0.025, reach: 0.3, span: 8 };

/**
 * A traced polygon cleaned of what tracing gets wrong: spikes and ears (a few
 * points running out and back, the trace jumping off the edge for a moment),
 * notches (the same, inward), and self-crossings (the smaller loop dropped).
 * Real corners (a door's, a frame's) and real parts (a lamp's stem: a long
 * way out and back, but a real share of the shape) stay. Works in any units.
 */
export function cleanOutline(points: readonly Point[]): Point[] {
  let pts = dedupe(points);
  for (let guard = 0; guard < 4 * points.length && pts.length > 4; guard++) {
    const next = dropExcursion(pts);
    if (!next) break;
    pts = next;
  }
  pts = untangle(pts);
  return pts;
}

function dedupe(points: readonly Point[]): Point[] {
  const out: Point[] = [];
  for (const p of points) {
    const q = out[out.length - 1];
    if (!q || Math.hypot(p.x - q.x, p.y - q.y) > 1e-6) out.push({ x: p.x, y: p.y });
  }
  while (out.length > 1 && Math.hypot(out[0].x - out[out.length - 1].x, out[0].y - out[out.length - 1].y) <= 1e-6) out.pop();
  return out;
}

/** The first (shortest) spike or notch, cut off across its base; null when there is none. */
function dropExcursion(pts: Point[]): Point[] | null {
  const n = pts.length;
  const total = polygonArea(pts);
  if (total <= 0) return null;
  let perim = 0;
  const edge = pts.map((p, i) => {
    const q = pts[(i + 1) % n];
    const d = Math.hypot(q.x - p.x, q.y - p.y);
    perim += d;
    return d;
  });
  for (let k = 2; k <= Math.min(SPIKE.span, n - 3); k++) {
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + k) % n];
      const chord = Math.hypot(b.x - a.x, b.y - a.y);
      let path = 0;
      for (let j = 0; j < k; j++) path += edge[(i + j) % n];
      if (path > SPIKE.reach * perim || path < SPIKE.ratio * chord) continue;
      const ex: Point[] = [];
      for (let j = 0; j <= k; j++) ex.push(pts[(i + j) % n]);
      if (polygonArea(ex) >= SPIKE.area * total) continue;
      // Keep a, b and everything outside i..i+k.
      const out: Point[] = [];
      for (let j = 0; j < n; j++) {
        const off = (j - i + n) % n;
        if (off === 0 || off >= k) out.push(pts[j]);
      }
      return out;
    }
  }
  return null;
}

/** Where segments ab and cd cross (strictly inside both), or null. */
function crossing(a: Point, b: Point, c: Point, d: Point): Point | null {
  const r = { x: b.x - a.x, y: b.y - a.y }, s = { x: d.x - c.x, y: d.y - c.y };
  const den = r.x * s.y - r.y * s.x;
  if (Math.abs(den) < 1e-12) return null;
  const t = ((c.x - a.x) * s.y - (c.y - a.y) * s.x) / den;
  const u = ((c.x - a.x) * r.y - (c.y - a.y) * r.x) / den;
  if (t <= 1e-9 || t >= 1 - 1e-9 || u <= 1e-9 || u >= 1 - 1e-9) return null;
  return { x: a.x + t * r.x, y: a.y + t * r.y };
}

/** A loop that crosses itself split at the crossing; the bigger loop kept. */
export function untangle(points: readonly Point[]): Point[] {
  let pts = points.slice();
  for (let guard = 0; guard < points.length; guard++) {
    const n = pts.length;
    if (n < 4) return pts;
    let found: { i: number; j: number; x: Point } | null = null;
    for (let i = 0; i < n && !found; i++) {
      for (let j = i + 2; j < n; j++) {
        if (i === 0 && j === n - 1) continue;   // neighbours
        const x = crossing(pts[i], pts[(i + 1) % n], pts[j], pts[(j + 1) % n]);
        if (x) { found = { i, j, x }; break; }
      }
    }
    if (!found) return pts;
    const { i, j, x } = found;
    const inner = [x, ...pts.slice(i + 1, j + 1)];
    const outer = [x, ...pts.slice(j + 1), ...pts.slice(0, i + 1)];
    pts = polygonArea(inner) >= polygonArea(outer) ? inner : outer;
  }
  return pts;
}

/** A closed loop moved outward (away from its inside) by `d` at every point. */
export function offsetLoop(points: readonly Point[], d: number): Point[] {
  const n = points.length;
  if (n < 3 || !d) return points.slice();
  let signed = 0;
  for (let i = 0; i < n; i++) {
    const p = points[i], q = points[(i + 1) % n];
    signed += p.x * q.y - q.x * p.y;
  }
  const sign = signed > 0 ? 1 : -1;
  return points.map((p, i) => {
    const a = points[(i - 1 + n) % n], b = points[(i + 1) % n];
    const tx = b.x - a.x, ty = b.y - a.y;
    const len = Math.hypot(tx, ty) || 1;
    // With y down, a loop of positive signed area runs clockwise on screen: its outside is to the left of travel.
    return { x: p.x + (sign * ty / len) * d, y: p.y - (sign * tx / len) * d };
  });
}

/** Twice the signed area of a closed polygon (its sign is its winding). */
export function polygonArea(points: readonly Point[]): number {
  let a = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i], q = points[(i + 1) % points.length];
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a) / 2;
}

export function largestComponent(m: Uint8Array, w: number, h: number): Uint8Array {
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
      // Eight neighbours, as the edge is traced: a piece joined only at a corner is one piece.
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || xx >= w || yy < 0 || yy >= h) continue;
          const j = yy * w + xx;
          if (m[j] && label[j] < 0) { label[j] = next; stack.push(j); }
        }
      }
    }
    if (size > bestSize) { bestSize = size; best = next; }
    next++;
  }
  const out = new Uint8Array(m.length);
  if (best < 0) return out;   // nothing set
  for (let i = 0; i < m.length; i++) out[i] = label[i] === best ? 1 : 0;
  return out;
}

/** Everything not reachable from the border through background (four neighbours) is inside. */
export function fillHoles(m: Uint8Array, w: number, h: number): Uint8Array {
  const outside = new Uint8Array(m.length);
  const stack: number[] = [];
  const seed = (i: number) => {
    if (!m[i] && !outside[i]) { outside[i] = 1; stack.push(i); }
  };
  for (let x = 0; x < w; x++) { seed(x); seed((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { seed(y * w); seed(y * w + w - 1); }
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % w, y = (i - x) / w;
    if (x > 0) seed(i - 1);
    if (x < w - 1) seed(i + 1);
    if (y > 0) seed(i - w);
    if (y < h - 1) seed(i + w);
  }
  const out = new Uint8Array(m.length);
  for (let i = 0; i < m.length; i++) out[i] = outside[i] ? 0 : 1;
  return out;
}

/** The mask's outer edge as an ordered loop of edge pixels (Moore neighbour tracing, Jacob's stopping rule). */
export function traceEdge(m: Uint8Array, w: number, h: number): Point[] {
  const at = (x: number, y: number) => x >= 0 && x < w && y >= 0 && y < h && m[y * w + x] === 1;
  let sx = -1, sy = -1;
  for (let y = 0; y < h && sx < 0; y++) for (let x = 0; x < w; x++) if (at(x, y)) { sx = x; sy = y; break; }
  if (sx < 0) return [];
  // Clockwise from west; the start pixel is the first in raster order, so its west is empty.
  const dirs = [[-1, 0], [-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1]];
  const out: Point[] = [{ x: sx, y: sy }];
  let cx = sx, cy = sy, back = 0;
  let firstMove = -1;
  for (let guard = 0; guard < w * h * 4; guard++) {
    let moved = -1;
    for (let k = 1; k <= 8; k++) {
      const d = (back + k) % 8;
      if (at(cx + dirs[d][0], cy + dirs[d][1])) { moved = d; break; }
    }
    if (moved < 0) break;   // a single pixel
    // Back at the start, leaving the way it first left: the loop is closed.
    if (cx === sx && cy === sy && moved === firstMove) break;
    if (firstMove < 0) firstMove = moved;
    cx += dirs[moved][0];
    cy += dirs[moved][1];
    back = (moved + 4) % 8;
    if (!(cx === sx && cy === sy)) out.push({ x: cx, y: cy });
  }
  return out;
}

/** A closed loop, each point the mean of its neighbours within `r`: the pixel staircase smoothed out. */
export function smoothLoop(points: Point[], r: number): Point[] {
  const n = points.length;
  if (n < 2 * r + 3 || r < 1) return points;
  return points.map((_, i) => {
    let x = 0, y = 0;
    for (let d = -r; d <= r; d++) {
      const p = points[(i + d + n) % n];
      x += p.x; y += p.y;
    }
    return { x: x / (2 * r + 1), y: y / (2 * r + 1) };
  });
}

/** Douglas-Peucker over a closed loop at tolerance `eps`, loosened until at most `maxPoints` remain. */
export function simplifyLoop(points: Point[], eps: number, maxPoints = MAX_OUTLINE_POINTS): Point[] {
  let tol = eps;
  let out = simplifyClosed(points, tol);
  for (let i = 0; out.length > maxPoints && i < 30; i++) {
    tol *= 1.25;
    out = simplifyClosed(points, tol);
  }
  return out;
}

function simplifyClosed(points: Point[], eps: number): Point[] {
  if (points.length < 4) return points;
  const dist = (p: Point, a: Point, b: Point) => {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-9) return Math.hypot(p.x - a.x, p.y - a.y);
    return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / len;
  };
  // Iterative, so a long edge can't overflow the stack.
  const keep = (pts: Point[]): Point[] => {
    const kept = new Uint8Array(pts.length);
    kept[0] = kept[pts.length - 1] = 1;
    const spans: [number, number][] = [[0, pts.length - 1]];
    while (spans.length) {
      const [a, b] = spans.pop()!;
      let max = 0, at = -1;
      for (let i = a + 1; i < b; i++) {
        const d = dist(pts[i], pts[a], pts[b]);
        if (d > max) { max = d; at = i; }
      }
      if (at >= 0 && max > eps) {
        kept[at] = 1;
        spans.push([a, at], [at, b]);
      }
    }
    return pts.filter((_, i) => kept[i]);
  };
  // A closed loop: split at the point farthest from the first, so both halves keep their shape.
  let far = 0, fd = 0;
  for (let i = 1; i < points.length; i++) {
    const d = Math.hypot(points[i].x - points[0].x, points[i].y - points[0].y);
    if (d > fd) { fd = d; far = i; }
  }
  const a = keep(points.slice(0, far + 1));
  const b = keep([...points.slice(far), points[0]]);
  return [...a.slice(0, -1), ...b.slice(0, -1)];
}

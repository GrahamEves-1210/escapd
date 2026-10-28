// An object's outline from a mask: the steps after segmentation, shared by the
// server (Gemini's masks, segment.ts) and the app (its on-device tracer for
// rooms without one, src/game/outline.ts). Pure TypeScript.
//
//   mask -> its largest piece, holes filled -> the edge, traced (Moore
//   neighbour) -> smoothed a little (the pixel steps) -> simplified
//   (Douglas-Peucker) to at most `maxPoints` corners.
//
// No corner cutting: a drawer's outline keeps its corners, a rug its curve.

export interface Point {
  x: number;
  y: number;
}

/** Most points an outline keeps (the stored definition carries them). */
export const MAX_OUTLINE_POINTS = 64;

/**
 * The outline of a mask's largest piece, in the mask's pixels (pixel centres:
 * pixel i spans i..i+1, its centre i + 0.5). Null when there is no piece.
 */
export function outlineOfMask(mask: Uint8Array, w: number, h: number, maxPoints = MAX_OUTLINE_POINTS): Point[] | null {
  const piece = fillHoles(largestComponent(mask, w, h), w, h);
  const edge = traceEdge(piece, w, h);
  if (edge.length < 4) return null;
  const smooth = smoothLoop(edge, edge.length > 40 ? 2 : 1);
  const pts = simplifyLoop(smooth, Math.max(0.6, Math.min(w, h) / 160), maxPoints);
  if (pts.length < 3) return null;
  return pts.map((p) => ({ x: p.x + 0.5, y: p.y + 0.5 }));
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

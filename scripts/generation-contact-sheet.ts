/// <reference lib="deno.ns" />
// Developer-only contact sheet for generated rooms: draws each hotspot rect
// (schema v1, normalized x/y/w/h) over its photo so a human can check that
// boxes sit on the intended objects (plan section 4: "Quality the SQL still
// cannot see").
//
//   deno run --allow-read --allow-write scripts/generation-contact-sheet.ts \
//     --definition path/to/room.json [--out contact-sheet.html] photo0.jpg photo1.jpg ...
//
// Photos are given in photos[] order (photo_index 0, 1, ...). The definition
// may be a public definition or a generatePuzzle output ({ publicDefinition, ... }).
// Everything is read from local files and written to one self-contained HTML
// file (images inlined as data URIs). Nothing is uploaded. Use local fixtures
// only; never commit customer photos or the sheets made from them.

interface Rect { type: string; x: number; y: number; w: number; h: number }
interface Hotspot { id: string; photo_index: number; object_label?: string; name?: string; hidden?: boolean; shape: Rect }
interface Puzzle { id: string; kind: string; hotspot_id?: string }
interface Definition { title?: string; photos?: unknown[]; hotspots?: Hotspot[]; puzzles?: Puzzle[] }

function usage(message?: string): never {
  if (message) console.error(`error: ${message}`);
  console.error("usage: deno run --allow-read --allow-write scripts/generation-contact-sheet.ts --definition room.json [--out sheet.html] photo0.jpg [photo1.jpg ...]");
  Deno.exit(2);
}

export function parseArgs(args: string[]): { definition: string; out: string; photos: string[] } {
  let definition = "";
  let out = "contact-sheet.html";
  const photos: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--definition") definition = args[++i] ?? "";
    else if (args[i] === "--out") out = args[++i] ?? "";
    else if (args[i] === "--help" || args[i] === "-h") usage();
    else photos.push(args[i]);
  }
  if (!definition) usage("--definition is required");
  if (!out) usage("--out needs a path");
  if (!photos.length) usage("give at least one photo, in photos[] order");
  return { definition, out, photos };
}

function base64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/** Pixel size from the file header (JPEG, PNG, WebP); null if unknown. */
export function imageSize(b: Uint8Array): { width: number; height: number; mime: string } | null {
  const u16 = (o: number) => (b[o] << 8) | b[o + 1];
  const u32 = (o: number) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
  const le16 = (o: number) => b[o] | (b[o + 1] << 8);
  const le24 = (o: number) => b[o] | (b[o + 1] << 8) | (b[o + 2] << 16);
  if (b.length > 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    return { width: u32(16), height: u32(20), mime: "image/png" };
  }
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    let o = 2;
    while (o + 9 < b.length) {
      if (b[o] !== 0xff) {
        o++;
        continue;
      }
      const marker = b[o + 1];
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        o += 2;
        continue;
      }
      // SOF0..SOF15 except DHT (C4), JPG (C8), DAC (CC) carry the frame size
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { width: u16(o + 7), height: u16(o + 5), mime: "image/jpeg" };
      }
      o += 2 + u16(o + 2);
    }
    return null;
  }
  const ascii = (o: number, n: number) => String.fromCharCode(...b.subarray(o, o + n));
  if (b.length > 30 && ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") {
    const chunk = ascii(12, 4);
    if (chunk === "VP8X") return { width: le24(24) + 1, height: le24(27) + 1, mime: "image/webp" };
    if (chunk === "VP8 ") return { width: le16(26) & 0x3fff, height: le16(28) & 0x3fff, mime: "image/webp" };
    if (chunk === "VP8L") {
      const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1, mime: "image/webp" };
    }
  }
  return null;
}

const escapeHtml = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function renderSheet(def: Definition, images: Array<{ name: string; bytes: Uint8Array }>): string {
  const hotspots = def.hotspots ?? [];
  const puzzles = def.puzzles ?? [];
  const kindsFor = (id: string) => puzzles.filter((p) => p.hotspot_id === id).map((p) => `${p.kind}:${p.id}`).join(", ");
  const warnings: string[] = [];
  if ((def.photos?.length ?? 0) !== images.length) {
    warnings.push(`definition lists ${def.photos?.length ?? 0} photos but ${images.length} were given`);
  }

  const figures = images.map((img, index) => {
    const size = imageSize(img.bytes);
    if (!size) warnings.push(`${img.name}: unknown image format, drawn at 4:3`);
    const width = size?.width ?? 1000;
    const height = size?.height ?? 750;
    const stroke = Math.max(2, Math.round(width / 300));
    const font = Math.max(12, Math.round(width / 45));
    const rects = hotspots.filter((h) => h.photo_index === index).map((h) => {
      const px = (n: number) => Math.round(n * 10) / 10;
      const x = px(h.shape.x * width);
      const y = px(h.shape.y * height);
      const w = px(h.shape.w * width);
      const hh = px(h.shape.h * height);
      const color = h.hidden ? "#D7A85E" : "#64C7B8";
      const label = escapeHtml(h.id);
      return `<g><rect x="${x}" y="${y}" width="${w}" height="${hh}" fill="none" stroke="${color}" stroke-width="${stroke}"${h.hidden ? ` stroke-dasharray="${stroke * 4} ${stroke * 2}"` : ""}/>` +
        `<rect x="${x}" y="${px(Math.max(0, y - font * 1.4))}" width="${px(Math.max(w, label.length * font * 0.62))}" height="${px(font * 1.4)}" fill="rgba(11,16,20,0.78)"/>` +
        `<text x="${px(x + font * 0.3)}" y="${px(Math.max(0, y - font * 1.4) + font * 1.05)}" font-size="${font}" fill="${color}" font-family="ui-monospace, monospace">${label}</text></g>`;
    }).join("");
    const mime = size?.mime ?? "image/jpeg";
    return `<figure><figcaption>photo_index ${index} · ${escapeHtml(img.name)} · ${width}×${height}</figcaption>` +
      `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="photo ${index} with hotspots">` +
      `<image href="data:${mime};base64,${base64(img.bytes)}" width="${width}" height="${height}"/>${rects}</svg></figure>`;
  }).join("\n");

  const rows = hotspots.map((h) =>
    `<tr><td>${escapeHtml(h.id)}</td><td>${h.photo_index}</td><td>${escapeHtml(h.object_label)}</td><td>${escapeHtml(h.name)}</td>` +
    `<td>${h.hidden ? "hidden" : ""}</td><td>${[h.shape.x, h.shape.y, h.shape.w, h.shape.h].map((n) => Number(n).toFixed(3)).join(", ")}</td>` +
    `<td>${escapeHtml(kindsFor(h.id))}</td></tr>`
  ).join("\n");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Contact sheet</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; padding: 24px 16px; background: #0B1014; color: #E9EEF0; font: 14px/1.45 system-ui, sans-serif; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  p.meta { color: #A7B5BA; margin: 0 0 20px; }
  .warn { color: #D7A85E; }
  figure { margin: 0 0 24px; }
  figcaption { color: #A7B5BA; margin-bottom: 6px; font-family: ui-monospace, monospace; font-size: 12px; }
  svg { display: block; width: 100%; max-width: 1100px; height: auto; background: #111A20; }
  table { border-collapse: collapse; width: 100%; max-width: 1100px; font-size: 13px; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #2C3940; vertical-align: top; }
  th { color: #A7B5BA; font-weight: 600; }
  .wrap { overflow-x: auto; }
</style></head><body>
<h1>${escapeHtml(def.title ?? "Generated room")}</h1>
<p class="meta">Developer contact sheet. Teal = visible hotspot, amber dashed = hidden until revealed. Labels are hotspot ids.</p>
${warnings.map((w) => `<p class="warn">${escapeHtml(w)}</p>`).join("\n")}
${figures}
<div class="wrap"><table><thead><tr><th>id</th><th>photo</th><th>object_label</th><th>name</th><th></th><th>x, y, w, h</th><th>puzzles</th></tr></thead>
<tbody>${rows}</tbody></table></div>
</body></html>
`;
}

if (import.meta.main) {
  const { definition, out, photos } = parseArgs(Deno.args);
  const raw = JSON.parse(await Deno.readTextFile(definition));
  const def: Definition = raw && typeof raw === "object" && "publicDefinition" in raw ? raw.publicDefinition : raw;
  const images = await Promise.all(photos.map(async (path) => ({ name: path.split(/[\\/]/).pop() ?? path, bytes: await Deno.readFile(path) })));
  await Deno.writeTextFile(out, renderSheet(def, images));
  console.log(`wrote ${out} (${images.length} photos, ${def.hotspots?.length ?? 0} hotspots)`);
}

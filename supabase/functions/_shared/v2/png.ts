// A small PNG decoder for Gemini's segmentation masks (segment.ts): one value
// per pixel, 0-255. No dependency: the image data is a zlib stream, which the
// web-standard DecompressionStream("deflate") inflates (Deno, and Node 18+).
//
// Handles what a mask can be: greyscale, grey + alpha, RGB, RGBA or a palette;
// 1, 2, 4, 8 or 16 bits; not interlaced. A colour pixel's value is its mean
// channel; an alpha channel scales it (a white mask drawn in alpha works too).
// Anything else, or a broken file, is null.

export interface GreyImage {
  width: number;
  height: number;
  /** One value per pixel, row-major. */
  data: Uint8Array;
}

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const CHANNELS: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
/** Larger is refused: a mask covers one object's box. */
const MAX_PIXELS = 4096 * 4096;

export async function decodePng(bytes: Uint8Array): Promise<GreyImage | null> {
  try {
    if (bytes.length < 33 || SIGNATURE.some((b, i) => bytes[i] !== b)) return null;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let width = 0, height = 0, depth = 0, colour = 0, interlace = 0;
    let palette: Uint8Array | null = null;
    let transparency: Uint8Array | null = null;
    const idat: Uint8Array[] = [];
    for (let at = 8; at + 8 <= bytes.length;) {
      const length = view.getUint32(at);
      const type = String.fromCharCode(bytes[at + 4], bytes[at + 5], bytes[at + 6], bytes[at + 7]);
      const body = bytes.subarray(at + 8, at + 8 + length);
      if (body.length < length) return null;
      if (type === "IHDR") {
        width = view.getUint32(at + 8);
        height = view.getUint32(at + 12);
        depth = bytes[at + 16];
        colour = bytes[at + 17];
        interlace = bytes[at + 20];
      } else if (type === "PLTE") palette = body;
      else if (type === "tRNS") transparency = body;
      else if (type === "IDAT") idat.push(body);
      else if (type === "IEND") break;
      at += 12 + length;
    }
    const channels = CHANNELS[colour];
    if (!channels || !width || !height || width * height > MAX_PIXELS || interlace !== 0 || !idat.length) return null;
    if (![1, 2, 4, 8, 16].includes(depth) || (depth < 8 && colour !== 0 && colour !== 3) || (depth === 16 && colour === 3)) return null;
    if (colour === 3 && !palette) return null;

    const raw = await inflate(idat);
    const bitsPerPixel = channels * depth;
    const stride = Math.ceil((width * bitsPerPixel) / 8);
    const bpp = Math.max(1, bitsPerPixel >> 3);   // the filters' byte distance
    if (raw.length < height * (stride + 1)) return null;

    // Undo each row's filter (PNG spec §9).
    const rows = new Uint8Array(height * stride);
    for (let y = 0; y < height; y++) {
      const filter = raw[y * (stride + 1)];
      const src = y * (stride + 1) + 1, dst = y * stride, prev = dst - stride;
      for (let x = 0; x < stride; x++) {
        const a = x >= bpp ? rows[dst + x - bpp] : 0;
        const b = y > 0 ? rows[prev + x] : 0;
        const c = x >= bpp && y > 0 ? rows[prev + x - bpp] : 0;
        let v = raw[src + x];
        switch (filter) {
          case 0: break;
          case 1: v += a; break;
          case 2: v += b; break;
          case 3: v += (a + b) >> 1; break;
          case 4: {
            const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
            v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
            break;
          }
          default: return null;
        }
        rows[dst + x] = v & 255;
      }
    }

    // One sample (0-255) of row y, sample index i.
    const sample = (y: number, i: number): number => {
      const row = y * stride;
      if (depth === 8) return rows[row + i];
      if (depth === 16) return rows[row + i * 2];   // the high byte
      const bit = i * depth;
      const v = (rows[row + (bit >> 3)] >> (8 - depth - (bit & 7))) & ((1 << depth) - 1);
      return colour === 3 ? v : Math.round((v * 255) / ((1 << depth) - 1));
    };
    const data = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let v: number;
        if (colour === 3) {
          const k = sample(y, x);
          const p = k * 3;
          v = palette!.length >= p + 3 ? (palette![p] + palette![p + 1] + palette![p + 2]) / 3 : 0;
          if (transparency && k < transparency.length) v = (v * transparency[k]) / 255;
        } else {
          const s = x * channels;
          const colours = colour === 2 || colour === 6 ? 3 : 1;
          v = 0;
          for (let ch = 0; ch < colours; ch++) v += sample(y, s + ch);
          v /= colours;
          if (colour === 4 || colour === 6) v = (v * sample(y, s + colours)) / 255;
        }
        data[y * width + x] = Math.round(v);
      }
    }
    return { width, height, data };
  } catch {
    return null;
  }
}

async function inflate(parts: Uint8Array[]): Promise<Uint8Array> {
  const stream = new Blob(parts as BlobPart[]).stream().pipeThrough(new DecompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/* global Buffer */
// A light stand-in for @shopify/react-native-skia under Jest. The package's
// own mock (its jestSetup.js) needs CanvasKit's 8 MB wasm loaded in every
// test file; this one draws nothing and records instead. Each call on a
// surface's canvas is pushed to `__skia.draws` as { op, paint } with the
// paint's settings, so a test can check what a bake drew and in what order;
// `__skia.images` lists the photos decoded. An encoded image is "baked:" plus
// its size. Set `__skia.decodeSize` to change the size a decoded photo
// reports, or `__skia.failDecode` to make decoding fail.
const BlendMode = {
  Clear: 0, Src: 1, Dst: 2, SrcOver: 3, DstOver: 4, SrcIn: 5, DstIn: 6, SrcOut: 7, DstOut: 8, SrcATop: 9, DstATop: 10,
  Xor: 11, Plus: 12, Modulate: 13, Screen: 14, Overlay: 15, Darken: 16, Lighten: 17, ColorDodge: 18, ColorBurn: 19,
  HardLight: 20, SoftLight: 21, Difference: 22, Exclusion: 23, Multiply: 24, Hue: 25, Saturation: 26, Color: 27, Luminosity: 28,
};
const TileMode = { Clamp: 0, Repeat: 1, Mirror: 2, Decal: 3 };
const FilterMode = { Nearest: 0, Linear: 1 };
const MipmapMode = { None: 0, Nearest: 1, Linear: 2 };
const ImageFormat = { JPEG: 3, PNG: 4, WEBP: 6 };

const state = {
  draws: [],
  images: [],
  surfaces: [],
  disposed: 0,
  decodeSize: { width: 1200, height: 1600 },
  failDecode: false,
  reset() {
    state.draws = [];
    state.images = [];
    state.surfaces = [];
    state.disposed = 0;
    state.decodeSize = { width: 1200, height: 1600 };
    state.failDecode = false;
  },
};

const disposable = (object) => Object.assign(object, { dispose: () => { state.disposed += 1; } });

function makeImage(width, height, from) {
  return disposable({
    from,
    width: () => width,
    height: () => height,
    makeShaderOptions: (tx, ty, fm, mm) => ({ kind: "image", image: from, tx, ty, fm, mm }),
    makeNonTextureImage() { return this; },
    encodeToBytes: (format, quality) => new TextEncoder().encode(`baked:${width}x${height}:${format}:${quality}`),
    encodeToBase64: (format, quality) => Buffer.from(`baked:${width}x${height}:${format}:${quality}`).toString("base64"),
  });
}

function makePaint() {
  const paint = { blendMode: BlendMode.SrcOver, alpha: 1, shader: null, colorFilter: null, imageFilter: null };
  return disposable({
    settings: paint,
    setBlendMode: (mode) => { paint.blendMode = mode; },
    setAlphaf: (alpha) => { paint.alpha = alpha; },
    setShader: (shader) => { paint.shader = shader; },
    setColorFilter: (filter) => { paint.colorFilter = filter; },
    setImageFilter: (filter) => { paint.imageFilter = filter; },
  });
}

function makeSurface(width, height) {
  const surface = { width, height };
  const record = (op, paint, extra = {}) => state.draws.push({ op, surface: state.surfaces.indexOf(surface), paint: paint ? { ...paint.settings } : null, ...extra });
  const canvas = {
    drawPaint: (paint) => record("drawPaint", paint),
    drawRect: (rect, paint) => record("drawRect", paint, { rect }),
    drawImageRect: (image, src, dest, paint) => record("drawImage", paint, { image: image.from, dest }),
    drawImageRectOptions: (image, src, dest, fm, mm, paint) => record("drawImage", paint, { image: image.from, dest, fm, mm }),
  };
  Object.assign(surface, {
    getCanvas: () => canvas,
    flush: () => {},
    makeImageSnapshot: () => makeImage(width, height, `surface:${state.surfaces.indexOf(surface)}`),
  });
  state.surfaces.push(surface);
  return disposable(surface);
}

const Skia = {
  XYWHRect: (x, y, width, height) => ({ x, y, width, height }),
  Color: (value) => value,
  Paint: makePaint,
  Surface: { Make: makeSurface, MakeOffscreen: makeSurface },
  Image: {
    MakeImageFromEncoded: (data) => {
      if (state.failDecode) return null;
      state.images.push(data.uri);
      return makeImage(state.decodeSize.width, state.decodeSize.height, data.uri);
    },
  },
  Data: { fromURI: async (uri) => ({ uri }), fromBytes: (bytes) => ({ bytes }) },
  ColorFilter: { MakeMatrix: (matrix) => ({ kind: "matrix", matrix: [...matrix] }) },
  ImageFilter: { MakeBlur: (sigmaX, sigmaY, mode) => ({ kind: "blur", sigmaX, sigmaY, mode }) },
  Shader: {
    MakeFractalNoise: (fx, fy, octaves, seed, tileW, tileH) => ({ kind: "fractalNoise", fx, fy, octaves, seed, tileW, tileH }),
    MakeRadialGradient: (center, radius, colors, positions, mode) => ({ kind: "radial", center, radius, colors, positions, mode }),
  },
};

/** As the package's: a uri as it is, a bundled asset by its module id. */
async function loadData(source, factory) {
  const uri = typeof source === "number" ? `asset:${source}` : source;
  return factory(await Skia.Data.fromURI(uri));
}

module.exports = {
  __esModule: true,
  __skia: state,
  Skia,
  loadData,
  BlendMode,
  TileMode,
  FilterMode,
  MipmapMode,
  ImageFormat,
};

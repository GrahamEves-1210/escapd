import { AssetRegistry } from "react-native";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import * as skia from "@shopify/react-native-skia";
import { modeThemes, ref } from "@/theme/tokens";
import { clearTreatedPhotos, peekTreatedPhoto, treatPhoto, useTreatedPhoto } from "../treatPhoto";

// An in-memory cache directory.
jest.mock("expo-file-system", () => {
  const files = new Map<string, Uint8Array>();
  const join = (parts: unknown[]) => parts.map((p) => (typeof p === "string" ? p : (p as { uri: string }).uri)).join("/");
  class Directory {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = join(parts);
    }
    create() {}
    list() {
      return [...files.keys()].filter((uri) => uri.startsWith(`${this.uri}/`)).map((uri) => new File(uri));
    }
  }
  class File {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = join(parts);
    }
    get name() {
      return this.uri.slice(this.uri.lastIndexOf("/") + 1);
    }
    get exists() {
      return files.has(this.uri);
    }
    async write(bytes: Uint8Array) {
      files.set(this.uri, bytes);
    }
    delete() {
      files.delete(this.uri);
    }
  }
  return { __files: files, Directory, File, Paths: { cache: { uri: "file:///cache" } } };
});

const fsMock = jest.requireMock<{ __files: Map<string, Uint8Array> }>("expo-file-system");
const mock = (skia as unknown as { __skia: { draws: { op: string; surface: number; paint: Record<string, unknown> | null; image?: string; dest?: { width: number; height: number } }[]; images: string[]; decodeSize: { width: number; height: number }; failDecode: boolean; disposed: number; reset(): void } }).__skia;

const PHOTO = "https://example.supabase.co/storage/v1/object/sign/room-photos/u/r/p.jpg?token=one";

beforeEach(() => {
  clearTreatedPhotos();
  mock.reset();
  fsMock.__files.clear();
});

afterEach(() => {
  jest.restoreAllMocks();
});

const CACHE = "file:///cache/treated-photos";
const withHash = (hash: string) => ({ hash }) as ReturnType<typeof AssetRegistry.getAssetByID>;

/** The draws on the photo's own surface (the grain tile and the glow are drawn on others). */
const photoDraws = () => {
  const main = mock.draws.find((d) => d.op === "drawImage" && d.image === PHOTO)?.surface;
  return mock.draws.filter((d) => d.surface === main);
};

describe("treatPhoto", () => {
  it("draws the photo through the mode's toe, its matrix over that, then the grain, then the vignette", async () => {
    await treatPhoto(PHOTO, "noir");
    const t = modeThemes.noir.treatment!;
    const [floor, photo, grain, vignette, ...rest] = photoDraws();
    expect(rest).toEqual([]);
    expect(floor).toMatchObject({ op: "drawImage", image: PHOTO, paint: { colorFilter: { kind: "matrix", matrix: [...t.toe!] }, blendMode: skia.BlendMode.SrcOver } });
    // Each channel keeps the brighter of the two.
    expect(photo).toMatchObject({ op: "drawImage", image: PHOTO, paint: { colorFilter: { kind: "matrix", matrix: [...t.matrix] }, blendMode: skia.BlendMode.Lighten } });
    expect(grain).toMatchObject({
      op: "drawRect",
      paint: { blendMode: skia.BlendMode.Overlay, alpha: t.grain, shader: { kind: "image", tx: skia.TileMode.Repeat, ty: skia.TileMode.Repeat } },
    });
    expect(vignette).toMatchObject({ op: "drawRect", paint: { shader: { kind: "radial", positions: [0, ref.treatment.vignette.from, 1] } } });
    expect((vignette.paint!.shader as { colors: string[] }).colors[2]).toBe(`rgba(0, 0, 0, ${t.vignette})`);
  });

  it("makes the grain tile once, from tileable fractal noise", async () => {
    await treatPhoto(PHOTO, "noir");
    await treatPhoto(PHOTO, "crime_scene");
    const noise = mock.draws.filter((d) => d.op === "drawPaint");
    expect(noise).toHaveLength(1);
    const { tile, frequency, octaves, seed } = ref.treatment.grain;
    expect(noise[0].paint!.shader).toEqual({ kind: "fractalNoise", fx: frequency, fy: frequency, octaves, seed, tileW: tile, tileH: tile });
  });

  it("a grade with no toe is one plain pass", async () => {
    await treatPhoto(PHOTO, "paranormal");
    const t = modeThemes.paranormal.treatment!;
    expect(t.toe).toBeNull();
    expect(photoDraws()[0]).toMatchObject({ op: "drawImage", image: PHOTO, paint: { colorFilter: { matrix: [...t.matrix] }, blendMode: skia.BlendMode.SrcOver } });
  });

  it("screens a blurred glow of the graded photo over paranormal photos only", async () => {
    await treatPhoto(PHOTO, "paranormal");
    const [photo, glow] = photoDraws();
    expect(glow).toMatchObject({ op: "drawImage", paint: { blendMode: skia.BlendMode.Screen, alpha: modeThemes.paranormal.treatment!.bloom } });
    // The glow is the graded photo itself (a snapshot of its surface), small and blurred.
    const blurred = mock.draws.find((d) => d.op === "drawImage" && (d.paint?.imageFilter as { kind?: string } | null)?.kind === "blur");
    expect(blurred?.image).toBe(`surface:${photo.surface}`);
    expect(blurred?.paint?.colorFilter).toBeNull();
    expect(blurred?.dest).toMatchObject({ width: 1200 * ref.treatment.bloom.scale, height: 1600 * ref.treatment.bloom.scale });
    mock.reset();
    await treatPhoto(PHOTO, "noir");
    expect(mock.draws.some((d) => d.paint?.blendMode === skia.BlendMode.Screen)).toBe(false);
  });

  it("bakes at the photo's own size, at most maxEdge on the long edge", async () => {
    await treatPhoto(PHOTO, "noir");
    expect(photoDraws()[0].dest).toMatchObject({ width: 1200, height: 1600 });
    clearTreatedPhotos();
    fsMock.__files.clear();
    mock.reset();
    mock.decodeSize = { width: 4000, height: 3000 };
    await treatPhoto(PHOTO, "noir");
    expect(photoDraws()[0].dest).toMatchObject({ width: ref.treatment.maxEdge, height: 1200 });
    mock.reset();
    await treatPhoto(PHOTO, "noir", { maxEdge: 400 });
    expect(photoDraws()[0].dest).toMatchObject({ width: 1200 * (400 / 1600), height: 400 });
  });

  it("writes a JPEG to the cache directory and gives its file uri", async () => {
    const uri = await treatPhoto(PHOTO, "crime_scene");
    // Named for the recipe, then the photo.
    expect(uri).toMatch(/^file:\/\/\/cache\/treated-photos\/[0-9a-f]{16}-[0-9a-f]{16}\.jpg$/);
    expect(new TextDecoder().decode(fsMock.__files.get(uri!))).toBe(`baked:1200x1600:${skia.ImageFormat.JPEG}:${ref.treatment.quality}`);
  });

  it("caches by photo and mode: one bake each, however often it is asked for", async () => {
    const [a, b] = await Promise.all([treatPhoto(PHOTO, "noir"), treatPhoto(PHOTO, "noir")]);
    expect(a).toBe(b);
    expect(await treatPhoto(PHOTO, "noir")).toBe(a);
    expect(mock.images).toEqual([PHOTO]);
    const other = await treatPhoto(PHOTO, "paranormal");
    expect(other).not.toBe(a);
    expect(mock.images).toEqual([PHOTO, PHOTO]);
    expect(peekTreatedPhoto(PHOTO, "noir")).toBe(a);
    expect(peekTreatedPhoto(PHOTO, "crime_scene")).toBeUndefined();
  });

  it("a signed URL's new token is the same photo; a baked file on disk is reused without a bake", async () => {
    const first = await treatPhoto(PHOTO, "noir");
    expect(await treatPhoto(PHOTO.replace("token=one", "token=two"), "noir")).toBe(first);
    // A new launch: memory is empty, the file is still there.
    clearTreatedPhotos();
    mock.reset();
    expect(await treatPhoto(PHOTO.replace("token=one", "token=three"), "noir")).toBe(first);
    expect(mock.images).toEqual([]);
  });

  it("names a photo by cacheKey when one is given", async () => {
    const first = await treatPhoto("file:///a.jpg", "noir", { cacheKey: "photo-1" });
    expect(await treatPhoto("file:///b.jpg", "noir", { cacheKey: "photo-1" })).toBe(first);
    expect(await treatPhoto("file:///b.jpg", "noir")).not.toBe(first);
  });

  it("names a bundled asset by its content hash, so a later launch reuses its file without a bake", async () => {
    jest.spyOn(AssetRegistry, "getAssetByID").mockReturnValue(withHash("5d41402abc4b2a76b9719d911017c592"));
    const uri = await treatPhoto(7, "noir");
    expect(uri).toMatch(/\/[0-9a-f]{16}-[0-9a-f]{16}\.jpg$/);
    expect(mock.images).toEqual(["asset:7"]);
    clearTreatedPhotos();
    mock.reset();
    expect(await treatPhoto(7, "noir")).toBe(uri);
    expect(mock.images).toEqual([]);
    // A changed picture is a new photo.
    jest.spyOn(AssetRegistry, "getAssetByID").mockReturnValue(withHash("7d793037a0760186574b0282f2f435e7"));
    expect(await treatPhoto(7, "noir")).not.toBe(uri);
  });

  it("bakes an asset with no content hash each launch: its file is named for this launch, never reused from disk", async () => {
    const uri = await treatPhoto(7, "noir");
    expect(uri).toMatch(/[0-9a-f]{16}-[0-9a-f]{16}-[0-9a-z]+\.jpg$/);
    clearTreatedPhotos();
    mock.reset();
    await treatPhoto(7, "noir");
    expect(mock.images).toEqual(["asset:7"]);
  });

  it("the first write of a launch deletes other launches' and recipes' files, and keeps this launch's and lasting ones", async () => {
    const lasting = (await treatPhoto(PHOTO, "noir"))!;
    const thisLaunch = (await treatPhoto(7, "noir"))!;
    const stale = [
      `${CACHE}/0123456789abcdef-0123456789abcdef-old1.jpg`,
      `${CACHE}/0123456789abcdef.jpg`,
      lasting.replace(/\/[0-9a-f]{16}-/, "/ffffffffffffffff-"),
      thisLaunch.replace(/-[0-9a-z]+\.jpg$/, "-zzzz.jpg"),
    ];
    for (const uri of stale) fsMock.__files.set(uri, new Uint8Array());
    fsMock.__files.set("file:///cache/elsewhere/keep.jpg", new Uint8Array());
    // The same launch never sweeps twice; a new one sweeps on its first write.
    clearTreatedPhotos();
    await treatPhoto(PHOTO, "crime_scene");
    const left = [...fsMock.__files.keys()];
    for (const uri of stale) expect(left).not.toContain(uri);
    expect(left).toEqual(expect.arrayContaining([lasting, thisLaunch, "file:///cache/elsewhere/keep.jpg"]));
    fsMock.__files.set(stale[0], new Uint8Array());
    await treatPhoto(PHOTO, "paranormal");
    expect([...fsMock.__files.keys()]).toContain(stale[0]);
  });

  it("treats nothing in the shell or without a photo", async () => {
    expect(await treatPhoto(PHOTO, null)).toBeNull();
    expect(await treatPhoto(null, "noir")).toBeNull();
    expect(mock.images).toEqual([]);
  });

  it("a photo that can't be decoded comes back null, so the original shows, and is tried again next time", async () => {
    mock.failDecode = true;
    expect(await treatPhoto(PHOTO, "noir")).toBeNull();
    expect(peekTreatedPhoto(PHOTO, "noir")).toBeUndefined();
    mock.failDecode = false;
    expect(await treatPhoto(PHOTO, "noir")).toEqual(expect.any(String));
  });

  it("lets go of every Skia object it made for the bake", async () => {
    await treatPhoto(PHOTO, "paranormal");
    // The photo, both surfaces, the graded snapshot, the glow and the result (the grain tile's surface too; the tile itself is kept).
    expect(mock.disposed).toBe(7);
  });
});

describe("useTreatedPhoto", () => {
  it("is null while the photo bakes, then the baked uri", async () => {
    const { result } = await renderHook(() => useTreatedPhoto(PHOTO, "noir"));
    expect(result.current).toBeNull();
    await waitFor(() => expect(result.current).toMatch(/^file:/));
  });

  it("reads an already baked photo on the first render", async () => {
    const uri = await treatPhoto(PHOTO, "paranormal");
    const { result } = await renderHook(() => useTreatedPhoto({ uri: PHOTO }, "paranormal"));
    expect(result.current).toBe(uri);
  });

  it("follows a change of mode, and is null in the shell", async () => {
    const { result, rerender } = await renderHook(({ genre }: { genre: "noir" | "crime_scene" | null }) => useTreatedPhoto(PHOTO, genre), {
      initialProps: { genre: "noir" as "noir" | "crime_scene" | null },
    });
    await waitFor(() => expect(result.current).not.toBeNull());
    const noir = result.current;
    await act(async () => rerender({ genre: "crime_scene" }));
    await waitFor(() => {
      expect(result.current).toMatch(/^file:/);
      expect(result.current).not.toBe(noir);
    });
    await act(async () => rerender({ genre: null }));
    expect(result.current).toBeNull();
  });
});

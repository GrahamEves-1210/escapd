// Photo processing and a full --stub trial run. No network beyond the npm
// registry for jimp on a cold cache; never Gemini, never Supabase.
import { assert, assertEquals, assertRejects, assertStringIncludes } from "jsr:@std/assert@1";
import { Jimp } from "npm:jimp@1.6.0";
import { defaultOutDir, parseArgs, runTrial, serve } from "../try-room.ts";
import { reveal } from "./play-html.ts";
import { hasExif, processPhoto, sniffFormat, UnsupportedPhotoError } from "./process.ts";

/** A JPEG of the given stored size, optionally tagged EXIF Orientation = 6 (rotate 90° clockwise). */
async function jpeg(width: number, height: number, rotated = false): Promise<Uint8Array> {
  const image = new Jimp({ width, height, color: 0x806040ff });
  const plain = new Uint8Array(await image.getBuffer("image/jpeg", { quality: 90 }));
  if (!rotated) return plain;
  const tiff = [0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08, 0x00, 0x01, 0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, 0x06, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];
  const payload = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00, ...tiff];
  const len = payload.length + 2;
  return new Uint8Array([...plain.subarray(0, 2), 0xff, 0xe1, (len >> 8) & 0xff, len & 0xff, ...payload, ...plain.subarray(2)]);
}

async function png(width: number, height: number): Promise<Uint8Array> {
  return new Uint8Array(await new Jimp({ width, height, color: 0x406080ff }).getBuffer("image/png"));
}

const HEIC = new Uint8Array([0, 0, 0, 0x18, ...new TextEncoder().encode("ftypheic"), 0, 0, 0, 0]);

Deno.test("photos are processed like the app's uploads", async () => {
  const tagged = await jpeg(4000, 3000, true);
  assert(hasExif(tagged));
  const portrait = await processPhoto("portrait.jpg", tagged);
  // Orientation applied (stored landscape, shown portrait), long edge capped at 1600, metadata gone.
  assertEquals([portrait.sourceWidth, portrait.sourceHeight], [3000, 4000]);
  assertEquals([portrait.width, portrait.height], [1200, 1600]);
  assertEquals(sniffFormat(portrait.bytes), "jpeg");
  assert(!hasExif(portrait.bytes));

  const small = await processPhoto("small.png", await png(800, 600));
  assertEquals([small.width, small.height], [800, 600]);   // never upscaled
  assertEquals(sniffFormat(small.bytes), "jpeg");          // always re-encoded as JPEG

  await assertRejects(() => processPhoto("IMG_0001.HEIC", HEIC), UnsupportedPhotoError, "Export it as JPEG");
  await assertRejects(() => processPhoto("notes.txt", new TextEncoder().encode("hello")), UnsupportedPhotoError, "not a JPEG or PNG");
});

Deno.test("argument parsing", () => {
  const opts = parseArgs(["--stub", "--out", "x", "a.jpg", "b.jpg", "c.jpg"]);
  assertEquals(opts, { photos: ["a.jpg", "b.jpg", "c.jpg"], out: "x", stub: true, serve: false, serveDir: "", port: 8787 });
  assertEquals(parseArgs(["--serve-dir", "old"]).serveDir, "old");
  assertStringIncludes(defaultOutDir(new Date(2026, 9, 23, 9, 5, 7)), "20261023-090507");
});

Deno.test("a --stub trial writes every file and a playable, unspoiled play.html", async () => {
  const out = await Deno.makeTempDir({ prefix: "escapd-trial-test-" });
  try {
    const photos = await Promise.all([
      processPhoto("one.jpg", await jpeg(4000, 3000, true)),
      processPhoto("two.png", await png(1200, 900)),
      processPhoto("three.jpg", await jpeg(3000, 4000)),
    ]);
    const result = await runTrial({ photos: [], out, stub: true, serve: false, serveDir: "", port: 8787 }, photos);
    assert(result.ok, result.summary);
    for (const name of ["public.json", "solution.json", "usage.json", "stages.log", "sheet.html", "play.html", "photo-1.jpg", "photo-2.jpg", "photo-3.jpg"]) {
      const info = await Deno.stat(`${out}/${name}`);
      assert(info.size > 0, `${name} is empty`);
    }
    assertStringIncludes(result.summary, "Required steps");
    assertStringIncludes(result.summary, "STUB run");

    const pub = JSON.parse(await Deno.readTextFile(`${out}/public.json`));
    const sol = JSON.parse(await Deno.readTextFile(`${out}/solution.json`));
    const html = await Deno.readTextFile(`${out}/play.html`);

    // The embedded blob decodes back to exactly what was written.
    const blob = html.match(/<script type="application\/octet-stream" id="trial-data">([^<]+)<\/script>/)?.[1] ?? "";
    const data = reveal(blob) as { public: unknown; secret: unknown };
    assertEquals(data.public, pub);
    assertEquals(data.secret, sol);

    // No answers, hints or solve messages in plain text (photo data URIs excluded: base64 can contain digit runs).
    const text = html.replace(/data:[a-z/]+;base64,[A-Za-z0-9+/=]+/g, "").replace(blob, "");
    const secrets: string[] = [];
    for (const entry of Object.values(sol.puzzles as Record<string, { answer?: string; hints?: string[]; message?: string }>)) {
      if (entry.answer) secrets.push(entry.answer);
      secrets.push(...(entry.hints ?? []));
      if (entry.message) secrets.push(entry.message);
    }
    for (const item of pub.items as Array<{ description?: string }>) if (item.description) secrets.push(item.description);
    assert(secrets.some((s) => /\d{4}/.test(s)), "expected the stub to produce a 4-digit code");
    for (const s of secrets) assert(!text.includes(s), `play.html leaks: ${s}`);

    // Both inline scripts parse.
    const scripts = [...html.matchAll(/<script>\n([\s\S]*?)\n<\/script>/g)].map((m) => m[1]);
    assertEquals(scripts.length, 2);
    for (const src of scripts) new Function(src);
  } finally {
    await Deno.remove(out, { recursive: true });
  }
});

Deno.test("--serve serves the trial but never solution.json or other folders", async () => {
  const dir = await Deno.makeTempDir({ prefix: "escapd-trial-serve-" });
  const log = console.log;
  console.log = () => {};
  const server = serve(dir, 18787);
  try {
    await Deno.writeTextFile(`${dir}/play.html`, "<!doctype html><title>ok</title>");
    await Deno.writeTextFile(`${dir}/solution.json`, "{}");
    const get = async (path: string) => {
      const res = await fetch(`http://localhost:18787${path}`);
      return { status: res.status, type: res.headers.get("content-type"), body: await res.text() };
    };
    const root = await get("/");
    assertEquals(root.status, 200);
    assertStringIncludes(root.type ?? "", "text/html");
    assertEquals((await get("/solution.json")).status, 404);
    assertEquals((await get("/..%2Fsecret.txt")).status, 404);
    assertEquals((await get("/missing.html")).status, 404);
  } finally {
    console.log = log;
    await server.shutdown();
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("the CLI runs end to end with --stub and no env file", async () => {
  const dir = await Deno.makeTempDir({ prefix: "escapd-trial-cli-" });
  try {
    const paths: string[] = [];
    for (const [i, bytes] of [await jpeg(2000, 1500), await jpeg(1500, 2000, true), await png(900, 700)].entries()) {
      const path = `${dir}/in-${i}.${i === 2 ? "png" : "jpg"}`;
      await Deno.writeFile(path, bytes);
      paths.push(path);
    }
    const script = new URL("../try-room.ts", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
    const run = await new Deno.Command(Deno.execPath(), {
      args: ["run", "-A", `--env-file=${dir}/missing.env`, script, "--stub", "--out", `${dir}/out`, ...paths],
      stdout: "piped",
      stderr: "piped",
    }).output();
    const stdout = new TextDecoder().decode(run.stdout);
    const stderr = new TextDecoder().decode(run.stderr);
    assertEquals(run.code, 0, `${stdout}\n${stderr}`);
    assertStringIncludes(stdout, "Required steps");
    assertStringIncludes(stdout, "play.html");
    await Deno.stat(`${dir}/out/play.html`);

    // Without a key and without --stub, it refuses with the setup message (no network).
    const noKey = await new Deno.Command(Deno.execPath(), {
      args: ["run", "-A", `--env-file=${dir}/missing.env`, script, "--out", `${dir}/out2`, ...paths],
      env: { AI_PROVIDER_API_KEY: "" },
      stdout: "piped",
      stderr: "piped",
    }).output();
    assertEquals(noKey.code, 2);
    assertStringIncludes(new TextDecoder().decode(noKey.stderr), "supabase/functions/.env");
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

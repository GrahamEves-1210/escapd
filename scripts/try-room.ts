/// <reference lib="deno.ns" />
// Developer trial: run the real room generator on photos from your own
// computer and play the result in a browser, with nothing deployed.
//
//   deno run -A --env-file=supabase/functions/.env scripts/try-room.ts [options] photo1.jpg photo2.jpg ...
//
//   --out <dir>       where to write the trial (default F:\escapd-tools\trials\<timestamp> on Windows,
//                     ~/escapd-trials/<timestamp> elsewhere). Keep it outside the repo.
//   --stub            no model calls: a canned provider stands in for Gemini (no key needed)
//   --serve           after the run, serve play.html on your network so a phone can open it
//   --serve-dir <dir> serve an earlier trial without generating again
//   --port <n>        port for --serve / --serve-dir (default 8787)
//
// 3 to 6 JPEG or PNG photos, in the order you would take them in the app.
// Each is processed exactly like an upload from the app (orientation applied,
// long edge at most 1600 px, JPEG 0.8, metadata dropped) and then sent to
// Gemini by generatePuzzle(). Nothing is written to Supabase: the database
// preview check is skipped and the TypeScript preflight runs alone.
//
// Outputs: public.json, solution.json, usage.json, stages.log, photo-N.jpg,
// sheet.html (hotspot boxes over each photo) and play.html (playable offline).
import { configFromEnv, GenerationError, type GenerationInput, generatePuzzle, type PipelineConfig } from "../supabase/functions/_shared/ai.ts";
import type { CostLedger } from "../supabase/functions/_shared/cost.ts";
import { GeminiProvider, type JsonCall, type ModelProvider } from "../supabase/functions/_shared/provider.ts";
import {
  FakeProvider,
  perceptionHandler,
  proseHandler,
  verificationHandler,
} from "../supabase/functions/_shared/test_fixtures.ts";
import { renderSheet } from "./generation-contact-sheet.ts";
import { walkthrough } from "./trial/engine.js";
import { renderPlay } from "./trial/play-html.ts";
import { type ProcessedPhoto, processPhoto, UnsupportedPhotoError } from "./trial/process.ts";

export const MIN_PHOTOS = 3;   // private.app_config min_photos_per_room
export const MAX_PHOTOS = 6;   // private.app_config max_photos_per_room

const ENV_FILE = "supabase/functions/.env";

export interface TrialOptions {
  photos: string[];
  out: string;
  stub: boolean;
  serve: boolean;
  serveDir: string;
  port: number;
}

function usage(message?: string): never {
  if (message) console.error(`error: ${message}\n`);
  console.error(
    "usage: deno run -A --env-file=supabase/functions/.env scripts/try-room.ts [--out <dir>] [--stub] [--serve] [--port 8787] photo1.jpg ... (3 to 6 photos)\n" +
      "       deno run -A scripts/try-room.ts --serve-dir <earlier trial dir>",
  );
  Deno.exit(2);
}

export function defaultOutDir(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  if (Deno.build.os === "windows") return `F:\\escapd-tools\\trials\\${stamp}`;
  return `${Deno.env.get("HOME") ?? "."}/escapd-trials/${stamp}`;
}

export function parseArgs(args: string[]): TrialOptions {
  const opts: TrialOptions = { photos: [], out: "", stub: false, serve: false, serveDir: "", port: 8787 };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--out") opts.out = args[++i] ?? "";
    else if (arg === "--stub") opts.stub = true;
    else if (arg === "--serve") opts.serve = true;
    else if (arg === "--serve-dir") opts.serveDir = args[++i] ?? "";
    else if (arg === "--port") opts.port = Number(args[++i]);
    else if (arg === "--help" || arg === "-h") usage();
    else if (arg.startsWith("--")) usage(`unknown option ${arg}`);
    else opts.photos.push(arg);
  }
  if (!Number.isInteger(opts.port) || opts.port < 1 || opts.port > 65535) usage("--port needs a number between 1 and 65535");
  if (opts.serveDir) return opts;
  if (opts.photos.length < MIN_PHOTOS || opts.photos.length > MAX_PHOTOS) {
    usage(`give ${MIN_PHOTOS} to ${MAX_PHOTOS} photos (got ${opts.photos.length})`);
  }
  if (!opts.out) opts.out = defaultOutDir();
  return opts;
}

/** Canned stand-in for Gemini: the same fakes the pipeline tests use. */
export function stubProvider(): ModelProvider {
  return new FakeProvider({
    perception: perceptionHandler(),
    verification: verificationHandler(),
    prose: proseHandler(),
    repair: proseHandler(),
  });
}

/** Wraps a provider to count the objects perception reports for each photo. */
class CountingProvider implements ModelProvider {
  readonly objectsPerPhoto = new Map<number, number>();
  constructor(private readonly inner: ModelProvider) {}
  get name() {
    return this.inner.name;
  }
  async generateJson<T>(call: JsonCall<T>, ledger: CostLedger): Promise<T> {
    const out = await this.inner.generateJson(call, ledger);
    if (call.stage === "perception") {
      const text = call.parts.map((p) => ("text" in p ? p.text : "")).join(" ");
      const photo = Number(text.match(/Photo (\d+) of/)?.[1] ?? 0) - 1;
      const objects = (out as { objects?: unknown[] } | null)?.objects;
      if (photo >= 0) this.objectsPerPhoto.set(photo, Array.isArray(objects) ? objects.length : 0);
    }
    return out;
  }
}

const STUB_CONFIG: PipelineConfig = {
  apiKey: "stub",
  perceptionModel: "stub-perception",
  perceptionFallbackModel: "",
  proseModel: "stub-prose",
  proseFallbackModel: "",
  spendCapUsd: 0.90,
  deadlineMs: 100_000,
};

type Json = Record<string, unknown>;
type StageEvent = { event: string } & Record<string, unknown>;

function join(dir: string, name: string) {
  return `${dir.replace(/[\\/]+$/, "")}${Deno.build.os === "windows" ? "\\" : "/"}${name}`;
}

const money = (n: number | undefined) => `$${(n ?? 0).toFixed(4)}`;

export interface TrialResult {
  ok: boolean;
  outDir: string;
  files: string[];
  summary: string;
}

/** Runs one trial and writes its files. Never exits the process. */
export async function runTrial(opts: TrialOptions, processed: ProcessedPhoto[]): Promise<TrialResult> {
  const started = performance.now();
  await Deno.mkdir(opts.out, { recursive: true });
  const config = opts.stub ? STUB_CONFIG : configFromEnv();
  const provider = new CountingProvider(opts.stub ? stubProvider() : new GeminiProvider({ apiKey: config.apiKey }));

  const photos = processed.map((p, position) => ({ ...p, photoId: crypto.randomUUID() as string, position }));
  const byId = new Map<string, Uint8Array>(photos.map((p) => [p.photoId, p.bytes]));
  const input: GenerationInput = {
    jobId: crypto.randomUUID(),
    roomId: crypto.randomUUID(),
    attempt: 1,
    promptVersion: "trial",
    outputSchemaVersion: 1,
    photos: photos.map((p) => ({ photoId: p.photoId, position: p.position, mimeType: "image/jpeg", signedUrl: `local://photo-${p.position}` })),
  };

  const events: StageEvent[] = [];
  const files: string[] = [];
  const write = async (name: string, data: string | Uint8Array) => {
    const path = join(opts.out, name);
    if (typeof data === "string") await Deno.writeTextFile(path, data);
    else await Deno.writeFile(path, data);
    files.push(path);
  };
  for (const p of photos) await write(`photo-${p.position + 1}.jpg`, p.bytes);

  const lines: string[] = [];
  try {
    const out = await generatePuzzle(input, {
      config,
      provider,
      fetchPhoto: (photo) => Promise.resolve(byId.get(photo.photoId)!),
      preview: () => Promise.resolve(null),
      log: (event, fields) => events.push({ event, ...fields }),
    });
    const durationMs = Math.round(performance.now() - started);
    const pub = out.publicDefinition as Json;
    const sol = out.solution as Json;
    const template = String(events.find((e) => e.stage === "template")?.template ?? "unknown");

    await write("public.json", JSON.stringify(pub, null, 2));
    await write("solution.json", JSON.stringify(sol, null, 2));
    await write("usage.json", JSON.stringify(out.usage, null, 2));
    await write("stages.log", events.map((e) => JSON.stringify(e)).join("\n") + "\n");
    await write("sheet.html", renderSheet(pub as Parameters<typeof renderSheet>[0], photos.map((p) => ({ name: p.name, bytes: p.bytes }))));
    await write("play.html", await renderPlay(pub, sol, photos, {
      template,
      generatedAt: new Date().toISOString(),
      stub: opts.stub,
      model: out.usage.model,
      costUsd: out.usage.cost_usd,
      durationMs,
    }));

    const hotspots = (pub.hotspots ?? []) as Array<{ id: string; photo_index: number; name?: string; hidden?: boolean }>;
    const puzzles = (pub.puzzles ?? []) as Array<{ id: string; kind: string; hotspot_id?: string; title?: string }>;
    const items = (pub.items ?? []) as Array<{ id: string; name?: string }>;
    const name = (id?: string) => hotspots.find((h) => h.id === id)?.name ?? id ?? "?";
    const itemName = (id?: string) => items.find((i) => i.id === id)?.name ?? id ?? "?";
    const run = walkthrough(pub, sol) as {
      steps: Array<{ puzzle_id: string; kind: string; action: Record<string, unknown> }>;
      completed: boolean;
      optional: string[];
    };

    lines.push(`${String(pub.title ?? "Untitled")}  (template ${template}${opts.stub ? ", STUB run: no model calls" : ""})`);
    lines.push("", "Photos:");
    photos.forEach((p, i) => {
      const here = hotspots.filter((h) => h.photo_index === i);
      const hidden = here.filter((h) => h.hidden).length;
      lines.push(`  ${i + 1}. ${p.name}  ${p.sourceWidth}x${p.sourceHeight} -> ${p.width}x${p.height}  ` +
        `objects seen ${provider.objectsPerPhoto.get(i) ?? 0}, hotspots ${here.length}${hidden ? ` (${hidden} hidden)` : ""}`);
    });
    lines.push("", run.completed ? `Required steps (${run.steps.length}):` : "Required steps: ROOM CANNOT BE COMPLETED (walkthrough got stuck after):");
    run.steps.forEach((s, i) => {
      const a = s.action;
      const text = a.type === "inspect" ? `search ${name(a.hotspot_id as string)}`
        : a.type === "solve" ? `enter the code at ${name(puzzles.find((p) => p.id === a.puzzle_id)?.hotspot_id)}`
        : a.type === "use_item" ? `use ${itemName(a.item_id as string)} on ${name(a.hotspot_id as string)}`
        : `combine ${(a.item_ids as string[]).map(itemName).join(" + ")}`;
      lines.push(`  ${String(i + 1).padStart(2)}. [${s.kind}] ${text}`);
    });
    if (run.optional.length) {
      lines.push(`  red herrings: ${run.optional.map((id) => puzzles.find((p) => p.id === id)?.title ?? id).join(", ")}`);
    }
    lines.push("", `Cost ${money(out.usage.cost_usd)}  ·  ${out.usage.input_tokens ?? 0} in / ${out.usage.output_tokens ?? 0} out tokens  ·  ` +
      `${out.usage.image_count ?? 0} images  ·  generation ${(durationMs / 1000).toFixed(1)} s`);
    lines.push(`Models: ${out.usage.model ?? "?"}`);
    return { ok: true, outDir: opts.out, files, summary: lines.join("\n") };
  } catch (err) {
    const durationMs = Math.round(performance.now() - started);
    await write("stages.log", events.map((e) => JSON.stringify(e)).join("\n") + "\n");
    if (err instanceof GenerationError) {
      await write("usage.json", JSON.stringify(err.usage ?? {}, null, 2));
      lines.push("GENERATION FAILED");
      lines.push(`  code:      ${err.code}`);
      lines.push(`  retryable: ${err.retryable}`);
      lines.push(`  message:   ${err.message}`);
      lines.push(`  cost so far ${money(err.usage?.cost_usd)}  ·  ${(durationMs / 1000).toFixed(1)} s`);
      return { ok: false, outDir: opts.out, files, summary: lines.join("\n") };
    }
    throw err;
  }
}

/** Serves play.html (and the other trial files) on all interfaces until Ctrl+C. */
export function serve(dir: string, port: number): Deno.HttpServer {
  const types: Record<string, string> = { html: "text/html; charset=utf-8", json: "application/json", jpg: "image/jpeg", log: "text/plain; charset=utf-8" };
  const server = Deno.serve({ hostname: "0.0.0.0", port, onListen: () => {} }, async (req) => {
    const name = decodeURIComponent(new URL(req.url).pathname.slice(1)) || "play.html";
    // Only flat file names from the trial folder: no paths, no solution.json over the network.
    if (!/^[\w.-]+$/.test(name) || name === "solution.json") return new Response("not found", { status: 404 });
    try {
      const body = await Deno.readFile(join(dir, name));
      return new Response(body, { headers: { "content-type": types[name.split(".").pop() ?? ""] ?? "application/octet-stream", "cache-control": "no-store" } });
    } catch {
      return new Response("not found", { status: 404 });
    }
  });
  const addresses = Deno.networkInterfaces().filter((n) => n.family === "IPv4" && !n.address.startsWith("127.")).map((n) => n.address);
  console.log(`\nServing ${dir}`);
  console.log(`  this computer:  http://localhost:${port}/`);
  for (const a of [...new Set(addresses)]) console.log(`  your phone:     http://${a}:${port}/   (same Wi-Fi)`);
  console.log("  contact sheet:  add sheet.html to the address.  Ctrl+C to stop.");
  console.log("  If the phone can't connect, allow Deno through Windows Firewall for private networks.");
  return server;
}

async function readPhotos(paths: string[]): Promise<ProcessedPhoto[]> {
  const processed: ProcessedPhoto[] = [];
  for (const path of paths) {
    let bytes: Uint8Array;
    try {
      bytes = await Deno.readFile(path);
    } catch {
      throw new UnsupportedPhotoError(`${path} could not be read.`);
    }
    processed.push(await processPhoto(path.split(/[\\/]/).pop() ?? path, bytes));
  }
  return processed;
}

if (import.meta.main) {
  const opts = parseArgs(Deno.args);
  if (opts.serveDir) {
    serve(opts.serveDir, opts.port);
  } else {
    if (!opts.stub && !(Deno.env.get("AI_PROVIDER_API_KEY") ?? "").trim()) {
      console.error(
        `error: no Gemini API key.\n  Put AI_PROVIDER_API_KEY=<your key> in ${ENV_FILE} (it is gitignored) and keep --env-file=${ENV_FILE} in the command.\n` +
          "  Get a key at https://aistudio.google.com/apikey. Or add --stub to try the script without one.",
      );
      Deno.exit(2);
    }
    let processed: ProcessedPhoto[];
    const processing = performance.now();
    try {
      processed = await readPhotos(opts.photos);
      console.log(`Processed ${processed.length} photos like the app does (${((performance.now() - processing) / 1000).toFixed(1)} s).`);
    } catch (err) {
      if (err instanceof UnsupportedPhotoError) {
        console.error(`error: ${err.message}`);
        Deno.exit(2);
      }
      throw err;
    }
    console.log(`Generating from ${processed.length} photos${opts.stub ? " (stub provider, no model calls)" : " with Gemini"}… this takes up to about 100 s.`);
    const result = await runTrial(opts, processed);
    console.log("");
    console.log(result.summary);
    console.log("\nFiles:");
    for (const f of result.files) console.log(`  ${f}`);
    if (result.ok && opts.serve) serve(opts.out, opts.port);
    else if (!result.ok) Deno.exit(1);
  }
}

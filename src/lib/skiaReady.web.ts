// Skia on the web runs on CanvasKit (WebAssembly), which has to be loaded
// before any Skia module is evaluated. The root layout waits for it next to
// its font gate; the wasm is served from public/canvaskit.wasm (copied there
// from canvaskit-wasm on install: package.json's postinstall). If it can't
// load, the app still renders and mode photos show untreated.
import { useEffect, useState } from "react";
import { LoadSkiaWeb } from "@shopify/react-native-skia/lib/module/web";

type State = "loading" | "ready" | "failed";

const hasCanvasKit = () => (globalThis as { CanvasKit?: unknown }).CanvasKit !== undefined;

let state: State = hasCanvasKit() ? "ready" : "loading";
let loading: Promise<void> | null = null;

function loadSkia(): Promise<void> {
  // The app is served from the site root (app.json sets no baseUrl), and so is public/.
  loading ??= LoadSkiaWeb({ locateFile: (file: string) => `/${file}` }).then(
    () => {
      state = "ready";
    },
    (error: unknown) => {
      state = "failed";
      console.warn(`Skia didn't load; photos show untreated. ${error instanceof Error ? error.message : String(error)}`);
    },
  );
  return loading;
}

/** True once CanvasKit has loaded or failed to: the app may render. */
export function useSkiaReady(): boolean {
  const [settled, setSettled] = useState(state !== "loading");
  useEffect(() => {
    if (settled) return;
    let live = true;
    loadSkia().then(() => {
      if (live) setSettled(true);
    });
    return () => {
      live = false;
    };
  }, [settled]);
  return settled;
}

/** True when CanvasKit loaded, so Skia can draw. */
export function skiaAvailable(): boolean {
  return state === "ready";
}

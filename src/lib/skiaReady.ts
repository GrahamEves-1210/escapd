// Skia on iOS and Android ships in the binary (Expo Go included): there is
// nothing to load, so the root layout never waits for it. The web version
// (skiaReady.web.ts) loads CanvasKit first.

/** True once the app may render screens that use Skia. Always true on native. */
export function useSkiaReady(): boolean {
  return true;
}

/** True when Skia can draw. Always true on native. */
export function skiaAvailable(): boolean {
  return true;
}

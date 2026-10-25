// Renders play.html: a self-contained, offline, playable preview of a
// generated room for developers. The engine (engine.js) and the UI
// (play-client.js) are inlined; photos are data URIs.
//
// The room data (public definition, secret solution, run details) is one
// XOR-obfuscated base64 blob, so a glance at the file does not spoil the
// answers. It is not security: anyone holding the file can decode it.

const KEY = "escapd-trial-preview";   // must match play-client.js

export interface PreviewPhoto {
  bytes: Uint8Array;
  width: number;
  height: number;
  mime?: string;
}

export interface PreviewMeta {
  template?: string;
  generatedAt?: string;
  stub?: boolean;
  model?: string;
  costUsd?: number;
  durationMs?: number;
}

function base64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

export function obfuscate(value: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  for (let i = 0; i < bytes.length; i++) bytes[i] ^= KEY.charCodeAt(i % KEY.length);
  return base64(bytes);
}

export function reveal(blob: string): unknown {
  const bin = atob(blob);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i) ^ KEY.charCodeAt(i % KEY.length);
  return JSON.parse(new TextDecoder().decode(bytes));
}

/** engine.js as a classic script: its exports become globals for the UI script. */
export async function engineScript(): Promise<string> {
  const source = await Deno.readTextFile(new URL("./engine.js", import.meta.url));
  return source.replace(/^export /gm, "");
}

/** Keeps inline script text from closing its <script> element early. */
const scriptSafe = (s: string) => s.replace(/<\/(script)/gi, "<\\/$1").replace(/<!--/g, "<\\!--");

export async function renderPlay(
  publicDefinition: Record<string, unknown>,
  solution: Record<string, unknown>,
  photos: PreviewPhoto[],
  meta: PreviewMeta = {},
): Promise<string> {
  const engine = await engineScript();
  const client = await Deno.readTextFile(new URL("./play-client.js", import.meta.url));
  const blob = obfuscate({ public: publicDefinition, secret: solution, meta });
  const photoJson = JSON.stringify(photos.map((p) => ({
    src: `data:${p.mime ?? "image/jpeg"};base64,${base64(p.bytes)}`,
    width: p.width,
    height: p.height,
  })));

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex">
<title>Room preview</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=Plus+Jakarta+Sans:wght@400;500;600&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
<style>
  :root {
    color-scheme: dark;
    --canvas: #090807; --surface: #14110E; --raised: #1E1915; --text: #F2ECE1; --muted: #A89C8A;
    --hair: rgba(200, 157, 84, 0.32); --brass: #C89D54; --brass-hi: #DFB66C; --manila: #E8DFC8; --ink: #171411;
    --error: #A63429; --verdigris: #4E7A72;
    --display: "Playfair Display", Georgia, "Times New Roman", serif;
    --body: "Plus Jakarta Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    --mono: "JetBrains Mono", ui-monospace, "SF Mono", Consolas, monospace;
    --plate-h: 58vh;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: var(--canvas); color: var(--text); font: 16px/1.45 var(--body); -webkit-text-size-adjust: 100%; }
  body { min-height: 100vh; padding: env(safe-area-inset-top) 0 env(safe-area-inset-bottom); }
  button { font: 600 15px/1.2 var(--body); color: inherit; cursor: pointer; }
  .wrap { max-width: 760px; margin: 0 auto; padding: 0 16px 24px; }
  header { display: flex; align-items: center; gap: 8px; padding: 12px 0; }
  header h1 { flex: 1; margin: 0; font: 600 20px/1.2 var(--display); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .stamp { font: 500 11px/1.3 var(--mono); letter-spacing: 1.2px; color: var(--muted); margin: 0; text-transform: uppercase; }
  .accent { color: var(--brass); }
  .chip { min-height: 40px; padding: 0 14px; border-radius: 8px; border: 1px solid var(--hair); background: var(--surface); }
  #hints-used { font: 500 12px var(--mono); color: var(--muted); }
  .stage { background: #050404; border-radius: 24px; padding: 14px; }
  #plate { position: relative; margin: 0 auto; border-radius: 16px; overflow: hidden; touch-action: manipulation; user-select: none; -webkit-user-select: none; }
  #plate img { display: block; width: 100%; height: 100%; object-fit: cover; }
  .hotspot { position: absolute; background: transparent; border: 0; padding: 0; border-radius: 6px; -webkit-tap-highlight-color: transparent; }
  .hotspot.outlined { box-shadow: inset 0 0 0 1.5px rgba(223, 182, 108, 0.55), 0 0 0 1px rgba(9, 8, 7, 0.45); }
  .hotspot.outlined.spent { box-shadow: inset 0 0 0 1px rgba(168, 156, 138, 0.35); }
  .hotspot.target { box-shadow: inset 0 0 0 2px var(--brass-hi), 0 0 0 1px rgba(9, 8, 7, 0.6); }
  .hotspot:active { background: rgba(200, 157, 84, 0.18); }
  .hotspot .tag { position: absolute; left: 0; top: 0; transform: translateY(-100%); max-width: 220px; padding: 2px 6px; border-radius: 4px;
    background: rgba(9, 8, 7, 0.85); color: var(--brass-hi); font: 500 11px/1.3 var(--mono); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  #tabs { display: flex; gap: 8px; margin: 12px 0 0; overflow-x: auto; padding-bottom: 2px; }
  .tab { position: relative; flex: 0 0 auto; width: 64px; height: 48px; padding: 0; border-radius: 10px; overflow: hidden; border: 1px solid var(--hair); background: var(--surface); opacity: 0.6; }
  .tab.active { opacity: 1; outline: 2px solid var(--brass); outline-offset: 1px; }
  .tab img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .tab .num { position: absolute; left: 4px; bottom: 2px; font: 600 11px var(--mono); color: var(--text); text-shadow: 0 1px 2px #000; }
  .tab .dot { position: absolute; right: 4px; top: 4px; width: 9px; height: 9px; border-radius: 50%; background: var(--brass-hi); box-shadow: 0 0 0 2px var(--canvas); }
  #mode { margin-top: 12px; }
  .banner { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 12px; border-radius: 10px; background: rgba(200, 157, 84, 0.12); border: 1px solid var(--hair); }
  .banner span { color: var(--muted); }
  .row { display: flex; gap: 8px; justify-content: flex-end; margin-top: 12px; }
  .banner .row { margin-top: 0; }
  #tray { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
  .item { min-height: 44px; padding: 0 14px; border-radius: 8px; border: 1px solid var(--hair); background: var(--raised); }
  .item.selected { background: var(--brass); color: var(--ink); border-color: var(--brass); }
  .empty { color: var(--muted); margin: 6px 0; font-size: 14px; }
  .slip { background: var(--manila); color: var(--ink); font: 15px/1.5 var(--mono); padding: 10px 12px; border-radius: 8px; margin: 8px 0 0; white-space: pre-wrap; }
  .primary { min-height: 46px; padding: 0 18px; border-radius: 8px; border: 0; background: var(--brass); color: var(--ink); }
  .primary:active { background: var(--brass-hi); }
  .ghost { min-height: 46px; padding: 0 16px; border-radius: 8px; border: 1px solid var(--hair); background: transparent; }
  .wide { width: 100%; margin-top: 16px; }
  details { margin-top: 18px; color: var(--muted); }
  summary { cursor: pointer; font: 500 12px var(--mono); letter-spacing: 1px; }
  #log { margin: 8px 0 0; padding-left: 18px; font: 12px/1.6 var(--mono); }
  .overlay { position: fixed; inset: 0; display: none; z-index: 50; }
  .overlay.open { display: flex; }
  #sheet { align-items: flex-end; justify-content: center; background: rgba(9, 8, 7, 0.6); }
  .card { width: 100%; max-width: 560px; max-height: 88vh; overflow-y: auto; background: var(--surface); border: 1px solid var(--hair); border-bottom: 0;
    border-radius: 20px 20px 0 0; padding: 20px 18px calc(18px + env(safe-area-inset-bottom)); }
  .card h2 { font: 600 24px/1.25 var(--display); margin: 6px 0 8px; }
  .narrative { font: 18px/1.45 var(--display); margin: 8px 0; }
  .narrative.strong { color: var(--brass-hi); }
  .quiet { color: var(--muted); font-style: italic; }
  .note { color: var(--muted); font-size: 14px; }
  .found { margin-top: 12px; padding: 12px; border-radius: 10px; background: var(--raised); border: 1px solid var(--hair); }
  .found strong { display: block; margin-top: 4px; }
  .padwrap { margin: 12px 0 4px; }
  .code { width: 100%; height: 64px; text-align: center; font: 600 30px var(--mono); letter-spacing: 10px; border-radius: 10px; border: 1px solid var(--hair);
    background: var(--canvas); color: var(--text); }
  .code:focus { outline: 2px solid var(--brass); }
  .status { min-height: 1.4em; color: var(--brass-hi); margin: 6px 0 0; }
  .shake { animation: shake 220ms; }
  @keyframes shake { 25% { transform: translateX(4px); } 50% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
  @media (prefers-reduced-motion: reduce) { .shake { animation: none; } }
  .rung { padding: 10px 0; border-top: 1px solid rgba(200, 157, 84, 0.18); }
  .rung p { margin: 4px 0 0; }
  .steps { padding-left: 22px; } .steps li { margin: 10px 0; } .steps p { margin: 2px 0 0; color: var(--muted); font-size: 14px; }
  .menu { display: grid; gap: 8px; margin-top: 12px; }
  .info { display: grid; grid-template-columns: max-content 1fr; gap: 6px 14px; margin: 12px 0; }
  .info dt { color: var(--muted); } .info dd { margin: 0; overflow-wrap: anywhere; }
  #intro, #exit { align-items: center; justify-content: center; background: var(--canvas); padding: 24px; text-align: center; }
  .introcard, .exitcard { max-width: 520px; }
  .introcard h1, .exitcard h1 { font: 600 34px/1.15 var(--display); margin: 14px 0; }
  #toast { position: fixed; left: 50%; bottom: calc(24px + env(safe-area-inset-bottom)); transform: translate(-50%, 20px); opacity: 0; pointer-events: none;
    background: var(--raised); border: 1px solid var(--hair); padding: 10px 16px; border-radius: 10px; transition: opacity 160ms, transform 160ms; z-index: 60; max-width: calc(100% - 32px); }
  #toast.show { opacity: 1; transform: translate(-50%, 0); }
  @media (max-width: 480px) { :root { --plate-h: 52vh; } .stage { padding: 8px; border-radius: 18px; } }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1 id="title"></h1>
    <span id="hints-used"></span>
    <button class="chip" id="hint">Hint</button>
    <button class="chip" id="menu" aria-label="Options">•••</button>
  </header>
  <div class="stage"><div id="plate"></div></div>
  <div id="tabs" role="tablist"></div>
  <div id="mode"></div>
  <div id="tray"></div>
  <details><summary>MOVE LOG</summary><ol id="log"></ol></details>
</div>
<div class="overlay" id="sheet"></div>
<div class="overlay open" id="intro"><div class="introcard">
  <p class="stamp accent" id="intro-meta"></p>
  <h1 id="intro-title"></h1>
  <p class="narrative" id="intro-text"></p>
  <button class="primary wide" id="begin">Begin</button>
</div></div>
<div class="overlay" id="exit"></div>
<div id="toast" role="status" aria-live="polite"></div>
<script type="application/octet-stream" id="trial-data">${blob}</script>
<script type="application/json" id="trial-photos">${scriptSafe(photoJson)}</script>
<script>
${scriptSafe(engine)}
</script>
<script>
${scriptSafe(client)}
</script>
</body>
</html>
`;
}

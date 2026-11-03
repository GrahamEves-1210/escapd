#!/usr/bin/env node
// Builds the camera shutter, the typewriter and the three room tones in
// assets/audio/ from nothing: seeded noise, filters, envelopes and a small
// reverb, synthesized here and encoded with ffmpeg. The interaction foley
// (press, knock, paper, pickup, unlock, drawer, purr and the rest) is built
// by scripts/audio/foley.py. No samples are downloaded, so every file is
// self-generated (docs/AUDIO.md).
//
//   node scripts/audio/generate.mjs              # all of these
//   node scripts/audio/generate.mjs room-noir    # just the named ones
//   WAV_DIR=/tmp/wavs node scripts/audio/generate.mjs  # also keep the 16-bit WAVs there (for inspection)
//
// Needs Node 18+ and ffmpeg (with its native aac encoder) on PATH. The output
// is deterministic for a given seed, so a rebuild only changes what you edit.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = join(ROOT, "assets/audio");
const SR = 44100;
const TAU = Math.PI * 2;

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/** mulberry32: a small seeded PRNG, so every build is identical. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const samples = (sec) => Math.max(1, Math.round(sec * SR));
const buf = (sec) => new Float64Array(samples(sec));
const between = (r, lo, hi) => lo + (hi - lo) * r();

function white(r, n) {
  const x = new Float64Array(n);
  for (let i = 0; i < n; i++) x[i] = r() * 2 - 1;
  return x;
}

/** Pink noise (Paul Kellet's refined filter), roughly unit peak. */
function pink(r, n) {
  const x = new Float64Array(n);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < n; i++) {
    const w = r() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856;
    b4 = 0.55 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.016898;
    x[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    b6 = w * 0.115926;
  }
  return x;
}

/** Brown (red) noise: leaky integrated white noise. */
function brown(r, n) {
  const x = new Float64Array(n);
  let last = 0;
  for (let i = 0; i < n; i++) {
    last = (last + 0.02 * (r() * 2 - 1)) * 0.998;
    x[i] = last * 3.5;
  }
  return x;
}

/** RBJ cookbook biquad. type: lp | hp | bp (0 dB peak) | peak. Returns a new array. */
function biquad(x, type, f0, q = 0.707, gainDb = 0) {
  const w0 = (TAU * Math.min(f0, SR * 0.49)) / SR;
  const cos = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * q);
  const A = Math.pow(10, gainDb / 40);
  let b0, b1, b2, a0, a1, a2;
  if (type === "lp") {
    b0 = (1 - cos) / 2; b1 = 1 - cos; b2 = (1 - cos) / 2; a0 = 1 + alpha; a1 = -2 * cos; a2 = 1 - alpha;
  } else if (type === "hp") {
    b0 = (1 + cos) / 2; b1 = -(1 + cos); b2 = (1 + cos) / 2; a0 = 1 + alpha; a1 = -2 * cos; a2 = 1 - alpha;
  } else if (type === "bp") {
    b0 = alpha; b1 = 0; b2 = -alpha; a0 = 1 + alpha; a1 = -2 * cos; a2 = 1 - alpha;
  } else if (type === "peak") {
    b0 = 1 + alpha * A; b1 = -2 * cos; b2 = 1 - alpha * A; a0 = 1 + alpha / A; a1 = -2 * cos; a2 = 1 - alpha / A;
  } else throw new Error(`unknown filter ${type}`);
  const y = new Float64Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = (b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}

/** Zero-delay state-variable band-pass whose centre can move per sample (freq: number or i => Hz). */
function sweepBandpass(x, freq, q) {
  const k = 1 / q;
  const y = new Float64Array(x.length);
  let ic1 = 0, ic2 = 0;
  for (let i = 0; i < x.length; i++) {
    const f = typeof freq === "function" ? freq(i) : freq;
    const g = Math.tan((Math.PI * Math.min(f, SR * 0.45)) / SR);
    const a1 = 1 / (1 + g * (g + k)), a2 = g * a1, a3 = g * a2;
    const v3 = x[i] - ic2;
    const v1 = a1 * ic1 + a2 * v3;
    const v2 = ic2 + a2 * ic1 + a3 * v3;
    ic1 = 2 * v1 - ic1; ic2 = 2 * v2 - ic2;
    y[i] = v1 * k; // unity gain at the centre
  }
  return y;
}

/** Multiply in place by f(t seconds). */
function shape(x, f) {
  for (let i = 0; i < x.length; i++) x[i] *= f(i / SR);
  return x;
}
const decay = (tau) => (t) => Math.exp(-t / tau);
/** A fast linear attack into an exponential decay: no click at the onset. */
const hit = (tau, attack = 0.0004) => (t) => (t < attack ? t / attack : Math.exp(-(t - attack) / tau));

/** Sine whose frequency may glide (freq: Hz or t => Hz). */
function sine(sec, freq, phase = 0) {
  const x = buf(sec);
  let p = phase;
  for (let i = 0; i < x.length; i++) {
    x[i] = Math.sin(p);
    p += (TAU * (typeof freq === "function" ? freq(i / SR) : freq)) / SR;
  }
  return x;
}

/** Mix src into dst starting at `at` seconds. */
function mix(dst, src, at = 0, gain = 1) {
  const o = Math.round(at * SR);
  for (let i = 0; i < src.length && o + i < dst.length; i++) if (o + i >= 0) dst[o + i] += src[i] * gain;
  return dst;
}

/** A noise burst: white noise through a filter chain, shaped by an envelope. */
function burst(r, sec, env, filters = []) {
  let x = white(r, samples(sec));
  for (const [type, f, q] of filters) x = biquad(x, type, f, q);
  return shape(x, env);
}

/** Struck metal: inharmonic sine partials [Hz, gain, tau] with random phases. */
function partials(r, sec, list) {
  // Long enough for every partial to die away (8 time constants), so none is cut off.
  sec = Math.max(sec, ...list.map(([, , tau]) => tau * 8));
  const x = buf(sec);
  for (const [f, g, tau] of list) mix(x, shape(sine(sec, f, r() * TAU), hit(tau, 0.0002)), 0, g);
  return x;
}

/** Freeverb (mono): 8 damped combs into 4 allpasses. Returns dry + wet. */
function reverb(x, { room = 0.5, damp = 0.5, wet = 0.15 } = {}) {
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
  const alls = [556, 441, 341, 225];
  const fb = room * 0.28 + 0.7;
  const out = new Float64Array(x.length);
  for (const len of combs) {
    const line = new Float64Array(len);
    let idx = 0, store = 0;
    for (let i = 0; i < x.length; i++) {
      const y = line[idx];
      store = y * (1 - damp) + store * damp;
      line[idx] = x[i] * 0.015 + store * fb;
      out[i] += y;
      idx = (idx + 1) % len;
    }
  }
  for (const len of alls) {
    const line = new Float64Array(len);
    let idx = 0;
    for (let i = 0; i < x.length; i++) {
      const b = line[idx];
      const y = -out[i] + b;
      line[idx] = out[i] + b * 0.5;
      out[i] = y;
      idx = (idx + 1) % len;
    }
  }
  const y = new Float64Array(x.length);
  for (let i = 0; i < x.length; i++) y[i] = x[i] + out[i] * wet * 3;
  return y;
}

function fadeEdges(x, inSec = 0.001, outSec = 0.01) {
  const ni = samples(inSec), no = samples(outSec);
  for (let i = 0; i < ni && i < x.length; i++) x[i] *= i / ni;
  for (let i = 0; i < no && i < x.length; i++) x[x.length - 1 - i] *= i / no;
  return x;
}

function normalize(x, peakDb = -1) {
  let peak = 0;
  for (const v of x) peak = Math.max(peak, Math.abs(v));
  const g = peak > 0 ? Math.pow(10, peakDb / 20) / peak : 1;
  for (let i = 0; i < x.length; i++) x[i] *= g;
  return x;
}

/** Remove DC and sub-audible rumble a phone speaker can't play anyway. */
const clean = (x, hz = 35) => biquad(biquad(x, "hp", hz, 0.707), "hp", hz, 0.707);

/**
 * A seamless loop from `x` (loop + crossfade long): the tail past the loop is
 * crossfaded (equal power) over the head, so the last sample runs straight
 * into the first. Use for noise; periodic layers are built to loop exactly.
 */
function loopify(x, loopSec, fadeSec) {
  const n = samples(loopSec), f = samples(fadeSec);
  const y = Float64Array.from(x.subarray(0, n));
  for (let i = 0; i < f; i++) {
    const th = (i / f) * (Math.PI / 2);
    y[i] = x[n + i] * Math.cos(th) + x[i] * Math.sin(th);
  }
  return y;
}

/** Filter a loop as if it repeated forever: run it twice and keep the second pass, so the seam stays seamless. */
function circular(x, fn) {
  const twice = new Float64Array(x.length * 2);
  twice.set(x, 0);
  twice.set(x, x.length);
  return Float64Array.from(fn(twice).subarray(x.length));
}

/** Slow random modulation in [0, 1]: low-passed noise, normalized. */
function drift(r, n, hz) {
  let x = white(r, n);
  x = biquad(biquad(x, "lp", hz, 0.7), "lp", hz, 0.7);
  let lo = Infinity, hi = -Infinity;
  for (const v of x) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  for (let i = 0; i < n; i++) x[i] = (x[i] - lo) / (hi - lo || 1);
  return x;
}

// ---------------------------------------------------------------------------
// The sounds
// ---------------------------------------------------------------------------

/** A mechanical camera shutter: the first curtain, the gear, the mirror slapping back. */
function shutter() {
  const r = rng(31);
  const sec = 0.32;
  const x = buf(sec);
  const click = (at, gain, ring, body) => {
    mix(x, burst(r, 0.05, hit(0.0006), [["hp", 2600, 0.7]]), at, gain * 0.9);
    mix(x, partials(r, 0.08, ring), at, gain * 0.35);
    mix(x, burst(r, 0.05, hit(0.006), [["bp", 1100, 1]]), at, gain * 0.6);
    mix(x, burst(r, 0.08, hit(0.009), [["lp", 420, 0.7]]), at, gain * body);
  };
  click(0, 1, [[2870, 0.5, 0.012], [4310, 0.4, 0.009], [6150, 0.3, 0.006], [7930, 0.2, 0.004]], 0.8);
  // The gear and curtain travelling: a short buzzy whirr.
  const whirr = burst(r, 0.06, (t) => Math.sin((Math.PI * t) / 0.06) * (0.55 + 0.45 * Math.sign(Math.sin(TAU * 190 * t))), [["bp", 1500, 1.6]]);
  mix(x, whirr, 0.012, 0.3);
  click(0.072, 1.1, [[2410, 0.5, 0.016], [3650, 0.4, 0.011], [5520, 0.25, 0.007]], 1.2);
  return fadeEdges(normalize(reverb(clean(x, 90), { room: 0.25, wet: 0.07 }), -1), 0.0005, 0.05);
}

/** A run of typewriter keys: key top, typebar on the platen, escapement tick. */
function typewriter() {
  const r = rng(41);
  const sec = 0.78;
  const x = buf(sec);
  let t = 0.004;
  for (let k = 0; k < 6; k++) {
    const g = between(r, 0.7, 1);
    mix(x, burst(r, 0.02, hit(0.0008), [["bp", between(r, 3000, 4000), 1.5]]), t, 0.45 * g);
    const strike = t + between(r, 0.008, 0.013);
    mix(x, burst(r, 0.06, hit(0.003), [["lp", 4200, 0.7]]), strike, 0.9 * g);
    mix(x, burst(r, 0.13, hit(0.016), [["bp", between(r, 1050, 1350), 2.2]]), strike, 0.55 * g);
    mix(x, shape(sine(0.18, between(r, 135, 155)), hit(0.022)), strike, 0.45 * g);
    mix(x, partials(r, 0.08, [[between(r, 2100, 3100), 0.09, 0.03]]), strike, g);
    mix(x, burst(r, 0.02, hit(0.0006), [["hp", 4200, 0.7]]), strike + 0.026, 0.16 * g);
    t += between(r, 0.072, 0.125);
  }
  return fadeEdges(normalize(reverb(clean(x, 80), { room: 0.4, wet: 0.09 }), -1), 0.001, 0.08);
}

// Room tones: 16 s seamless loops. Periodic layers use whole cycles in 16 s
// (frequencies on a 1/16 Hz grid); noise layers are crossfaded end to head.
const LOOP = 16;
const XFADE = 2;

/** Noir: rain on the office window, a radiator-and-traffic rumble, a faint mains hum. */
function roomNoir() {
  const r = rng(101);
  const n = samples(LOOP + XFADE);
  const noise = new Float64Array(n);
  const sheet = drift(r, n, 0.4);
  let rain = biquad(biquad(pink(r, n), "hp", 900, 0.7), "lp", 7000, 0.7);
  for (let i = 0; i < n; i++) rain[i] *= 0.82 + 0.18 * sheet[i];
  mix(noise, rain, 0, 0.42);
  // Drops on the glass: many small ticks, a few fatter drips.
  for (let t = 0; t < LOOP + XFADE - 0.02; t += -Math.log(1 - r()) / 30) {
    mix(noise, burst(r, 0.015, hit(between(r, 0.0004, 0.0014)), [["bp", between(r, 2200, 6000), 2]]), t, between(r, 0.02, 0.11));
  }
  for (let t = 0; t < LOOP + XFADE - 0.05; t += -Math.log(1 - r()) / 2.2) {
    mix(noise, burst(r, 0.04, hit(0.004), [["bp", between(r, 800, 1500), 3]]), t, between(r, 0.05, 0.12));
  }
  mix(noise, biquad(brown(r, n), "lp", 130, 0.7), 0, 0.5);
  const x = loopify(noise, LOOP, XFADE);
  // Mains hum, on the 1/16 Hz grid so it loops exactly.
  for (const [f, g] of [[60, 0.03], [120, 0.05], [180, 0.018], [240, 0.012]]) mix(x, sine(LOOP, f), 0, g);
  return normalize(circular(x, (y) => clean(y, 40)), -3);
}

/** Crime scene: a low, tense transformer hum that beats slowly, under a dark rumble. */
function roomCrime() {
  const r = rng(111);
  const n = samples(LOOP + XFADE);
  const noise = new Float64Array(n);
  mix(noise, biquad(brown(r, n), "lp", 200, 0.7), 0, 0.55);
  const tension = biquad(white(r, n), "bp", 3200, 8);
  shape(tension, (t) => 0.5 + 0.5 * Math.sin((TAU * t) / LOOP));
  mix(noise, tension, 0, 0.06);
  const x = loopify(noise, LOOP, XFADE);
  // 55 Hz and 55.25 Hz beat every 4 s; the whole drone swells every 8 s.
  const drone = buf(LOOP);
  for (const [f, g] of [[55, 0.32], [55.25, 0.32], [110, 0.18], [110.5, 0.12], [165, 0.07], [220.25, 0.03]]) mix(drone, sine(LOOP, f), 0, g);
  shape(drone, (t) => 0.75 + 0.25 * Math.sin((TAU * t) / 8));
  mix(x, circular(drone, (y) => biquad(y, "lp", 600, 0.7)), 0, 1);
  // The transformer's buzz: odd harmonics a phone speaker can actually play,
  // breathing on the 16 s cycle so the hum never sits still.
  const buzz = buf(LOOP);
  for (const [f, g] of [[275, 0.05], [385, 0.035], [495, 0.025], [605, 0.016], [825, 0.008], [385.25, 0.02]]) mix(buzz, sine(LOOP, f, r() * TAU), 0, g);
  shape(buzz, (t) => 0.6 + 0.4 * Math.sin((TAU * t) / LOOP + 2));
  mix(x, buzz, 0, 1);
  return normalize(circular(x, (y) => clean(y, 38)), -3);
}

/** Paranormal: a cold airy drone, wind through a gap with a whistle, a glassy beating pad. */
function roomParanormal() {
  const r = rng(121);
  const n = samples(LOOP + XFADE);
  const noise = new Float64Array(n);
  // Wind: the band's centre sweeps on 16 s and 8 s cycles, so it matches across the crossfade.
  const centre = (i) => {
    const t = i / SR;
    return 820 + 380 * Math.sin((TAU * t) / LOOP) + 160 * Math.sin((TAU * t) / 8 + 1);
  };
  mix(noise, sweepBandpass(pink(r, n), centre, 3.2), 0, 1);
  mix(noise, sweepBandpass(white(r, n), (i) => 2.6 * centre(i) + 300, 9), 0, 0.12);
  mix(noise, biquad(brown(r, n), "lp", 90, 0.7), 0, 0.35);
  const x = loopify(noise, LOOP, XFADE);
  // A cold pad: A3, E4, B4 with detuned twins (slow beating) and a faint shimmer.
  const pad = buf(LOOP);
  const voices = [[220, 0.05, 16], [220.25, 0.05, 8], [329.625, 0.035, 16 / 3], [329.875, 0.03, 16], [493.875, 0.02, 8], [1318.5, 0.006, 4]];
  for (const [f, g, period] of voices) {
    const ph = r() * TAU;
    mix(pad, shape(sine(LOOP, f, r() * TAU), (t) => 0.55 + 0.45 * Math.sin((TAU * t) / period + ph)), 0, g);
  }
  mix(x, pad, 0, 1);
  return normalize(circular(x, (y) => clean(y, 40)), -3);
}

// name: [build, encode options]
const EFFECT = { rate: 44100, bitrate: "64k" };
const TONE = { rate: 32000, bitrate: "40k" };
const SOUNDS = {
  shutter: [shutter, EFFECT],
  typewriter: [typewriter, EFFECT],
  "room-noir": [roomNoir, TONE],
  "room-crime-scene": [roomCrime, TONE],
  "room-paranormal": [roomParanormal, TONE],
};

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

/** 16-bit mono PCM WAV with TPDF dither. */
function wav(x, r) {
  const data = Buffer.alloc(x.length * 2);
  for (let i = 0; i < x.length; i++) {
    const d = (r() - r()) / 32768;
    const v = Math.max(-1, Math.min(1, x[i] + d));
    data.writeInt16LE(Math.round(v * 32767), i * 2);
  }
  const head = Buffer.alloc(44);
  head.write("RIFF", 0); head.writeUInt32LE(36 + data.length, 4); head.write("WAVE", 8);
  head.write("fmt ", 12); head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20); head.writeUInt16LE(1, 22);
  head.writeUInt32LE(SR, 24); head.writeUInt32LE(SR * 2, 28); head.writeUInt16LE(2, 32); head.writeUInt16LE(16, 34);
  head.write("data", 36); head.writeUInt32LE(data.length, 40);
  return Buffer.concat([head, data]);
}

const wanted = process.argv.slice(2);
const names = wanted.length ? wanted : Object.keys(SOUNDS);
const work = mkdtempSync(join(tmpdir(), "escapd-audio-"));
mkdirSync(OUT, { recursive: true });
try {
  for (const name of names) {
    const entry = SOUNDS[name];
    if (!entry) throw new Error(`no sound called ${name}; have ${Object.keys(SOUNDS).join(", ")}`);
    const [build, { rate, bitrate }] = entry;
    const x = build();
    const bad = x.findIndex((v) => !Number.isFinite(v));
    if (bad >= 0) throw new Error(`${name}: non-finite sample at ${(bad / SR).toFixed(4)} s`);
    const src = join(work, `${name}.wav`);
    writeFileSync(src, wav(x, rng(7)));
    const dst = join(OUT, `${name}.m4a`);
    execFileSync("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-y", "-i", src,
      "-ac", "1", "-ar", String(rate), "-c:a", "aac", "-b:a", bitrate,
      "-map_metadata", "-1", "-fflags", "+bitexact", "-flags:a", "+bitexact", "-movflags", "+faststart",
      dst,
    ]);
    if (process.env.WAV_DIR) {
      mkdirSync(process.env.WAV_DIR, { recursive: true });
      copyFileSync(src, join(process.env.WAV_DIR, `${name}.wav`));
    }
    const kb = (statSync(dst).size / 1024).toFixed(1);
    console.log(`${name.padEnd(18)} ${(x.length / SR).toFixed(2)} s  ${kb} KB`);
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}

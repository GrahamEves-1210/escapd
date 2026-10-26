# Audio

Every sound in `assets/audio/` is **self-generated**: synthesized from seeded noise, filters, envelopes and a small reverb by `scripts/audio/generate.mjs`, then encoded with ffmpeg's native AAC encoder. No samples or recordings were downloaded or used, so there is nothing third-party to license or attribute. The files belong to the project like its code.

Rebuild them all (Node 18+ and ffmpeg on PATH):

```sh
node scripts/audio/generate.mjs              # every sound
node scripts/audio/generate.mjs stamp paper  # just these
WAV_DIR=/tmp/wavs node scripts/audio/generate.mjs  # also keep 16-bit WAVs for inspection
```

The output is deterministic (seeded PRNG, bit-exact encode), so a rebuild changes only what you edit.

## Format

- Effects: mono AAC-LC in `.m4a`, 44.1 kHz, about 64 kbit/s, normalized to -1 dBFS peak (press to -3 dBFS). Playback volume per sound is set in `src/game/sound.ts`.
- Room tones: mono AAC-LC in `.m4a`, 32 kHz, about 40 kbit/s, 16 s seamless loops normalized to -3 dBFS peak and played quietly (volume 0.1 to 0.12). Noise layers are generated 2 s long and the tail crossfaded over the head; tonal layers use whole cycles in 16 s; the final filters run circularly, so the last sample runs into the first.

## Files

| File | Cue (`useFeedback()`) | What it is | How it's made | Size | Duration |
|---|---|---|---|---|---|
| `press.m4a` | `press` | A very quiet felt click for buttons (volume 0.22) | A 1 ms band-passed noise click, a 230 Hz body and a low-passed thump | 1.7 KB | 0.07 s |
| `knock.m4a` | `thud` | A soft knock on wood for a firm moment | A gliding 175 Hz sine body, a band-passed (720 Hz) knock, a short click, small room | 3.7 KB | 0.32 s |
| `paper.m4a` | `paper` | A sheet lifted and turned: rustle, crackle, the page landing | Pink noise through a band-pass sweeping 1.3 to 3.9 kHz, ~50 tiny high-passed fibre crackles, a low-passed flap | 5.2 KB | 0.50 s |
| `shutter.m4a` | `shutter` (camera) | A mechanical shutter: curtain, gear whirr, mirror slap | Two clicks 72 ms apart, each a noise transient, a 1.1 kHz body and inharmonic metal partials (2.4 to 7.9 kHz); a gated band-passed whirr between | 3.7 KB | 0.32 s |
| `typewriter.m4a` | `typewriter` | A run of six typewriter keys | Per key: a key-top click, the typebar striking the platen (low-passed noise, a 1.1 to 1.4 kHz resonance, a 145 Hz platen thump, a faint bar ring) and an escapement tick; irregular 72 to 125 ms spacing | 7.5 KB | 0.78 s |
| `unlock.m4a` | `unlock` | A heavy lock: the bolt's clunk, then the latch at 110 ms | Bolt: a 100 to 70 Hz thump, a low-passed slap, five struck-steel partials. Latch: a bright click, three partials and a small spring ring. Timed to the haptic pattern in `feedback.ts` | 6.7 KB | 0.70 s |
| `wrong-code.m4a` | `wrongCode` | The handle rattles and won't give, then an old buzzer at 90 ms | Three decaying metallic rattles, then a band-limited 110 Hz saw with a gated noise armature through a 950 Hz band-pass "horn", sagging in pitch at the end | 5.7 KB | 0.58 s |
| `pickup.m4a` | `pickup` | An item dropped into the evidence tray: thump, bounce, settle | A 165 Hz thump with a 430 Hz box resonance and a click, a smaller bounce at 78 ms, three tiny rattles | 4.4 KB | 0.42 s |
| `stamp.m4a` | `stamp` | A rubber stamp slammed onto a sheet on a wooden desk | An 80 to 50 Hz thump, a low-passed slap, a rubber smack (900 Hz), desk resonances at 182 Hz and 436 Hz, three small things on the desk jumping, a medium room | 7.2 KB | 0.75 s |
| `solved.m4a` | `solved` | The case-solved sting: an upright bass on C, vibraphone climbing into Cm6/9 | A Karplus-Strong plucked C2; vibraphone notes (partials 1 : 4 : 10, mallet click, 5.4 Hz motor tremolo) Eb4 at 0, G4 at 260 ms, A4 + D5 at 400 ms (the haptic beats); a brush swish and a soft ride; a larger room | 27.4 KB | 3.30 s |
| `room-noir.m4a` | room tone, noir | Rain on the office window, a rumble, a faint mains hum | Pink noise band-limited to 0.9 to 7 kHz with a slow drift; ~30 drop ticks a second (2.2 to 6 kHz) and fatter drips; low-passed brown-noise rumble; 60/120/180/240 Hz hum | 81.5 KB | 16.00 s (loop) |
| `room-crime-scene.m4a` | room tone, crime scene | A low, tense transformer hum | 55 / 55.25 Hz and 110 / 110.5 Hz pairs beating every 4 s, swelling every 8 s; odd harmonics (275 to 825 Hz) a phone speaker can play, breathing on 16 s; dark brown-noise rumble; a thin 3.2 kHz tension band | 81.4 KB | 16.00 s (loop) |
| `room-paranormal.m4a` | room tone, paranormal | A cold, airy drone | Pink-noise wind through a band-pass sweeping around 0.5 to 1.4 kHz on 16 s and 8 s cycles, a faint whistle band above it, a low hush; a glassy pad (A3, E4, B4 with detuned twins, a faint E6 shimmer) fading in and out slowly | 81.6 KB | 16.00 s (loop) |

All thirteen files total about 340 KB. Licence for every file: self-generated for Escapd (no third-party material).

## Playback

- `src/game/sound.ts` loads each effect once (the first `useFeedback()` with sound on preloads them) and replays from the start. It never throws: on the web, or when a load or play fails, the cue is silent and its haptic still fires.
- The audio session respects the **iOS silent switch** (`playsInSilentMode: false`, the ambient category; Android likewise stays quiet in silent or vibrate ringer modes) and **mixes with other audio** (`interruptionMode: "mixWithOthers"`): the player's music keeps playing at its own volume, and no audio focus is requested. Nothing plays in the background.
- Sound follows the server setting `sound_enabled` (the Sound switch in the hub's Settings sheet); haptics follow `haptics_enabled`. Each is independent of the other.
- Silent cues: `tick`, `success`, `warning`, `error` (outcomes the screen states; the game moments carry their own sounds). `typewriter` is sound only, with no haptic.
- Room tone: `useRoomTone(active)` (`src/game/useRoomTone.ts`), mounted by `app/play/[roomId].tsx` and `app/tutorial/index.tsx`. It plays the active mode's loop (`useMode()`, noir when none), fades in over 1.6 s and out over 0.7 s, crossfades when the mode changes, and fades out when the screen loses focus, the app leaves the foreground, sound is turned off or the screen unmounts.
- The app config's `expo-audio` plugin asks for no microphone and no background audio.

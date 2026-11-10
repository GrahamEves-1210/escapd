# Audio

Two kinds: the **effects and room tones** in `assets/audio/` (self-generated, below) and the **music** in `assets/music/` (the user's tracks, see "Music").

Every sound in `assets/audio/` is **self-generated**: synthesized from seeded noise, modal resonators, envelopes and a small procedural room, then encoded with ffmpeg's native AAC encoder. No samples or recordings were downloaded or used, so there is nothing third-party to license or attribute. The files belong to the project like its code.

Two scripts build them:

- `scripts/audio/foley.py` (Python 3.10+, numpy, scipy): the **interaction foley**, every cue below except the shutter and typewriter. Soft, warm, close-mic and quiet, in the manner of modern indie mobile puzzle games: wood, paper, cloth, glass, a little brass, a cat. No 8-bit blips or synth beeps.
- `scripts/audio/generate.mjs` (Node 18+): the camera **shutter**, the **typewriter** and the three **room tones** (unchanged by the foley redesign).

```sh
pip install numpy scipy                           # once (matplotlib too, for the contact sheet)
python3 scripts/audio/foley.py                    # every foley cue
python3 scripts/audio/foley.py purr mug-break     # just these
python3 scripts/audio/foley.py pencil-rub         # a cue's numbered variants (pencil-rub-1, -2, -3)
WAV_DIR=/tmp/wavs python3 scripts/audio/foley.py  # also keep the 16-bit WAVs
python3 scripts/audio/contact_sheet.py /tmp/wavs  # waveform + spectrogram of each, in /tmp/wavs/contact-sheet.png

node scripts/audio/generate.mjs                   # shutter, typewriter, room tones
node scripts/audio/generate.mjs room-noir         # just this one
```

Both are deterministic (seeded noise, bit-exact encode), so a rebuild changes only what you edit. `foley.py` prints each cue's length, size, loudness, peak, the share of its energy above 300 Hz (what a phone speaker can play) and the encoder setting it used.

### How the foley is made

- **Impacts** (taps, knocks, the drawer's stop, the stamp, the bolt, ticks) are physical models: a *contact pulse* (a half-sine; shorter is harder and brighter, 0.25 ms for a detent to 1.6 ms for the rubber stamp) rings a bank of two-pole *modal resonators*, each a frequency, a decay and a level. The banks are the materials (`WOOD_BLOCK`, `DESK`, `BRASS_BOLT`, `GLASS_TICK` and so on at the top of the cue section). Phone speakers give up below about 250 Hz, so every "low" body also carries modes between 300 Hz and 1 kHz.
- **Textures** (paper, cloth, the drawer's slide, whooshes) are seeded noise through fixed and moving band-passes (a state-variable filter swept sample by sample), shaped by envelopes and grain clouds (paper fibre cracks, fabric threads, the drawer's ~45 Hz stick-slip).
- **Tones** (the unlock chime, the solved shimmer, the pickup sparkle) are additive bells: a warm, celesta-like bar (mostly fundamental) and a small, glassier bell for sparkles, each partial decaying on its own, each note dying away over its last third.
- **The purr** follows what's measured of house cats (Eklund, Peters & Duthie 2010; Schötz & Eklund 2011): the larynx opens and closes about 21 to 27 Hz, breathing out and in, the in-breath usually a little faster and quieter. What a listener hears as a small cat is mostly the breath let through in puffs, not a tone: the first version's buzzing oscillator and strong 180 and 330 Hz chest modes (60 % of its energy under 200 Hz) were what made it a lion. Checked by spectrogram, spectral centroid, the share under 80 and 200 Hz, flatness and the envelope's modulation rate.
- Every layer ends on a short fade, every cue goes through a small procedural room (early reflections and a damped noise tail, wet 3 to 20 %), a 40 Hz high-pass and a 12 kHz roll-off; its tail is trimmed 60 dB down and faded to exact zero, and its start eased in over 0.5 ms. No clicks at either end.
- **Levelling:** each cue is brought to **-18 LUFS momentary max** (BS.1770 K-weighting, the loudest 400 ms) unless that would push its 4x-oversampled peak over **-1.5 dBTP**; then the ceiling wins, so the shortest transients (detent, press, snap) sit a few dB quieter. The final mix is the per-cue volume in `src/game/sound.ts`.
- **Encoding:** mono AAC-LC in `.m4a`, 44.1 kHz, 96 kbit/s. Every encode is decoded and checked: ffmpeg's default coder now and then mangles one sharp low transient (the stamp decoded 4 dB over full scale), so a file that overshoots -0.5 dBFS or drifts from its source falls back to the `fast` coder, then 160 kbit/s.

## Format

- Foley: as above. Volume per cue in `src/game/sound.ts` (`EFFECTS`).
- Shutter and typewriter: mono AAC-LC, 44.1 kHz, about 64 kbit/s, normalized to -1 dBFS peak.
- Room tones: mono AAC-LC in `.m4a`, 32 kHz, about 40 kbit/s, 16 s seamless loops normalized to -3 dBFS peak and played quietly (volume 0.1 to 0.12). Noise layers are generated 2 s long and the tail crossfaded over the head; tonal layers use whole cycles in 16 s; the final filters run circularly, so the last sample runs into the first.

## Files

| File | Cue (`useFeedback()`) | Volume | What it is | How it's made | Size | Length |
|---|---|---|---|---|---|---|
| `press.m4a` | `press` | 0.25 | A soft, rounded fingertip tap on a felt-covered wooden key: buttons, chips, cards | A 0.5 ms contact into four modes (380 Hz, 1.15 kHz, 2.3 kHz, 3.6 kHz), a tiny room | 2.6 KB | 0.12 s |
| `knock.m4a` | `thud` | 0.5 | A wooden block set down on a cloth-topped table: a firm, physical moment | A 1.4 ms contact into a five-mode wood block (150 Hz to 1.7 kHz, strongest at 565 Hz) and a quieter second face, small room | 4.3 KB | 0.26 s |
| `paper.m4a` | `paper` | 0.45 | A note picked up and opened: a crisp crinkle, the sheet flexing open, a light papery landing | ~70 fibre cracks (0.8 to 4 ms noise grains band-passed between 1.8 and 8.5 kHz, thinning out), a band sweeping 0.8 to 2.6 kHz, a landing tap at 310 ms | 6.5 KB | 0.43 s |
| `pickup.m4a` | `pickup` | 0.5 | Something found: a soft wood-and-glass tick, then a tiny three-note sparkle | A 0.9 ms contact into a glass-and-wood bank (620 Hz to 6.9 kHz); glass-bell pings E7, G7, C8 at 45, 85, 125 ms; a breath of high air | 8.5 KB | 0.63 s |
| `snap.m4a` | `snap` | 0.5 | An item used and fitting: a clean two-part click, in, then seated | A hard 0.4 ms contact into five modes (520 Hz to 5.2 kHz); a softer seating click 28 ms later | 3.4 KB | 0.18 s |
| `detent.m4a` | `detent` | 0.3 | A code or lock wheel stepping one place: one tiny, fine mechanical tick | A 0.25 ms contact into small-metal modes (650 Hz, 1.9 to 7.2 kHz, 2 to 9 ms decays) | 2.0 KB | 0.07 s |
| `unlock.m4a` | `unlock` | 0.65 | A correct code: a warm brass bolt clunks across, the latch clicks at 110 ms, a soft chime | A 30 ms slide, a 1 ms contact into a brass bolt (88 Hz to 3.3 kHz, strongest at 436 Hz); a latch click at 110 ms; celesta G5 and D6 (an open fifth) at 130 and 145 ms. Timed to the haptic pattern | 12.2 KB | 0.93 s |
| `wrong-code.m4a` | `wrongCode` | 0.5 | It doesn't give: two gentle, muted wooden knocks at 0 and 90 ms (the haptic beats). Not a buzzer | Two soft contacts into a muted wood bank (104 to 862 Hz, short decays), the second a little lower and softer; two dull latch ticks; low-passed at 1.8 kHz | 5.3 KB | 0.35 s |
| `stamp.m4a` | `stamp` | 0.75 | A thick rubber stamp pressed onto paper on a wooden desk, lifted with a faint peel | A 1.6 ms contact into a desk (96 Hz to 1.1 kHz); a band-passed rubber smack; a hint of paper crush; a sticky crackle at 170 ms | 4.6 KB | 0.31 s |
| `solved.m4a` | `solved` | 0.55 | The case solved: a warm, short magical shimmer | Celesta E5 at 0, G5 at 260 ms, C6 + E6 at 400 ms (the haptic beats) over a soft chorused Cmaj9 pad; a cascade of 16 tiny glass notes (C pentatonic, octave 7); a rising air band; a larger room | 23.3 KB | 1.86 s |
| `drawer.m4a` | `drawer` | 0.55 | A wooden drawer sliding out, its soft thud at the stop at 170 ms (the firm haptic's beat) | Friction noise with a ragged ~45 Hz stick-slip grain ringing the drawer box (212, 468, 884 Hz); a 1.3 ms contact into the stop (118 Hz to 1.5 kHz); two tiny knocks of what's inside | 6.8 KB | 0.47 s |
| `cloth.m4a` | `cloth` | 0.45 | A cloth lifted off something: a soft, close fabric rustle and the air under it | 140 soft thread grains over a hush, through a band wandering 0.9 to 2.2 kHz, low-passed at 4.2 kHz; a low-passed puff of air | 5.9 KB | 0.39 s |
| `uv-switch.m4a` | `uvSwitch` | 0.45 | The UV light on: a soft rocker click, then a warm electric hum flickering up and fading | A 0.5 ms contact into a rocker (0.8 to 4.1 kHz); a 9-harmonic hum settling 96 to 120 Hz, flickering (smoothed) in its first 60 ms; a faint 120 Hz-pulsed fizz at 2.6 to 5.2 kHz | 7.4 KB | 0.52 s |
| `lens-up.m4a` | `lensUp` | 0.35 | The magnifier lifted: a soft upward whoosh with the faintest glint of glass | Noise through a band sweeping 450 Hz to 1.9 kHz, low-passed at 4.5 kHz; a very quiet A7 glass ping at 140 ms | 5.1 KB | 0.32 s |
| `lens-down.m4a` | `lensDown` | 0.4 | The magnifier set down: a short falling breath, then a soft glass-on-wood tick | A band falling 1.5 kHz to 600 Hz; a 0.9 ms contact at 65 ms into glass-on-wood modes (420 Hz to 4.3 kHz) | 4.0 KB | 0.22 s |
| `purr.m4a` | `purr` | 0.18 | The cat, rubbed: a small, soft, breathy purr, a contented little cat (not a big cat's growl). Breathing out, in (about 5 dB softer, a touch faster) and out again as it fades | Breath noise pulsed at the larynx's rate (25 Hz out, 27.5 Hz in, drifting, each pulse a little uneven: the flutter; the air never fully stops), through a small head's broad, light resonances (220 Hz to 3 kHz, strongest 220 to 700 Hz), a soft 310 to 2100 Hz tick of each opening, a faint chest; high-passed at 100 Hz, so nothing below 80 Hz carries weight (centroid ~900 Hz, the old one's 270 Hz). Kept under the music. A one-shot: a replay restarts it, so a rub can retrigger it | 25.2 KB | 2.01 s |
| `mug-break.m4a` | `mugBreak` (sound only) | 0.55 | The mug the cat knocked off home's window sill, breaking on a hard floor just off-screen: a sharp ceramic crack, the pieces parting, three shards skittering away, one last crumb. Slightly distant, no cartoon | A 0.3 ms gritty contact into a glazed mug (1.2 to 7.6 kHz, damped short: cracked ceramic stops ringing) and a floor thump (190 to 870 Hz); a dry noise snap and crackles; five parting pieces in the first 60 ms and the big piece landing again at 92 ms; three shards of ticks closing up (2.3 to 7.1 kHz, each tick a little detuned), two sliding to a stop; low-passed at 7 kHz, a larger room (wet 20 %) for the distance | 12.2 KB | 0.88 s |
| `pencil-rub-1.m4a`, `-2`, `-3` | `pencilRub` (sound only) | 0.2 | Soft graphite shading on paper, one back-and-forth stroke: a dry, breathy scratch with the faint tick of the lead catching the paper's tooth. No squeak. Three variants (different stroke lengths, weights and brightness), because it fires again and again while the player rubs | Friction noise through one wide band whose centre follows the hand's speed (1.1 to 2.4 kHz, Q 0.7), over a little air (3.5 to 7.5 kHz) and a soft papery body (330 to 760 Hz). The loudness is the speed: a swell forth, a dip at the turn (never to nothing), a swell back, eased from and to silence. The tooth is ragged stick-slip bursts (rectified 420 Hz noise, no steady rate, so no pitch); 5 to 8 dull 0.6 to 1.8 ms ticks; the sharpest grains rounded off; low-passed at 5.2 kHz, a tiny room | 6.5, 6.0, 6.6 KB | 0.42, 0.42, 0.46 s |
| `paper-fold.m4a` | `paperFold` | 0.3 | A sheet of paper folded over, creased and pressed flat: a short rustle into a soft, crisp crease at 160 ms (the light haptic's beat), then a fingertip along the fold | A band rising 700 Hz to 2.2 kHz with 22 light fibre cracks (the sheet coming over); 46 fibre cracks (0.5 to 2.2 ms grains, 2.2 to 9 kHz) packed at 160 ms and thinning over 70 ms, with a dull paper-on-paper pat (340 and 760 Hz, no ring); a band falling 2.6 to 1.3 kHz with ten last cracks (pressed flat) | 7.3 KB | 0.50 s |
| `shutter.m4a` | `shutter` (camera) | 0.95 | A mechanical shutter: curtain, gear whirr, mirror slap (`generate.mjs`) | Two clicks 72 ms apart, each a noise transient, a 1.1 kHz body and inharmonic metal partials (2.4 to 7.9 kHz); a gated band-passed whirr between | 3.7 KB | 0.32 s |
| `typewriter.m4a` | `typewriter` | 0.45 | A run of six typewriter keys (`generate.mjs`) | Per key: a key-top click, the typebar striking the platen (low-passed noise, a 1.1 to 1.4 kHz resonance, a 145 Hz platen thump, a faint bar ring) and an escapement tick; irregular 72 to 125 ms spacing | 7.5 KB | 0.78 s |
| `room-noir.m4a` | room tone, noir | 0.12 | Rain on the office window, a rumble, a faint mains hum | Pink noise band-limited to 0.9 to 7 kHz with a slow drift; ~30 drop ticks a second (2.2 to 6 kHz) and fatter drips; low-passed brown-noise rumble; 60/120/180/240 Hz hum | 81.5 KB | 16.00 s (loop) |
| `room-crime-scene.m4a` | room tone, crime scene | 0.1 | A low, tense transformer hum | 55 / 55.25 Hz and 110 / 110.5 Hz pairs beating every 4 s, swelling every 8 s; odd harmonics (275 to 825 Hz) a phone speaker can play, breathing on 16 s; dark brown-noise rumble; a thin 3.2 kHz tension band | 81.4 KB | 16.00 s (loop) |
| `room-paranormal.m4a` | room tone, paranormal | 0.11 | A cold, airy drone | Pink-noise wind through a band-pass sweeping around 0.5 to 1.4 kHz on 16 s and 8 s cycles, a faint whistle band above it, a low hush; a glassy pad (A3, E4, B4 with detuned twins, a faint E6 shimmer) fading in and out slowly | 81.6 KB | 16.00 s (loop) |

All twenty-six files total about 420 KB. Licence for every file: self-generated for Escapd (no third-party material).

## Playback

- `src/game/sound.ts` loads each effect once (the first `useFeedback()` with sound on preloads them) and replays from the start. A cue with **variants** (`pencilRub`: an array of files as its `source` in `EFFECTS`) loads one player per file; each play picks one at random, never the one it played last, so a run of strokes doesn't sound stamped and the stroke before rings out under the next instead of being cut off. A variant that fails to load is skipped. It never throws: on the web, or when a load or play fails, the cue is silent and its haptic still fires.
- The audio session respects the **iOS silent switch** (`playsInSilentMode: false`, the ambient category; Android likewise stays quiet in silent or vibrate ringer modes) and **mixes with other audio** (`interruptionMode: "mixWithOthers"`): the player's music keeps playing at its own volume, and no audio focus is requested. Nothing plays in the background.
- Sound follows the server setting `sound_enabled` (the Sound switch in the hub's Settings sheet); haptics follow `haptics_enabled`. Each is independent of the other.
- Silent cues: `tick`, `success`, `warning`, `error` (outcomes the screen states; the game moments carry their own sounds). `tick` stays silent because it fires everywhere (pagers, scales, toggles); a lock or code wheel that wants an audible step calls `detent` (the tick haptic plus the tiny tick sound). `typewriter`, `mugBreak` and `pencilRub` are sound only, with no haptic (the rubbing sheet gives its own ticks).
- Patterns: `wrongCode` (heavy, then the error notification at 90 ms), `unlock` (medium, light at 110 ms), `solved` (success, light at 260 ms, medium at 400 ms), `drawer` (light, medium at 170 ms, the stop) and `paperFold` (the tick, light at 160 ms, the crease) put their later haptics on the beats their sounds are cut to (`PATTERN` in `src/game/feedback.ts`).
- The interaction cues and where they belong: `drawer` a drawer or compartment opening; `cloth` a cloth lifted; `paper` a note or card; `pickup` an item found; `snap` an item used and fitting; `detent` a wheel's step; `unlock` a lock opening; `wrongCode` a wrong code or accusation; `uvSwitch` the UV light on; `lensUp` / `lensDown` the magnifier lifted and set down; `purr` the cat rubbed; `mugBreak` the mug the cat knocks off home's window sill, breaking off-screen (sound only, no haptic: it isn't the player's touch); `pencilRub` one stroke of a pencil rubbed over paper, called again for each stroke as the player rubs; `paperFold` a sheet folded and creased.
- Room tone: `useRoomTone(active)` (`src/game/useRoomTone.ts`), mounted by `app/play/[roomId].tsx` and `app/tutorial/index.tsx`. It plays the active mode's loop (`useMode()`, noir when none), fades in over 1.6 s and out over 0.7 s, crossfades when the mode changes, and fades out when the screen loses focus, the app leaves the foreground, sound is turned off or the screen unmounts.
- The app config's `expo-audio` plugin asks for no microphone and no background audio.

## Music

Three looping tracks in `assets/music/`, one per mode. They are the user's own and are **not** generated.

| File | Plays in | Source | Licence |
|---|---|---|---|
| `theme.m4a` | The shell (home, Pro, account) and Detective Noir: its mode screens, intro, capture flow, build wait and play screen | The main theme: the audio of the user's screen recording (AAC-LC, 44.1 kHz stereo, about 130 kbit/s), **stream-copied** with no re-encode, its silent 1.6 s head and 1.9 s tail cut on frame boundaries: `ffmpeg -i video.mp4 -vn -c:a copy raw.m4a`, then `ffmpeg -ss 1.6 -to 214.2 -i raw.m4a -c copy -movflags +faststart assets/music/theme.m4a`. 212.6 s, 3.4 MB, -27.6 LUFS integrated | Supplied and licensed by the user |
| `crime.m4a` | Crime Scene ("murder mystery") | The user's `Jazz.wav` (PCM 16-bit, 44.1 kHz stereo, 107.1 s), its silent 4.2 s tail cut, encoded to AAC-LC 256 kbit/s: `ffmpeg -i Jazz.wav -t 102.9 -c:a aac -b:a 256k -movflags +faststart assets/music/crime.m4a`. 102.9 s, 3.2 MB, -16.9 LUFS (`trim` 0.29 brings it to the theme). AAC in .m4a rather than MP3 so the loop is gapless on iOS | Supplied and licensed by the user |
| `paranormal.mp3` | Paranormal | The user's `atmoseerie01.mp3`, as supplied (MP3 44.1 kHz stereo, 20.1 s, 400 KB, -26.0 LUFS; `trim` 0.83 brings it to the theme) | Supplied and licensed by the user |

**All three are the user's real tracks** (the silent placeholders the system was first built against are gone).

### Levels

Every level is in `src/game/sound.ts`, in one place (`EFFECTS`, `TONES`, `MUSIC`):

| What | Level |
|---|---|
| Effects | 0.18 to 0.95 (purr 0.18 and pencilRub 0.2, about the music's level; press 0.25, detent 0.3, paperFold 0.3; the foley is loudness-matched, so these are the mix) |
| Music (`MUSIC.level`) | 0.35, times each track's `trim` (1 for now; set once the real tracks are in, to even out their loudness) |
| Room tone | 0.1 to 0.12; while music plays, half that (`MUSIC.roomTone` 0.5), faded over 1.2 s, back up when the music stops |

### Playback

- `useMusic()` (`src/game/useMusic.ts`) is mounted **once**, in `app/_layout.tsx`, so the music follows the active mode (`useMode()`) across screens instead of starting and stopping with each one. `src/game/music.ts` owns the players and fades.
- **One track at a time**, looping. A mode change **crossfades over 1.2 s** (`MUSIC.fade.cross`); the old track pauses once silent. The shell and noir share the theme, so moving between them **keeps it playing, without a restart**. A track coming back after another mode's starts from its top; one coming back after a pause resumes where it was.
- **Music off** (Settings → Music, the server's `music_enabled`) fades out at once, over 0.5 s (`MUSIC.fade.stop`); on fades back in. Music is independent of Sound (effects and room tone) and Haptics.
- **The app leaving the foreground:** `inactive` fades out over 0.5 s; `background` silences and pauses at once (timers may not run there to finish a fade). On return it fades back in where it was.
- **Start:** at app start, once fonts are loaded and the root stack mounts. The ambient session needs no user gesture on iOS or Android; the web plays no audio at all (as for the effects).
- **Never throws:** a failed load is silence (and isn't retried, and doesn't lower the room tone); a failed play or seek is swallowed. A track is only ever sought when `player.isLoaded` is true, the same guard as the effects (iOS raises an uncatchable native exception for a seek on an item that isn't ready).
- **Session:** the effects' session, unchanged: the silent switch is respected and `mixWithOthers` is kept. The trade-off: games usually let their score be ducked or paused when another app plays; here the music plays alongside the player's own audio, so effects and music share one consistent session and nothing of ours interrupts theirs. A player who'd rather hear only their own music turns Music off.

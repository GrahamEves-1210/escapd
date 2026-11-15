# Audio

Two kinds: a **few sound effects** in `assets/audio/` (self-generated, below) and the **music** in `assets/music/` (the user's tracks, see "Music").

## The rule: felt, not heard

The game is mostly silent. A touch is felt (the haptics in `src/game/feedback.ts`), not heard: no sound on buttons, taps, selections or outcomes, no beeps, no musical stingers, and **nothing sounds because a screen opened** (a room, the brief, the build wait, case closed). A sound is kept only where something physical happens in the world and the player earned it, and each is quiet, short and natural, mixed **under** the user's music:

- a lock giving way (`unlock`), a drawer pulled open (`drawer`), a page turned or a clue found (`paper`);
- the camera's shutter (`shutter`);
- the ending's own moment: the noir door (`doorOut`), the paranormal candle (`candleOut`), the crime scene's stamp (`stamp`);
- the music box's notes (`musicNote(i)`): the box is an instrument, its notes are what it says.

Everything else keeps its haptic and makes no sound. A sounding cue also takes `audible` (default true): `paper(false)`, `stamp(false)`, `unlock(false)` keep the haptic without the sound where a sound would be one too many: the brief's letter coming out, opening the casebook, a card read again, the board's cards landing, a tool's reveal, a sticker pressed, the stamp on every solved step, the build wait's CASE READY seal, case closed's seal (the ending already gave the case its sound), the lock under the ending's door.

Round 16 (the user: "weird sound triggers when you first open room also when you build your case first 2 seconds or so also opening the letter sound is dumb sound design in general is ass") cut the set from 36 files to 13:

- **The room's first sound** was the flashlight's `uvSwitch` (a rocker click and a synthesized electric hum), fired by `src/play2/transitions/LightsOn.tsx` as the room came up. `uvSwitch` is now a light haptic only.
- **The build wait's first seconds** played the `typewriter` (six synthesized keys) from `BuildWait.tsx`: an effect on the status's phase, which goes `sending` to `queued` (or `running`) a second or two in. The effect is gone; the wait is silent.
- **The letter** played its opening (`waxCrack`, `stringOff` or `paperFold`) and then `paper` as it slid out. All four are haptic only there now.
- Gone for good: `press`, `knock` (`thud`), `pickup`, `snap`, `detent`, `wrong-code`, `solved`, `cloth`, `uv-switch`, `lens-up`, `lens-down`, `purr`, `mug-break`, `pencil-rub-1..3`, `paper-fold`, `wax-crack`, `string-off`, `typewriter` and the three room tones (`room-noir`, `room-crime-scene`, `room-paranormal`: no longer mounted anywhere; `useRoomTone` is a no-op). `typewriter`, `mugBreak` and `pencilRub` were sound only, so they now do nothing.
- Remade: `unlock` (its chime gone), `drawer`, `paper`, `stamp`, `shutter` and `door-out`, as layered noise instead of ringing resonators, and every level brought down under the music.

## How they're made

Every file in `assets/audio/` is **self-generated** by `scripts/audio/foley.py` (Python 3.10+, numpy, scipy, ffmpeg): synthesized from seeded noise, envelopes and a small procedural room, then encoded with ffmpeg's native AAC encoder. No samples or recordings were downloaded or used, so there is nothing third-party to license or attribute.

```sh
pip install numpy scipy                           # once (matplotlib too, for the contact sheet)
python3 scripts/audio/foley.py                    # every cue
python3 scripts/audio/foley.py drawer unlock      # just these
python3 scripts/audio/foley.py music-note         # the six music-box notes (music-note-0 to -5)
WAV_DIR=/tmp/wavs python3 scripts/audio/foley.py  # also keep the 16-bit WAVs
OUT_DIR=/tmp/out python3 scripts/audio/foley.py   # write the .m4a files there instead of assets/audio
python3 scripts/audio/contact_sheet.py /tmp/wavs  # waveform + spectrogram of each, in /tmp/wavs/contact-sheet.png
```

**Adding a sound: build the file first, then add its `require()` to `src/game/sound.ts`.** A `require()` of a file that isn't there breaks the bundle for every screen. To replace a file the running app may be reading, build it elsewhere (`OUT_DIR`) and rename it into place. The build is deterministic (seeded noise, bit-exact encode), so a rebuild changes only what you edit.

- **Impacts** (the bolt and latch, the drawer's stop, the stamp, the shutter's curtains, the door's latch) are layered noise, not ringing resonators: a fraction of a millisecond of high-passed contact **click**; a bright **burst** of band-passed noise for the hard part, gone in 2 to 4 ms; low-passed noise for the **weight**; and at most a few body modes that die in under 10 ms (Q under about 10), so each has a material but never a pitch. The old set rang modal banks for 30 to 50 ms and added chimes, which is what read as synthesizer clunks (their spectra were 99 % in a few tonal peaks; the new ones 10 to 40 %).
- **Textures** (the drawer's slide, the page's swing, the door's creak and the rain) are seeded noise through wide, low-order band-passes, fixed or swept, let through in uneven stick-slip grains and shaped by envelopes.
- **Space:** every new cue sits in a small furnished room (`space`: six sparse early reflections, then a dense noise tail that grows in after them, its top above 1.8 kHz decaying twice as fast as the rest, as soft furnishings do) and has the faint **air of the room** under it (`room_tone`: dark noise 52 dB under the cue's peak, fading in with it and out with its tail), so it sits in a place rather than in digital silence. Each is moved 4 ms in so the contact isn't softened by the fade-in.
- Then a 40 Hz high-pass and a top roll-off; the tail trimmed 60 dB down and faded to exact zero; the start eased in over 0.5 ms.
- **Levelling:** each file is brought to **-18 LUFS momentary max** (BS.1770, the loudest 400 ms) unless that would push its 4x-oversampled peak over **-1.5 dBTP**; short impacts land on the peak cap and sit lower. The mix is the per-cue volume in `src/game/sound.ts`.
- **Encoding:** mono AAC-LC in `.m4a`, 44.1 kHz, 96 kbit/s. Every encode is decoded and checked; a file that overshoots -0.5 dBFS or drifts from its source falls back to the `fast` coder, then 160 kbit/s.
- **The music-box notes** and **the candle** were kept as they were (rebuilt bit-identically by the script).

## Files

Playback level: the cue's loudest 400 ms at its volume, against the music's momentary median at `MUSIC.level` (theme -38.6 LUFS, crime -41.9, paranormal -38.0). Every effect sits at or under it, and its peaks under the music's (-13.7 dBFS for the theme; the loudest effect peak is -16.6).

| File | Cue (`useFeedback()`) | Volume | At playback | What it is | How it's made | Size | Length |
|---|---|---|---|---|---|---|---|
| `unlock.m4a` | `unlock` | 0.16 | -43 LUFS | A lock giving way: the bolt drawn back with a short metal rub and a solid clack, the latch dropping at 110 ms (the light haptic's beat). No chime | A 30 ms rising rub (1.6 to 5.2 kHz); at 14 ms a click, metal bursts (1.9 to 5.2 kHz, 3.5 ms; 4.2 to 9 kHz, 1.8 ms), weight (noise under 1.1 kHz and 0.35 to 1.5 kHz, 6 to 8 ms) and three body modes gone in 4 to 7 ms; the latch the same, smaller and higher, with a tiny bounce 9 ms later | 9 KB | 0.65 s |
| `drawer.m4a` | `drawer` | 0.13 | -42 LUFS | A wooden drawer pulled out on its runners, its soft knock against the stop at 170 ms (the firm haptic's beat), what's inside shifting | Friction noise (0.26 to 2.4 kHz) let through in uneven stick-slip grains (34 to 60 a second) and coloured by the box (0.33 to 0.8 kHz), swelling; the stop a click, noise under 800 Hz (13 ms) and 0.3 to 1.3 kHz (8 ms), three short body modes; two tiny taps | 11 KB | 0.74 s |
| `paper.m4a` | `paper` | 0.05 | -44 LUFS | A page turned: lifted at its corner, swung over through the air, laid down flat. A page, not a crisp packet | A 35 ms rub (2.2 to 7 kHz); nine soft fibre ticks; the swing: noise through a wide band sweeping 0.7 to 2.2 kHz and back, swelling and falling, with a slight flutter; the landing at 270 ms: low-passed noise (9 ms) and a breath of top | 9 KB | 0.57 s |
| `stamp.m4a` | `stamp` | 0.17 | -41 LUFS | A rubber stamp pressed onto paper on a wooden desk, lifted with a faint sticky peel at 160 ms | Almost no click (rubber spreads the blow): noise under 700 Hz (12 ms), 0.28 to 1.3 kHz (7 ms), three short desk modes, a little paper slap; a sparse crackle for the peel | 8 KB | 0.58 s |
| `shutter.m4a` | `shutter` (camera) | 0.18 | -42 LUFS | A film camera's shutter: the first curtain, the second at 55 ms, the mechanism settling | Per curtain: a click, a bright burst (3 to 9 kHz, 1.6 ms) over a hollow body (0.9 to 2.6 kHz, 4 ms); a soft low knock at 72 ms and a last tick | 6 KB | 0.38 s |
| `door-out.m4a` | `doorOut` | 0.16 | -39 LUFS | The noir ending: a heavy door opened onto a rainy street at night. The latch, the door's weight leaving the frame, a brief low dry creak (never a squeal), the rain coming in through the widening gap, faded by 1.8 s. No hum, no tones | Latch: click, burst, low thunk. Frame: noise under 600 Hz and 0.25 to 0.95 kHz, three short modes. Creak: stick-slip grains (22 to 48 a second, each a different size) through the panels' wide body (0.22 to 1.1 kHz). Rain: a gusting hiss (0.9 to 7.5 kHz), ~90 drops and ~14 splats a second, a soft noise rumble; muffled (650 Hz) through the door, then open | 23 KB | 1.78 s |
| `candle-out.m4a` | `candleOut` | 0.1 | -40 LUFS | The paranormal ending: a candle guttering and going out. A soft flutter of flame (to 450 ms), a small puff that takes it, the wick's faint hiss | Flutter: air noise (260 Hz to 2.4 kHz) beating unevenly 11 to 19 times a second; puff: a band falling 1.1 kHz to 420 Hz; ember: a 3.8 to 8.5 kHz hiss dying over 0.2 s, two tiny ticks | 11 KB | 0.81 s |
| `music-note-0.m4a` to `-5.m4a` | `musicNote(i)`, i = 0 to 5 | 0.1 | -38 LUFS | The music box: one tooth of its steel comb plucked, a bell-like ting over a faint wooden tock. C5, D5, E5, G5, A5, C6 (C major pentatonic) | A clamped bar's modes: the note, a twin 5 cents sharp, the second mode at 6.27x (the ting, gone in 0.1 s) and the third at 17.55x; a 0.35 ms attack; the pluck knocks a small wooden box; a small room | 14 to 17 KB each | 1.06 s (C6) to 1.24 s (C5) |

All thirteen files total about 165 KB. Licence for every file: self-generated for Escapd (no third-party material).

## Playback

- `src/game/sound.ts` loads each effect once (the first `useFeedback()` with sound on preloads them; loading plays nothing) and replays from the start. The **music-box notes** have two voices each (the file twice as its `source`), so plays alternate between two players and the same tooth plucked again rings over itself; different notes are different players. It never throws: on the web, or when a load or play fails, the cue is silent and its haptic still fires. Only a loaded player is ever sought (iOS raises an uncatchable native exception for a seek on an item that isn't ready).
- The audio session respects the **iOS silent switch** (`playsInSilentMode: false`, the ambient category; Android likewise stays quiet in silent or vibrate ringer modes) and **mixes with other audio** (`interruptionMode: "mixWithOthers"`): the player's own music keeps playing at its own volume, and no audio focus is requested. Nothing plays in the background.
- Sound follows the server setting `sound_enabled` (the Sound switch in the hub's Settings sheet); haptics follow `haptics_enabled`. Each is independent of the other.
- Patterns: `unlock` (medium, light at 110 ms, the latch), `drawer` (light, medium at 170 ms, the stop) and `candleOut` (nothing at first, light at 450 ms, the puff) put their later haptics on the beats their sounds are cut to (`PATTERN` in `src/game/feedback.ts`); the silent `wrongCode`, `solved`, `paperFold` and `stringOff` keep their haptic patterns.
- Timing for the endings: call `doorOut` as the door starts to move (its latch is the sound's first instant); call `candleOut` 450 ms before the flame is out.
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

Every level is in `src/game/sound.ts`, in one place (`EFFECTS`, `MUSIC`):

| What | Level |
|---|---|
| Music (`MUSIC.level`) | 0.35, times each track's `trim` (theme 1, crime 0.29, paranormal 0.83, to even out their loudness): about -38 to -42 LUFS momentary median at playback |
| Effects | 0.05 to 0.18 (paper 0.05, the music-box notes and the candle 0.1, drawer 0.13, unlock and the door 0.16, stamp 0.17, shutter 0.18): -38 to -44 LUFS at their loudest, at or under the music's median, and their peaks 4 to 15 dB under the theme's |

### Playback

- `useMusic()` (`src/game/useMusic.ts`) is mounted **once**, in `app/_layout.tsx`, so the music follows the active mode (`useMode()`) across screens instead of starting and stopping with each one. `src/game/music.ts` owns the players and fades.
- **One track at a time**, looping. A mode change **crossfades over 1.2 s** (`MUSIC.fade.cross`); the old track pauses once silent. The shell and noir share the theme, so moving between them **keeps it playing, without a restart**. A track coming back after another mode's starts from its top; one coming back after a pause resumes where it was.
- **Music off** (Settings → Music, the server's `music_enabled`) fades out at once, over 0.5 s (`MUSIC.fade.stop`); on fades back in. Music is independent of Sound (the effects) and Haptics.
- **The app leaving the foreground:** `inactive` fades out over 0.5 s; `background` silences and pauses at once (timers may not run there to finish a fade). On return it fades back in where it was.
- **Start:** at app start, once fonts are loaded and the root stack mounts. The ambient session needs no user gesture on iOS or Android; the web plays no audio at all (as for the effects).
- **Never throws:** a failed load is silence (and isn't retried); a failed play or seek is swallowed. A track is only ever sought when `player.isLoaded` is true, the same guard as the effects (iOS raises an uncatchable native exception for a seek on an item that isn't ready).
- **Session:** the effects' session, unchanged: the silent switch is respected and `mixWithOthers` is kept. The trade-off: games usually let their score be ducked or paused when another app plays; here the music plays alongside the player's own audio, so effects and music share one consistent session and nothing of ours interrupts theirs. A player who'd rather hear only their own music turns Music off.

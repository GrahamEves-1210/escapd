// What the cat makes of the game (PeekingCat draws it; PlayerV2 tells this what
// happened). It keeps to the game's rules and nudges without telling, and
// without a word: a cat doesn't talk, it looks. Its nudges are rare (PATIENCE):
// none in a room's first minutes, only after a long, genuine idle, and a long
// wait after each one that grows each time; and never while the player is
// getting somewhere (a tap, a sweep of the light, a turn, a find: the idle
// starts again). The hints asked for in the casebook are another thing.
//   - stuck (no tap, no sweep, nothing found or solved, for a long while), it
//     glances once at something the player hasn't looked at yet, or toward the
//     turn arrow on the side where one is; everything looked at and the case
//     still open, at the way out (the door, the accusation), or its arrow.
//     From its second glance on, a paw too, patting the ledge that way,
//   - the light passing over something not looked at yet, it perks up (once per
//     thing, rarely, and not in the room's first minutes),
//   - guessing (three wrong answers in a row), a slow, level blink and a huff
//     with a shake of its head; waiting out a wrong answer's cooldown, its lids
//     sit half shut (`waiting`),
//   - an inspect that turns up nothing, it yawns now and then.
import { useEffect, useRef, useState } from "react";
import { AppState, useWindowDimensions } from "react-native";
import type { ActionResult, PlayState, RoomDefinitionV2, StateValue } from "@/engine/v2";
import { ref } from "@/theme/tokens";
import { CONTAINER_KEYS, type Content } from "./InspectView";
import type { CatLook, CatReaction } from "./PeekingCat";

/**
 * How patient it is (ms). Nothing in a room's first `graceMs`; a glance only after `idleMs` with no tap, no
 * sweep of the light, no turn and nothing found or solved; then nothing for `coolMs`, half as long again
 * after each glance (`growth`), up to `coolMaxMs`. A perk at most every `perkGapMs`, and none in the grace.
 * A glance holds `holdMs`.
 */
export const PATIENCE = { graceMs: 150_000, idleMs: 75_000, coolMs: 240_000, growth: 1.5, coolMaxMs: 900_000, perkGapMs: 90_000, holdMs: 3500 } as const;

/** The wait after the `n`-th glance (n >= 1). */
export const coolAfter = (n: number): number => Math.min(PATIENCE.coolMaxMs, PATIENCE.coolMs * PATIENCE.growth ** Math.max(0, n - 1));

/** When it may next glance: past the grace, a full idle after the last activity, and the wait after its last glance. */
export function glanceDue(t: { openedAt: number; activeAt: number; glancedAt: number | null; glances: number }): number {
  return Math.max(t.openedAt + PATIENCE.graceMs, t.activeAt + PATIENCE.idleMs, t.glancedAt === null ? -Infinity : t.glancedAt + coolAfter(t.glances));
}
/** A yawn at nothing about one time in this many, and never twice within BORED_GAP ms. */
const BORED_ODDS = 3;
const BORED_GAP = 10000;
/** Wrong answers in a row before it huffs. */
const GUESSES = 3;
/** The turn arrows' centres in from the screen's edges (PlayerV2's edge buttons: 52 wide, ref.space.sm in). */
const ARROW_X = ref.space.sm + 26;

export function useCatCues({ def, state, view, photos, frame, watching, cooldown, contents, react }: {
  def: RoomDefinitionV2 | null;
  state: PlayState | null;
  view: number;
  photos: number;
  /** The room photo's frame in window points. */
  frame: { x: number; y: number; width: number; height: number } | null;
  /** The room is in view (no close-up, no casebook): glances only then. */
  watching: boolean;
  /** The wrong-answer cooldown's seconds left. */
  cooldown: number;
  contents: Record<string, Content[]>;
  react: (reaction: CatReaction) => void;
}) {
  const { width: screenW } = useWindowDimensions();
  // The handlers run after a request comes back: they read the latest of these.
  const latest = useRef({ def, state, contents });
  useEffect(() => {
    latest.current = { def, state, contents };
  });

  // Progress: something new looked at, or a step solved.
  const seen = state?.seen.length ?? 0;
  const solved = state?.solved.length ?? 0;
  const progress = `${seen}/${solved}`;

  // Activity: a tap, a sweep of the light, a turn, a close-up opened or shut, any action, anything found or solved.
  const openedAt = useRef(0);   // (set when the room mounts, below)
  const activeAt = useRef(0);
  const glancedAt = useRef<number | null>(null);
  const glances = useRef(0);
  const touch = () => {
    activeAt.current = Date.now();
  };
  useEffect(() => {
    activeAt.current = Date.now();
  }, [progress, view, watching, state]);
  // A new room: its own grace, its own count. Back from another app: that was no idle in the room.
  useEffect(() => {
    openedAt.current = activeAt.current = Date.now();
    glancedAt.current = null;
    glances.current = 0;
  }, [def]);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") activeAt.current = Date.now();
    });
    return () => sub.remove();
  }, []);
  const [glance, setGlance] = useState<{ progress: string; wonder: boolean; paw: boolean } | null>(null);
  useEffect(() => {
    if (!watching) return;
    let hold: ReturnType<typeof setTimeout> | undefined;
    const timer = setInterval(() => {
      const now = Date.now();
      if (now < glanceDue({ openedAt: openedAt.current, activeAt: activeAt.current, glancedAt: glancedAt.current, glances: glances.current })) return;
      glances.current += 1;
      glancedAt.current = now;
      // The first a "?" with its eyes only; after that an "!", and a paw that way too.
      setGlance({ progress, wonder: glances.current === 1, paw: glances.current > 1 });
      hold = setTimeout(() => setGlance(null), PATIENCE.holdMs);
    }, 1000);
    return () => {
      clearInterval(timer);
      clearTimeout(hold);
      setGlance(null);
    };
  }, [watching, progress]);

  // Where it glances: something interactive here not looked at yet; or, when
  // there's none here, the arrow toward one. Everything looked at and the case
  // still open: the way out, or the arrow toward it.
  let lookAt: CatLook = null;
  if (glance && glance.progress === progress && watching && def && state && frame && !state.completed) {
    const shown = (id: string) => !state.objects[id]?.hidden && !state.objects[id]?.removed;
    const unseen = def.objects.filter((o) => o.archetype && !state.seen.includes(o.id) && shown(o.id));
    const ways = unseen.length ? unseen : def.objects.filter((o) => o.exit && shown(o.id) && state.objects[o.id]?.open !== true);
    const here = ways.filter((o) => o.photo_index === view);
    // The way out last: something to find first.
    const pick = here.find((o) => !o.exit) ?? here[0];
    if (pick) {
      lookAt = {
        x: frame.x + (pick.box.x + pick.box.w / 2) * frame.width, y: frame.y + (pick.box.y + pick.box.h / 2) * frame.height,
        wonder: glance.wonder, paw: glance.paw,
      };
    } else if (ways.length && photos > 1) {
      // The nearer way round.
      const ahead = Math.min(...ways.map((o) => (o.photo_index - view + photos) % photos));
      const behind = Math.min(...ways.map((o) => (view - o.photo_index + photos) % photos));
      lookAt = { x: ahead <= behind ? screenW - ARROW_X : ARROW_X, y: frame.y + frame.height / 2, wonder: glance.wonder, paw: glance.paw };
    }
  }

  // The light over something not looked at yet: it perks up, once per thing, not too often.
  const perked = useRef(new Set<string>());
  const perkedAt = useRef(-Infinity);
  const hover = (objectId: string | null) => {
    // The light moving is the player at work.
    touch();
    const { def: d, state: s } = latest.current;
    const o = objectId ? d?.objects.find((x) => x.id === objectId) : undefined;
    if (!o || !o.archetype || !s || s.seen.includes(o.id) || perked.current.has(o.id)) return;
    const now = Date.now();
    if (now - openedAt.current < PATIENCE.graceMs || now - perkedAt.current < PATIENCE.perkGapMs) return;
    perked.current.add(o.id);
    perkedAt.current = now;
    react({ kind: "warm", at: now });
  };

  // Guessing: wrong answers in a row (a solved step starts the count again).
  const streak = useRef(0);
  useEffect(() => {
    streak.current = 0;
  }, [solved]);
  const wrong = () => {
    touch();
    streak.current += 1;
    if (streak.current < GUESSES) return;
    streak.current = 0;
    // A beat after the wrong answer's own flinch: a slow, level blink and a huff.
    setTimeout(() => react({ kind: "guess", at: Date.now() }), 900);
  };

  // A cooldown running: it waits it out with its lids half shut.
  const cooling = cooldown > 0;

  // Nothing there: an inspect that turned up nothing, or a container opened on nothing. Now and then, a yawn.
  const boredAt = useRef(-Infinity);
  const nothing = (objectId: string, result: ActionResult | null, set?: { control: string; value: StateValue }) => {
    touch();
    const { def: d, state: s, contents: c } = latest.current;
    const o = d?.objects.find((x) => x.id === objectId);
    if (!result || result.outcome !== "nothing" || !o || !s || (c[objectId] ?? []).length) return;
    const st = s.objects[o.id] ?? {};
    const opened = set ? (CONTAINER_KEYS as readonly string[]).includes(set.control) && set.value === true : false;
    if (!opened && !(o.archetype === null || CONTAINER_KEYS.some((k) => st[k] === true))) return;
    const now = Date.now();
    if (now - boredAt.current < BORED_GAP || Math.random() * BORED_ODDS >= 1) return;
    boredAt.current = now;
    react({ kind: "empty", at: now });
  };

  return { lookAt, waiting: cooling, hover, wrong, nothing, touch };
}

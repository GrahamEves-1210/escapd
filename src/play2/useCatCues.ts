// What the cat makes of the game (PeekingCat draws it; PlayerV2 tells this what
// happened). It keeps to the game's rules and nudges without telling:
//   - stuck (nothing new looked at, no step solved, for a while), it glances
//     now and then at something the player hasn't looked at yet, or toward the
//     turn arrow on the side where one is; everything looked at and the case
//     still open, at the way out (the door, the accusation), or its arrow.
//     Now and then a glance comes with a word ("Over there.", "That way."),
//   - the light passing over something not looked at yet, it perks up (once per
//     thing, not too often),
//   - guessing (three wrong answers in a row), it says so; waiting out a wrong
//     answer's cooldown, it says to take a second,
//   - an inspect that turns up nothing, it yawns now and then.
import { useEffect, useRef, useState } from "react";
import { useWindowDimensions } from "react-native";
import type { ActionResult, PlayState, RoomDefinitionV2, StateValue } from "@/engine/v2";
import { ref } from "@/theme/tokens";
import { CONTAINER_KEYS, type Content } from "./InspectView";
import type { CatLine, CatLook, CatReaction } from "./PeekingCat";

/** Stuck this long (ms) without progress, it starts glancing. */
const STUCK_MS = 45000;
/** A glance holds this long (ms), and the next comes this much later (plus up to GLANCE_JITTER). */
const GLANCE_HOLD = 3500;
const GLANCE_EVERY = 9000;
const GLANCE_JITTER = 5000;
/** It perks up at most this often (ms). */
const PERK_GAP = 4000;
/** "Empty." about one time in this many, and never twice within BORED_GAP ms. */
const BORED_ODDS = 3;
const BORED_GAP = 10000;
/** Wrong answers in a row before it says something. */
const GUESSES = 3;
/** Every this many glances (the first among them), it says where as well. */
const GLANCE_TALK = 3;
/** The turn arrows' centres in from the screen's edges (PlayerV2's edge buttons: 52 wide, ref.space.sm in). */
const ARROW_X = ref.space.sm + 26;

const LINES = {
  guess: "Think. Don't guess.",
  wait: "Easy. Give it a second.",
  empty: "Empty.",
  here: "Over there.",
  turn: "That way.",
} as const;

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
  const [say, setSay] = useState<CatLine>(null);
  // The handlers run after a request comes back: they read the latest of these.
  const latest = useRef({ def, state, contents });
  useEffect(() => {
    latest.current = { def, state, contents };
  });

  // Progress: something new looked at, or a step solved.
  const seen = state?.seen.length ?? 0;
  const solved = state?.solved.length ?? 0;
  const progress = `${seen}/${solved}`;

  // Stuck: since the last progress, a glance every so often (each tied to that progress, so progress ends it).
  const since = useRef(0);
  const nextGlance = useRef(0);
  const glances = useRef(0);
  const [glance, setGlance] = useState<{ progress: string; wonder: boolean; talk: boolean } | null>(null);
  useEffect(() => {
    since.current = Date.now();
    nextGlance.current = 0;
  }, [progress]);
  useEffect(() => {
    if (!watching) return;
    let hold: ReturnType<typeof setTimeout> | undefined;
    const timer = setInterval(() => {
      const now = Date.now();
      if (now - since.current < STUCK_MS || now < nextGlance.current) return;
      glances.current += 1;
      nextGlance.current = now + GLANCE_HOLD + GLANCE_EVERY + Math.random() * GLANCE_JITTER;
      // Every other glance a "?" (the rest an "!"); now and then a word too.
      setGlance({ progress, wonder: glances.current % 2 === 0, talk: glances.current % GLANCE_TALK === 1 });
      hold = setTimeout(() => setGlance(null), GLANCE_HOLD);
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
    const line = (text: string) => (glance.talk ? text : undefined);
    if (pick) {
      lookAt = {
        x: frame.x + (pick.box.x + pick.box.w / 2) * frame.width, y: frame.y + (pick.box.y + pick.box.h / 2) * frame.height,
        wonder: glance.wonder, line: line(LINES.here),
      };
    } else if (ways.length && photos > 1) {
      // The nearer way round.
      const ahead = Math.min(...ways.map((o) => (o.photo_index - view + photos) % photos));
      const behind = Math.min(...ways.map((o) => (view - o.photo_index + photos) % photos));
      lookAt = { x: ahead <= behind ? screenW - ARROW_X : ARROW_X, y: frame.y + frame.height / 2, wonder: glance.wonder, line: line(LINES.turn) };
    }
  }

  // The light over something not looked at yet: it perks up, once per thing, not too often.
  const perked = useRef(new Set<string>());
  const perkedAt = useRef(-Infinity);
  const hover = (objectId: string | null) => {
    const { def: d, state: s } = latest.current;
    const o = objectId ? d?.objects.find((x) => x.id === objectId) : undefined;
    if (!o || !o.archetype || !s || s.seen.includes(o.id) || perked.current.has(o.id)) return;
    const now = Date.now();
    if (now - perkedAt.current < PERK_GAP) return;
    perked.current.add(o.id);
    perkedAt.current = now;
    react({ kind: "warm", at: now });
  };

  // Guessing: wrong answers in a row (a solved step starts the count again).
  const streak = useRef(0);
  const scoldedAt = useRef(-Infinity);
  useEffect(() => {
    streak.current = 0;
  }, [solved]);
  const wrong = () => {
    streak.current += 1;
    if (streak.current < GUESSES) return;
    streak.current = 0;
    scoldedAt.current = Date.now();
    setSay({ text: LINES.guess, at: Date.now(), rule: true });
  };

  // A cooldown starting: once each, a beat in, so a scolding for the same wrong answer goes first.
  const cooling = cooldown > 0;
  useEffect(() => {
    if (!cooling) return;
    const timer = setTimeout(() => {
      if (Date.now() - scoldedAt.current > 2000) setSay({ text: LINES.wait, at: Date.now(), rule: true });
    }, 800);
    return () => clearTimeout(timer);
  }, [cooling]);

  // Nothing there: an inspect that turned up nothing, or a container opened on nothing. Now and then, a yawn.
  const boredAt = useRef(-Infinity);
  const nothing = (objectId: string, result: ActionResult | null, set?: { control: string; value: StateValue }) => {
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
    setSay({ text: LINES.empty, at: now });
  };

  return { say, lookAt, waiting: cooling, hover, wrong, nothing };
}

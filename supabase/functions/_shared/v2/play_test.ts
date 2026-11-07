// The wrong-answer cooldown: the first two mistakes cheap, then longer, so guessing costs real time.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { COOLDOWN_MS, cooldownFor, MAX_COOLDOWN_MS, play } from "./play.ts";
import { planRoom } from "./planner.ts";
import { FULL_15, seededRandomInt } from "./test_fixtures.ts";

Deno.test("play: wrong accusations wait 5, 5, 15, 30, then 60 seconds; a right submit starts the count again", () => {
  assertEquals([1, 2, 3, 4, 5, 9].map(cooldownFor), [COOLDOWN_MS, COOLDOWN_MS, 15_000, 30_000, MAX_COOLDOWN_MS, MAX_COOLDOWN_MS]);
  const r = planRoom(FULL_15, { mode: "crime_scene", seed: "cooldown", randomInt: seededRandomInt(3) });
  assert(r.ok);
  const { definition: def, secret } = r;
  const f = def.finale;
  assert(f.kind === "accusation");
  const answer = secret.rules.find((x) => x.trigger.on === "submit" && x.trigger.object === f.object)!.when.find((c) => c.if === "submitted")!;
  const right = secret.slots[(answer as { eq: { slot: string } }).eq.slot].value.split("|");
  const wrong = [f.suspects.find((o) => o.id !== right[0])!.id, right[1], right[2]];
  let state: unknown = null, now = 0, locked: number | null = null;
  const waits: number[] = [];
  for (let i = 0; i < 5; i++) {
    const { save } = play(def, secret, state, { action: { type: "submit", object: f.object, value: wrong } }, now, locked);
    assert(save && save.lockedUntil !== null);
    waits.push(save.lockedUntil - now);
    state = save.state; locked = save.lockedUntil; now = save.lockedUntil;   // wait it out
  }
  assertEquals(waits, [5_000, 5_000, 15_000, 30_000, 60_000]);
  // While a cooldown runs, a submit is refused unevaluated and the run doesn't grow.
  const early = play(def, secret, state, { action: { type: "submit", object: f.object, value: wrong } }, now - 1, now + 1);
  assertEquals((early.save!.state.wrong_run), 5);
  // The right answer clears the run.
  const won = play(def, secret, state, { action: { type: "submit", object: f.object, value: right } }, now, locked);
  assertEquals(won.save!.state.wrong_run, undefined);
  assert(won.response.completed);
});

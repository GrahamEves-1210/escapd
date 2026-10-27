// Property test: ~300 seeded synthetic inventories x 3 modes. Every plan validates and
// simulates solvable within the step band; sparse rooms plan two threads or fail cleanly.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { analyzeInventory, MIN_POOL, planRoom, THREE_THREAD_POOL } from "./planner.ts";
import { planProblems, seededRandomInt, syntheticInventory } from "./test_fixtures.ts";
import { MODES } from "./types.ts";

const ROOMS = 300;

Deno.test(`property: ${ROOMS} synthetic inventories in every mode`, () => {
  const stats = { plans: 0, ok: 0, steps: 0, revisits: 0, roomChanges: 0, branching: 0, chain: 0, two: 0, three: 0 };
  const failures = new Map<string, number>();
  let plannable = 0, plannableFailed = 0;   // an exit and at least MIN_POOL interactive objects
  for (let i = 0; i < ROOMS; i++) {
    const inv = syntheticInventory(i, 3 + (i % 14));
    const { exit, interactive } = analyzeInventory(inv);
    for (const mode of MODES) {
      stats.plans++;
      if (exit && interactive >= MIN_POOL) plannable++;
      const r = planRoom(inv, { mode, seed: `room-${i}`, randomInt: seededRandomInt(i) });
      if (r.ok) {
        assertEquals(planProblems(r, mode), [], `room ${i} ${mode}`);
        if (interactive < THREE_THREAD_POOL) assertEquals(r.summary.threads, 2, `sparse room ${i} ${mode} planned 3 threads`);
        const m = r.report.metrics;
        stats.ok++; stats.steps += m.requiredSteps; stats.revisits += m.revisits; stats.roomChanges += m.roomChanges;
        stats.branching += m.branching; stats.chain += m.maxChain; stats[r.summary.threads === 2 ? "two" : "three"]++;
        continue;
      }
      assert(r.detail.length > 0);
      if (exit && interactive >= MIN_POOL) plannableFailed++;
      failures.set(r.reason, (failures.get(r.reason) ?? 0) + 1);
      if (r.reason === "no_exit") assert(!exit, `room ${i}: no_exit with an exit`);
      else {
        assert(exit, `room ${i}: ${r.reason} without checking the exit`);
        // Rooms with enough interactive objects always plan; only sparse ones may fail, and say so.
        assertEquals(r.reason, "too_few_objects", `room ${i} ${mode}: ${r.detail}`);
        assert(interactive < THREE_THREAD_POOL || interactive < MIN_POOL, `room ${i} ${mode}: ${interactive} interactive objects`);
      }
    }
  }
  const mean = (k: number) => Math.round((k / stats.ok) * 100) / 100;
  console.log(JSON.stringify({
    plans: stats.plans, ok: stats.ok, failureRate: Math.round((1 - stats.ok / stats.plans) * 1000) / 1000,
    failures: Object.fromEntries(failures), plannable, plannableFailed, meanSteps: mean(stats.steps), meanRevisits: mean(stats.revisits),
    meanRoomChanges: mean(stats.roomChanges), meanBranching: mean(stats.branching), meanMaxChain: mean(stats.chain),
    threads: { two: stats.two, three: stats.three },
  }));
  assert(stats.ok > stats.plans / 2);
});

// Gameplay v2 core: schema, archetypes, engine, validator, simulator, planner.
// Pure TypeScript shared by the Deno edge functions and the app (via src/engine/v2.ts).
export * from "./types.ts";
export * from "./taxonomy.ts";
export * from "./archetypes.ts";
export * from "./motifs.ts";
export { applyAction, initialState, renderCard } from "./engine.ts";
export { slotRefs, validateDefinition } from "./validate.ts";
export { simulate, type SimMetrics, type SimOptions, type SimReport } from "./simulate.ts";
export {
  analyzeInventory, MAX_OBJECTS, MIN_POOL, MIN_SALIENCE, type PlanFailure, type PlanOptions, type PlanResult, planRoom, type PlanSummary,
  seededRandom, STEP_BAND, THREE_THREAD_POOL, usableObjects,
} from "./planner.ts";

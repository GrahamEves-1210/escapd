// Generation v2 (docs/GAMEPLAY_V2.md §3, chunk 3): stages 2-10 for a job that
// asks for schema 2. ai.ts downloads the photos and owns the deadline, the
// ledger and the stage log, then hands over here:
//
//   perception v2 (type + features, the door included)  -> privacy gate
//   -> v1's verification and reconciliation -> InventoryObject[]
//   -> planRoom (motifs, archetypes, minted answers, the simulator's check;
//      seeded by the room id) -> the author call (words only)
//   -> applyAuthor (per-field fallback) -> validateDefinition + simulate
//      again (any failure keeps the planner's words) -> the stored room.
//
// Same model calls and cost as v1: one Flash call per photo, one Flash
// verification call, one Pro call for the words.
import { ErrorCode, GenerationError, type Genre } from "../contract.ts";
import { type PhotoPayload, reconcile, type StageContext, verifyCandidates } from "../perception.ts";
import { applyAuthor, writeAuthor } from "./author.ts";
import { collectCandidatesV2, perceivePhotosV2, toInventory } from "./perceive.ts";
import type { RandomInt } from "../mint.ts";
import { planRoom } from "./planner.ts";
import { simulate } from "./simulate.ts";
import type { RoomDefinitionV2, RoomSecretV2 } from "./types.ts";
import { validateDefinition } from "./validate.ts";

export const MIN_CANDIDATES_V2 = 4;

export interface GenerateV2Input {
  ctx: StageContext;
  photos: PhotoPayload[];
  photoIds: string[];
  genre: Genre;
  roomId: string;
  randomInt: RandomInt;
  stage: (name: string, fields?: Record<string, unknown>) => void;
  /** A GenerationError carrying the usage so far. */
  fail: (message: string, code: string, retryable: boolean) => GenerationError;
}

export interface GeneratedV2 {
  publicDefinition: Record<string, unknown>;
  solution: Record<string, unknown>;
}

/** Problems with a room: the static validator, then the simulator. */
export function roomProblems(def: RoomDefinitionV2, secret: RoomSecretV2): string[] {
  const errors = validateDefinition(def, secret);
  if (errors.length) return errors;
  return simulate(def, secret).errors;
}

export async function generateV2(input: GenerateV2Input): Promise<GeneratedV2> {
  const { ctx, photos, photoIds, genre, roomId, randomInt, stage, fail } = input;

  // Perception v2, then the privacy gate (as v1: only a clearly visible face blocks).
  const perceptions = await perceivePhotosV2(ctx, photos);
  stage("perception", { objects: perceptions.reduce((n, p) => n + p.objects.length, 0), schema: 2 });
  const flagged = photos.filter((_, i) => perceptions[i]?.faceVisible).map((p) => p.position);
  if (flagged.length) {
    throw fail(
      `A face is visible in photo position(s): ${flagged.join(", ")}. ` +
        "Retake those photos without anyone's face in the frame. " +
        `Reasons: ${flagged.map((p) => `${p}=person`).join("; ")}.`,
      ErrorCode.personOrSensitive, false);
  }

  const tooFew = (n: number) =>
    fail(`Only ${n} usable object(s) found; at least ${MIN_CANDIDATES_V2} are needed. Add one or two closer views of a desk, shelf or table.`,
      ErrorCode.tooFewObjects, false);
  const { candidates, physical } = collectCandidatesV2(perceptions);
  if (candidates.length < MIN_CANDIDATES_V2) throw tooFew(candidates.length);
  const verified = await verifyCandidates(ctx, photos, candidates);
  const objects = reconcile(verified);
  const inventory = toInventory(objects, physical);
  stage("verification", { candidates: candidates.length, verified: verified.length, objects: inventory.length });

  const plan = planRoom(inventory, { mode: genre, seed: roomId, randomInt });
  if (!plan.ok) {
    if (plan.reason === "no_exit") {
      throw fail("No door found to escape through. Add a photo that shows the room's door.", ErrorCode.tooFewObjects, false);
    }
    if (plan.reason === "too_few_objects") throw fail(`${plan.detail}.`, ErrorCode.tooFewObjects, false);
    throw fail(`no room could be planned from these objects: ${plan.detail}`, ErrorCode.invalidAfterRepair, false);
  }
  stage("plan", { ...plan.summary, motifs: plan.summary.motifs.join(","), steps: plan.report.metrics.requiredSteps });

  // Words. The planner's room already passed the simulator; the words must not break it.
  const text = await writeAuthor(ctx, plan.definition, plan.secret, photos);
  let room = applyAuthor(plan.definition, plan.secret, text);
  let problems = roomProblems(room.definition, room.secret);
  if (problems.length) {
    stage("author_rejected", { errors: problems.slice(0, 4).join("; ") });
    room = { definition: plan.definition, secret: plan.secret, kept: -1 };
    problems = roomProblems(room.definition, room.secret);
    if (problems.length) throw fail(`planned room failed its own checks: ${problems.slice(0, 6).join("; ")}`, ErrorCode.invalidAfterRepair, false);
  }
  stage("prose", { kept: room.kept });

  const definition: RoomDefinitionV2 = { ...room.definition, photos: photoIds.map((photo_id) => ({ photo_id })) };
  return {
    publicDefinition: definition as unknown as Record<string, unknown>,
    solution: room.secret as unknown as Record<string, unknown>,
  };
}

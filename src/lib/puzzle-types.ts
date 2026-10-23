// Types for the PUBLIC puzzle definition (schema v1) and the gameplay API.
// The secret solution format is server-only and intentionally not typed here.

export type Id = string; // ^[a-z0-9][a-z0-9_-]{0,63}$

export interface PuzzleDefinitionV1 {
  schema_version: 1;
  title?: string;
  intro?: string;
  photos: Array<{ photo_id: string } | { asset_key: string }>;
  items: Array<{ id: Id; name: string; description?: string }>;
  hotspots: Hotspot[];
  puzzles: Puzzle[];
  exit: { requires: Id[]; message?: string };
}

export interface Hotspot {
  id: Id;
  photo_index: number;
  object_label: string;      // the real-world object this maps to ("drawer")
  name?: string;
  description?: string;
  hidden?: boolean;          // revealed later by solving a puzzle
  shape: { type: "rect"; x: number; y: number; w: number; h: number }; // normalized 0..1
}

export type PuzzleKind = "inspect" | "code" | "use_item" | "combine";

export interface Puzzle {
  id: Id;
  kind: PuzzleKind;
  hotspot_id?: Id;           // required except for "combine"
  requires?: Id[];           // dependency graph
  title?: string;
  prompt?: string;
  answer_format?: { kind: "digits" | "letters" | "text"; length?: number };
}

export interface SessionState {
  solved: Id[];
  inventory: Id[];
  revealed_hotspots: Id[];
}

export type GameAction =
  | { type: "inspect"; hotspot_id: Id }
  | { type: "solve"; puzzle_id: Id; answer: string }
  | { type: "use_item"; item_id: Id; hotspot_id: Id }
  | { type: "combine"; item_ids: [Id, Id] };

export type ActionOutcome = "solved" | "wrong" | "nothing" | "invalid";

export interface ActionResult {
  outcome: ActionOutcome;
  message?: string;
  puzzle_id?: Id;
  gained_items?: Id[];
  consumed_items?: Id[];
  revealed_hotspots?: Id[];
  completed?: boolean;
  exit_message?: string | null;
  state?: SessionState;      // present when outcome === "solved"
}

export interface MyAccess {
  user_id: string;
  is_anonymous: boolean;
  tutorial_completed: boolean;
  has_custom_rooms_entitlement: boolean;
  entitlement_status: "active" | "billing_issue" | "expired" | "revoked" | null;
  entitlement_expires_at: string | null;
  will_renew: boolean | null;
  can_generate: boolean;
  generations_used: number;
  generations_cap: number;
  min_photos_per_room: number;
  max_photos_per_room: number;
}

// Database types for supabase-js, matching supabase/migrations/*.
// Hand-written to bootstrap the project. Once the schema is applied, replace
// this file with the generated version:
//   npx supabase gen types typescript --project-id <project-ref> --schema public > src/lib/database.types.ts
// (JSON columns are typed as Json here; cast public_definition to
// PuzzleDefinitionV1, state to SessionState, and hint_progress to HintProgress
// from ./puzzle-types.)
import type { Genre } from "./puzzle-types";

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Timestamp = string;

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; display_name: string | null; tutorial_completed_at: Timestamp | null; created_at: Timestamp; updated_at: Timestamp };
        Insert: never;
        Update: { display_name?: string | null };
        Relationships: [];
      };
      user_settings: {
        Row: {
          user_id: string; sound_enabled: boolean; music_enabled: boolean; haptics_enabled: boolean;
          hints_enabled: boolean; reduced_motion: boolean; locale: string; marketing_opt_in: boolean;
          analytics_opt_in: boolean; created_at: Timestamp; updated_at: Timestamp;
        };
        Insert: never;
        Update: {
          sound_enabled?: boolean; music_enabled?: boolean; haptics_enabled?: boolean; hints_enabled?: boolean;
          reduced_motion?: boolean; locale?: string; marketing_opt_in?: boolean; analytics_opt_in?: boolean;
        };
        Relationships: [];
      };
      rooms: {
        Row: {
          id: string; owner_id: string | null; kind: "custom" | "tutorial"; title: string; description: string | null;
          status: "draft" | "queued" | "generating" | "ready" | "failed"; current_version_id: string | null;
          metadata: Json; last_activity_at: Timestamp; created_at: Timestamp; updated_at: Timestamp; genre: Genre;
        };
        Insert: never;
        Update: { title?: string; description?: string | null };
        Relationships: [];
      };
      room_photos: {
        Row: {
          id: string; room_id: string; owner_id: string; bucket_id: string; storage_path: string; position: number;
          mime_type: string; byte_size: number | null; width: number | null; height: number | null; created_at: Timestamp;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      puzzle_versions: {
        Row: {
          id: string; room_id: string; owner_id: string | null; version: number; schema_version: number;
          status: "published" | "superseded"; public_definition: Json; content_hash: string;
          generation_job_id: string | null; created_at: Timestamp;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      game_sessions: {
        Row: {
          id: string; user_id: string; room_id: string; puzzle_version_id: string;
          status: "active" | "completed" | "abandoned"; state: Json; action_count: number;
          wrong_answer_count: number; hints_used: number; started_at: Timestamp; last_played_at: Timestamp;
          completed_at: Timestamp | null; created_at: Timestamp; updated_at: Timestamp;
          hint_progress: Json; code_wrong_streak: number; code_locked_until: Timestamp | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      generation_jobs: {
        Row: {
          id: string; room_id: string; owner_id: string; idempotency_key: string;
          status: "queued" | "running" | "succeeded" | "failed" | "cancelled"; attempt_count: number;
          max_attempts: number; prompt_version: string; output_schema_version: number; next_attempt_at: Timestamp;
          lease_token: string | null; leased_by: string | null; lease_expires_at: Timestamp | null;
          error_code: string | null; error_message: string | null; result_version_id: string | null;
          started_at: Timestamp | null; finished_at: Timestamp | null; created_at: Timestamp; updated_at: Timestamp;
          genre: Genre; // the room's genre when the job was queued
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      entitlements: {
        Row: {
          id: string; user_id: string; entitlement_key: "custom_rooms";
          provider: "revenuecat" | "app_store" | "play_store" | "manual" | "promo";
          status: "active" | "billing_issue" | "expired" | "revoked"; product_id: string | null; store: string | null;
          environment: "PRODUCTION" | "SANDBOX" | null; period_type: string | null; will_renew: boolean | null;
          expires_at: Timestamp | null; provider_customer_id: string | null; last_event_id: string | null;
          last_event_at: Timestamp | null; created_at: Timestamp; updated_at: Timestamp;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_room: { Args: { p_title?: string | null; p_genre?: Genre }; Returns: Database["public"]["Tables"]["rooms"]["Row"] };
      register_room_photo: {
        Args: { p_room_id: string; p_storage_path: string; p_position: number; p_width?: number | null; p_height?: number | null };
        Returns: Database["public"]["Tables"]["room_photos"]["Row"];
      };
      request_room_generation: {
        Args: { p_room_id: string; p_idempotency_key: string; p_genre?: Genre | null };
        Returns: Database["public"]["Tables"]["generation_jobs"]["Row"];
      };
      cancel_room_generation: { Args: { p_job_id: string }; Returns: Database["public"]["Tables"]["generation_jobs"]["Row"] };
      start_or_resume_session: { Args: { p_room_id: string }; Returns: Database["public"]["Tables"]["game_sessions"]["Row"] };
      abandon_session: { Args: { p_session_id: string }; Returns: Database["public"]["Tables"]["game_sessions"]["Row"] };
      submit_action: { Args: { p_session_id: string; p_action: Json }; Returns: Json };
      use_hint: { Args: { p_session_id: string; p_rung: number }; Returns: Json };
      get_my_access: { Args: Record<string, never>; Returns: Json };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

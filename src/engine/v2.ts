// Gameplay v2 core for the app: schema types, archetype catalog, engine (local
// preview and feedback), validator, simulator and planner. The source lives with
// the edge functions (one source of truth, Deno-style explicit .ts imports);
// tsconfig's allowImportingTsExtensions and Metro's exact-path resolution make it
// importable here. Minting (planner) uses crypto.getRandomValues, which the app
// polyfills via react-native-get-random-values (src/lib/supabase.ts).
export * from "../../supabase/functions/_shared/v2/mod.ts";

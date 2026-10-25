// Bundled scene art referenced by `asset_key` in a published definition.
// Keys must match supabase/seed.sql exactly. The image set and the seed's
// hotspot rects are one reviewed asset: change them together.
export const TUTORIAL_ROOM_ID = "00000000-0000-4000-8000-000000000001";

export const BUNDLED_SCENES: Record<string, number> = {
  "tutorial/study_1.jpg": require("../../assets/tutorial/study_1.jpg"),
  "tutorial/study_2.jpg": require("../../assets/tutorial/study_2.jpg"),
  "tutorial/study_3.jpg": require("../../assets/tutorial/study_3.jpg"),
};

export function bundledScene(assetKey: string): number | undefined {
  return BUNDLED_SCENES[assetKey];
}

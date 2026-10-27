// Scene art bundled with the app, for a definition photo given by `asset_key`
// rather than `photo_id`. No scenes ship any more (the bundled tutorial room is
// gone); every room is the player's own photos. Kept so asset_key resolves cleanly.
export function bundledScene(_assetKey: string): number | undefined {
  return undefined;
}

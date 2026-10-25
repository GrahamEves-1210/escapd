// Layout values the guide's parts derive from tokens and share.
import { space } from "@/theme/tokens";

/**
 * Close's hitSlop on each side: the live IconButton is 48 round (hit.min), so
 * its hit area is 48 + 4 + 4 = 56. The header pads this much below Close so
 * the slop sits inside it (Android only delivers touches inside a parent).
 */
export const CLOSE_SLOP = space.xs;

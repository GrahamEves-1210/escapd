// Layout values the guide's parts derive from tokens and share.
import { ref } from "@/theme/tokens";

/**
 * Close's hitSlop on each side: 44 + 2 + 2 = 48 (ref.hit.comfortable), the
 * kit IconButton's default. The header pads this much below Close so the
 * slop sits inside it (Android only delivers touches inside a parent), and
 * the art's upper void gives the same amount back, so the art box still sits
 * 151 below Close (y 266 on the base device).
 */
export const CLOSE_SLOP = (ref.hit.comfortable - ref.button.icon.size) / 2;

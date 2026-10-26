import { useModeTheme } from "@/game/mode";
import { CubeIcon, ICON_WEIGHT, KeyIcon, NoteIcon, ScrollIcon } from "@/components/icons";

// Items have no art in schema v1. Pick a neutral glyph from the name; the
// name is always shown beside it, so the icon never carries meaning alone.
// Glyphs in the mode's ink, as 02's white: `filled` draws the fill weight, the chosen state.
export function ItemIcon({ name, size = 20, tint, filled = false }: {
  name: string;
  size?: number;
  tint?: string;
  filled?: boolean;
}) {
  const theme = useModeTheme();
  const n = name.toLowerCase();
  const props = { size, color: tint ?? theme.ink, weight: filled ? ("fill" as const) : ICON_WEIGHT };
  if (/\bkey\b/.test(n)) return <KeyIcon {...props} />;
  if (/note|letter|paper|page|card|ticket|receipt/.test(n)) return <NoteIcon {...props} />;
  if (/map|scroll|scrap|diagram|plan/.test(n)) return <ScrollIcon {...props} />;
  return <CubeIcon {...props} />;
}

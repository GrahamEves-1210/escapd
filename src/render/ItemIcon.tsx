import { color } from "@/theme/tokens";
import { CubeIcon, ICON_WEIGHT, KeyIcon, NoteIcon, ScrollIcon } from "@/components/icons";

// Items have no art in schema v1. Pick a neutral glyph from the name; the
// name is always shown beside it, so the icon never carries meaning alone.
export function ItemIcon({ name, size = 20, tint = color.text }: { name: string; size?: number; tint?: string }) {
  const n = name.toLowerCase();
  const props = { size, color: tint, weight: ICON_WEIGHT };
  if (/\bkey\b/.test(n)) return <KeyIcon {...props} />;
  if (/note|letter|paper|page|card|ticket|receipt/.test(n)) return <NoteIcon {...props} />;
  if (/map|scroll|scrap|diagram|plan/.test(n)) return <ScrollIcon {...props} />;
  return <CubeIcon {...props} />;
}

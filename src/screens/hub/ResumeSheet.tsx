// Home's continue prompt (MODES_PROMPT.md Part 2, round 6): a mode card
// tapped while that mode has a case to go back to. The kit's DarkSheet over
// home, in the mode's colours (a ModeScope, so the sheet, its Close and its
// pills read the mode while home stays the shell): the mode's name as the
// title in its display face, one short line in the mode's voice ("You've
// still got a case open."), and the photo guide's two pills: Continue, the
// mode's primary (ModePill "ghost", its accent), and Start a new case, the
// guide's ghost pill in the mode's ground and rim (OutlinePill). While Start a
// new case checks access it shows the small spinner and Continue waits.
import { StyleSheet, Text } from "react-native";
import { DarkSheet } from "@/components/noir";
import { ModePill } from "@/capture/ui/ModePill";
import { OutlinePill } from "@/capture/ui/OutlinePill";
import { ModeScope } from "@/game/mode";
import type { Genre } from "@/lib/puzzle-types";
import { RESUME_ACTIONS, RESUME_COPY } from "@/screens/mode/copy";
import { modeThemes, ref } from "@/theme/tokens";
import type { CaseToContinue } from "./caseStatus";

export interface ResumeSheetProps {
  genre: Genre;
  target: CaseToContinue;
  /** Start a new case is checking access. */
  busy: boolean;
  onContinue: () => void;
  onStartNew: () => void;
  /** Close and the scrim: called once the sheet has slid away. */
  onClose: () => void;
}

/** The prompt's line, by what is waiting. */
export function resumeLine(genre: Genre, target: CaseToContinue): string {
  const copy = RESUME_COPY[genre];
  if (target.kind === "build") return copy.building;
  if (target.kind === "study") return copy.study ?? copy.inProgress;
  return copy.inProgress;
}

export function ResumeSheet({ genre, target, busy, onContinue, onStartNew, onClose }: ResumeSheetProps) {
  const theme = modeThemes[genre];
  return (
    <ModeScope genre={genre}>
      <DarkSheet
        title={theme.name}
        titleStyle="display"
        onClose={onClose}
        testID="hub-resume"
        closeTestID="hub-resume-close"
        footer={
          <>
            <ModePill variant="ghost" label={RESUME_ACTIONS.resume} onPress={onContinue} disabled={busy} testID="hub-resume-continue" />
            <OutlinePill label={RESUME_ACTIONS.fresh} onPress={onStartNew} busy={busy} testID="hub-resume-new" />
          </>
        }
      >
        <Text style={[styles.line, { color: theme.inkMuted }]} testID="hub-resume-line">
          {resumeLine(genre, target)}
        </Text>
      </DarkSheet>
    </ModeScope>
  );
}

const styles = StyleSheet.create({
  line: ref.type.subtitle,
});

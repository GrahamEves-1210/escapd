// Home's continue prompt (MODES_PROMPT.md Part 2, round 6): a mode card
// tapped while that mode has a case to go back to. The kit's DarkSheet over
// home, in the mode's colours (a ModeScope, so the sheet, its Close and its
// pills read the mode while home stays the shell): the case's name ("The
// Study"; a stand-in while it is still building) as the title in the mode's
// display face, the mode's name as the grey meta line under it, one short
// line in the mode's voice ("You've still got a case open."), what starting a
// new case does to this one, and the photo guide's two pills: Continue, the
// mode's primary (ModePill "ghost", its accent), and Start a new case, the
// guide's ghost pill in the mode's ground and rim (OutlinePill). While Start a
// new case checks access it shows the small spinner and Continue waits.
import { StyleSheet, Text, View } from "react-native";
import { DarkSheet } from "@/components/noir";
import { ModePill } from "@/capture/ui/ModePill";
import { OutlinePill } from "@/capture/ui/OutlinePill";
import { ModeScope } from "@/game/mode";
import type { Genre } from "@/lib/puzzle-types";
import { RESUME_ACTIONS, RESUME_COPY, RESUME_NEW_NOTE } from "@/screens/mode/copy";
import { modeThemes, ref } from "@/theme/tokens";
import type { CaseToContinue } from "./caseStatus";

export interface ResumeSheetProps {
  genre: Genre;
  target: CaseToContinue;
  /** Start a new case is checking access. */
  busy: boolean;
  /** Opens the case; true when it went (the sheet then slides away). */
  onContinue: () => boolean;
  /** Starts a new case; resolves true once its route has opened (the sheet then slides away). */
  onStartNew: () => Promise<boolean>;
  /** Close and the scrim: called once the sheet has slid away. */
  onClose: () => void;
}

/** The prompt's title: the case's name, or the mode's stand-in while it has none. */
export function resumeTitle(genre: Genre, target: CaseToContinue): string {
  return target.title ?? RESUME_COPY[genre].untitled;
}

/** The prompt's line, by what is waiting. */
export function resumeLine(genre: Genre, target: CaseToContinue): string {
  const copy = RESUME_COPY[genre];
  return target.kind === "build" ? copy.building : copy.inProgress;
}

export function ResumeSheet({ genre, target, busy, onContinue, onStartNew, onClose }: ResumeSheetProps) {
  const theme = modeThemes[genre];
  return (
    <ModeScope genre={genre}>
      <DarkSheet
        title={resumeTitle(genre, target)}
        titleStyle="display"
        meta={theme.name}
        onClose={onClose}
        testID="hub-resume"
        closeTestID="hub-resume-close"
        // Both slide the sheet away with its own close once their route opens, so it stays on top as it falls.
        footer={(close) => (
          <>
            <ModePill
              variant="ghost"
              label={RESUME_ACTIONS.resume}
              onPress={() => {
                if (onContinue()) close();
              }}
              disabled={busy}
              testID="hub-resume-continue"
            />
            <OutlinePill
              label={RESUME_ACTIONS.fresh}
              onPress={() => {
                onStartNew().then((went) => {
                  if (went) close();
                });
              }}
              busy={busy}
              testID="hub-resume-new"
            />
          </>
        )}
      >
        <View style={styles.words}>
          <Text style={[styles.line, { color: theme.inkMuted }]} testID="hub-resume-line">
            {resumeLine(genre, target)}
          </Text>
          <Text style={[styles.note, { color: theme.inkMuted }]} testID="hub-resume-note">
            {RESUME_NEW_NOTE}
          </Text>
        </View>
      </DarkSheet>
    </ModeScope>
  );
}

const styles = StyleSheet.create({
  words: { gap: ref.space.sm },
  line: ref.type.subtitle,
  note: ref.type.meta,
});

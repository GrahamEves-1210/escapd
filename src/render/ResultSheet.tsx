import { useEffect } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { GavelIcon } from "phosphor-react-native/src/icons/Gavel";
import { GhostIcon } from "phosphor-react-native/src/icons/Ghost";
import { UsersThreeIcon } from "phosphor-react-native/src/icons/UsersThree";
import type { InventoryItem } from "@/game/selectors";
import { useFeedback } from "@/game/feedback";
import { useModeTheme } from "@/game/mode";
import { DarkSheet, type NoirIcon } from "@/components/noir";
import { EyeIcon } from "@/components/icons";
import { ref } from "@/theme/tokens";
import { ModePill } from "@/capture/ui/ModePill";
import { EvidenceTag, NoteLine, Polaroid, TornNote, type Snapshot } from "./ClueObjects";
import { playVoice } from "./voice";

const P = ref.layout.play;

export interface ResultContent {
  title: string;
  /** Hotspot object_label (kept for callers; the reference look has one sheet for every object). */
  objectLabel?: string;
  eyebrow?: string;
  /** Narrative from submit_action (`message`). */
  message?: string;
  /** The hotspot's public description, for quiet results. */
  description?: string;
  /** Neutral copy for a `nothing` outcome. Never names a missing item. */
  quiet?: string;
  /** Items the server just granted (already in inventory). */
  gained: InventoryItem[];
  revealed: "none" | "here" | "elsewhere";
  /** Crime scene: suspects whose alibi this just broke (their names). */
  contradicted?: string[];
  /** Paranormal: this found an anomaly, so the presence rose. */
  presenceRose?: boolean;
  /** Crime scene: this was the last of the evidence, so the accusation is open. */
  accuseReady?: boolean;
  /** The object in the room this came from, shown as a polaroid of it. */
  snapshot?: Snapshot;
}

/**
 * What an object gave up, on the kit's dark sheet with a clear scrim, so the
 * scene stays visible above it, laid out as objects on a desk (GAME_FEEL_PROMPT.md,
 * 4): the title in 02's serif (a narrative moment); a polaroid of the object
 * beside the text, typed on a torn, lined note (the server's words as they
 * are); granted items as evidence tags (the name typed, the description in
 * small print); a reveal as 07's hint row (ink when it's in this view, muted
 * when it's in another); the photo guide's pill (the mode's accent) to go on.
 * Item descriptions are shown only for items the server granted. The `paper`
 * cue plays as it opens, `paperDelay` ms late after a solve's success haptic.
 */
export function ResultSheet({ content, onClose, paperDelay = 0 }: { content: ResultContent; onClose: () => void; paperDelay?: number }) {
  const theme = useModeTheme();
  const voice = playVoice(theme.genre);
  const feedback = useFeedback();
  const { fontScale } = useWindowDimensions();
  const slip = content.message || content.description || content.quiet;
  const stacked = fontScale > P.clue.stackScale;

  useEffect(() => {
    const t = setTimeout(() => feedback.paper(), paperDelay);
    return () => clearTimeout(t);
    // Once, as the clue opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const note = slip ? (
    <View style={stacked ? undefined : styles.flex}>
      <TornNote genre={theme.genre} seed={content.title} testID="result-text">
        {content.message ? <NoteLine genre={theme.genre} text={content.message} /> : null}
        {content.description ? <NoteLine genre={theme.genre} text={content.description} muted /> : null}
        {content.quiet ? <NoteLine genre={theme.genre} text={content.quiet} /> : null}
      </TornNote>
    </View>
  ) : null;
  return (
    <DarkSheet
      title={content.title}
      titleStyle="serif"
      meta={content.eyebrow}
      onClose={onClose}
      scrim={false}
      maxHeight="58%"
      testID="result-sheet"
      footer={(close) => (
        <ModePill
          variant="ghost"
          label={content.gained.length > 0 ? voice.pocket : voice.onward}
          onPress={close}
          testID="result-continue"
        />
      )}
    >
      {content.snapshot || note ? (
        <View style={[styles.desk, stacked ? styles.deskStacked : null]} testID="result-objects">
          {content.snapshot ? (
            <View style={stacked ? styles.polaroidStacked : undefined}>
              <Polaroid snapshot={content.snapshot} />
            </View>
          ) : null}
          {note}
        </View>
      ) : null}

      {content.gained.length > 0 ? (
        <View style={styles.section}>
          <Text style={[styles.heading, { color: theme.ink }]} accessibilityRole="header">{voice.pocketed}</Text>
          {content.gained.map((item) => <EvidenceTag key={item.id} item={item} genre={theme.genre} />)}
        </View>
      ) : null}

      {content.revealed !== "none" ? (
        <HintRow
          icon={EyeIcon}
          strong={content.revealed === "here"}
          text={content.revealed === "here" ? voice.revealedHere : voice.revealedElsewhere}
          testID="result-revealed"
        />
      ) : null}
      {content.contradicted?.map((name) => (
        <HintRow key={name} icon={UsersThreeIcon} strong tone="stamp" text={`Alibi broken: ${name}.`} testID="result-contradicted" />
      ))}
      {content.presenceRose ? (
        <HintRow icon={GhostIcon} strong tone="glow" text="The presence grows stronger." testID="result-presence" />
      ) : null}
      {content.accuseReady ? (
        <HintRow icon={GavelIcon} strong tone="stamp" text="Enough evidence to accuse. Open Suspects." testID="result-accuse-ready" />
      ) : null}
    </DarkSheet>
  );
}

/** 07's hint row: a glyph and a line; `strong` in ink, otherwise muted; `tone` gives the glyph the mode's stamp or glow. */
function HintRow({ icon: Icon, text, strong = false, tone, testID }: {
  icon: NoirIcon;
  text: string;
  strong?: boolean;
  tone?: "stamp" | "glow";
  testID?: string;
}) {
  const theme = useModeTheme();
  const textColor = strong ? theme.ink : theme.inkMuted;
  const glyph = tone === "stamp" ? theme.stamp : tone === "glow" ? theme.glow ?? textColor : textColor;
  return (
    <View style={styles.hint} testID={testID}>
      <View style={styles.hintIcon} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Icon size={P.card.icon} weight="regular" color={glyph} />
      </View>
      <Text style={[styles.hintText, { color: textColor }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  // The polaroid beside the note, both lying on the sheet; stacked at large text.
  desk: { flexDirection: "row", alignItems: "flex-start", gap: P.clue.gap, paddingVertical: ref.space.xs },
  deskStacked: { flexDirection: "column", alignItems: "stretch" },
  polaroidStacked: { alignSelf: "center" },
  section: { gap: P.card.gap },
  heading: { ...P.type.section, color: ref.color.textPrimary },
  hint: { flexDirection: "row", alignItems: "flex-start", gap: ref.space.sm },
  hintIcon: { height: P.type.hint.lineHeight, justifyContent: "center" },
  hintText: { ...P.type.hint, flexShrink: 1, color: ref.color.textSecondary },
});

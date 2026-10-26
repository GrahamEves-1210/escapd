import { StyleSheet, Text, View } from "react-native";
import { GavelIcon } from "phosphor-react-native/src/icons/Gavel";
import { GhostIcon } from "phosphor-react-native/src/icons/Ghost";
import { UsersThreeIcon } from "phosphor-react-native/src/icons/UsersThree";
import type { InventoryItem } from "@/game/selectors";
import { useModeTheme } from "@/game/mode";
import { DarkSheet, type NoirIcon } from "@/components/noir";
import { EyeIcon } from "@/components/icons";
import { ref } from "@/theme/tokens";
import { ItemIcon } from "./ItemIcon";
import { ModePill } from "@/capture/ui/ModePill";
import { Card } from "./parts";

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
}

/**
 * What an object gave up, on the kit's dark sheet with a clear scrim, so the
 * scene stays visible above it. The title in 02's serif (a narrative moment);
 * the text on 07's card; granted items as rows (a void well with the white
 * glyph, the name in Bold 16, the description grey); a reveal as 07's hint
 * row (white when it's in this view, grey when it's in another); the photo
 * guide's pill (the mode's accent) to go on. Item descriptions are shown only for items the server granted.
 */
export function ResultSheet({ content, onClose }: { content: ResultContent; onClose: () => void }) {
  const theme = useModeTheme();
  const slip = content.message || content.description || content.quiet;
  return (
    <DarkSheet
      title={content.title}
      titleStyle="serif"
      meta={content.eyebrow}
      onClose={onClose}
      scrim={false}
      maxHeight="58%"
      testID="result-sheet"
      footer={(
        <ModePill
          variant="ghost"
          label={content.gained.length > 0 ? "Pocket artifact" : "Continue"}
          onPress={onClose}
          testID="result-continue"
        />
      )}
    >
      {slip ? (
        <Card style={styles.slip} testID="result-text">
          {content.message ? <Text style={[styles.body, { color: theme.ink }]}>{content.message}</Text> : null}
          {content.description ? <Text style={[styles.detail, { color: theme.inkMuted }]}>{content.description}</Text> : null}
          {content.quiet ? <Text style={[styles.body, { color: theme.ink }]}>{content.quiet}</Text> : null}
        </Card>
      ) : null}

      {content.gained.length > 0 ? (
        <View style={styles.section}>
          <Text style={[styles.heading, { color: theme.ink }]} accessibilityRole="header">Added to your items</Text>
          {content.gained.map((item) => (
            <View key={item.id} style={styles.item} accessible accessibilityLabel={`${item.name}. ${item.description ?? ""}`}>
              <View style={styles.well}>
                <ItemIcon name={item.name} size={P.tray.icon} />
              </View>
              <View style={styles.itemText}>
                <Text style={[styles.itemName, { color: theme.ink }]}>{item.name}</Text>
                {item.description ? <Text style={[styles.detail, { color: theme.inkMuted }]}>{item.description}</Text> : null}
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {content.revealed !== "none" ? (
        <HintRow
          icon={EyeIcon}
          strong={content.revealed === "here"}
          text={content.revealed === "here" ? "Something new is within reach." : "Something changed on another view."}
          testID="result-revealed"
        />
      ) : null}
      {content.contradicted?.map((name) => (
        <HintRow key={name} icon={UsersThreeIcon} strong tone="stamp" text={`${name}'s alibi doesn't hold up.`} testID="result-contradicted" />
      ))}
      {content.presenceRose ? (
        <HintRow icon={GhostIcon} strong tone="glow" text="The presence grows stronger." testID="result-presence" />
      ) : null}
      {content.accuseReady ? (
        <HintRow icon={GavelIcon} strong tone="stamp" text="You have enough to accuse. Open Suspects." testID="result-accuse-ready" />
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
  slip: { gap: ref.space.sm },
  body: { ...P.type.body, color: ref.color.textPrimary },
  detail: { ...P.type.hint, color: ref.color.textSecondary },
  section: { gap: P.card.gap },
  heading: { ...P.type.section, color: ref.color.textPrimary },
  item: { flexDirection: "row", gap: P.card.gap, alignItems: "center" },
  well: {
    width: P.card.well,
    height: P.card.well,
    borderRadius: ref.radius.knob,
    ...ref.curve,
    backgroundColor: ref.color.void,
    alignItems: "center",
    justifyContent: "center",
  },
  itemText: { flex: 1, gap: ref.space.xs },
  itemName: { ...P.type.card, color: ref.color.textPrimary },
  hint: { flexDirection: "row", alignItems: "flex-start", gap: ref.space.sm },
  hintIcon: { height: P.type.hint.lineHeight, justifyContent: "center" },
  hintText: { ...P.type.hint, flexShrink: 1, color: ref.color.textSecondary },
});

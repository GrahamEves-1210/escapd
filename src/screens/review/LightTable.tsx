// The review screen (/capture/review, titled "Photos"), laid out as the
// reference's photo review (docs/refs/07-light-table.png) on the camera's
// dark palette: check the photos before the case is built. Nothing is
// uploaded until "Build the case". Photos keep their slots: removing one
// leaves an open tile in its place. When a build fails and sends the player
// back, ?flag=0:person,2:private_text marks those photos with their reasons
// until they are retaken (plain ?flag=0,2 from older builds reads as the
// general reason), and ?issue=too_few_objects (a failure about the whole set)
// shows its note at the top.
//
// Top to bottom: the header (Back, the title), "Your photos" and the count
// line, "Add a photo" (gone at MAX_PLATES), the photo grid, the retake hint,
// "Before you build" with its tips and the privacy note; then the pinned
// build bar. The
// column scrolls under the bar; text follows the system size.
import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { decodeFlags, decodeIssue, type RetakeReason } from "@/capture/failure";
import { getSlots, removePlate, usePlates, useSlots } from "@/capture/roll";
import { MAX_PLATES, MIN_PLATES } from "@/capture/slots";
import { ref } from "@/theme/tokens";
import { AddPlateButton } from "./AddPlateButton";
import { ChecksSection } from "./ChecksSection";
import { COPY } from "./copy";
import { DevelopFooter, type DevelopFooterProps } from "./DevelopFooter";
import { TapGlyph } from "./Glyphs";
import { NoteRow } from "./NoteRow";
import { PlateGrid } from "./PlateGrid";
import { ReviewHeader } from "./ReviewHeader";

const L = ref.layout.review;
const GAP = L.gap;

export function LightTable({ flag, issue: issueParam }: { flag?: string; issue?: string }) {
  const slots = useSlots();
  const plates = usePlates();
  const insets = useSafeAreaInsets();
  // Pin each flag to the photo in its slot at that moment (recomputed only
  // when the param changes), so a retaken photo loses its mark and a new
  // failure that returns here adds its marks.
  const marks = useMemo(() => {
    const byUri = new Map<string, RetakeReason>();
    for (const { slot, reason } of decodeFlags(flag)) {
      const uri = getSlots()[slot]?.uri;
      if (uri) byUri.set(uri, reason);
    }
    return byUri;
  }, [flag]);
  const issue = decodeIssue(issueParam);
  const stillFlagged = plates.some((p) => marks.has(p.uri));
  const blocked: DevelopFooterProps["blocked"] = stillFlagged
    ? { kind: "flagged" }
    : plates.length < MIN_PLATES
      ? { kind: "few", min: MIN_PLATES }
      : null;

  const back = () => (router.canGoBack() ? router.back() : router.replace("/capture"));
  const hasPlates = plates.length > 0;

  return (
    <View style={styles.root}>
      <ReviewHeader top={insets.top} onBack={back} />
      <ScrollView contentContainerStyle={styles.content} testID="review-scroll">
        {issue ? (
          <View style={styles.issue} testID="review-issue">
            <Text style={styles.issueText}>{COPY.issues[issue]}</Text>
          </View>
        ) : null}
        <Text accessibilityRole="header" style={styles.heading}>
          {COPY.heading}
        </Text>
        <Text style={styles.caption}>{COPY.caption(plates.length, MAX_PLATES)}</Text>
        {plates.length < MAX_PLATES ? <AddPlateButton onPress={() => router.push("/capture")} style={styles.add} /> : null}
        {hasPlates ? (
          <View style={styles.grid}>
            <PlateGrid
              slots={slots}
              marks={marks}
              onRetake={(slot) => router.push({ pathname: "/capture", params: { retake: String(slot) } })}
              onRemove={(slot) => removePlate(slot)}
            />
          </View>
        ) : null}
        {hasPlates ? <NoteRow glyph={<TapGlyph color={ref.color.textSecondary} />} text={COPY.hint} style={styles.hint} testID="retake-hint" /> : null}
        <ChecksSection style={hasPlates ? styles.checksAfterHint : styles.checks} />
      </ScrollView>
      <DevelopFooter bottom={insets.bottom} blocked={blocked} onDevelop={() => router.push("/capture/develop")} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ref.color.ground },
  content: { paddingTop: GAP.title, paddingBottom: GAP.end },
  heading: { ...L.type.title, color: ref.color.textPrimary, marginHorizontal: L.gutter },
  // A failure about the whole set: a calm raised note above the heading (no glyph, not amber).
  issue: {
    marginHorizontal: ref.space.edge,
    marginBottom: L.issue.gap,
    padding: L.issue.pad,
    borderRadius: L.issue.radius,
    backgroundColor: ref.color.raised,
    ...ref.curve,
  },
  issueText: { ...L.type.hint, color: ref.color.textPrimary },
  caption: { ...L.type.body, color: ref.color.textPrimary, marginLeft: L.gutter, marginRight: L.captionInsetEnd, marginTop: GAP.body },
  add: { marginTop: GAP.add },
  grid: { marginTop: GAP.grid },
  hint: { marginTop: GAP.hint },
  checks: { marginTop: GAP.add },
  checksAfterHint: { marginTop: GAP.section },
});

// The review screen (/capture/review, "Your photos"), in the language of the
// camera (02) and the photo guide (04) on either side of it: check the photos
// before the case is built. Nothing is uploaded until "Build the case".
// Photos keep their slots: removing one leaves an open tile in its place.
// When a build fails and sends the player back, ?flag=0:person,2:private_text
// marks those photos with their reasons until they are retaken (plain
// ?flag=0,2 from older builds reads as the general reason), and
// ?issue=too_few_objects (a failure about the whole set) shows its note at
// the top.
//
// Top to bottom: the camera's header (the square back button, the serif
// title "Your photos" over the grey count "4 of 5 photos", counted against the
// roll's plan: 5 on 0.5x, 6 on 1x); then a scrolling
// column: the whole-set note (if any), the lead line, the photos (02's last
// photo grown into 3:4 tiles, two to a row), the retake hint, "Add a photo"
// (the guide's ghost pill; gone once the plan's count is in), and "Before you build" with
// its tips and the privacy line; then the guide's pinned foot with "Build
// the case". The column slips under the foot and the header through soft
// fades of the page colour; text follows the system size.
//
// Inside a mode (openCapture({ genre }) sets it) the screen takes the mode's
// colours (src/capture/ui/palette.ts), as the camera and the guide do: its
// ground, raised discs and notes, ink, muted ink and lit numerals, "Build the
// case" as the mode's primary pill, and every photo in the mode's baked
// treatment (TreatedImage), so the player sees the room as the case will
// show it. The flagged amber stays.
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { decodeFlags, decodeIssue, type RetakeReason } from "@/capture/failure";
import { getSlots, removePlate, usePlates, useRollPlan, useSlots } from "@/capture/roll";
import { MIN_PLATES, platePrompts } from "@/capture/slots";
import { useCapturePalette } from "@/capture/ui/palette";
import { ref } from "@/theme/tokens";
import { AddPlateButton } from "./AddPlateButton";
import { COPY } from "./copy";
import { DevelopFooter, type DevelopFooterProps } from "./DevelopFooter";
import { TapGlyph } from "./Glyphs";
import { NoteRow } from "./NoteRow";
import { PageFade } from "./PageFade";
import { PlateGrid } from "./PlateGrid";
import { ReviewHeader } from "./ReviewHeader";

const L = ref.layout.review;
const GAP = L.gap;

export function LightTable({ flag, issue: issueParam }: { flag?: string; issue?: string }) {
  const slots = useSlots();
  const plates = usePlates();
  const plan = useRollPlan();
  const prompts = useMemo(() => platePrompts(plan.stops), [plan.stops]);
  const insets = useSafeAreaInsets();
  const palette = useCapturePalette();
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
  const [gridH, setGridH] = useState(0);
  // With none yet the lead says so, in place of the retake advice.
  const hasPlates = plates.length > 0;

  return (
    <View style={[styles.root, { backgroundColor: palette.page }]} testID="review-root">
      <ReviewHeader top={insets.top} count={plates.length} max={plan.shots} onBack={back} />
      <View style={styles.body}>
        {/* Everything on one screen: the photos shrink to the room left, nothing scrolls. */}
        <View style={styles.content} testID="review-scroll">
          {issue ? (
            <View style={[styles.issue, { backgroundColor: palette.raised }]} testID="review-issue">
              <Text style={[styles.issueText, { color: palette.ink }]}>{COPY.issues[issue]}</Text>
            </View>
          ) : null}
          <Text style={[styles.lead, { color: palette.inkMuted }]} testID="review-lead">
            {hasPlates ? COPY.lead : COPY.leadEmpty}
          </Text>
          {/* The retake hint right under the lead, by the photos it's about. */}
          {hasPlates ? <NoteRow glyph={<TapGlyph color={palette.inkMuted} />} text={COPY.hint} style={styles.hint} testID="retake-hint" /> : null}
          {hasPlates ? (
            <View style={styles.grid} onLayout={(e) => setGridH(e.nativeEvent.layout.height)}>
              {gridH > 0 ? (
                <PlateGrid
                  slots={slots}
                  prompts={prompts}
                  marks={marks}
                  fitHeight={gridH}
                  onRetake={(slot) => router.push({ pathname: "/capture", params: { retake: String(slot) } })}
                  onRemove={(slot) => removePlate(slot)}
                />
              ) : null}
            </View>
          ) : null}
          {plates.length < plan.shots ? <AddPlateButton onPress={() => router.push("/capture")} style={hasPlates ? styles.add : styles.addFirst} /> : null}
        </View>
        <PageFade color={palette.page} height={GAP.top} solidAt="top" style={styles.topFade} />
      </View>
      <DevelopFooter bottom={insets.bottom} blocked={blocked} onDevelop={() => router.push("/capture/develop")} />
    </View>
  );
}

const styles = StyleSheet.create({
  // The flat ground: the palette's page.
  root: { flex: 1 },
  body: { flex: 1 },
  content: { flex: 1, paddingTop: GAP.top, paddingBottom: ref.space.lg },
  topFade: { top: 0 },
  // A failure about the whole set: a calm raised note at the camera's nested corners (no glyph, not amber).
  issue: {
    marginHorizontal: ref.space.edge,
    marginBottom: GAP.issue,
    padding: L.issue.pad,
    borderRadius: ref.radius.nested,
    ...ref.curve,
  },
  issueText: { ...ref.type.subtitle },
  lead: { ...ref.type.subtitle, marginHorizontal: ref.space.edge },
  grid: { flex: 1, marginTop: GAP.lead },
  hint: { marginTop: GAP.hint, marginBottom: -GAP.hint },
  add: { marginTop: GAP.add },
  addFirst: { marginTop: GAP.lead },
});

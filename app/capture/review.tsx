// The light table: check the plates before they are developed. Nothing is
// uploaded until "Develop the case". With ?flag=0,2 (from a failed privacy
// check) those plates are marked until they are retaken.
import { useMemo } from "react";
import { ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { getPlates, removePlate, usePlates } from "@/capture/roll";
import { MAX_PLATES, MIN_PLATES, promptFor } from "@/capture/slots";
import { color, curve, hit, radius, space } from "@/theme/tokens";
import { Button } from "@/components/Button";
import { Grain } from "@/components/Grain";
import { IconButton } from "@/components/IconButton";
import { ArrowLeftIcon, ArrowsClockwiseIcon, ICON_SIZE, ICON_WEIGHT, TrashIcon } from "@/components/icons";
import { Text } from "@/components/Text";

const CHECKS = [
  "No people in any plate.",
  "No mail, documents, or lit screens someone could read.",
  "Lights on, nothing blurred.",
];

export default function LightTableScreen() {
  const { flag } = useLocalSearchParams<{ flag?: string }>();
  const plates = usePlates();
  const { width } = useWindowDimensions();
  // Pin each flag to the photo flagged at that moment (recomputed only when
  // the param changes), so a retaken plate loses its mark and a new failure
  // that returns here adds its marks.
  const flagged = useMemo(() => new Set(
    (flag ?? "").split(",").filter((s) => /^\d+$/.test(s.trim())).map((s) => getPlates()[Number(s)]?.uri).filter(Boolean),
  ), [flag]);
  const tile = (width - space.gutter * 2 - space.md) / 2;
  const stillFlagged = plates.some((p) => flagged.has(p.uri));
  const canDevelop = plates.length >= MIN_PLATES && !stillFlagged;

  const back = () => (router.canGoBack() ? router.back() : router.replace("/capture"));

  return (
    <View style={styles.root}>
      <Grain />
      <SafeAreaView style={styles.safe}>
        <View style={styles.topBar}>
          <IconButton
            accessibilityLabel="Back to the camera"
            icon={<ArrowLeftIcon size={ICON_SIZE} weight={ICON_WEIGHT} color={color.text} />}
            onPress={back}
          />
          <Text variant="stamp" tone="accent">LIGHT TABLE</Text>
          <View style={styles.topSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.heading}>
            <Text variant="narrativeTitle" accessibilityRole="header">Your plates</Text>
            <Text variant="caption" tone="secondary">
              {plates.length} of {MAX_PLATES}. Retake anything dark, blurred, or too close to read the room.
            </Text>
          </View>

          <View style={styles.grid}>
            {plates.map((plate, i) => {
              const marked = flagged.has(plate.uri);
              const numeral = promptFor(i).numeral;
              return (
                <View key={plate.uri} style={[styles.card, { width: tile }]}>
                  <View style={[styles.photo, { height: (tile * 4) / 3 }, marked && styles.photoFlagged]}>
                    <Image
                      source={{ uri: plate.uri }}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                      accessibilityLabel={`Plate ${numeral}`}
                    />
                  </View>
                  <View style={styles.cardRow}>
                    <View style={styles.cardLabel}>
                      <Text variant="stamp" tone={marked ? "error" : "accent"}>PLATE {numeral}</Text>
                      {marked ? <Text variant="caption" tone="error">Retake this plate</Text> : null}
                    </View>
                    <IconButton
                      accessibilityLabel={`Retake plate ${numeral}`}
                      icon={<ArrowsClockwiseIcon size={ICON_SIZE} weight={ICON_WEIGHT} color={color.text} />}
                      onPress={() => router.push({ pathname: "/capture", params: { retake: String(i) } })}
                    />
                    <IconButton
                      accessibilityLabel={`Remove plate ${numeral}`}
                      icon={<TrashIcon size={ICON_SIZE} weight={ICON_WEIGHT} color={color.textSecondary} />}
                      onPress={() => removePlate(i)}
                    />
                  </View>
                </View>
              );
            })}
            {plates.length < MAX_PLATES ? (
              <View style={[styles.addTile, { width: tile, height: (tile * 4) / 3 }]}>
                <Button label="Add a plate" variant="quiet" onPress={() => router.push("/capture")} />
              </View>
            ) : null}
          </View>

          <View style={styles.slip}>
            <Text variant="stamp" tone="ink">BEFORE YOU DEVELOP</Text>
            {CHECKS.map((line) => (
              <Text key={line} variant="caption" tone="ink">{`·  ${line}`}</Text>
            ))}
            <Text variant="caption" tone="ink">
              Plates are sent to ESCAPD and an AI model to build the case. They are never shared or shown to anyone else.
            </Text>
          </View>
        </ScrollView>

        <View style={styles.actions}>
          {stillFlagged ? (
            <Text variant="caption" tone="error" align="center">Retake the marked plates before developing.</Text>
          ) : plates.length < MIN_PLATES ? (
            <Text variant="caption" tone="secondary" align="center">A case needs at least {MIN_PLATES} plates.</Text>
          ) : null}
          <Button
            label="Develop the case"
            onPress={() => router.push("/capture/develop")}
            disabled={!canDevelop}
            testID="develop"
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.canvas },
  safe: { flex: 1, paddingHorizontal: space.gutter },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  topSpacer: { width: hit.min },
  content: { gap: space.xl, paddingVertical: space.lg },
  heading: { gap: space.xs },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  card: { gap: space.xs },
  photo: {
    borderRadius: radius.thumb,
    ...curve,
    overflow: "hidden",
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.rim,
  },
  photoFlagged: { borderWidth: 2, borderColor: color.wax },
  cardRow: { flexDirection: "row", alignItems: "center" },
  cardLabel: { flex: 1, gap: space.xxs },
  addTile: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.thumb,
    ...curve,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: color.hairline,
  },
  slip: {
    gap: space.xs,
    padding: space.lg,
    borderRadius: radius.slip,
    ...curve,
    backgroundColor: color.manila,
  },
  actions: { gap: space.sm, paddingBottom: space.xl, paddingTop: space.sm },
});

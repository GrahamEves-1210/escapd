import type { ReactNode } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { color, space } from "@/theme/tokens";
import { Button } from "./Button";
import { Grain } from "./Grain";
import { Text } from "./Text";

interface Action {
  label: string;
  onPress: () => void;
}

/** Full-screen calm state: loading, offline, error, or an unplayable definition. */
export function StateScreen({ title, body, icon, primary, secondary, loading }: {
  title: string;
  body?: string;
  icon?: ReactNode;
  primary?: Action;
  secondary?: Action;
  loading?: boolean;
}) {
  return (
    <SafeAreaView style={styles.root}>
      <Grain />
      <View style={styles.center} accessibilityLiveRegion="polite">
        {loading ? <ActivityIndicator color={color.accent} accessibilityLabel={title} /> : icon}
        <Text variant="sectionTitle" align="center">{title}</Text>
        {body ? <Text tone="secondary" align="center">{body}</Text> : null}
      </View>
      <View style={styles.actions}>
        {primary ? <Button label={primary.label} onPress={primary.onPress} /> : null}
        {secondary ? <Button label={secondary.label} variant="quiet" onPress={secondary.onPress} /> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.canvas, paddingHorizontal: space.gutter },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.md, paddingHorizontal: space.lg },
  actions: { gap: space.sm, paddingBottom: space.xl },
});

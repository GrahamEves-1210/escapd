// Turn a guest into a full account by confirming an email. Same user id, so
// tutorial progress and settings carry over. ?next=back returns to the screen
// that asked; any other value is a route to replace this one with.
// ?from=settings is Settings' Add your email; anything else came from
// starting or building a case (openCapture, the build step, /pro), so the
// screen says why it asks.
import { useCallback, useEffect, useState } from "react";
import { AppState, KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { EMAIL_PATTERN, errorDetail, linkEmailError } from "@/lib/account-errors";
import { currentSession, ensureSession, isNetworkError, linkEmail, refreshAccount } from "@/lib/escapd-api";
import { lastNonJsonResponse } from "@/lib/response-inspect";
import { color, curve, hit, radius, space, type } from "@/theme/tokens";
import { Button } from "@/components/Button";
import { Grain } from "@/components/Grain";
import { IconButton } from "@/components/IconButton";
import { ArrowLeftIcon, EnvelopeSimpleIcon, ICON_SIZE, ICON_WEIGHT } from "@/components/icons";
import { Text } from "@/components/Text";

/**
 * Where the confirmation link reopens the app. Always the app's own scheme,
 * never Linking.createURL(): in Expo Go that embeds the dev server's address
 * (exp://100.x.x.x:8081/--/…), and Supabase's Cloudflare firewall answers a
 * redirect_to holding such an address with a 403 HTML page before Auth sees
 * the request. In Expo Go this link won't reopen the app; the email still
 * confirms, and this screen notices when the player switches back.
 */
const CONFIRMATION_REDIRECT = "escapd://account/confirmed";

/** The real error plus whatever non-JSON response caused it, for development builds. */
function devDetail(error: unknown) {
  return [errorDetail(error), lastNonJsonResponse()].filter(Boolean).join("\n");
}

export default function AccountScreen() {
  const { next, from } = useLocalSearchParams<{ next?: string; from?: string }>();
  const forCase = from !== "settings";
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** The underlying error, shown only in development builds. */
  const [detail, setDetail] = useState<string | null>(null);

  const finish = useCallback(() => {
    if (next && next !== "back") router.replace(next as never);
    else if (router.canGoBack()) router.back();
    else router.replace("/");
  }, [next]);

  /** True once the server says this is no longer a guest. */
  const confirmed = useCallback(async () => {
    const user = await refreshAccount();
    return !!user && !user.is_anonymous;
  }, []);

  // Already a full account (e.g. confirmed on another visit): nothing to do.
  useEffect(() => {
    currentSession().then((session) => {
      if (session && !session.user.is_anonymous) finish();
    }, () => {});
  }, [finish]);

  // The player confirms in their mail app, then comes back: check by itself.
  const check = useCallback(async (manual: boolean) => {
    if (manual) {
      setBusy(true);
      setError(null);
      setDetail(null);
    }
    try {
      if (await confirmed()) return finish();
      if (manual) setError("Not confirmed yet. Open the link in the email, then come back.");
    } catch (e) {
      if (manual) {
        console.error("[account] checking the confirmation failed:", errorDetail(e), e);
        setError(isNetworkError(e) ? "You're offline. Connect, then try again." : "Couldn't check just now. Try again.");
        if (__DEV__) setDetail(devDetail(e));
      }
    } finally {
      if (manual) setBusy(false);
    }
  }, [confirmed, finish]);

  useEffect(() => {
    if (!sentTo) return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") check(false);
    });
    return () => sub.remove();
  }, [sentTo, check]);

  useFocusEffect(useCallback(() => {
    if (sentTo) check(false);
  }, [sentTo, check]));

  const send = async () => {
    const address = email.trim();
    if (!EMAIL_PATTERN.test(address)) {
      setError("Enter an email address like name@example.com.");
      return;
    }
    setBusy(true);
    setError(null);
    setDetail(null);
    try {
      await ensureSession();
      await linkEmail(address, CONFIRMATION_REDIRECT);
      setSentTo(address);
    } catch (e) {
      console.error("[account] adding the email failed:", errorDetail(e), e);
      setError(linkEmailError(e));
      if (__DEV__) setDetail(devDetail(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <Grain />
      <SafeAreaView style={styles.safe}>
        <View style={styles.topBar}>
          <IconButton
            accessibilityLabel="Back"
            icon={<ArrowLeftIcon size={ICON_SIZE} weight={ICON_WEIGHT} color={color.text} />}
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
          />
        </View>
        <KeyboardAvoidingView style={styles.body} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.center}>
            <EnvelopeSimpleIcon size={40} weight={ICON_WEIGHT} color={color.accent} />
            {sentTo ? (
              <>
                <Text variant="narrativeTitle" align="center" accessibilityRole="header">Check your email</Text>
                <Text tone="secondary" align="center">
                  {`We sent a link to ${sentTo}. Open it on this phone, then come back here.`}
                </Text>
              </>
            ) : (
              <>
                <Text variant="narrativeTitle" align="center" accessibilityRole="header">Add your email</Text>
                <Text tone="secondary" align="center">
                  {forCase
                    ? "Building a case from your own room needs an email on your account, so your photos and cases stay safe with it. We'll send one link to confirm the address."
                    : "Your cases and progress stay with this account. We'll send one link to confirm the address."}
                </Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  onSubmitEditing={send}
                  placeholder="name@example.com"
                  placeholderTextColor={color.textSecondary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  returnKeyType="send"
                  accessibilityLabel="Email address"
                  editable={!busy}
                  style={styles.input}
                  testID="email-input"
                />
              </>
            )}
            {error ? <Text variant="caption" tone="error" align="center" accessibilityLiveRegion="polite">{error}</Text> : null}
            {detail ? <Text variant="stamp" tone="secondary" align="center" selectable testID="error-detail">{detail}</Text> : null}
          </View>
          <View style={styles.actions}>
            {sentTo ? (
              <>
                <Button label="I've opened the link" onPress={() => check(true)} loading={busy} />
                <Button
                  label="Use a different email"
                  variant="quiet"
                  onPress={() => {
                    setSentTo(null);
                    setError(null);
                  }}
                />
              </>
            ) : (
              <Button label="Send the link" onPress={send} loading={busy} testID="send-link" />
            )}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.canvas },
  safe: { flex: 1, paddingHorizontal: space.gutter },
  topBar: { flexDirection: "row" },
  body: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.md },
  input: {
    ...type.body,
    alignSelf: "stretch",
    minHeight: hit.min,
    marginTop: space.md,
    paddingHorizontal: space.lg,
    color: color.text,
    backgroundColor: color.raised,
    borderWidth: 1,
    borderColor: color.hairline,
    borderRadius: radius.control,
    ...curve,
  },
  actions: { gap: space.sm, paddingBottom: space.xl },
});

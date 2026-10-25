// Where the confirmation email's link lands when it reopens the app. The
// account screen underneath re-checks on focus; this only refreshes the
// session and steps back to it.
import { useEffect } from "react";
import { router } from "expo-router";
import { refreshAccount } from "@/lib/escapd-api";
import { StateScreen } from "@/components/StateScreen";

export default function EmailConfirmedScreen() {
  useEffect(() => {
    refreshAccount()
      .catch(() => {})
      .finally(() => (router.canGoBack() ? router.back() : router.replace("/")));
  }, []);
  return <StateScreen title="Confirming your email" loading />;
}

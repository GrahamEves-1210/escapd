import { useEffect } from "react";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { PlayfairDisplay_400Regular } from "@expo-google-fonts/playfair-display/400Regular";
import { PlayfairDisplay_400Regular_Italic } from "@expo-google-fonts/playfair-display/400Regular_Italic";
import { PlayfairDisplay_600SemiBold } from "@expo-google-fonts/playfair-display/600SemiBold";
import { PlayfairDisplay_700Bold } from "@expo-google-fonts/playfair-display/700Bold";
import { PlayfairDisplay_900Black } from "@expo-google-fonts/playfair-display/900Black";
import { PlusJakartaSans_400Regular } from "@expo-google-fonts/plus-jakarta-sans/400Regular";
import { PlusJakartaSans_500Medium } from "@expo-google-fonts/plus-jakarta-sans/500Medium";
import { PlusJakartaSans_600SemiBold } from "@expo-google-fonts/plus-jakarta-sans/600SemiBold";
import { PlusJakartaSans_700Bold } from "@expo-google-fonts/plus-jakarta-sans/700Bold";
import { JetBrainsMono_500Medium } from "@expo-google-fonts/jetbrains-mono/500Medium";
import { JetBrainsMono_600SemiBold } from "@expo-google-fonts/jetbrains-mono/600SemiBold";
import { RobotoSerif_400Regular } from "@expo-google-fonts/roboto-serif/400Regular";
import { CrimsonText_400Regular_Italic } from "@expo-google-fonts/crimson-text/400Regular_Italic";
import { Archivo_800ExtraBold } from "@expo-google-fonts/archivo/800ExtraBold";
import { Fraunces_900Black } from "@expo-google-fonts/fraunces/900Black";
import { Fraunces_600SemiBold_Italic } from "@expo-google-fonts/fraunces/600SemiBold_Italic";
import { Fraunces_700Bold } from "@expo-google-fonts/fraunces/700Bold";
import { Fraunces_500Medium_Italic } from "@expo-google-fonts/fraunces/500Medium_Italic";
import { PatrickHand_400Regular } from "@expo-google-fonts/patrick-hand/400Regular";
import { CourierPrime_400Regular } from "@expo-google-fonts/courier-prime/400Regular";
import { CourierPrime_700Bold } from "@expo-google-fonts/courier-prime/700Bold";
import { PreferencesProvider, usePreferences } from "@/game/preferences";
import { Music } from "@/game/useMusic";
import { useSkiaReady } from "@/lib/skiaReady";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { color } from "@/theme/tokens";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [loaded, error] = useFonts({
    PlayfairDisplay_400Regular,
    PlayfairDisplay_400Regular_Italic,
    PlayfairDisplay_600SemiBold,
    PlayfairDisplay_700Bold,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    JetBrainsMono_500Medium,
    JetBrainsMono_600SemiBold,
    // The reference look's non-system faces (ref.font): the camera title and
    // counter, and the 03/05 sheet titles. Other text is the system font.
    RobotoSerif_400Regular,
    CrimsonText_400Regular_Italic,
    Archivo_800ExtraBold,
    // The modes' names (modeThemes[genre].display): each mode a book in a series.
    PlayfairDisplay_900Black,
    Fraunces_900Black,
    Fraunces_600SemiBold_Italic,
    // Book-cover titles and series lines (ref.font.cover, ref.font.coverItalic).
    Fraunces_700Bold,
    Fraunces_500Medium_Italic,
    // Handwriting for anything written in the world (ref.font.hand, theme.hand).
    PatrickHand_400Regular,
    // The play screen's typewriter face for game moments (ref.layout.play.type: notes, tags, the informant).
    CourierPrime_400Regular,
    CourierPrime_700Bold,
  });
  // Web only: mode photos are baked with Skia, whose CanvasKit loads first.
  // Native Skia is in the binary, so this is true at once and never waits.
  const skiaReady = useSkiaReady();

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync().catch(() => {});
  }, [loaded, error]);

  // If fonts fail to load, continue with system fonts rather than block play.
  if ((!loaded && !error) || !skiaReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: color.canvas }}>
      <PreferencesProvider>
        <ThemedStack />
      </PreferencesProvider>
    </GestureHandlerRootView>
  );
}

function ThemedStack() {
  const { reduced_motion } = usePreferences();
  return (
    <ThemeProvider reducedMotion={reduced_motion}>
      <StatusBar style="light" />
      {/* Once, here, so the music follows the active mode across every screen. */}
      <Music />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: color.canvas },
          animation: reduced_motion ? "none" : "fade",
        }}
      />
    </ThemeProvider>
  );
}

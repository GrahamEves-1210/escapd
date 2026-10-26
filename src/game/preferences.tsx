// Player preferences. Sound, haptics, hints and reduced motion live in the
// server's user_settings row. Hotspot assistance and the case clock are
// local-only preferences, so they need no migration.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import { getSettings, updateSettings, type UserSettings } from "@/lib/escapd-api";

const ASSIST_KEY = "escapd:pref:hotspot-assist";
const CLOCK_KEY = "escapd:pref:case-clock";

type ServerPrefs = Pick<UserSettings, "sound_enabled" | "music_enabled" | "haptics_enabled" | "hints_enabled" | "reduced_motion">;

const DEFAULTS: ServerPrefs = {
  sound_enabled: true,
  music_enabled: true,
  haptics_enabled: true,
  hints_enabled: true,
  reduced_motion: false,
};

interface Preferences extends ServerPrefs {
  /** Keep revealed hotspot brackets visible instead of fading them to corner marks. */
  hotspotAssist: boolean;
  setHotspotAssist: (on: boolean) => void;
  /** Show the case clock (time on this case) in the play screen's header. Off by default. */
  caseClock: boolean;
  setCaseClock: (on: boolean) => void;
  update: (patch: Partial<ServerPrefs>) => Promise<void>;
}

const PreferencesContext = createContext<Preferences>({
  ...DEFAULTS,
  hotspotAssist: false,
  setHotspotAssist: () => {},
  caseClock: false,
  setCaseClock: () => {},
  update: async () => {},
});

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [server, setServer] = useState<ServerPrefs>(DEFAULTS);
  const [hotspotAssist, setAssist] = useState(false);
  const [caseClock, setClock] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(ASSIST_KEY).then((v) => setAssist(v === "1")).catch(() => {});
    AsyncStorage.getItem(CLOCK_KEY).then((v) => setClock(v === "1")).catch(() => {});
  }, []);

  useEffect(() => {
    const load = () => getSettings().then((s) => setServer({
      sound_enabled: s.sound_enabled,
      music_enabled: s.music_enabled,
      haptics_enabled: s.haptics_enabled,
      hints_enabled: s.hints_enabled,
      reduced_motion: s.reduced_motion,
    })).catch(() => {});
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "INITIAL_SESSION" || event === "SIGNED_IN")) load();
      if (event === "SIGNED_OUT") setServer(DEFAULTS);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const setHotspotAssist = useCallback((on: boolean) => {
    setAssist(on);
    AsyncStorage.setItem(ASSIST_KEY, on ? "1" : "0").catch(() => {});
  }, []);

  const setCaseClock = useCallback((on: boolean) => {
    setClock(on);
    AsyncStorage.setItem(CLOCK_KEY, on ? "1" : "0").catch(() => {});
  }, []);

  const update = useCallback(async (patch: Partial<ServerPrefs>) => {
    setServer((s) => ({ ...s, ...patch }));
    await updateSettings(patch);
  }, []);

  const value = useMemo(
    () => ({ ...server, hotspotAssist, setHotspotAssist, caseClock, setCaseClock, update }),
    [server, hotspotAssist, setHotspotAssist, caseClock, setCaseClock, update],
  );
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  return useContext(PreferencesContext);
}

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useReducedMotion } from "react-native-reanimated";
import { tokens, type Tokens } from "./tokens";

interface Theme {
  tokens: Tokens;
  /** True when the OS or the player's ESCAPD setting asks for reduced motion. */
  reducedMotion: boolean;
}

const ThemeContext = createContext<Theme>({ tokens, reducedMotion: false });

export function ThemeProvider({ reducedMotion: userReducedMotion = false, children }: {
  reducedMotion?: boolean;
  children: ReactNode;
}) {
  const systemReducedMotion = useReducedMotion();
  const value = useMemo(
    () => ({ tokens, reducedMotion: systemReducedMotion || userReducedMotion }),
    [systemReducedMotion, userReducedMotion],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

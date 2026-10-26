// The case clock (GAME_FEEL_PROMPT.md, 4): time on this case, in the header,
// in the mono plate label. Off by default (usePreferences().caseClock). It
// counts from the session's own start (game_sessions.started_at, the same
// start the case-closed time uses), and keeps its own state, so its tick
// re-renders only itself, never the player.
import { memo, useEffect, useState } from "react";
import { StyleSheet, Text } from "react-native";
import { useModeTheme } from "@/game/mode";
import { ref } from "@/theme/tokens";

const P = ref.layout.play;

/** Elapsed time as a clock: "4:07", "12:30", "1:02:09". Negative time (a fast device clock) reads 0:00. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** Spoken: "On the case for 12 minutes 30 seconds". */
export function spokenClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const part = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;
  const parts = [h ? part(h, "hour") : "", m ? part(m, "minute") : "", !h ? part(s, "second") : ""].filter(Boolean);
  return `On the case for ${parts.join(" ")}`;
}

/** `since` is the case's start (epoch ms). */
export const CaseClock = memo(function CaseClock({ since }: { since: number }) {
  const theme = useModeTheme();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    // Ticks on the second boundary of the elapsed time, so the digits change evenly.
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const elapsed = Date.now() - since;
      const wait = P.clock.tick - (((elapsed % P.clock.tick) + P.clock.tick) % P.clock.tick);
      timer = setTimeout(() => {
        setNow(Date.now());
        schedule();
      }, wait || P.clock.tick);
    };
    schedule();
    return () => clearTimeout(timer);
  }, [since]);
  const elapsed = now - since;
  return (
    <Text
      accessibilityRole="timer"
      accessibilityLabel={spokenClock(elapsed)}
      style={[styles.clock, { color: theme.inkMuted }]}
      testID="case-clock"
    >
      {formatClock(elapsed)}
    </Text>
  );
});

const styles = StyleSheet.create({
  clock: { ...P.type.clock, textAlign: "center" },
});

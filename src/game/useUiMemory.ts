// Non-authoritative UI state that survives a restart: which view the player
// was looking at and which views they have visited. Progress itself always
// comes back from start_or_resume_session.
import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface UiMemory {
  sceneIndex: number;
  visited: number[];
}

const key = (roomId: string) => `escapd:ui:v1:${roomId}`;
const INITIAL: UiMemory = { sceneIndex: 0, visited: [0] };

export function useUiMemory(roomId: string) {
  const [memory, setMemory] = useState<UiMemory>(INITIAL);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(key(roomId))
      .then((raw) => {
        if (cancelled || !raw) return;
        const parsed = JSON.parse(raw) as Partial<UiMemory>;
        setMemory({
          sceneIndex: Number.isInteger(parsed.sceneIndex) ? parsed.sceneIndex! : 0,
          visited: Array.isArray(parsed.visited) ? parsed.visited : [0],
        });
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  const update = useCallback((patch: Partial<UiMemory>) => {
    setMemory((m) => {
      const next = { ...m, ...patch };
      AsyncStorage.setItem(key(roomId), JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, [roomId]);

  const reset = useCallback(() => {
    setMemory(INITIAL);
    AsyncStorage.removeItem(key(roomId)).catch(() => {});
  }, [roomId]);

  /** Forget the saved copy only, so the next visit starts fresh without moving the current view. */
  const forget = useCallback(() => {
    AsyncStorage.removeItem(key(roomId)).catch(() => {});
  }, [roomId]);

  return { memory, loaded, update, reset, forget };
}

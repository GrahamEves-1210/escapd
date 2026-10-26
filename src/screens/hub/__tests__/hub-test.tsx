/// <reference types="node" />
import fs from "fs";
import path from "path";
import ts from "typescript";
import { AccessibilityInfo, BackHandler, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { act, fireEvent, render, screen, userEvent, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
import { getMode, setMode } from "@/game/mode";
import * as api from "@/lib/escapd-api";
import { getOwnArt, setOwnArt } from "@/screens/mode/art";
import * as queries from "@/screens/mode/caseQueries";
import { introKey } from "@/screens/mode/introSeen";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { modeThemes, ref } from "@/theme/tokens";
import { HubScreen } from "../HubScreen";

jest.mock("expo-router", () => {
  const { useEffect } = jest.requireActual("react");
  return {
    router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
    // Focused for the whole test: runs on mount and whenever the callback changes.
    useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]),
  };
});

jest.mock("@/lib/escapd-api", () => ({
  isNetworkError: (e: unknown) => /network request failed/i.test(e instanceof Error ? e.message : ""),
  currentSession: jest.fn(),
  ensureSession: jest.fn(),
  getLatestSession: jest.fn(),
  getLatestCustomRoom: jest.fn(),
  listMyRooms: jest.fn(),
}));
jest.mock("@/screens/mode/caseQueries", () => ({ coverPhotos: jest.fn(), signCovers: jest.fn() }));
// The bake is TreatedImage's own business (its tests): here it only records what it was asked to show.
jest.mock("@/components/noir/TreatedImage", () => {
  const { createElement } = jest.requireActual("react");
  const { View } = jest.requireActual("react-native");
  return {
    TreatedImage: (props: Record<string, unknown>) =>
      createElement(View, { testID: props.testID, photo: { source: props.source, genre: props.genre, cacheKey: props.cacheKey, maxEdge: props.maxEdge } }),
  };
});
// So is drawing the covers (src/screens/hub/art's tests): here it records which mode's cover shows.
jest.mock("@/screens/hub/art/ModeCover", () => {
  const { createElement } = jest.requireActual("react");
  const { View } = jest.requireActual("react-native");
  return { ModeCover: (props: Record<string, unknown>) => createElement(View, { testID: props.testID, cover: { genre: props.genre } }) };
});
jest.mock("expo-constants", () => ({ __esModule: true, default: { expoConfig: { version: "0.1.0" } } }));
jest.mock("@/tutorial/assets", () => ({ TUTORIAL_ROOM_ID: "tutorial-room", BUNDLED_SCENES: { "tutorial/study_1.jpg": 101 } }));

const mockPreferences = {
  hotspotAssist: false,
  setHotspotAssist: jest.fn(),
  haptics_enabled: true,
  reduced_motion: false,
  update: jest.fn(async (_patch: Record<string, boolean>) => {}),
};
jest.mock("@/game/preferences", () => ({ usePreferences: () => ({ ...mockPreferences }) }));
// The full feedback vocabulary (a partial mock would crash a kit control that presses).
const mockFeedback = { tick: jest.fn(), tap: jest.fn(), press: jest.fn(), thud: jest.fn(), success: jest.fn(), warning: jest.fn(), error: jest.fn() };
jest.mock("@/game/feedback", () => ({ useFeedback: () => mockFeedback }));

const mocked = api as jest.Mocked<typeof api>;
const mockedQueries = queries as jest.Mocked<typeof queries>;
const push = jest.mocked(router.push);
const hidden = { includeHiddenElements: true } as const;
const ROOT = path.join(__dirname, "../../../..");
const H = ref.layout.hub;
const M = H.modes;

type Room = Awaited<ReturnType<typeof api.listMyRooms>>[number];
type Session = NonNullable<Awaited<ReturnType<typeof api.getLatestSession>>>;
const room = (id: string, genre: Room["genre"], status: Room["status"] = "ready") => ({ id, genre, status }) as Room;
const session = (status: Session["status"]) => ({ status }) as Session;

async function renderHub({ reducedMotion = false } = {}) {
  await render(
    <GestureHandlerRootView style={StyleSheet.absoluteFill}>
      <ThemeProvider reducedMotion={reducedMotion}>
        <HubScreen />
      </ThemeProvider>
    </GestureHandlerRootView>,
  );
  // Let the focus fetch settle.
  await act(async () => {});
}

/** A signed-in player with a tutorial session, rooms and (optionally) a newest room photo. */
function player({
  tutorial = null,
  rooms = [],
  latest = null,
  photo = null,
}: {
  tutorial?: Session | null;
  rooms?: Room[];
  latest?: Room | null;
  photo?: { roomId: string; id: string; uri: string } | null;
}) {
  mocked.currentSession.mockResolvedValue({} as Awaited<ReturnType<typeof api.currentSession>>);
  mocked.getLatestSession.mockResolvedValue(tutorial);
  mocked.listMyRooms.mockResolvedValue(rooms);
  mocked.getLatestCustomRoom.mockResolvedValue(latest ?? rooms[0] ?? null);
  mockedQueries.coverPhotos.mockResolvedValue(
    new Map(photo ? [[photo.roomId, { id: photo.id, room_id: photo.roomId, storage_path: `u/${photo.roomId}/a.jpg`, position: 0 }]] : []),
  );
  mockedQueries.signCovers.mockResolvedValue(new Map(photo ? [[photo.id, photo.uri]] : []));
}

beforeEach(async () => {
  jest.clearAllMocks();
  mockPreferences.hotspotAssist = false;
  mockPreferences.haptics_enabled = true;
  mockPreferences.reduced_motion = false;
  mockPreferences.update.mockImplementation(async () => {});
  mocked.ensureSession.mockResolvedValue({} as never);
  mocked.currentSession.mockResolvedValue(null);
  setOwnArt(null);
  setMode(null);
  await AsyncStorage.clear();
});

const card = (name: string) => screen.getByRole("button", { name });
const styleOf = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) ?? {};
/** Every drawn focus ring: the kit's 2 pt ring in ref.focus.color (brass), wherever it is composed. */
const focusRings = () =>
  screen.container.queryAll((node) => {
    const style = styleOf(node);
    return node.type === "View" && style.borderColor === ref.focus.color && style.borderWidth === ref.focus.width;
  });
/** What a card's TreatedImage was asked to show (undefined when it shows the drawn cover). */
const art = (genre: string) => screen.getByTestId(`hub-card-${genre}-art`, hidden).props.photo;
/** Which mode's drawn cover a card shows (undefined when it shows a photo). */
const cover = (genre: string) => screen.getByTestId(`hub-card-${genre}-art`, hidden).props.cover;

describe("01 · Home: three mode cards", () => {
  it("renders the header and the three mode cards in reading order, each one button named by mode, tagline and count", async () => {
    let resolveSession: (value: null) => void = () => {};
    mocked.currentSession.mockReturnValue(new Promise((resolve) => (resolveSession = resolve)));
    await render(
      <GestureHandlerRootView style={StyleSheet.absoluteFill}>
        <ThemeProvider>
          <HubScreen />
        </ThemeProvider>
      </GestureHandlerRootView>,
    );
    // The shell keeps its header: the ESCAPD wordmark, read as a header, and the Settings chip.
    expect(screen.getByRole("header", { name: "ESCAPD" }).props.testID).toBe("hub-logo");
    // The old hub is gone: no heading, no fan, no Study / Your room / Your case cards.
    expect(screen.queryByText("Choose a case")).toBeNull();
    expect(screen.queryByText(/THE STUDY|YOUR ROOM|YOUR CASE/, hidden)).toBeNull();
    // While the fetch runs, no count.
    expect(screen.getAllByRole("button").map((b) => b.props.accessibilityLabel)).toEqual([
      "Settings",
      "Detective Noir. Solve the case.",
      "Crime Scene. Find the killer.",
      "Paranormal. Face the unknown.",
    ]);
    expect(screen.queryByTestId("hub-card-noir-count")).toBeNull();

    // No stored session: never a guest just to count, and "No cases yet" everywhere.
    await act(async () => resolveSession(null));
    expect(card("Detective Noir. Solve the case. No cases yet")).toBeTruthy();
    expect(mocked.listMyRooms).not.toHaveBeenCalled();
    expect(mocked.ensureSession).not.toHaveBeenCalled();
  });

  it("counts each mode's cases and shows the count in a capsule at the top of its card", async () => {
    player({ rooms: [room("n1", "noir"), room("n2", "noir", "generating"), room("c1", "crime_scene", "failed")] });
    await renderHub();
    expect(card("Detective Noir. Solve the case. 2 cases")).toBeTruthy();
    expect(card("Crime Scene. Find the killer. 1 case")).toBeTruthy();
    expect(card("Paranormal. Face the unknown. No cases yet")).toBeTruthy();
    const chip = screen.getByTestId("hub-card-crime_scene-count", hidden);
    const theme = modeThemes.crime_scene;
    expect(styleOf(chip)).toMatchObject({ backgroundColor: theme.ground, borderColor: theme.rim, borderRadius: ref.radius.round });
    expect(styleOf(screen.getByText("1 case", hidden))).toMatchObject({ ...M.type.count, color: theme.ink });
  });

  it("draws each card solid in its mode's palette: the mode's surface and rim, its name in its display face, its tagline, and one signature touch", async () => {
    await renderHub();
    for (const genre of ["noir", "crime_scene", "paranormal"] as const) {
      const theme = modeThemes[genre];
      const face = screen.getByTestId(`hub-card-${genre}-face`, hidden);
      // Solid and physical: an opaque fill, a 1 pt rim, continuous corners, no glass.
      expect(styleOf(face)).toMatchObject({ backgroundColor: theme.surface, borderColor: theme.rim, borderWidth: M.rim, borderRadius: M.radius, overflow: "hidden" });
      expect(styleOf(screen.getByText(theme.name, hidden))).toMatchObject({ ...theme.display, color: theme.ink });
      expect(styleOf(screen.getByText(theme.tagline, hidden))).toMatchObject({ ...M.type.tagline, color: theme.ink });
      // The card stack fills the screen and scrolls when it can't: every card at least minHeight.
      expect(styleOf(screen.getByTestId(`hub-card-${genre}`))).toMatchObject({ minHeight: M.minHeight, flexGrow: 1 });
    }
    expect(styleOf(screen.getByTestId("hub-card-noir-rule", hidden))).toMatchObject({ backgroundColor: modeThemes.noir.accent, width: M.rule.width });
    expect(screen.getByTestId("hub-card-paranormal-glow", hidden)).toBeTruthy();
    // Crime scene's drawn cover tapes off its own door: no strip over it.
    expect(screen.queryByTestId("hub-card-crime_scene-tape", hidden)).toBeNull();
    expect(screen.queryAllByTestId(/-rule$|-tape$|-glow$/, hidden)).toHaveLength(2);
    await screen.unmount();

    // Over the player's own room, the strip of tape across the top-right corner.
    player({ rooms: [room("r1", "noir")], photo: { roomId: "r1", id: "p1", uri: "https://signed.example/p1.jpg" } });
    await renderHub();
    expect(styleOf(screen.getByTestId("hub-card-crime_scene-tape", hidden))).toMatchObject({ backgroundColor: modeThemes.crime_scene.detail });
    // Each signature appears only on its own card.
    expect(screen.queryAllByTestId(/-rule$|-tape$|-glow$/, hidden)).toHaveLength(3);
  });

  it("shows each mode's drawn cover until the player has photographed a room, then their newest room in each mode's treatment", async () => {
    await renderHub();
    // Each card's own mode's cover, and no photo (The Study's is no longer the default).
    for (const genre of ["noir", "crime_scene", "paranormal"]) {
      expect(cover(genre)).toEqual({ genre });
      expect(art(genre)).toBeUndefined();
    }
    await screen.unmount();

    // The newest room (a draft that was photographed but never sent counts too).
    player({
      rooms: [room("r2", "crime_scene")],
      latest: room("d1", "noir", "draft"),
      photo: { roomId: "d1", id: "p1", uri: "https://signed.example/p1.jpg" },
    });
    await renderHub();
    expect(mockedQueries.coverPhotos).toHaveBeenCalledWith(["d1", "r2"]);
    // Their own room in each mode's treatment, the bake keyed by the photo (its signed URL changes).
    for (const genre of ["noir", "crime_scene", "paranormal"]) {
      expect(art(genre)).toEqual({ source: { uri: "https://signed.example/p1.jpg" }, genre, cacheKey: "p1", maxEdge: M.artEdge });
      expect(cover(genre)).toBeUndefined();
    }
  });

  it("keeps the art as it was when the photo can't be read, and when a later fetch fails", async () => {
    player({ rooms: [room("r1", "noir")], photo: { roomId: "r1", id: "p1", uri: "https://signed.example/p1.jpg" } });
    await renderHub();
    expect(art("noir").source).toEqual({ uri: "https://signed.example/p1.jpg" });
    await screen.unmount();

    mockedQueries.coverPhotos.mockRejectedValue(new Error("Network request failed"));
    await renderHub();
    expect(art("noir").source).toEqual({ uri: "https://signed.example/p1.jpg" });
    expect(card("Detective Noir. Solve the case. 1 case")).toBeTruthy();
    await screen.unmount();

    mocked.listMyRooms.mockRejectedValue(new Error("Network request failed"));
    await renderHub();
    expect(card("Detective Noir. Solve the case.")).toBeTruthy();
    expect(art("noir").source).toEqual({ uri: "https://signed.example/p1.jpg" });
  });

  it("still hands the art to the mode screens when the player taps through before the fetch lands; an older fetch never replaces a newer one", async () => {
    // The first focus's photo read is slow; the player leaves home (a mode card) before it lands.
    player({ rooms: [room("r1", "noir")], photo: { roomId: "r1", id: "p1", uri: "https://signed.example/p1.jpg" } });
    let landFirst: (covers: Awaited<ReturnType<typeof queries.coverPhotos>>) => void = () => {};
    mockedQueries.coverPhotos.mockReturnValueOnce(new Promise((resolve) => (landFirst = resolve)));
    await renderHub();
    expect(getOwnArt()).toBeNull();
    await screen.unmount();
    // It lands on the mode screen: the banner shows the player's own room, not The Study.
    await act(async () => landFirst(new Map([["r1", { id: "p1", room_id: "r1", storage_path: "u/r1/a.jpg", position: 0 }]])));
    expect(getOwnArt()).toEqual({ id: "p1", uri: "https://signed.example/p1.jpg" });

    // A slow fetch from an earlier visit lands after a newer one: the newer photo stays.
    setOwnArt(null);
    let landOld: (covers: Awaited<ReturnType<typeof queries.coverPhotos>>) => void = () => {};
    mockedQueries.coverPhotos.mockReturnValueOnce(new Promise((resolve) => (landOld = resolve)));
    await renderHub();
    await screen.unmount();
    player({ rooms: [room("r2", "noir")], photo: { roomId: "r2", id: "p2", uri: "https://signed.example/p2.jpg" } });
    // Any photo signs, so the older fetch would have a photo to apply.
    mockedQueries.signCovers.mockImplementation(async (photos) => new Map(photos.map((p) => [p.id, `https://signed.example/${p.id}.jpg`])));
    await renderHub();
    expect(getOwnArt()).toEqual({ id: "p2", uri: "https://signed.example/p2.jpg" });
    expect(art("noir").source).toEqual({ uri: "https://signed.example/p2.jpg" });
    await act(async () => landOld(new Map([["r1", { id: "p1", room_id: "r1", storage_path: "u/r1/a.jpg", position: 0 }]])));
    expect(getOwnArt()?.id).toBe("p2");
    expect(art("noir").source).toEqual({ uri: "https://signed.example/p2.jpg" });
  });

  it("home is the shell: it clears the active mode when it gains focus", async () => {
    setMode("crime_scene");
    await renderHub();
    expect(getMode()).toBeNull();
  });

  it("Detective Noir: the first tap runs The Study while it has never been played, with the press haptic", async () => {
    player({ tutorial: null });
    await renderHub();
    await userEvent.setup().press(card("Detective Noir. Solve the case. No cases yet"));
    expect(mockFeedback.press).toHaveBeenCalledTimes(1);
    expect(mocked.ensureSession).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith("/tutorial");

    // An abandoned run unseals again, as the title screen did.
    push.mockClear();
    player({ tutorial: session("abandoned") });
    await screen.unmount();
    await renderHub();
    await fireEvent.press(card("Detective Noir. Solve the case. No cases yet"));
    await act(async () => {});
    expect(push).toHaveBeenCalledWith("/tutorial");
  });

  it("Detective Noir: once The Study has been played, the mode screen", async () => {
    for (const status of ["active", "completed"] as const) {
      push.mockClear();
      player({ tutorial: session(status) });
      await renderHub();
      await fireEvent.press(card("Detective Noir. Solve the case. No cases yet"));
      expect(push).toHaveBeenCalledWith({ pathname: "/mode/[genre]", params: { genre: "noir" } });
      expect(mocked.ensureSession).not.toHaveBeenCalled();
      await screen.unmount();
    }
  });

  it("Detective Noir: when the fetch couldn't say, it asks for The Study's session before choosing", async () => {
    player({ tutorial: session("completed") });
    mocked.listMyRooms.mockRejectedValue(new Error("boom"));
    await renderHub();
    await fireEvent.press(card("Detective Noir. Solve the case."));
    await act(async () => {});
    expect(mocked.getLatestSession).toHaveBeenLastCalledWith("tutorial-room");
    expect(push).toHaveBeenCalledWith({ pathname: "/mode/[genre]", params: { genre: "noir" } });
  });

  it("Detective Noir goes busy while it signs in: the others are disabled, an indicator replaces its count", async () => {
    let finish: () => void = () => {};
    mocked.ensureSession.mockReturnValue(new Promise((resolve) => (finish = () => resolve({} as never))));
    await renderHub();
    await fireEvent.press(card("Detective Noir. Solve the case. No cases yet"));
    expect(card("Detective Noir. Solve the case. No cases yet").props.accessibilityState).toMatchObject({ busy: true, disabled: true });
    expect(screen.getByTestId("hub-card-crime_scene").props.accessibilityState).toMatchObject({ disabled: true });
    expect(styleOf(screen.getByTestId("hub-card-crime_scene")).opacity).toBe(ref.button.disabledOpacity.pill);
    expect(screen.getByRole("button", { name: "Settings" }).props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.getByTestId("hub-card-noir-busy", hidden).props.color).toBe(modeThemes.noir.ink);
    // A second tap does nothing.
    await userEvent.setup().press(card("Detective Noir. Solve the case. No cases yet"));
    expect(mocked.ensureSession).toHaveBeenCalledTimes(1);

    await act(async () => finish());
    expect(push).toHaveBeenCalledWith("/tutorial");
    expect(card("Detective Noir. Solve the case. No cases yet").props.accessibilityState).toMatchObject({ busy: false });
  });

  it("shows the offline notice when The Study can't start, and the next card tap clears it", async () => {
    mocked.ensureSession.mockRejectedValue(new Error("Network request failed"));
    await renderHub();
    await fireEvent.press(card("Detective Noir. Solve the case. No cases yet"));
    await act(async () => {});
    const notice = screen.getByTestId("hub-notice");
    expect(notice.props.accessibilityLabel).toBe("You're offline. Connect to begin.");
    expect(screen.getByTestId("hub-notice-slot").props.accessibilityLiveRegion).toBe("polite");
    expect(styleOf(notice)).toMatchObject({ backgroundColor: ref.color.ground, borderColor: ref.color.rim, borderRadius: ref.radius.round });
    expect(push).not.toHaveBeenCalled();

    mocked.ensureSession.mockRejectedValue(new Error("boom"));
    await fireEvent.press(card("Detective Noir. Solve the case. No cases yet"));
    await act(async () => {});
    expect(screen.getByTestId("hub-notice").props.accessibilityLabel).toBe("Couldn't start the case. Try again in a moment.");

    await fireEvent.press(card("Paranormal. Face the unknown. No cases yet"));
    await act(async () => {});
    expect(screen.queryByTestId("hub-notice")).toBeNull();
  });

  it("Crime Scene and Paranormal open their one-screen intro the first time, then go straight to the mode", async () => {
    await renderHub();
    await fireEvent.press(card("Crime Scene. Find the killer. No cases yet"));
    await act(async () => {});
    expect(push).toHaveBeenLastCalledWith({ pathname: "/mode/intro/[genre]", params: { genre: "crime_scene" } });
    await fireEvent.press(card("Paranormal. Face the unknown. No cases yet"));
    await act(async () => {});
    expect(push).toHaveBeenLastCalledWith({ pathname: "/mode/intro/[genre]", params: { genre: "paranormal" } });

    // Start on the intro stores the flag per mode.
    await AsyncStorage.setItem(introKey("crime_scene"), "1");
    await fireEvent.press(card("Crime Scene. Find the killer. No cases yet"));
    await act(async () => {});
    expect(push).toHaveBeenLastCalledWith({ pathname: "/mode/[genre]", params: { genre: "crime_scene" } });
    await fireEvent.press(card("Paranormal. Face the unknown. No cases yet"));
    await act(async () => {});
    expect(push).toHaveBeenLastCalledWith({ pathname: "/mode/intro/[genre]", params: { genre: "paranormal" } });
  });

  it("keeps the mode's ink at 4.5:1 over even a white photo, on the plate behind the words", () => {
    const channel = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
    const linear = (c: number) => {
      const s = c / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    const luminance = (rgb: number[]) => 0.2126 * linear(rgb[0]) + 0.7152 * linear(rgb[1]) + 0.0722 * linear(rgb[2]);
    const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    // The plate's last fade stop is the plate itself, so there is no edge.
    expect(M.fadeStops[M.fadeStops.length - 1].opacity).toBe(M.plate);
    for (const theme of Object.values(modeThemes)) {
      const over = [0, 1, 2].map((i) => channel(theme.ground, i) * M.plate + 255 * (1 - M.plate));
      const ink = [0, 1, 2].map((i) => channel(theme.ink, i));
      expect({ mode: theme.name, ratio: contrast(luminance(ink), luminance(over)) >= 4.5 }).toEqual({ mode: theme.name, ratio: true });
    }
  });
});

describe("01 · Home: Settings", () => {
  it("Settings: grouped rows that work, on the kit's dark sheet, with a white-track black-thumb switch (no aqua)", async () => {
    await renderHub();
    await fireEvent.press(screen.getByRole("button", { name: "Settings" }));
    expect(screen.getByRole("header", { name: "Settings" })).toBeTruthy();
    expect(styleOf(screen.getByTestId("hub-sheet"))).toMatchObject({
      backgroundColor: ref.color.ground,
      borderTopLeftRadius: ref.radius.bottomSheet,
      borderColor: ref.color.rim,
    });
    for (const name of ["Gameplay", "Accessibility", "Account", "About"]) {
      expect(styleOf(screen.getByRole("header", { name }))).toMatchObject({ ...H.settings.heading, color: ref.color.textPrimary });
    }
    const interactives = screen.getByRole("switch", { name: "Show interactives" });
    expect(interactives.props.accessibilityState).toMatchObject({ checked: false });
    expect(styleOf(interactives).minHeight).toBe(H.settings.rowHeight);
    // The switch: a white track and a black thumb when on.
    expect(H.sheet.switch).toEqual({ on: ref.color.textPrimary, off: ref.color.textTertiary, thumb: ref.color.void });
    expect(screen.getByTestId("hub-show-interactives-switch", hidden).props).toMatchObject({
      value: false,
      onTintColor: H.sheet.switch.on,
      tintColor: H.sheet.switch.off,
      thumbTintColor: H.sheet.switch.thumb,
    });
    expect(screen.getByRole("switch", { name: "Haptics" }).props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByRole("switch", { name: "Reduce motion" }).props.accessibilityState).toMatchObject({ checked: false });
    expect(screen.getByRole("button", { name: "Add your email" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "ESCAPD Pro" })).toBeTruthy();
    expect(screen.getByLabelText(/^Version, \S+/)).toBeTruthy();

    await fireEvent.press(interactives);
    expect(mockPreferences.setHotspotAssist).toHaveBeenCalledWith(true);
    expect(mockFeedback.tick).toHaveBeenCalledTimes(1);

    // Close slides the sheet away, then it unmounts.
    await fireEvent.press(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByTestId("hub-sheet")).toBeNull());
  });

  it("Settings saves Haptics and Reduce motion to the account, showing the new value at once, and flips back calmly if saving fails", async () => {
    await renderHub();
    await fireEvent.press(screen.getByRole("button", { name: "Settings" }));

    await fireEvent.press(screen.getByRole("switch", { name: "Reduce motion" }));
    await act(async () => {});
    expect(mockFeedback.tick).toHaveBeenCalledTimes(1);
    expect(mocked.ensureSession).toHaveBeenCalledTimes(1);
    expect(mockPreferences.update).toHaveBeenCalledWith({ reduced_motion: true });

    mockFeedback.tick.mockClear();
    await fireEvent.press(screen.getByRole("switch", { name: "Haptics" }));
    await act(async () => {});
    expect(mockPreferences.update).toHaveBeenCalledWith({ haptics_enabled: false });
    expect(mockFeedback.tick).not.toHaveBeenCalled();

    let fail: (error: Error) => void = () => {};
    mocked.ensureSession.mockReturnValueOnce(new Promise((_resolve, reject) => (fail = reject)));
    const motionRow = () => screen.getByRole("switch", { name: "Reduce motion" });
    await fireEvent.press(motionRow());
    expect(motionRow().props.accessibilityState).toMatchObject({ checked: true });
    await act(async () => fail(new Error("Network request failed")));
    expect(motionRow().props.accessibilityState).toMatchObject({ checked: false });
    expect(mockPreferences.update).toHaveBeenLastCalledWith({ reduced_motion: false });
    expect(screen.getByText("Couldn't save that while offline. It's back as it was.")).toBeTruthy();
  });

  it("Settings: Haptics ticks once just after it turns on, and not as it turns off", async () => {
    mockPreferences.haptics_enabled = false;
    mockPreferences.update.mockImplementation(async (patch: Record<string, boolean>) => {
      Object.assign(mockPreferences, patch);
    });
    await renderHub();
    await fireEvent.press(screen.getByRole("button", { name: "Settings" }));
    await fireEvent.press(screen.getByRole("switch", { name: "Haptics" }));
    await act(async () => {});
    expect(mockPreferences.update).toHaveBeenCalledWith({ haptics_enabled: true });
    expect(mockFeedback.tick).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByRole("switch", { name: "Haptics" }));
    await act(async () => {});
    expect(mockPreferences.update).toHaveBeenLastCalledWith({ haptics_enabled: false });
    expect(mockFeedback.tick).toHaveBeenCalledTimes(1);
  });

  it("Settings' account rows: Add your email for a guest, the email when signed in, and ESCAPD Pro", async () => {
    await renderHub();
    await fireEvent.press(screen.getByRole("button", { name: "Settings" }));
    await userEvent.setup().press(screen.getByRole("button", { name: "Add your email" }));
    expect(mockFeedback.press).toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith({ pathname: "/account", params: { next: "back" } });
    expect(screen.queryByTestId("hub-sheet")).toBeNull();

    await fireEvent.press(screen.getByRole("button", { name: "Settings" }));
    await fireEvent.press(screen.getByRole("button", { name: "ESCAPD Pro" }));
    expect(push).toHaveBeenCalledWith("/pro");
    await screen.unmount();

    mocked.currentSession.mockResolvedValue({ user: { email: "ada@example.com", is_anonymous: false } } as never);
    mocked.getLatestSession.mockResolvedValue(null);
    mocked.listMyRooms.mockResolvedValue([]);
    mocked.getLatestCustomRoom.mockResolvedValue(null);
    await renderHub();
    await fireEvent.press(screen.getByRole("button", { name: "Settings" }));
    await act(async () => {});
    expect(screen.getByLabelText("Email, ada@example.com")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Add your email" })).toBeNull();
  });

  it("draws Settings as Opal's chip, with the press haptic and one brass focus ring round its disc", async () => {
    await renderHub();
    const help = screen.getByRole("button", { name: "Settings" });
    expect(styleOf(help)).toMatchObject({ width: ref.button.chip.hit, height: ref.button.chip.hit });
    const disc = help.queryAll((node) => node.type === "View" && styleOf(node).backgroundColor === ref.button.chip.fill);
    expect(disc).toHaveLength(1);
    await fireEvent(help, "pressIn");
    expect(mockFeedback.press).toHaveBeenCalledTimes(1);

    expect(focusRings()).toHaveLength(0);
    await fireEvent(help, "focus");
    const rings = focusRings();
    expect(rings).toHaveLength(1);
    expect(disc[0].queryAll((node) => node === rings[0])).toHaveLength(1);
    await fireEvent(help, "blur");
    expect(focusRings()).toHaveLength(0);
  });

  it("draws one brass focus ring round a focused mode card, concentric with its corners", async () => {
    await renderHub();
    const noir = screen.getByTestId("hub-card-noir");
    await fireEvent(noir, "focus");
    const rings = focusRings();
    expect(rings).toHaveLength(1);
    expect(noir.queryAll((node) => node === rings[0])).toHaveLength(1);
    expect(styleOf(rings[0]).borderRadius).toBeGreaterThan(M.radius);
  });

  it("Android back closes the sheet first, swallows a busy card, and otherwise leaves the app", async () => {
    type BackListener = Parameters<typeof BackHandler.addEventListener>[1];
    const handlers: BackListener[] = [];
    const add = jest.spyOn(BackHandler, "addEventListener").mockImplementation((_event, handler) => {
      handlers.push(handler);
      return { remove: () => handlers.splice(handlers.indexOf(handler), 1) };
    });
    const back = () => handlers[handlers.length - 1]({} as Parameters<BackListener>[0]);

    mocked.ensureSession.mockReturnValue(new Promise(() => {}));
    await renderHub();
    expect(back()).toBe(false);

    await fireEvent.press(screen.getByRole("button", { name: "Settings" }));
    let handled: boolean | null | undefined;
    await act(async () => {
      handled = back();
    });
    expect(handled).toBe(true);
    expect(screen.queryByTestId("hub-sheet")).toBeNull();

    await fireEvent.press(card("Detective Noir. Solve the case. No cases yet"));
    expect(back()).toBe(true);
    add.mockRestore();
  });

  it("returns focus to Settings once the sheet has left, never while it is still leaving", async () => {
    const focus = jest.spyOn(AccessibilityInfo, "sendAccessibilityEvent").mockImplementation(() => {});
    await renderHub();
    const help = screen.getByRole("button", { name: "Settings" });
    const helpFocus = () =>
      focus.mock.calls.filter(
        ([target, type]) => (target as unknown as { props?: { testID?: string } }).props?.testID === "hub-settings" && type === "focus",
      ).length;
    const waitOutExit = () => act(() => new Promise((resolve) => setTimeout(resolve, ref.motion.sheetFall.duration + H.sheet.focusMargin + 50)));

    await fireEvent.press(help);
    await fireEvent.press(screen.getByRole("button", { name: "Close" }));
    expect(helpFocus()).toBe(0);
    await waitOutExit();
    expect(helpFocus()).toBe(1);

    focus.mockClear();
    await fireEvent.press(help);
    await fireEvent.press(screen.getByRole("button", { name: "Close" }));
    await fireEvent.press(help);
    await fireEvent.press(screen.getByRole("button", { name: "ESCAPD Pro" }));
    await waitOutExit();
    expect(helpFocus()).toBe(0);
    focus.mockRestore();
  });
});

describe("01 · Home and the mode screens: tokens only", () => {
  const sources = () => {
    const dirs = ["src/screens/hub", "src/screens/mode"].map((d) => path.join(ROOT, d));
    const files = [path.join(ROOT, "app/index.tsx"), path.join(ROOT, "app/mode/[genre].tsx"), path.join(ROOT, "app/mode/intro/[genre].tsx")];
    for (const dir of dirs) files.push(...fs.readdirSync(dir).filter((f) => /\.tsx?$/.test(f)).map((f) => path.join(dir, f)));
    return files;
  };

  it("uses only tokens and mode themes: no colours, fonts or numbers in the screens' source, and no old hub pieces", () => {
    const files = sources();
    expect(files.length).toBeGreaterThan(10);
    for (const file of files) {
      const source = fs.readFileSync(file, "utf8");
      expect({ file, hex: source.match(/#[0-9a-f]{3,8}\b/gi) }).toEqual({ file, hex: null });
      expect({ file, rgb: source.match(/rgba?\(/g) }).toEqual({ file, rgb: null });
      expect({ file, font: source.match(/fontFamily\s*[:=]\s*["']/g) }).toEqual({ file, font: null });
      // ref, motion and the mode themes only: never the live theme's colours.
      const tokens = source.match(/import \{([^}]*)\} from "@\/theme\/tokens"/)?.[1].split(",").map((s) => s.trim()).filter(Boolean) ?? [];
      expect({ file, live: tokens.filter((t) => !["motion", "ref", "modeThemes", "type ModeTheme"].includes(t)) }).toEqual({ file, live: [] });
      // No fan, glass, mint art, floor glow or grain; no live-look components.
      expect({
        file,
        old: source.match(/FloorGlow|CardGlass|CardArt|GameCard|\bFan\b|CardStack|\bGrain\b|lineStart|lineEnd|glowOlive|glowTeal|bottomGlow|@\/components\/(Text|Sheet|Button|IconButton)"/g),
      }).toEqual({ file, old: null });
      if (!file.endsWith(".tsx")) continue;
      // Screen code: no raw numbers beyond 0, 1 and 2 as arithmetic.
      const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const numbers: string[] = [];
      const visit = (node: ts.Node) => {
        if (ts.isNumericLiteral(node) && !["0", "1", "2"].includes(node.text)) numbers.push(node.text);
        ts.forEachChild(node, visit);
      };
      visit(ast);
      expect({ file, numbers }).toEqual({ file, numbers: [] });
    }
  });

  it("the old fan, card, glass and art files are gone", () => {
    for (const gone of ["Deck.tsx", "GameCard.tsx", "CardGlass.tsx", "CardArt.tsx", "layout.ts", "TagPill.tsx", "CardNote.tsx"]) {
      expect(fs.existsSync(path.join(ROOT, "src/screens/hub", gone))).toBe(false);
    }
    // Home's own tokens: no fan, glass or stack geometry left.
    expect(Object.keys(H)).not.toEqual(expect.arrayContaining(["fan"]));
    for (const key of ["fan", "glass", "card", "weights", "band", "stackedMinHeight"]) expect(H).not.toHaveProperty(key);
  });
});

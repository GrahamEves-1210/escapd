/// <reference types="node" />
import { AccessibilityInfo, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native";
import { router } from "expo-router";
import { getAnimatedStyle } from "react-native-reanimated";
import { openCapture } from "@/capture/openCapture";
import { getMode, setMode } from "@/game/mode";
import * as api from "@/lib/escapd-api";
import type { Genre, MyAccess } from "@/lib/puzzle-types";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { modeThemes, ref } from "@/theme/tokens";
import { setOwnArt } from "../art";
import * as queries from "../caseQueries";
import { introKey } from "../introSeen";
import { ModeIntro } from "../ModeIntro";
import { ModeScreen } from "../ModeScreen";
import { resetModeCache } from "../useModeCases";

jest.mock("expo-router", () => {
  const { useEffect } = jest.requireActual("react");
  return {
    router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
    useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]),
  };
});
jest.mock("@/lib/escapd-api", () => ({
  isNetworkError: (e: unknown) => /network request failed/i.test(e instanceof Error ? e.message : ""),
  currentSession: jest.fn(),
  ensureSession: jest.fn(),
  getLatestSession: jest.fn(),
  getMyAccess: jest.fn(),
  getRoom: jest.fn(),
  listMyRooms: jest.fn(),
  watchRoom: jest.fn(),
}));
jest.mock("../caseQueries", () => ({ latestSessionStatuses: jest.fn(), coverPhotos: jest.fn(), signCovers: jest.fn() }));
jest.mock("@/capture/openCapture", () => ({ openCapture: jest.fn() }));
jest.mock("@/capture/useDevelopment", () => ({ POLL_MS: 5000 }));
jest.mock("@/tutorial/assets", () => ({ TUTORIAL_ROOM_ID: "tutorial-room", BUNDLED_SCENES: { "tutorial/study_1.jpg": 101 } }));
jest.mock("@/components/noir/TreatedImage", () => {
  const { createElement } = jest.requireActual("react");
  const { View } = jest.requireActual("react-native");
  return {
    TreatedImage: (props: Record<string, unknown>) =>
      createElement(View, { testID: props.testID, photo: { source: props.source, genre: props.genre, cacheKey: props.cacheKey, maxEdge: props.maxEdge } }),
  };
});
const mockFeedback = { tick: jest.fn(), tap: jest.fn(), press: jest.fn(), thud: jest.fn(), success: jest.fn(), warning: jest.fn(), error: jest.fn() };
jest.mock("@/game/feedback", () => ({ useFeedback: () => mockFeedback }));

const mocked = api as jest.Mocked<typeof api>;
const mockedQueries = queries as jest.Mocked<typeof queries>;
const capture = jest.mocked(openCapture);
const push = jest.mocked(router.push);
const hidden = { includeHiddenElements: true } as const;
const L = ref.layout.mode;
const styleOf = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) ?? {};

type Room = Awaited<ReturnType<typeof api.listMyRooms>>[number];
const room = (id: string, status: Room["status"], title: string, created_at: string, genre: Genre = "crime_scene") =>
  ({ id, status, title, created_at, genre }) as Room;
const access = (pro: boolean) => ({ has_custom_rooms_entitlement: pro, is_anonymous: false }) as MyAccess;

/** A signed-in player with these rooms, latest sessions and cover photos. */
function player({
  rooms = [],
  sessions = {},
  covers = [],
  pro = true,
  study = null,
}: {
  rooms?: Room[];
  sessions?: Record<string, "active" | "completed" | "abandoned">;
  covers?: string[];
  pro?: boolean;
  study?: "active" | "completed" | "abandoned" | null;
}) {
  mocked.currentSession.mockResolvedValue({} as Awaited<ReturnType<typeof api.currentSession>>);
  mocked.listMyRooms.mockResolvedValue(rooms);
  mocked.getMyAccess.mockResolvedValue(access(pro));
  mocked.getLatestSession.mockResolvedValue(study ? ({ status: study } as never) : null);
  mockedQueries.latestSessionStatuses.mockResolvedValue(new Map(Object.entries(sessions)));
  mockedQueries.coverPhotos.mockResolvedValue(new Map(covers.map((id) => [id, { id: `p-${id}`, room_id: id, storage_path: `u/${id}/a.jpg`, position: 0 }])));
  mockedQueries.signCovers.mockImplementation(async (photos) => new Map(photos.map((p) => [p.id, `https://signed.example/${p.id}.jpg`])));
}

async function renderMode(genre: Genre, { reducedMotion = false } = {}) {
  await render(
    <GestureHandlerRootView style={StyleSheet.absoluteFill}>
      <ThemeProvider reducedMotion={reducedMotion}>
        <ModeScreen genre={genre} />
      </ThemeProvider>
    </GestureHandlerRootView>,
  );
  await act(async () => {});
}

async function renderIntro(genre: "crime_scene" | "paranormal") {
  await render(
    <GestureHandlerRootView style={StyleSheet.absoluteFill}>
      <ThemeProvider>
        <ModeIntro genre={genre} />
      </ThemeProvider>
    </GestureHandlerRootView>,
  );
  await act(async () => {});
}

beforeEach(async () => {
  jest.clearAllMocks();
  resetModeCache();
  setOwnArt(null);
  setMode(null);
  jest.mocked(router.canGoBack).mockReturnValue(true);
  mocked.currentSession.mockResolvedValue(null);
  mocked.ensureSession.mockResolvedValue({} as never);
  mocked.watchRoom.mockReturnValue(() => Promise.resolve("ok"));
  capture.mockResolvedValue("guide");
  await AsyncStorage.clear();
});

const button = (name: string | RegExp) => screen.getByRole("button", { name });
const animatedStyleOf = getAnimatedStyle as unknown as (node: unknown) => { opacity?: number };
/** The buttons and headings in tree order, which is reading and focus order, by name. */
const readingOrder = () =>
  screen.container
    .queryAll((node) => typeof node.type === "string" && ["button", "header"].includes(node.props.accessibilityRole))
    .map((node) => node.props.accessibilityLabel ?? String(node.props.children));
/** Scrolls a mode screen's list to `y`. */
const scrollTo = (testID: string, y: number) =>
  fireEvent.scroll(screen.getByTestId(testID), { nativeEvent: { contentOffset: { x: 0, y }, contentSize: { width: 393, height: 1600 }, layoutMeasurement: { width: 393, height: 852 } } });

describe("A mode's screen", () => {
  it("is all in the mode's palette: the ground, the camera's back square, the name in its display face and the tagline; and it sets the mode", async () => {
    await renderMode("crime_scene");
    const theme = modeThemes.crime_scene;
    expect(getMode()).toBe("crime_scene");
    expect(styleOf(screen.getByTestId("mode-screen"))).toMatchObject({ backgroundColor: theme.ground });
    const back = button("Back");
    expect(styleOf(back)).toMatchObject({
      width: ref.button.square.size,
      height: ref.button.square.size,
      borderRadius: ref.button.square.radius,
      backgroundColor: theme.raised,
      borderColor: theme.rim,
    });
    expect(styleOf(screen.getByRole("header", { name: "Crime Scene" }))).toMatchObject({ ...theme.display, color: theme.ink });
    expect(styleOf(screen.getByText("Find the killer"))).toMatchObject({ ...L.type.tagline, color: theme.inkMuted });
    // The banner: the mode's art baked in the mode, decorative.
    expect(screen.getByTestId("mode-banner-art", hidden).props.photo).toMatchObject({ source: 101, genre: "crime_scene" });
    expect(screen.getByTestId("mode-banner", hidden).props.accessibilityElementsHidden).toBe(true);
  });

  it("goes back, or home when there is nothing to go back to, with the press haptic", async () => {
    await renderMode("noir");
    await userEvent.setup().press(button("Back"));
    expect(mockFeedback.press).toHaveBeenCalledTimes(1);
    expect(router.back).toHaveBeenCalledTimes(1);
    jest.mocked(router.canGoBack).mockReturnValue(false);
    await fireEvent.press(button("Back"));
    expect(router.replace).toHaveBeenCalledWith("/");
  });

  it("reads Back first, then the name, the cases, The Study and New case", async () => {
    player({ rooms: [room("r1", "ready", "The Locked Room", "2026-10-24T18:00:00Z", "noir")] });
    await renderMode("noir");
    expect(readingOrder()).toEqual([
      "Back",
      modeThemes.noir.name,
      "Your cases",
      expect.stringMatching(/^The Locked Room\. /),
      "The first case",
      expect.stringMatching(/^The Study\. /),
      "New case",
    ]);
  });

  it("backs the status bar and the back square in the ground once the list scrolls under them; clear at rest, on the art", async () => {
    const theme = modeThemes.crime_scene;
    await renderMode("crime_scene");
    // Over the list (zIndex), its backing decorative and in the mode's ground, down to under the square.
    expect(styleOf(screen.getByTestId("mode-header"))).toMatchObject({ position: "absolute", top: 0, left: 0, right: 0, zIndex: 1 });
    const backing = screen.getByTestId("mode-header-backing", hidden);
    expect(backing.props.accessibilityElementsHidden).toBe(true);
    expect(backing.props.pointerEvents).toBe("none");
    expect(styleOf(screen.getByTestId("mode-header-ground", hidden))).toMatchObject({
      backgroundColor: theme.ground,
      height: L.top + ref.button.square.size + L.header.below,
    });
    // At rest the square sits on the banner; the backing is solid by the time the banner's foot reaches it.
    const covered = L.banner - (L.top + ref.button.square.size + L.header.below);
    expect(animatedStyleOf(backing).opacity).toBe(0);
    await act(async () => scrollTo("mode-scroll", covered - L.header.fade));
    expect(animatedStyleOf(screen.getByTestId("mode-header-backing", hidden)).opacity).toBe(0);
    await act(async () => scrollTo("mode-scroll", covered - L.header.fade / 2));
    expect(animatedStyleOf(screen.getByTestId("mode-header-backing", hidden)).opacity).toBeCloseTo(0.5);
    await act(async () => scrollTo("mode-scroll", covered + 400));
    expect(animatedStyleOf(screen.getByTestId("mode-header-backing", hidden)).opacity).toBe(1);
    // The square stays put, `top` below the safe top.
    expect(button("Back")).toBeTruthy();
  });

  it("lists the player's cases in the mode as case files with OPEN, IN PROGRESS, CLOSED, BUILDING and DIDN'T BUILD stamps, in one batch", async () => {
    player({
      rooms: [
        room("r1", "ready", "Death at the Dinner Party", "2026-10-24T18:00:00Z"),
        room("r2", "ready", "The Locked Room", "2026-10-20T18:00:00Z"),
        room("r3", "ready", "The Inheritance", "2026-10-18T18:00:00Z"),
        room("r4", "ready", "A Business Partner", "2026-10-16T18:00:00Z"),
        room("r5", "generating", "", "2026-10-26T18:00:00Z"),
        room("r6", "queued", "", "2026-10-26T17:00:00Z"),
        room("r7", "failed", "", "2026-10-23T18:00:00Z"),
      ],
      sessions: { r1: "active", r2: "completed", r3: "abandoned" },
      covers: ["r1", "r2", "r5"],
    });
    await renderMode("crime_scene");
    expect(mocked.listMyRooms).toHaveBeenCalledWith({ genre: "crime_scene" });
    // One query for every ready room's latest session, one for the covers.
    expect(mockedQueries.latestSessionStatuses).toHaveBeenCalledTimes(1);
    expect(mockedQueries.latestSessionStatuses).toHaveBeenCalledWith(["r1", "r2", "r3", "r4"]);
    expect(mockedQueries.coverPhotos).toHaveBeenCalledWith(["r1", "r2", "r3", "r4", "r5", "r6", "r7"]);

    const stampOf = (id: string) => screen.getByTestId(`mode-case-${id}-stamp`, hidden);
    const words = (id: string) => screen.getByTestId(`mode-case-${id}-stamp`, hidden).children[0] as never as { props: { children: string } };
    expect(["r1", "r2", "r3", "r4", "r5", "r6", "r7"].map((id) => words(id).props.children)).toEqual([
      "In progress",
      "Closed",
      "Open",
      "Open",
      "Building",
      "Building",
      "Didn't build",
    ]);
    // Rubber stamps: the mode's stamp colour, caps in Archivo ExtraBold, at an angle; CLOSED inked solid; BUILDING muted and dashed.
    const theme = modeThemes.crime_scene;
    expect(styleOf(stampOf("r1"))).toMatchObject({ borderColor: theme.stamp, borderWidth: L.stamp.border, transform: [{ rotate: L.stamp.angle }] });
    expect(styleOf(screen.getByText("In progress", hidden))).toMatchObject({ ...L.stamp.type, color: theme.stamp });
    expect(styleOf(stampOf("r2"))).toMatchObject({ backgroundColor: theme.stamp });
    expect(styleOf(screen.getByText("Closed", hidden))).toMatchObject({ color: theme.surface });
    expect(styleOf(stampOf("r5"))).toMatchObject({ borderColor: theme.inkMuted, borderStyle: "dashed" });

    // Each file is one button: title, date, stamp; a failed one says what a tap does.
    expect(button(/^Death at the Dinner Party\. .+\. In progress\.$/)).toBeTruthy();
    expect(button(/^Untitled case\. .+\. Didn't build\. See why\.$/)).toBeTruthy();
    const file = screen.getByTestId("mode-case-r1");
    expect(styleOf(file)).toMatchObject({ backgroundColor: theme.surface, borderColor: theme.rim, minHeight: L.file.minHeight });
    // A treated thumbnail of the room's photo, its bake keyed by the photo; none without a photo.
    expect(screen.getByTestId("mode-case-r1-thumb", hidden).props.photo).toEqual({
      source: { uri: "https://signed.example/p-r1.jpg" },
      genre: "crime_scene",
      cacheKey: "p-r1",
      maxEdge: L.file.thumbEdge,
    });
    expect(screen.queryByTestId("mode-case-r3-thumb", hidden)).toBeNull();
  });

  it("opens a ready case in the player, and follows a building or failed one", async () => {
    player({
      rooms: [room("r1", "ready", "A", "2026-10-24T18:00:00Z"), room("r5", "generating", "", "2026-10-26T18:00:00Z"), room("r7", "failed", "", "2026-10-23T18:00:00Z")],
    });
    await renderMode("crime_scene");
    await userEvent.setup().press(screen.getByTestId("mode-case-r1"));
    expect(mockFeedback.press).toHaveBeenCalled();
    expect(push).toHaveBeenLastCalledWith({ pathname: "/play/[roomId]", params: { roomId: "r1" } });
    await fireEvent.press(screen.getByTestId("mode-case-r5"));
    expect(push).toHaveBeenLastCalledWith({ pathname: "/capture/develop", params: { roomId: "r5" } });
    await fireEvent.press(screen.getByTestId("mode-case-r7"));
    expect(push).toHaveBeenLastCalledWith({ pathname: "/capture/develop", params: { roomId: "r7" } });
  });

  it("New case is the mode's primary bar and runs openCapture with the mode; it carries on to /capture when the check can't run", async () => {
    player({});
    await renderMode("paranormal");
    const theme = modeThemes.paranormal;
    const bar = button("New case");
    expect(styleOf(bar)).toMatchObject({ backgroundColor: theme.accent, minHeight: L.bar.height, borderRadius: L.bar.radius });
    expect(styleOf(screen.getByText("New case"))).toMatchObject({ ...L.type.action, color: theme.accentInk });
    expect(screen.queryByTestId("mode-new-case-lock", hidden)).toBeNull();

    let finish: () => void = () => {};
    capture.mockReturnValueOnce(new Promise((resolve) => (finish = () => resolve("guide"))));
    await userEvent.setup().press(bar);
    expect(capture).toHaveBeenCalledWith({ genre: "paranormal", signal: expect.any(AbortSignal) });
    expect(button("New case").props.accessibilityState).toMatchObject({ busy: true });
    expect(screen.getByTestId("mode-new-case-busy", hidden).props.color).toBe(theme.accentInk);
    await act(async () => finish());
    expect(button("New case").props.accessibilityState).toMatchObject({ busy: false });
    expect(push).not.toHaveBeenCalled();

    capture.mockRejectedValueOnce(new Error("Network request failed"));
    await fireEvent.press(button("New case"));
    await act(async () => {});
    expect(push).toHaveBeenCalledWith("/capture");
  });

  it("shows the Pro lock on New case without Pro (a glyph and \"Pro\"), and the tap still goes through openCapture", async () => {
    player({ pro: false });
    await renderMode("crime_scene");
    const bar = button("New case. Pro");
    expect(bar.props.accessibilityHint).toBe("Needs ESCAPD Pro.");
    const lock = screen.getByTestId("mode-new-case-lock", hidden);
    expect(styleOf(lock)).toMatchObject({ borderColor: modeThemes.crime_scene.accentInk, borderRadius: ref.radius.round });
    expect(screen.getByText("Pro", hidden)).toBeTruthy();
    await fireEvent.press(bar);
    expect(capture).toHaveBeenCalledWith({ genre: "crime_scene", signal: expect.any(AbortSignal) });
    await screen.unmount();

    // No account yet: no Pro either, and no guest is made to find out.
    resetModeCache();
    mocked.getMyAccess.mockClear();
    mocked.currentSession.mockResolvedValue(null);
    await renderMode("crime_scene");
    expect(button("New case. Pro")).toBeTruthy();
    expect(mocked.getMyAccess).not.toHaveBeenCalled();
    expect(mocked.ensureSession).not.toHaveBeenCalled();
  });

  it("Detective Noir keeps The Study as a case file to replay; the other modes don't", async () => {
    player({ study: "completed" });
    await renderMode("noir");
    expect(screen.getByRole("header", { name: "The first case" })).toBeTruthy();
    const study = button("The Study. Closed. Replay The Study.");
    expect(screen.getByText("Replay The Study", hidden)).toBeTruthy();
    expect(screen.getByTestId("mode-study-thumb", hidden).props.photo).toMatchObject({ source: 101, genre: "noir" });
    await fireEvent.press(study);
    await act(async () => {});
    expect(mocked.ensureSession).toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/tutorial");
    await screen.unmount();

    player({ study: "active" });
    await renderMode("noir");
    expect(button("The Study. In progress. Continue The Study.")).toBeTruthy();
    await screen.unmount();

    player({});
    await renderMode("paranormal");
    expect(screen.queryByTestId("mode-study")).toBeNull();
  });

  it("The Study says so when it can't start", async () => {
    player({ study: "completed" });
    mocked.ensureSession.mockRejectedValue(new Error("Network request failed"));
    await renderMode("noir");
    await fireEvent.press(button("The Study. Closed. Replay The Study."));
    await act(async () => {});
    expect(screen.getByTestId("mode-notice").props.accessibilityLabel).toBe("You're offline. Connect to begin.");
    expect(screen.getByTestId("mode-notice-slot").props.accessibilityLiveRegion).toBe("polite");
    expect(push).not.toHaveBeenCalled();
  });

  it("shows a friendly empty state in an empty file's outline, with New case still there", async () => {
    player({});
    await renderMode("paranormal");
    const empty = screen.getByTestId("mode-empty");
    expect(screen.getByText("No cases yet. Photograph a room and something moves in.")).toBeTruthy();
    expect(styleOf(empty)).toMatchObject({ borderStyle: "dashed", borderColor: modeThemes.paranormal.inkMuted, minHeight: L.file.minHeight });
    expect(button("New case")).toBeTruthy();
  });

  it("says when the cases can't load, with Try again; a list already shown stays through a failed refresh", async () => {
    player({});
    mocked.listMyRooms.mockRejectedValue(new Error("Network request failed"));
    await renderMode("crime_scene");
    expect(screen.getByText("You're offline. Your cases show when you connect.")).toBeTruthy();
    mocked.listMyRooms.mockResolvedValue([room("r1", "ready", "The Locked Room", "2026-10-20T18:00:00Z")]);
    await userEvent.setup().press(button("Try again"));
    await act(async () => {});
    expect(screen.getByTestId("mode-case-r1")).toBeTruthy();
    expect(screen.queryByTestId("mode-error")).toBeNull();
    await screen.unmount();

    // Coming back: the last list shows at once; a failed refresh keeps it.
    mocked.listMyRooms.mockRejectedValue(new Error("permission denied"));
    await renderMode("crime_scene");
    expect(screen.getByTestId("mode-case-r1")).toBeTruthy();
    expect(screen.queryByTestId("mode-error")).toBeNull();
  });

  it("follows a building case and announces the flip, then reloads the list", async () => {
    const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility");
    let onStatus: (status: string) => void = () => {};
    mocked.watchRoom.mockImplementation((_id, onChange) => {
      onStatus = onChange;
      return () => Promise.resolve("ok");
    });
    player({ rooms: [room("r5", "generating", "", "2026-10-26T18:00:00Z")] });
    await renderMode("crime_scene");
    expect(mocked.watchRoom).toHaveBeenCalledWith("r5", expect.any(Function));
    expect(announce).not.toHaveBeenCalled();

    mocked.listMyRooms.mockResolvedValue([room("r5", "ready", "The Locked Room", "2026-10-26T18:00:00Z")]);
    await act(async () => onStatus("ready"));
    expect(announce).toHaveBeenCalledWith("Your case is ready.");
    expect(button(/^The Locked Room\. .+\. Open\.$/)).toBeTruthy();
  });
});

describe("A mode's first-time intro", () => {
  it("crime scene: the mode's name, three steps (evidence, alibis, accuse) and Start, in the mode's palette", async () => {
    await renderIntro("crime_scene");
    const theme = modeThemes.crime_scene;
    expect(getMode()).toBe("crime_scene");
    expect(styleOf(screen.getByTestId("mode-intro"))).toMatchObject({ backgroundColor: theme.ground });
    expect(screen.getByText("How this mode works")).toBeTruthy();
    expect(styleOf(screen.getByRole("header", { name: "Crime Scene" }))).toMatchObject({ ...theme.display, color: theme.ink });
    expect([1, 2, 3].map((n) => screen.getByTestId(`mode-intro-step-${n}`).props.accessibilityLabel)).toEqual([
      "Step 1 of 3. Find the evidence. Search the room. Each clue can break a suspect's story.",
      "Step 2 of 3. Read the alibis. Open Suspects to see who says what, and whose alibi no longer holds.",
      "Step 3 of 3. Accuse who, why and how. Name the killer, the motive and the method. A wrong guess costs you time.",
    ]);
    // Arabic numerals in the mode's display face, in its stamp colour.
    expect(styleOf(screen.getByText("1", hidden))).toMatchObject({ fontFamily: theme.display.fontFamily, color: theme.stamp });
    expect(styleOf(button("Start"))).toMatchObject({ backgroundColor: theme.accent });
  });

  it("paranormal: find the anomalies, watch the presence rise, banish it in the right order", async () => {
    await renderIntro("paranormal");
    expect(screen.getByText("Find the anomalies")).toBeTruthy();
    expect(screen.getByText("Watch the presence rise")).toBeTruthy();
    expect(screen.getByText("Banish it in the right order")).toBeTruthy();
  });

  it("reads Back first, then the name, the steps and Start; the header backs the top once the steps scroll under it", async () => {
    await renderIntro("paranormal");
    expect(readingOrder()).toEqual(["Back", modeThemes.paranormal.name, "Start"]);
    const steps = screen.getAllByLabelText(/^Step \d of 3\./).map((node) => node.props.testID);
    expect(steps).toEqual(["mode-intro-step-1", "mode-intro-step-2", "mode-intro-step-3"]);
    // Back before the first step in the tree.
    const tree = screen.container.queryAll((node) => typeof node.type === "string" && (node.props.testID === "mode-intro-back" || node.props.testID === "mode-intro-step-1"));
    expect(tree.map((node) => node.props.testID)).toEqual(["mode-intro-back", "mode-intro-step-1"]);
    expect(animatedStyleOf(screen.getByTestId("mode-header-backing", hidden)).opacity).toBe(0);
    await act(async () => scrollTo("mode-intro-scroll", L.banner));
    expect(animatedStyleOf(screen.getByTestId("mode-header-backing", hidden)).opacity).toBe(1);
  });

  it("Start remembers it for this mode only and replaces itself with the mode's screen; Back leaves without remembering", async () => {
    await renderIntro("paranormal");
    await fireEvent.press(button("Back"));
    expect(router.back).toHaveBeenCalled();
    expect(await AsyncStorage.getItem(introKey("paranormal"))).toBeNull();

    await fireEvent.press(button("Start"));
    await act(async () => {});
    expect(await AsyncStorage.getItem(introKey("paranormal"))).toBe("1");
    expect(await AsyncStorage.getItem(introKey("crime_scene"))).toBeNull();
    expect(router.replace).toHaveBeenCalledWith({ pathname: "/mode/[genre]", params: { genre: "paranormal" } });
  });
});

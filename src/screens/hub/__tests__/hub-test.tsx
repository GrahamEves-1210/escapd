/// <reference types="node" />
import fs from "fs";
import path from "path";
import ts from "typescript";
import { AccessibilityInfo, BackHandler, Dimensions, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { act, fireEvent, render, screen, userEvent, waitFor, within } from "@testing-library/react-native";
import { router } from "expo-router";
import { openCapture } from "@/capture/openCapture";
import { getMode, setMode } from "@/game/mode";
import * as api from "@/lib/escapd-api";
import { introKey } from "@/screens/mode/introSeen";
import { introHref } from "@/screens/mode/routes";
import { RESUME_COPY, SERIES } from "@/screens/mode/copy";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { modeThemes, ref, shellTheme } from "@/theme/tokens";
import { COVER, DECK_SHARE, SETTINGS } from "../art/nook";
import { deckLayout, deckTilt } from "../deck";
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
  // Home never reads it (nor any photo): mocked only to prove that.
  getLatestCustomRoom: jest.fn(),
  listMyRooms: jest.fn(),
}));
jest.mock("@/capture/openCapture", () => ({ openCapture: jest.fn() }));
// The bake is TreatedImage's own business (its tests): here it only records what it was asked to show,
// so a room photo anywhere on home would show up as a `photo` prop.
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
// The window (its rain, candle and fairy lights on a Skia canvas) is drawn, not tested, here: only its geometry is used.
jest.mock("../WindowBackdrop", () => ({ ...jest.requireActual("../WindowBackdrop"), WindowBackdrop: () => null }));
jest.mock("expo-constants", () => ({ __esModule: true, default: { expoConfig: { version: "0.1.0" } } }));

const mockPreferences = {
  hotspotAssist: false,
  setHotspotAssist: jest.fn(),
  haptics_enabled: true,
  sound_enabled: true,
  music_enabled: true,
  reduced_motion: false,
  update: jest.fn(async (_patch: Record<string, boolean>) => {}),
};
jest.mock("@/game/preferences", () => ({ usePreferences: () => ({ ...mockPreferences }) }));
// The full feedback vocabulary (a partial mock would crash a kit control that presses).
const mockFeedback = { tick: jest.fn(), tap: jest.fn(), press: jest.fn(), thud: jest.fn(), success: jest.fn(), warning: jest.fn(), error: jest.fn() };
jest.mock("@/game/feedback", () => ({ useFeedback: () => mockFeedback }));

const mocked = api as jest.Mocked<typeof api>;
const capture = jest.mocked(openCapture);
const push = jest.mocked(router.push);
const hidden = { includeHiddenElements: true } as const;
const ROOT = path.join(__dirname, "../../../..");
const H = ref.layout.hub;
const M = H.modes;
const GENRE_LIST = ["paranormal", "crime_scene", "noir"] as const;
const NOIR = "Detective Noir. Solve the case.";
const CRIME = "Crime Scene. Find the killer.";
const GHOST = "Paranormal. Face the unknown.";

type Room = Awaited<ReturnType<typeof api.listMyRooms>>[number];
type Session = NonNullable<Awaited<ReturnType<typeof api.getLatestSession>>>;
type Status = Session["status"];
const room = (id: string, genre: Room["genre"], status: Room["status"] = "ready") => ({ id, genre, status }) as Room;

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

/** A signed-in player with these sent rooms (newest first) and each room's latest session. */
function player({ rooms = [], sessions = {} }: { rooms?: Room[]; sessions?: Record<string, Status> }) {
  mocked.currentSession.mockResolvedValue({} as Awaited<ReturnType<typeof api.currentSession>>);
  mocked.listMyRooms.mockResolvedValue(rooms);
  mocked.getLatestSession.mockImplementation(async (id) => {
    const status = sessions[id];
    return status ? ({ status } as Session) : null;
  });
  mocked.getLatestCustomRoom.mockResolvedValue(room("d1", "noir", "draft"));
}

/** Both intros already seen: the crime scene and paranormal cards go past them. */
async function introsSeen() {
  await AsyncStorage.setItem(introKey("noir"), "1");
  await AsyncStorage.setItem(introKey("crime_scene"), "1");
  await AsyncStorage.setItem(introKey("paranormal"), "1");
}

beforeEach(async () => {
  jest.clearAllMocks();
  mockPreferences.hotspotAssist = false;
  mockPreferences.haptics_enabled = true;
  mockPreferences.sound_enabled = true;
  mockPreferences.music_enabled = true;
  mockPreferences.reduced_motion = false;
  mockPreferences.update.mockImplementation(async () => {});
  mocked.ensureSession.mockResolvedValue({} as never);
  mocked.currentSession.mockResolvedValue(null);
  capture.mockResolvedValue("guide");
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
/** Which mode's drawn cover a card shows. */
const cover = (genre: string) => screen.getByTestId(`hub-card-${genre}-art`, hidden).props.cover;
/** Every TreatedImage on screen (each records a `photo`). */
const photos = () => screen.container.queryAll((node) => (node.props as { photo?: unknown }).photo !== undefined);
/** Each card shows its own mode's drawn cover, and no photo is shown anywhere on home. */
const expectCovers = () => {
  for (const genre of GENRE_LIST) {
    expect(cover(genre)).toEqual({ genre });
    expect(screen.getByTestId(`hub-card-${genre}-art`, hidden).props.photo).toBeUndefined();
  }
  expect(photos()).toHaveLength(0);
};
/** A card's place in the deck: its slot's height, overlap and tilt. */
const slot = (genre: string) => styleOf(screen.getByTestId(`hub-card-${genre}-slot`));
/** The words block's measured height, as its onLayout reports it. */
const layoutWords = (genre: string, height: number) =>
  fireEvent(screen.getByTestId(`hub-card-${genre}-words`, hidden), "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 343, height } } });
const layoutColumn = (height: number) =>
  fireEvent(screen.getByTestId("hub-cards"), "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 375, height } } });

describe("01 · Home: the deck of mode cards", () => {
  it("renders the header and the three mode cards in reading order, each one button named by mode and tagline, never a count", async () => {
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
    expect(screen.queryByText("Choose a case")).toBeNull();
    expect(screen.queryByText(/THE STUDY|YOUR ROOM|YOUR CASE/, hidden)).toBeNull();
    expect(screen.getAllByRole("button").map((b) => b.props.accessibilityLabel)).toEqual(["Settings", GHOST, CRIME, NOIR, "The black cat, on the window sill. Pet the cat"]);

    // No stored session: no tags, never a guest just to label the cards, and no count anywhere.
    await act(async () => resolveSession(null));
    expect(screen.getAllByRole("button").map((b) => b.props.accessibilityLabel)).toEqual(["Settings", GHOST, CRIME, NOIR, "The black cat, on the window sill. Pet the cat"]);
    expect(screen.queryAllByTestId(/-tag$/, hidden)).toHaveLength(0);
    expect(screen.queryByText(/\d+ cases?|No cases yet/i, hidden)).toBeNull();
    expect(mocked.listMyRooms).not.toHaveBeenCalled();
    expect(mocked.ensureSession).not.toHaveBeenCalled();
  });

  it("deals the cards as a deck: equal cards, each lying over the one above by the deck's cover, alternately turned, later cards on top", async () => {
    await renderHub();
    await act(async () => layoutColumn(600));
    // The deck takes DECK_SHARE of the column, leaving the sill and the cat in view below it.
    const deck = deckLayout((600 - M.top - M.foot) * DECK_SHARE, 0, 3);
    const slots = GENRE_LIST.map(slot);
    const deals = GENRE_LIST.map((genre) => styleOf(screen.getByTestId(`hub-card-${genre}-deal`)));
    for (const [i, style] of deals.entries()) {
      expect(slots[i].height).toBe(deck.card);
      expect(style.marginTop).toBe(i === 0 ? 0 : -deck.overlap);
      expect(style.transform).toEqual([{ rotate: `${deckTilt(i)}deg` }]);
      // No zIndex: the deck's order is the tree's, so reading order and stacking agree.
      expect(style.zIndex).toBeUndefined();
    }
    expect(deck.overlap).toBe(Math.round(deck.card * M.deck.cover));
    // The tilts alternate, each about 2 to 4 degrees.
    const tilts = GENRE_LIST.map((_, i) => deckTilt(i));
    expect(tilts.map(Math.sign)).toEqual([1, -1, 1]);
    for (const tilt of tilts) expect(Math.abs(tilt)).toBeGreaterThanOrEqual(2);
    for (const tilt of tilts) expect(Math.abs(tilt)).toBeLessThanOrEqual(4);
    // Later cards come later in the tree (on top), each a book cover with COVER.radius corners.
    const order = screen.container.queryAll((node) => typeof node.props.testID === "string" && /^hub-card-[a-z_]+$/.test(node.props.testID) && node.props.accessibilityRole === "button");
    expect(order.map((node) => node.props.testID)).toEqual(GENRE_LIST.map((g) => `hub-card-${g}`));
    for (const genre of GENRE_LIST) expect(styleOf(card([GHOST, CRIME, NOIR][GENRE_LIST.indexOf(genre)]))).toMatchObject({ borderRadius: COVER.radius });
    // The slot passes touches through outside its card.
    expect(screen.getByTestId("hub-card-noir-slot").props.pointerEvents).toBe("box-none");
  });

  it("keeps every card's name and tagline in the part no card covers, at the top, whole (never cut to a line)", async () => {
    await renderHub();
    for (const genre of GENRE_LIST) {
      const theme = modeThemes[genre];
      const words = screen.getByTestId(`hub-card-${genre}-words`, hidden);
      // The words come before the cover's lower part: at the card's top, inside the foil frame and clear of the spine.
      expect(styleOf(words)).toMatchObject({ paddingTop: COVER.pad, paddingRight: COVER.pad, paddingLeft: COVER.spine + COVER.pad });
      // Over the title, the book's series line in the cover italic and foil.
      expect(styleOf(screen.getByText(SERIES[genre], hidden))).toMatchObject({ fontFamily: ref.font.coverItalic, color: theme.foil });
      const name = screen.getByText(theme.name, hidden);
      const tagline = screen.getByText(theme.tagline, hidden);
      expect(name.props.numberOfLines).toBeUndefined();
      expect(tagline.props.numberOfLines).toBeUndefined();
      expect(words.queryAll((node) => node === name || node === tagline)).toHaveLength(2);
    }
    // Every card shows at least its words plus the deck's peek above the next card, on every phone.
    for (const [available, words] of [
      [554, 114], // iPhone SE 375 x 667 (safe 20 / 0), noir's words with its rule
      [666, 114], // 393 x 852
      [746, 114], // Pro Max 430 x 932
      [554, 300], // large text
    ]) {
      const deck = deckLayout(available, words, 3);
      expect(deck.card - deck.overlap).toBeGreaterThanOrEqual(words + M.deck.peek);
      // A card's centre (where an accessibility tap lands) is on its own uncovered part.
      expect(deck.card / 2).toBeLessThan(deck.card - deck.overlap);
      expect(deck.card).toBeGreaterThanOrEqual(M.minHeight);
    }
  });

  it("fits all three on an iPhone SE at the default text size, and fills a tall phone; large text grows the cards and scrolls", () => {
    // The column under the header, less the deck's top and foot: 667 - 20 - 65 - 16 - 12 on the SE.
    const se = deckLayout(554, 114, 3);
    expect(se.height).toBeLessThanOrEqual(554);
    expect(se.height).toBeGreaterThan(554 - 3);
    const max = deckLayout(746, 114, 3);
    expect(max.height).toBeLessThanOrEqual(746);
    expect(max.height).toBeGreaterThan(746 - 3);
    // Large text: the cards grow, the same share covered, and the deck runs past the column (it scrolls).
    const large = deckLayout(554, 300, 3);
    expect(large.height).toBeGreaterThan(554);
    expect(large.overlap).toBe(Math.round(large.card * M.deck.cover));
  });

  it("grows every card together when large text makes one card's words taller", async () => {
    await renderHub();
    await act(async () => layoutColumn(600));
    const before = slot("crime_scene").height as number;
    await act(async () => layoutWords("crime_scene", 320));
    const after = deckLayout(600 - M.top - M.foot, 320, 3);
    expect(after.card).toBeGreaterThan(before);
    for (const genre of GENRE_LIST) expect(slot(genre).height).toBe(after.card);
    expect(after.card - after.overlap).toBeGreaterThanOrEqual(320 + M.deck.peek);
  });

  it("every card is tappable, overlap or not: each one's own tap runs its own mode", async () => {
    await introsSeen();
    player({});
    await renderHub();
    for (const [name, genre] of [
      [NOIR, "noir"],
      [CRIME, "crime_scene"],
      [GHOST, "paranormal"],
    ] as const) {
      await userEvent.setup().press(card(name));
      await act(async () => {});
      expect(capture).toHaveBeenLastCalledWith({ genre, signal: expect.any(AbortSignal) });
    }
    expect(capture).toHaveBeenCalledTimes(3);
    expect(mockFeedback.press).toHaveBeenCalledTimes(3);
  });

  it("draws each card as a book cover in its mode's palette: the mode's surface and rim, a spine and a foil frame, its name in its display face, its tagline, and a soft glow", async () => {
    await renderHub();
    for (const genre of GENRE_LIST) {
      const theme = modeThemes[genre];
      const face = screen.getByTestId(`hub-card-${genre}-face`, hidden);
      // Solid and physical: an opaque fill, a 1 pt rim, continuous corners, no glass.
      expect(styleOf(face)).toMatchObject({ backgroundColor: theme.surface, borderColor: theme.rim, borderWidth: M.rim, borderRadius: COVER.radius, overflow: "hidden" });
      expect(styleOf(screen.getByText(theme.name, hidden))).toMatchObject({ ...theme.display, color: theme.ink });
      expect(styleOf(screen.getByText(theme.tagline, hidden))).toMatchObject({ ...M.type.tagline, color: theme.ink });
    }
    // No gold rule over noir's name (the user removed it).
    expect(screen.queryByTestId("hub-card-noir-rule", hidden)).toBeNull();
    // A soft light in the mode's glow on every cover, and the binding: a spine and a double foil frame.
    for (const genre of GENRE_LIST) expect(screen.getByTestId(`hub-card-${genre}-glow`, hidden)).toBeTruthy();
    expect(screen.getAllByTestId("hub-card-binding", hidden)).toHaveLength(3);
    // No strip over any cover.
    expect(screen.queryByTestId("hub-card-crime_scene-tape", hidden)).toBeNull();
    expect(screen.queryByText(/crime scene · do not cross/i, hidden)).toBeNull();
    expect(screen.queryAllByTestId(/-rule$|-tape$/, hidden)).toHaveLength(0);
  });

  it("always shows each mode's drawn cover, never a room photo, even once the player has photographed rooms", async () => {
    // A guest: each card's own mode's cover.
    await renderHub();
    expectCovers();
    await screen.unmount();

    // A player whose rooms (sent and a draft) all exist: still the covers, no TreatedImage on any card.
    player({ rooms: [room("r1", "noir"), room("r2", "crime_scene"), room("r3", "paranormal")] });
    await renderHub();
    expectCovers();
    // Home never reads a room photo or the newest room.
    expect(mocked.getLatestCustomRoom).not.toHaveBeenCalled();
    await screen.unmount();

    // A failed fetch leaves the covers as they are.
    mocked.listMyRooms.mockRejectedValue(new Error("Network request failed"));
    await renderHub();
    expect(card(NOIR)).toBeTruthy();
    expectCovers();
  });

  it("never tags a card, even when its mode has a case to go back to (the prompt says so instead)", async () => {
    player({
      
      rooms: [room("n1", "noir"), room("p1", "paranormal", "generating"), room("c1", "crime_scene")],
      sessions: { n1: "active", c1: "active" },
    });
    await renderHub();
    // Every mode has a case to go back to; every card's label is still just its name and tagline.
    expect(card(NOIR)).toBeTruthy();
    expect(card(CRIME)).toBeTruthy();
    expect(card(GHOST)).toBeTruthy();
    expect(screen.queryAllByTestId(/-tag$/, hidden)).toHaveLength(0);
    expect(screen.queryByText("In progress", hidden)).toBeNull();
  });

  it("home is the shell: it clears the active mode when it gains focus", async () => {
    setMode("crime_scene");
    await renderHub();
    expect(getMode()).toBeNull();
  });

  it("keeps the mode's ink at 4.5:1 over even white art, on the plate behind the words", () => {
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

describe("01 · Home: entering a mode", () => {
  it("Detective Noir: the first tap shows its intro, like every mode, with the press haptic", async () => {
    player({});
    await renderHub();
    await userEvent.setup().press(card(NOIR));
    expect(mockFeedback.press).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith(introHref("noir"));
    expect(capture).not.toHaveBeenCalled();
  });

  it("after the first time, with no case to go back to: a new case straight away (openCapture with the mode); no case list", async () => {
    await introsSeen();
    player({ rooms: [room("n1", "noir")], sessions: { n1: "completed" } });
    await renderHub();
    let finish: () => void = () => {};
    capture.mockReturnValueOnce(new Promise((resolve) => (finish = () => resolve("guide"))));
    await fireEvent.press(card(NOIR));
    expect(capture).toHaveBeenCalledWith({ genre: "noir", signal: expect.any(AbortSignal) });
    // Busy while access is checked: an indicator in the tag's place, the others shaded (not see-through) and disabled.
    expect(card(NOIR).props.accessibilityState).toMatchObject({ busy: true, disabled: true });
    expect(screen.getByTestId("hub-card-noir-busy", hidden).props.color).toBe(modeThemes.noir.ink);
    expect(screen.getByTestId("hub-card-crime_scene").props.accessibilityState).toMatchObject({ disabled: true });
    expect(styleOf(screen.getByTestId("hub-card-crime_scene")).opacity).toBeUndefined();
    expect(styleOf(screen.getByTestId("hub-card-crime_scene-dim", hidden))).toMatchObject({ backgroundColor: ref.color.void, opacity: 1 - ref.button.disabledOpacity.pill });
    expect(screen.getByRole("button", { name: "Settings" }).props.accessibilityState).toMatchObject({ disabled: true });
    await act(async () => finish());
    expect(card(NOIR).props.accessibilityState).toMatchObject({ busy: false });
    // Nothing else was opened: no mode screen, no prompt.
    expect(push).not.toHaveBeenCalled();
    expect(screen.queryByTestId("hub-resume")).toBeNull();

    // When the access check can't run, it carries on to /capture (whose backstop shows the guide).
    capture.mockRejectedValueOnce(new Error("Network request failed"));
    await fireEvent.press(card(CRIME));
    await act(async () => {});
    expect(capture).toHaveBeenLastCalledWith({ genre: "crime_scene", signal: expect.any(AbortSignal) });
    expect(push).toHaveBeenCalledWith("/capture");
  });

  it("Crime Scene and Paranormal open their one-screen intro the first time, and after that go past it", async () => {
    await renderHub();
    await fireEvent.press(card(CRIME));
    await act(async () => {});
    expect(push).toHaveBeenLastCalledWith({ pathname: "/mode/intro/[genre]", params: { genre: "crime_scene" } });
    await fireEvent.press(card(GHOST));
    await act(async () => {});
    expect(push).toHaveBeenLastCalledWith({ pathname: "/mode/intro/[genre]", params: { genre: "paranormal" } });
    expect(capture).not.toHaveBeenCalled();

    // Start on the intro stores the flag per mode.
    push.mockClear();
    await AsyncStorage.setItem(introKey("crime_scene"), "1");
    await fireEvent.press(card(CRIME));
    await act(async () => {});
    expect(capture).toHaveBeenLastCalledWith({ genre: "crime_scene", signal: expect.any(AbortSignal) });
    expect(push).not.toHaveBeenCalled();
    await fireEvent.press(card(GHOST));
    await act(async () => {});
    expect(push).toHaveBeenLastCalledWith({ pathname: "/mode/intro/[genre]", params: { genre: "paranormal" } });
  });

  it("with a case to go back to: the continue prompt over home, in the mode's colours, and nothing opens yet", async () => {
    await introsSeen();
    player({ rooms: [room("c1", "crime_scene")], sessions: { c1: "active" } });
    await renderHub();
    await fireEvent.press(card(CRIME));
    await act(async () => {});
    expect(push).not.toHaveBeenCalled();
    expect(capture).not.toHaveBeenCalled();
    const theme = modeThemes.crime_scene;
    // The kit's dark sheet in the mode's surface and rim (home itself stays the shell).
    expect(styleOf(screen.getByTestId("hub-resume"))).toMatchObject({ backgroundColor: theme.surface, borderColor: theme.rim, borderTopLeftRadius: ref.radius.bottomSheet });
    expect(getMode()).toBeNull();
    // The case's name (a stand-in while it has none) in the mode's display face, the book's series line, and the mode's line by a bookmark ribbon.
    expect(styleOf(screen.getByRole("header", { name: RESUME_COPY.crime_scene.untitled }))).toMatchObject({ ...theme.display, color: theme.ink });
    expect(screen.getByText(SERIES.crime_scene)).toBeTruthy();
    expect(screen.getByText("You have an open case on file.")).toBeTruthy();
    expect(screen.getByTestId("hub-resume-ribbon", hidden)).toBeTruthy();
    // Continue: the guide's pill in the mode's accent. Start a new case: the guide's ghost pill in the mode's ground and rim.
    const resume = screen.getByRole("button", { name: "Continue" });
    expect(styleOf(resume)).toMatchObject({ backgroundColor: theme.accent, borderRadius: ref.radius.round, minHeight: ref.button.ghost.height });
    expect(styleOf(screen.getByText("Continue"))).toMatchObject({ ...ref.type.headline, color: theme.accentInk });
    const fresh = screen.getByRole("button", { name: "Start a new case" });
    expect(styleOf(fresh)).toMatchObject({ backgroundColor: theme.ground, borderColor: theme.rim, borderWidth: ref.button.ghost.borderWidth, borderRadius: ref.radius.round, minHeight: ref.button.ghost.height });
    expect(styleOf(screen.getByText("Start a new case"))).toMatchObject({ ...ref.type.headline, color: theme.ink });
    // Home behind it is hidden from TalkBack while it is open.
    expect(screen.getByTestId("hub-screen", hidden).props.importantForAccessibility).toBe("no-hide-descendants");
  });

  it("Continue resumes the case in the player, and closes the prompt", async () => {
    await introsSeen();
    player({ rooms: [room("p1", "paranormal")], sessions: {} });
    await renderHub();
    await fireEvent.press(card(GHOST));
    await act(async () => {});
    expect(screen.getByText("Something is still waiting for you.")).toBeTruthy();
    await userEvent.setup().press(screen.getByRole("button", { name: "Continue" }));
    expect(push).toHaveBeenCalledWith({ pathname: "/play/[roomId]", params: { roomId: "p1" } });
    expect(capture).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByTestId("hub-resume")).toBeNull());
  });

  it("Continue on a case still building opens the build wait, in the mode's look", async () => {
    await introsSeen();
    player({ rooms: [room("n1", "noir", "queued")] });
    await renderHub();
    await fireEvent.press(card(NOIR));
    await act(async () => {});
    expect(screen.getByText("Your next case is still coming together.")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Continue" }));
    expect(getMode()).toBe("noir");
    expect(push).toHaveBeenCalledWith({ pathname: "/capture/develop", params: { roomId: "n1" } });
  });

  it("Start a new case runs openCapture with the mode, busy while it checks access, then the prompt goes; /capture when the check can't run", async () => {
    await introsSeen();
    player({ rooms: [room("c1", "crime_scene")] });
    await renderHub();
    await fireEvent.press(card(CRIME));
    await act(async () => {});
    let finish: () => void = () => {};
    capture.mockReturnValueOnce(new Promise((resolve) => (finish = () => resolve("pro"))));
    await userEvent.setup().press(screen.getByRole("button", { name: "Start a new case" }));
    expect(capture).toHaveBeenCalledWith({ genre: "crime_scene", signal: expect.any(AbortSignal) });
    expect(screen.getByRole("button", { name: "Start a new case" }).props.accessibilityState).toMatchObject({ busy: true });
    expect(screen.getByTestId("hub-resume-new-spinner", hidden)).toBeTruthy();
    // Continue waits meanwhile.
    expect(screen.getByRole("button", { name: "Continue" }).props.accessibilityState).toMatchObject({ disabled: true });
    await act(async () => finish());
    // The route opens, then the sheet slides away on its own close.
    await waitFor(() => expect(screen.queryByTestId("hub-resume")).toBeNull());
    expect(push).not.toHaveBeenCalled();

    await fireEvent.press(card(CRIME));
    await act(async () => {});
    capture.mockRejectedValueOnce(new Error("Network request failed"));
    await fireEvent.press(screen.getByRole("button", { name: "Start a new case" }));
    await act(async () => {});
    expect(push).toHaveBeenCalledWith("/capture");
    await waitFor(() => expect(screen.queryByTestId("hub-resume")).toBeNull());
  });

  it("closing the prompt (Close, Android back) leaves the player on home, focus back on the card", async () => {
    type BackListener = Parameters<typeof BackHandler.addEventListener>[1];
    const handlers: BackListener[] = [];
    const add = jest.spyOn(BackHandler, "addEventListener").mockImplementation((_event, handler) => {
      handlers.push(handler);
      return { remove: () => handlers.splice(handlers.indexOf(handler), 1) };
    });
    const back = () => handlers[handlers.length - 1]({} as Parameters<BackListener>[0]);
    const focus = jest.spyOn(AccessibilityInfo, "sendAccessibilityEvent").mockImplementation(() => {});
    await introsSeen();
    player({ rooms: [room("n1", "noir")], sessions: { n1: "active" } });
    await renderHub();

    await fireEvent.press(card(NOIR));
    await act(async () => {});
    await fireEvent.press(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByTestId("hub-resume")).toBeNull());
    await act(() => new Promise((resolve) => setTimeout(resolve, H.sheet.focusMargin + 50)));
    const noirFocus = () =>
      focus.mock.calls.filter(([target, type]) => (target as unknown as { props?: { testID?: string } }).props?.testID === "hub-card-noir" && type === "focus").length;
    expect(noirFocus()).toBe(1);

    await fireEvent.press(card(NOIR));
    await act(async () => {});
    let handled: boolean | null | undefined;
    await act(async () => {
      handled = back();
    });
    expect(handled).toBe(true);
    expect(screen.queryByTestId("hub-resume")).toBeNull();
    expect(push).not.toHaveBeenCalled();
    add.mockRestore();
    focus.mockRestore();
  });

  it("a tap before this focus's fetch has landed waits for it (busy), then chooses", async () => {
    await introsSeen();
    player({ rooms: [room("p1", "paranormal", "generating")] });
    let release: () => void = () => {};
    mocked.listMyRooms.mockReturnValueOnce(new Promise((resolve) => (release = () => resolve([room("p1", "paranormal", "generating")]))));
    await renderHub();
    await fireEvent.press(card(GHOST));
    await act(async () => {});
    expect(card(GHOST).props.accessibilityState).toMatchObject({ busy: true });
    expect(screen.queryByTestId("hub-resume")).toBeNull();
    await act(async () => release());
    expect(screen.getByTestId("hub-resume")).toBeTruthy();
    expect(screen.getByText("Something is still taking shape.")).toBeTruthy();
    expect(capture).not.toHaveBeenCalled();
  });

  it("shows the offline notice when a card can't find out what to do, and the next card tap clears it", async () => {
    await introsSeen();
    player({});
    mocked.listMyRooms.mockRejectedValue(new Error("Network request failed"));
    await renderHub();
    await fireEvent.press(card(GHOST));
    await act(async () => {});
    const notice = screen.getByTestId("hub-notice");
    expect(notice.props.accessibilityLabel).toBe("You're offline. Connect to begin.");
    expect(screen.getByTestId("hub-notice-slot").props.accessibilityLiveRegion).toBe("polite");
    expect(styleOf(notice)).toMatchObject({ backgroundColor: ref.color.ground, borderColor: ref.color.rim, borderRadius: ref.radius.round });
    expect(push).not.toHaveBeenCalled();
    expect(capture).not.toHaveBeenCalled();

    mocked.listMyRooms.mockResolvedValue([]);
    await fireEvent.press(card(GHOST));
    await act(async () => {});
    expect(screen.queryByTestId("hub-notice")).toBeNull();
  });
});

describe("01 · Home: Settings", () => {
  it("Settings: grouped rows that work, on the kit's dark sheet, foil headings, with a blush-track switch (no aqua)", async () => {
    await renderHub();
    await fireEvent.press(screen.getByRole("button", { name: "Settings" }));
    expect(screen.getByRole("header", { name: "Settings" })).toBeTruthy();
    expect(styleOf(screen.getByTestId("hub-sheet"))).toMatchObject({
      backgroundColor: ref.color.ground,
      borderTopLeftRadius: ref.radius.bottomSheet,
      borderColor: ref.color.rim,
    });
    for (const name of ["Gameplay", "Accessibility", "Account"]) {
      expect(styleOf(screen.getByRole("header", { name }))).toMatchObject({ fontFamily: ref.font.coverItalic, ...SETTINGS.heading, color: shellTheme.foil });
    }
    const interactives = screen.getByRole("switch", { name: "Show interactives" });
    expect(interactives.props.accessibilityState).toMatchObject({ checked: false });
    expect(styleOf(interactives).minHeight).toBe(H.settings.rowHeight);
    // The switch: the shell's blush track when on, its surface when off, a warm white thumb.
    expect(screen.getByTestId("hub-show-interactives-switch", hidden).props).toMatchObject({
      value: false,
      onTintColor: shellTheme.accent,
      tintColor: shellTheme.surface,
      thumbTintColor: shellTheme.ink,
    });
    expect(screen.getByRole("switch", { name: "Haptics" }).props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByRole("switch", { name: "Reduce motion" }).props.accessibilityState).toMatchObject({ checked: false });
    expect(screen.getByRole("button", { name: "Add your email" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "ESCAPD Pro" })).toBeTruthy();
    // The version is the sheet's grey meta line under its title.
    expect(styleOf(screen.getByText(/^Version \S+$/))).toMatchObject({ ...ref.type.meta, color: ref.color.textSecondary });
    expect(screen.queryByRole("header", { name: "About" })).toBeNull();

    await fireEvent.press(interactives);
    expect(mockPreferences.setHotspotAssist).toHaveBeenCalledWith(true);
    expect(mockFeedback.tick).toHaveBeenCalledTimes(1);

    // Close slides the sheet away, then it unmounts.
    await fireEvent.press(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByTestId("hub-sheet")).toBeNull());
  });

  it("Settings fits every row with no scroll on an iPhone SE at the default text size", async () => {
    // 375 x 667, 20 safe top. Jest has no layout engine: the rows the sheet draws are added up from the tokens.
    const SE = { width: 375, height: 667, top: 20, bottom: 0 };
    const window = Dimensions.get("window");
    Dimensions.set({ window: { ...window, width: SE.width, height: SE.height, fontScale: 1 } });
    try {
      player({});
      await renderHub();
      await fireEvent.press(screen.getByRole("button", { name: "Settings" }));
      const sheet = screen.getByTestId("hub-sheet");
      const S = H.settings;
      // The sheet may grow to S.top under the safe top (the test's safe area is 0).
      expect(styleOf(sheet).maxHeight).toBe(SE.height - S.top);
      const room = SE.height - SE.top - S.top;

      const sections = within(sheet).getAllByRole("header").length - 1;
      const controls = [
        ...within(sheet).getAllByRole("switch"),
        ...within(sheet).getAllByRole("button").filter((b) => b.props.accessibilityLabel !== "Close"),
      ];
      expect(controls).toHaveLength(8);
      expect(sections).toBe(3);
      // Sound and Music share one row, side by side: eight controls in seven rows.
      const pair = within(sheet).getByTestId("hub-sound-music");
      expect(within(pair).getAllByRole("switch").map((r) => r.props.accessibilityLabel)).toEqual(["Sound", "Music"]);
      const rows = controls.length - 1;
      expect(rows).toBe(7);
      // A detail line is a hint shown under the label (the pair's hints are read, not shown).
      const details = controls
        .map((r) => r.props.accessibilityHint as string | undefined)
        .filter((hint): hint is string => !!hint && within(sheet).queryByText(hint) !== null);
      expect(details).toHaveLength(4);
      // Each detail is one line beside a switch on the SE.
      for (const detail of details) expect(detail.length).toBeLessThanOrEqual(S.detailMax);
      // Every control, the pair's halves included, is at least a 44 pt target (48 tall).
      for (const control of controls) expect(styleOf(control).minHeight).toBeGreaterThanOrEqual(ref.hit.min);

      const T = ref.type;
      const chip = ref.button.chip;
      // DarkSheet: Close's hit box sits ref.radius.bottomSheet - chip.size / 2 - (hit - size) / 2 below the top; the
      // content has ref.space.sm above and below; ref.space.lg (over the bottom inset) under it.
      const header = ref.radius.bottomSheet - chip.size / 2 - (chip.hit - chip.size) / 2
        + Math.max(chip.hit, T.headline.lineHeight + ref.space.xs + T.meta.lineHeight);
      const detailRow = Math.max(S.rowHeight, 2 * S.padY + T.body.lineHeight + S.detailGap + T.meta.lineHeight);
      const plainRow = Math.max(S.rowHeight, 2 * S.padY + T.body.lineHeight);
      const height = header + 2 * ref.space.sm + ref.space.lg + SE.bottom
        + sections * (S.heading.lineHeight + S.headingGap) + (sections - 1) * S.section
        + details.length * detailRow + (rows - details.length) * plainRow + (rows - sections) * H.hairline;
      expect(height).toBeLessThanOrEqual(room);
    } finally {
      Dimensions.set({ window });
    }
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

  it("Settings: Sound and Music share a row, each its own switch, and Music saves music_enabled like Sound", async () => {
    await renderHub();
    await fireEvent.press(screen.getByRole("button", { name: "Settings" }));
    const music = screen.getByRole("switch", { name: "Music" });
    expect(music.props.accessibilityState).toMatchObject({ checked: true });
    expect(music.props.accessibilityHint).toBe("A theme for each mode.");
    expect(styleOf(music)).toMatchObject({ minHeight: H.settings.rowHeight, flex: 1 });
    expect(styleOf(screen.getByRole("switch", { name: "Sound" }))).toMatchObject({ flex: 1 });

    await fireEvent.press(music);
    await act(async () => {});
    expect(mocked.ensureSession).toHaveBeenCalledTimes(1);
    expect(mockPreferences.update).toHaveBeenCalledWith({ music_enabled: false });
    expect(mockFeedback.tick).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByRole("switch", { name: "Sound" }));
    await act(async () => {});
    expect(mockPreferences.update).toHaveBeenLastCalledWith({ sound_enabled: false });
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
    expect(push).toHaveBeenCalledWith({ pathname: "/account", params: { next: "back", from: "settings" } });
    // The route opens, then the sheet slides away on its own close.
    await waitFor(() => expect(screen.queryByTestId("hub-sheet")).toBeNull());

    await fireEvent.press(screen.getByRole("button", { name: "Settings" }));
    await fireEvent.press(screen.getByRole("button", { name: "ESCAPD Pro" }));
    expect(push).toHaveBeenCalledWith("/pro");
    await screen.unmount();

    mocked.currentSession.mockResolvedValue({ user: { email: "ada@example.com", is_anonymous: false } } as never);
    mocked.getLatestSession.mockResolvedValue(null);
    mocked.listMyRooms.mockResolvedValue([]);
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

    await introsSeen();
    capture.mockReturnValueOnce(new Promise(() => {}));
    await renderHub();
    expect(back()).toBe(false);

    await fireEvent.press(screen.getByRole("button", { name: "Settings" }));
    let handled: boolean | null | undefined;
    await act(async () => {
      handled = back();
    });
    expect(handled).toBe(true);
    expect(screen.queryByTestId("hub-sheet")).toBeNull();

    await fireEvent.press(card(NOIR));
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

describe("01 · Home and the mode intros: tokens only", () => {
  const sources = () => {
    const dirs = ["src/screens/hub", "src/screens/mode"].map((d) => path.join(ROOT, d));
    const files = [path.join(ROOT, "app/index.tsx"), path.join(ROOT, "app/mode/intro/[genre].tsx")];
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
      expect({ file, live: tokens.filter((t) => !["motion", "ref", "modeThemes", "type ModeTheme", "ctaBottomPad"].includes(t)) }).toEqual({ file, live: [] });
      // No fan, glass, mint art, floor glow or grain; no live-look components.
      expect({
        file,
        old: source.match(
          /FloorGlow|CardGlass|CardArt|GameCard|\bFan\b|CardStack|\bGrain\b|lineStart|lineEnd|glowOlive|glowTeal|bottomGlow|@\/components\/(Text|Sheet|Button|IconButton)"|ModeArtImage|useModeArt|[gs]etOwnArt|newestRoomArt|getLatestCustomRoom|ModeScreen|useModeCases|caseQueries|caseFiles|CaseFileRow|ModeBar|STUDY_ART|caseCount|modeHref/g,
        ),
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
    // The modes' room-photo art is gone: the cards and banners draw ModeCover directly.
    expect(fs.existsSync(path.join(ROOT, "src/screens/mode/ModeArtImage.tsx"))).toBe(false);
    // Round 6: no case list. The mode screen, its case files, stamps, queries and bar are gone; the intro stays.
    for (const gone of ["ModeScreen.tsx", "useModeCases.ts", "caseQueries.ts", "caseFiles.ts", "CaseFileRow.tsx", "art.ts"]) {
      expect({ gone, exists: fs.existsSync(path.join(ROOT, "src/screens/mode", gone)) }).toEqual({ gone, exists: false });
    }
    expect(fs.existsSync(path.join(ROOT, "app/mode/[genre].tsx"))).toBe(false);
    expect(fs.existsSync(path.join(ROOT, "app/mode/intro/[genre].tsx"))).toBe(true);
    // Home's own tokens: no fan, glass or stack geometry left.
    expect(Object.keys(H)).not.toEqual(expect.arrayContaining(["fan"]));
    for (const key of ["fan", "glass", "card", "weights", "band", "stackedMinHeight"]) expect(H).not.toHaveProperty(key);
    // No police-tape strip, photo bake size or count on the cards; no bake size on the banner.
    for (const key of ["tape", "artEdge", "chip", "gap"]) expect(M).not.toHaveProperty(key);
    for (const key of ["tape", "count"]) expect(M.type).not.toHaveProperty(key);
    // The mode screen's case files, stamps and bar are gone from the mode's tokens.
    for (const key of ["artEdge", "file", "stamp", "bar", "empty"]) expect(ref.layout.mode).not.toHaveProperty(key);
  });
});

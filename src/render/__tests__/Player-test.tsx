import fs from "fs";
import path from "path";
import { Image, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as api from "@/lib/escapd-api";
import type { ActionResult, GameAction, SessionState } from "@/lib/puzzle-types";
import { initialState, sessionRow, studyPublic, studySecret } from "@/test-utils/seed";
import { TUTORIAL_ROOM_ID } from "@/tutorial/assets";
import { tutorialCoach } from "@/tutorial/coach";
import { ref } from "@/theme/tokens";
import { Player } from "../Player";

// Haptics with stable spies, so a test can check which one fired (the full shape, as jest/setup.js).
const mockFeedback = {
  tick: jest.fn(), tap: jest.fn(), press: jest.fn(), thud: jest.fn(), success: jest.fn(), warning: jest.fn(), error: jest.fn(),
};
jest.mock("@/game/feedback", () => ({ useFeedback: () => mockFeedback }));

// Jest turns image requires into objects; the player needs numeric asset ids.
jest.mock("@/tutorial/assets", () => ({
  TUTORIAL_ROOM_ID: "00000000-0000-4000-8000-000000000001",
  bundledScene: () => 1,
}));

jest.mock("@/lib/supabase", () => ({
  supabase: { auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) } },
}));

jest.mock("@/lib/escapd-api", () => {
  class ApiError extends Error {
    code?: string;
    constructor(message: string, errorCode?: string) {
      super(message);
      this.code = errorCode;
    }
  }
  return {
    ApiError,
    isNetworkError: (e: unknown) => /network request failed/i.test(e instanceof Error ? e.message : ""),
    ensureSession: jest.fn().mockResolvedValue({}),
    startOrResume: jest.fn(),
    getPlayableDefinition: jest.fn(),
    submitAction: jest.fn(),
    abandonSession: jest.fn(),
    getRoomPhotos: jest.fn(),
    signedPhotoUrl: jest.fn(),
    getSettings: jest.fn().mockResolvedValue({}),
    updateSettings: jest.fn(),
  };
});

const mocked = api as jest.Mocked<typeof api>;
const def = studyPublic();
const secret = studySecret();

/**
 * Test double for submit_action, scripted for The Study only. It is not a
 * rules engine: it answers the tutorial's own witness sequence using the
 * seed's real messages and answer, and says "nothing" to anything else.
 */
function studyServer() {
  let state: SessionState = initialState(def);
  const has = (id: string) => state.solved.includes(id);
  const nothing: ActionResult = { outcome: "nothing", message: "Nothing interesting happens." };
  const solve = (id: string, change: { gain?: string[]; consume?: string[]; reveal?: string[] }, extra: Partial<ActionResult> = {}): ActionResult => {
    const gain = change.gain ?? [];
    const consume = change.consume ?? [];
    const reveal = change.reveal ?? [];
    state = {
      solved: [...state.solved, id],
      inventory: [...state.inventory.filter((i) => !consume.includes(i)), ...gain],
      revealed_hotspots: [...state.revealed_hotspots, ...reveal],
    };
    return {
      outcome: "solved", puzzle_id: id, message: secret.puzzles[id].message, gained_items: gain,
      consumed_items: consume, revealed_hotspots: reveal, completed: false, state, ...extra,
    };
  };
  return (action: GameAction): ActionResult => {
    switch (action.type) {
      case "inspect":
        if (action.hotspot_id === "desk_drawer" && !has("find_key")) return solve("find_key", { gain: ["brass_key"] });
        if (action.hotspot_id === "bookshelf" && !has("find_note_left")) return solve("find_note_left", { gain: ["torn_note_left"] });
        if (action.hotspot_id === "rug" && !has("find_note_right")) return solve("find_note_right", { gain: ["torn_note_right"] });
        if (action.hotspot_id === "door" && has("open_safe") && !has("escape")) {
          return solve("escape", {}, { completed: true, exit_message: def.exit.message });
        }
        return nothing;
      case "use_item":
        if (action.item_id === "brass_key" && action.hotspot_id === "cabinet" && !has("open_cabinet")) {
          return solve("open_cabinet", { consume: ["brass_key"], reveal: ["safe"] });
        }
        return nothing;
      case "combine":
        if ([...action.item_ids].sort().join() === "torn_note_left,torn_note_right" && !has("join_notes")) {
          return solve("join_notes", { gain: ["full_note"], consume: ["torn_note_left", "torn_note_right"] });
        }
        return nothing;
      case "solve":
        if (action.puzzle_id !== "open_safe" || !state.revealed_hotspots.includes("safe")) {
          return { outcome: "invalid", message: "That puzzle is not available." };
        }
        return action.answer === secret.puzzles.open_safe.answer
          ? solve("open_safe", {})
          : { outcome: "wrong", puzzle_id: "open_safe", message: "Nothing happens." };
      case "accuse":
        return { outcome: "invalid", message: "That puzzle is not available." };
    }
  };
}

const session = sessionRow(def, { room_id: TUTORIAL_ROOM_ID });

beforeEach(async () => {
  jest.clearAllMocks();
  // The player remembers the last view per room; start each test fresh.
  await AsyncStorage.clear();
  mocked.startOrResume.mockResolvedValue(session);
  mocked.getPlayableDefinition.mockResolvedValue(def);
  jest.spyOn(Image, "resolveAssetSource").mockReturnValue({ uri: "scene.jpg", width: 1200, height: 1600, scale: 1 });
});

const AREA = { x: 0, y: 0, width: 393, height: 540 };

/** Give the pager and the view in view a size, so its hotspots lay out. */
async function layoutScene() {
  await fireEvent(await screen.findByTestId("scene-pager"), "layout", { nativeEvent: { layout: AREA } });
  const scenes = await screen.findAllByTestId("scene-view");
  for (const scene of scenes) await fireEvent(scene, "layout", { nativeEvent: { layout: AREA } });
}

const action = (actionName: string) => ({ nativeEvent: { actionName } });

/** Step the pager (the page dots are its adjustable control) to view `n` (zero-based). */
async function goToView(n: number) {
  const dots = await screen.findByTestId("view-dots");
  const now = Number(/^(\d+)/.exec(dots.props.accessibilityValue.text)![1]) - 1;
  for (let i = now; i < n; i++) await fireEvent(screen.getByTestId("view-dots"), "accessibilityAction", action("increment"));
  for (let i = now; i > n; i--) await fireEvent(screen.getByTestId("view-dots"), "accessibilityAction", action("decrement"));
  await layoutScene();
}

const press = async (testID: string) => fireEvent.press(await screen.findByTestId(testID));
const lastAction = () => mocked.submitAction.mock.calls[mocked.submitAction.mock.calls.length - 1][1];

/** Fixed-length tumblers start at 0000. Each increment (the wheel is adjustable) rolls that wheel by one. */
async function dial(code: string) {
  for (let i = 0; i < code.length; i++) {
    for (let step = 0; step < Number(code[i]); step++) {
      await fireEvent(await screen.findByTestId(`tumbler-${i}`), "accessibilityAction", action("increment"));
    }
  }
  await press("code-submit");
}

async function renderStudy(onComplete = jest.fn()) {
  await render(<Player roomId={TUTORIAL_ROOM_ID} coach={tutorialCoach} onExit={jest.fn()} onComplete={onComplete} />, { wrapper: GestureHandlerRootView });
  await layoutScene();
  return onComplete;
}

describe("Player: The Study", () => {
  it("plays the whole tutorial through submit_action only", async () => {
    const respond = studyServer();
    mocked.submitAction.mockImplementation(async (_session, action) => respond(action));
    const onComplete = await renderStudy();

    // Coach mark, and no item text on screen before the server grants anything.
    expect(screen.getByText("Tap the desk drawer to search it.")).toBeTruthy();
    expect(screen.queryByText("Small and a little tarnished.")).toBeNull();

    // Inspect -> solved: result sheet shows the granted item and its description.
    await press("hotspot-desk_drawer");
    expect(lastAction()).toEqual({ type: "inspect", hotspot_id: "desk_drawer" });
    await screen.findByTestId("result-sheet");
    expect(screen.getByText(secret.puzzles.find_key.message!)).toBeTruthy();
    expect(screen.getAllByText("Small and a little tarnished.").length).toBeGreaterThan(0);
    await press("result-continue");

    await press("hotspot-bookshelf");
    await press("result-continue");

    // Scene switching is local; the hidden safe is absent visually and accessibly.
    await goToView(1);
    expect(screen.queryByTestId("hotspot-safe")).toBeNull();
    expect(screen.queryByLabelText(/Wall safe/)).toBeNull();

    // Nothing: neutral locked copy that never names the missing item.
    await press("hotspot-cabinet");
    expect(await screen.findByText("Something is missing.")).toBeTruthy();
    await press("result-continue");

    await press("hotspot-rug");
    await press("result-continue");

    // Combine mode: two selected items, then the worktable clasp.
    await press("item-torn_note_left");
    await press("item-torn_note_right");
    await fireEvent.press(await screen.findByLabelText("Close clasp"));
    expect(lastAction()).toEqual({ type: "combine", item_ids: ["torn_note_left", "torn_note_right"] });
    await screen.findByTestId("result-sheet");
    expect(screen.getAllByText(/0427/).length).toBeGreaterThan(0);
    await press("result-continue");

    // Use mode: one selected item, then a hotspot. The safe appears only now.
    await press("item-brass_key");
    await press("hotspot-cabinet");
    expect(lastAction()).toEqual({ type: "use_item", item_id: "brass_key", hotspot_id: "cabinet" });
    await press("result-continue");
    expect(await screen.findByTestId("hotspot-safe")).toBeTruthy();

    // Code: wrong keeps the tumblers open and resets them; the leading zero survives.
    await press("hotspot-safe");
    await screen.findByTestId("code-sheet");
    await dial("1234");
    expect(await screen.findByText("Nothing happens.")).toBeTruthy();
    // 02's error line: white words, no amber or oxblood.
    expect(flat(screen.getByText("Nothing happens."))).toMatchObject({ color: ref.color.textPrimary });
    expect(screen.getByTestId("code-sheet")).toBeTruthy();
    await dial("0427");
    expect(lastAction()).toEqual({ type: "solve", puzzle_id: "open_safe", answer: "0427" });
    await screen.findByTestId("result-sheet");
    await press("result-continue");

    // Completion comes from the server's `completed`, then hands off.
    await goToView(2);
    await press("hotspot-door");
    await waitFor(() => expect(onComplete).toHaveBeenCalledWith({
      message: secret.puzzles.escape.message,
      exitMessage: def.exit.message,
    }), { timeout: 3000 });
    // Plays the whole tutorial with real timers: slow when every suite runs at once.
  }, 30_000);

  it("says the door does not open yet, and shows invalid as a toast", async () => {
    mocked.submitAction.mockResolvedValueOnce({ outcome: "nothing", message: "Nothing interesting happens." });
    await renderStudy();
    await goToView(2);
    await press("hotspot-door");
    expect(await screen.findByText("This does not open yet.")).toBeTruthy();
    await press("result-continue");

    mocked.submitAction.mockResolvedValueOnce({ outcome: "invalid", message: "That is not something you can interact with yet." });
    await press("hotspot-door");
    expect(await screen.findByText("That is not something you can interact with yet.")).toBeTruthy();
  });

  it("keeps the scene and offers a retry when the network drops", async () => {
    mocked.submitAction.mockRejectedValueOnce(new TypeError("Network request failed"));
    await renderStudy();
    await press("hotspot-desk_drawer");
    expect(await screen.findByText("No connection. Your progress is safe.")).toBeTruthy();

    mocked.submitAction.mockResolvedValueOnce(studyServer()({ type: "inspect", hotspot_id: "desk_drawer" }));
    await fireEvent.press(screen.getByLabelText("Try again"));
    await screen.findByTestId("result-sheet");
    expect(mocked.submitAction).toHaveBeenCalledTimes(2);
    expect(lastAction()).toEqual({ type: "inspect", hotspot_id: "desk_drawer" });
  });
});

const flat = (node: { props: Record<string, unknown> }) => StyleSheet.flatten(node.props.style as Parameters<typeof StyleSheet.flatten>[0]) ?? {};
const P = ref.layout.play;

describe("Player: the reference look", () => {
  it("frames the photo as 02 does: flat ground, Once's squares, the serif title over the view meta", async () => {
    mocked.submitAction.mockImplementation(async (_s, action) => studyServer()(action));
    await renderStudy();
    expect(flat(screen.getByTestId("scene-view"))).toMatchObject({ backgroundColor: ref.color.ground });
    for (const id of ["player-back", "player-options"]) {
      expect(flat(screen.getByTestId(id))).toMatchObject({
        width: ref.button.square.size,
        height: ref.button.square.size,
        borderRadius: ref.button.square.radius,
        backgroundColor: ref.button.square.fill,
        borderColor: P.squareRim,
      });
    }
    // Explore as list is gone; every object is a button on the photo instead.
    expect(screen.queryByLabelText("Explore as list")).toBeNull();
    expect(screen.getByLabelText("Back")).toBeTruthy();
    expect(screen.getByLabelText("Case options")).toBeTruthy();
    expect(flat(screen.getByText("The Study"))).toMatchObject({ ...ref.type.serifTitle, color: ref.color.textPrimary });
    expect(flat(screen.getByText("View 1 of 3", { includeHiddenElements: true }))).toMatchObject({ ...ref.type.meta, color: ref.color.textSecondary });
    // The coach mark is a 07 card with white text.
    expect(flat(screen.getByTestId("coach-card"))).toMatchObject({ backgroundColor: ref.color.raised, borderRadius: P.card.radius });
    // No strip of thumbnails: page dots, the view in view white.
    expect(screen.queryByTestId("scene-0")).toBeNull();
    expect(flat(screen.getByTestId("view-dot-0-current"))).toMatchObject({ backgroundColor: ref.color.textPrimary });
    expect(flat(screen.getByTestId("view-dot-1"))).toMatchObject({ backgroundColor: ref.color.textSecondary });
  });

  it("lays the photo full bleed: the screen's width, square edges, cropped only into hotspot-free margins", async () => {
    await renderStudy();
    const win = flat(screen.getByTestId("scene-window"));
    // 3:4 on 393 is 524 tall; the 540 area holds it whole, so nothing is cropped.
    expect(win).toMatchObject({ width: AREA.width, height: AREA.width / 0.75, overflow: "hidden" });
    expect(win.borderRadius).toBeUndefined();
    // Shorter than the photo: cropped evenly top and bottom while no hotspot is cut ...
    await fireEvent(screen.getByTestId("scene-view"), "layout", { nativeEvent: { layout: { ...AREA, height: 480 } } });
    expect(flat(screen.getByTestId("scene-window"))).toMatchObject({ width: AREA.width, height: 480 });
    // ... and contained (narrower, uncropped) when the crop would cut one or pass maxCrop.
    await fireEvent(screen.getByTestId("scene-view"), "layout", { nativeEvent: { layout: { ...AREA, height: 400 } } });
    expect(flat(screen.getByTestId("scene-window"))).toMatchObject({ width: 400 * 0.75, height: 400 });
  });

  it("offers the views as an adjustable control on the page dots, with a tick as each page settles", async () => {
    await renderStudy();
    const dots = screen.getByTestId("view-dots");
    expect(dots.props.accessibilityRole).toBe("adjustable");
    expect(dots.props.accessibilityLabel).toBe("View");
    expect(dots.props.accessibilityValue.text).toBe("1 of 3");
    mockFeedback.tick.mockClear();
    await goToView(1);
    expect(mockFeedback.tick).toHaveBeenCalledTimes(1);
    // The coach's target (the drawer, on view 1) is marked as something new once it's off screen.
    expect(screen.getByTestId("view-dots").props.accessibilityValue.text).toBe("2 of 3. Something new on view 1");
    expect(screen.getByTestId("view-dot-0-new")).toBeTruthy();
    expect(screen.getByText("View 2 of 3", { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByLabelText("View 2 of 3")).toBeTruthy();
    // Past the last view, nothing happens.
    await goToView(2);
    await fireEvent(screen.getByTestId("view-dots"), "accessibilityAction", action("increment"));
    expect(screen.getByTestId("view-dots").props.accessibilityValue.text).toMatch(/^3 of 3/);
  });

  it("reads hotspots in reading order while drawing the largest first", async () => {
    await renderStudy();
    await goToView(1);
    const layer = screen.getByTestId("hotspot-layer");
    // Drawn largest first (rug, cabinet); read top to bottom (cabinet at y 0.20, then the rug at 0.70).
    expect(layer.props.experimental_accessibilityOrder).toEqual(["hotspot-cabinet", "hotspot-rug"]);
    expect(screen.getByTestId("hotspot-cabinet").props.nativeID).toBe("hotspot-cabinet");
  });

  it("rings the chosen item and the photo in white in Use mode, with a card that says how to use it", async () => {
    const respond = studyServer();
    mocked.submitAction.mockImplementation(async (_s, action) => respond(action));
    await renderStudy();
    await press("hotspot-desk_drawer");
    const bar = await screen.findByTestId("result-continue");
    // 07's white bar on the kit's dark sheet; finding an item is a success haptic.
    expect(mockFeedback.success).toHaveBeenCalled();
    expect(flat(bar)).toMatchObject({ backgroundColor: P.bar.fill, borderRadius: P.bar.radius });
    expect(flat(screen.getByTestId("result-sheet"))).toMatchObject({ backgroundColor: ref.color.ground, borderTopLeftRadius: ref.radius.bottomSheet });
    await press("result-continue");

    expect(screen.queryByTestId("scene-armed")).toBeNull();
    mockFeedback.tick.mockClear();
    await press("item-brass_key");
    expect(mockFeedback.tick).toHaveBeenCalledTimes(1);
    expect(flat(screen.getByTestId("item-brass_key-selected"))).toMatchObject({ borderColor: ref.color.textPrimary, borderWidth: P.tray.selectedRing });
    expect(flat(screen.getByTestId("scene-armed"))).toMatchObject({ borderColor: ref.color.textPrimary, borderWidth: P.photo.armed });
    expect(screen.getByTestId("use-card")).toBeTruthy();
    expect(screen.getByText("Select an object in the room to use this artifact.")).toBeTruthy();
    // The use card takes the coach's place.
    expect(screen.queryByTestId("coach-card")).toBeNull();
    // Using it where it doesn't work: a warning haptic and a toast.
    mocked.submitAction.mockResolvedValueOnce({ outcome: "nothing", message: "Nothing interesting happens." });
    await press("hotspot-bookshelf");
    expect(await screen.findByText("That doesn't work here.")).toBeTruthy();
    expect(mockFeedback.warning).toHaveBeenCalled();
    // Cancel leaves Use mode.
    await fireEvent.press(screen.getByLabelText("Cancel"));
    expect(screen.queryByTestId("scene-armed")).toBeNull();
  });

  it("presses a hotspot after a short delay, so a swipe that starts on one doesn't buzz", async () => {
    await renderStudy();
    const drawer = screen.getByTestId("hotspot-desk_drawer");
    expect(drawer.props.unstable_pressDelay ?? P.hotspotPressDelay).toBe(P.hotspotPressDelay);
    mockFeedback.press.mockClear();
    await fireEvent(drawer, "pressIn");
    expect(mockFeedback.press).toHaveBeenCalledTimes(1);
  });

  it("opens Case options on the kit's dark sheet, with no Explore as list and a tick on the switch", async () => {
    await renderStudy();
    await press("player-options");
    expect(flat(await screen.findByTestId("case-options"))).toMatchObject({ backgroundColor: ref.color.ground });
    expect(screen.queryByText("Explore as list")).toBeNull();
    mockFeedback.tick.mockClear();
    await fireEvent(screen.getByLabelText("Show interactives"), "valueChange", true);
    expect(mockFeedback.tick).toHaveBeenCalledTimes(1);
  });

  it("shows a failed request as 02's error line on a card, with Try again and Dismiss", async () => {
    mocked.submitAction.mockRejectedValueOnce(new TypeError("Network request failed"));
    await renderStudy();
    await press("hotspot-desk_drawer");
    const banner = await screen.findByTestId("failure-banner");
    expect(flat(banner)).toMatchObject({ backgroundColor: ref.color.raised });
    expect(flat(screen.getByText("No connection. Your progress is safe."))).toMatchObject({ color: ref.color.textPrimary });
    await fireEvent.press(screen.getByLabelText("Dismiss"));
    expect(screen.queryByTestId("failure-banner")).toBeNull();
  });
});

describe("code wheels", () => {
  async function openSafe() {
    const respond = studyServer();
    mocked.submitAction.mockImplementation(async (_s, action) => respond(action));
    await renderStudy();
    // Straight to the safe: the key opens the cabinet on view 2.
    await press("hotspot-desk_drawer");
    await press("result-continue");
    await goToView(1);
    await press("item-brass_key");
    await press("hotspot-cabinet");
    await press("result-continue");
    await press("hotspot-safe");
    await screen.findByTestId("code-sheet");
  }

  it("makes each wheel one adjustable element that rolls with a tick per digit, wrapping 9 to 0", async () => {
    await openSafe();
    const wheel = screen.getByTestId("tumbler-0");
    expect(wheel.props.accessibilityRole).toBe("adjustable");
    expect(wheel.props.accessibilityLabel).toBe("Digit 1");
    expect(wheel.props.accessibilityValue).toEqual({ text: "0" });
    mockFeedback.tick.mockClear();
    await fireEvent(wheel, "accessibilityAction", action("decrement"));
    expect(screen.getByTestId("tumbler-0").props.accessibilityValue).toEqual({ text: "9" });
    await fireEvent(screen.getByTestId("tumbler-0"), "accessibilityAction", action("increment"));
    await fireEvent(screen.getByTestId("tumbler-0"), "accessibilityAction", action("increment"));
    expect(screen.getByTestId("tumbler-0").props.accessibilityValue).toEqual({ text: "1" });
    expect(mockFeedback.tick).toHaveBeenCalledTimes(3);
    // The neighbours are tap targets too: the one below is one more, the one above one less.
    await fireEvent.press(screen.getByTestId("tumbler-0-next", { includeHiddenElements: true }));
    expect(screen.getByTestId("tumbler-0").props.accessibilityValue).toEqual({ text: "2" });
    await fireEvent.press(screen.getByTestId("tumbler-0-prev", { includeHiddenElements: true }));
    expect(screen.getByTestId("tumbler-0").props.accessibilityValue).toEqual({ text: "1" });
    // No caret steppers any more.
    expect(screen.queryByLabelText(/Increase digit/)).toBeNull();
  });

  it("answers a wrong code with an error haptic and the white error line, and resets the wheels", async () => {
    await openSafe();
    mockFeedback.error.mockClear();
    mockFeedback.success.mockClear();
    await dial("1234");
    expect(await screen.findByText("Nothing happens.")).toBeTruthy();
    expect(mockFeedback.error).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("tumbler-0").props.accessibilityValue).toEqual({ text: "0" });
    // The right code: the lock opens with one success haptic, no press before it.
    mockFeedback.press.mockClear();
    await dial("0427");
    await screen.findByTestId("result-sheet");
    expect(mockFeedback.success).toHaveBeenCalledTimes(1);
    expect(mockFeedback.press).not.toHaveBeenCalled();
  });
});

describe("tokens only", () => {
  const ROOT = path.join(__dirname, "..");
  const APP = path.join(__dirname, "../../../app");
  const files = [
    ...fs.readdirSync(ROOT).filter((f) => /\.tsx?$/.test(f)).map((f) => path.join(ROOT, f)),
    path.join(APP, "tutorial/index.tsx"),
    path.join(APP, "tutorial/complete.tsx"),
    path.join(APP, "play/[roomId].tsx"),
    path.join(__dirname, "../../components/noir/DarkSheet.tsx"),
  ];

  it.each(files.map((f) => [path.relative(path.join(__dirname, "../../.."), f), f]))("%s uses ref and the kit only", (_name, file) => {
    const source = fs.readFileSync(file, "utf8");
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|fontFamily\s*[:=]/);
    // No live components, grain or materials.
    expect(source).not.toMatch(/@\/components\/(Button|IconButton|Sheet|Text|Grain|Wordmark)"|@\/theme\/materials/);
    // From the live tokens only motion, z and hit.
    const imported = source.match(/import \{([^}]*)\} from "@\/theme\/tokens"/)?.[1] ?? "";
    const names = imported.split(",").map((n) => n.trim()).filter(Boolean);
    expect(names.filter((n) => !["motion", "ref", "z", "hit"].includes(n))).toEqual([]);
  });
});

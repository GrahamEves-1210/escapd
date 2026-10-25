import { Image } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as api from "@/lib/escapd-api";
import type { ActionResult, GameAction, SessionState } from "@/lib/puzzle-types";
import { initialState, sessionRow, studyPublic, studySecret } from "@/test-utils/seed";
import { TUTORIAL_ROOM_ID } from "@/tutorial/assets";
import { tutorialCoach } from "@/tutorial/coach";
import { Player } from "../Player";

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

/** Give the newest scene a size so its hotspots lay out. */
async function layoutScene() {
  const scenes = await screen.findAllByTestId("scene-view");
  await fireEvent(scenes[scenes.length - 1], "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 520 } } });
}

const press = async (testID: string) => fireEvent.press(await screen.findByTestId(testID));
const lastAction = () => mocked.submitAction.mock.calls[mocked.submitAction.mock.calls.length - 1][1];

/** Fixed-length tumblers start at 0000. Each `up` steps that wheel by one. */
async function dial(code: string) {
  for (let i = 0; i < code.length; i++) {
    for (let step = 0; step < Number(code[i]); step++) await press(`tumbler-${i}-up`);
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
    await press("scene-1");
    await layoutScene();
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
    expect(screen.getByTestId("code-sheet")).toBeTruthy();
    await dial("0427");
    expect(lastAction()).toEqual({ type: "solve", puzzle_id: "open_safe", answer: "0427" });
    await screen.findByTestId("result-sheet");
    await press("result-continue");

    // Completion comes from the server's `completed`, then hands off.
    await press("scene-2");
    await layoutScene();
    await press("hotspot-door");
    await waitFor(() => expect(onComplete).toHaveBeenCalledWith({
      message: secret.puzzles.escape.message,
      exitMessage: def.exit.message,
    }), { timeout: 3000 });
  });

  it("says the door does not open yet, and shows invalid as a toast", async () => {
    mocked.submitAction.mockResolvedValueOnce({ outcome: "nothing", message: "Nothing interesting happens." });
    await renderStudy();
    await press("scene-2");
    await layoutScene();
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

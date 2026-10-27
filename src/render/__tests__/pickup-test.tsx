// Picking up an item, end to end in the player, with measuring that succeeds
// (Jest can't measure, so measureInWindow answers here), so the items really
// fly. The crash report was "it's crashing when I pick up an item"; these pin
// the logic around the flight: it lands once with one cue, a restart or
// leaving drops it, and no new clue can open while the last one slides away.
import { Image } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as api from "@/lib/escapd-api";
import type { ActionResult, SessionState } from "@/lib/puzzle-types";
import { initialState, sessionRow, studyPublic, studySecret } from "@/test-utils/seed";
import { TUTORIAL_ROOM_ID } from "@/tutorial/assets";
import { ref } from "@/theme/tokens";
import { Player } from "../Player";

const P = ref.layout.play;
const hidden = { includeHiddenElements: true };

jest.setTimeout(60_000);

const mockFeedback = {
  tick: jest.fn(), tap: jest.fn(), press: jest.fn(), thud: jest.fn(), success: jest.fn(), warning: jest.fn(), error: jest.fn(),
  paper: jest.fn(), pickup: jest.fn(), wrongCode: jest.fn(), unlock: jest.fn(), stamp: jest.fn(), solved: jest.fn(),
  shutter: jest.fn(), typewriter: jest.fn(),
};
jest.mock("@/game/feedback", () => ({ useFeedback: () => mockFeedback }));

// Every view measures as a box, so the pickup flies (the real measureInWindow is tested in diegetic-test).
const mockMeasure = jest.fn(async (node: unknown) => (node ? { x: 10, y: 20, width: 60, height: 60 } : null));
jest.mock("../PickupFlight", () => {
  const actual = jest.requireActual("../PickupFlight");
  return { ...actual, measureInWindow: (node: unknown) => mockMeasure(node) };
});

jest.mock("@/tutorial/assets", () => ({
  TUTORIAL_ROOM_ID: "00000000-0000-4000-8000-000000000001",
  bundledScene: () => 1,
}));

jest.mock("@/lib/supabase", () => ({
  supabase: {
    rpc: jest.fn(),
    auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) },
  },
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
    getSettings: jest.fn().mockRejectedValue(new Error("not in tests")),
    updateSettings: jest.fn(),
  };
});

const mocked = api as jest.Mocked<typeof api>;
const def = studyPublic();
const secret = studySecret();
const AREA = { x: 0, y: 0, width: 393, height: 540 };
const press = async (testID: string) => fireEvent.press(await screen.findByTestId(testID));
const sheetGone = () => waitFor(() => expect(screen.queryByTestId("result-sheet", hidden)).toBeNull());

/** The desk drawer gives up `items`. */
const found = (items: string[]): ActionResult => {
  const state: SessionState = { ...initialState(def), solved: ["find_key"], inventory: items };
  return {
    outcome: "solved", puzzle_id: "find_key", message: secret.puzzles.find_key.message, gained_items: items,
    consumed_items: [], revealed_hotspots: [], completed: false, state,
  };
};

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  mocked.startOrResume.mockResolvedValue(sessionRow(def, { room_id: TUTORIAL_ROOM_ID }));
  mocked.getPlayableDefinition.mockResolvedValue(def);
  jest.spyOn(Image, "resolveAssetSource").mockReturnValue({ uri: "scene.jpg", width: 1200, height: 1600, scale: 1 });
});

async function layoutScene() {
  await fireEvent(await screen.findByTestId("scene-pager"), "layout", { nativeEvent: { layout: AREA } });
  for (const scene of await screen.findAllByTestId("scene-view")) await fireEvent(scene, "layout", { nativeEvent: { layout: AREA } });
}

async function renderStudy() {
  const view = await render(<Player roomId={TUTORIAL_ROOM_ID} onExit={jest.fn()} onComplete={jest.fn()} />, { wrapper: GestureHandlerRootView });
  await layoutScene();
  return view;
}

describe("the pickup's flight in the player", () => {
  it("flies the item from the object, then lands it once, with one cue", async () => {
    mocked.submitAction.mockResolvedValueOnce(found(["brass_key"]));
    await renderStudy();
    await press("hotspot-desk_drawer");
    await press("result-continue");
    await sheetGone();
    // It flies first: still arriving, no cue yet.
    await screen.findByTestId("pickup-flight-brass_key", hidden);
    expect(screen.getByTestId("item-brass_key-arriving", hidden)).toBeTruthy();
    await waitFor(() => expect(screen.queryByTestId("pickup-flight-brass_key", hidden)).toBeNull());
    expect(screen.queryByTestId("item-brass_key-arriving", hidden)).toBeNull();
    // Past the fallback too: the animation's end and the timer never land it twice.
    await act(() => new Promise((r) => setTimeout(r, P.pickup.landSlack + 100)));
    expect(mockFeedback.pickup).toHaveBeenCalledTimes(1);
  });

  it("two items from one clue fly together and land with a single cue", async () => {
    mocked.submitAction.mockResolvedValueOnce(found(["brass_key", "torn_note_left"]));
    await renderStudy();
    await press("hotspot-desk_drawer");
    await press("result-continue");
    await sheetGone();
    await screen.findByTestId("pickup-flight-brass_key", hidden);
    expect(screen.getByTestId("pickup-flight-torn_note_left", hidden)).toBeTruthy();
    await waitFor(() => expect(screen.queryByTestId("pickup-flight-torn_note_left", hidden)).toBeNull());
    await waitFor(() => expect(screen.queryByTestId("pickup-flight-brass_key", hidden)).toBeNull());
    await act(() => new Promise((r) => setTimeout(r, P.pickup.landSlack + 100)));
    expect(mockFeedback.pickup).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("item-brass_key-arriving", hidden)).toBeNull();
    expect(screen.queryByTestId("item-torn_note_left-arriving", hidden)).toBeNull();
  });

  it("an object that can't be measured: the item simply lands", async () => {
    mockMeasure.mockImplementation(async () => null);
    mocked.submitAction.mockResolvedValueOnce(found(["brass_key"]));
    await renderStudy();
    await press("hotspot-desk_drawer");
    await press("result-continue");
    await sheetGone();
    await waitFor(() => expect(mockFeedback.pickup).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId("pickup-flight-brass_key", hidden)).toBeNull();
    expect(screen.queryByTestId("item-brass_key-arriving", hidden)).toBeNull();
    mockMeasure.mockImplementation(async (node: unknown) => (node ? { x: 10, y: 20, width: 60, height: 60 } : null));
  });

  it("leaving mid-flight lands nothing late: no cue after the player has gone", async () => {
    mocked.submitAction.mockResolvedValueOnce(found(["brass_key"]));
    const view = await renderStudy();
    await press("hotspot-desk_drawer");
    await press("result-continue");
    await sheetGone();
    await screen.findByTestId("pickup-flight-brass_key", hidden);
    await view.unmount();
    await act(() => new Promise((r) => setTimeout(r, P.pickup.flight + P.pickup.landSlack + 100)));
    expect(mockFeedback.pickup).not.toHaveBeenCalled();
  });

  it("leaving while the pickup is still measuring launches nothing", async () => {
    let answer: () => void = () => {};
    const held = new Promise<void>((r) => {
      answer = r;
    });
    mockMeasure.mockImplementation(async (node: unknown) => {
      await held;
      return node ? { x: 10, y: 20, width: 60, height: 60 } : null;
    });
    mocked.submitAction.mockResolvedValueOnce(found(["brass_key"]));
    const view = await renderStudy();
    await press("hotspot-desk_drawer");
    await press("result-continue");
    await sheetGone();
    await view.unmount();
    await act(async () => answer());
    expect(mockFeedback.pickup).not.toHaveBeenCalled();
    mockMeasure.mockImplementation(async (node: unknown) => (node ? { x: 10, y: 20, width: 60, height: 60 } : null));
  });

  it("ignores an object tapped while the clue is still sliding away", async () => {
    mocked.submitAction.mockResolvedValueOnce(found(["brass_key"]));
    await renderStudy();
    await press("hotspot-desk_drawer");
    await screen.findByTestId("result-sheet");
    expect(mocked.submitAction).toHaveBeenCalledTimes(1);
    await press("result-continue");
    // The sheet lets touches through as it slides; the scene doesn't take them yet.
    await fireEvent.press(screen.getByTestId("hotspot-bookshelf", hidden));
    expect(mocked.submitAction).toHaveBeenCalledTimes(1);
    await sheetGone();
    // Once it is gone, objects answer again.
    mocked.submitAction.mockResolvedValueOnce({ outcome: "nothing", message: "Nothing interesting happens." });
    await press("hotspot-bookshelf");
    expect(mocked.submitAction).toHaveBeenCalledTimes(2);
  });
});

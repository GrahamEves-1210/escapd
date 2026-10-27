// A taken object leaves the room, in the player: the patch (baked by
// removalPatch.ts, stubbed here) covers the object only once its inspect is
// solved and the clue pocketed, the object stops being a target, the items
// still fly out of it, and a resumed case shows the room as it was left.
import { Image, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as api from "@/lib/escapd-api";
import type { ActionResult, SessionState } from "@/lib/puzzle-types";
import { initialState, sessionRow, studyPublic, studySecret } from "@/test-utils/seed";
import { TUTORIAL_ROOM_ID } from "@/tutorial/assets";
import { Player } from "../Player";
import type { RemovalPatch } from "../removalPatch";

const hidden = { includeHiddenElements: true };

jest.setTimeout(60_000);

const mockFeedback = {
  tick: jest.fn(), tap: jest.fn(), press: jest.fn(), thud: jest.fn(), success: jest.fn(), warning: jest.fn(), error: jest.fn(),
  paper: jest.fn(), pickup: jest.fn(), wrongCode: jest.fn(), unlock: jest.fn(), stamp: jest.fn(), solved: jest.fn(),
  shutter: jest.fn(), typewriter: jest.fn(),
};
jest.mock("@/game/feedback", () => ({ useFeedback: () => mockFeedback }));

// Every view measures as a box, so the pickup flies.
jest.mock("../PickupFlight", () => {
  const actual = jest.requireActual("../PickupFlight");
  return { ...actual, measureInWindow: async (node: unknown) => (node ? { x: 10, y: 20, width: 60, height: 60 } : null) };
});

// The study's desk drawer stands in for a removable object; its patch is "baked".
const mockPatch: RemovalPatch = {
  hotspotId: "desk_drawer",
  puzzleId: "find_key",
  photoIndex: 0,
  rect: { x: 0.06, y: 0.53, w: 0.33, h: 0.16 },
  uri: "data:image/png;base64,AAAA",
};
jest.mock("../removalPatch", () => ({ useRoomRemoval: () => mockPatch }));

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
const PATCH = "removed-desk_drawer";

const solvedState = (inventory: string[] = []): SessionState => ({ ...initialState(def), solved: ["find_key"], inventory });

const found = (items: string[]): ActionResult => ({
  outcome: "solved", puzzle_id: "find_key", message: secret.puzzles.find_key.message, gained_items: items,
  consumed_items: [], revealed_hotspots: [], completed: false, state: solvedState(items),
});

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  mocked.startOrResume.mockResolvedValue(sessionRow(def, { room_id: TUTORIAL_ROOM_ID }));
  mocked.getPlayableDefinition.mockResolvedValue(def);
  jest.spyOn(Image, "resolveAssetSource").mockReturnValue({ uri: "scene.jpg", width: 1200, height: 1600, scale: 1 });
});

async function renderStudy() {
  const view = await render(
    <Player roomId={TUTORIAL_ROOM_ID} onExit={jest.fn()} onComplete={jest.fn()} />,
    { wrapper: GestureHandlerRootView },
  );
  await fireEvent(await screen.findByTestId("scene-pager"), "layout", { nativeEvent: { layout: AREA } });
  for (const scene of await screen.findAllByTestId("scene-view")) await fireEvent(scene, "layout", { nativeEvent: { layout: AREA } });
  return view;
}

describe("a taken object leaves the room", () => {
  it("covers the object only once its inspect is solved and the clue pocketed, as the items fly out", async () => {
    mocked.submitAction.mockResolvedValueOnce(found(["brass_key"]));
    await renderStudy();
    const target = await screen.findByTestId("hotspot-desk_drawer");
    expect(screen.queryByTestId(PATCH, hidden)).toBeNull();
    expect(target.props.accessibilityElementsHidden).toBeFalsy();

    fireEvent.press(target);
    await screen.findByTestId("result-continue");
    // Solved, but the clue is still open: the object is still there.
    expect(screen.queryByTestId(PATCH, hidden)).toBeNull();

    fireEvent.press(screen.getByTestId("result-continue"));
    const patch = await screen.findByTestId(PATCH, hidden);
    // Over the patch's rect on the stage (393 x 524 at 3:4), never touchable.
    expect(StyleSheet.flatten(patch.props.style)).toMatchObject({ left: 0.06 * 393, top: 0.53 * 524, width: 0.33 * 393 });
    expect(patch.props.pointerEvents).toBe("none");
    // The items still fly out of it.
    await screen.findByTestId("pickup-flight-brass_key", hidden);
    // It is gone: not a target, not read out.
    const gone = screen.getByTestId("hotspot-desk_drawer", hidden);
    expect(gone.props.accessibilityElementsHidden).toBe(true);
    expect(gone.props.accessibilityState).toMatchObject({ disabled: true });
    fireEvent.press(gone);
    expect(mocked.submitAction).toHaveBeenCalledTimes(1);
    // The other objects are untouched.
    expect(screen.getByTestId("hotspot-bookshelf").props.accessibilityElementsHidden).toBeFalsy();
    await waitFor(() => expect(screen.queryByTestId("pickup-flight-brass_key", hidden)).toBeNull());
  });

  it("shows the room as left on resume, with no action", async () => {
    mocked.startOrResume.mockResolvedValue(sessionRow(def, { room_id: TUTORIAL_ROOM_ID, state: solvedState(["brass_key"]) as never }));
    await renderStudy();
    await screen.findByTestId(PATCH, hidden);
    expect(screen.getByTestId("hotspot-desk_drawer", hidden).props.accessibilityElementsHidden).toBe(true);
    expect(mocked.submitAction).not.toHaveBeenCalled();
  });

  it("leaves the room whole while that puzzle is unsolved, whatever else is solved", async () => {
    mocked.startOrResume.mockResolvedValue(sessionRow(def, {
      room_id: TUTORIAL_ROOM_ID,
      state: { ...initialState(def), solved: ["find_note_left"], inventory: ["torn_note_left"] } as never,
    }));
    await renderStudy();
    await screen.findByTestId("hotspot-desk_drawer");
    expect(screen.queryByTestId(PATCH, hidden)).toBeNull();
  });
});

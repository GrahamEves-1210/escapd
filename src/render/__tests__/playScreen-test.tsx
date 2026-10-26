// The diegetic play screen in the player (GAME_FEEL_PROMPT.md, 1 and 4): the
// item pickup into the evidence tray, clues as objects, "Ask the informant"
// over the server's hint ladder, and the case clock. The Study, with
// submit_action and use_hint scripted per test.
import { Image, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import * as api from "@/lib/escapd-api";
import { supabase } from "@/lib/supabase";
import type { ActionResult, HintResult, SessionState } from "@/lib/puzzle-types";
import { initialState, sessionRow, studyPublic, studySecret } from "@/test-utils/seed";
import { TUTORIAL_ROOM_ID } from "@/tutorial/assets";
import { PreferencesProvider } from "@/game/preferences";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { modeThemes, ref } from "@/theme/tokens";
import { Player } from "../Player";

const NOIR = modeThemes.noir;
const P = ref.layout.play;
const hidden = { includeHiddenElements: true };

jest.setTimeout(60_000);

const mockFeedback = {
  tick: jest.fn(), tap: jest.fn(), press: jest.fn(), thud: jest.fn(), success: jest.fn(), warning: jest.fn(), error: jest.fn(),
  paper: jest.fn(), pickup: jest.fn(), wrongCode: jest.fn(), unlock: jest.fn(), stamp: jest.fn(), solved: jest.fn(),
  shutter: jest.fn(), typewriter: jest.fn(),
};
jest.mock("@/game/feedback", () => ({ useFeedback: () => mockFeedback }));

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
const rpc = supabase.rpc as unknown as jest.Mock;
const def = studyPublic();
const secret = studySecret();
const AREA = { x: 0, y: 0, width: 393, height: 540 };
const flat = (node: { props: Record<string, unknown> }) => StyleSheet.flatten(node.props.style as Parameters<typeof StyleSheet.flatten>[0]) ?? {};
const press = async (testID: string) => fireEvent.press(await screen.findByTestId(testID));
// The result sheet's continue slides the sheet away first (DarkSheet), then it closes.
const continueResult = async () => {
  await press("result-continue");
  await waitFor(() => expect(screen.queryByTestId("result-sheet", { includeHiddenElements: true })).toBeNull());
};

const keyFound = (): ActionResult => {
  const state: SessionState = { ...initialState(def), solved: ["find_key"], inventory: ["brass_key"] };
  return {
    outcome: "solved", puzzle_id: "find_key", message: secret.puzzles.find_key.message, gained_items: ["brass_key"],
    consumed_items: [], revealed_hotspots: [], completed: false, state,
  };
};

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  mocked.startOrResume.mockResolvedValue(sessionRow(def, { room_id: TUTORIAL_ROOM_ID, started_at: new Date(Date.now() - 125_000).toISOString() }));
  mocked.getPlayableDefinition.mockResolvedValue(def);
  jest.spyOn(Image, "resolveAssetSource").mockReturnValue({ uri: "scene.jpg", width: 1200, height: 1600, scale: 1 });
});

async function layoutScene() {
  await fireEvent(await screen.findByTestId("scene-pager"), "layout", { nativeEvent: { layout: AREA } });
  for (const scene of await screen.findAllByTestId("scene-view")) await fireEvent(scene, "layout", { nativeEvent: { layout: AREA } });
}

async function renderStudy({ reduced = false, prefs = false } = {}) {
  const Wrapper = ({ children }: { children: ReactNode }) => {
    const themed = <ThemeProvider reducedMotion={reduced}>{children}</ThemeProvider>;
    return <GestureHandlerRootView>{prefs ? <PreferencesProvider>{themed}</PreferencesProvider> : themed}</GestureHandlerRootView>;
  };
  await render(<Player roomId={TUTORIAL_ROOM_ID} onExit={jest.fn()} onComplete={jest.fn()} />, { wrapper: Wrapper });
  await layoutScene();
}

describe("picking up an item", () => {
  it("holds the item off the tray until the clue is pocketed, then lands it with the pickup cue", async () => {
    mocked.submitAction.mockResolvedValueOnce(keyFound());
    await renderStudy();
    await press("hotspot-desk_drawer");
    await screen.findByTestId("result-sheet");
    // In the server's inventory, but not in the tray yet: its slot is kept, the key not drawn.
    expect(screen.getByTestId("item-brass_key-arriving", hidden)).toBeTruthy();
    expect(mockFeedback.pickup).not.toHaveBeenCalled();
    await continueResult();
    // Jest can't measure, so the key lands without a flight; on a device it flies first.
    await waitFor(() => expect(mockFeedback.pickup).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId("item-brass_key-arriving", hidden)).toBeNull();
    expect(screen.getByTestId("item-brass_key")).toBeTruthy();
  });

  it("under reduced motion, never flies: the item appears in the tray, the haptic kept", async () => {
    mocked.submitAction.mockResolvedValueOnce(keyFound());
    await renderStudy({ reduced: true });
    await press("hotspot-desk_drawer");
    await continueResult();
    expect(mockFeedback.pickup).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("pickup-flight-brass_key", hidden)).toBeNull();
    expect(screen.queryByTestId("item-brass_key-arriving", hidden)).toBeNull();
  });

  it("keeps the tray working as before: select, Use mode, cancel", async () => {
    mocked.submitAction.mockResolvedValueOnce(keyFound());
    await renderStudy();
    await press("hotspot-desk_drawer");
    await continueResult();
    await press("item-brass_key");
    expect(flat(screen.getByTestId("item-brass_key-selected"))).toMatchObject({ borderColor: NOIR.ink, borderWidth: P.tray.selectedRing });
    expect(screen.getByTestId("use-card")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Cancel"));
    expect(screen.queryByTestId("use-card")).toBeNull();
  });
});

describe("the evidence tray and clue objects", () => {
  it("draws the tray in the mode's leather with a stitched seam, stamped EVIDENCE", async () => {
    await renderStudy();
    const M = P.evidence.materials.noir;
    expect(flat(screen.getByTestId("evidence-tray"))).toMatchObject({ backgroundColor: M.leather, borderColor: M.edge });
    expect(flat(screen.getByTestId("evidence-stitch"))).toMatchObject({ borderColor: M.stitch, borderStyle: "dashed" });
    expect(screen.getByText("Evidence")).toBeTruthy();
    expect(screen.getByText("What you find goes here.")).toBeTruthy();
  });

  it("shows a clue as a typed note on paper with a polaroid of the object, the server's words as they are, and a paper cue", async () => {
    mocked.submitAction.mockResolvedValueOnce(keyFound());
    await renderStudy();
    await press("hotspot-desk_drawer");
    await screen.findByTestId("result-sheet");
    const paper = P.clue.papers.noir;
    expect(flat(screen.getByTestId("result-text-paper"))).toMatchObject({ backgroundColor: paper.paper });
    expect(flat(screen.getByText(secret.puzzles.find_key.message!))).toMatchObject({ ...P.type.note, color: paper.ink });
    expect(screen.getByTestId("clue-polaroid").props.accessibilityLabel).toMatch(/^Photo of the /);
    expect(screen.getByTestId("clue-tag-brass_key")).toBeTruthy();
    // A solve: the success haptic first, the paper a beat later, never on top of it.
    expect(mockFeedback.success).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(mockFeedback.paper).toHaveBeenCalledTimes(1));
  });
});

describe("Ask the informant", () => {
  const ok = (rung: number, hint: string, puzzle = "find_key"): HintResult => ({
    status: "ok", puzzle_id: puzzle, rung, total_rungs: 3, hint, already_revealed: false, hints_used: rung,
  });

  it("opens free, then shows the server's hint verbatim as his line, one rung at a time", async () => {
    await renderStudy();
    await press("informant-ask");
    await screen.findByTestId("informant-sheet");
    expect(mockFeedback.paper).toHaveBeenCalled();
    // Opening asks nothing and costs nothing.
    expect(rpc).not.toHaveBeenCalled();
    expect(screen.getByTestId("informant-waiting")).toBeTruthy();
    expect(screen.getByTestId("informant-figure-fedora", hidden)).toBeTruthy();

    rpc.mockResolvedValueOnce({ data: ok(1, "Desks keep secrets. Start there."), error: null });
    await press("informant-request");
    expect(rpc).toHaveBeenCalledWith("use_hint", { p_session_id: "s1", p_rung: 1 });
    expect((await screen.findByTestId("informant-hint")).props.children).toBe("Desks keep secrets. Start there.");
    expect(screen.getByTestId("informant-line").props.accessibilityLabel).toBe("Word on the street: Desks keep secrets. Start there.");
    expect(screen.getByText("Tip 1 of 3")).toBeTruthy();
    // His line is typed out: the typewriter cue, once.
    expect(mockFeedback.typewriter).toHaveBeenCalledTimes(1);

    rpc.mockResolvedValueOnce({ data: ok(2, "The drawer on the left."), error: null });
    await fireEvent.press(screen.getByText("Lean on him"));
    expect(rpc).toHaveBeenLastCalledWith("use_hint", { p_session_id: "s1", p_rung: 2 });
    expect(await screen.findByText("The drawer on the left.")).toBeTruthy();
    expect(screen.getAllByTestId("informant-line")).toHaveLength(2);
    // A hint is never a game action.
    expect(mocked.submitAction).not.toHaveBeenCalled();

    // Closed and opened again: the tips given so far stay, for free.
    await fireEvent.press(screen.getByLabelText("Close"));
    await press("informant-ask");
    expect(await screen.findAllByTestId("informant-line")).toHaveLength(2);
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it("shows the server's own message when hints are off or there is none", async () => {
    await renderStudy();
    await press("informant-ask");
    rpc.mockResolvedValueOnce({ data: { status: "no_hints", puzzle_id: "find_key", total_rungs: 0, hints_used: 0, message: "There is no hint for this step. Look again at what you already hold." }, error: null });
    await press("informant-request");
    expect(await screen.findByText("There is no hint for this step. Look again at what you already hold.")).toBeTruthy();
    expect(screen.queryByTestId("informant-line")).toBeNull();
  });

  it("leaves the wrong-code cooldown exactly as it was", async () => {
    // A tip, then the code pad still refuses during a cooldown with the server's own message.
    const state: SessionState = { ...initialState(def), solved: ["find_key", "open_cabinet"], revealed_hotspots: [...initialState(def).revealed_hotspots, "safe"] };
    mocked.startOrResume.mockResolvedValue(sessionRow(def, { room_id: TUTORIAL_ROOM_ID, state: state as never }));
    await renderStudy();
    await press("informant-ask");
    rpc.mockResolvedValueOnce({ data: ok(1, "Four numbers. You've seen them.", "open_safe"), error: null });
    await press("informant-request");
    await screen.findByTestId("informant-hint");
    await fireEvent.press(screen.getByLabelText("Close"));
    // Close slides the sheet away first (DarkSheet), then it closes.
    await waitFor(() => expect(screen.queryByTestId("informant-hint", { includeHiddenElements: true })).toBeNull());
    // The safe is on view 2.
    await fireEvent(screen.getByTestId("view-dots"), "accessibilityAction", { nativeEvent: { actionName: "increment" } });
    await layoutScene();
    mocked.submitAction.mockResolvedValueOnce({
      outcome: "invalid", reason: "cooldown", message: "Code entry is paused for a few minutes.", retry_after: new Date(Date.now() + 60_000).toISOString(),
    });
    await press("hotspot-safe");
    await screen.findByTestId("code-sheet");
    await press("code-submit");
    expect(await screen.findByText(/Code entry is paused/)).toBeTruthy();
    expect(mocked.submitAction).toHaveBeenCalledWith("s1", expect.objectContaining({ type: "solve", puzzle_id: "open_safe" }));
  });
});

describe("the case clock", () => {
  it("is hidden by default", async () => {
    await renderStudy({ prefs: true });
    expect(screen.queryByTestId("case-clock")).toBeNull();
  });

  it("shows time since the session started, in the mono plate label, when turned on", async () => {
    await AsyncStorage.setItem("escapd:pref:case-clock", "1");
    await renderStudy({ prefs: true });
    const clock = await screen.findByTestId("case-clock");
    // started_at was 2:05 before the test began.
    expect(clock.props.children).toMatch(/^2:0[5-9]$/);
    expect(flat(clock)).toMatchObject({ fontFamily: P.type.clock.fontFamily, color: NOIR.inkMuted });
  });
});

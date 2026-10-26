// The player per mode (MODES_PROMPT.md, Part 2): crime scene's Suspects
// sheet, Accuse screen and GUILTY reveal; paranormal's effect overlays,
// presence meter and snap back to full colour. The Study's photos and steps
// carry both (modeCases.ts); submit_action is scripted per test.
import { Image, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import * as api from "@/lib/escapd-api";
import type { ActionResult, PuzzleDefinitionV1, SessionState } from "@/lib/puzzle-types";
import { sessionRow } from "@/test-utils/seed";
import { getMode } from "@/game/mode";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { modeThemes, ref } from "@/theme/tokens";
import { Player } from "../Player";
import { closedCaseFor } from "../closedCase";
import { crimeCase, crimeReady, crimeStart, paranormalCase } from "../__fixtures__/modeCases";

const mockFeedback = {
  tick: jest.fn(), tap: jest.fn(), press: jest.fn(), thud: jest.fn(), success: jest.fn(), warning: jest.fn(), error: jest.fn(),
  paper: jest.fn(), pickup: jest.fn(), wrongCode: jest.fn(), unlock: jest.fn(), stamp: jest.fn(), solved: jest.fn(),
};
jest.mock("@/game/feedback", () => ({ useFeedback: () => mockFeedback }));

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
const CRIME = modeThemes.crime_scene;
const GHOST = modeThemes.paranormal;
const P = ref.layout.play;
const ROOM = "c0220000-0000-4000-8000-000000000022";
const AREA = { x: 0, y: 0, width: 393, height: 540 };
const hidden = { includeHiddenElements: true };

// Each test renders the whole player and lays it out: slow when every suite runs at once.
jest.setTimeout(60_000);

const flat = (node: { props: Record<string, unknown> }) => StyleSheet.flatten(node.props.style as Parameters<typeof StyleSheet.flatten>[0]) ?? {};
const press = async (testID: string) => fireEvent.press(await screen.findByTestId(testID));
// The result sheet's continue slides the sheet away first (DarkSheet), then it closes.
const continueResult = async () => {
  await press("result-continue");
  await waitFor(() => expect(screen.queryByTestId("result-sheet", { includeHiddenElements: true })).toBeNull());
};
const lastAction = () => mocked.submitAction.mock.calls[mocked.submitAction.mock.calls.length - 1][1];
const action = (actionName: string) => ({ nativeEvent: { actionName } });

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  jest.spyOn(Image, "resolveAssetSource").mockReturnValue({ uri: "scene.jpg", width: 1200, height: 1600, scale: 1 });
});

async function layoutScene() {
  await fireEvent(await screen.findByTestId("scene-pager"), "layout", { nativeEvent: { layout: AREA } });
  for (const scene of await screen.findAllByTestId("scene-view")) await fireEvent(scene, "layout", { nativeEvent: { layout: AREA } });
}

async function goToView(n: number) {
  for (let i = 0; i < n; i++) await fireEvent(screen.getByTestId("view-wheel"), "accessibilityAction", action("increment"));
  await layoutScene();
}

/** Opens `def` at `state`; `reduced` wraps it in reduced motion. */
async function play(def: PuzzleDefinitionV1, state: SessionState, { reduced = false, onComplete = jest.fn() } = {}) {
  mocked.startOrResume.mockResolvedValue(sessionRow(def, { room_id: ROOM, state: state as never }));
  mocked.getPlayableDefinition.mockResolvedValue(def);
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <GestureHandlerRootView>
      <ThemeProvider reducedMotion={reduced}>{children}</ThemeProvider>
    </GestureHandlerRootView>
  );
  await render(<Player roomId={ROOM} onExit={jest.fn()} onComplete={onComplete} />, { wrapper: Wrapper });
  await layoutScene();
  return onComplete;
}

const solved = (state: SessionState, extra: Partial<ActionResult> = {}): ActionResult => ({
  outcome: "solved", puzzle_id: "x", message: "It gives way.", gained_items: [], consumed_items: [], revealed_hotspots: [], completed: false, state, ...extra,
});

describe("Player: crime scene", () => {
  const def = crimeCase();

  it("takes crime scene's look, and adds the Suspects square with the count of broken alibis", async () => {
    await play(def, crimeStart({ contradicted: ["s_tobias"] }));
    expect(getMode()).toBe("crime_scene");
    expect(flat(screen.getByTestId("player-crime_scene"))).toMatchObject({ backgroundColor: CRIME.ground });
    expect(flat(screen.getByText("The Poisoned Toast"))).toMatchObject({ color: CRIME.ink });
    const suspects = screen.getByTestId("player-suspects");
    expect(suspects.props.accessibilityLabel).toBe("Suspects, 1 alibi broken");
    expect(flat(screen.getByTestId("player-suspects-square"))).toMatchObject({ backgroundColor: CRIME.raised, width: ref.button.square.size });
    // Named on screen as well as by its glyph: the result sheet sends players to "Suspects".
    // The label starts with the same word, so the caption itself stays out of the reading order.
    const caption = screen.getByTestId("player-suspects-caption", hidden);
    expect(caption.props.children).toBe("Suspects");
    expect(flat(caption)).toMatchObject({ ...ref.type.meta, color: CRIME.inkMuted });
    // The square keeps its width in the row, so the title keeps its room.
    expect(flat(suspects)).toMatchObject({ width: ref.button.square.size });
    // The count says it in words too (the label); the badge is decoration.
    expect(flat(screen.getByTestId("player-suspects-badge", hidden))).toMatchObject({ backgroundColor: CRIME.stamp });
    expect(screen.getByText("1", hidden)).toBeTruthy();
  });

  it("lists the suspects with their alibis, stamps the broken one CONTRADICTED, and keeps Accuse off until the evidence is in", async () => {
    await play(def, crimeStart({ contradicted: ["s_tobias"] }));
    await press("player-suspects");
    await screen.findByTestId("suspects-sheet");
    expect(screen.getByText("1 of 3 alibis broken")).toBeTruthy();
    expect(screen.getByTestId("suspect-s_ivy").props.accessibilityLabel)
      .toBe("Ivy Marsh, The housekeeper. Alibi: In the garden all evening.");
    expect(screen.getByTestId("suspect-s_tobias").props.accessibilityLabel).toMatch(/Alibi contradicted\.$/);
    const frame = screen.getByTestId("suspect-s_tobias-contradicted-frame", hidden);
    expect(flat(frame)).toMatchObject({ borderColor: CRIME.stamp, borderWidth: P.stamp.border });
    expect(flat(screen.getByText("Contradicted", hidden))).toMatchObject({ ...P.type.stamp, color: CRIME.stamp });
    expect(screen.queryByTestId("suspect-s_ivy-contradicted", hidden)).toBeNull();
    // The motives and methods in play.
    expect(screen.getByText("A changed will", hidden)).toBeTruthy();
    expect(screen.getByText("A push on the stairs", hidden)).toBeTruthy();
    // Accuse waits for the evidence, and says so.
    expect(screen.getByTestId("suspects-accuse").props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.getByText("Not enough evidence yet. Keep searching.")).toBeTruthy();
  });

  it("says when a clue breaks an alibi, and when the evidence is enough to accuse", async () => {
    const start = crimeStart({ solved: ["find_key"], inventory: ["brass_key"] });
    await play(def, start);
    mocked.submitAction.mockResolvedValueOnce(solved({
      ...start, solved: ["find_key", "find_note_left"], inventory: ["brass_key", "torn_note_left"], contradicted: ["s_ivy"],
    }, { puzzle_id: "find_note_left", gained_items: ["torn_note_left"] }));
    await press("hotspot-bookshelf");
    await screen.findByTestId("result-sheet");
    expect(screen.getByText("Alibi broken: Ivy Marsh.")).toBeTruthy();
    expect(screen.getByText("Enough evidence to accuse. Open Suspects.")).toBeTruthy();
    await continueResult();
    expect(screen.getByTestId("player-suspects").props.accessibilityLabel).toBe("Suspects, 1 alibi broken. You can accuse");
  });

  it("accuses with radio cards; a wrong accusation shakes, buzzes and shows the wait as plain text", async () => {
    await play(def, crimeReady());
    await press("player-suspects");
    await press("suspects-accuse");
    await screen.findByTestId("accuse-screen");
    expect(screen.getByTestId("accuse-submit").props.accessibilityState).toMatchObject({ disabled: true });
    // Suspects keep their stamps on the radio cards.
    expect(screen.getByTestId("accuse-suspect-s_tobias-contradicted", hidden)).toBeTruthy();
    const ivy = screen.getByTestId("accuse-suspect-s_ivy");
    expect(ivy.props.accessibilityRole).toBe("radio");
    expect(ivy.props.accessibilityState).toMatchObject({ checked: false });
    // Picking is a selection moving: a tick on press-in.
    await fireEvent(ivy, "pressIn");
    expect(mockFeedback.tick).toHaveBeenCalledTimes(1);
    await press("accuse-suspect-s_tobias");
    await press("accuse-motive-m_will");
    await press("accuse-method-x_stairs");
    // Picked: a ring in the stamp colour, and checked for screen readers.
    const picked = screen.getByTestId("accuse-suspect-s_tobias-picked");
    expect(picked.props.accessibilityState).toMatchObject({ checked: true });
    expect(flat(picked)).toMatchObject({ borderColor: CRIME.stamp, borderWidth: P.accuse.ring });

    const retry = new Date(Date.now() + 45_000).toISOString();
    mocked.submitAction.mockResolvedValueOnce({ outcome: "wrong", puzzle_id: "name_the_killer", message: "Wrong.", retry_after: retry });
    await press("accuse-submit");
    expect(lastAction()).toEqual({ type: "accuse", puzzle_id: "name_the_killer", suspect_id: "s_tobias", motive_id: "m_will", method_id: "x_stairs" });
    // Never the server's words: a wrong accusation never says which part was wrong.
    expect(await screen.findByText("The charge won't stick.")).toBeTruthy();
    expect(mockFeedback.error).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("accuse-cooldown").props.children).toMatch(/^Next accusation in 0:4[45]\.$/);
    expect(screen.getByTestId("accuse-submit").props.accessibilityState).toMatchObject({ disabled: true });
    // The picks stay, so one can be changed.
    expect(screen.getByTestId("accuse-suspect-s_tobias-picked")).toBeTruthy();
  });

  it("shows a refused attempt's wait (the shared cooldown) with a warning", async () => {
    await play(def, crimeReady());
    await press("player-suspects");
    await press("suspects-accuse");
    await press("accuse-suspect-s_ivy");
    await press("accuse-motive-m_debt");
    await press("accuse-method-x_tea");
    mocked.submitAction.mockResolvedValueOnce({
      outcome: "invalid", reason: "cooldown", message: "Wait.", retry_after: new Date(Date.now() + 90_000).toISOString(),
    });
    await press("accuse-submit");
    await waitFor(() => expect(screen.getByTestId("accuse-cooldown").props.children).toMatch(/^Next accusation in 1:(29|30)\.$/));
    expect(mockFeedback.warning).toHaveBeenCalled();
    expect(screen.queryByText("The charge won't stick.")).toBeNull();
  });

  it("still says why when a refused attempt's wait has already run out (a clock ahead of the server's)", async () => {
    await play(def, crimeReady());
    await press("player-suspects");
    await press("suspects-accuse");
    await press("accuse-suspect-s_ivy");
    await press("accuse-motive-m_debt");
    await press("accuse-method-x_tea");
    mocked.submitAction.mockResolvedValueOnce({
      outcome: "invalid", reason: "cooldown", message: "Wait.", retry_after: new Date(Date.now() - 5_000).toISOString(),
    });
    await press("accuse-submit");
    // No countdown to show, so the refusal says it in words instead of leaving the message area blank.
    expect(await screen.findByText("Stand by. You can accuse again shortly.")).toBeTruthy();
    expect(screen.queryByTestId("accuse-cooldown")).toBeNull();
    expect(mockFeedback.warning).toHaveBeenCalled();
    // Nothing is left to wait for: the button is on again.
    expect(screen.getByTestId("accuse-submit").props.accessibilityState).toMatchObject({ disabled: false });
  });

  it("the right accusation: the accused comes forward under GUILTY, then the case closes on them", async () => {
    const onComplete = await play(def, crimeReady(), { reduced: true });
    await press("player-suspects");
    await press("suspects-accuse");
    await press("accuse-suspect-s_ivy");
    await press("accuse-motive-m_debt");
    await press("accuse-method-x_tea");
    mocked.submitAction.mockResolvedValueOnce(solved({ ...crimeReady(), solved: [...crimeReady().solved, "name_the_killer"] }, {
      puzzle_id: "name_the_killer", completed: true, message: "Ivy did it.", exit_message: "The case is closed.",
    }));
    await press("accuse-submit");
    await screen.findByTestId("accuse-reveal");
    expect(screen.getByTestId("accused-card").props.accessibilityLabel).toMatch(/^Guilty\. Ivy Marsh, The housekeeper\./);
    expect(flat(screen.getByText("Guilty"))).toMatchObject({ ...P.type.stampLarge, color: CRIME.stamp });
    // The success haptic for the result; the stamp cue as GUILTY lands.
    expect(mockFeedback.success).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(onComplete).toHaveBeenCalledWith({
      message: "Ivy did it.", exitMessage: "The case is closed.", genre: "crime_scene", title: "The Poisoned Toast", accused: "s_ivy",
    }), { timeout: 4000 });
    expect(closedCaseFor(ROOM)).toMatchObject({ genre: "crime_scene", accused: { id: "s_ivy", name: "Ivy Marsh" } });
  });
});

describe("Player: paranormal", () => {
  const def = paranormalCase();
  const start = (): SessionState => ({ solved: [], inventory: [], revealed_hotspots: def.hotspots.filter((h) => !h.hidden).map((h) => h.id) });

  it("draws each visible hotspot's effect over the photo, untouchable and hidden from screen readers", async () => {
    await play(def, start());
    expect(getMode()).toBe("paranormal");
    expect(flat(screen.getByTestId("player-paranormal"))).toMatchObject({ backgroundColor: GHOST.ground });
    const layer = screen.getByTestId("effect-layer", hidden);
    expect(layer.props.pointerEvents).toBe("none");
    expect(layer.props.accessibilityElementsHidden).toBe(true);
    expect(layer.props.importantForAccessibility).toBe("no-hide-descendants");
    expect(screen.getByTestId("effect-flicker-desk_drawer", hidden)).toBeTruthy();
    expect(screen.getByTestId("effect-apparition-bookshelf", hidden)).toBeTruthy();
    // Only the page in view draws effects.
    expect(screen.queryByTestId("effect-cold-rug", hidden)).toBeNull();
    await goToView(1);
    expect(screen.getByTestId("effect-cold-rug", hidden)).toBeTruthy();
    expect(screen.getByTestId("effect-moved-cabinet", hidden)).toBeTruthy();
    // The safe is hidden until the server reveals it: no whisper yet.
    expect(screen.queryByTestId("effect-whisper-safe", hidden)).toBeNull();
    // The hotspots themselves are still the buttons.
    expect(screen.getByTestId("hotspot-cabinet").props.accessibilityRole).toBe("button");
  });

  it("holds every effect still under reduced motion", async () => {
    await play(def, start(), { reduced: true });
    const E = P.effects;
    expect(screen.getByTestId("effect-flicker-desk_drawer", hidden)).toHaveAnimatedStyle({ opacity: E.flicker.rest });
    expect(screen.getByTestId("effect-apparition-bookshelf", hidden)).toHaveAnimatedStyle({ opacity: E.apparition.rest });
    await goToView(1);
    expect(screen.getByTestId("effect-cold-rug", hidden)).toHaveAnimatedStyle({ opacity: E.cold.rest });
  });

  it("shows the presence in the header, rising as anomalies are found", async () => {
    const s = start();
    await play(def, s);
    const meter = screen.getByTestId("presence-meter");
    expect(meter.props.accessibilityLabel).toBe("The presence: 0 of 5");
    expect(meter.props.accessibilityRole).toBe("progressbar");
    expect(meter.props.accessibilityValue).toEqual({ min: 0, max: 5, now: 0 });
    // The meter takes the view line's place.
    expect(screen.queryByText("View 1 of 3", hidden)).toBeNull();
    mocked.submitAction.mockResolvedValueOnce(solved({ ...s, solved: ["find_key"], inventory: ["brass_key"] }, { puzzle_id: "find_key", gained_items: ["brass_key"] }));
    await press("hotspot-desk_drawer");
    await screen.findByTestId("result-sheet");
    expect(screen.getByText("The presence grows stronger.")).toBeTruthy();
    // The header is hidden from screen readers while the sheet is up.
    expect(screen.getByTestId("presence-meter", hidden).props.accessibilityLabel).toBe("The presence: 1 of 5");
    expect(screen.getByTestId("presence-0-lit", hidden)).toBeTruthy();
    expect(flat(screen.getByText("The presence", hidden))).toMatchObject({ color: GHOST.glow });
  });

  it("on case closed, the room snaps back to its own colours and the presence is gone", async () => {
    const done: SessionState = {
      solved: ["find_key", "find_note_left", "find_note_right", "open_cabinet", "join_notes", "open_safe"],
      inventory: ["full_note"],
      revealed_hotspots: [...start().revealed_hotspots, "safe"],
    };
    const onComplete = await play(def, done, { reduced: true });
    await goToView(2);
    mocked.submitAction.mockResolvedValueOnce(solved({ ...done, solved: [...done.solved, "escape"] }, {
      puzzle_id: "escape", completed: true, message: "The air warms.", exit_message: "You step out.",
    }));
    await press("hotspot-door");
    expect(await screen.findByText("The presence is gone.")).toBeTruthy();
    expect(screen.getByTestId("presence-meter").props.accessibilityLabel).toBe("The presence is gone");
    // The photo shows its original layer again (TreatedImage original).
    expect(screen.getByTestId("scene-photo-original")).toBeTruthy();
    await waitFor(() => expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ genre: "paranormal", title: "The Cold Room" })), { timeout: 4000 });
    expect(closedCaseFor(ROOM)).toMatchObject({ genre: "paranormal", photo: 1 });
  });
});

// Reanimated's matcher (jest/setup.js runs its setUpTests). Its typing ships
// only with Reanimated's native build, so it is declared here as it is there.
declare global {
  namespace jest {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unused-vars
    interface Matchers<R, T = {}> {
      toHaveAnimatedStyle(style: Record<string, unknown>, config?: { shouldMatchAllProps?: boolean }): R;
    }
  }
}

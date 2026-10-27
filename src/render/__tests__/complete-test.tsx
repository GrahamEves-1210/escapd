// Case closed per mode (/play/complete/<id>): noir's CASE CLOSED stamp on the case file, crime
// scene's accused under GUILTY, paranormal's "The presence is gone." with the
// room in full colour. Then the victory moment's stats (only the session's
// own numbers), the magnifier rating and the `stamp` then `solved` cues.
import { Dimensions, StyleSheet } from "react-native";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as api from "@/lib/escapd-api";
import { openCapture } from "@/capture/openCapture";
import { getMode } from "@/game/mode";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { modeThemes, ref } from "@/theme/tokens";
import PlayCompleteScreen from "../../../app/play/complete/[roomId]";
import { stashClosedCase } from "../closedCase";
import { crimeCase } from "../__fixtures__/modeCases";

jest.mock("expo-router", () => ({
  router: { back: jest.fn(), replace: jest.fn(), push: jest.fn(), dismissTo: jest.fn(), canGoBack: jest.fn(() => true) },
  useLocalSearchParams: jest.fn(() => ({})),
}));

jest.mock("@/lib/escapd-api", () => ({ getLatestSession: jest.fn(), getPlayableDefinition: jest.fn() }));
jest.mock("@/capture/openCapture", () => ({ openCapture: jest.fn() }));

const mockFeedback = {
  tick: jest.fn(), tap: jest.fn(), press: jest.fn(), thud: jest.fn(), success: jest.fn(), warning: jest.fn(), error: jest.fn(),
  paper: jest.fn(), pickup: jest.fn(), wrongCode: jest.fn(), unlock: jest.fn(), stamp: jest.fn(), solved: jest.fn(),
};
jest.mock("@/game/feedback", () => ({ useFeedback: () => mockFeedback }));

const mocked = api as jest.Mocked<typeof api>;
const capture = openCapture as jest.Mock;
const params = useLocalSearchParams as jest.Mock;
const flat = (node: { props: Record<string, unknown> }) => StyleSheet.flatten(node.props.style as Parameters<typeof StyleSheet.flatten>[0]) ?? {};
const P = ref.layout.play;
const C = P.complete;
const NOIR = modeThemes.noir;
const CRIME = modeThemes.crime_scene;
const GHOST = modeThemes.paranormal;
const hidden = { includeHiddenElements: true };

beforeEach(() => {
  jest.clearAllMocks();
  capture.mockResolvedValue("guide");
  params.mockReturnValue({ message: "You turn the key...", exit: "The door swings open. You escaped!" });
  mocked.getLatestSession.mockResolvedValue({
    started_at: "2026-10-25T10:00:00.000Z",
    completed_at: "2026-10-25T10:08:00.000Z",
    hints_used: 1,
    wrong_answer_count: 2,
    puzzle_version_id: "v1",
  } as Awaited<ReturnType<typeof api.getLatestSession>>);
});

afterEach(() => {
  jest.useRealTimers();
});

// A noir case, from the player's own room.
const NOIR_ROOM = { roomId: "00000000-0000-4000-8000-000000000001", genre: "noir", title: "The Study" };
const noirParams = (extra: Record<string, string> = { message: "You turn the key...", exit: "The door swings open. You escaped!" }) =>
  params.mockReturnValue({ ...NOIR_ROOM, ...extra });
function NoirCompleteScreen() {
  return <PlayCompleteScreen />;
}

describe("Case closed: noir", () => {
  beforeEach(() => noirParams());

  it("stamps CASE CLOSED in noir's brass onto the case file, then the messages, 07's stat cards and the rating", async () => {
    await render(<NoirCompleteScreen />);
    expect(getMode()).toBe("noir");
    expect(mocked.getLatestSession).toHaveBeenCalledWith("00000000-0000-4000-8000-000000000001", "completed");
    expect(flat(screen.getByTestId("case-closed-noir"))).toMatchObject({ backgroundColor: NOIR.ground });
    // The stamp lands on the case file, inside the case card a share button will capture.
    const folder = screen.getByTestId("closed-folder");
    expect(screen.getByTestId("case-card")).toBeTruthy();
    expect(screen.getByTestId("closed-stamp")).toBeTruthy();
    expect(within(folder).getByTestId("closed-stamp")).toBeTruthy();
    expect(flat(screen.getByTestId("closed-stamp-frame"))).toMatchObject({ borderColor: NOIR.stamp, borderWidth: P.stamp.borderLarge });
    expect(flat(screen.getByText("Case closed"))).toMatchObject({ ...P.type.stampMedium, color: NOIR.stamp });
    // The case's name typed on the folder's paper label, in Playfair.
    const title = screen.getByText("The Study");
    expect(title.props.accessibilityRole).toBe("header");
    expect(flat(title)).toMatchObject({ ...C.title, color: NOIR.ground });
    expect(C.title.fontFamily).toMatch(/^PlayfairDisplay_/);
    expect(screen.getByText("You turn the key...")).toBeTruthy();
    expect(flat(screen.getByText("The door swings open. You escaped!"))).toMatchObject({ color: NOIR.inkMuted });
    expect(await screen.findByLabelText("Time: 8 min")).toBeTruthy();
    expect(screen.getByLabelText("Tips taken: 1")).toBeTruthy();
    expect(screen.getByLabelText("Wrong codes: 2")).toBeTruthy();
    // The value in the mode's display face (Playfair for noir).
    expect(flat(screen.getByText("8 min"))).toMatchObject({ fontFamily: NOIR.display.fontFamily, color: NOIR.ink });
    // One hint and two wrong codes: two magnifiers of three.
    expect(screen.getByLabelText("Rating: 2 of 3 magnifiers")).toBeTruthy();
    expect(screen.getByTestId("closed-rating-filled-1")).toBeTruthy();
    expect(screen.queryByTestId("closed-rating-filled-2")).toBeNull();
  });

  it("shows no stats or rating without a session", async () => {
    noirParams({});
    mocked.getLatestSession.mockResolvedValue(null);
    await render(<NoirCompleteScreen />);
    await waitFor(() => expect(mocked.getLatestSession).toHaveBeenCalled());
    expect(screen.queryByTestId("closed-stats")).toBeNull();
    expect(screen.queryByLabelText(/^Time:/)).toBeNull();
    expect(screen.queryByLabelText(/^Rating:/)).toBeNull();
  });

  it("shows only the stats the session holds, and no rating without both hints and wrong codes", async () => {
    mocked.getLatestSession.mockResolvedValue({
      started_at: "2026-10-25T10:00:00.000Z",
      completed_at: null,
      hints_used: 0,
      puzzle_version_id: "v1",
    } as unknown as Awaited<ReturnType<typeof api.getLatestSession>>);
    await render(<NoirCompleteScreen />);
    expect(await screen.findByLabelText("Tips taken: 0")).toBeTruthy();
    expect(screen.queryByLabelText(/^Time:/)).toBeNull();
    expect(screen.queryByLabelText(/^Wrong codes:/)).toBeNull();
    expect(screen.queryByLabelText(/^Rating:/)).toBeNull();
  });

  it("the moment: the stamp lands, then a tick per stat and per earned magnifier, then solved, then the actions", async () => {
    jest.useFakeTimers();
    mocked.getLatestSession.mockResolvedValue({
      started_at: "2026-10-25T10:00:00.000Z",
      completed_at: "2026-10-25T10:08:00.000Z",
      hints_used: 0,
      wrong_answer_count: 0,
      puzzle_version_id: "v1",
    } as Awaited<ReturnType<typeof api.getLatestSession>>);
    await render(<NoirCompleteScreen />);
    expect(mockFeedback.stamp).not.toHaveBeenCalled();
    expect(screen.getByTestId("closed-actions")).toHaveAnimatedStyle({ opacity: 0 });
    // The stamp falls from slamDelay and hits P.stamp.slam later.
    await act(() => jest.advanceTimersByTime(C.beat.slam + P.stamp.slam + 20));
    expect(mockFeedback.stamp).toHaveBeenCalledTimes(1);
    expect(mockFeedback.solved).not.toHaveBeenCalled();
    await act(() => jest.advanceTimersByTime(3000));
    expect(mockFeedback.solved).toHaveBeenCalledTimes(1);
    // Three stats and three magnifiers (a clean case): six ticks, all between the stamp and solved.
    expect(mockFeedback.tick).toHaveBeenCalledTimes(6);
    const stamp = mockFeedback.stamp.mock.invocationCallOrder[0];
    const solved = mockFeedback.solved.mock.invocationCallOrder[0];
    for (const tick of mockFeedback.tick.mock.invocationCallOrder) {
      expect(tick).toBeGreaterThan(stamp);
      expect(tick).toBeLessThan(solved);
    }
    expect(screen.getByLabelText("Rating: 3 of 3 magnifiers")).toBeTruthy();
    expect(screen.getByTestId("closed-actions")).toHaveAnimatedStyle({ opacity: 1 });
  });

  it("reduced motion: no fall, everything fades in, the stamp and solved cues kept, all within 600 ms", async () => {
    jest.useFakeTimers();
    await render(<ThemeProvider reducedMotion><NoirCompleteScreen /></ThemeProvider>);
    // No fall: the stamp is at its own size from the start, only fading in.
    expect(screen.getByTestId("closed-stamp")).toHaveAnimatedStyle({ transform: [{ rotate: `${P.stamp.tilt}deg` }, { scale: 1 }] });
    await act(() => jest.advanceTimersByTime(600));
    expect(mockFeedback.stamp).toHaveBeenCalledTimes(1);
    expect(mockFeedback.solved).toHaveBeenCalledTimes(1);
    expect(mockFeedback.stamp.mock.invocationCallOrder[0]).toBeLessThan(mockFeedback.solved.mock.invocationCallOrder[0]);
    // The stats' ticks are kept; the magnifiers have no beat of their own.
    expect(mockFeedback.tick).toHaveBeenCalledTimes(3);
    expect(screen.getByTestId("closed-stamp")).toHaveAnimatedStyle({ opacity: 1 });
    expect(screen.getByTestId("closed-actions")).toHaveAnimatedStyle({ opacity: 1 });
    expect(screen.getByLabelText("Rating: 2 of 3 magnifiers")).toBeTruthy();
  });

  it("still opens the camera when the access check can't run", async () => {
    capture.mockRejectedValueOnce(new TypeError("Network request failed"));
    await render(<NoirCompleteScreen />);
    await fireEvent.press(screen.getByTestId("complete-new-case"));
    await waitFor(() => expect(router.replace).toHaveBeenLastCalledWith("/capture"));
  });
});

describe("Case closed: custom rooms", () => {
  const ROOM = "c0220000-0000-4000-8000-000000000022";

  it("crime scene: the accused's card under the GUILTY stamp, slammed again, from the case the player just closed", async () => {
    stashClosedCase({ roomId: ROOM, genre: "crime_scene", title: "The Poisoned Toast", accused: crimeCase().puzzles.at(-1)!.suspects![0] });
    params.mockReturnValue({ roomId: ROOM, genre: "crime_scene", title: "The Poisoned Toast", message: "Ivy did it.", exit: "", suspect: "s_ivy" });
    await render(<PlayCompleteScreen />);
    expect(getMode()).toBe("crime_scene");
    expect(flat(screen.getByTestId("case-closed-crime_scene"))).toMatchObject({ backgroundColor: CRIME.ground });
    // The card is one element for screen readers: it speaks the verdict its stamp shows.
    expect(screen.getByTestId("closed-accused").props.accessibilityLabel).toMatch(/^Guilty\. Ivy Marsh, The housekeeper\./);
    expect(flat(screen.getByText("Guilty", hidden))).toMatchObject({ ...P.type.stampMedium, color: CRIME.stamp });
    // GUILTY takes CASE CLOSED's place.
    expect(screen.queryByTestId("closed-stamp")).toBeNull();
    expect(flat(screen.getByText("The Poisoned Toast"))).toMatchObject({ ...C.title, color: CRIME.ink });
    expect(await screen.findByLabelText("Time: 8 min")).toBeTruthy();
    // Crime scene's count includes wrong accusations.
    expect(screen.getByLabelText("Wrong calls: 2")).toBeTruthy();
    await waitFor(() => expect(mockFeedback.stamp).toHaveBeenCalledTimes(1));
    // Nothing to fetch: the case is in memory.
    expect(mocked.getPlayableDefinition).not.toHaveBeenCalled();
  });

  it("after a reload, reads the case's name and the accused from the completed session's definition", async () => {
    params.mockReturnValue({ roomId: "other-room", genre: "crime_scene", suspect: "s_tobias" });
    mocked.getPlayableDefinition.mockResolvedValue(crimeCase());
    await render(<PlayCompleteScreen />);
    expect(await screen.findByText("The Poisoned Toast")).toBeTruthy();
    expect(mocked.getLatestSession).toHaveBeenCalledWith("other-room", "completed");
    expect(mocked.getPlayableDefinition).toHaveBeenCalledWith("v1");
    expect((await screen.findByTestId("closed-accused")).props.accessibilityLabel).toMatch(/^Guilty\. Tobias Reed/);
  });

  it("paranormal: the room in full colour, CASE CLOSED and \"The presence is gone.\"", async () => {
    stashClosedCase({ roomId: ROOM, genre: "paranormal", title: "The Cold Room", photo: 7 });
    params.mockReturnValue({ roomId: ROOM, genre: "paranormal", title: "The Cold Room", message: "The air warms." });
    await render(<PlayCompleteScreen />);
    expect(flat(screen.getByTestId("case-closed-paranormal"))).toMatchObject({ backgroundColor: GHOST.ground });
    expect(screen.getByTestId("closed-photo").props.accessibilityLabel).toBe("The room, back to its own colours");
    expect(flat(screen.getByText("The presence is gone."))).toMatchObject({ ...P.type.gone, color: GHOST.ink });
    expect(flat(screen.getByText("Case closed"))).toMatchObject({ color: GHOST.stamp });
  });

  it("paranormal: the gone line lands with a thud, then CASE CLOSED slams, then solved", async () => {
    jest.useFakeTimers();
    stashClosedCase({ roomId: ROOM, genre: "paranormal", title: "The Cold Room", photo: 7 });
    params.mockReturnValue({ roomId: ROOM, genre: "paranormal", title: "The Cold Room" });
    await render(<PlayCompleteScreen />);
    await act(() => jest.advanceTimersByTime(4000));
    expect(mockFeedback.thud).toHaveBeenCalledTimes(1);
    expect(mockFeedback.stamp).toHaveBeenCalledTimes(1);
    expect(mockFeedback.solved).toHaveBeenCalledTimes(1);
    const [thud, stamp, solved] = [mockFeedback.thud, mockFeedback.stamp, mockFeedback.solved].map((f) => f.mock.invocationCallOrder[0]);
    expect(thud).toBeLessThan(stamp);
    expect(stamp).toBeLessThan(solved);
    expect(flat(screen.getByText("The Cold Room"))).toMatchObject({ ...C.title, color: GHOST.ink });
  });

  it("noir: CASE CLOSED; then Start a new case in the mode (the guide's pill), Back to the mode (home), or this case again", async () => {
    params.mockReturnValue({ roomId: "noir-room", genre: "noir", title: "The Second Drawer" });
    await render(<PlayCompleteScreen />);
    expect(screen.getByTestId("closed-stamp")).toBeTruthy();
    const fresh = screen.getByTestId("complete-new-case");
    expect(screen.getByRole("button", { name: "Start a new case" })).toBe(fresh);
    expect(flat(fresh)).toMatchObject({ backgroundColor: NOIR.accent, borderRadius: ref.radius.round, minHeight: ref.button.ghost.height });
    expect(screen.queryByText("Next case")).toBeNull();
    await fireEvent.press(fresh);
    expect(capture).toHaveBeenLastCalledWith({ genre: "noir", replace: true });
    await fireEvent.press(screen.getByLabelText("Back to Detective Noir"));
    expect(router.dismissTo).toHaveBeenLastCalledWith("/");
    await fireEvent.press(screen.getByLabelText("Replay the case"));
    expect(router.replace).toHaveBeenLastCalledWith({ pathname: "/play/[roomId]", params: { roomId: "noir-room" } });
  });

  it("every mode: Back to <mode> goes home and Start a new case stays in the mode", async () => {
    for (const [genre, name] of [["crime_scene", CRIME.name], ["paranormal", GHOST.name]] as const) {
      params.mockReturnValue({ roomId: `${genre}-room`, genre, title: "A case" });
      await render(<PlayCompleteScreen />);
      await fireEvent.press(screen.getByLabelText(`Back to ${name}`));
      expect(router.dismissTo).toHaveBeenLastCalledWith("/");
      await fireEvent.press(screen.getByRole("button", { name: "Start a new case" }));
      expect(capture).toHaveBeenLastCalledWith({ genre, replace: true });
      await screen.unmount();
    }
  });
});

// One screen with no scroll: every part of case closed, its actions included,
// fits an iPhone SE (375 x 667, 20 safe top, no bottom inset) at the default
// text size, in every mode, with all three stats and the rating. Jest has no
// layout engine, so this adds the compact layout up from the tokens (the
// case at its compact size: the folder's padding, the accused card's padding,
// the room at photo.min), with room for two lines of message, and checks the
// screen draws those parts and lets the case grow only into spare height.
describe("Case closed: fits one screen", () => {
  const ROOM = "c0220000-0000-4000-8000-000000000022";
  const SE = { width: 375, height: 667, top: 20, bottom: 0 };
  const T = ref.type;
  const B = ref.button;
  const S = ref.space;
  const stamp = P.type.stampMedium.lineHeight + 2 * (P.stamp.padYLarge + P.stamp.borderLarge);
  const caseStamp = stamp + 2 * C.stamp.room;
  const folder = C.folder.tabHeight + 2 * C.folder.pad + 2 * C.folder.label.padY + C.title.lineHeight + S.sm + caseStamp;
  // The accused: name, role, a two-line alibi, then GUILTY in its band.
  const accused = 2 * C.accused.padY + 2 * P.hairline + (CRIME.display.lineHeight ?? 0) + S.xs + T.meta.lineHeight + S.xs + S.xs + 2 * P.type.hint.lineHeight
    + P.stamp.tiltRoom + stamp;
  const message = 2 * P.type.body.lineHeight + C.gap.exit + T.subtitle.lineHeight;
  const stats = 2 * C.stat.padY + C.statValue.lineHeight + C.stat.gap + T.meta.lineHeight;
  const rating = Math.max(T.meta.lineHeight, C.rating.size);
  const actions = (next: boolean) =>
    C.actions.pad + (next ? P.type.hint.lineHeight + S.sm : 0) + B.ghost.height + 2 * (S.sm + B.quiet.height) + S.ctaBottom + SE.bottom;
  const column = (parts: number[]) =>
    2 * C.pad + parts.reduce((a, b) => a + b, 0) + (parts.length - 1) * C.gap.head + C.gap.card + stats + C.gap.card + rating;
  const screenHeight = (parts: number[], next = false) => SE.top + column(parts) + actions(next);

  let window: ReturnType<typeof Dimensions.get>;
  beforeEach(() => {
    window = Dimensions.get("window");
    Dimensions.set({ window: { ...window, width: SE.width, height: SE.height, fontScale: 1 } });
  });
  afterEach(() => {
    Dimensions.set({ window });
  });

  /** The parts the screen draws, and the ones the budget counts. */
  async function drawn() {
    expect(await screen.findByLabelText(/^Time:/)).toBeTruthy();
    expect(screen.getAllByLabelText(/^(Time|Tips taken|Wrong \w+|Missteps): /)).toHaveLength(3);
    expect(screen.getByLabelText(/^Rating: /)).toBeTruthy();
    for (const id of ["closed-stats", "closed-actions"]) expect(screen.getByTestId(id)).toBeTruthy();
  }

  it("noir: the folder, the messages, three stats, the rating and the band with its closing line", async () => {
    noirParams();
    await render(<NoirCompleteScreen />);
    await drawn();
    expect(screenHeight([folder, message], true)).toBeLessThanOrEqual(SE.height);
    // The folder grows into spare height only, up to folder.max.
    expect(flat(screen.getByTestId("closed-folder"))).toMatchObject({ flexGrow: 1 });
    expect(folder).toBeLessThanOrEqual(C.folder.max);
  });

  it("noir, a custom room: the same, with Replay the case", async () => {
    params.mockReturnValue({ roomId: "noir-room", genre: "noir", title: "The Second Drawer", message: "The drawer slides open on a letter.", exit: "Case closed." });
    await render(<PlayCompleteScreen />);
    await drawn();
    expect(screen.getByLabelText("Replay the case")).toBeTruthy();
    expect(screenHeight([folder, message])).toBeLessThanOrEqual(SE.height);
  });

  it("crime scene: the accused's card under GUILTY, the case's name, the messages, three stats, the rating and the band", async () => {
    stashClosedCase({ roomId: ROOM, genre: "crime_scene", title: "The Poisoned Toast", accused: crimeCase().puzzles.at(-1)!.suspects![0] });
    params.mockReturnValue({ roomId: ROOM, genre: "crime_scene", title: "The Poisoned Toast", message: "Ivy did it.", exit: "The case is closed.", suspect: "s_ivy" });
    await render(<PlayCompleteScreen />);
    await drawn();
    expect(screenHeight([accused, C.title.lineHeight, message])).toBeLessThanOrEqual(SE.height);
    expect(accused).toBeLessThanOrEqual(C.accused.max);
    expect(flat(screen.getByTestId("closed-accused"))).toMatchObject({ flexGrow: 1, paddingVertical: C.accused.padY });
  });

  it("paranormal: the room with \"The presence is gone.\" on it, CASE CLOSED, the name, the messages, three stats, the rating and the band", async () => {
    stashClosedCase({ roomId: ROOM, genre: "paranormal", title: "The Cold Room", photo: 7 });
    params.mockReturnValue({ roomId: ROOM, genre: "paranormal", title: "The Cold Room", message: "The air warms.", exit: "The door gives." });
    await render(<PlayCompleteScreen />);
    await drawn();
    // The gone line sits on the room, so it takes no height of its own.
    expect(within(screen.getByTestId("closed-room")).getByText("The presence is gone.")).toBeTruthy();
    expect(screenHeight([C.photo.min, caseStamp, C.title.lineHeight, message])).toBeLessThanOrEqual(SE.height);
    // The room takes the spare height, from photo.min up to the column's width at its aspect.
    expect(flat(screen.getByTestId("closed-room"))).toMatchObject({
      flexGrow: 1,
      minHeight: C.photo.min,
      maxHeight: (SE.width - 2 * C.inset) / C.photo.aspect,
    });
    // The gone line's pill fits the smallest room.
    expect(P.type.gone.lineHeight + 2 * P.gone.padY).toBeLessThan(C.photo.min);
  });

  it("the actions keep their size: the guide's pill and quiet pills, at least 44 tall", async () => {
    noirParams();
    await render(<NoirCompleteScreen />);
    expect(flat(screen.getByTestId("complete-new-case")).minHeight).toBe(B.ghost.height);
    expect(flat(screen.getByTestId("complete-mode")).minHeight).toBe(B.quiet.height);
    expect(Math.min(B.ghost.height, B.quiet.height)).toBeGreaterThanOrEqual(ref.hit.min);
  });
});

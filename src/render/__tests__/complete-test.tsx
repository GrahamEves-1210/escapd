// Case closed per mode (/play/complete/<id>), the last page of her mystery:
// the series line, the room's polaroid with the case's number handwritten on
// it (never an invented title), a gold-foil seal (noir: CASE CLOSED; crime scene: GUILTY, the culprit,
// motive and method on the library card; paranormal: THE PRESENCE IS GONE,
// the room back in full colour), the cat, the record's stats (a v2 game's
// own count, else the session's numbers), the rating (magnifiers in brass;
// paranormal's moons) with what earned it, the cat's line, and the `stamp`
// then `solved` cues. A v2 game's recap: what happened, the clues that proved
// it, the clues found. A reload reads the case kept on the device and signs
// the room's photo again.
import { Dimensions, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MODE_CHARMS } from "@/game/collection/charms";
import { awardCharm, loadCollection, resetAwardMemory } from "@/game/collection/store";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as api from "@/lib/escapd-api";
import { openCapture } from "@/capture/openCapture";
import { getMode } from "@/game/mode";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { modeThemes, ref } from "@/theme/tokens";
import PlayCompleteScreen from "../../../app/play/complete/[roomId]";
import { CLOSED_LAYOUT, RECAP_KICKER, stampDate, withoutCaseClosed } from "../CaseClosed";
import { PAGE, PAGE_INK, POLAROID, SEAL } from "../keepsake";
import { stashClosedCase } from "../closedCase";
import { caseLabel, type CaseRecap } from "../victory";
import { PAYOFF_TYPE } from "@/theme/payoff";
import { keepRecap } from "@/play2/caseRecord";
import { crimeCase } from "../__fixtures__/modeCases";

jest.mock("expo-router", () => ({
  router: { back: jest.fn(), replace: jest.fn(), push: jest.fn(), dismissTo: jest.fn(), canGoBack: jest.fn(() => true) },
  useLocalSearchParams: jest.fn(() => ({})),
}));

jest.mock("@/lib/escapd-api", () => ({ getLatestSession: jest.fn(), getPlayableDefinition: jest.fn(), getRoomPhotos: jest.fn(), signedPhotoUrl: jest.fn() }));
jest.mock("@/capture/openCapture", () => ({ openCapture: jest.fn() }));

const mockFeedback = {
  tick: jest.fn(), tap: jest.fn(), press: jest.fn(), thud: jest.fn(), success: jest.fn(), warning: jest.fn(), error: jest.fn(),
  paper: jest.fn(), pickup: jest.fn(), wrongCode: jest.fn(), unlock: jest.fn(), stamp: jest.fn(), solved: jest.fn(), snap: jest.fn(),
};
jest.mock("@/game/feedback", () => ({ useFeedback: () => mockFeedback }));

const mocked = api as jest.Mocked<typeof api>;
const capture = openCapture as jest.Mock;
const params = useLocalSearchParams as jest.Mock;
const flat = (node: { props: Record<string, unknown> }) => StyleSheet.flatten(node.props.style as Parameters<typeof StyleSheet.flatten>[0]) ?? {};
const P = ref.layout.play;
const C = P.complete;
const L = CLOSED_LAYOUT;
const NOIR = modeThemes.noir;
const CRIME = modeThemes.crime_scene;
const GHOST = modeThemes.paranormal;
const hidden = { includeHiddenElements: true };

beforeEach(async () => {
  jest.clearAllMocks();
  resetAwardMemory();
  await AsyncStorage.clear();
  stashClosedCase({ roomId: "nobody", genre: "noir" });
  await AsyncStorage.clear();
  capture.mockResolvedValue("guide");
  mocked.getRoomPhotos.mockResolvedValue([]);
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

  it("the last page: the series line, the polaroid with the case's number handwritten, the CASE CLOSED seal, the record and the rating", async () => {
    await render(<NoirCompleteScreen />);
    expect(getMode()).toBe("noir");
    expect(mocked.getLatestSession).toHaveBeenCalledWith("00000000-0000-4000-8000-000000000001", "completed");
    expect(flat(screen.getByTestId("case-closed-noir"))).toMatchObject({ backgroundColor: NOIR.ground });
    // The page is warm cream book paper: the card a share button will capture.
    const card = screen.getByTestId("case-card");
    expect(flat(card)).toMatchObject({ backgroundColor: PAGE.paper, borderRadius: L.radius });
    expect(flat(screen.getByText("A Detective Noir Mystery"))).toMatchObject({ ...ref.type.series, color: PAGE_INK.noir });
    // The seal is pressed onto the page, its word in dark ink on gold foil.
    expect(within(card).getByTestId("closed-stamp")).toBeTruthy();
    expect(flat(screen.getByText("Case closed"))).toMatchObject({ color: SEAL.ink, fontFamily: ref.font.cover, textTransform: "uppercase" });
    // The case's number handwritten in the polaroid's foot: never the room's invented title.
    const title = screen.getByTestId("closed-title");
    expect(title.props.children).toBe(caseLabel(NOIR_ROOM.roomId));
    expect(title.props.children).toMatch(/^Case no\. \d{4}$/);
    expect(screen.queryByText("The Study")).toBeNull();
    expect(title.props.accessibilityRole).toBe("header");
    expect(flat(title)).toMatchObject({ fontFamily: NOIR.hand.fontFamily, color: PAGE.ink });
    expect(screen.getByLabelText("The room")).toBeTruthy();
    // The ending's lines, as the book's last line.
    expect(flat(screen.getByText("You turn the key..."))).toMatchObject({ ...L.last, color: PAGE.ink });
    expect(flat(screen.getByText("The door swings open. You escaped!"))).toMatchObject({ color: PAGE.muted });
    // The record: one cell per stat, the value handwritten with lining figures.
    expect(await screen.findByLabelText("Time: 8 min")).toBeTruthy();
    expect(screen.getByLabelText("Tips taken: 1")).toBeTruthy();
    expect(screen.getByLabelText("Wrong codes: 2")).toBeTruthy();
    const value = flat(screen.getByText("8 min"));
    expect(value).toMatchObject({ ...L.figure, color: PAGE.ink, fontFamily: NOIR.hand.fontFamily });
    // One hint and two wrong codes: two magnifiers of three, in brass.
    expect(screen.getByLabelText("Rating: 2 of 3 magnifiers")).toBeTruthy();
    expect(screen.getByText("Observation", hidden)).toBeTruthy();
    expect(screen.getByTestId("closed-rating-filled-1")).toBeTruthy();
    expect(screen.queryByTestId("closed-rating-filled-2")).toBeNull();
    // What earned it, and the cat's word on it.
    expect(screen.getByTestId("closed-reason").props.children).toBe("2 magnifiers for 1 tip and 2 wrong codes. No tips and no wrong codes earns 3.");
    expect(screen.getByTestId("closed-cat-line").props.children).toBe("I only helped a little \u2665");
    // Where a screenshot is from: the library's stamp, SOLVED and the day.
    expect(screen.getByText(`Solved · ${stampDate()}`)).toBeTruthy();
    // The cat, sitting beside the polaroid.
    expect(screen.getByLabelText("The black cat, very pleased with you. Pet the cat")).toBeTruthy();
  });

  it("dates the stamp as a library does", () => {
    expect(stampDate(new Date(2026, 9, 28))).toBe("28 Oct 2026");
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

  it("the moment: the seal lands, then a tick per stat and per earned magnifier, then solved, then the actions", async () => {
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
    // The seal falls from its beat and hits P.stamp.slam later.
    await act(() => jest.advanceTimersByTime(C.beat.slam + P.stamp.slam + 20));
    expect(mockFeedback.stamp).toHaveBeenCalledTimes(1);
    expect(mockFeedback.solved).not.toHaveBeenCalled();
    await act(() => jest.advanceTimersByTime(3000));
    expect(mockFeedback.solved).toHaveBeenCalledTimes(1);
    // Three stats and three magnifiers (a clean case): six ticks, all between the seal and solved.
    expect(mockFeedback.tick).toHaveBeenCalledTimes(6);
    const stamp = mockFeedback.stamp.mock.invocationCallOrder[0];
    const solved = mockFeedback.solved.mock.invocationCallOrder[0];
    for (const tick of mockFeedback.tick.mock.invocationCallOrder) {
      expect(tick).toBeGreaterThan(stamp);
      expect(tick).toBeLessThan(solved);
    }
    expect(screen.getByLabelText("Rating: 3 of 3 magnifiers")).toBeTruthy();
    // The case's charm comes up after solved and is pinned on; the actions wait for it.
    expect(screen.getByTestId("closed-actions")).toHaveAnimatedStyle({ opacity: 0 });
    await act(() => jest.advanceTimersByTime(2500));
    expect(mockFeedback.snap).toHaveBeenCalledTimes(1);
    expect(mockFeedback.snap.mock.invocationCallOrder[0]).toBeGreaterThan(solved);
    expect(screen.getByTestId("closed-actions")).toHaveAnimatedStyle({ opacity: 1 });
  });

  it("pins the case's charm on: gold for a clean case, kept on her board once, the title it brings over the actions", async () => {
    jest.useFakeTimers();
    noirParams({ hints: "0", wrong: "0", ms: "300000" });
    await render(<NoirCompleteScreen />);
    await act(() => jest.advanceTimersByTime(8000));
    const charm = screen.getByTestId("closed-charm");
    expect(charm.props.accessibilityLabel).toMatch(/^New charm: .+, gold pin\. Pinned to your charm board\.$/);
    expect(screen.getByTestId("closed-charm-tag")).toHaveTextContent("New!");
    expect(screen.getByTestId("closed-news")).toHaveTextContent(/Now a Candlelit Snoop · a bow for the cat/);
    const board = await loadCollection();
    expect(Object.keys(board.cases)).toEqual([NOIR_ROOM.roomId]);
    expect(board.cases[NOIR_ROOM.roomId].finish).toBe("gold");
    expect(MODE_CHARMS.noir).toContain(board.cases[NOIR_ROOM.roomId].kind);
  });

  it("a case closed before keeps its charm: no second award, no tag, no new title", async () => {
    await awardCharm(NOIR_ROOM.roomId, "noir", { hints: 0, wrong: 0 });
    resetAwardMemory();
    jest.useFakeTimers();
    noirParams({ hints: "0", wrong: "0", ms: "300000" });
    await render(<NoirCompleteScreen />);
    await act(() => jest.advanceTimersByTime(8000));
    expect(screen.getByTestId("closed-charm").props.accessibilityLabel).toMatch(/Already on your charm board\.$/);
    expect(screen.queryByTestId("closed-charm-tag")).toBeNull();
    expect(screen.queryByTestId("closed-news")).toBeNull();
    expect(Object.keys((await loadCollection()).cases)).toHaveLength(1);
  });

  it("a sticker for a case with tips, smoothed down with the paper sound", async () => {
    jest.useFakeTimers();
    noirParams({ hints: "4", wrong: "3", ms: "300000" });
    await render(<NoirCompleteScreen />);
    await act(() => jest.advanceTimersByTime(8000));
    expect(screen.getByTestId("closed-charm").props.accessibilityLabel).toMatch(/, sticker\. Pinned/);
    expect(mockFeedback.paper).toHaveBeenCalled();
    expect(mockFeedback.snap).not.toHaveBeenCalled();
  });

  it("the seal lands with confetti and the cat cheering; none under reduced motion", async () => {
    jest.useFakeTimers();
    await render(<NoirCompleteScreen />);
    expect(screen.queryByTestId("closed-confetti", hidden)).toBeNull();
    await act(() => jest.advanceTimersByTime(C.beat.slam + P.stamp.slam + 20));
    expect(screen.getByTestId("closed-confetti", hidden)).toBeTruthy();
    await screen.unmount();
    await render(<ThemeProvider reducedMotion><NoirCompleteScreen /></ThemeProvider>);
    await act(() => jest.advanceTimersByTime(800));
    expect(mockFeedback.stamp).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId("closed-confetti", hidden)).toBeNull();
  });

  it("reduced motion: no fall, everything fades in, the stamp and solved cues kept, all within 600 ms", async () => {
    jest.useFakeTimers();
    await render(<ThemeProvider reducedMotion><NoirCompleteScreen /></ThemeProvider>);
    // No fall: the seal is at its own size from the start, only fading in.
    expect(screen.getByTestId("closed-stamp")).toHaveAnimatedStyle({ transform: [{ scale: 1 }] });
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

  it("after a reload, signs the room's photo again for the polaroid", async () => {
    mocked.getRoomPhotos.mockResolvedValue([{ id: "ph0", storage_path: "u/r/p0.jpg", position: 0 }] as Awaited<ReturnType<typeof api.getRoomPhotos>>);
    mocked.signedPhotoUrl.mockResolvedValue("https://signed/p0.jpg");
    await render(<NoirCompleteScreen />);
    expect(await screen.findByTestId("closed-photo")).toBeTruthy();
    expect(mocked.signedPhotoUrl).toHaveBeenCalledWith("u/r/p0.jpg");
  });
});

describe("Case closed: custom rooms", () => {
  const ROOM = "c0220000-0000-4000-8000-000000000022";

  it("crime scene: GUILTY pressed on, the culprit on the library card, from the case the player just closed", async () => {
    stashClosedCase({ roomId: ROOM, genre: "crime_scene", title: "The Poisoned Toast", accused: crimeCase().puzzles.at(-1)!.suspects![0] });
    params.mockReturnValue({ roomId: ROOM, genre: "crime_scene", title: "The Poisoned Toast", message: "Ivy did it.", exit: "", suspect: "s_ivy" });
    await render(<PlayCompleteScreen />);
    expect(getMode()).toBe("crime_scene");
    expect(flat(screen.getByTestId("case-closed-crime_scene"))).toMatchObject({ backgroundColor: CRIME.ground });
    expect(screen.getByText("A True Crime Club Mystery")).toBeTruthy();
    // The record is one element for screen readers: it speaks the verdict its seal shows.
    expect(screen.getByTestId("closed-accused").props.accessibilityLabel).toMatch(/^Guilty\. Ivy Marsh, The housekeeper\./);
    expect(screen.getByText("Ivy Marsh", hidden)).toBeTruthy();
    expect(flat(screen.getByText("Guilty", hidden))).toMatchObject({ color: SEAL.ink });
    // GUILTY takes CASE CLOSED's place.
    expect(screen.getByTestId("closed-guilty")).toBeTruthy();
    expect(screen.queryByTestId("closed-stamp")).toBeNull();
    expect(screen.getByTestId("closed-title").props.children).toBe(caseLabel(ROOM));
    expect(await screen.findByLabelText("Time: 8 min")).toBeTruthy();
    // Crime scene's count includes wrong accusations.
    expect(screen.getByLabelText("Wrong calls: 2")).toBeTruthy();
    await waitFor(() => expect(mockFeedback.stamp).toHaveBeenCalledTimes(1));
    // Nothing to fetch: the case is in memory.
    expect(mocked.getPlayableDefinition).not.toHaveBeenCalled();
  });

  it("after a reload, reads the accused from the completed session's definition (and never shows its title)", async () => {
    params.mockReturnValue({ roomId: "other-room", genre: "crime_scene", suspect: "s_tobias" });
    mocked.getPlayableDefinition.mockResolvedValue(crimeCase());
    await render(<PlayCompleteScreen />);
    expect(await screen.findByText(caseLabel("other-room"))).toBeTruthy();
    expect(mocked.getLatestSession).toHaveBeenCalledWith("other-room", "completed");
    expect(mocked.getPlayableDefinition).toHaveBeenCalledWith("v1");
    expect((await screen.findByTestId("closed-accused")).props.accessibilityLabel).toMatch(/^Guilty\. Tobias Reed/);
    expect(screen.queryByText("The Poisoned Toast")).toBeNull();
  });

  it("after a reload of a v2 room, there are no suspects to look up: CASE CLOSED, the case's number", async () => {
    params.mockReturnValue({ roomId: "v2-room", genre: "crime_scene", suspect: "s_tobias" });
    mocked.getPlayableDefinition.mockResolvedValue({
      schema_version: 2, mode: "crime_scene", title: "The Locked Study", objective: "Get out.",
      photos: [{ photo_id: "a" }], objects: [], items: [], cards: [], finale: { kind: "combination", wheels: 3 },
    } as unknown as Awaited<ReturnType<typeof api.getPlayableDefinition>>);
    await render(<PlayCompleteScreen />);
    await waitFor(() => expect(mocked.getPlayableDefinition).toHaveBeenCalled());
    expect(await screen.findByText(caseLabel("v2-room"))).toBeTruthy();
    expect(screen.queryByText("The Locked Study")).toBeNull();
    expect(screen.queryByTestId("closed-accused")).toBeNull();
    expect(screen.getByTestId("closed-stamp")).toBeTruthy();
  });

  it("paranormal: the room in full colour, THE PRESENCE IS GONE on the seal, moons for Second sight", async () => {
    stashClosedCase({ roomId: ROOM, genre: "paranormal", title: "The Cold Room", photo: 7 });
    params.mockReturnValue({ roomId: ROOM, genre: "paranormal", title: "The Cold Room", message: "The air warms. The presence is gone.", hints: "0", wrong: "1", ms: "60000" });
    await render(<PlayCompleteScreen />);
    expect(flat(screen.getByTestId("case-closed-paranormal"))).toMatchObject({ backgroundColor: GHOST.ground });
    expect(screen.getByText("A Moonlit Mystery")).toBeTruthy();
    expect(screen.getByTestId("closed-photo")).toBeTruthy();
    expect(screen.getByLabelText("The room, back to its own colours")).toBeTruthy();
    expect(within(screen.getByTestId("closed-gone")).getByText("The presence is gone")).toBeTruthy();
    expect(screen.queryByTestId("closed-stamp")).toBeNull();
    // The seal says it: the line doesn't say it again.
    expect(screen.getByText("The air warms.")).toBeTruthy();
    expect(await screen.findByLabelText("Rating: 2 of 3 moons")).toBeTruthy();
    expect(screen.getByText("Second sight", hidden)).toBeTruthy();
  });

  it("paranormal: the room snaps back, then the seal lands, then solved", async () => {
    jest.useFakeTimers();
    stashClosedCase({ roomId: ROOM, genre: "paranormal", title: "The Cold Room", photo: 7 });
    params.mockReturnValue({ roomId: ROOM, genre: "paranormal", title: "The Cold Room" });
    await render(<PlayCompleteScreen />);
    await act(() => jest.advanceTimersByTime(C.beat.goneStamp - 10));
    expect(mockFeedback.stamp).not.toHaveBeenCalled();
    await act(() => jest.advanceTimersByTime(4000));
    expect(mockFeedback.stamp).toHaveBeenCalledTimes(1);
    expect(mockFeedback.solved).toHaveBeenCalledTimes(1);
    expect(mockFeedback.stamp.mock.invocationCallOrder[0]).toBeLessThan(mockFeedback.solved.mock.invocationCallOrder[0]);
  });

  it("noir: CASE CLOSED; then Start a new case in the mode (the guide's pill), or Done (home)", async () => {
    params.mockReturnValue({ roomId: "noir-room", genre: "noir", title: "The Second Drawer" });
    await render(<PlayCompleteScreen />);
    expect(await screen.findByTestId("closed-stamp")).toBeTruthy();
    const fresh = screen.getByTestId("complete-new-case");
    expect(screen.getByRole("button", { name: "Start a new case" })).toBe(fresh);
    expect(flat(fresh)).toMatchObject({ backgroundColor: NOIR.accent, borderRadius: ref.radius.round, minHeight: ref.button.ghost.height });
    expect(screen.queryByText("Next case")).toBeNull();
    expect(screen.queryByLabelText("Replay the case")).toBeNull();
    await fireEvent.press(fresh);
    expect(capture).toHaveBeenLastCalledWith({ genre: "noir", replace: true });
    await fireEvent.press(screen.getByTestId("complete-mode"));
    expect(router.dismissTo).toHaveBeenLastCalledWith("/");
  });

  it("every mode: Done goes home and Start a new case stays in the mode", async () => {
    for (const genre of ["crime_scene", "paranormal"] as const) {
      params.mockReturnValue({ roomId: `${genre}-room`, genre, title: "A case" });
      await render(<PlayCompleteScreen />);
      await fireEvent.press(await screen.findByTestId("complete-mode"));
      expect(router.dismissTo).toHaveBeenLastCalledWith("/");
      await fireEvent.press(screen.getByRole("button", { name: "Start a new case" }));
      expect(capture).toHaveBeenLastCalledWith({ genre, replace: true });
      await screen.unmount();
    }
  });

  it("the actions sit at least ref.space.lg off the bottom edge with no bottom inset", async () => {
    noirParams();
    await render(<NoirCompleteScreen />);
    expect(flat(await screen.findByTestId("closed-actions")).paddingBottom).toBeGreaterThanOrEqual(ref.space.lg);
  });
});

describe("Case closed: a v2 game", () => {
  const ROOM = "c0220000-0000-4000-8000-000000000033";
  const STATS = { hints: "2", wrong: "3", ms: "400000" };

  it("shows the game's own stats from the params, not a session's (a room played on the device writes none)", async () => {
    params.mockReturnValue({ roomId: ROOM, genre: "noir", title: "The Study", message: "The lock gives. Case closed.", ...STATS });
    await render(<PlayCompleteScreen />);
    expect(await screen.findByLabelText("Time: 7 min")).toBeTruthy();
    expect(screen.getByLabelText("Tips taken: 2")).toBeTruthy();
    expect(screen.getByLabelText("Wrong codes: 3")).toBeTruthy();
    expect(screen.getByLabelText("Rating: 1 of 3 magnifiers")).toBeTruthy();
    expect(mocked.getLatestSession).not.toHaveBeenCalled();
    // CASE CLOSED is on the seal: the line doesn't say it again.
    expect(screen.getByText("The lock gives.")).toBeTruthy();
    expect(screen.queryByText(/Case closed\./)).toBeNull();
  });

  it("crime scene: GUILTY, then the culprit, motive and method on the card, from the case just closed", async () => {
    stashClosedCase({
      roomId: ROOM, genre: "crime_scene", title: "The Study", accused: { id: "s_1", name: "Silas Whitlock" },
      motive: "Gambling debts", method: "Strangling", stats: { hints: 0, wrong: 0, ms: 30000 },
    });
    params.mockReturnValue({ roomId: ROOM, genre: "crime_scene", title: "The Study", message: "The accusation holds. Case closed.", suspect: "s_1", ...STATS });
    await render(<PlayCompleteScreen />);
    expect(screen.getByTestId("closed-accused").props.accessibilityLabel).toBe("Guilty. Silas Whitlock. Why: Gambling debts. How: Strangling.");
    for (const [label, value] of [["Culprit", "Silas Whitlock"], ["Motive", "Gambling debts"], ["Method", "Strangling"]]) {
      expect(screen.getByText(label, hidden)).toBeTruthy();
      expect(flat(screen.getByText(value, hidden))).toMatchObject({ fontFamily: CRIME.hand.fontFamily, color: PAGE.ink });
    }
    expect(screen.getByTestId("closed-charge", hidden)).toBeTruthy();
    expect(screen.queryByTestId("closed-stamp")).toBeNull();
    // GUILTY is on the seal; the line's own "Case closed." is left out too.
    expect(screen.getByText("The accusation holds.")).toBeTruthy();
    // The params' stats win over the stash's.
    expect(await screen.findByLabelText("Wrong calls: 3")).toBeTruthy();
  });

  it("after a reload, reads the case kept on the device: the accused, why and how, the stats", async () => {
    await AsyncStorage.setItem("escapd.closedCase", JSON.stringify({
      roomId: ROOM, genre: "crime_scene", title: "The Study", accused: { id: "s_1", name: "Silas Whitlock" },
      motive: "Gambling debts", method: "Strangling", stats: { hints: 1, wrong: 0, ms: 90000 },
    }));
    params.mockReturnValue({ roomId: ROOM, genre: "crime_scene", suspect: "s_1" });
    await render(<PlayCompleteScreen />);
    expect((await screen.findByTestId("closed-accused")).props.accessibilityLabel).toMatch(/^Guilty\. Silas Whitlock\./);
    expect(screen.getByText(caseLabel(ROOM))).toBeTruthy();
    expect(screen.queryByText("The Study")).toBeNull();
    expect(screen.getByTestId("closed-charge", hidden)).toBeTruthy();
    expect(await screen.findByLabelText("Time: 2 min")).toBeTruthy();
    expect(screen.getByLabelText("Rating: 2 of 3 magnifiers")).toBeTruthy();
    expect(mocked.getLatestSession).not.toHaveBeenCalled();
    expect(mocked.getPlayableDefinition).not.toHaveBeenCalled();
  });

  it("paranormal, after a reload: signs the room's photo again; its rating is Second sight", async () => {
    await AsyncStorage.setItem("escapd.closedCase", JSON.stringify({ roomId: ROOM, genre: "paranormal", title: "The Study", photoRef: { photo_id: "ph1" } }));
    mocked.getRoomPhotos.mockResolvedValue([
      { id: "ph0", storage_path: "u/r/p0.jpg", position: 0 },
      { id: "ph1", storage_path: "u/r/p1.jpg", position: 1 },
    ] as Awaited<ReturnType<typeof api.getRoomPhotos>>);
    mocked.signedPhotoUrl.mockResolvedValue("https://signed/p1.jpg");
    params.mockReturnValue({ roomId: ROOM, genre: "paranormal", title: "The Study", ...STATS });
    await render(<PlayCompleteScreen />);
    expect(await screen.findByTestId("closed-photo")).toBeTruthy();
    expect(mocked.signedPhotoUrl).toHaveBeenCalledWith("u/r/p1.jpg");
    expect(screen.getByLabelText("Missteps: 3")).toBeTruthy();
    expect(screen.getByText("Second sight", hidden)).toBeTruthy();
  });

  it("paranormal: without a photo to sign, the case still shows (the mode's drawn cover in the polaroid)", async () => {
    params.mockReturnValue({ roomId: "elsewhere", genre: "paranormal", title: "The Study", ...STATS });
    await render(<PlayCompleteScreen />);
    expect(await screen.findByTestId("case-closed-paranormal")).toBeTruthy();
    expect(screen.queryByTestId("closed-photo")).toBeNull();
    expect(screen.getByTestId("closed-photo-cover", hidden)).toBeTruthy();
    expect(screen.getByText("The presence is gone")).toBeTruthy();
  });

  it("leaves out only a sentence that just says Case closed.", () => {
    expect(withoutCaseClosed("The lock gives. Case closed.")).toBe("The lock gives.");
    expect(withoutCaseClosed("Case closed.")).toBe("");
    expect(withoutCaseClosed("The case is closed. Go home!")).toBe("The case is closed. Go home!");
    expect(withoutCaseClosed("Case closed, for now.")).toBe("Case closed, for now.");
  });
});

// A v2 game's recap: what happened (the answer called out), the clues that
// proved it, the clues found as a fourth stat.
describe("Case closed: the recap", () => {
  const ROOM = "c0220000-0000-4000-8000-000000000044";
  const RECAP: CaseRecap = {
    story: [{ text: "The combination was " }, { text: "5 3 5", strong: true }, { text: ": two pieces you found and fit together." }],
    evidence: ["Taped note", "Between the pages"],
    found: 3,
    total: 4,
  };

  it("noir: what happened in place of the ending's line, the clues that proved it, the clues found", async () => {
    keepRecap(ROOM, RECAP);
    params.mockReturnValue({ roomId: ROOM, genre: "noir", title: "The Long Night", message: "The last tumbler drops.", hints: "0", wrong: "0", ms: "300000" });
    await render(<PlayCompleteScreen />);
    expect(screen.getByText(RECAP_KICKER.noir)).toBeTruthy();
    const story = screen.getByTestId("closed-story-text");
    expect(flat(story)).toMatchObject({ ...PAYOFF_TYPE.story, color: PAGE.ink });
    // The answer, in the bold cut and the mode's page ink.
    expect(flat(screen.getByText("5 3 5"))).toMatchObject({ ...PAYOFF_TYPE.storyStrong, color: PAGE_INK.noir });
    expect(screen.getByTestId("closed-evidence")).toBeTruthy();
    expect(screen.getByText("Taped note, Between the pages")).toBeTruthy();
    // The ending's line gives way to the story (the way out's page showed it).
    expect(screen.queryByText("The last tumbler drops.")).toBeNull();
    expect(screen.queryByText("The Long Night")).toBeNull();
    expect(await screen.findByLabelText("Clues found: 3 of 4")).toBeTruthy();
    expect(screen.getByLabelText("Rating: 3 of 3 magnifiers")).toBeTruthy();
    expect(screen.getByTestId("closed-reason").props.children).toBe("3 magnifiers: solved with no tips and no wrong codes.");
    expect(screen.getByTestId("closed-cat-line").props.children).toBe("Not one tip. I'm impressed \u2665");
  });

  it("crime scene: the story tells who, why and how, so the ruled culprit lines give way to it", async () => {
    keepRecap(ROOM, { story: [{ text: "Silas Whitlock", strong: true }, { text: " did it." }], evidence: ["Taped statement"], found: 2, total: 3 });
    stashClosedCase({ roomId: ROOM, genre: "crime_scene", accused: { id: "s_1", name: "Silas Whitlock" }, motive: "Gambling debts", method: "Strangling" });
    params.mockReturnValue({ roomId: ROOM, genre: "crime_scene", suspect: "s_1", hints: "1", wrong: "1", ms: "300000" });
    await render(<PlayCompleteScreen />);
    expect(screen.getByText(RECAP_KICKER.crime_scene)).toBeTruthy();
    expect(screen.getByTestId("closed-guilty")).toBeTruthy();
    expect(screen.queryByTestId("closed-accused")).toBeNull();
    expect(await screen.findByLabelText("Wrong calls: 1")).toBeTruthy();
  });

  it("after a reload, reads the recap kept on the device for this room only", async () => {
    await AsyncStorage.setItem("escapd.v2.recap", JSON.stringify({ roomId: "kept-room", recap: RECAP }));
    params.mockReturnValue({ roomId: "kept-room", genre: "paranormal", hints: "0", wrong: "0", ms: "1000" });
    await render(<PlayCompleteScreen />);
    expect(await screen.findByText(RECAP_KICKER.paranormal)).toBeTruthy();
    await screen.unmount();
    params.mockReturnValue({ roomId: "another-room", genre: "paranormal", hints: "0", wrong: "0", ms: "1000" });
    await render(<PlayCompleteScreen />);
    expect(await screen.findByTestId("case-closed-paranormal")).toBeTruthy();
    expect(screen.queryByTestId("closed-story")).toBeNull();
  });
});

// One screen with no scroll at the default text size on a 390 x 844 phone in
// every mode, with the recap, four stats, the rating and its reason and the
// cat's line. Jest has no layout engine, so this adds the page up from its own
// sizes and checks the polaroid the screen draws is the one that fits. A
// smaller phone scrolls, but the polaroid keeps photo.min and the cat never
// sits on the seal.
describe("Case closed: fits one screen", () => {
  const T = ref.type;
  const pad = 2 * C.pad + 2 * L.pad;
  const actions = L.actions + Math.max(ref.space.ctaBottom, L.bottomMin);
  // The recap: its kicker, three lines of story, one of evidence; the reason's two lines.
  const story = L.kicker + 4 + 3 * L.story.lineHeight + 4 + L.evidence;
  const parts = [L.head, story, L.cell, L.mark + 8 + 2 * L.reason.lineHeight, L.catLine.lineHeight, L.footer];
  const page = (photo: number) => L.slack + pad + L.heroPad + photo + POLAROID.frame + POLAROID.foot + parts.length * L.gap + parts.reduce((a, b) => a + b, 0);
  const RECAP: CaseRecap = {
    story: [{ text: "It wanted its ritual finished in order: " }, { text: "the drawer", strong: true }, { text: ", then " }, { text: "the rug", strong: true }, { text: ". Once it was done, it let go." }],
    evidence: ["Child's drawing", "Under UV"],
    found: 3,
    total: 4,
  };

  let window: ReturnType<typeof Dimensions.get>;
  beforeEach(() => {
    window = Dimensions.get("window");
  });
  afterEach(() => {
    Dimensions.set({ window });
  });
  const size = (width: number, height: number) => Dimensions.set({ window: { ...window, width, height, fontScale: 1 } });

  it("a 390 x 844 phone: every mode's page with its recap, over the actions", async () => {
    size(390, 844);
    for (const genre of ["noir", "crime_scene", "paranormal"] as const) {
      keepRecap(`${genre}-tall`, RECAP);
      params.mockReturnValue({ roomId: `${genre}-tall`, genre, hints: "1", wrong: "1", ms: "300000" });
      await render(<PlayCompleteScreen />);
      expect(await screen.findByLabelText(/^Clues found:/)).toBeTruthy();
      const photo = (flat(screen.getByTestId("closed-polaroid")).width as number) - 2 * POLAROID.frame;
      expect(photo).toBeGreaterThanOrEqual(L.photo.min);
      expect(page(photo) + actions).toBeLessThanOrEqual(844);
      await screen.unmount();
    }
  });

  it("an iPhone SE: the polaroid keeps photo.min, and the page scrolls", async () => {
    size(375, 667);
    keepRecap("se-room", RECAP);
    params.mockReturnValue({ roomId: "se-room", genre: "noir", hints: "1", wrong: "1", ms: "300000" });
    await render(<PlayCompleteScreen />);
    expect(await screen.findByLabelText(/^Time:/)).toBeTruthy();
    const photo = (flat(screen.getByTestId("closed-polaroid")).width as number) - 2 * POLAROID.frame;
    expect(photo).toBe(L.photo.min);
    expect(screen.getByTestId("closed-scroll")).toBeTruthy();
  });

  it("the actions keep their size: the guide's pill and quiet pills, at least 44 tall", async () => {
    noirParams();
    await render(<NoirCompleteScreen />);
    expect(flat(screen.getByTestId("complete-new-case")).minHeight).toBe(ref.button.ghost.height);
    expect(flat(screen.getByTestId("complete-mode")).minHeight).toBe(ref.button.quiet.height);
    expect(Math.min(ref.button.ghost.height, ref.button.quiet.height)).toBeGreaterThanOrEqual(ref.hit.min);
    expect(T.meta.lineHeight).toBeGreaterThan(0);
  });
});

// Contrast on the page: every ink on it reads at 4.5:1 or more on the paper,
// and the seal's word on every stop of its foil.
describe("Case closed: contrast", () => {
  const lum = (hex: string) => {
    const n = parseInt(hex.slice(1, 7), 16);
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => c / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a: string, b: string) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };

  it("the page's inks and each mode's page ink on the paper; the seal's ink on its foil", () => {
    for (const ink of [PAGE.ink, PAGE.muted, ...Object.values(PAGE_INK)]) expect(contrast(ink, PAGE.paper)).toBeGreaterThanOrEqual(4.5);
    for (const genre of ["noir", "crime_scene", "paranormal"] as const) {
      // The word sits in the seal's middle, between its light and the foil (its shade is only at the rim).
      for (const foil of [SEAL.light, modeThemes[genre].foil]) expect(contrast(SEAL.ink, foil)).toBeGreaterThanOrEqual(4.5);
      // The cat's line over the page, in the sweet colour on the ground.
      expect(contrast(modeThemes[genre].sweet, modeThemes[genre].ground)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

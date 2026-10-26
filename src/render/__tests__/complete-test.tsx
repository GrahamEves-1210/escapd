// Case closed per mode: The Study (/tutorial/complete, noir) and custom rooms
// (/play/complete/<id>): noir's CASE CLOSED stamp, crime scene's accused under
// GUILTY, paranormal's "The presence is gone." with the room in full colour.
import { StyleSheet } from "react-native";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as api from "@/lib/escapd-api";
import { openCapture } from "@/capture/openCapture";
import { getMode } from "@/game/mode";
import { modeThemes, ref } from "@/theme/tokens";
import TutorialCompleteScreen from "../../../app/tutorial/complete";
import PlayCompleteScreen from "../../../app/play/complete/[roomId]";
import { stashClosedCase } from "../closedCase";
import { crimeCase } from "../__fixtures__/modeCases";

jest.mock("expo-router", () => ({
  router: { back: jest.fn(), replace: jest.fn(), push: jest.fn(), dismissTo: jest.fn(), canGoBack: jest.fn(() => true) },
  useLocalSearchParams: jest.fn(() => ({})),
}));

jest.mock("@/lib/escapd-api", () => ({ getLatestSession: jest.fn(), getPlayableDefinition: jest.fn() }));
jest.mock("@/capture/openCapture", () => ({ openCapture: jest.fn() }));

const mocked = api as jest.Mocked<typeof api>;
const capture = openCapture as jest.Mock;
const params = useLocalSearchParams as jest.Mock;
const flat = (node: { props: Record<string, unknown> }) => StyleSheet.flatten(node.props.style as Parameters<typeof StyleSheet.flatten>[0]) ?? {};
const P = ref.layout.play;
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
    puzzle_version_id: "v1",
  } as Awaited<ReturnType<typeof api.getLatestSession>>);
});

describe("Case closed: The Study (noir)", () => {
  it("stamps CASE CLOSED in noir's brass over the case's name, the messages and 07's stat cards", async () => {
    await render(<TutorialCompleteScreen />);
    expect(getMode()).toBe("noir");
    expect(mocked.getLatestSession).toHaveBeenCalledWith("00000000-0000-4000-8000-000000000001", "completed");
    expect(flat(screen.getByTestId("case-closed-noir"))).toMatchObject({ backgroundColor: NOIR.ground });
    expect(screen.getByTestId("closed-stamp")).toBeTruthy();
    expect(flat(screen.getByTestId("closed-stamp-frame"))).toMatchObject({ borderColor: NOIR.stamp, borderWidth: P.stamp.borderLarge });
    expect(flat(screen.getByText("Case closed"))).toMatchObject({ ...P.type.stampLarge, color: NOIR.stamp });
    const title = screen.getByText("The Study");
    expect(title.props.accessibilityRole).toBe("header");
    expect(flat(title)).toMatchObject({ ...P.type.caseTitle, color: NOIR.ink });
    expect(screen.getByText("You turn the key...")).toBeTruthy();
    expect(flat(screen.getByText("The door swings open. You escaped!"))).toMatchObject({ color: NOIR.inkMuted });
    expect(await screen.findByLabelText("Time: 8 min")).toBeTruthy();
    expect(screen.getByLabelText("Hints used: 1")).toBeTruthy();
  });

  it("falls back to the default exit line", async () => {
    params.mockReturnValue({});
    mocked.getLatestSession.mockResolvedValue(null);
    await render(<TutorialCompleteScreen />);
    expect(screen.getByText("The door swings open.")).toBeTruthy();
    expect(screen.queryByLabelText(/^Time:/)).toBeNull();
  });

  it("goes on to the player's own room in noir, back to Detective Noir, or replays The Study", async () => {
    await render(<TutorialCompleteScreen />);
    const bar = screen.getByTestId("complete-capture");
    expect(flat(bar)).toMatchObject({ backgroundColor: NOIR.accent, borderRadius: P.bar.radius });
    await fireEvent.press(bar);
    expect(capture).toHaveBeenLastCalledWith({ genre: "noir", replace: true });
    await fireEvent.press(screen.getByLabelText("Back to Detective Noir"));
    expect(router.dismissTo).toHaveBeenLastCalledWith({ pathname: "/mode/[genre]", params: { genre: "noir" } });
    await fireEvent.press(screen.getByLabelText("Replay The Study"));
    expect(router.replace).toHaveBeenLastCalledWith("/tutorial");
  });

  it("still opens the camera when the access check can't run", async () => {
    capture.mockRejectedValueOnce(new TypeError("Network request failed"));
    await render(<TutorialCompleteScreen />);
    await fireEvent.press(screen.getByTestId("complete-capture"));
    await waitFor(() => expect(router.replace).toHaveBeenLastCalledWith("/capture"));
  });
});

describe("Case closed: custom rooms", () => {
  const ROOM = "c0220000-0000-4000-8000-000000000022";

  it("crime scene: the accused's card under the GUILTY stamp, from the case the player just closed", async () => {
    stashClosedCase({ roomId: ROOM, genre: "crime_scene", title: "The Poisoned Toast", accused: crimeCase().puzzles.at(-1)!.suspects![0] });
    params.mockReturnValue({ roomId: ROOM, genre: "crime_scene", title: "The Poisoned Toast", message: "Ivy did it.", exit: "", suspect: "s_ivy" });
    await render(<PlayCompleteScreen />);
    expect(getMode()).toBe("crime_scene");
    expect(flat(screen.getByTestId("case-closed-crime_scene"))).toMatchObject({ backgroundColor: CRIME.ground });
    // The card is one element for screen readers: it speaks the verdict its stamp shows.
    expect(screen.getByTestId("closed-accused").props.accessibilityLabel).toMatch(/^Guilty\. Ivy Marsh, The housekeeper\./);
    expect(flat(screen.getByText("Guilty", hidden))).toMatchObject({ ...P.type.stampLarge, color: CRIME.stamp });
    // GUILTY takes CASE CLOSED's place.
    expect(screen.queryByTestId("closed-stamp")).toBeNull();
    expect(screen.getByText("The Poisoned Toast")).toBeTruthy();
    expect(await screen.findByLabelText("Time: 8 min")).toBeTruthy();
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

  it("noir: CASE CLOSED; then a new case in the mode, back to the mode, or this case again", async () => {
    params.mockReturnValue({ roomId: "noir-room", genre: "noir", title: "The Second Drawer" });
    await render(<PlayCompleteScreen />);
    expect(screen.getByTestId("closed-stamp")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("complete-new-case"));
    expect(capture).toHaveBeenLastCalledWith({ genre: "noir", replace: true });
    await fireEvent.press(screen.getByLabelText("Back to Detective Noir"));
    expect(router.dismissTo).toHaveBeenLastCalledWith({ pathname: "/mode/[genre]", params: { genre: "noir" } });
    await fireEvent.press(screen.getByLabelText("Play this case again"));
    expect(router.replace).toHaveBeenLastCalledWith({ pathname: "/play/[roomId]", params: { roomId: "noir-room" } });
  });
});

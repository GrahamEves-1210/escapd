// 06 · Building your case (/capture/develop): the build wait, the ready
// moment and every state around them. useDevelopment is mocked to a canned
// stage, so these test what the screen shows for each stage the server
// reports; useDevelopment's own logic has its own tests.
import { BackHandler, StyleSheet } from "react-native";
import type { ReactElement } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { createGestureController, getByGestureTestId } from "react-native-gesture-handler/jest-utils";
import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native";
import { router, useLocalSearchParams } from "expo-router";
import type { DevStage } from "@/capture/useDevelopment";
import { addPlate, clearPlates } from "@/capture/roll";
import { setMode } from "@/game/mode";
import { useRoomTone } from "@/game/useRoomTone";
import type { GenerationJob } from "@/lib/escapd-api";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { modeThemes, motion, ref } from "@/theme/tokens";
import DarkroomScreen from "../../../../app/capture/develop";
import { HOME_LABEL, LEAVE_LABEL, TYPEWRITER_GAP } from "../BuildWait";
import {
  BUILDING_LABEL,
  BUILDING_LINES,
  QUEUED_LINE,
  READY_LINE,
  RETRY_LINE,
  STATUS_MAX,
  sendingLine,
  waitStatus,
} from "../copy";
import { panoramaLayout, wrapOffset } from "../RoomPanorama";

let mockStage: DevStage = { kind: "checking" };
const mockRetry = jest.fn();
const mockUseDevelopment = jest.fn((_roomId?: string) => ({ stage: mockStage, retry: mockRetry }));

jest.mock("@/capture/useDevelopment", () => ({
  useDevelopment: (roomId?: string) => mockUseDevelopment(roomId),
}));

jest.mock("expo-router", () => {
  const { useEffect } = jest.requireActual<typeof import("react")>("react");
  return {
    router: { back: jest.fn(), replace: jest.fn(), push: jest.fn(), dismissTo: jest.fn(), canGoBack: jest.fn(() => true) },
    useLocalSearchParams: jest.fn(() => ({})),
    useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]),
    useIsFocused: () => true,
  };
});

jest.mock("@/game/useRoomTone", () => ({ useRoomTone: jest.fn() }));

// The full shape of useFeedback (src/game/feedback.ts), one stable object as the real hook memoises.
const mockFeedback = {
  tick: jest.fn(), tap: jest.fn(), press: jest.fn(), thud: jest.fn(), success: jest.fn(), warning: jest.fn(), error: jest.fn(),
  paper: jest.fn(), pickup: jest.fn(), wrongCode: jest.fn(), unlock: jest.fn(), stamp: jest.fn(), solved: jest.fn(),
  shutter: jest.fn(), typewriter: jest.fn(),
};
jest.mock("@/game/feedback", () => ({ useFeedback: () => mockFeedback }));
// A bake that is ready at once ("baked/<mode>/<photo>"), and none in the shell, as the real one.
jest.mock("@/components/noir/treatPhoto", () => ({
  ...jest.requireActual("@/components/noir/treatPhoto"),
  useTreatedPhoto: (source: string, genre: string | null) => (genre ? `baked/${genre}/${source}` : null),
}));
// The drawn cover bakes with Skia; here it is just its frame.
jest.mock("@/screens/hub/art/ModeCover", () => {
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  return { ModeCover: ({ genre, testID }: { genre: string; testID?: string }) => <View testID={testID} accessibilityHint={genre} /> };
});

const D = ref.layout.develop;
const T = ref.motion.thinking;
const STAMP = ref.layout.play.stamp;
const hidden = { includeHiddenElements: true } as const;
const styleOf = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) ?? {};
const FRAME = { width: 353, height: 400 };

const job = (overrides: Partial<GenerationJob> = {}): GenerationJob => ({
  id: "j1", room_id: "r1", owner_id: "u1", idempotency_key: "k", status: "queued", attempt_count: 0, max_attempts: 3,
  prompt_version: "v1", output_schema_version: 1, next_attempt_at: "", lease_token: null, leased_by: null,
  lease_expires_at: null, error_code: null, error_message: null, result_version_id: null, started_at: null,
  finished_at: null, created_at: new Date().toISOString(), updated_at: "", genre: "noir", ...overrides,
});

const sending = (sent: number, total = 6): DevStage => ({ kind: "sending", sent, total });
const waiting = (overrides: Partial<GenerationJob> = {}): DevStage => ({ kind: "waiting", roomId: "r1", job: job(overrides) });
const queued = waiting();
const running = waiting({ status: "running" });
const retrying = waiting({ attempt_count: 1 });
const ready: DevStage = { kind: "ready", roomId: "r9" };
type Wait = Extract<DevStage, { kind: "sending" | "waiting" }>;

type AnimatedStyle = { opacity?: number; transform?: Record<string, number | string>[] };
const animated = (testID: string): AnimatedStyle =>
  (screen.getByTestId(testID, hidden).props.jestAnimatedStyle as { value?: AnimatedStyle } | undefined)?.value ?? {};
const transformOf = (testID: string, key: string) => Number(animated(testID).transform?.find((t) => key in t)?.[key] ?? 0);
/** How far round the loop the room has turned (the strip moves left as it turns). */
const turned = () => -transformOf("build-strip", "translateX");

const advance = (ms: number) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
  });

function wrap(ui: ReactElement, reducedMotion: boolean) {
  return (
    <GestureHandlerRootView>
      <ThemeProvider reducedMotion={reducedMotion}>{ui}</ThemeProvider>
    </GestureHandlerRootView>
  );
}

async function renderScreen(stage: DevStage, reducedMotion = false) {
  mockStage = stage;
  await render(wrap(<DarkroomScreen />, reducedMotion));
  const room = screen.queryByTestId("build-room", hidden);
  if (room) await fireEvent(room, "layout", { nativeEvent: { layout: { x: 0, y: 0, ...FRAME } } });
  await advance(16);
}

/** Moves the screen to another stage, as useDevelopment would. */
async function goTo(stage: DevStage, reducedMotion = false) {
  mockStage = stage;
  await act(() => screen.rerender(wrap(<DarkroomScreen />, reducedMotion)));
  await advance(16);
}

const user = () => userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  clearPlates();
  for (let i = 0; i < 6; i++) addPlate({ uri: `file://photo-${i}.jpg`, width: 1200, height: 1600 });
  mockStage = { kind: "checking" };
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

describe("the words", () => {
  it("says what each wait is in one short line, and what screen readers hear", () => {
    expect(waitStatus(queued as Wait, "noir")).toEqual({ phase: "queued", lines: [QUEUED_LINE], label: "Your case is next" });
    expect(waitStatus(retrying as Wait, null)).toEqual({ phase: "retry", lines: [RETRY_LINE], label: "Trying again" });
    expect(waitStatus(running as Wait, null)).toEqual({ phase: "running", lines: BUILDING_LINES.shell, label: BUILDING_LABEL });
    // A retried job that is running again is building.
    expect(waitStatus(waiting({ status: "running", attempt_count: 1 }) as Wait, "paranormal").lines).toBe(BUILDING_LINES.paranormal);
  });

  it("counts the photo being sent, factually, sized to every count so the line never resizes", () => {
    expect(waitStatus({ kind: "sending", sent: 1, total: 4 }, "noir")).toEqual({
      phase: "sending",
      lines: ["Sending photo 2 of 4"],
      label: "Sending photo 2 of 4",
      sizeTo: ["Sending photo 1 of 4", "Sending photo 2 of 4", "Sending photo 3 of 4", "Sending photo 4 of 4"],
    });
    // All sent, the job not yet made: the last count holds.
    expect(waitStatus({ kind: "sending", sent: 4, total: 4 }, null).lines).toEqual([sendingLine(4, 4)]);
  });

  it("gives each mode the same three real steps, in its own light voice, every line one line long at 375", () => {
    for (const lines of Object.values(BUILDING_LINES)) {
      expect(lines).toHaveLength(3);
      expect(lines[0]).toMatch(/object|corner/i);
      expect(lines[1]).toMatch(/hide/);
      expect(lines[2]).toMatch(/case/);
    }
    const all = [...Object.values(BUILDING_LINES).flat(), QUEUED_LINE, RETRY_LINE, READY_LINE, sendingLine(6, 6)];
    for (const line of all) expect(line.length).toBeLessThanOrEqual(STATUS_MAX);
    // Never a fake find or a fake number.
    for (const line of all) expect(line).not.toMatch(/%|found \d|\d+ (objects|clues)/i);
  });
});

describe("the room's arithmetic", () => {
  it("lays out tiles as tall as the frame, a centre crop of each photo, with enough copies that the loop never shows a gap", () => {
    const { tile, pitch, loop, copies } = panoramaLayout(6, 353, 400);
    expect(tile).toBe(Math.round(400 * D.tile.aspect));
    expect(pitch).toBe(tile + D.tile.gap);
    expect(loop).toBe(6 * pitch);
    // The copies always reach a frame's width past the end of one turn.
    expect((copies - 6) * pitch).toBeGreaterThanOrEqual(353 + pitch);
    expect(panoramaLayout(0, 353, 400).copies).toBe(0);
  });

  it("wraps the turn round the loop", () => {
    expect(wrapOffset(10, 100)).toBe(10);
    expect(wrapOffset(110, 100)).toBe(10);
    expect(wrapOffset(-10, 100)).toBe(90);
    expect(wrapOffset(5, 0)).toBe(0);
  });
});

describe("the wait: one visual, one title, one line", () => {
  it("has none of the old clutter: no Leave it building, no stamp pill, no body paragraph, no numbered tiles, no clock", async () => {
    await renderScreen(running);
    expect(screen.queryByText("Leave it building")).toBeNull();
    expect(screen.queryByRole("button", { name: "Leave it building" })).toBeNull();
    for (const old of ["BUILDING", "IN THE QUEUE", "SECOND TRY", "SENDING PHOTOS"]) expect(screen.queryByText(old, hidden)).toBeNull();
    expect(screen.queryByText(/This usually takes a minute or two/, hidden)).toBeNull();
    expect(screen.queryByTestId("darkroom-plates", hidden)).toBeNull();
    expect(screen.queryByTestId("darkroom-glass", hidden)).toBeNull();
    expect(screen.queryByTestId("darkroom-elapsed", hidden)).toBeNull();
    expect(screen.queryByText("1", hidden)).toBeNull();
    // What there is: the room, the title, the line, and the quiet close.
    expect(screen.getByTestId("build-room", hidden)).toBeTruthy();
    expect(screen.getByRole("header", { name: "Building your case" })).toBeTruthy();
    expect(screen.getByTestId("build-status")).toBeTruthy();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.container.queryAll((node) => node.type === "ActivityIndicator")).toHaveLength(0);
  });

  it("keeps the room out of the screen reader's way; the status line is its polite live region", async () => {
    await renderScreen(running);
    const room = screen.getByTestId("build-room", hidden);
    expect(room.props.accessibilityElementsHidden).toBe(true);
    expect(room.props.importantForAccessibility).toBe("no-hide-descendants");
    expect(screen.getByTestId("build-status").props).toMatchObject({ accessibilityLabel: BUILDING_LABEL, accessibilityLiveRegion: "polite" });
  });

  it("rotates the running lines under one fixed label, every status.hold", async () => {
    await renderScreen(running, true);
    const shown = (text: string) => screen.queryAllByText(text, hidden).filter((node) => styleOf(node).color === ref.color.textSecondary);
    expect(shown("Finding the objects")).toHaveLength(1);
    await advance(T.gap + T.swap + D.status.hold);
    expect(shown("Choosing what to hide")).toHaveLength(1);
    await advance(T.gap + T.swap + D.status.hold);
    expect(shown("Writing the case")).toHaveLength(1);
    expect(screen.getByTestId("build-status").props.accessibilityLabel).toBe(BUILDING_LABEL);
  });

  it("sets the status line at the feature size, in a box sized to every count", async () => {
    await renderScreen(sending(0), true);
    const line = screen.getAllByText("Sending photo 1 of 6", hidden);
    expect(line.some((node) => styleOf(node).fontSize === ref.type.status.fontSize)).toBe(true);
    expect(ref.type.status.fontSize).toBeGreaterThanOrEqual(20);
    for (let n = 1; n <= 6; n++) expect(screen.getAllByText(sendingLine(n, 6), hidden).length).toBeGreaterThan(0);
    await goTo(sending(1), true);
    await advance(motion.reducedFade);
    expect(screen.getByTestId("build-status").props.accessibilityLabel).toBe("Sending photo 2 of 6");
  });

  it("queued and trying again: one calm line each", async () => {
    await renderScreen(queued);
    expect(screen.getByTestId("build-status").props.accessibilityLabel).toBe("Your case is next");
    await goTo(retrying);
    expect(screen.getByTestId("build-status").props.accessibilityLabel).toBe("Trying again");
    expect(screen.getByRole("header", { name: "Building your case" })).toBeTruthy();
  });

  it("plays the mode's room tone, quietly, while the wait and the ready moment are on screen; not on the asks", async () => {
    await renderScreen(running);
    expect(useRoomTone).toHaveBeenLastCalledWith(true);
    await goTo(ready);
    expect(useRoomTone).toHaveBeenLastCalledWith(true);
    jest.mocked(useRoomTone).mockClear();
    await goTo({ kind: "error", message: "Couldn't connect." });
    expect(useRoomTone).not.toHaveBeenCalled();
  });
});

describe("the room turning", () => {
  it("drifts round the loop on its own, easing up from rest", async () => {
    await renderScreen(running);
    const first = turned();
    await advance(400);
    const early = turned() - first;
    await advance(D.drift.rampIn);
    const before = turned();
    await advance(1000);
    // At cruise: about drift.speed pt a second, and faster than as it set off.
    expect(turned() - before).toBeGreaterThan(D.drift.speed * 0.8);
    expect(turned() - before).toBeLessThan(D.drift.speed * 1.2);
    expect(early).toBeLessThan((D.drift.speed * 400) / 1000);
    expect(early).toBeGreaterThan(0);
  });

  it("is a toy: a drag takes the room at once and pauses the drift; let go, it coasts, rests, then drifts again", async () => {
    await renderScreen(running);
    await advance(D.drift.rampIn + 500);
    const pan = createGestureController(getByGestureTestId("build-drag"));
    await act(() => {
      pan.begin({ translationX: 0, velocityX: 0 });
      pan.activate({ translationX: -9, velocityX: 0 });
    });
    await advance(16);
    const grabbed = turned();
    // Held still: time passes and the room doesn't drift.
    await advance(1500);
    expect(turned()).toBeCloseTo(grabbed, 1);
    // It follows the finger: dragging left turns it on.
    await act(() => pan.update({ translationX: -60, velocityX: 0 }));
    await advance(16);
    expect(turned()).toBeCloseTo(grabbed + 51, 0);
    await advance(1000);
    expect(turned()).toBeCloseTo(grabbed + 51, 0);
    // Let go with no fling: it rests, then eases back into its drift.
    await act(() => pan.end({ translationX: -60, velocityX: 0 }));
    await advance(D.drift.resume - 200);
    const resting = turned();
    await advance(D.drift.rampIn + 1000);
    expect(turned()).toBeGreaterThan(resting + D.drift.speed * 0.5);
  });

  it("settles to rest when the case is ready, and the lights come up", async () => {
    await renderScreen(running);
    await advance(D.drift.rampIn + 500);
    expect(animated("build-beam").opacity).toBe(1);
    await goTo(ready);
    await advance(D.drift.settle + 100);
    const rest = turned();
    await advance(2000);
    expect(turned()).toBeCloseTo(rest, 2);
    expect(animated("build-beam").opacity).toBe(0);
  });

  it("shows the photos in the mode's baked treatment at the review tiles' bake, round the loop", async () => {
    setMode("paranormal");
    await renderScreen(running);
    const uriOf = (testID: string) => ([screen.getByTestId(testID, hidden).props.source].flat()[0] as { uri: string }).uri;
    expect(uriOf("build-photo-0-treated")).toBe("baked/paranormal/file://photo-0.jpg");
    // After photo 6 comes photo 1 again.
    expect(uriOf("build-photo-6-treated")).toBe("baked/paranormal/file://photo-0.jpg");
    await act(() => setMode(null));
  });

  it("with no photos on this phone (followed from home), the mode's cover under the beam", async () => {
    clearPlates();
    setMode("crime_scene");
    jest.mocked(useLocalSearchParams).mockReturnValue({ roomId: "r7" });
    await renderScreen(queued);
    expect(mockUseDevelopment).toHaveBeenCalledWith("r7");
    expect(screen.getByTestId("build-cover", hidden).props.accessibilityHint).toBe("crime_scene");
    expect(screen.queryByTestId("build-strip", hidden)).toBeNull();
    expect(screen.getByTestId("build-status").props.accessibilityLabel).toBe("Your case is next");
    jest.mocked(useLocalSearchParams).mockReturnValue({});
    await act(() => setMode(null));
  });
});

describe("Reduce Motion", () => {
  it("no drift, no wandering beam, no drag: one photo at a time, cross-fading to the next", async () => {
    await renderScreen(running, true);
    expect(screen.queryByTestId("build-strip", hidden)).toBeNull();
    expect(screen.getByTestId("build-still-0", hidden)).toBeTruthy();
    expect(transformOf("build-beam", "translateX")).toBe(0);
    await advance(3000);
    expect(transformOf("build-beam", "translateX")).toBe(0);
    await advance(D.still.hold + D.still.fade);
    expect(screen.getByTestId("build-still-1", hidden)).toBeTruthy();
  });

  it("ready: a still stamp, with its cue and then success, and the pill at once", async () => {
    await renderScreen(running, true);
    await goTo(ready, true);
    expect(screen.getByText("CASE READY", hidden)).toBeTruthy();
    expect(mockFeedback.stamp).toHaveBeenCalledTimes(1);
    expect(mockFeedback.success).not.toHaveBeenCalled();
    await advance(D.ready.success);
    expect(mockFeedback.success).toHaveBeenCalledTimes(1);
    expect(mockFeedback.stamp.mock.invocationCallOrder[0]).toBeLessThan(mockFeedback.success.mock.invocationCallOrder[0]);
    expect(screen.getByRole("button", { name: "Open the case" })).toBeTruthy();
  });
});

describe("the way out", () => {
  it("is a square close in the header, labelled, that goes home with a light press", async () => {
    await renderScreen(running);
    const close = screen.getByRole("button", { name: LEAVE_LABEL });
    expect(styleOf(close)).toMatchObject({ width: ref.button.square.size, height: ref.button.square.size, borderRadius: ref.button.square.radius });
    await user().press(close);
    expect(router.replace).toHaveBeenCalledWith("/");
    expect(mockFeedback.press).toHaveBeenCalledTimes(1);
    expect(mockFeedback.thud).not.toHaveBeenCalled();
  });

  it("Android's back goes home too, the case still building", async () => {
    const backPress = jest.spyOn(BackHandler, "addEventListener");
    await renderScreen(queued);
    const hardwareBack = backPress.mock.calls.at(-1)?.[1];
    expect(hardwareBack?.({ type: "hardwareBackPress", timeStamp: 0 } as never)).toBe(true);
    expect(router.replace).toHaveBeenCalledWith("/");
    backPress.mockRestore();
  });

  it("isn't offered while the photos are still sending: nothing to press", async () => {
    const backPress = jest.spyOn(BackHandler, "addEventListener");
    await renderScreen(sending(2));
    expect(screen.queryByRole("button")).toBeNull();
    expect(backPress).not.toHaveBeenCalled();
    backPress.mockRestore();
  });

  it("once ready, it says it goes home", async () => {
    await renderScreen(ready);
    expect(screen.getByRole("button", { name: HOME_LABEL })).toBeTruthy();
  });
});

describe("ready: the reward", () => {
  it("slams CASE READY onto the room, then success, then Open the case appears at the foot", async () => {
    await renderScreen(running);
    await goTo(ready);
    expect(screen.getByRole("header", { name: "Your case is ready" })).toBeTruthy();
    expect(screen.getByText(READY_LINE)).toBeTruthy();
    expect(screen.queryByTestId("build-status", hidden)).toBeNull();
    // Falling: no cue yet, and nothing to press but the close.
    expect(mockFeedback.stamp).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Open the case" })).toBeNull();
    await advance(D.ready.stampDelay + STAMP.slam + 16);
    expect(mockFeedback.stamp).toHaveBeenCalledTimes(1);
    expect(mockFeedback.success).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Open the case" })).toBeTruthy();
    await advance(D.ready.success);
    expect(mockFeedback.success).toHaveBeenCalledTimes(1);
    expect(mockFeedback.stamp.mock.invocationCallOrder[0]).toBeLessThan(mockFeedback.success.mock.invocationCallOrder[0]);
    expect(mockFeedback.solved).not.toHaveBeenCalled();
  });

  it("opens the case from the guide's pill with the weighty thud, clearing the photos", async () => {
    await renderScreen(ready);
    await advance(D.ready.stampDelay + STAMP.slam + D.ready.success + 16);
    const bar = screen.getByTestId("open-case");
    expect(styleOf(bar)).toMatchObject({ minHeight: ref.button.ghost.height, alignSelf: "stretch" });
    expect(styleOf(screen.getByTestId("state-actions"))).toMatchObject({ paddingHorizontal: ref.space.reading });
    await user().press(screen.getByRole("button", { name: "Open the case" }));
    expect(mockFeedback.thud).toHaveBeenCalledTimes(1);
    expect(mockFeedback.press).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith("/play/r9");
  });
});

describe("sound and haptics through the wait", () => {
  it("ticks once each time a photo finishes sending, never on mount", async () => {
    await renderScreen(sending(0));
    expect(mockFeedback.tick).not.toHaveBeenCalled();
    await goTo(sending(1));
    expect(mockFeedback.tick).toHaveBeenCalledTimes(1);
    await goTo(sending(2));
    expect(mockFeedback.tick).toHaveBeenCalledTimes(2);
    // A re-render at the same count, and the move to the queue, add none.
    await goTo(sending(2));
    await goTo(queued);
    expect(mockFeedback.tick).toHaveBeenCalledTimes(2);
  });

  it("resuming mid-send (the first count already above zero) doesn't tick", async () => {
    await renderScreen({ kind: "checking" });
    await goTo(sending(3));
    expect(mockFeedback.tick).not.toHaveBeenCalled();
  });

  it("types when the status changes meaning, never on mount, never for a count or a rotation, and not twice within the gap", async () => {
    await renderScreen(sending(0));
    await goTo(sending(1));
    expect(mockFeedback.typewriter).not.toHaveBeenCalled();
    await goTo(queued);
    expect(mockFeedback.typewriter).toHaveBeenCalledTimes(1);
    // Straight on to building: too soon after the last.
    await goTo(running);
    expect(mockFeedback.typewriter).toHaveBeenCalledTimes(1);
    await advance(TYPEWRITER_GAP * 3);
    expect(mockFeedback.typewriter).toHaveBeenCalledTimes(1);
    await goTo(retrying);
    expect(mockFeedback.typewriter).toHaveBeenCalledTimes(2);
  });

  it("a failure stays a calm warning, once", async () => {
    await renderScreen(running);
    await goTo({ kind: "failed", roomId: "r1", copy: { title: "A photo didn't come through", body: "Retake it.", action: "retake", plates: [], flagged: [], issue: null } });
    expect(mockFeedback.warning).toHaveBeenCalledTimes(1);
    expect(mockFeedback.error).not.toHaveBeenCalled();
    expect(screen.queryByTestId("build-room", hidden)).toBeNull();
  });
});

describe("the asks and failures (StateScreen), unchanged", () => {
  it("the access check is One moment, a thinking line with no spinner and no room", async () => {
    await renderScreen({ kind: "checking" });
    expect(screen.getByTestId("state-loading").props.accessibilityLabel).toBe("One moment");
    expect(screen.container.queryAll((node) => node.type === "ActivityIndicator")).toHaveLength(0);
    expect(screen.queryByTestId("build-room", hidden)).toBeNull();
  });

  it("asks a guest for an email, and checks again on coming back", async () => {
    await renderScreen({ kind: "account" });
    expect(screen.getByText("Keep your cases on an account")).toBeTruthy();
    await user().press(screen.getByRole("button", { name: "Add your email" }));
    expect(router.push).toHaveBeenCalledWith({ pathname: "/account", params: { next: "back" } });
    await user().press(screen.getByRole("button", { name: "Back to your photos" }));
    expect(router.back).toHaveBeenCalled();
  });

  it("Pro access and the monthly limit", async () => {
    await renderScreen({ kind: "access", reason: "entitlement" });
    expect(screen.getByText("Your own rooms are part of ESCAPD Pro")).toBeTruthy();
    await user().press(screen.getByRole("button", { name: "Try again" }));
    expect(mockRetry).toHaveBeenCalled();
    await goTo({ kind: "access", reason: "cap" });
    expect(screen.getByText("You've built every case this month allows")).toBeTruthy();
    await user().press(screen.getByRole("button", { name: "Back to home" }));
    expect(router.replace).toHaveBeenCalledWith("/");
  });

  it("an error: try again or back to the photos", async () => {
    await renderScreen({ kind: "error", message: "You're offline. Your photos are safe. Connect and try again." });
    expect(screen.getByText("The case didn't go through")).toBeTruthy();
    expect(screen.getByText("You're offline. Your photos are safe. Connect and try again.")).toBeTruthy();
    await user().press(screen.getByRole("button", { name: "Try again" }));
    expect(mockRetry).toHaveBeenCalledWith();
  });

  it("a failure to try again builds the same room again", async () => {
    await renderScreen({ kind: "failed", roomId: "r3", copy: { title: "That took longer than it should", body: "Try again in a minute.", action: "retry", plates: [], flagged: [], issue: null } });
    await user().press(screen.getByRole("button", { name: "Try again" }));
    expect(mockRetry).toHaveBeenCalledWith("r3");
    await user().press(screen.getByRole("button", { name: "Back to home" }));
    expect(router.replace).toHaveBeenCalledWith("/");
  });

  it("a privacy failure sends each flagged photo's slot back with its reason", async () => {
    await renderScreen({
      kind: "failed",
      roomId: "r1",
      copy: {
        title: "A few photos need a retake",
        body: "Retake the marked photos.",
        action: "retake",
        plates: [0, 2],
        flagged: [{ slot: 0, reason: "person" }, { slot: 2, reason: "private_text" }],
        issue: null,
      },
    });
    await user().press(screen.getByRole("button", { name: "Retake photos" }));
    expect(router.dismissTo).toHaveBeenCalledWith({ pathname: "/capture/review", params: { flag: "0:person,2:private_text" } });
  });

  it("a whole-set failure carries its note to the review screen", async () => {
    await renderScreen({
      kind: "failed",
      roomId: "r1",
      copy: { title: "Not enough to build a case from", body: "Add a close view.", action: "retake", plates: [], flagged: [], issue: "too_few_objects" },
    });
    await user().press(screen.getByRole("button", { name: "Retake photos" }));
    expect(router.dismissTo).toHaveBeenCalledWith({ pathname: "/capture/review", params: { flag: "", issue: "too_few_objects" } });
  });

  it("with no photos left on this phone, a retake starts the camera again", async () => {
    clearPlates();
    await renderScreen({ kind: "failed", roomId: "r1", copy: { title: "A photo didn't come through", body: "Retake it.", action: "retake", plates: [], flagged: [], issue: null } });
    await user().press(screen.getByRole("button", { name: "Take the photos again" }));
    expect(router.replace).toHaveBeenCalledWith("/capture");
  });
});

describe("plain language (round 4)", () => {
  const WORDS = /plate|develop|darkroom|light table|title screen|\broll\b|\bfilm\b|\bAI\b/i;
  const stages: DevStage[] = [
    { kind: "checking" },
    { kind: "account" },
    { kind: "access", reason: "entitlement" },
    { kind: "access", reason: "cap" },
    sending(1),
    queued,
    running,
    retrying,
    ready,
    { kind: "failed", roomId: "r1", copy: { title: "A photo didn't come through", body: "Retake it.", action: "retake", plates: [], flagged: [], issue: null } },
    { kind: "error", message: "Couldn't connect. Try again." },
  ];
  it.each(stages.map((stage) => [stage.kind, stage] as const))("%s: nothing seen or heard uses the old darkroom words", async (_kind, stage) => {
    await renderScreen(stage);
    const said = screen.container
      .queryAll(() => true)
      .flatMap((node) => [node.props.accessibilityLabel, typeof node.props.children === "string" ? node.props.children : null])
      .filter((text): text is string => typeof text === "string");
    expect(said.length).toBeGreaterThan(0);
    for (const text of said) expect(text).not.toMatch(WORDS);
  });

  it("no mode's running lines use them either", () => {
    for (const line of Object.values(BUILDING_LINES).flat()) expect(line).not.toMatch(WORDS);
  });
});

describe("inside a mode", () => {
  const theme = modeThemes.paranormal;
  beforeEach(() => setMode("paranormal"));
  afterEach(() => act(() => setMode(null)));

  it("takes the mode's ground, its display face for the title, and its colours for the line's sweep", async () => {
    await renderScreen(running);
    expect(styleOf(screen.getByTestId("darkroom-root")).backgroundColor).toBe(theme.surface);
    expect(styleOf(screen.getByTestId("build-room", hidden)).backgroundColor).toBe(theme.ground);
    expect(styleOf(screen.getByRole("header", { name: "Building your case" }))).toMatchObject({
      fontFamily: theme.display.fontFamily,
      textTransform: "uppercase",
      fontSize: D.titleSize.paranormal,
      color: theme.ink,
    });
    // The close square in the mode's raised fill and ink.
    expect(styleOf(screen.getByRole("button", { name: LEAVE_LABEL })).backgroundColor).toBe(theme.raised);
  });

  it("the stamp in the mode's stamp colour, and the pill in its accent", async () => {
    await renderScreen(ready);
    await advance(D.ready.stampDelay + STAMP.slam + D.ready.success + 16);
    expect(styleOf(screen.getByText("CASE READY", hidden)).color).toBe(theme.stamp);
    expect(styleOf(screen.getByTestId("open-case")).backgroundColor).toBe(theme.accent);
    expect(styleOf(screen.getByText("Open the case")).color).toBe(theme.accentInk);
  });

  it("draws the calm states in the mode's colours, with every action working", async () => {
    await renderScreen({ kind: "error", message: "Couldn't connect." });
    expect(styleOf(screen.getByTestId("state-screen")).backgroundColor).toBe(theme.surface);
    expect(styleOf(screen.getByText("The case didn't go through")).color).toBe(theme.ink);
    await user().press(screen.getByRole("button", { name: "Try again" }));
    expect(mockRetry).toHaveBeenCalled();
  });
});

describe("in the shell (no mode)", () => {
  it("shows the photos as taken, with no treatment, and no cover when there are none", async () => {
    await renderScreen(running);
    expect(screen.queryByTestId("build-photo-0-treated", hidden)).toBeNull();
    expect(screen.getByTestId("build-photo-0-original", hidden)).toBeTruthy();
    await act(() => clearPlates());
    await goTo(queued);
    expect(screen.queryByTestId("build-cover", hidden)).toBeNull();
  });
});

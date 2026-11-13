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
import { HOME_LABEL, LEAVE_LABEL, TITLE_SIZE, TYPEWRITER_GAP } from "../BuildWait";
import {
  BUILDING_LABEL,
  BUILD_TITLE,
  QUEUED_LINE,
  READY_TITLE,
  RETRY_LINE,
  STATUS_MAX,
  sendingLine,
  waitStatus,
} from "../copy";
import { SEAL } from "@/render/keepsake";
import { DARK, SCENE, SLOTS, hangAt, lineY, sceneLayout, slotOf } from "../Darkroom";

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
const STAMP = ref.layout.play.stamp;
const hidden = { includeHiddenElements: true } as const;
const styleOf = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) ?? {};
const FRAME = { width: 353, height: 440 };
const STAGE = sceneLayout(FRAME.width, FRAME.height);

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
const transformOf = (testID: string, key: string) => parseFloat(String(animated(testID).transform?.find((t) => key in t)?.[key] ?? 0));
/** How far the tray is tipped (degrees). */
const rocked = () => transformOf("build-tray", "rotate");
/** Where a print's middle is on the stage, from its transform. */
const middleOf = (index: number) => ({
  x: transformOf(`build-print-${index}`, "translateX") + (SCENE.sheet.w * STAGE.s) / 2,
  y: transformOf(`build-print-${index}`, "translateY") + (SCENE.sheet.h * STAGE.s) / 2,
});
/** A print's place in the pile, from its layer: the top sheet is the highest. */
const layerOf = (index: number) => Number(styleOf(screen.getByTestId(`build-print-${index}`, hidden)).zIndex);
const topOfPile = () => [0, 1, 2, 3, 4, 5].reduce((top, i) => (layerOf(i) > layerOf(top) ? i : top), 0);

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
  it("tells a screen reader each wait in one short line; on screen, only a second try has a line of its own", () => {
    expect(waitStatus(queued as Wait)).toEqual({ phase: "queued", line: null, label: "Your case is next" });
    expect(waitStatus(retrying as Wait)).toEqual({ phase: "retry", line: RETRY_LINE, label: "Trying again" });
    expect(waitStatus(running as Wait)).toEqual({ phase: "running", line: null, label: BUILDING_LABEL });
    // A retried job that is running again is building.
    expect(waitStatus(waiting({ status: "running", attempt_count: 1 }) as Wait)).toEqual({ phase: "running", line: null, label: BUILDING_LABEL });
  });

  it("counts the photo being sent, factually, for a screen reader", () => {
    expect(waitStatus({ kind: "sending", sent: 1, total: 4 })).toEqual({ phase: "sending", line: null, label: "Sending photo 2 of 4" });
    // All sent, the job not yet made: the last count holds.
    expect(waitStatus({ kind: "sending", sent: 4, total: 4 }).label).toBe(sendingLine(4, 4));
  });

  it("keeps what is shown short and honest, and names the three real steps of building only where the room can't be seen", () => {
    for (const line of [BUILD_TITLE, READY_TITLE, RETRY_LINE, QUEUED_LINE, sendingLine(7, 7)]) expect(line.length).toBeLessThanOrEqual(STATUS_MAX);
    expect(BUILDING_LABEL).toMatch(/objects.*hide.*case/);
    // Never a fake find or a fake number.
    for (const line of [BUILD_TITLE, READY_TITLE, RETRY_LINE, QUEUED_LINE, BUILDING_LABEL]) expect(line).not.toMatch(/%|found \d|\d+ (objects|clues)/i);
  });
});

describe("the darkroom's arithmetic", () => {
  it("stands the bench on the stage's foot, centred, at one scale, the line across the top", () => {
    const { s, pic, edge, liquid } = sceneLayout(358, 440);
    expect(s).toBe(1);
    // The bench picture is wider than the stage (the frame crops it) and ends on its foot.
    expect(pic).toEqual({ left: (358 - SCENE.pic.w) / 2, top: 440 - SCENE.pic.h, width: SCENE.pic.w, height: SCENE.pic.h });
    expect(edge).toBe(440 - SCENE.pic.h + SCENE.edge);
    expect(liquid.x).toBe(179);
    // The hung prints end above the bench's back edge, where the cat sits.
    expect(hangAt(0, 6, 358, s).y + SCENE.dry.h + 8).toBeLessThan(edge - 60);
    // A narrower stage scales the whole scene down, still on its foot and still covering the width.
    const small = sceneLayout(335, 440);
    expect(small.s).toBeCloseTo(335 / 358, 9);
    expect(small.pic.top + small.pic.height).toBeCloseTo(440, 9);
    expect(small.pic.left).toBeLessThan(0);
  });

  it("keeps the pile in the order the photos were sent, newest on top; a shuffle sends the top to the bottom", () => {
    // Three of six sent: the third is on top, the first at the bottom.
    expect([0, 1, 2].map((i) => slotOf(i, 3, 6, 0))).toEqual([2, 1, 0]);
    expect([0, 1, 2, 3, 4, 5].map((i) => slotOf(i, 6, 6, 0))).toEqual([5, 4, 3, 2, 1, 0]);
    expect([0, 1, 2, 3, 4, 5].map((i) => slotOf(i, 6, 6, 1))).toEqual([4, 3, 2, 1, 0, 5]);
    // Round the whole pile and it is as it began.
    expect([0, 1, 2, 3, 4, 5].map((i) => slotOf(i, 6, 6, 6))).toEqual([5, 4, 3, 2, 1, 0]);
  });

  it("lays every sheet wholly in the liquid, however it is turned", () => {
    const hw = SCENE.liquid.hw / SCENE.unit;
    const hd = SCENE.liquid.hd / (SCENE.unit * SCENE.squash);
    const w = SCENE.sheet.w / SCENE.unit / 2;
    const h = SCENE.sheet.h / SCENE.unit / 2;
    for (const { x, y, turn } of SLOTS) {
      const a = (Math.abs(turn) * Math.PI) / 180;
      expect(Math.abs(x) + w * Math.cos(a) + h * Math.sin(a)).toBeLessThan(hw);
      expect(Math.abs(y) + h * Math.cos(a) + w * Math.sin(a)).toBeLessThan(hd);
    }
  });

  it("hangs the prints along the line in the order they were taken, inside the frame, each from the line's own height", () => {
    for (const width of [335, 353, 358]) {
      const { s } = sceneLayout(width, 440);
      for (const count of [1, 3, 6, 7]) {
        const at = Array.from({ length: count }, (_, i) => hangAt(i, count, width, s));
        for (const [i, peg] of at.entries()) {
          expect(peg.y).toBeCloseTo(lineY(peg.x, width, s), 9);
          expect(peg.x - (SCENE.dry.w / 2) * s).toBeGreaterThan(8);
          expect(peg.x + (SCENE.dry.w / 2) * s).toBeLessThan(width - 8);
          if (i) expect(peg.x).toBeGreaterThan(at[i - 1].x);
        }
        // Centred on the line, which hangs lowest in the middle.
        expect(at[0].x + at[count - 1].x).toBeCloseTo(width, 9);
      }
      expect(lineY(width / 2, width, s)).toBeGreaterThan(lineY(20, width, s));
    }
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
    // The only control is the close (the cat over the room can be petted, which is play, not a control).
    expect(screen.getAllByRole("button").filter((b) => b.props.testID !== "v2-cat-pet")).toHaveLength(1);
    expect(screen.container.queryAll((node) => node.type === "ActivityIndicator")).toHaveLength(0);
  });

  it("keeps the room out of the screen reader's way; the status line is its polite live region", async () => {
    await renderScreen(running);
    const room = screen.getByTestId("build-room", hidden);
    expect(room.props.accessibilityElementsHidden).toBe(true);
    expect(room.props.importantForAccessibility).toBe("no-hide-descendants");
    expect(screen.getByTestId("build-status").props).toMatchObject({ accessibilityLabel: BUILDING_LABEL, accessibilityLiveRegion: "polite" });
  });

  it.each([
    ["while the photos send", sending(1), "Sending photo 2 of 6"],
    ["while it waits its turn", queued, QUEUED_LINE],
    ["while it builds", running, BUILDING_LABEL],
  ] as const)("says nothing the room already shows: no line %s", async (_when, stage, label) => {
    await renderScreen(stage);
    const status = screen.getByTestId("build-status");
    // A screen reader, which can't see the room, hears it; nobody reads it.
    expect(status.props).toMatchObject({ accessibilityLabel: label, accessibilityLiveRegion: "polite" });
    expect(status.queryAll((node) => typeof node.props.children === "string")).toHaveLength(0);
    expect(screen.queryByText(/Sending photo|Your case is next|Finding the objects|Choosing what to hide|Writing the case/, hidden)).toBeNull();
  });

  it("a second try is the one thing the room can't show: one small handwritten line, centred, where its space was kept", async () => {
    await renderScreen(queued, true);
    const empty = styleOf(screen.getByTestId("build-status"));
    expect(empty).toMatchObject({ alignSelf: "stretch", alignItems: "center" });
    await goTo(retrying, true);
    const line = screen.getByText("Trying again", hidden);
    expect(styleOf(line)).toMatchObject({ fontFamily: ref.font.hand, color: ref.color.textSecondary });
    expect(styleOf(line).fontSize as number).toBeGreaterThanOrEqual(15);
    expect(styleOf(line).fontSize as number).toBeLessThan(20);
    // The line's box is as tall with nothing in it: the title never moves.
    expect(styleOf(screen.getByTestId("build-status")).minHeight).toBe(empty.minHeight);
    expect(styleOf(screen.getByTestId("build-status")).minHeight as number).toBeGreaterThanOrEqual(styleOf(line).lineHeight as number);
    // Building again: it goes.
    await goTo(running, true);
    await advance(motion.reducedFade + 400);
    expect(screen.queryByText("Trying again", hidden)).toBeNull();
  });

  it("the title is small, in the game's own type, one line", async () => {
    await renderScreen(running);
    const title = screen.getByRole("header", { name: "Building your case" });
    expect(styleOf(title).fontSize).toBe(TITLE_SIZE.shell);
    expect(styleOf(title).fontSize as number).toBeLessThan(D.titleSize.shell);
    expect(styleOf(title).lineHeight as number).toBeGreaterThanOrEqual(styleOf(title).fontSize as number);
  });

  it("queued and trying again: one calm line each", async () => {
    await renderScreen(queued);
    expect(screen.getByTestId("build-status").props.accessibilityLabel).toBe("Your case is next");
    await goTo(retrying);
    expect(screen.getByTestId("build-status").props.accessibilityLabel).toBe("Trying again");
    expect(screen.getByRole("header", { name: "Building your case" })).toBeTruthy();
  });

  it("plays no room tone (the mode's music only)", async () => {
    await renderScreen(running);
    await goTo(ready);
    expect(useRoomTone).not.toHaveBeenCalled();
  });

  it("has no chapter kicker (there are no chapters)", async () => {
    await renderScreen(running, true);
    expect(screen.queryByText(/chapter/i, hidden)).toBeNull();
  });
});

describe("the darkroom: every print's state is one the server reported", () => {
  const opacityOf = (testID: string) => animated(testID).opacity ?? 1;

  it("lays a blank sheet in the tray for each photo sent, the newest on top", async () => {
    await renderScreen(sending(0));
    for (const i of [0, 1, 2, 3, 4, 5]) expect(opacityOf(`build-print-${i}`)).toBe(0);
    await goTo(sending(2));
    await advance(DARK.drop.ms + 50);
    expect(opacityOf("build-print-0")).toBe(1);
    expect(opacityOf("build-print-1")).toBe(1);
    expect(opacityOf("build-print-2")).toBe(0);
    expect(layerOf(1)).toBeGreaterThan(layerOf(0));
    // Nothing on them yet.
    expect(opacityOf("build-blank-0")).toBe(1);
    expect(opacityOf("build-blank-1")).toBe(1);
    await goTo(sending(6));
    await advance(DARK.drop.ms + 50);
    for (const i of [0, 1, 2, 3, 4, 5]) expect(opacityOf(`build-print-${i}`)).toBe(1);
    expect(topOfPile()).toBe(5);
  });

  it("keeps them blank while the case waits its turn; the pictures come up when it is being built, the top of the pile first", async () => {
    await renderScreen(queued);
    await advance(DARK.develop.rise * 2);
    for (const i of [0, 3, 5]) expect(opacityOf(`build-blank-${i}`)).toBe(1);
    await goTo(running);
    const top = topOfPile();
    const bottom = [0, 1, 2, 3, 4, 5].reduce((low, i) => (layerOf(i) < layerOf(low) ? i : low), 0);
    await advance(DARK.develop.rise / 2);
    // Part way: the top sheet's picture is ahead of the bottom's.
    expect(opacityOf(`build-blank-${top}`)).toBeLessThan(1);
    expect(opacityOf(`build-blank-${top}`)).toBeGreaterThan(0);
    expect(opacityOf(`build-blank-${top}`)).toBeLessThan(opacityOf(`build-blank-${bottom}`));
    await advance(DARK.develop.rise + 5 * DARK.develop.stagger);
    for (const i of [0, 1, 2, 3, 4, 5]) expect(opacityOf(`build-blank-${i}`)).toBe(0);
    // Still in the tray: nothing is on the line until the case is ready.
    expect(middleOf(5).y).toBeGreaterThan(STAGE.edge);
  });

  it("trying again: the pictures sink back to blank paper", async () => {
    await renderScreen(running);
    await advance(DARK.develop.rise + 5 * DARK.develop.stagger + 50);
    expect(opacityOf("build-blank-2")).toBe(0);
    await goTo(retrying);
    await advance(DARK.develop.sink + 50);
    for (const i of [0, 2, 5]) expect(opacityOf(`build-blank-${i}`)).toBe(1);
  });

  it("rocks the tray slowly, the prints with it, and steps the light on the liquid", async () => {
    await renderScreen(running);
    await advance(DARK.rock.period / 4);
    expect(rocked()).toBeCloseTo(DARK.rock.degrees, 1);
    const right = middleOf(5).x;
    await advance(DARK.rock.period / 2);
    expect(rocked()).toBeCloseTo(-DARK.rock.degrees, 1);
    expect(middleOf(5).x).not.toBeCloseTo(right, 2);
    // Never more than a degree: a rock, not a spill.
    expect(Math.abs(rocked())).toBeLessThanOrEqual(1);
    // The light on the liquid: one frame of the sheet at a time, stepped like stop motion.
    const frames = new Set<number>();
    for (let i = 0; i < 4; i += 1) {
      await advance(1000 / DARK.sheen.fps);
      frames.add(transformOf("build-sheen-frame", "translateX"));
    }
    expect(frames.size).toBeGreaterThan(1);
    for (const x of frames) expect(x / (SCENE.sheen.w * STAGE.s)).toBeCloseTo(Math.round(x / (SCENE.sheen.w * STAGE.s)), 6);
  });

  it("is a toy: a drag rocks the tray by hand; let go and it settles back", async () => {
    await renderScreen(running);
    const pan = createGestureController(getByGestureTestId("build-drag"));
    await act(() => {
      pan.begin({ translationX: 0, velocityX: 0 });
      pan.activate({ translationX: 9, velocityX: 0 });
      pan.update({ translationX: DARK.rock.handPt * 10, velocityX: 0 });
    });
    await advance(32);
    // As far as a hand tips it, and no further.
    expect(rocked()).toBeGreaterThan(DARK.rock.hand - DARK.rock.degrees - 0.01);
    expect(rocked()).toBeLessThanOrEqual(DARK.rock.hand + DARK.rock.degrees);
    await act(() => pan.end({ translationX: DARK.rock.handPt * 10, velocityX: 0 }));
    await advance(4000);
    expect(Math.abs(rocked())).toBeLessThanOrEqual(DARK.rock.degrees + 0.05);
  });

  it("shuffles the pile while it waits: the top sheet slips under, the next comes up", async () => {
    await renderScreen(running);
    expect(topOfPile()).toBe(5);
    await advance(DARK.shuffle.every);
    await advance(DARK.shuffle.sink / 2);
    // Slipping under: fading, still on top.
    expect(opacityOf("build-print-5")).toBeLessThan(1);
    expect(topOfPile()).toBe(5);
    await advance(DARK.shuffle.sink);
    await advance(DARK.shuffle.slide + DARK.shuffle.rise);
    expect(topOfPile()).toBe(4);
    expect(layerOf(5)).toBeLessThan(layerOf(0));
    expect(opacityOf("build-print-5")).toBe(1);
  });

  it("ready: every print is lifted to its peg on the line, upright and in order, and the lights come up", async () => {
    await renderScreen(running);
    await advance(2000);
    expect(animated("build-beam").opacity).toBe(1);
    await goTo(ready);
    await advance(DARK.hang.first + 5 * DARK.hang.stagger + DARK.hang.fly + 5 * DARK.hang.swingMs);
    expect(animated("build-beam").opacity).toBe(0);
    for (const i of [0, 1, 2, 3, 4, 5]) {
      const at = hangAt(i, 6, FRAME.width, STAGE.s);
      expect(middleOf(i).y).toBeLessThan(STAGE.edge - 40);
      expect(middleOf(i).x).toBeCloseTo(at.x, -1);
      expect(transformOf(`build-print-${i}`, "scaleY")).toBeCloseTo(1, 5);
      expect(transformOf(`build-print-${i}`, "scale")).toBeCloseTo(SCENE.dry.w / SCENE.sheet.w, 5);
      expect(opacityOf(`build-blank-${i}`)).toBe(0);
      // A peg for each.
      expect(screen.getByTestId(`build-peg-${i}`, hidden)).toBeTruthy();
    }
    expect(layerOf(5)).toBeGreaterThan(layerOf(0));
    // The tray has stopped being shuffled.
    const pile = [0, 1, 2, 3, 4, 5].map(layerOf);
    await advance(DARK.shuffle.every * 2);
    expect([0, 1, 2, 3, 4, 5].map(layerOf)).toEqual(pile);
  });

  it("shows the photos in the mode's baked treatment at the review tiles' bake, one print each", async () => {
    setMode("paranormal");
    await renderScreen(running);
    const uriOf = (testID: string) => ([screen.getByTestId(testID, hidden).props.source].flat()[0] as { uri: string }).uri;
    expect(uriOf("build-photo-0-treated")).toBe("baked/paranormal/file://photo-0.jpg");
    expect(uriOf("build-photo-5-treated")).toBe("baked/paranormal/file://photo-5.jpg");
    expect(screen.queryByTestId("build-photo-6-treated", hidden)).toBeNull();
    await act(() => setMode(null));
  });

  it("with no photos on this phone (followed from home), one sheet with the mode's cover on it", async () => {
    clearPlates();
    setMode("crime_scene");
    jest.mocked(useLocalSearchParams).mockReturnValue({ roomId: "r7" });
    await renderScreen(queued);
    expect(mockUseDevelopment).toHaveBeenCalledWith("r7");
    expect(screen.getByTestId("build-cover", hidden).props.accessibilityHint).toBe("crime_scene");
    expect(screen.getByTestId("build-print-0", hidden)).toBeTruthy();
    expect(screen.queryByTestId("build-print-1", hidden)).toBeNull();
    expect(screen.getByTestId("build-status").props.accessibilityLabel).toBe("Your case is next");
    jest.mocked(useLocalSearchParams).mockReturnValue({});
    await act(() => setMode(null));
  });

  it("the cat sits behind the bench, outside the hidden picture, watching the tray; ready, it looks up", async () => {
    await renderScreen(running);
    const cat = screen.getByTestId("build-cat");
    const seat = styleOf(cat);
    // Its foot on the bench's back edge.
    expect((seat.top as number) + (SCENE.cat.w * STAGE.s * 585) / 560).toBeGreaterThan(STAGE.edge - 2);
    expect(seat.top as number).toBeLessThan(STAGE.edge);
    // Not inside the picture's hidden subtree: it can still be petted.
    expect(screen.getByTestId("v2-cat-pet")).toBeTruthy();
  });
});

describe("Reduce Motion", () => {
  it("nothing rocks or slides and the light on the liquid holds still; the pile changes by a fade", async () => {
    await renderScreen(running, true);
    await advance(3000);
    expect(rocked()).toBe(0);
    expect(transformOf("build-sheen-frame", "translateX")).toBe(0);
    const before = middleOf(5);
    expect(topOfPile()).toBe(5);
    await advance(D.still.hold + D.still.fade);
    await advance(D.still.fade / 2 + 50);
    expect(topOfPile()).toBe(4);
    // The sheet that went under is where the bottom of the pile lies, with no slide between.
    expect(middleOf(5)).not.toEqual(before);
    await advance(D.still.fade);
    expect(animated("build-print-5").opacity).toBe(1);
  });

  it("the pictures still fade up, and at ready the prints are simply on the line, with no drip", async () => {
    await renderScreen(running, true);
    await advance(DARK.develop.rise + 5 * DARK.develop.stagger + 50);
    expect(animated("build-blank-0").opacity).toBe(0);
    await goTo(ready, true);
    await advance(50);
    for (const i of [0, 5]) expect(middleOf(i).y).toBeLessThan(STAGE.edge - 40);
    await advance(D.beam.lightsOn + 50);
    expect(animated("build-beam").opacity).toBe(0);
    expect(screen.queryByTestId("build-drip-1", hidden)).toBeNull();
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
    expect(screen.queryAllByRole("button").filter((b) => b.props.testID !== "v2-cat-pet")).toHaveLength(0);
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
    // The title and the seal say it; no line under them. A screen reader is told the wait is over.
    expect(screen.queryByText("It's all in your photos", hidden)).toBeNull();
    expect(screen.getByTestId("build-status-ready").props).toMatchObject({ accessibilityLabel: READY_TITLE, accessibilityLiveRegion: "polite" });
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

  it("nor does what a screen reader hears while it builds", () => {
    for (const line of [BUILDING_LABEL, QUEUED_LINE, RETRY_LINE, BUILD_TITLE, READY_TITLE]) expect(line).not.toMatch(WORDS);
  });
});

describe("inside a mode", () => {
  const theme = modeThemes.paranormal;
  beforeEach(() => setMode("paranormal"));
  afterEach(() => act(() => setMode(null)));

  it("takes the mode's ground, its display face for the title, and its colours for the line", async () => {
    await renderScreen(running);
    expect(styleOf(screen.getByTestId("darkroom-root")).backgroundColor).toBe(theme.surface);
    expect(styleOf(screen.getByTestId("build-room", hidden)).backgroundColor).toBe(theme.ground);
    expect(styleOf(screen.getByRole("header", { name: "Building your case" }))).toMatchObject({
      fontFamily: theme.display.fontFamily,
      fontSize: TITLE_SIZE.paranormal,
      color: theme.ink,
    });
  });

  it("the CASE READY seal pressed in gold foil, and the pill in its accent", async () => {
    await renderScreen(ready);
    await advance(D.ready.stampDelay + STAMP.slam + D.ready.success + 16);
    expect(styleOf(screen.getByText("CASE READY", hidden)).color).toBe(SEAL.ink);
    expect(screen.getByTestId("build-stamp", hidden)).toBeTruthy();
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

import fs from "fs";
import path from "path";
import type { ReactElement } from "react";
import { StyleSheet } from "react-native";
import { act, render, screen, userEvent } from "@testing-library/react-native";
import { getAnimatedStyle } from "react-native-reanimated";
import { router } from "expo-router";
import type { DevStage } from "@/capture/useDevelopment";
import { addPlate, clearPlates, removePlate } from "@/capture/roll";
import { setMode } from "@/game/mode";
import type { GenerationJob } from "@/lib/escapd-api";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { modeThemes, ref } from "@/theme/tokens";
import DarkroomScreen from "../../../../app/capture/develop";
import { DEVELOPING_LINES, WAITING_LINE, sendingLine, waitingCopy } from "../copy";
import { DarkroomGlass, GLASS_CENTRE_Y } from "../DarkroomGlass";

let mockStage: DevStage = { kind: "checking" };
const mockRetry = jest.fn();

jest.mock("@/capture/useDevelopment", () => ({
  useDevelopment: () => ({ stage: mockStage, retry: mockRetry }),
}));

jest.mock("expo-router", () => {
  const { useEffect } = jest.requireActual<typeof import("react")>("react");
  return {
    router: { back: jest.fn(), replace: jest.fn(), push: jest.fn(), dismissTo: jest.fn(), canGoBack: jest.fn(() => true) },
    useLocalSearchParams: jest.fn(() => ({})),
    useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]),
  };
});

// The full shape of useFeedback (src/game/feedback.ts), one stable object as the real hook memoises.
const mockFeedback = {
  tick: jest.fn(),
  tap: jest.fn(),
  press: jest.fn(),
  thud: jest.fn(),
  success: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
};
const mockSuccess = mockFeedback.success;
const mockWarning = mockFeedback.warning;
jest.mock("@/game/feedback", () => ({ useFeedback: () => mockFeedback }));
// A bake that is ready at once ("baked/<mode>/<photo>"), and none in the shell, as the real one.
jest.mock("@/components/noir/treatPhoto", () => ({
  ...jest.requireActual("@/components/noir/treatPhoto"),
  useTreatedPhoto: (source: string, genre: string | null) => (genre ? `baked/${genre}/${source}` : null),
}));

const D = ref.layout.develop;
const T = ref.motion.thinking;
const ROOT = path.join(__dirname, "../../../..");
// pngjs comes with Expo's image tooling (@expo/image-utils); it has no types of its own.
type DecodedPng = { width: number; height: number; data: Uint8Array };
const { PNG } = jest.requireActual<{ PNG: { sync: { read: (file: Buffer) => DecodedPng } } }>("pngjs");
/** Hue in degrees and HSV saturation of an sRGB pixel. */
function hueSat(r: number, g: number, b: number) {
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let hue = 0;
  if (d) hue = max === r ? (((g - b) / d) % 6) * 60 : max === g ? ((b - r) / d + 2) * 60 : ((r - g) / d + 4) * 60;
  return { hue: hue < 0 ? hue + 360 : hue, sat: max ? d / max : 0 };
}
const PERIOD = T.gap + T.swap + T.hold;
const hidden = { includeHiddenElements: true } as const;
const styleOf = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) ?? {};

const job = (overrides: Partial<GenerationJob> = {}): GenerationJob => ({
  id: "j1", room_id: "r1", owner_id: "u1", idempotency_key: "k", status: "queued", attempt_count: 0, max_attempts: 3,
  prompt_version: "v1", output_schema_version: 1, next_attempt_at: "", lease_token: null, leased_by: null,
  lease_expires_at: null, error_code: null, error_message: null, result_version_id: null, started_at: null,
  finished_at: null, created_at: new Date().toISOString(), updated_at: "", genre: "noir", ...overrides,
});

const sending = (sent: number, total = 5): DevStage => ({ kind: "sending", sent, total });
const waiting = (overrides: Partial<GenerationJob> = {}): DevStage => ({ kind: "waiting", roomId: "r1", job: job(overrides) });
const queued = waiting();
const running = waiting({ status: "running" });
const retrying = waiting({ attempt_count: 1 });

/** The line as drawn under reduced motion (plain Text in the still grey; the hidden sizers are in no colour). */
const shownLine = (text: string) => screen.queryAllByText(text, hidden).filter((node) => styleOf(node).color === T.shimmer.still);
/** Every string the line's hidden sizers measure (its lines plus sizeTo). */
const sizedStrings = () =>
  screen
    .getByTestId("darkroom-status", hidden)
    .queryAll((node) => node.type === "Text" && styleOf(node).color === undefined)
    .map((node) => String(node.props.children));

type Translate = { translateX?: number; translateY?: number; rotate?: string };
// The package's types are its web stub's; under Jest the native helper runs.
const animatedStyleOf = getAnimatedStyle as unknown as (node: { props: Record<string, unknown> }) => { transform?: Translate[] };
/** The glass's current drift, read from its animated style. */
const poseOf = (testID = "darkroom-glass") => {
  const style = animatedStyleOf(screen.getByTestId(testID, hidden));
  return Object.assign({}, ...(style.transform ?? [])) as Translate;
};

function renderIn(ui: ReactElement, reducedMotion = true) {
  return render(<ThemeProvider reducedMotion={reducedMotion}>{ui}</ThemeProvider>);
}

/** Moves the screen to another stage, as useDevelopment would. */
async function goTo(stage: DevStage, reducedMotion = true) {
  mockStage = stage;
  await act(() => screen.rerender(<ThemeProvider reducedMotion={reducedMotion}><DarkroomScreen /></ThemeProvider>));
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  clearPlates();
  for (let i = 0; i < 5; i++) addPlate({ uri: `file://plate-${i}.jpg`, width: 1200, height: 1600 });
  mockStage = { kind: "checking" };
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

describe("waitingCopy", () => {
  it("keeps the screen's stamp, title and body, and adds a truthful thinking line per stage", () => {
    expect(waitingCopy(running as Extract<DevStage, { kind: "waiting" }>)).toEqual({
      stamp: "BUILDING",
      title: "Building your case",
      body: "Finding the objects, choosing what to hide, and writing the case. This usually takes a minute or two.",
      thinking: { lines: ["Finding the objects", "Choosing what to hide", "Writing the case"], label: "Building your case" },
    });
    expect(waitingCopy(queued as Extract<DevStage, { kind: "waiting" }>)).toMatchObject({
      stamp: "IN THE QUEUE",
      title: "Your case is next",
      body: "You can leave this screen. It keeps building, and you'll find it on the home screen.",
      thinking: { lines: ["Waiting to start"], label: "Your case is next" },
    });
    expect(waitingCopy(retrying as Extract<DevStage, { kind: "waiting" }>)).toMatchObject({
      stamp: "SECOND TRY",
      title: "Trying again",
      thinking: { lines: ["Trying again"], label: "Trying again" },
    });
    // A retried job that is running again is building.
    expect(waitingCopy(waiting({ status: "running", attempt_count: 1 }) as Extract<DevStage, { kind: "waiting" }>).thinking.lines).toBe(
      DEVELOPING_LINES,
    );
  });

  it("counts the photo being sent, sized to every count so the box never resizes", () => {
    const copy = waitingCopy({ kind: "sending", sent: 1, total: 4 });
    expect(copy.body).toBe("Photo 2 of 4. Keep the app open until they're all sent.");
    expect(copy.thinking).toEqual({
      lines: ["Sending photo 2 of 4"],
      label: "Sending photo 2 of 4",
      sizeTo: ["Sending photo 1 of 4", "Sending photo 2 of 4", "Sending photo 3 of 4", "Sending photo 4 of 4"],
    });
    // All sent, the job not yet created: the last count holds.
    expect(waitingCopy({ kind: "sending", sent: 4, total: 4 }).thinking.lines).toEqual([sendingLine(4, 4)]);
  });

  it("keeps every line within the thinking line's 28 characters", () => {
    for (const line of [...DEVELOPING_LINES, WAITING_LINE, "Trying again", sendingLine(6, 6)]) {
      expect(line.length).toBeLessThanOrEqual(28);
    }
  });
});

describe("DarkroomGlass", () => {
  it("drifts in a figure-eight with a slight lean, about one loop per drift.duration", async () => {
    await renderIn(<DarkroomGlass />, false);
    expect(poseOf()).toEqual({ translateX: 0, translateY: 0, rotate: "0deg" });

    // A quarter loop: at the right of the eight, level in y, leaning fully.
    await act(() => jest.advanceTimersByTime(D.drift.duration / 4));
    const quarter = poseOf();
    expect(quarter.translateX).toBeCloseTo(D.drift.x, 0);
    expect(Math.abs(quarter.translateY ?? NaN)).toBeLessThan(1);
    expect(parseFloat(quarter.rotate ?? "")).toBeCloseTo(D.drift.tilt, 0);

    // An eighth further: the lens has risen or dropped to the top of a lobe.
    await act(() => jest.advanceTimersByTime(D.drift.duration / 8));
    expect(Math.abs(poseOf().translateY ?? 0)).toBeCloseTo(D.drift.y, 0);

    // It keeps going: the far side of the eight.
    await act(() => jest.advanceTimersByTime(D.drift.duration * (3 / 8)));
    expect(poseOf().translateX).toBeCloseTo(-D.drift.x, 0);
  });

  it("holds still and level under reduced motion", async () => {
    await renderIn(<DarkroomGlass />, true);
    for (let i = 0; i < 4; i++) {
      await act(() => jest.advanceTimersByTime(D.drift.duration / 3));
      expect(poseOf()).toEqual({ translateX: 0, translateY: 0, rotate: "0deg" });
    }
  });

  it("is the painted glass at its token size, centred on the strip and hidden from screen readers", async () => {
    await renderIn(<DarkroomGlass />);
    const glass = screen.getByTestId("darkroom-glass", hidden);
    expect(glass.props.importantForAccessibility).toBe("no-hide-descendants");
    expect(glass.props.accessibilityElementsHidden).toBe(true);
    expect(styleOf(glass)).toMatchObject({
      width: D.glass.size,
      height: D.glass.size,
      left: "50%",
      marginLeft: -D.glass.size * D.glass.lensX,
      top: GLASS_CENTRE_Y - D.glass.size * D.glass.lensY,
    });
    // The lens rests on the tiles' middle, under the numerals.
    expect(GLASS_CENTRE_Y).toBe(D.stage.stripTop + D.plate.label.lineHeight + D.plate.labelGap + D.plate.size / 2);
  });

  // The glass shows untinted in every mode, so its lens must be neutral: a green
  // lens tipped noir's monochrome and paranormal's cool blue-green toward mint
  // ("No green or mint anywhere else"). Pins the painted set and its master.
  it("paints the lens as clear grey glass in a brass rim, with no green or mint, at every scale", () => {
    for (const name of ["magnifier.png", "magnifier@2x.png", "magnifier@3x.png", "magnifier-1024.png"]) {
      const { width, height, data } = PNG.sync.read(fs.readFileSync(path.join(ROOT, "assets/brand", name)));
      const cx = D.glass.lensX * width;
      const cy = D.glass.lensY * height;
      let glass = 0;
      let brass = 0;
      const green: string[] = [];
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4;
          if (data[i + 3] < 8) continue;
          const { hue, sat } = hueSat(data[i], data[i + 1], data[i + 2]);
          const r = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / width;
          if (hue >= 70 && hue <= 200 && sat > 0.12 && Math.max(data[i], data[i + 1], data[i + 2]) > 20) green.push(`${x},${y}`);
          // The see-through lens inside the rim, and the rim round it.
          if (r < 0.2 && data[i + 3] < 250) glass++;
          if (r > 0.25 && r < 0.29 && hue >= 20 && hue <= 50 && sat > 0.4) brass++;
        }
      }
      expect({ name, green: green.slice(0, 5) }).toEqual({ name, green: [] });
      expect(glass).toBeGreaterThan(width * width * 0.1);
      expect(brass).toBeGreaterThan(width * width * 0.03);
    }
  });
});

describe("the darkroom wait", () => {
  it("while developing: the glass, and the three lines rotating under one fixed status", async () => {
    mockStage = running;
    await renderIn(<DarkroomScreen />);
    expect(screen.getByTestId("darkroom-glass", hidden)).toBeTruthy();
    const status = screen.getByTestId("darkroom-status");
    expect(status.props).toMatchObject({ accessibilityLabel: "Building your case", accessibilityLiveRegion: "polite" });
    expect(shownLine("Finding the objects")).toHaveLength(1);

    await act(() => jest.advanceTimersByTime(PERIOD));
    expect(shownLine("Choosing what to hide")).toHaveLength(1);
    await act(() => jest.advanceTimersByTime(PERIOD));
    expect(shownLine("Writing the case")).toHaveLength(1);
    expect(screen.getByTestId("darkroom-status").props.accessibilityLabel).toBe("Building your case");

    // The screen's own copy and its action stay.
    expect(screen.getByText("BUILDING")).toBeTruthy();
    expect(screen.getByRole("header", { name: "Building your case" })).toBeTruthy();
    expect(screen.getByText(/This usually takes a minute or two/)).toBeTruthy();
    // The glass and the line are the indicator now: no spinner beside them.
    expect(screen.container.queryAll((node) => node.type === "ActivityIndicator")).toHaveLength(0);
  });

  it("queued and second attempt: one line each, which doesn't rotate", async () => {
    mockStage = queued;
    await renderIn(<DarkroomScreen />);
    expect(screen.getByTestId("darkroom-status").props.accessibilityLabel).toBe("Your case is next");
    await act(() => jest.advanceTimersByTime(PERIOD * 2));
    // The title says the case is next; the line under the glass says it is waiting to start.
    expect(shownLine(WAITING_LINE)).toHaveLength(1);

    await goTo(retrying);
    expect(screen.getByTestId("darkroom-status").props.accessibilityLabel).toBe("Trying again");
    await act(() => jest.advanceTimersByTime(PERIOD * 2));
    expect(shownLine("Trying again")).toHaveLength(1);
    expect(screen.getByText("SECOND TRY")).toBeTruthy();
  });

  it("sending: the count swaps as plates go, in a box sized to the longest count", async () => {
    mockStage = sending(0);
    await renderIn(<DarkroomScreen />);
    expect(shownLine("Sending photo 1 of 5")).toHaveLength(1);
    expect(screen.getByTestId("darkroom-status").props.accessibilityLabel).toBe("Sending photo 1 of 5");
    expect(sizedStrings()).toEqual(expect.arrayContaining([1, 2, 3, 4, 5].map((n) => sendingLine(n, 5))));

    await goTo(sending(1));
    await act(() => jest.advanceTimersByTime(ref.motion.thinking.swap));
    expect(shownLine("Sending photo 2 of 5")).toHaveLength(1);
    expect(shownLine("Sending photo 1 of 5")).toHaveLength(0);
    expect(screen.getByTestId("darkroom-status").props.accessibilityLabel).toBe("Sending photo 2 of 5");
    expect(screen.getByText("Photo 2 of 5. Keep the app open until they're all sent.")).toBeTruthy();
  });

  it("keeps the glass drifting from sending into developing, then unmounts it and the line when the wait ends", async () => {
    mockStage = sending(2);
    await renderIn(<DarkroomScreen />, false);
    const glass = screen.getByTestId("darkroom-glass", hidden);
    await act(() => jest.advanceTimersByTime(D.drift.duration / 4));
    expect(poseOf().translateX).toBeCloseTo(D.drift.x, 0);

    // Still a wait: the same glass carries on from where it was.
    await goTo(queued, false);
    await goTo(running, false);
    expect(screen.getByTestId("darkroom-glass", hidden)).toBe(glass);
    await act(() => jest.advanceTimersByTime(D.drift.duration / 4));
    expect(Math.abs(poseOf().translateX ?? 0)).toBeLessThan(1);

    await goTo({ kind: "ready", roomId: "r1" }, false);
    expect(screen.queryByTestId("darkroom-glass", hidden)).toBeNull();
    expect(screen.queryByTestId("darkroom-status", hidden)).toBeNull();
    // The plates stay; the case can be opened.
    expect(screen.getByText("CASE READY")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open the case" })).toBeTruthy();
    expect(mockSuccess).toHaveBeenCalledTimes(1);
  });

  it("unmounts the glass and the line when the case fails", async () => {
    mockStage = running;
    await renderIn(<DarkroomScreen />);
    await goTo({ kind: "failed", roomId: "r1", copy: { title: "The case didn't develop", body: "Try again.", action: "retry", plates: [], flagged: [], issue: null } });
    expect(screen.queryByTestId("darkroom-glass", hidden)).toBeNull();
    expect(screen.queryByTestId("darkroom-status", hidden)).toBeNull();
    expect(mockWarning).toHaveBeenCalledTimes(1);
  });

  it("the access check (One moment) is the state screen's thinking line, with no glass and no spinner", async () => {
    await renderIn(<DarkroomScreen />);
    expect(screen.getByTestId("state-loading").props.accessibilityLabel).toBe("One moment");
    expect(shownLine("One moment")).toHaveLength(1);
    expect(screen.container.queryAll((node) => node.type === "ActivityIndicator")).toHaveLength(0);
    expect(screen.queryByTestId("darkroom-glass", hidden)).toBeNull();
    expect(screen.queryByTestId("darkroom-status", hidden)).toBeNull();
  });

  it("follows a case with no plates on this phone: the glass over an empty stage", async () => {
    clearPlates();
    mockStage = queued;
    await renderIn(<DarkroomScreen />);
    expect(screen.getByTestId("darkroom-glass", hidden)).toBeTruthy();
    expect(screen.getByTestId("darkroom-status").props.accessibilityLabel).toBe("Your case is next");
  });

  it("keeps Leave it building while the job runs, and nothing to press while sending", async () => {
    mockStage = running;
    await renderIn(<DarkroomScreen />);
    await userEvent.setup({ advanceTimers: jest.advanceTimersByTime }).press(screen.getByRole("button", { name: "Leave it building" }));
    expect(router.replace).toHaveBeenCalledWith("/");

    await goTo(sending(0));
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("the darkroom in the reference look", () => {
  it("draws 07's tiles in miniature: numerals over square tiles, a void veil until developed", async () => {
    mockStage = sending(2);
    await renderIn(<DarkroomScreen />);
    const strip = screen.getByTestId("darkroom-plates", hidden);
    expect(strip.props.importantForAccessibility).toBe("no-hide-descendants");
    expect(styleOf(screen.getByTestId("darkroom-plate-0", hidden))).toMatchObject({
      width: D.plate.size,
      height: D.plate.size,
      borderRadius: D.plate.radius,
      borderWidth: D.plate.rim,
      borderColor: ref.color.rim,
    });
    // Numbered 1 to 5 (Arabic), never Roman numerals.
    expect(screen.getByText("5", hidden)).toBeTruthy();
    expect(screen.queryByText("V", hidden)).toBeNull();
    // Sent plates lighter than the ones still to send; nothing tinted.
    expect(styleOf(screen.getByTestId("darkroom-veil-1", hidden))).toMatchObject({ backgroundColor: ref.color.void, opacity: D.veil.sent });
    expect(styleOf(screen.getByTestId("darkroom-veil-2", hidden))).toMatchObject({ opacity: D.veil.unsent });

    await goTo({ kind: "ready", roomId: "r1" });
    expect(screen.queryByTestId("darkroom-veil-0", hidden)).toBeNull();
  });

  it("numbers each photo by its slot, so a removed photo leaves a gap rather than renumbering", async () => {
    // The suite's roll holds 5 photos; take photo 2 out of its slot.
    removePlate(1);
    mockStage = sending(0);
    await renderIn(<DarkroomScreen />);
    expect(screen.getByText("1", hidden)).toBeTruthy();
    expect(screen.queryByText("2", hidden)).toBeNull();
    expect(screen.getByText("5", hidden)).toBeTruthy();
  });

  it("sets the stamp as a tag pill and the copy in the reference type on the camera's ground", async () => {
    mockStage = running;
    await renderIn(<DarkroomScreen />);
    expect(styleOf(screen.getByText("BUILDING"))).toMatchObject({ ...ref.type.tag, color: ref.color.textLabel });
    expect(styleOf(screen.getByTestId("darkroom-stamp"))).toMatchObject({ borderColor: ref.color.rim, borderRadius: ref.button.gameCard.tagRadius });
    expect(styleOf(screen.getByRole("header", { name: "Building your case" }))).toMatchObject({ ...ref.type.title, color: ref.color.textPrimary });
    expect(styleOf(screen.getByText(/This usually takes a minute or two/))).toMatchObject({ ...ref.type.subtitle, color: ref.color.textSecondary });
  });

  it("keeps the elapsed clock out of the polite live region", async () => {
    mockStage = running;
    await renderIn(<DarkroomScreen />);
    const clock = screen.getByTestId("darkroom-elapsed");
    expect(screen.getByLabelText("Elapsed Under a minute")).toBeTruthy();
    for (let node = clock.parent; node; node = node.parent) expect(node.props.accessibilityLiveRegion).toBeUndefined();
  });

  it("opens the case from 07's white bar", async () => {
    mockStage = { kind: "ready", roomId: "r9" };
    await renderIn(<DarkroomScreen />);
    const bar = screen.getByTestId("open-case");
    expect(styleOf(bar)).toMatchObject({ backgroundColor: ref.layout.state.bar.fill, minHeight: ref.layout.state.bar.height });
    await userEvent.setup({ advanceTimers: jest.advanceTimersByTime }).press(screen.getByRole("button", { name: "Open the case" }));
    expect(router.replace).toHaveBeenCalledWith("/play/r9");
  });
});

describe("plain language (round 4)", () => {
  const WORDS = /plate|develop|darkroom|light table|title screen|\broll\b|\bAI\b/i;
  const stages: DevStage[] = [
    { kind: "checking" },
    { kind: "account" },
    { kind: "access", reason: "entitlement" },
    { kind: "access", reason: "cap" },
    sending(1),
    queued,
    running,
    retrying,
    { kind: "ready", roomId: "r1" },
    { kind: "failed", roomId: "r1", copy: { title: "A photo didn't come through", body: "Retake it.", action: "retake", plates: [], flagged: [], issue: null } },
    { kind: "error", message: "Couldn't connect. Try again." },
  ];
  it.each(stages.map((stage) => [stage.kind, stage] as const))("%s: nothing seen or heard uses the old darkroom words", async (_kind, stage) => {
    mockStage = stage;
    await renderIn(<DarkroomScreen />);
    const said = screen.container
      .queryAll(() => true)
      .flatMap((node) => [node.props.accessibilityLabel, typeof node.props.children === "string" ? node.props.children : null])
      .filter((text): text is string => typeof text === "string");
    expect(said.length).toBeGreaterThan(0);
    for (const text of said) expect(text).not.toMatch(WORDS);
  });
});

describe("haptics", () => {
  const user = () => userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

  it("ticks once each time a photo finishes sending, never on mount", async () => {
    mockStage = sending(0);
    await renderIn(<DarkroomScreen />);
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
    mockStage = { kind: "checking" };
    await renderIn(<DarkroomScreen />);
    await goTo(sending(3));
    expect(mockFeedback.tick).not.toHaveBeenCalled();
  });

  it("Open the case lands with a thud, and nothing else", async () => {
    mockStage = { kind: "ready", roomId: "r1" };
    await renderIn(<DarkroomScreen />);
    expect(mockFeedback.success).toHaveBeenCalledTimes(1);
    await user().press(screen.getByRole("button", { name: "Open the case" }));
    expect(mockFeedback.thud).toHaveBeenCalledTimes(1);
    expect(mockFeedback.press).not.toHaveBeenCalled();
  });

  it("Leave it building is a light press", async () => {
    mockStage = running;
    await renderIn(<DarkroomScreen />);
    await user().press(screen.getByRole("button", { name: "Leave it building" }));
    expect(mockFeedback.press).toHaveBeenCalledTimes(1);
    expect(mockFeedback.thud).not.toHaveBeenCalled();
  });

  it("a failure stays a calm warning, once", async () => {
    mockStage = running;
    await renderIn(<DarkroomScreen />);
    await goTo({ kind: "failed", roomId: "r1", copy: { title: "A photo didn't come through", body: "Retake it.", action: "retake", plates: [], flagged: [], issue: null } });
    expect(mockFeedback.warning).toHaveBeenCalledTimes(1);
    expect(mockFeedback.error).not.toHaveBeenCalled();
  });
});

describe("back to the photos after a failed build", () => {
  const user = () => userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

  it("sends each flagged photo's slot with its reason", async () => {
    mockStage = {
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
    };
    await renderIn(<DarkroomScreen />);
    await user().press(screen.getByRole("button", { name: "Retake photos" }));
    expect(router.dismissTo).toHaveBeenCalledWith({ pathname: "/capture/review", params: { flag: "0:person,2:private_text" } });
  });

  it("carries a whole-set failure as the review screen's note", async () => {
    mockStage = {
      kind: "failed",
      roomId: "r1",
      copy: { title: "Not enough to build a case from", body: "Add a close view.", action: "retake", plates: [], flagged: [], issue: "too_few_objects" },
    };
    await renderIn(<DarkroomScreen />);
    await user().press(screen.getByRole("button", { name: "Retake photos" }));
    expect(router.dismissTo).toHaveBeenCalledWith({ pathname: "/capture/review", params: { flag: "", issue: "too_few_objects" } });
  });
});

describe("inside a mode", () => {
  const theme = modeThemes.paranormal;
  const uriOf = (node: { props: { source?: unknown } }) => ([node.props.source].flat()[0] as { uri: string }).uri;
  beforeEach(() => setMode("paranormal"));
  afterEach(() => setMode(null));

  it("tints the wait: the mode's ground and inks, the stamp in its stamp colour, the clock in its well", async () => {
    mockStage = running;
    await renderIn(<DarkroomScreen />);
    expect(styleOf(screen.getByTestId("darkroom-root")).backgroundColor).toBe(theme.surface);
    expect(styleOf(screen.getByText("BUILDING"))).toMatchObject({ ...ref.type.tag, color: theme.stamp });
    expect(styleOf(screen.getByTestId("darkroom-stamp")).borderColor).toBe(theme.stamp);
    expect(styleOf(screen.getByRole("header", { name: "Building your case" })).color).toBe(theme.ink);
    expect(styleOf(screen.getByText(/This usually takes a minute or two/)).color).toBe(theme.inkMuted);
    expect(styleOf(screen.getByTestId("darkroom-elapsed")).backgroundColor).toBe(theme.ground);
    expect(styleOf(screen.getByText("1", hidden)).color).toBe(theme.inkMuted);
    expect(styleOf(screen.getByTestId("darkroom-plate-0", hidden)).borderColor).toBe(theme.rim);
  });

  it("shows the photos in the mode's baked treatment, under the same neutral veil", async () => {
    mockStage = sending(1);
    await renderIn(<DarkroomScreen />);
    expect(uriOf(screen.getByTestId("darkroom-photo-0-treated", hidden))).toBe("baked/paranormal/file://plate-0.jpg");
    expect(styleOf(screen.getByTestId("darkroom-veil-1", hidden))).toMatchObject({ backgroundColor: ref.color.void, opacity: D.veil.unsent });
  });

  it("opens the case from the mode's primary button, with the weighty thud", async () => {
    mockStage = { kind: "ready", roomId: "r9" };
    await renderIn(<DarkroomScreen />);
    const bar = screen.getByTestId("open-case");
    expect(styleOf(bar)).toMatchObject({
      backgroundColor: theme.accent,
      minHeight: ref.layout.state.bar.height,
      borderRadius: ref.layout.state.bar.radius,
    });
    expect(styleOf(screen.getByText("Open the case")).color).toBe(theme.accentInk);
    await userEvent.setup({ advanceTimers: jest.advanceTimersByTime }).press(screen.getByRole("button", { name: "Open the case" }));
    expect(mockFeedback.thud).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith("/play/r9");
  });

  it("keeps the quiet way out in the mode's ink, and it still leaves", async () => {
    mockStage = running;
    await renderIn(<DarkroomScreen />);
    expect(styleOf(screen.getByText("Leave it building")).color).toBe(theme.ink);
    await userEvent.setup({ advanceTimers: jest.advanceTimersByTime }).press(screen.getByRole("button", { name: "Leave it building" }));
    expect(router.replace).toHaveBeenCalledWith("/");
  });

  it("draws the calm states (errors, asks, One moment) in the mode's colours, with every action working", async () => {
    mockStage = { kind: "error", message: "Couldn't connect." };
    await renderIn(<DarkroomScreen />);
    expect(styleOf(screen.getByTestId("state-screen")).backgroundColor).toBe(theme.surface);
    expect(styleOf(screen.getByText("The case didn't go through")).color).toBe(theme.ink);
    expect(styleOf(screen.getByText("Couldn't connect.")).color).toBe(theme.inkMuted);
    expect(styleOf(screen.getByText("Try again")).color).toBe(theme.accentInk);
    expect(styleOf(screen.getByText("Back to your photos")).color).toBe(theme.ink);
    await userEvent.setup({ advanceTimers: jest.advanceTimersByTime }).press(screen.getByRole("button", { name: "Try again" }));
    expect(mockRetry).toHaveBeenCalled();
    await goTo({ kind: "checking" });
    expect(screen.getByTestId("state-loading", hidden)).toBeTruthy();
    expect(styleOf(screen.getByTestId("state-screen")).backgroundColor).toBe(theme.surface);
  });
});

describe("in the shell (no mode)", () => {
  it("shows the photos as taken, with no treatment", async () => {
    mockStage = sending(1);
    await renderIn(<DarkroomScreen />);
    expect(screen.queryByTestId("darkroom-photo-0-treated", hidden)).toBeNull();
    expect(screen.getByTestId("darkroom-photo-0-original", hidden)).toBeTruthy();
  });
});

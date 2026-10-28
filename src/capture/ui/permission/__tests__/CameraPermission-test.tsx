// 03 · Camera permission (docs/DESIGN.md 03): the app's dark look and every
// state's behaviour. The sheet's own frame rules are in PermissionSheet-test.tsx, the
// route shell's in captureRoute-test.tsx.
import { AccessibilityInfo, BackHandler, Linking, Platform, StyleSheet, processColor } from "react-native";
import { act, fireEvent, render, screen, userEvent, within } from "@testing-library/react-native";
import type { PermissionResponse } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { processPhoto, type ProcessedPlate, type RawPhoto } from "@/capture/process-photo";
import { addPlate, clearPlates, getPlates, usePlates } from "@/capture/roll";
import { setMode } from "@/game/mode";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { modeThemes, ref, shellTheme } from "@/theme/tokens";
import { CameraPermission } from "../../CameraPermission";
import type { CameraPermissionProps } from "../../types";
import { COPY, PERMISSION_COPY } from "../copy";

jest.mock("expo-router", () => {
  const { useEffect } = jest.requireActual<typeof import("react")>("react");
  // Focus effects run as effects: the screen is focused from mount. refocus()
  // plays a blur and then a focus, as a return from the light table does.
  const refocusers = new Set<() => void>();
  return {
    router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
    useFocusEffect: (effect: () => void | (() => void)) =>
      useEffect(() => {
        let cleanup = effect();
        const refocus = () => {
          if (typeof cleanup === "function") cleanup();
          cleanup = effect();
        };
        refocusers.add(refocus);
        return () => {
          refocusers.delete(refocus);
          if (typeof cleanup === "function") cleanup();
        };
      }, [effect]),
    refocus: () => refocusers.forEach((refocus) => refocus()),
  };
});
jest.mock("expo-image-picker", () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock("@/capture/process-photo", () => ({ processPhoto: jest.fn() }));
// Stable spies in the full shape, so a test can see which haptic a moment gave.
const mockFeedback = { tick: jest.fn(), tap: jest.fn(), press: jest.fn(), thud: jest.fn(), success: jest.fn(), warning: jest.fn(), error: jest.fn() };
jest.mock("@/game/feedback", () => ({ useFeedback: () => mockFeedback }));

const launch = jest.mocked(ImagePicker.launchImageLibraryAsync);
const process = jest.mocked(processPhoto);
const push = jest.mocked(router.push);
const announce = jest.mocked(AccessibilityInfo.announceForAccessibility);
const { refocus } = jest.requireMock<{ refocus: () => void }>("expo-router");
const hidden = { includeHiddenElements: true } as const;
const P = ref.layout.permission;
const DIMMED = ref.button.disabledOpacity.pill;

// The base device: 393 x 852 with safe areas 59 / 34.
const METRICS = { frame: { x: 0, y: 0, width: 393, height: 852 }, insets: { top: 59, bottom: 34, left: 0, right: 0 } };

const permission = (overrides: Partial<PermissionResponse> = {}): PermissionResponse => ({
  status: "undetermined" as PermissionResponse["status"],
  granted: false,
  canAskAgain: true,
  expires: "never",
  ...overrides,
});
const denied = () => permission({ status: "denied" as PermissionResponse["status"], canAskAgain: false });

const plateFor = (raw: RawPhoto): ProcessedPlate => ({ uri: raw.uri.replace("picked", "plate"), width: 1200, height: 1600 });
const picked = (...uris: string[]) =>
  ({ canceled: false, assets: uris.map((uri) => ({ uri, width: 3000, height: 4000 })) }) as ImagePicker.ImagePickerResult;

function seedRoll(count: number) {
  for (let i = 0; i < count; i++) addPlate({ uri: `file://old-${i}.jpg`, width: 1200, height: 1600 });
}

/** processPhoto calls that finish only when the test says so. */
function holdProcessing() {
  const pending: { finish: () => void; fail: () => void }[] = [];
  process.mockImplementation(
    (raw) =>
      new Promise<ProcessedPlate>((resolve, reject) => {
        pending.push({ finish: () => resolve(plateFor(raw)), fail: () => reject(new Error("decode failed")) });
      }),
  );
  return pending;
}

type ScreenProps = Omit<CameraPermissionProps, "plateCount">;

/** As the route shell passes it: plateCount is the live roll's, usePlates().length. */
function LiveRoll(props: ScreenProps) {
  return <CameraPermission {...props} plateCount={usePlates().length} />;
}

async function renderScreen(overrides: Partial<ScreenProps> = {}, reducedMotion = true) {
  const props: ScreenProps = {
    permission: permission(),
    checking: false,
    requestPermission: jest.fn(async () => permission()),
    retakeIndex: null,
    onClose: jest.fn(),
    ...overrides,
  };
  await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider reducedMotion={reducedMotion}>
        <LiveRoll {...props} />
      </ThemeProvider>
    </SafeAreaProvider>,
  );
  return props;
}

/** The decision's buttons (the close square, always first, is checked on its own). */
const buttonLabels = () => screen.queryAllByRole("button").map((b) => b.props.accessibilityLabel).filter((label) => label !== COPY.close);
const styleOf = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) ?? {};
/** Opacity applied to a control by its own style or by an ancestor's. */
function opacityOf(node: { props: { style?: unknown }; parent: unknown } | null): number {
  let opacity = 1;
  for (let n = node; n; n = n.parent as typeof node) {
    const value = styleOf(n).opacity;
    if (typeof value === "number") opacity *= value;
  }
  return opacity;
}
interface TreeNode {
  type: unknown;
  props: Record<string, unknown>;
  children: readonly (TreeNode | string)[];
}
/** Host elements inside a node (not the node itself). */
function inner(node: unknown): TreeNode[] {
  const walk = (n: TreeNode): TreeNode[] => n.children.flatMap((c) => (typeof c === "string" ? [] : [c, ...walk(c)]));
  return walk(node as TreeNode);
}
/** Host views inside a node (not the node itself) that are accessibility elements of their own. */
function innerAccessible(node: unknown): TreeNode[] {
  return inner(node).filter((n) => n.type === "View" && n.props.accessible === true);
}
/** react-native-svg's processed brush: a solid colour's value, or null for a gradient. */
const solid = (brush: unknown) => {
  const b = brush as { type?: number; payload?: unknown } | null | undefined;
  return b?.type === 0 ? b.payload : null;
};

beforeEach(() => {
  jest.clearAllMocks();
  clearPlates();
  process.mockImplementation(async (raw) => plateFor(raw));
  jest.mocked(Linking.openSettings).mockResolvedValue(undefined);
});

describe("Checking", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("is the dark ground and the close square alone, with a thinking line only past ~1 s", async () => {
    await renderScreen({ permission: null, checking: true });
    expect(screen.queryByTestId("permission-sheet", hidden)).toBeNull();
    expect(buttonLabels()).toEqual([]);
    expect(screen.getByRole("button", { name: COPY.close })).toBeTruthy();
    const ground = screen.getByTestId("permission-ground", hidden);
    expect(styleOf(ground)).toMatchObject({ backgroundColor: ref.color.void });
    expect(screen.queryByTestId("permission-haze", hidden)).toBeNull();

    expect(screen.queryByTestId("permission-checking", hidden)).toBeNull();
    await act(() => jest.advanceTimersByTime(P.thinkingDelay - 1));
    expect(screen.queryByTestId("permission-checking", hidden)).toBeNull();
    expect(announce).not.toHaveBeenCalled();

    await act(() => jest.advanceTimersByTime(1));
    // The status is the line's wrapper; the drawn line inside it is hidden.
    expect(screen.getByTestId("permission-checking").props).toMatchObject({
      accessible: true,
      screenReaderFocusable: true,
      importantForAccessibility: "yes",
      accessibilityLabel: COPY.checking,
      accessibilityLiveRegion: "polite",
    });
    expect(screen.queryByText(COPY.checking)).toBeNull();
    expect(screen.getAllByText(COPY.checking, hidden).length).toBeGreaterThan(0);
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith(COPY.checking);
  });

  it("leaves with the system's back and VoiceOver's escape, as every state does", async () => {
    const add = jest.spyOn(BackHandler, "addEventListener");
    const props = await renderScreen({ permission: null, checking: true });
    expect(add.mock.calls.at(-1)?.[1]?.({} as never)).toBe(true);
    await fireEvent(screen.getByTestId("camera-permission"), "accessibilityEscape");
    expect(props.onClose).toHaveBeenCalledTimes(2);
    add.mockRestore();
  });
});

describe("Default", () => {
  it("sets out the decision on the app's dark sheet: the display title, the grey body, the pill and a quiet way out, in sentence case", async () => {
    await renderScreen();
    expect(styleOf(screen.getByTestId("permission-ground", hidden)).backgroundColor).toBe(ref.color.void);
    expect(styleOf(screen.getByTestId("permission-sheet")).backgroundColor).toBe(ref.color.ground);
    const title = screen.getByRole("header", { name: PERMISSION_COPY.default.title });
    expect(styleOf(title)).toMatchObject({ ...shellTheme.display, color: ref.color.textPrimary, textTransform: "none" });
    expect(styleOf(screen.getByText(PERMISSION_COPY.default.body))).toMatchObject({ ...ref.type.body, color: ref.color.textSecondary });
    expect(styleOf(screen.getByText(PERMISSION_COPY.default.body)).textTransform).toBeUndefined();

    // The kit's 64 pt pill, full width, its label the copy itself.
    const pill = screen.getByRole("button", { name: "Allow the camera" });
    expect(styleOf(pill)).toMatchObject({ minHeight: ref.button.primary.height, alignSelf: "stretch" });
    expect(within(pill).getByText("Allow the camera")).toBeTruthy();

    // The kit's quiet pill on dark: no fill, 48 tall, label + 16 each side, centred; headline type.
    const quiet = screen.getByRole("button", { name: "Choose photos instead" });
    expect(styleOf(quiet)).toMatchObject({ minHeight: ref.button.quiet.height, paddingHorizontal: ref.button.quiet.padX, alignSelf: "center" });
    expect(styleOf(quiet).backgroundColor).toBeUndefined();
    expect(styleOf(within(quiet).getByText("Choose photos instead"))).toMatchObject(ref.type.headline);
    expect(screen.queryByRole("button", { name: "Review your photos" })).toBeNull();
  });

  it("has a visible way out: the close square first, then the pill and the quiet button", async () => {
    const props = await renderScreen();
    const labels = screen.queryAllByRole("button").map((b) => b.props.accessibilityLabel);
    expect(labels).toEqual([COPY.close, "Allow the camera", "Choose photos instead"]);
    await fireEvent.press(screen.getByRole("button", { name: COPY.close }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it("draws the phone on the raised panel: a dark frame, its grey lights and the island, cropped at the panel's foot", async () => {
    await renderScreen();
    // Decoration: present, but hidden from screen readers.
    expect(screen.queryByTestId("permission-illustration")).toBeNull();
    const panel = screen.getByTestId("permission-illustration", hidden);
    expect(styleOf(panel)).toMatchObject({ height: P.panel, backgroundColor: ref.color.raised, overflow: "hidden" });
    const art = inner(panel);
    const svg = art.find((n) => n.type === "RNSVGSvgView");
    expect(svg?.props).toMatchObject({ bbHeight: P.panel });
    const shapes = art.filter((n) => n.type === "RNSVGPath" || n.type === "RNSVGRect");
    const fills = shapes.map((n) => solid(n.props.fill));
    // The frame and the island in the ground, the open screen in the panel's fill.
    expect(fills.filter((c) => c === processColor(ref.color.void))).toHaveLength(2);
    expect(fills.filter((c) => c === processColor(ref.color.raised))).toHaveLength(1);
    // The lights are gradients (illustrationBevel at stop opacities): the left wall, the right wall and the two gloss lines.
    expect(art.filter((n) => n.type === "RNSVGLinearGradient")).toHaveLength(5);
  });

  it("Android back and VoiceOver's escape leave the screen", async () => {
    const add = jest.spyOn(BackHandler, "addEventListener");
    const props = await renderScreen();
    const handler = add.mock.calls.at(-1)?.[1];
    expect(handler?.({} as never)).toBe(true);
    expect(props.onClose).toHaveBeenCalledTimes(1);
    await fireEvent(screen.getByTestId("camera-permission"), "accessibilityEscape");
    expect(props.onClose).toHaveBeenCalledTimes(2);
    add.mockRestore();
  });

  it("Requesting: the pill is busy with its spinner and ignores taps; the quiet button dims", async () => {
    let answer: (value: PermissionResponse) => void = () => {};
    const requestPermission = jest.fn(() => new Promise<PermissionResponse>((resolve) => (answer = resolve)));
    await renderScreen({ requestPermission });

    // userEvent taps through the Pressable, which doesn't wait for the pending request.
    const user = userEvent.setup();
    await user.press(screen.getByRole("button", { name: "Allow the camera" }));
    expect(requestPermission).toHaveBeenCalledTimes(1);
    const pill = screen.getByRole("button", { name: "Allow the camera" });
    expect(pill.props.accessibilityState).toMatchObject({ busy: true, disabled: true });
    // The kit's busy pill: full opacity, its label kept, the white spinner at its right.
    expect(within(pill).getByText("Allow the camera")).toBeTruthy();
    expect(screen.getByTestId("permission-primary-spinner", hidden).props.color).toBe(ref.button.primary.label);
    expect(opacityOf(pill)).toBe(1);
    const quiet = screen.getByRole("button", { name: "Choose photos instead" });
    expect(quiet.props.accessibilityState).toMatchObject({ disabled: true });
    expect(opacityOf(quiet)).toBe(DIMMED);

    await user.press(pill);
    expect(requestPermission).toHaveBeenCalledTimes(1);

    await act(async () => answer(permission()));
    const settled = screen.getByRole("button", { name: "Allow the camera" });
    expect(settled.props.accessibilityState).toMatchObject({ busy: false, disabled: false });
    expect(screen.queryByTestId("permission-primary-spinner", hidden)).toBeNull();
  });

  it("gives the success haptic once access is granted, and none for a refusal", async () => {
    const requestPermission = jest.fn(async (): Promise<PermissionResponse> => permission());
    await renderScreen({ requestPermission });
    await fireEvent.press(screen.getByRole("button", { name: "Allow the camera" }));
    expect(mockFeedback.success).not.toHaveBeenCalled();
    requestPermission.mockResolvedValueOnce({ ...permission(), granted: true, status: "granted" } as PermissionResponse);
    await fireEvent.press(screen.getByRole("button", { name: "Allow the camera" }));
    expect(mockFeedback.success).toHaveBeenCalledTimes(1);
  });

  it("Request error: stays on Default with the error notice", async () => {
    const requestPermission = jest.fn(async (): Promise<PermissionResponse> => {
      throw new Error("no answer");
    });
    await renderScreen({ requestPermission });
    await fireEvent.press(screen.getByRole("button", { name: "Allow the camera" }));
    const notice = screen.getByTestId("permission-notice");
    expect(notice).toHaveTextContent("The camera didn't answer. Try again.");
    expect(notice.props.accessibilityLiveRegion).toBe("polite");
    expect(screen.getByRole("button", { name: "Allow the camera" })).toBeTruthy();
  });

  it("the notice is read in place but is never a keyboard or switch focus stop", async () => {
    const requestPermission = jest.fn(async (): Promise<PermissionResponse> => {
      throw new Error("no answer");
    });
    await renderScreen({ requestPermission });
    await fireEvent.press(screen.getByRole("button", { name: "Allow the camera" }));
    const notice = screen.getByTestId("permission-notice");
    // Not an accessibility element (on Android `accessible` would make it focusable);
    // its text is read where it sits, and the polite live region speaks it.
    expect(notice.props.accessible).toBe(false);
    expect(notice.props.accessibilityLabel).toBeUndefined();
    expect(notice.props.accessibilityLiveRegion).toBe("polite");
    // The Warning is an icon, hidden from screen readers; the words are meta and grey.
    expect(screen.queryByTestId("permission-notice-icon")).toBeNull();
    expect(screen.getByTestId("permission-notice-icon", hidden)).toBeTruthy();
    expect(styleOf(screen.getByText("The camera didn't answer. Try again."))).toMatchObject({
      ...ref.type.meta,
      color: ref.color.textSecondary,
    });
    // Keyboard and switch focus: the pill, then the quiet button.
    expect(buttonLabels()).toEqual(["Allow the camera", "Choose photos instead"]);
  });
});

describe("inside a mode: the mode's dark sheet", () => {
  const theme = modeThemes.paranormal;
  beforeEach(() => setMode("paranormal"));
  afterEach(() => setMode(null));

  it("lays the mode's ground with no haze, and a surface sheet with the title in ink and the body in muted ink", async () => {
    await renderScreen();
    expect(styleOf(screen.getByTestId("permission-ground", hidden)).backgroundColor).toBe(theme.ground);
    expect(screen.queryByTestId("permission-haze", hidden)).toBeNull();
    expect(styleOf(screen.getByTestId("permission-sheet")).backgroundColor).toBe(theme.surface);
    const title = screen.getByRole("header", { name: PERMISSION_COPY.default.title });
    expect(styleOf(title)).toMatchObject({ ...theme.display, color: theme.ink, textTransform: "none" });
    expect(styleOf(screen.getByText(PERMISSION_COPY.default.body)).color).toBe(theme.inkMuted);
  });

  it("makes the pill the mode's primary button and the quiet way out its muted ink, with the same sizes", async () => {
    await renderScreen();
    const pill = screen.getByRole("button", { name: "Allow the camera" });
    expect(styleOf(pill)).toMatchObject({ minHeight: ref.button.primary.height, alignSelf: "stretch", backgroundColor: theme.accent });
    expect(styleOf(within(pill).getByText("Allow the camera"))).toMatchObject({ ...ref.type.ctaLabel, color: theme.accentInk });
    const quiet = screen.getByRole("button", { name: "Choose photos instead" });
    expect(styleOf(quiet)).toMatchObject({ minHeight: ref.button.quiet.height, paddingHorizontal: ref.button.quiet.padX, alignSelf: "center" });
    expect(styleOf(quiet).backgroundColor).toBeUndefined();
    expect(styleOf(within(quiet).getByText("Choose photos instead"))).toMatchObject({ ...ref.type.headline, color: theme.inkMuted });
  });

  it("draws the phone dark on the mode's raised panel", async () => {
    await renderScreen();
    const panel = screen.getByTestId("permission-illustration", hidden);
    expect(styleOf(panel).backgroundColor).toBe(theme.raised);
    const fills = inner(panel)
      .filter((n) => n.type === "RNSVGPath" || n.type === "RNSVGRect")
      .map((n) => solid(n.props.fill));
    expect(fills.filter((c) => c === processColor(theme.ground))).toHaveLength(2);
    expect(fills.filter((c) => c === processColor(theme.raised))).toHaveLength(1);
  });

  it("still requests, busy with the spinner in the accent's ink, and gives the success haptic on a grant", async () => {
    let answer: (value: PermissionResponse) => void = () => {};
    const requestPermission = jest.fn(() => new Promise<PermissionResponse>((resolve) => (answer = resolve)));
    await renderScreen({ requestPermission });
    await userEvent.setup().press(screen.getByRole("button", { name: "Allow the camera" }));
    const pill = screen.getByRole("button", { name: "Allow the camera" });
    expect(pill.props.accessibilityState).toMatchObject({ busy: true, disabled: true });
    expect(screen.getByTestId("permission-primary-spinner", hidden).props.color).toBe(theme.accentInk);
    expect(opacityOf(screen.getByRole("button", { name: "Choose photos instead" }))).toBe(DIMMED);
    await act(async () => answer({ ...permission(), granted: true, status: "granted" } as PermissionResponse));
    expect(mockFeedback.success).toHaveBeenCalledTimes(1);
  });

  it("puts the error notice in the mode's sheet colours", async () => {
    const requestPermission = jest.fn(async (): Promise<PermissionResponse> => {
      throw new Error("no answer");
    });
    await renderScreen({ requestPermission });
    await fireEvent.press(screen.getByRole("button", { name: "Allow the camera" }));
    expect(styleOf(screen.getByText("The camera didn't answer. Try again.")).color).toBe(theme.inkMuted);
    expect(screen.getByTestId("phosphor-react-native-warning-regular", hidden).props.color).toBe(theme.ink);
  });
});

describe("Denied, can't ask again", () => {
  it("says the camera is off and opens Settings; the quiet way out is unchanged", async () => {
    await renderScreen({ permission: denied() });
    expect(screen.getByRole("header", { name: "The camera is off" })).toBeTruthy();
    expect(
      screen.getByText("ESCAPD can't ask again from here. Turn on Camera for ESCAPD in Settings, or choose photos you've already taken."),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Choose photos instead" })).toBeTruthy();
    const pill = screen.getByRole("button", { name: "Open Settings" });
    expect(within(pill).getByText("Open Settings")).toBeTruthy();
    await fireEvent.press(pill);
    expect(Linking.openSettings).toHaveBeenCalledTimes(1);
  });
});

describe("roll and retake", () => {
  it("with 3 to 5 photos adds 'Review your photos' last, which opens the review screen", async () => {
    seedRoll(3);
    await renderScreen();
    expect(buttonLabels()).toEqual(["Allow the camera", "Choose photos instead", "Review your photos"]);
    await fireEvent.press(screen.getByRole("button", { name: "Review your photos" }));
    expect(push).toHaveBeenCalledWith("/capture/review");
  });

  it("with 6 photos the one quiet button goes to the review screen", async () => {
    seedRoll(6);
    await renderScreen();
    expect(screen.queryByRole("button", { name: "Choose photos instead" })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Review your photos" })).toHaveLength(1);
  });

  it("in retake mode picks one photo and has no light-table button; leaving cancels the retake", async () => {
    seedRoll(4);
    const props = await renderScreen({ retakeIndex: 1 });
    expect(buttonLabels()).toEqual(["Allow the camera", "Choose a photo instead"]);
    await fireEvent(screen.getByTestId("camera-permission"), "accessibilityEscape");
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
});

describe("Choose photos instead", () => {
  it("below 3 photos stays here and says how many are taken", async () => {
    launch.mockResolvedValue(picked("file://picked-a.jpg"));
    await renderScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Choose photos instead" }));
    const notice = screen.getByTestId("permission-notice");
    expect(notice).toHaveTextContent("1 photo taken. A case needs at least 3.");
    expect(notice.props.accessibilityLiveRegion).toBe("polite");
    // Progress: no icon, the text in meta, grey.
    expect(screen.queryByTestId("permission-notice-icon", hidden)).toBeNull();
    expect(styleOf(screen.getByText("1 photo taken. A case needs at least 3."))).toMatchObject({
      ...ref.type.meta,
      color: ref.color.textSecondary,
    });
    expect(push).not.toHaveBeenCalled();
  });

  it("opens the review screen once 3 photos are taken", async () => {
    seedRoll(2);
    launch.mockResolvedValue(picked("file://picked-a.jpg"));
    await renderScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Choose photos instead" }));
    expect(push).toHaveBeenCalledWith("/capture/review");
    expect(screen.queryByTestId("permission-notice")).toBeNull();
  });

  it("shows the error notice when a photo can't be used", async () => {
    launch.mockResolvedValue(picked("file://picked-a.jpg"));
    process.mockRejectedValue(new Error("decode failed"));
    await renderScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Choose photos instead" }));
    expect(screen.getByTestId("permission-notice")).toHaveTextContent("One of those photos couldn't be used. Try another.");
    expect(screen.getByTestId("permission-notice-icon", hidden)).toBeTruthy();
  });

  it("Library busy: a thinking line on the dark sheet with real progress; the pill dims, and the quiet button is busy and keeps its label and focus", async () => {
    launch.mockResolvedValue(picked("file://picked-a.jpg", "file://picked-b.jpg"));
    const pending = holdProcessing();
    await renderScreen();
    await userEvent.setup().press(screen.getByRole("button", { name: "Choose photos instead" }));

    // The status is the line's wrapper; the moving copies inside it are hidden.
    expect(screen.getByTestId("permission-busy").props).toMatchObject({
      accessible: true,
      screenReaderFocusable: true,
      importantForAccessibility: "yes",
      accessibilityLabel: "Preparing your photos",
      accessibilityLiveRegion: "polite",
    });
    expect(announce).toHaveBeenCalledWith("Preparing your photos");
    expect(screen.queryByText("Preparing photo 1 of 2")).toBeNull();
    const drawn = screen.getAllByText("Preparing photo 1 of 2", hidden).map(styleOf);
    // On dark, under reduced motion: a still line in the reference's grey.
    expect(drawn.some((s) => s.color === ref.motion.thinking.shimmer.still && s.fontSize === ref.type.meta.fontSize)).toBe(true);

    const pill = screen.getByRole("button", { name: "Allow the camera" });
    expect(pill.props.accessibilityState).toMatchObject({ disabled: true });
    expect(within(pill).getByText("Allow the camera")).toBeTruthy();
    expect(opacityOf(pill)).toBe(DIMMED);
    const quiet = screen.getByRole("button", { name: "Choose photos instead" });
    expect(quiet.props.accessibilityState).toMatchObject({ disabled: true, busy: true });
    expect(within(quiet).getByText("Choose photos instead")).toBeTruthy();
    expect(inner(quiet).some((n) => n.type === "ActivityIndicator")).toBe(false);
    expect(quiet.props.focusable).toBe(true);
    expect(opacityOf(quiet)).toBe(DIMMED);

    await act(async () => pending[0].finish());
    expect(screen.getAllByText("Preparing photo 2 of 2", hidden).length).toBeGreaterThan(0);
    // The fixed status is spoken once; the count changes are not announced.
    expect(announce.mock.calls.filter(([text]) => text === "Preparing your photos")).toHaveLength(1);
    await act(async () => pending[1].finish());
    expect(screen.queryByTestId("permission-busy")).toBeNull();
    expect(screen.getByTestId("permission-notice")).toHaveTextContent("2 photos taken. A case needs at least 3.");
  });

  it("Library busy: no light-table button joins while the roll grows past three, until /capture is focused again", async () => {
    launch.mockResolvedValue(picked("file://picked-a.jpg", "file://picked-b.jpg", "file://picked-c.jpg", "file://picked-d.jpg"));
    const pending = holdProcessing();
    await renderScreen();
    await userEvent.setup().press(screen.getByRole("button", { name: "Choose photos instead" }));

    // Photos 1-3 join the roll (one at a time) while photo 4 is still re-encoding.
    for (let i = 0; i < 3; i++) await act(async () => pending[i].finish());
    expect(getPlates()).toHaveLength(3);
    expect(screen.getByTestId("permission-busy")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Review your photos" })).toBeNull();
    expect(screen.queryByTestId("permission-light-table", hidden)).toBeNull();
    expect(screen.getByRole("button", { name: "Choose photos instead" }).props.accessibilityState).toMatchObject({ busy: true });

    // Photo 4 joins and the light table opens; the buttons hold still while /capture fades out.
    await act(async () => pending[3].finish());
    expect(push).toHaveBeenCalledWith("/capture/review");
    expect(buttonLabels()).toEqual(["Allow the camera", "Choose photos instead"]);

    // Back from the light table: Roll ready, as the roll of four now stands.
    await act(async () => refocus());
    expect(buttonLabels()).toEqual(["Allow the camera", "Choose photos instead", "Review your photos"]);
  });

  it("Library busy from a roll of four: the busy quiet button keeps its label and the light-table button stays as the roll fills", async () => {
    seedRoll(4);
    launch.mockResolvedValue(picked("file://picked-a.jpg", "file://picked-b.jpg"));
    const pending = holdProcessing();
    await renderScreen();
    const ready = ["Allow the camera", "Choose photos instead", "Review your photos"];
    expect(buttonLabels()).toEqual(ready);
    await userEvent.setup().press(screen.getByRole("button", { name: "Choose photos instead" }));

    await act(async () => pending[0].finish());
    expect(getPlates()).toHaveLength(5);
    expect(screen.getByTestId("permission-busy")).toBeTruthy();
    expect(buttonLabels()).toEqual(ready);

    // The roll fills and the light table opens: still the same two quiet buttons.
    await act(async () => pending[1].finish());
    expect(getPlates()).toHaveLength(6);
    expect(push).toHaveBeenCalledWith("/capture/review");
    expect(buttonLabels()).toEqual(ready);

    // Back from the light table: Roll full, one quiet button to the light table.
    await act(async () => refocus());
    expect(buttonLabels()).toEqual(["Allow the camera", "Review your photos"]);
  });

  it("a second tap before the picker opens starts nothing and doesn't release the held roll count", async () => {
    let open: (result: ImagePicker.ImagePickerResult) => void = () => {};
    launch.mockImplementation(() => new Promise((resolve) => (open = resolve)));
    const pending = holdProcessing();
    await renderScreen();
    const user = userEvent.setup();
    await user.press(screen.getByRole("button", { name: "Choose photos instead" }));
    await user.press(screen.getByRole("button", { name: "Choose photos instead" }));
    expect(launch).toHaveBeenCalledTimes(1);

    await act(async () => open(picked("file://picked-a.jpg", "file://picked-b.jpg", "file://picked-c.jpg", "file://picked-d.jpg")));
    for (let i = 0; i < 3; i++) await act(async () => pending[i].finish());
    expect(getPlates()).toHaveLength(3);
    expect(screen.getByTestId("permission-busy")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Review your photos" })).toBeNull();
  });

  it("with a single photo shows the thinking line only past ~1 s", async () => {
    jest.useFakeTimers();
    try {
      launch.mockResolvedValue(picked("file://picked-a.jpg"));
      const pending = holdProcessing();
      await renderScreen();
      await userEvent.setup({ advanceTimers: jest.advanceTimersByTime }).press(screen.getByRole("button", { name: "Choose photos instead" }));
      expect(screen.queryByTestId("permission-busy", hidden)).toBeNull();
      expect(announce).not.toHaveBeenCalledWith("Preparing your photos");
      await act(() => jest.advanceTimersByTime(P.thinkingDelay));
      expect(screen.getByTestId("permission-busy").props.accessibilityLabel).toBe("Preparing your photos");
      expect(announce).toHaveBeenCalledWith("Preparing your photos");
      await act(async () => pending[0].finish());
      expect(screen.queryByTestId("permission-busy")).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });
});

// On Android `accessible` sets isFocusable, which would make a thinking line a
// keyboard, D-pad and Switch Access stop; there the status is screenReaderFocusable
// instead, one TalkBack element read by its label.
describe.each([
  { os: "ios", accessible: true },
  { os: "android", accessible: false },
] as const)("thinking lines on $os", ({ os, accessible }) => {
  let platform: jest.ReplaceProperty<typeof Platform.OS> | undefined;
  beforeEach(() => {
    platform = jest.replaceProperty(Platform, "OS", os);
  });
  afterEach(() => platform?.restore());

  it("Checking past ~1 s: one screen-reader status, never a keyboard or switch stop", async () => {
    jest.useFakeTimers();
    try {
      await renderScreen({ permission: null, checking: true });
      await act(() => jest.advanceTimersByTime(P.thinkingDelay));
      expect(screen.getByTestId("permission-checking").props).toMatchObject({
        accessible,
        screenReaderFocusable: true,
        importantForAccessibility: "yes",
        accessibilityLabel: COPY.checking,
        accessibilityLiveRegion: "polite",
      });
      expect(announce).toHaveBeenCalledWith(COPY.checking);
      // Nothing inside it is an accessibility element of its own.
      expect(innerAccessible(screen.getByTestId("permission-checking"))).toHaveLength(0);
      expect(buttonLabels()).toEqual([]);
    } finally {
      jest.useRealTimers();
    }
  });

  it("Library busy: one screen-reader status, never a keyboard or switch stop", async () => {
    launch.mockResolvedValue(picked("file://picked-a.jpg", "file://picked-b.jpg"));
    holdProcessing();
    await renderScreen();
    await userEvent.setup().press(screen.getByRole("button", { name: "Choose photos instead" }));
    const line = screen.getByTestId("permission-busy");
    expect(line.props).toMatchObject({
      accessible,
      screenReaderFocusable: true,
      importantForAccessibility: "yes",
      accessibilityLabel: "Preparing your photos",
      accessibilityLiveRegion: "polite",
    });
    expect(innerAccessible(line)).toHaveLength(0);
    // Keyboard and switch focus: the pill, then the quiet button.
    expect(buttonLabels()).toEqual(["Allow the camera", "Choose photos instead"]);
  });
});

import { AccessibilityInfo, BackHandler, Linking, Platform, StyleSheet, processColor } from "react-native";
import { act, fireEvent, render, screen, userEvent, within } from "@testing-library/react-native";
import type { PermissionResponse } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { processPhoto, type ProcessedPlate, type RawPhoto } from "@/capture/process-photo";
import { addPlate, clearPlates, getPlates, usePlates } from "@/capture/roll";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { color, hit, radius, ref, space, type } from "@/theme/tokens";
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

const launch = jest.mocked(ImagePicker.launchImageLibraryAsync);
const process = jest.mocked(processPhoto);
const push = jest.mocked(router.push);
const announce = jest.mocked(AccessibilityInfo.announceForAccessibility);
const { refocus } = jest.requireMock<{ refocus: () => void }>("expo-router");
const hidden = { includeHiddenElements: true } as const;
const P = ref.layout.permission;
// The live Button's own dimmed state (src/components/Button.tsx: inactive = disabled or loading).
const LIVE_DIMMED = 0.45;

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

const buttonLabels = () => screen.getAllByRole("button").map((b) => b.props.accessibilityLabel);
const styleOf = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) ?? {};
/** The live Button draws its fill, edge, corners and dimming on an inner surface; layout stays on the pressable. */
const surfaceOf = (button: Parameters<typeof within>[0]) => within(button).getByTestId("button-surface", { includeHiddenElements: true });
const buttonLook = (button: Parameters<typeof within>[0]) => ({ ...styleOf(button), ...styleOf(surfaceOf(button)) });
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
/** Host elements inside a node (not the node itself) that are accessibility elements of their own. */
function innerAccessible(node: unknown): TreeNode[] {
  return inner(node).filter((n) => n.props.accessible === true);
}

beforeEach(() => {
  jest.clearAllMocks();
  clearPlates();
  process.mockImplementation(async (raw) => plateFor(raw));
  jest.mocked(Linking.openSettings).mockResolvedValue(undefined);
});

describe("Checking", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("is the route's ground with the live back control only, and a thinking line only past ~1 s", async () => {
    const props = await renderScreen({ permission: null, checking: true });
    expect(screen.queryByTestId("permission-sheet", hidden)).toBeNull();
    expect(screen.queryByRole("button", { name: PERMISSION_COPY.default.action })).toBeNull();
    expect(screen.queryByTestId("permission-checking", hidden)).toBeNull();
    await act(() => jest.advanceTimersByTime(ref.layout.permission.thinkingDelay - 1));
    expect(screen.queryByTestId("permission-checking", hidden)).toBeNull();

    expect(screen.queryByLabelText(COPY.checking, hidden)).toBeNull();
    expect(announce).not.toHaveBeenCalled();

    await act(() => jest.advanceTimersByTime(ref.layout.permission.thinkingDelay));
    // The status is this screen's wrapper; the drawn line inside it is hidden.
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

    // The live IconButton: live in every state, Checking included.
    const back = screen.getByRole("button", { name: COPY.close });
    expect(back.props.accessibilityState?.disabled ?? false).toBe(false);
    await fireEvent.press(back);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
});

describe("Default", () => {
  it("sets out the decision: Playfair heading, Jakarta body, a brass button and a quiet way out", async () => {
    await renderScreen();
    const title = screen.getByRole("header", { name: "Let ESCAPD use the camera" });
    expect(styleOf(title)).toMatchObject({ ...type.narrativeTitle, color: color.text });
    expect(styleOf(screen.getByText(PERMISSION_COPY.default.body))).toMatchObject({ ...type.body, color: color.textSecondary });
    // The live Button: primary is brass with the dark label; quiet is transparent with a color.text label, centred.
    const primary = screen.getByRole("button", { name: "Allow the camera" });
    expect(buttonLook(primary)).toMatchObject({ backgroundColor: color.accent, borderRadius: radius.control, minHeight: hit.min });
    expect(styleOf(within(primary).getByText("Allow the camera")).color).toBe(color.onAccent);
    const quiet = screen.getByRole("button", { name: "Choose photos instead" });
    expect(buttonLook(quiet)).toMatchObject({ backgroundColor: "transparent", alignSelf: "center", minHeight: hit.min });
    expect(styleOf(within(quiet).getByText("Choose photos instead")).color).toBe(color.text);
    expect(screen.queryByRole("button", { name: "Go to the light table" })).toBeNull();
    // The drawing is decoration: present, but hidden from screen readers.
    expect(screen.queryByTestId("permission-illustration")).toBeNull();
    expect(screen.getByTestId("permission-illustration", hidden)).toBeTruthy();
  });

  it("draws the phone on a small film plate, with no light pool", async () => {
    await renderScreen();
    expect(styleOf(screen.getByTestId("permission-mount", hidden))).toMatchObject({
      backgroundColor: color.surface,
      borderColor: color.hairline,
      borderRadius: radius.thumbRing,
    });
    expect(styleOf(screen.getByTestId("permission-plate", hidden))).toMatchObject({
      backgroundColor: color.canvas,
      borderRadius: radius.thumb,
      height: P.plate.height,
      overflow: "hidden",
    });
    const art = inner(screen.getByTestId("permission-illustration", hidden));
    expect(art.some((n) => String(n.type).includes("RadialGradient"))).toBe(false);
    // Warm lines: the two brackets in brass, the phone's outline in color.textSecondary,
    // its body walnut and its screen soot. No Noir grey or white anywhere.
    const solid = (brush: unknown) => {
      const b = brush as { type?: number; payload?: unknown } | null | undefined;
      return b?.type === 0 ? b.payload : null;
    };
    const strokes = art.map((n) => solid(n.props.stroke));
    const fills = art.map((n) => solid(n.props.fill));
    expect(art.filter((n) => n.type === "RNSVGPath" && solid(n.props.stroke) === processColor(color.accent))).toHaveLength(2);
    expect(strokes).toContain(processColor(P.line.mid.color));
    expect(fills).toEqual(expect.arrayContaining([processColor(color.surface), processColor(color.canvas)]));
    const noir = [ref.color.bright, ref.color.read, ref.color.meta, ref.color.hairline2, ref.color.panel, ref.color.ground].map((c) => processColor(c));
    expect([...strokes, ...fills].some((c) => noir.includes(c as never))).toBe(false);
  });

  it("puts the live back control on 02's back centre (43, 89) with a 56 hit area", async () => {
    await renderScreen();
    const back = screen.getByTestId("permission-back");
    expect(styleOf(back)).toMatchObject({ width: hit.min, height: hit.min, borderRadius: radius.round, backgroundColor: "transparent" });
    expect(back.props.hitSlop).toBe(space.xs);
    // The wrapper holds the 48 circle and its slop, so every touch lands inside a parent.
    const box = styleOf(back.parent as never) as { left: number; top: number; width: number; height: number };
    expect(box.left).toBe(P.back.left - space.xs);
    expect(box.top).toBe(METRICS.insets.top + P.back.top - space.xs);
    expect(box.width).toBe(hit.min + space.xs * 2);
    expect([box.left + box.width / 2, box.top + box.height / 2]).toEqual([43, 89]);
  });

  it("Android back does what the back arrow does", async () => {
    const add = jest.spyOn(BackHandler, "addEventListener");
    const props = await renderScreen();
    const handler = add.mock.calls.at(-1)?.[1];
    expect(handler?.({} as never)).toBe(true);
    expect(props.onClose).toHaveBeenCalledTimes(1);
    add.mockRestore();
  });

  it("Requesting: the brass button shows the live spinner, ignores taps and is busy; the quiet button dims; back stays live", async () => {
    let answer: (value: PermissionResponse) => void = () => {};
    const requestPermission = jest.fn(() => new Promise<PermissionResponse>((resolve) => (answer = resolve)));
    await renderScreen({ requestPermission });

    // userEvent taps through the Pressable, which doesn't wait for the pending request.
    const user = userEvent.setup();
    await user.press(screen.getByRole("button", { name: "Allow the camera" }));
    expect(requestPermission).toHaveBeenCalledTimes(1);
    const pill = screen.getByRole("button", { name: "Allow the camera" });
    expect(pill.props.accessibilityState).toMatchObject({ busy: true, disabled: true });
    // The live Button's loading: a spinner in place of the label, the control dimmed.
    expect(within(pill).queryByText("Allow the camera")).toBeNull();
    expect(inner(pill).some((n) => n.type === "ActivityIndicator" && n.props.color === color.onAccent)).toBe(true);
    expect(opacityOf(surfaceOf(pill))).toBe(LIVE_DIMMED);
    const quiet = screen.getByRole("button", { name: "Choose photos instead" });
    expect(quiet.props.accessibilityState).toMatchObject({ disabled: true });
    expect(opacityOf(surfaceOf(quiet))).toBe(LIVE_DIMMED);
    const back = screen.getByRole("button", { name: COPY.close });
    expect(back.props.accessibilityState?.disabled ?? false).toBe(false);
    expect(opacityOf(back)).toBe(1);

    await user.press(pill);
    expect(requestPermission).toHaveBeenCalledTimes(1);

    await act(async () => answer(permission()));
    const settled = screen.getByRole("button", { name: "Allow the camera" });
    expect(settled.props.accessibilityState).toMatchObject({ busy: false, disabled: false });
    expect(within(settled).getByText("Allow the camera")).toBeTruthy();
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
    // The Warning is an icon, hidden from screen readers; the words are caption
    // in color.textSecondary, never error-coloured on the dark sheet.
    expect(screen.queryByTestId("permission-notice-icon")).toBeNull();
    expect(screen.getByTestId("permission-notice-icon", hidden)).toBeTruthy();
    expect(styleOf(screen.getByText("The camera didn't answer. Try again."))).toMatchObject({
      ...type.caption,
      color: color.textSecondary,
    });
    // Keyboard and switch focus: back, primary, quiet button.
    expect(buttonLabels()).toEqual([COPY.close, "Allow the camera", "Choose photos instead"]);
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
    await fireEvent.press(screen.getByRole("button", { name: "Open Settings" }));
    expect(Linking.openSettings).toHaveBeenCalledTimes(1);
  });
});

describe("roll and retake", () => {
  it("with 3 to 5 plates adds 'Go to the light table' last, which opens the light table", async () => {
    seedRoll(3);
    await renderScreen();
    expect(buttonLabels()).toEqual([COPY.close, "Allow the camera", "Choose photos instead", "Go to the light table"]);
    await fireEvent.press(screen.getByRole("button", { name: "Go to the light table" }));
    expect(push).toHaveBeenCalledWith("/capture/review");
  });

  it("with a full roll the one quiet button goes to the light table", async () => {
    seedRoll(6);
    await renderScreen();
    expect(screen.queryByRole("button", { name: "Choose photos instead" })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Go to the light table" })).toHaveLength(1);
  });

  it("in retake mode cancels the retake and picks one photo", async () => {
    seedRoll(4);
    await renderScreen({ retakeIndex: 1 });
    expect(screen.getByRole("button", { name: "Cancel retake" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Choose a photo instead" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Go to the light table" })).toBeNull();
  });
});

describe("Choose photos instead", () => {
  it("below three plates stays here and says how many are on the roll", async () => {
    launch.mockResolvedValue(picked("file://picked-a.jpg"));
    await renderScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Choose photos instead" }));
    const notice = screen.getByTestId("permission-notice");
    expect(notice).toHaveTextContent("1 plate on the roll. A case needs at least three.");
    expect(notice.props.accessibilityLiveRegion).toBe("polite");
    // Progress: no icon, the text in caption, color.textSecondary.
    expect(screen.queryByTestId("permission-notice-icon", hidden)).toBeNull();
    expect(styleOf(screen.getByText("1 plate on the roll. A case needs at least three."))).toMatchObject({
      ...type.caption,
      color: color.textSecondary,
    });
    expect(push).not.toHaveBeenCalled();
  });

  it("opens the light table once the roll reaches three", async () => {
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

  it("Library busy: a warm thinking line with real progress; the buttons dim, and the quiet one is busy and keeps its label and focus", async () => {
    launch.mockResolvedValue(picked("file://picked-a.jpg", "file://picked-b.jpg"));
    const pending = holdProcessing();
    await renderScreen();
    await userEvent.setup().press(screen.getByRole("button", { name: "Choose photos instead" }));

    // The status is this screen's wrapper; the moving copies inside it are hidden.
    expect(screen.getByTestId("permission-busy").props).toMatchObject({
      accessible: true,
      screenReaderFocusable: true,
      importantForAccessibility: "yes",
      accessibilityLabel: "Re-encoding your photos",
      accessibilityLiveRegion: "polite",
    });
    expect(announce).toHaveBeenCalledWith("Re-encoding your photos");
    expect(screen.queryByText("Re-encoding photo 1 of 2")).toBeNull();
    const drawn = screen.getAllByText("Re-encoding photo 1 of 2", hidden).map(styleOf);
    // Warm tone: caption type; under reduced motion a still color.textSecondary line.
    expect(drawn.some((s) => s.color === color.textSecondary && s.fontFamily === type.caption.fontFamily)).toBe(true);

    const pill = screen.getByRole("button", { name: "Allow the camera" });
    expect(pill.props.accessibilityState).toMatchObject({ disabled: true });
    expect(within(pill).getByText("Allow the camera")).toBeTruthy();
    expect(opacityOf(surfaceOf(pill))).toBe(LIVE_DIMMED);
    const quiet = screen.getByRole("button", { name: "Choose photos instead" });
    expect(quiet.props.accessibilityState).toMatchObject({ disabled: true, busy: true });
    expect(within(quiet).getByText("Choose photos instead")).toBeTruthy();
    expect(inner(quiet).some((n) => n.type === "ActivityIndicator")).toBe(false);
    expect(quiet.props.focusable).toBe(true);
    expect(opacityOf(surfaceOf(quiet))).toBe(LIVE_DIMMED);
    const back = screen.getByRole("button", { name: COPY.close });
    expect(back.props.accessibilityState?.disabled ?? false).toBe(false);

    await act(async () => pending[0].finish());
    expect(screen.getAllByText("Re-encoding photo 2 of 2", hidden).length).toBeGreaterThan(0);
    // The fixed status is spoken once; the count changes are not announced.
    expect(announce.mock.calls.filter(([text]) => text === "Re-encoding your photos")).toHaveLength(1);
    await act(async () => pending[1].finish());
    expect(screen.queryByTestId("permission-busy")).toBeNull();
    expect(screen.getByTestId("permission-notice")).toHaveTextContent("2 plates on the roll. A case needs at least three.");
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
    expect(screen.queryByRole("button", { name: "Go to the light table" })).toBeNull();
    expect(screen.queryByTestId("permission-light-table", hidden)).toBeNull();
    expect(screen.getByRole("button", { name: "Choose photos instead" }).props.accessibilityState).toMatchObject({ busy: true });

    // Photo 4 joins and the light table opens; the buttons hold still while /capture fades out.
    await act(async () => pending[3].finish());
    expect(push).toHaveBeenCalledWith("/capture/review");
    expect(buttonLabels()).toEqual([COPY.close, "Allow the camera", "Choose photos instead"]);

    // Back from the light table: Roll ready, as the roll of four now stands.
    await act(async () => refocus());
    expect(buttonLabels()).toEqual([COPY.close, "Allow the camera", "Choose photos instead", "Go to the light table"]);
  });

  it("Library busy from a roll of four: the busy quiet button keeps its label and the light-table button stays as the roll fills", async () => {
    seedRoll(4);
    launch.mockResolvedValue(picked("file://picked-a.jpg", "file://picked-b.jpg"));
    const pending = holdProcessing();
    await renderScreen();
    const ready = [COPY.close, "Allow the camera", "Choose photos instead", "Go to the light table"];
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
    expect(buttonLabels()).toEqual([COPY.close, "Allow the camera", "Go to the light table"]);
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
    expect(screen.queryByRole("button", { name: "Go to the light table" })).toBeNull();
  });

  it("with a single photo shows the thinking line only past ~1 s", async () => {
    jest.useFakeTimers();
    try {
      launch.mockResolvedValue(picked("file://picked-a.jpg"));
      const pending = holdProcessing();
      await renderScreen();
      await userEvent.setup({ advanceTimers: jest.advanceTimersByTime }).press(screen.getByRole("button", { name: "Choose photos instead" }));
      expect(screen.queryByTestId("permission-busy", hidden)).toBeNull();
      expect(announce).not.toHaveBeenCalledWith("Re-encoding your photos");
      await act(() => jest.advanceTimersByTime(ref.layout.permission.thinkingDelay));
      expect(screen.getByTestId("permission-busy").props.accessibilityLabel).toBe("Re-encoding your photos");
      expect(announce).toHaveBeenCalledWith("Re-encoding your photos");
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
      await act(() => jest.advanceTimersByTime(ref.layout.permission.thinkingDelay));
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
      expect(buttonLabels()).toEqual([COPY.close]);
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
      accessibilityLabel: "Re-encoding your photos",
      accessibilityLiveRegion: "polite",
    });
    expect(innerAccessible(line)).toHaveLength(0);
    // Keyboard and switch focus: back, primary, quiet button.
    expect(buttonLabels()).toEqual([COPY.close, "Allow the camera", "Choose photos instead"]);
  });
});

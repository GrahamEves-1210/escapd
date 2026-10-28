import { AccessibilityInfo, AppState, BackHandler, Dimensions, Platform, StyleSheet, processColor } from "react-native";
import { act, fireEvent, render, screen, userEvent, within } from "@testing-library/react-native";
import { router, useLocalSearchParams } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { openCapture } from "@/capture/openCapture";
import { grantTestEntitlement, testPurchasesEnabled, TestPurchaseError, TestPurchaseUnavailableError } from "@/capture/testPurchase";
import { WifiSlashIcon } from "@/components/icons";
import * as api from "@/lib/escapd-api";
import type { MyAccess } from "@/lib/puzzle-types";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { ref, shellTheme } from "@/theme/tokens";
import * as copy from "../copy";
import { ProNoticeLine } from "../ProNoticeLine";
import { ProScreen } from "../ProScreen";
import { capFromParam, noticeFor } from "../useProFlow";

const mockNavigation = {
  canGoBack: jest.fn(() => false),
  addListener: jest.fn((_event: string, _listener: (e: { data: { closing: boolean } }) => void) => () => {}),
};
const mockSuccess = jest.fn();

jest.mock("expo-router", () => {
  const { useEffect } = jest.requireActual<typeof import("react")>("react");
  return {
    router: { back: jest.fn(), replace: jest.fn(), push: jest.fn(), canGoBack: jest.fn(() => true) },
    useLocalSearchParams: jest.fn(() => ({})),
    // Focus once on mount; blur on unmount.
    useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]),
    useNavigation: () => mockNavigation,
  };
});

jest.mock("expo-status-bar", () => ({ setStatusBarStyle: jest.fn() }));

jest.mock("@/lib/escapd-api", () => ({
  ensureSession: jest.fn(),
  getMyAccess: jest.fn(),
  currentSession: jest.fn(),
  isNetworkError: (error: unknown) => error instanceof Error && /network request failed/i.test(error.message),
}));

jest.mock("@/capture/openCapture", () => ({ openCapture: jest.fn() }));

jest.mock("@/capture/testPurchase", () => {
  const actual = jest.requireActual<typeof import("@/capture/testPurchase")>("@/capture/testPurchase");
  return { ...actual, testPurchasesEnabled: jest.fn(() => true), grantTestEntitlement: jest.fn(actual.grantTestEntitlement) };
});

jest.mock("@/game/feedback", () => ({
  useFeedback: () => ({ tick: jest.fn(), tap: jest.fn(), press: jest.fn(), thud: jest.fn(), success: mockSuccess, warning: jest.fn(), error: jest.fn() }),
}));

const mocked = jest.mocked(api);
const params = jest.mocked(useLocalSearchParams);
const replace = jest.mocked(router.replace);
const back = jest.mocked(router.back);
const canGoBack = jest.mocked(router.canGoBack);
const open = jest.mocked(openCapture);
const grant = jest.mocked(grantTestEntitlement);
const testBuild = jest.mocked(testPurchasesEnabled);
const announce = jest.mocked(AccessibilityInfo.announceForAccessibility);
const statusBar = jest.mocked(setStatusBarStyle);
const hidden = { includeHiddenElements: true } as const;
const styleOf = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) ?? {};
/** A hex token as Reanimated's interpolateColor writes it. */
const rgba = (hex: string) => `rgba(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(", ")}, 1)`;
const ROWS = ["Your room becomes the case.", "The clues hide in your things.", "Up to 20 new cases a month."];
const BASE = { frame: { x: 0, y: 0, width: 393, height: 852 }, insets: { top: 59, bottom: 34, left: 0, right: 0 } };
const NO_BOTTOM = { frame: { x: 0, y: 0, width: 375, height: 667 }, insets: { top: 20, bottom: 0, left: 0, right: 0 } };
function renderIn(metrics: typeof BASE) {
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ProScreen />
    </SafeAreaProvider>,
  );
}

const access = (overrides: Partial<MyAccess> = {}): MyAccess => ({
  user_id: "u1", is_anonymous: false, tutorial_completed: true, has_custom_rooms_entitlement: false,
  entitlement_status: null, entitlement_expires_at: null, will_renew: null, can_generate: false,
  generations_used: 0, generations_cap: 20, min_photos_per_room: 3, max_photos_per_room: 6, ...overrides,
});

const session = (isAnonymous = false) =>
  ({ user: { is_anonymous: isAnonymous } }) as unknown as Awaited<ReturnType<typeof api.currentSession>>;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** The handlers the screen registered on the mocked native modules. */
function appStateHandler() {
  const calls = jest.mocked(AppState.addEventListener).mock.calls;
  return calls[calls.length - 1][1] as (state: string) => void;
}

beforeEach(() => {
  jest.clearAllMocks();
  params.mockReturnValue({ cap: "20" });
  testBuild.mockReturnValue(true);
  canGoBack.mockReturnValue(true);
  mockNavigation.canGoBack.mockReturnValue(false);
  mocked.ensureSession.mockResolvedValue({} as Awaited<ReturnType<typeof api.ensureSession>>);
  mocked.getMyAccess.mockResolvedValue(access());
  mocked.currentSession.mockResolvedValue(session());
  open.mockResolvedValue("capture");
});

describe("capFromParam", () => {
  it("reads a whole, non-negative cap and nothing else", () => {
    expect(capFromParam("20")).toBe(20);
    expect(capFromParam(["12", "3"])).toBe(12);
    for (const raw of [undefined, "", " ", "abc", "-1", "2.5"]) expect(capFromParam(raw)).toBeNull();
  });
});

describe("noticeFor", () => {
  it("maps each cause to its line from the Error table", () => {
    // Today's stub (no grant-test-entitlement on the server) reads as test purchases being off.
    expect(noticeFor(new TestPurchaseUnavailableError())).toEqual({ text: copy.SERVER_OFF, offline: false });
    expect(noticeFor(new Error("Network request failed"))).toEqual({ text: copy.OFFLINE, offline: true });
    expect(noticeFor(new TestPurchaseError("test_purchases_off"))).toEqual({ text: copy.SERVER_OFF, offline: false });
    for (const error of [new TestPurchaseError("unauthorized"), new TestPurchaseError("internal_error"), new Error("boom")]) {
      expect(noticeFor(error)).toEqual({ text: copy.COULD_NOT_UNLOCK, offline: false });
    }
  });
});

describe("Default (test build, opened with ?cap)", () => {
  it("renders the sheet on the first frame without a second access check", async () => {
    await render(<ProScreen />);
    expect(screen.getByRole("header", { name: copy.TITLE })).toBeTruthy();
    // Each benefit line is one screen-reader element.
    for (const row of ROWS) expect(screen.getByText(row)).toBeTruthy();
    // The test note is hidden from screen readers: its words are the pill's hint.
    expect(screen.queryByText(copy.TEST_NOTE)).toBeNull();
    expect(screen.getByText(copy.TEST_NOTE, hidden)).toBeTruthy();
    const unlock = screen.getByRole("button", { name: copy.UNLOCK });
    expect(unlock.props.accessibilityHint).toBe(copy.UNLOCK_HINT);
    expect(screen.getByRole("button", { name: copy.NOT_NOW }).props.accessibilityState).toMatchObject({ disabled: false });
    expect(screen.queryByRole("button", { name: copy.CHECK_AGAIN })).toBeNull();
    expect(mocked.getMyAccess).not.toHaveBeenCalled();
  });

  it("has no visible back control: the pill and not now are its only buttons", async () => {
    await render(<ProScreen />);
    expect(screen.getAllByRole("button").map((b) => b.props.accessibilityLabel)).toEqual([copy.UNLOCK, copy.NOT_NOW]);
  });

  it("keeps the title's last three words together", () => {
    expect(copy.TITLE).toBe("Open a file on your\u00a0own\u00a0room");
    expect(copy.benefitRows(1)[2]).toBe("Up to 1 new case a month.");
  });

  it("sets every line in sentence case, as screen readers hear it", async () => {
    await render(<ProScreen />);
    expect(styleOf(screen.getByRole("header", { name: copy.TITLE })).textTransform).toBe("none");
    for (const row of ROWS) expect(styleOf(screen.getByText(row)).textTransform).toBeUndefined();
    expect(styleOf(screen.getByText(copy.TEST_NOTE, hidden)).textTransform).toBeUndefined();
    for (const name of [copy.UNLOCK, copy.NOT_NOW]) {
      const button = screen.getByRole("button", { name });
      expect(within(button).getByText(name)).toBeTruthy();
    }
    expect(screen.getByText(copy.KICKER)).toBeTruthy();
  });

  it("is the app's dark sheet: the shell's ground, a raised panel, the display title and the grey body", async () => {
    await render(<ProScreen />);
    expect(styleOf(screen.getByTestId("pro-screen")).backgroundColor).toBe(ref.color.void);
    expect(styleOf(screen.getByTestId("pro-sheet"))).toMatchObject({
      backgroundColor: ref.color.ground,
      borderTopLeftRadius: ref.radius.bottomSheet,
      borderTopRightRadius: ref.radius.bottomSheet,
      overflow: "hidden",
    });
    expect(styleOf(screen.getByTestId("pro-panel", hidden))).toMatchObject({
      backgroundColor: ref.color.raised,
      height: ref.layout.pro.panelHeight,
    });
    expect(styleOf(screen.getByRole("header", { name: copy.TITLE }))).toMatchObject({ ...shellTheme.display, textTransform: "none", color: ref.color.textPrimary });
    expect(styleOf(screen.getByText(ROWS[0]))).toMatchObject({ ...ref.type.body, color: ref.color.textSecondary });
    expect(styleOf(screen.getByText(copy.TEST_NOTE, hidden))).toMatchObject({ ...ref.type.meta, color: ref.color.textSecondary });
    // The kit's 64 pt primary pill and the white quiet button on dark.
    expect(styleOf(screen.getByRole("button", { name: copy.UNLOCK })).minHeight).toBe(ref.button.primary.height);
    expect(styleOf(screen.getByText(copy.UNLOCK))).toMatchObject(ref.type.ctaLabel);
    const notNow = screen.getByRole("button", { name: copy.NOT_NOW });
    expect(styleOf(notNow)).toMatchObject({ minHeight: ref.button.quiet.height, paddingHorizontal: ref.button.quiet.padX, alignSelf: "center" });
    expect(styleOf(screen.getByText(copy.NOT_NOW))).toMatchObject({ ...ref.type.headline, color: rgba(ref.button.quiet.dark.label) });
    // No paper haze.
    expect(screen.queryByTestId("pro-haze", hidden)).toBeNull();
  });

  it("draws the case-file art in pushr's style, hidden from screen readers", async () => {
    await render(<ProScreen />);
    const panel = screen.getByTestId("pro-panel", hidden);
    expect(panel.props).toMatchObject({ accessible: false, importantForAccessibility: "no-hide-descendants", pointerEvents: "none" });
    expect(screen.queryByTestId("pro-art")).toBeNull();
    const art = screen.getByTestId("pro-art", hidden);
    // 03's phone: a solid frame in the ground, the open inside in the panel's raised fill on top, then the label.
    // react-native-svg hands its native views processed colours.
    const paint = (fill: unknown) => (fill as { payload?: unknown } | undefined)?.payload;
    const fills = art.queryAll((node) => typeof node.props.d === "string").map((node) => paint(node.props.fill));
    expect(fills).toContain(processColor(ref.color.void));
    expect(fills).toContain(processColor(ref.color.raised));
    const label = screen.getByTestId("pro-art-label", hidden);
    expect(label.props).toMatchObject({ width: ref.layout.pro.art.label.width, height: ref.layout.pro.art.label.height });
    expect(paint(label.props.fill)).toBe(processColor(ref.color.void));
  });

  it("caps the sheet ref.space.lg below the safe top and ends ctaBottom above the safe bottom", async () => {
    await renderIn(BASE);
    expect(styleOf(screen.getByTestId("pro-host")).paddingTop).toBe(BASE.insets.top + ref.space.lg);
    expect(styleOf(screen.getByTestId("pro-controls")).paddingBottom).toBe(BASE.insets.bottom + ref.space.ctaBottom);
  });

  it("keeps the last button ctaFloor + ctaBottom off the screen's edge when there is no bottom inset", async () => {
    await renderIn(NO_BOTTOM);
    expect(styleOf(screen.getByTestId("pro-controls")).paddingBottom).toBe(ref.space.ctaFloor + ref.space.ctaBottom);
  });

  it("lays out the pinned stack: note row, band, the pill, sm, not now", async () => {
    const { fontScale } = Dimensions.get("window");
    await render(<ProScreen />);
    expect(styleOf(screen.getByTestId("pro-lines")).marginTop).toBe(ref.layout.pro.titleGap);
    expect(styleOf(screen.getByTestId("pro-note-row")).minHeight).toBe(ref.type.meta.lineHeight * fontScale * ref.layout.pro.noteLines);
    expect(styleOf(screen.getByRole("button", { name: copy.UNLOCK })).marginTop).toBe(ref.space.band);
    expect(styleOf(screen.getByRole("button", { name: copy.NOT_NOW })).marginTop).toBe(ref.space.sm);
  });

  it("keeps the app's light status-bar glyphs (the sheet is dark)", async () => {
    await render(<ProScreen />);
    expect(statusBar).not.toHaveBeenCalledWith("dark");
  });

  it("moves screen-reader focus to the title when the screen opens", async () => {
    const focus = jest.mocked(AccessibilityInfo.sendAccessibilityEvent);
    await render(<ProScreen />);
    expect(focus).toHaveBeenCalledTimes(1);
    expect(focus.mock.calls[0][1]).toBe("focus");
  });

  it("waits for the opening transition before it moves focus", async () => {
    mockNavigation.canGoBack.mockReturnValue(true);
    const focus = jest.mocked(AccessibilityInfo.sendAccessibilityEvent);
    await render(<ProScreen />);
    expect(focus).not.toHaveBeenCalled();
    const listener = mockNavigation.addListener.mock.calls[0][1];
    await act(async () => listener({ data: { closing: false } }));
    expect(focus).toHaveBeenCalledTimes(1);
  });
});

describe("Purchasing", () => {
  it("shows the pill's busy state, then the stub's error in the test note's place, then returns to idle", async () => {
    const pending = deferred<void>();
    grant.mockImplementationOnce(() => pending.promise);
    await render(<ProScreen />);
    await userEvent.setup().press(screen.getByRole("button", { name: copy.UNLOCK }));

    const unlock = screen.getByRole("button", { name: copy.UNLOCK });
    expect(unlock.props.accessibilityState).toMatchObject({ busy: true, disabled: true });
    // The kit's busy pill: label kept, full opacity, the indicator in the label colour.
    expect(screen.getByTestId("pro-unlock-spinner", hidden).props.color).toBe(ref.button.primary.label);
    expect(within(unlock).getByText(copy.UNLOCK)).toBeTruthy();
    expect(styleOf(unlock).opacity).toBeUndefined();
    const notNow = screen.getByRole("button", { name: copy.NOT_NOW });
    expect(notNow.props.accessibilityState).toMatchObject({ disabled: true });
    expect(styleOf(notNow).opacity).toBe(ref.button.disabledOpacity.pill);

    await act(async () => pending.reject(new TestPurchaseUnavailableError()));
    expect(await screen.findByLabelText(copy.SERVER_OFF)).toBeTruthy();
    expect(screen.queryByText(copy.TEST_NOTE, hidden)).toBeNull();
    const idle = screen.getByRole("button", { name: copy.UNLOCK });
    expect(idle.props.accessibilityState).toMatchObject({ busy: false });
    expect(screen.queryByTestId("pro-unlock-spinner", hidden)).toBeNull();
    expect(screen.getByRole("button", { name: copy.NOT_NOW }).props.accessibilityState).toMatchObject({ disabled: false });
    expect(open).not.toHaveBeenCalled();
  });

  it("today fails at once with the stub, making no access call", async () => {
    await render(<ProScreen />);
    await userEvent.setup().press(screen.getByRole("button", { name: copy.UNLOCK }));
    expect(await screen.findByTestId("pro-notice")).toBeTruthy();
    // Only the Error table's one-line copy, never the stub's own message.
    expect(screen.getByLabelText(copy.SERVER_OFF)).toBeTruthy();
    expect(screen.queryByText(new TestPurchaseUnavailableError().message, hidden)).toBeNull();
    expect(mocked.getMyAccess).not.toHaveBeenCalled();
  });

  it("shows the error as one screen-reader element in an always-mounted polite live region, never a keyboard stop", async () => {
    await render(<ProScreen />);
    // The live region is mounted (empty) before any error: Android announces
    // only a change inside an existing live region.
    const region = screen.getByTestId("pro-error-region");
    expect(region.props).toMatchObject({ accessibilityLiveRegion: "polite", collapsable: false });
    expect(within(screen.getByTestId("pro-note-row")).getByTestId("pro-error-region")).toBeTruthy();
    await userEvent.setup().press(screen.getByRole("button", { name: copy.UNLOCK }));
    // `accessible` groups it for VoiceOver; on Android it would make the line
    // keyboard focusable, so TalkBack groups it through screenReaderFocusable.
    const line = await within(region).findByTestId("pro-notice");
    expect(line.props).toMatchObject({
      accessible: Platform.OS === "ios",
      screenReaderFocusable: true,
      accessibilityLabel: copy.SERVER_OFF,
      accessibilityLiveRegion: "none",
    });
  });

  it("clears the notice on a retry, and the test note returns", async () => {
    grant.mockRejectedValueOnce(new Error("Network request failed"));
    const pending = deferred<void>();
    grant.mockImplementationOnce(() => pending.promise);
    await render(<ProScreen />);
    const user = userEvent.setup();
    await user.press(screen.getByRole("button", { name: copy.UNLOCK }));
    expect(await screen.findByLabelText(copy.OFFLINE)).toBeTruthy();
    await user.press(screen.getByRole("button", { name: copy.UNLOCK }));
    expect(screen.queryByLabelText(copy.OFFLINE)).toBeNull();
    expect(screen.getByText(copy.TEST_NOTE, hidden)).toBeTruthy();
    await act(async () => pending.reject(new TestPurchaseError("test_purchases_off")));
    expect(await screen.findByLabelText(copy.SERVER_OFF)).toBeTruthy();
  });

  it("on success: haptic, announcement, then openCapture replacing /pro", async () => {
    grant.mockResolvedValueOnce();
    mocked.getMyAccess.mockResolvedValue(access({ has_custom_rooms_entitlement: true, can_generate: true }));
    await render(<ProScreen />);
    await userEvent.setup().press(screen.getByRole("button", { name: copy.UNLOCK }));
    await act(async () => {});
    expect(mockSuccess).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith(copy.SAY_UNLOCKED);
    expect(open).toHaveBeenCalledWith(expect.objectContaining({ replace: true }));
  });

  it("never continues without seeing the entitlement itself (loop guard)", async () => {
    grant.mockResolvedValueOnce();
    await render(<ProScreen />);
    await userEvent.setup().press(screen.getByRole("button", { name: copy.UNLOCK }));
    expect(await screen.findByLabelText(copy.COULD_NOT_UNLOCK)).toBeTruthy();
    expect(open).not.toHaveBeenCalled();
    expect(mockSuccess).not.toHaveBeenCalled();
  });

  it("routes a guest to /account without calling the function", async () => {
    mocked.currentSession.mockResolvedValue(session(true));
    await render(<ProScreen />);
    await userEvent.setup().press(screen.getByRole("button", { name: copy.UNLOCK }));
    await act(async () => {});
    expect(grant).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith({ pathname: "/account", params: { next: "back" } });
  });

  it("routes as Guest when the function answers account_required", async () => {
    grant.mockRejectedValueOnce(new TestPurchaseError("account_required"));
    await render(<ProScreen />);
    await userEvent.setup().press(screen.getByRole("button", { name: copy.UNLOCK }));
    await act(async () => {});
    expect(replace).toHaveBeenCalledWith({ pathname: "/account", params: { next: "back" } });
    expect(screen.queryByTestId("pro-notice")).toBeNull();
  });

  it("drops the continuation when the player leaves mid-purchase", async () => {
    const pending = deferred<void>();
    grant.mockImplementationOnce(() => pending.promise);
    mocked.getMyAccess.mockResolvedValue(access({ has_custom_rooms_entitlement: true }));
    const addBack = jest.spyOn(BackHandler, "addEventListener");
    await render(<ProScreen />);
    await userEvent.setup().press(screen.getByRole("button", { name: copy.UNLOCK }));
    // Android back stays live while Purchasing.
    const onBack = addBack.mock.calls.at(-1)?.[1];
    expect(onBack?.({ type: "hardwareBackPress", timeStamp: 0 })).toBe(true);
    expect(back).toHaveBeenCalledTimes(1);
    await act(async () => pending.resolve());
    expect(open).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    addBack.mockRestore();
  });
});

describe("Test purchases off", () => {
  beforeEach(() => testBuild.mockReturnValue(false));

  it("says Pro isn't on sale yet and offers check again", async () => {
    const { fontScale } = Dimensions.get("window");
    await render(<ProScreen />);
    expect(screen.getByLabelText(copy.NOT_ON_SALE)).toBeTruthy();
    // Information, not an error: no glyph, live region or announcement, and
    // never a keyboard stop (so keyboard focus is check again, then not now).
    expect(screen.getByTestId("pro-info").props).toMatchObject({
      accessible: Platform.OS === "ios",
      screenReaderFocusable: true,
      accessibilityLabel: copy.NOT_ON_SALE,
      accessibilityLiveRegion: "none",
    });
    expect(announce).not.toHaveBeenCalled();
    // The row reserves the info's two lines, so a one-line error moves nothing.
    expect(styleOf(screen.getByTestId("pro-note-row")).minHeight).toBe(ref.type.meta.lineHeight * fontScale * ref.layout.pro.infoLines);
    expect(styleOf(screen.getByText(copy.NOT_ON_SALE))).toMatchObject({ ...ref.type.meta, color: ref.color.textSecondary });
    expect(screen.queryByTestId("pro-info-icon", hidden)).toBeNull();
    expect(screen.getByRole("button", { name: copy.CHECK_AGAIN })).toBeTruthy();
    expect(screen.queryByRole("button", { name: copy.UNLOCK })).toBeNull();
    expect(screen.queryByText(copy.TEST_NOTE, hidden)).toBeNull();
  });

  it("stays and announces when the account still has no access", async () => {
    const pending = deferred<MyAccess>();
    mocked.getMyAccess.mockImplementationOnce(() => pending.promise);
    await render(<ProScreen />);
    await userEvent.setup().press(screen.getByRole("button", { name: copy.CHECK_AGAIN }));
    const checking = screen.getByRole("button", { name: copy.CHECK_AGAIN });
    expect(checking.props.accessibilityState).toMatchObject({ busy: true });
    expect(screen.getByTestId("pro-check-again-spinner", hidden).props.color).toBe(ref.button.primary.label);
    expect(screen.getByRole("button", { name: copy.NOT_NOW }).props.accessibilityState).toMatchObject({ disabled: true });
    await act(async () => pending.resolve(access({ generations_cap: 12 })));
    expect(announce).toHaveBeenCalledWith(copy.SAY_NO_ACCESS);
    expect(screen.getByText("Up to 12 new cases a month.")).toBeTruthy();
    expect(screen.getByRole("button", { name: copy.NOT_NOW }).props.accessibilityState).toMatchObject({ disabled: false });
    expect(open).not.toHaveBeenCalled();
  });

  it("continues through openCapture once access has been granted", async () => {
    mocked.getMyAccess.mockResolvedValue(access({ has_custom_rooms_entitlement: true, can_generate: true }));
    await render(<ProScreen />);
    await userEvent.setup().press(screen.getByRole("button", { name: copy.CHECK_AGAIN }));
    await act(async () => {});
    expect(open).toHaveBeenCalledWith(expect.objectContaining({ replace: true }));
    expect(mockSuccess).not.toHaveBeenCalled();
  });

  it("puts a failed check's error in the info line's place, and the info returns on the next check", async () => {
    mocked.getMyAccess.mockRejectedValueOnce(new Error("Network request failed"));
    const pending = deferred<MyAccess>();
    mocked.getMyAccess.mockImplementationOnce(() => pending.promise);
    await render(<ProScreen />);
    const user = userEvent.setup();
    // An always-mounted polite live region that holds only the error.
    const region = screen.getByTestId("pro-error-region");
    expect(region.props).toMatchObject({ accessibilityLiveRegion: "polite", collapsable: false });
    expect(within(region).queryByTestId("pro-info")).toBeNull();
    await user.press(screen.getByRole("button", { name: copy.CHECK_AGAIN }));
    expect(await screen.findByLabelText(copy.OFFLINE)).toBeTruthy();
    expect(screen.queryByLabelText(copy.NOT_ON_SALE)).toBeNull();
    expect(within(region).getByTestId("pro-notice")).toBeTruthy();
    await user.press(screen.getByRole("button", { name: copy.CHECK_AGAIN }));
    // The info returns outside the live region, so it isn't re-announced.
    expect(screen.getByLabelText(copy.NOT_ON_SALE)).toBeTruthy();
    expect(within(region).queryByTestId("pro-info")).toBeNull();
    expect(within(region).queryByTestId("pro-notice")).toBeNull();
    await act(async () => pending.resolve(access()));
  });
});

// On Android `accessible` sets isFocusable, which would make the line a
// keyboard and D-pad stop; screenReaderFocusable keeps it one TalkBack element.
describe.each([
  { os: "ios", accessible: true },
  { os: "android", accessible: false },
] as const)("Notice line on $os", ({ os, accessible }) => {
  let platform: jest.ReplaceProperty<typeof Platform.OS> | undefined;
  beforeEach(() => {
    platform = jest.replaceProperty(Platform, "OS", os);
  });
  afterEach(() => platform?.restore());

  it("the error line is one screen-reader element, never a keyboard stop, and is announced", async () => {
    await render(<ProNoticeLine kind="error" text={copy.OFFLINE} icon={WifiSlashIcon} testID="line" />);
    expect(screen.getByTestId("line").props).toMatchObject({
      accessible,
      screenReaderFocusable: true,
      accessibilityLabel: copy.OFFLINE,
      // Not itself a live region: it mounts with its text, which Android never speaks.
      accessibilityLiveRegion: "none",
    });
    // iOS has no live regions, so it announces; Android speaks through the region.
    expect(announce.mock.calls).toEqual(os === "ios" ? [[copy.OFFLINE]] : []);
  });

  it("the info line has no live region and is never announced", async () => {
    await render(<ProNoticeLine kind="info" text={copy.NOT_ON_SALE} testID="line" />);
    expect(screen.getByTestId("line").props).toMatchObject({
      accessible,
      screenReaderFocusable: true,
      accessibilityLabel: copy.NOT_ON_SALE,
      accessibilityLiveRegion: "none",
    });
    expect(announce).not.toHaveBeenCalled();
  });
});

describe("Notice look", () => {
  it("draws the error glyph in the sheet's ink (03's notice: no colour accent), with the text in 03's small grey", async () => {
    const { fontScale } = Dimensions.get("window");
    await render(<ProNoticeLine kind="error" text={copy.OFFLINE} icon={WifiSlashIcon} testID="line" />);
    expect(styleOf(screen.getByText(copy.OFFLINE))).toMatchObject({ ...ref.type.meta, color: ref.color.textSecondary });
    // The glyph box is one meta line tall, so the glyph centres on the first line.
    expect(styleOf(screen.getByTestId("line-icon", hidden)).height).toBe(ref.type.meta.lineHeight * fontScale);
    const glyph = screen.getByTestId("phosphor-react-native-wifi-slash-regular", hidden);
    expect(glyph.props).toMatchObject({
      width: ref.layout.pro.noticeIcon,
      height: ref.layout.pro.noticeIcon,
      color: ref.color.textPrimary,
    });
  });
});

describe("Large text", () => {
  // The title-and-lines frame. With flexGrow 1 its content is exactly the
  // frame's height while it fits, and taller once text outgrows it.
  const FRAME = { x: 0, y: 0, width: 393, height: 186 };
  const fits = FRAME.height;
  const overflows = FRAME.height + ref.type.body.lineHeight;

  it("scrolls the title and lines only while they overflow, so a block that fits is never a keyboard stop", async () => {
    await render(<ProScreen />);
    const scroll = () => screen.getByTestId("pro-scroll");
    expect(scroll().props.scrollEnabled).toBe(false);
    await fireEvent.layout(scroll(), FRAME);
    await fireEvent(scroll(), "contentSizeChange", FRAME.width, fits);
    expect(scroll().props.scrollEnabled).toBe(false);
    await fireEvent(scroll(), "contentSizeChange", FRAME.width, overflows);
    expect(scroll().props.scrollEnabled).toBe(true);
    await fireEvent(scroll(), "contentSizeChange", FRAME.width, fits);
    expect(scroll().props.scrollEnabled).toBe(false);
  });

  it("keeps the note row, pill and not now pinned outside the scroll", async () => {
    await render(<ProScreen />);
    const scroll = screen.getByTestId("pro-scroll");
    expect(within(scroll).queryByRole("button")).toBeNull();
    expect(within(scroll).queryByTestId("pro-note-row")).toBeNull();
    expect(within(scroll).getByRole("header", { name: copy.TITLE })).toBeTruthy();
  });

  it("drops the art panel before it lets the text scroll (as 03)", async () => {
    await renderIn(BASE);
    const cap = BASE.insets.top + ref.space.lg;
    const host = { x: 0, y: 0, width: 393, height: 852 };
    const controls = { x: 0, y: 0, width: 393, height: 200 };
    await fireEvent.layout(screen.getByTestId("pro-host"), host);
    await fireEvent.layout(screen.getByTestId("pro-controls"), controls);
    // Room for the panel: it stays.
    const room = host.height - cap - controls.height;
    // The text block at a height, laid out in full (it fits its frame).
    const textAt = async (height: number) => {
      await fireEvent.layout(screen.getByTestId("pro-scroll"), { ...host, height });
      await fireEvent(screen.getByTestId("pro-scroll"), "contentSizeChange", host.width, height);
    };
    await textAt(room - ref.layout.pro.panelHeight);
    expect(screen.getByTestId("pro-panel", hidden)).toBeTruthy();
    // Larger text: the panel goes first, and the text still fits, so it doesn't scroll.
    await textAt(room - ref.layout.pro.panelHeight + 1);
    expect(screen.queryByTestId("pro-panel", hidden)).toBeNull();
    expect(screen.getByTestId("pro-scroll").props.scrollEnabled).toBe(false);
  });
});

describe("Loading (opened without ?cap)", () => {
  beforeEach(() => params.mockReturnValue({}));
  afterEach(() => jest.useRealTimers());

  it("shows the dark ground, the indicator only past its delay, then the sheet with the cap", async () => {
    jest.useFakeTimers();
    const pending = deferred<MyAccess>();
    mocked.getMyAccess.mockImplementationOnce(() => pending.promise);
    await render(<ProScreen />);
    expect(styleOf(screen.getByTestId("pro-loading")).backgroundColor).toBe(ref.color.void);
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.queryByTestId("pro-spinner", hidden)).toBeNull();
    // Nothing of Default yet: no sheet, title or buttons.
    expect(screen.queryByTestId("pro-sheet")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    await act(async () => jest.advanceTimersByTime(ref.layout.pro.spinnerDelay));
    // One screen-reader element, never a keyboard stop; a small native indicator in the muted ink.
    const indicator = screen.getByRole("progressbar", { name: copy.LOADING });
    expect(indicator.props).toMatchObject({ accessible: Platform.OS === "ios", screenReaderFocusable: true, focusable: false });
    expect(within(indicator).getByTestId("pro-spinner-indicator", hidden).props).toMatchObject({ size: "small", color: ref.color.textSecondary });
    await act(async () => pending.resolve(access({ generations_cap: 15 })));
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.getByText("Up to 15 new cases a month.")).toBeTruthy();
  });

  it("raises the sheet from below; under reduced motion it only fades in", async () => {
    jest.useFakeTimers();
    const { height } = Dimensions.get("window");
    const translateOf = () => (styleOf(screen.getByTestId("pro-sheet")).transform as { translateY: number }[] | undefined)?.[0]?.translateY;
    await render(<ProScreen />);
    await act(async () => {});
    expect(translateOf()).toBe(height);
    await screen.unmount();

    await render(
      <ThemeProvider reducedMotion>
        <ProScreen />
      </ThemeProvider>,
    );
    await act(async () => {});
    expect(translateOf()).toBe(0);
    expect(styleOf(screen.getByTestId("pro-sheet")).opacity).toBe(0);
  });

  it("falls back to the allowance line when the check fails", async () => {
    mocked.getMyAccess.mockRejectedValueOnce(new Error("Network request failed"));
    await render(<ProScreen />);
    expect(await screen.findByText("A monthly allowance of new cases.")).toBeTruthy();
    expect(screen.queryByTestId("pro-notice")).toBeNull();
  });

  it("routes a guest to /account", async () => {
    mocked.getMyAccess.mockResolvedValueOnce(access({ is_anonymous: true }));
    await render(<ProScreen />);
    await act(async () => {});
    expect(replace).toHaveBeenCalledWith({ pathname: "/account", params: { next: "back" } });
  });

  it("skips straight through when the account already has access, with no haptic or announcement", async () => {
    mocked.getMyAccess.mockResolvedValueOnce(access({ has_custom_rooms_entitlement: true, can_generate: true }));
    await render(<ProScreen />);
    await act(async () => {});
    expect(open).toHaveBeenCalledWith(expect.objectContaining({ replace: true }));
    expect(mockSuccess).not.toHaveBeenCalled();
    expect(announce).not.toHaveBeenCalled();
    expect(screen.getByTestId("pro-loading")).toBeTruthy();
  });

  it("continues to the camera when openCapture's own check can't run", async () => {
    mocked.getMyAccess.mockResolvedValueOnce(access({ has_custom_rooms_entitlement: true, can_generate: true }));
    open.mockRejectedValueOnce(new Error("Network request failed"));
    await render(<ProScreen />);
    await act(async () => {});
    expect(replace).toHaveBeenCalledWith("/capture");
  });
});

describe("Leaving and the foreground re-check", () => {
  it("not now goes back, or to the hub when there is no history", async () => {
    await render(<ProScreen />);
    const user = userEvent.setup();
    await user.press(screen.getByRole("button", { name: copy.NOT_NOW }));
    expect(back).toHaveBeenCalledTimes(1);
    await screen.unmount();

    canGoBack.mockReturnValue(false);
    await render(<ProScreen />);
    await user.press(screen.getByRole("button", { name: copy.NOT_NOW }));
    expect(replace).toHaveBeenCalledWith("/");
  });

  it("VoiceOver's escape gesture leaves like not now", async () => {
    await render(<ProScreen />);
    await fireEvent(screen.getByTestId("pro-screen"), "accessibilityEscape");
    expect(back).toHaveBeenCalledTimes(1);
  });

  it("Android back leaves like not now", async () => {
    const addBack = jest.spyOn(BackHandler, "addEventListener");
    await render(<ProScreen />);
    const onBack = addBack.mock.calls.at(-1)?.[1];
    expect(onBack?.({ type: "hardwareBackPress", timeStamp: 0 })).toBe(true);
    expect(back).toHaveBeenCalledTimes(1);
    addBack.mockRestore();
  });

  it("skips through when the app comes back with access granted meanwhile", async () => {
    await render(<ProScreen />);
    mocked.getMyAccess.mockResolvedValueOnce(access({ has_custom_rooms_entitlement: true, can_generate: true }));
    await act(async () => appStateHandler()("active"));
    expect(open).toHaveBeenCalledWith(expect.objectContaining({ replace: true }));
    expect(announce).not.toHaveBeenCalled();
  });

  it("stays quietly when the foreground re-check finds no access or fails", async () => {
    await render(<ProScreen />);
    mocked.getMyAccess.mockRejectedValueOnce(new Error("Network request failed"));
    await act(async () => appStateHandler()("active"));
    expect(open).not.toHaveBeenCalled();
    expect(screen.queryByTestId("pro-notice")).toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });
});

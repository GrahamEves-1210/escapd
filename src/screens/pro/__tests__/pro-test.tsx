import { AccessibilityInfo, AppState, BackHandler, Dimensions, Platform, StyleSheet } from "react-native";
import { act, fireEvent, render, screen, userEvent, within } from "@testing-library/react-native";
import { router, useLocalSearchParams } from "expo-router";
import { openCapture } from "@/capture/openCapture";
import { grantTestEntitlement, testPurchasesEnabled, TestPurchaseError, TestPurchaseUnavailableError } from "@/capture/testPurchase";
import { WifiSlashIcon } from "@/components/icons";
import * as api from "@/lib/escapd-api";
import type { MyAccess } from "@/lib/puzzle-types";
import { ref } from "@/theme/tokens";
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
  useFeedback: () => ({ success: mockSuccess, tap: jest.fn(), warning: jest.fn() }),
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
const hidden = { includeHiddenElements: true } as const;
const styleOf = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) ?? {};

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
  it("renders the cover sheet on the first frame without a second access check", async () => {
    await render(<ProScreen />);
    expect(screen.getByLabelText(copy.FILE_LABEL_A11Y)).toBeTruthy();
    expect(screen.getByRole("header", { name: copy.STATEMENT })).toBeTruthy();
    for (const row of ["Your room becomes the case.", "The clues hide in your things.", "Up to 20 new cases a month."]) {
      expect(screen.getByLabelText(row)).toBeTruthy();
    }
    // The numerals and the TEST PURCHASE note are hidden from screen readers.
    expect(screen.queryByText("01")).toBeNull();
    expect(screen.getByText("01", hidden)).toBeTruthy();
    expect(screen.queryByText(copy.TEST_NOTE)).toBeNull();
    expect(screen.getByText(copy.TEST_NOTE, hidden)).toBeTruthy();
    const unlock = screen.getByRole("button", { name: copy.UNLOCK });
    expect(unlock.props.accessibilityHint).toBe(copy.UNLOCK_HINT);
    expect(screen.getByRole("button", { name: copy.NOT_NOW }).props.accessibilityState).toMatchObject({ disabled: false });
    expect(screen.queryByRole("button", { name: copy.CHECK_AGAIN })).toBeNull();
    expect(mocked.getMyAccess).not.toHaveBeenCalled();
  });

  it("keeps the statement's last two words together", () => {
    expect(copy.STATEMENT).toBe("Open a file on your own room.");
  });

  it("reserves one meta line for the notice, so nothing moves when one appears", async () => {
    const { fontScale } = Dimensions.get("window");
    await render(<ProScreen />);
    expect(styleOf(screen.getByTestId("pro-notice-slot")).minHeight).toBe(ref.type.meta.lineHeight * fontScale);
    // The pinned stack under it: 8, the note, 12, the pill, 8, the quiet button.
    expect(styleOf(screen.getByText(copy.TEST_NOTE, hidden)).marginTop).toBe(ref.space.sm);
    expect(styleOf(screen.getByRole("button", { name: copy.UNLOCK })).marginTop).toBe(ref.space.md);
    expect(styleOf(screen.getByRole("button", { name: copy.NOT_NOW })).marginTop).toBe(ref.space.sm);
  });

  it("keeps Not now 44 tall with no fixed padding, so with larger text the pill's bottom stays put", async () => {
    await render(<ProScreen />);
    expect(styleOf(screen.getByRole("button", { name: copy.NOT_NOW }))).toMatchObject({
      minHeight: ref.button.quiet.height,
      paddingVertical: 0,
      justifyContent: "center",
    });
  });

  it("moves screen-reader focus to the statement when the screen opens", async () => {
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
  it("shows the in-button state, then the stub's error, then returns to idle", async () => {
    const pending = deferred<void>();
    grant.mockImplementationOnce(() => pending.promise);
    await render(<ProScreen />);
    await userEvent.setup().press(screen.getByRole("button", { name: copy.UNLOCK }));

    const unlock = screen.getByRole("button", { name: copy.UNLOCK });
    expect(unlock.props.accessibilityState).toMatchObject({ busy: true, disabled: true });
    expect(screen.getByTestId("pro-unlock-spinner", hidden)).toBeTruthy();
    expect(screen.getByRole("button", { name: copy.NOT_NOW }).props.accessibilityState).toMatchObject({ disabled: true });

    await act(async () => pending.reject(new TestPurchaseUnavailableError()));
    expect(await screen.findByLabelText(copy.SERVER_OFF)).toBeTruthy();
    expect(screen.getByRole("button", { name: copy.UNLOCK }).props.accessibilityState).toMatchObject({ busy: false });
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

  it("shows the error as one screen-reader element in a polite live region, never a keyboard stop", async () => {
    await render(<ProScreen />);
    // The live region is the reserved slot, mounted (empty) before any error:
    // Android announces only a change inside an existing live region.
    const slot = screen.getByTestId("pro-notice-slot");
    expect(slot.props).toMatchObject({ accessibilityLiveRegion: "polite", collapsable: false });
    await userEvent.setup().press(screen.getByRole("button", { name: copy.UNLOCK }));
    // `accessible` groups it for VoiceOver; on Android it would make the line
    // keyboard focusable, so TalkBack groups it through screenReaderFocusable.
    const line = await within(slot).findByTestId("pro-notice");
    expect(line.props).toMatchObject({
      accessible: Platform.OS === "ios",
      screenReaderFocusable: true,
      accessibilityLabel: copy.SERVER_OFF,
      accessibilityLiveRegion: "none",
    });
  });

  it("clears the notice on a retry", async () => {
    grant.mockRejectedValueOnce(new Error("Network request failed"));
    const pending = deferred<void>();
    grant.mockImplementationOnce(() => pending.promise);
    await render(<ProScreen />);
    const user = userEvent.setup();
    await user.press(screen.getByRole("button", { name: copy.UNLOCK }));
    expect(await screen.findByLabelText(copy.OFFLINE)).toBeTruthy();
    await user.press(screen.getByRole("button", { name: copy.UNLOCK }));
    expect(screen.queryByLabelText(copy.OFFLINE)).toBeNull();
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

  it("says Pro isn't on sale yet and offers Check again, with no signal", async () => {
    const { fontScale } = Dimensions.get("window");
    await render(<ProScreen />);
    expect(screen.getByLabelText(copy.NOT_ON_SALE)).toBeTruthy();
    // Information, not an error: no icon, live region or announcement, and
    // never a keyboard stop (so keyboard focus is Check again, then Not now).
    expect(screen.getByTestId("pro-info").props).toMatchObject({
      accessible: Platform.OS === "ios",
      screenReaderFocusable: true,
      accessibilityLabel: copy.NOT_ON_SALE,
      accessibilityLiveRegion: "none",
    });
    expect(announce).not.toHaveBeenCalled();
    // The notice and test-note slots together, so nothing above moves.
    expect(styleOf(screen.getByTestId("pro-info-slot")).minHeight).toBe(
      ref.type.meta.lineHeight * fontScale + ref.space.sm + ref.type.note.lineHeight * fontScale,
    );
    expect(screen.getByRole("button", { name: copy.CHECK_AGAIN })).toBeTruthy();
    expect(screen.queryByRole("button", { name: copy.UNLOCK })).toBeNull();
    expect(screen.queryByText(copy.TEST_NOTE, hidden)).toBeNull();
  });

  it("stays and announces when the account still has no access", async () => {
    const pending = deferred<MyAccess>();
    mocked.getMyAccess.mockImplementationOnce(() => pending.promise);
    await render(<ProScreen />);
    await userEvent.setup().press(screen.getByRole("button", { name: copy.CHECK_AGAIN }));
    expect(screen.getByRole("button", { name: copy.CHECK_AGAIN }).props.accessibilityState).toMatchObject({ busy: true });
    expect(screen.getByTestId("pro-check-again-spinner", hidden)).toBeTruthy();
    expect(screen.getByRole("button", { name: copy.NOT_NOW }).props.accessibilityState).toMatchObject({ disabled: true });
    await act(async () => pending.resolve(access({ generations_cap: 12 })));
    expect(announce).toHaveBeenCalledWith(copy.SAY_NO_ACCESS);
    expect(screen.getByLabelText("Up to 12 new cases a month.")).toBeTruthy();
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
    // iOS has no live regions, so it announces; Android speaks through the slot's live region.
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

describe("Large text", () => {
  // The block's frame on 393 x 852 (y 125-622). With flexGrow 1 its content is
  // exactly the frame's height while it fits, and taller once text outgrows it.
  const FRAME = { x: 0, y: 0, width: 393, height: 497 };
  const fits = FRAME.height;
  const overflows = FRAME.height + ref.type.body.lineHeight;

  it("scrolls the statement and index only while they overflow, so a block that fits is never a keyboard stop", async () => {
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
});

describe("Loading (opened without ?cap)", () => {
  beforeEach(() => params.mockReturnValue({}));
  afterEach(() => jest.useRealTimers());

  it("shows flat ground, the dither only past its delay, then fades in Default with the cap", async () => {
    jest.useFakeTimers();
    const pending = deferred<MyAccess>();
    mocked.getMyAccess.mockImplementationOnce(() => pending.promise);
    await render(<ProScreen />);
    expect(screen.getByTestId("pro-loading")).toBeTruthy();
    expect(screen.queryByRole("progressbar")).toBeNull();
    await act(async () => jest.advanceTimersByTime(ref.layout.pro.ditherDelay));
    expect(screen.getByRole("progressbar", { name: "Loading" })).toBeTruthy();
    await act(async () => pending.resolve(access({ generations_cap: 15 })));
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.getByLabelText("Up to 15 new cases a month.")).toBeTruthy();
  });

  it("falls back to the allowance line when the check fails", async () => {
    mocked.getMyAccess.mockRejectedValueOnce(new Error("Network request failed"));
    await render(<ProScreen />);
    expect(await screen.findByLabelText("A monthly allowance of new cases.")).toBeTruthy();
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
  it("Not now goes back, or to the hub when there is no history", async () => {
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

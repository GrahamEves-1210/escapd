/// <reference types="node" />
import fs from "fs";
import path from "path";
import ts from "typescript";
import { AccessibilityInfo, BackHandler, Dimensions, StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native";
import { router } from "expo-router";
import { openCapture } from "@/capture/openCapture";
import * as api from "@/lib/escapd-api";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { ref } from "@/theme/tokens";
import { HubScreen } from "../HubScreen";
import { TAG_TOP } from "../layout";

jest.mock("expo-router", () => {
  const { useEffect } = jest.requireActual("react");
  return {
    router: { push: jest.fn(), replace: jest.fn() },
    // Focused for the whole test: runs on mount and whenever the callback changes.
    useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]),
  };
});

jest.mock("@/lib/escapd-api", () => ({
  isNetworkError: (e: unknown) => /network request failed/i.test(e instanceof Error ? e.message : ""),
  currentSession: jest.fn(),
  ensureSession: jest.fn(),
  getLatestSession: jest.fn(),
  getLatestCustomRoom: jest.fn(),
  getRoom: jest.fn(),
  watchRoom: jest.fn(),
}));
jest.mock("@/capture/openCapture", () => ({ openCapture: jest.fn() }));
jest.mock("expo-constants", () => ({ __esModule: true, default: { expoConfig: { version: "0.1.0" } } }));
jest.mock("@/capture/useDevelopment", () => ({ POLL_MS: 5000 }));
jest.mock("@/tutorial/assets", () => ({ TUTORIAL_ROOM_ID: "tutorial-room" }));

const mockPreferences = {
  hotspotAssist: false,
  setHotspotAssist: jest.fn(),
  haptics_enabled: true,
  reduced_motion: false,
  update: jest.fn(async (_patch: Record<string, boolean>) => {}),
};
jest.mock("@/game/preferences", () => ({ usePreferences: () => ({ ...mockPreferences }) }));
// The full feedback vocabulary (a partial mock would crash a kit control that presses).
const mockFeedback = { tick: jest.fn(), tap: jest.fn(), press: jest.fn(), thud: jest.fn(), success: jest.fn(), warning: jest.fn(), error: jest.fn() };
jest.mock("@/game/feedback", () => ({ useFeedback: () => mockFeedback }));
const mocked = api as jest.Mocked<typeof api>;
const push = jest.mocked(router.push);
const capture = jest.mocked(openCapture);
const hidden = { includeHiddenElements: true } as const;
const ROOT = path.join(__dirname, "../../../..");
const H = ref.layout.hub;

type Room = NonNullable<Awaited<ReturnType<typeof api.getLatestCustomRoom>>>;
type Session = NonNullable<Awaited<ReturnType<typeof api.getLatestSession>>>;
const room = (id: string, status: Room["status"]) => ({ id, status }) as Room;
const session = (status: Session["status"]) => ({ status }) as Session;

function setWindow(width: number, height: number, fontScale: number) {
  const metrics = { width, height, scale: 3, fontScale };
  Dimensions.set({ window: metrics, screen: metrics });
}

async function renderHub({ reducedMotion = false } = {}) {
  await render(
    <GestureHandlerRootView style={StyleSheet.absoluteFill}>
      <ThemeProvider reducedMotion={reducedMotion}>
        <HubScreen />
      </ThemeProvider>
    </GestureHandlerRootView>,
  );
  // Let the focus fetch settle.
  await act(async () => {});
}

/** A signed-in player with a tutorial session and an own room. */
function player({ tutorial = null, own = null, ownSession = null }: { tutorial?: Session | null; own?: Room | null; ownSession?: Session | null }) {
  mocked.currentSession.mockResolvedValue({} as Awaited<ReturnType<typeof api.currentSession>>);
  mocked.getLatestSession.mockImplementation(async (roomId: string) => (roomId === "tutorial-room" ? tutorial : ownSession));
  mocked.getLatestCustomRoom.mockResolvedValue(own);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPreferences.hotspotAssist = false;
  mockPreferences.haptics_enabled = true;
  mockPreferences.reduced_motion = false;
  mockPreferences.update.mockImplementation(async () => {});
  mocked.ensureSession.mockResolvedValue({} as never);
  mocked.watchRoom.mockReturnValue(() => Promise.resolve("ok"));
  mocked.currentSession.mockResolvedValue(null);
  setWindow(393, 852, 1);
});

const card = (name: string) => screen.getByRole("button", { name });
const styleOf = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) ?? {};
/** Every drawn focus ring: the kit's 2 pt ring in ref.focus.color (brass), wherever it is composed. */
const focusRings = () =>
  screen.container.queryAll((node) => {
    const style = styleOf(node);
    return node.type === "View" && style.borderColor === ref.focus.color && style.borderWidth === ref.focus.width;
  });

describe("01 · Game mode", () => {
  it("renders the header, heading and three cards in reading order, with YOUR CASE loading until its fetch resolves", async () => {
    let resolveSession: (value: null) => void = () => {};
    mocked.currentSession.mockReturnValue(new Promise((resolve) => (resolveSession = resolve)));
    await render(
      <GestureHandlerRootView style={StyleSheet.absoluteFill}>
        <ThemeProvider>
          <HubScreen />
        </ThemeProvider>
      </GestureHandlerRootView>,
    );

    // The header's title is the ESCAPD wordmark, white with a grey doorway edge (no brass), read as a header.
    // No magnifier and no "Case files"; Opal's left chip and X disc are left out (the hub is the root).
    const logo = screen.getByRole("header", { name: "ESCAPD" });
    expect(logo.props.testID).toBe("hub-logo");
    expect(screen.queryByText("Case files")).toBeNull();
    expect(styleOf(screen.getByRole("header", { name: "Choose a case" }))).toMatchObject({ ...ref.type.title, color: ref.color.textPrimary });
    expect(styleOf(screen.getByText("Three files on the desk."))).toMatchObject({ ...ref.type.subtitle, color: ref.color.textSecondaryAlpha });
    expect(screen.getAllByRole("button").map((b) => b.props.accessibilityLabel)).toEqual([
      "Settings",
      "The Study. Unseal the first case.",
      "Your room. Photograph a room.",
      "Your case. Loading.",
    ]);
    // Loading: not dimmed, taps ignored, busy for screen readers.
    const loading = card("Your case. Loading.");
    expect(loading.props.accessibilityState).toMatchObject({ busy: true, disabled: true });

    await act(async () => resolveSession(null));
    // No session: straight to None yet, never creating a guest to label a card.
    const none = card("Your case. None yet.");
    expect(none.props.accessibilityState).toMatchObject({ disabled: true });
    expect(none.props.accessibilityHint).toBe("Photograph a room first.");
    expect(screen.getByText("None yet", hidden)).toBeTruthy();
    expect(mocked.getLatestCustomRoom).not.toHaveBeenCalled();
    expect(mocked.ensureSession).not.toHaveBeenCalled();
  });

  it("shows Replay and the SOLVED pill for a solved own case, and plays it", async () => {
    player({ tutorial: session("completed"), own: room("r1", "ready"), ownSession: session("completed") });
    await renderHub();
    expect(card("The Study. Replay the first case.")).toBeTruthy();
    // A label pill in the reference style (rim hairline, radius 8, white 82 % caps), never an oxblood stamp.
    const solved = screen.getByText("SOLVED", hidden);
    expect(styleOf(solved)).toMatchObject({ ...ref.type.tag, color: ref.color.textLabel });
    expect(styleOf(solved.parent!)).toMatchObject({ borderColor: ref.color.rim, borderRadius: ref.radius.tag, borderWidth: H.hairline });
    // A real press: the press haptic (a light impact) fires on press-in.
    await userEvent.setup().press(card("Your case. Solved. Replay the case."));
    expect(push).toHaveBeenCalledWith({ pathname: "/play/[roomId]", params: { roomId: "r1" } });
    expect(mockFeedback.press).toHaveBeenCalledTimes(1);
    expect(mockFeedback.tap).not.toHaveBeenCalled();
  });

  it("maps the case states: Continue, Open after an abandoned run, See why, and a draft as none", async () => {
    player({ tutorial: session("active"), own: room("r1", "ready"), ownSession: session("active") });
    await renderHub();
    expect(card("The Study. Continue the first case.")).toBeTruthy();
    expect(card("Your case. Continue the case.")).toBeTruthy();
    expect(screen.queryByText("SOLVED", hidden)).toBeNull();
    await screen.unmount();

    player({ tutorial: session("abandoned"), own: room("r1", "ready"), ownSession: session("abandoned") });
    await renderHub();
    expect(card("The Study. Unseal the first case.")).toBeTruthy();
    expect(card("Your case. Open the case.")).toBeTruthy();
    await screen.unmount();

    player({ own: room("r3", "failed") });
    await renderHub();
    await fireEvent.press(card("Your case. It didn't build. See why."));
    expect(push).toHaveBeenCalledWith({ pathname: "/capture/develop", params: { roomId: "r3" } });
    await screen.unmount();

    player({ own: room("d1", "draft") });
    await renderHub();
    expect(card("Your case. None yet.")).toBeTruthy();
  });

  it("shows Offline or Try later when the fetch fails, keeping THE STUDY and YOUR ROOM enabled", async () => {
    player({});
    mocked.getLatestCustomRoom.mockRejectedValue(new Error("Network request failed"));
    await renderHub();
    expect(card("Your case. Offline.").props.accessibilityState).toMatchObject({ disabled: true });
    expect(card("The Study. Unseal the first case.").props.accessibilityState).toMatchObject({ disabled: false });
    expect(card("Your room. Photograph a room.").props.accessibilityState).toMatchObject({ disabled: false });
    await screen.unmount();

    mocked.getLatestCustomRoom.mockRejectedValue(new Error("permission denied"));
    await renderHub();
    expect(card("Your case. Try later.")).toBeTruthy();
  });

  it("THE STUDY goes busy, then opens /tutorial", async () => {
    let finish: () => void = () => {};
    mocked.ensureSession.mockReturnValue(new Promise((resolve) => (finish = () => resolve({} as never))));
    await renderHub();
    await fireEvent.press(card("The Study. Unseal the first case."));

    // Busy: this card keeps full strength and ignores taps; the rest are disabled.
    expect(card("The Study. Unseal the first case.").props.accessibilityState).toMatchObject({ busy: true, disabled: true });
    expect(screen.getByTestId("hub-card-room").props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.getByRole("button", { name: "Settings" }).props.accessibilityState).toMatchObject({ disabled: true });
    // The state line becomes the small indicator in white 82 %.
    const indicator = screen.getByTestId("hub-card-study-busy", hidden);
    expect(indicator.props.color).toBe(ref.color.textLabel);
    expect(screen.queryByText("Unseal", hidden)).toBeNull();
    // A real tap through the Pressable (fireEvent would call the composite's own onPress prop).
    await userEvent.setup().press(card("The Study. Unseal the first case."));
    expect(mocked.ensureSession).toHaveBeenCalledTimes(1);

    await act(async () => finish());
    expect(push).toHaveBeenCalledWith("/tutorial");
    expect(card("The Study. Unseal the first case.").props.accessibilityState).toMatchObject({ busy: false });
  });

  it("THE STUDY shows the offline notice on failure, and the next card tap clears it", async () => {
    mocked.ensureSession.mockRejectedValue(new Error("Network request failed"));
    await renderHub();
    await fireEvent.press(card("The Study. Unseal the first case."));
    await act(async () => {});
    const notice = screen.getByTestId("hub-notice");
    expect(notice.props.accessibilityLabel).toBe("You're offline. Connect to begin.");
    // Android speaks it through the always-mounted slot's polite live region.
    expect(screen.getByTestId("hub-notice-slot").props.accessibilityLiveRegion).toBe("polite");
    // A capsule in the chips' material.
    expect(styleOf(notice)).toMatchObject({
      backgroundColor: ref.color.ground,
      borderColor: ref.color.rim,
      borderRadius: ref.radius.round,
    });
    expect(push).not.toHaveBeenCalled();

    mocked.ensureSession.mockRejectedValue(new Error("boom"));
    await fireEvent.press(card("The Study. Unseal the first case."));
    await act(async () => {});
    expect(screen.getByTestId("hub-notice").props.accessibilityLabel).toBe("Couldn't start the case. Try again in a moment.");

    capture.mockResolvedValue("capture");
    await fireEvent.press(card("Your room. Photograph a room."));
    await act(async () => {});
    expect(screen.queryByTestId("hub-notice")).toBeNull();
  });

  it("YOUR ROOM runs the access check, and carries on to /capture when it can't run", async () => {
    capture.mockResolvedValue("guide");
    await renderHub();
    await fireEvent.press(card("Your room. Photograph a room."));
    await act(async () => {});
    expect(capture).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();

    capture.mockRejectedValue(new Error("Network request failed"));
    await fireEvent.press(card("Your room. Photograph a room."));
    await act(async () => {});
    expect(push).toHaveBeenCalledWith("/capture");
  });

  it("follows a building case and announces the flip to ready", async () => {
    const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility");
    let onStatus: (status: string) => void = () => {};
    mocked.watchRoom.mockImplementation((_id, onChange) => {
      onStatus = onChange;
      return () => Promise.resolve("ok");
    });
    player({ own: room("r2", "generating") });
    await renderHub();
    expect(card("Your case. Building.")).toBeTruthy();
    // The kit's one-line thinking line (its hidden sizer holds the line).
    expect(screen.getByText("Building", hidden)).toBeTruthy();
    expect(mocked.watchRoom).toHaveBeenCalledWith("r2", expect.any(Function));
    // The first fetch is never announced.
    expect(announce).not.toHaveBeenCalled();

    await act(async () => onStatus("ready"));
    expect(announce).toHaveBeenCalledWith("Your case is ready.");
    await fireEvent.press(card("Your case. Open the case."));
    expect(push).toHaveBeenCalledWith({ pathname: "/play/[roomId]", params: { roomId: "r2" } });
  });

  it("Settings: grouped rows that work, in the review screen's list style, on the kit's dark sheet", async () => {
    await renderHub();
    await fireEvent.press(screen.getByRole("button", { name: "Settings" }));
    expect(screen.getByRole("header", { name: "Settings" })).toBeTruthy();
    expect(styleOf(screen.getByTestId("hub-sheet"))).toMatchObject({
      backgroundColor: ref.color.ground,
      borderTopLeftRadius: ref.radius.bottomSheet,
      borderColor: ref.color.rim,
    });
    // Four sections, Bold 14 headings over raised groups.
    for (const name of ["Gameplay", "Accessibility", "Account", "About"]) {
      expect(styleOf(screen.getByRole("header", { name }))).toMatchObject({ ...H.settings.heading, color: ref.color.textPrimary });
    }
    expect(styleOf(screen.getByRole("header", { name: "Gameplay" }).parent!.children[1] as never)).toMatchObject({
      backgroundColor: H.settings.fill,
      borderRadius: H.settings.radius,
    });
    // Each switch row is one accessible switch, at least 52 tall; the native switch inside only shows the value.
    const interactives = screen.getByRole("switch", { name: "Show interactives" });
    expect(interactives.props.accessibilityState).toMatchObject({ checked: false });
    expect(styleOf(interactives).minHeight).toBe(H.settings.rowHeight);
    expect(screen.getByTestId("hub-show-interactives-switch", hidden).props).toMatchObject({
      value: false,
      onTintColor: H.sheet.switch.on,
      tintColor: H.sheet.switch.off,
      thumbTintColor: H.sheet.switch.thumb,
    });
    expect(screen.getByRole("switch", { name: "Haptics" }).props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByRole("switch", { name: "Reduce motion" }).props.accessibilityState).toMatchObject({ checked: false });
    // Navigation rows are buttons; the guide replay is gone (the guide shows before every new room).
    expect(screen.getByRole("button", { name: "Add your email" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "ESCAPD Pro" })).toBeTruthy();
    expect(screen.queryByText("How to photograph a room")).toBeNull();
    expect(screen.getByLabelText(/^Version, \S+/)).toBeTruthy();

    await fireEvent.press(interactives);
    expect(mockPreferences.setHotspotAssist).toHaveBeenCalledWith(true);
    expect(mockFeedback.tick).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByTestId("hub-sheet")).toBeNull();
  });

  it("Settings saves Haptics and Reduce motion to the account, showing the new value at once, and flips back calmly if saving fails", async () => {
    await renderHub();
    await fireEvent.press(screen.getByRole("button", { name: "Settings" }));

    // Reduce motion: a tick as it changes, a guest made if there is no session, then saved.
    await fireEvent.press(screen.getByRole("switch", { name: "Reduce motion" }));
    await act(async () => {});
    expect(mockFeedback.tick).toHaveBeenCalledTimes(1);
    expect(mocked.ensureSession).toHaveBeenCalledTimes(1);
    expect(mockPreferences.update).toHaveBeenCalledWith({ reduced_motion: true });

    // Haptics off: saved, and no tick (it is turning off).
    mockFeedback.tick.mockClear();
    await fireEvent.press(screen.getByRole("switch", { name: "Haptics" }));
    await act(async () => {});
    expect(mockPreferences.update).toHaveBeenCalledWith({ haptics_enabled: false });
    expect(mockFeedback.tick).not.toHaveBeenCalled();

    // Offline: the switch shows the new value while it tries, then flips back with a quiet note.
    let fail: (error: Error) => void = () => {};
    mocked.ensureSession.mockReturnValueOnce(new Promise((_resolve, reject) => (fail = reject)));
    const motionRow = () => screen.getByRole("switch", { name: "Reduce motion" });
    await fireEvent.press(motionRow());
    expect(motionRow().props.accessibilityState).toMatchObject({ checked: true });
    await act(async () => fail(new Error("Network request failed")));
    expect(motionRow().props.accessibilityState).toMatchObject({ checked: false });
    expect(mockPreferences.update).toHaveBeenLastCalledWith({ reduced_motion: false });
    expect(screen.getByText("Couldn't save that while offline. It's back as it was.")).toBeTruthy();
  });

  it("Settings: Haptics ticks once just after it turns on, and not as it turns off", async () => {
    mockPreferences.haptics_enabled = false;
    // update() turns the setting on, as the provider does.
    mockPreferences.update.mockImplementation(async (patch: Record<string, boolean>) => {
      Object.assign(mockPreferences, patch);
    });
    await renderHub();
    await fireEvent.press(screen.getByRole("button", { name: "Settings" }));
    await fireEvent.press(screen.getByRole("switch", { name: "Haptics" }));
    await act(async () => {});
    expect(mockPreferences.update).toHaveBeenCalledWith({ haptics_enabled: true });
    expect(mockFeedback.tick).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByRole("switch", { name: "Haptics" }));
    await act(async () => {});
    expect(mockPreferences.update).toHaveBeenLastCalledWith({ haptics_enabled: false });
    expect(mockFeedback.tick).toHaveBeenCalledTimes(1);
  });

  it("Settings' account rows: Add your email for a guest, the email when signed in, and ESCAPD Pro", async () => {
    await renderHub();
    await fireEvent.press(screen.getByRole("button", { name: "Settings" }));
    // A real press: the press haptic on press-in, then the sheet closes and /account opens (back to the hub when done).
    await userEvent.setup().press(screen.getByRole("button", { name: "Add your email" }));
    expect(mockFeedback.press).toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith({ pathname: "/account", params: { next: "back" } });
    expect(screen.queryByTestId("hub-sheet")).toBeNull();

    await fireEvent.press(screen.getByRole("button", { name: "Settings" }));
    await fireEvent.press(screen.getByRole("button", { name: "ESCAPD Pro" }));
    expect(push).toHaveBeenCalledWith("/pro");
    await screen.unmount();

    mocked.currentSession.mockResolvedValue({ user: { email: "ada@example.com", is_anonymous: false } } as never);
    await renderHub();
    await fireEvent.press(screen.getByRole("button", { name: "Settings" }));
    await act(async () => {});
    expect(screen.getByLabelText("Email, ada@example.com")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Add your email" })).toBeNull();
  });

  it("draws Settings as Opal's chip, with the press haptic and one brass focus ring round its disc", async () => {
    await renderHub();
    const help = screen.getByRole("button", { name: "Settings" });
    // A 48 hit box around the 36 disc in `ground`.
    expect(styleOf(help)).toMatchObject({ width: ref.button.chip.hit, height: ref.button.chip.hit });
    const disc = help.queryAll((node) => node.type === "View" && styleOf(node).backgroundColor === ref.button.chip.fill);
    expect(disc).toHaveLength(1);
    expect(styleOf(disc[0])).toMatchObject({ width: ref.button.chip.size, height: ref.button.chip.size, borderRadius: ref.radius.round });
    await fireEvent(help, "pressIn");
    expect(mockFeedback.press).toHaveBeenCalledTimes(1);

    expect(focusRings()).toHaveLength(0);
    await fireEvent(help, "focus");
    const rings = focusRings();
    expect(rings).toHaveLength(1);
    expect(styleOf(rings[0])).toMatchObject({ borderRadius: ref.radius.round });
    // Drawn inside the disc, so it follows the 36 circle.
    expect(disc[0].queryAll((node) => node === rings[0])).toHaveLength(1);
    await fireEvent(help, "blur");
    expect(focusRings()).toHaveLength(0);
  });

  it("Android back closes the sheet first, swallows a busy card, and otherwise leaves the app", async () => {
    type BackListener = Parameters<typeof BackHandler.addEventListener>[1];
    const handlers: BackListener[] = [];
    const add = jest.spyOn(BackHandler, "addEventListener").mockImplementation((_event, handler) => {
      handlers.push(handler);
      return { remove: () => handlers.splice(handlers.indexOf(handler), 1) };
    });
    const back = () => handlers[handlers.length - 1]({} as Parameters<BackListener>[0]);

    mocked.ensureSession.mockReturnValue(new Promise(() => {}));
    await renderHub();
    expect(back()).toBe(false);

    await fireEvent.press(screen.getByRole("button", { name: "Settings" }));
    let handled: boolean | null | undefined;
    await act(async () => {
      handled = back();
    });
    expect(handled).toBe(true);
    expect(screen.queryByTestId("hub-sheet")).toBeNull();

    await fireEvent.press(card("The Study. Unseal the first case."));
    expect(back()).toBe(true);
    add.mockRestore();
  });

  it("fans the cards whole on 393 x 852, scales the whole hand on 375 x 667 and 360 wide, and stacks at large text or a very short screen", async () => {
    const hand = () => styleOf(screen.getByTestId("hub-fan-hand"));
    await renderHub();
    expect(screen.getByTestId("hub-fanned")).toBeTruthy();
    expect(hand().transform).toEqual([{ translateY: -0 }, { scale: 1 }]);
    await screen.unmount();

    // Scaled about the axis with its top kept: never clipped by the screen.
    setWindow(375, 667, 1);
    await renderHub();
    expect(screen.getByTestId("hub-fanned")).toBeTruthy();
    const [lift, scale] = hand().transform as [{ translateY: number }, { scale: number }];
    expect(scale.scale).toBeCloseTo(375 / 393, 6);
    expect(lift.translateY).toBeCloseTo((-H.fan.height * (1 - 375 / 393)) / 2, 6);
    await screen.unmount();

    setWindow(360, 800, 1);
    await renderHub();
    expect(screen.getByTestId("hub-fanned")).toBeTruthy();
    await screen.unmount();

    // From the first larger text step the cards stack, upright, at least 96 tall.
    setWindow(393, 852, 1.12);
    await renderHub();
    expect(screen.getByTestId("hub-stacked")).toBeTruthy();
    expect(styleOf(screen.getByTestId("hub-card-study")).minHeight).toBe(H.stackedMinHeight);
    expect(styleOf(screen.getByTestId("hub-card-study")).transform).toBeUndefined();
    await screen.unmount();

    // A column (window less the 65 header) that would need the fan under 0.75 stacks too.
    setWindow(393, 360, 1);
    await renderHub();
    expect(screen.getByTestId("hub-stacked")).toBeTruthy();
  });

  it("caps the band above the title at Opal's 124 and lifts the floor glow with the fan", async () => {
    await renderHub();
    const fanned = screen.getByTestId("hub-fanned");
    // The column runs to the safe bottom: no slot is kept for Opal's X disc.
    expect(styleOf(fanned).marginBottom).toBe(0);
    expect(styleOf(fanned.children[0] as never)).toMatchObject({ flex: H.weights.above, maxHeight: H.band });
  });

  it("returns focus to Settings once the sheet has left, never while it is still leaving", async () => {
    const focus = jest.spyOn(AccessibilityInfo, "sendAccessibilityEvent").mockImplementation(() => {});
    await renderHub();
    const help = screen.getByRole("button", { name: "Settings" });
    // By the ref's testID (under jest it is RN's mocked View, not the query's
    // host element): a deep comparison of two elements walks the whole tree.
    // The sheet also focuses its own title 300 ms after it opens.
    const helpFocus = () =>
      focus.mock.calls.filter(
        ([target, type]) => (target as unknown as { props?: { testID?: string } }).props?.testID === "hub-settings" && type === "focus",
      ).length;
    // Focus returns after the sheet's slide away (ref.motion.sheetFall) plus the margin.
    const waitOutExit = () => act(() => new Promise((resolve) => setTimeout(resolve, ref.motion.sheetFall.duration + H.sheet.focusMargin + 50)));

    await fireEvent.press(help);
    await fireEvent.press(screen.getByRole("button", { name: "Close" }));
    // Still leaving: VoiceOver would ignore a move outside its modal layer.
    expect(helpFocus()).toBe(0);
    await waitOutExit();
    expect(helpFocus()).toBe(1);

    // Reopened before that exit ended, or left for another screen: no return.
    focus.mockClear();
    await fireEvent.press(help);
    await fireEvent.press(screen.getByRole("button", { name: "Close" }));
    await fireEvent.press(help);
    await fireEvent.press(screen.getByRole("button", { name: "ESCAPD Pro" }));
    await waitOutExit();
    expect(helpFocus()).toBe(0);
    focus.mockRestore();
  });

  it("deals the hand on the window's axis: the 140 x 320 centre card at 126.5 on 393, side cards 93.2 out, tilted -/+6 degrees", async () => {
    const slots = () =>
      ["hub-card-study", "hub-card-room", "hub-card-case"].map((id) => {
        const style = styleOf(screen.getByTestId(id));
        return [style.left as number, style.top, style.transform, style.width, style.height];
      });
    await renderHub();
    const [study, room, kase] = slots();
    expect(study[0]).toBeCloseTo(33.3, 6);
    expect(room[0]).toBeCloseTo(126.5, 6);
    expect(kase[0]).toBeCloseTo(219.7, 6);
    expect(study.slice(1)).toEqual([H.fan.sideDrop, [{ rotate: `${-H.fan.tilt}deg` }], 140, 320]);
    expect(room.slice(1)).toEqual([0, [{ rotate: "0deg" }], 140, 320]);
    expect(kase.slice(1)).toEqual([H.fan.sideDrop, [{ rotate: `${H.fan.tilt}deg` }], 140, 320]);
    // The centre card lies on top.
    expect(styleOf(screen.getByTestId("hub-card-room")).zIndex).toBe(1);
    await screen.unmount();

    setWindow(440, 956, 1);
    await renderHub();
    const lefts = slots().map(([left]) => left);
    [56.8, 150, 243.2].forEach((left, i) => expect(lefts[i]).toBeCloseTo(left, 6));
  });

  it("lays out each fan card as Opal's: the tag pill 24 from the top, the state line in meta grey under it", async () => {
    await renderHub();
    for (const tag of ["THE STUDY", "YOUR ROOM", "YOUR CASE"]) {
      const text = screen.getByText(tag, hidden);
      expect(styleOf(text)).toMatchObject({ ...ref.type.tag, color: ref.color.textLabel });
      const pill = text.parent!;
      expect(styleOf(pill)).toMatchObject({
        minHeight: ref.button.gameCard.tagHeight,
        borderWidth: H.hairline,
        borderColor: ref.color.rim,
        borderRadius: ref.radius.tag,
      });
      expect(styleOf(pill.parent!)).toMatchObject({ position: "absolute", top: TAG_TOP, alignItems: "center" });
    }
    // A side card centres each block on the face the centre card leaves exposed: inset on its covered side.
    const head = (tag: string) => styleOf(screen.getByText(tag, hidden).parent!.parent!);
    const between = (n: unknown) => typeof n === "number" && n > H.fan.cover.top && n < H.fan.cover.foot;
    expect(between(head("THE STUDY").right)).toBe(true);
    expect(between(head("YOUR CASE").left)).toBe(true);
    expect(head("YOUR ROOM")).toMatchObject({ left: 0, right: 0 });
    expect(styleOf(screen.getByText("Photograph", hidden))).toMatchObject({ ...ref.type.meta, color: ref.color.textSecondary });
  });

  it("keeps the building line still under reduced motion", async () => {
    player({ own: room("r2", "generating") });
    await renderHub({ reducedMotion: true });
    // The kit's still copy (its hidden sizer holds the same words).
    const colours = screen.getAllByText("Building", hidden).map((text) => styleOf(text).color);
    expect(colours).toContain(ref.motion.thinking.shimmer.still);
  });

  it("uses only reference tokens: no colours, fonts, numbers, live look or old hub pieces in the screen's source", () => {
    const dir = path.join(ROOT, "src/screens/hub");
    const files = [path.join(ROOT, "app/index.tsx"), ...fs.readdirSync(dir).filter((f) => /\.tsx?$/.test(f)).map((f) => path.join(dir, f))];
    for (const file of files) {
      const source = fs.readFileSync(file, "utf8");
      expect({ file, hex: source.match(/#[0-9a-f]{3,8}\b/gi) }).toEqual({ file, hex: null });
      expect({ file, rgb: source.match(/rgba?\(/g) }).toEqual({ file, rgb: null });
      expect({ file, font: source.match(/fontFamily\s*[:=]\s*["']/g) }).toEqual({ file, font: null });
      // The reference look: ref.* only (plus the live motion and z timings), no silk, grain, glass or play-screen pieces.
      const tokens = source.match(/import \{([^}]*)\} from "@\/theme\/tokens"/)?.[1].split(",").map((s) => s.trim()).filter(Boolean) ?? [];
      expect({ file, live: tokens.filter((t) => !["motion", "ref", "z", "type GradientStop"].includes(t)) }).toEqual({ file, live: [] });
      expect({
        file,
        old: source.match(/BackgroundStill|\bGrain\b|Magnifier|magnifier\.png|@\/components\/(Text|Sheet|Button|IconButton)"/g),
      }).toEqual({ file, old: null });
      // No raw numbers beyond 0, 1 and 2 as arithmetic.
      const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const numbers: string[] = [];
      const visit = (node: ts.Node) => {
        if (ts.isNumericLiteral(node) && !["0", "1", "2"].includes(node.text)) numbers.push(node.text);
        ts.forEachChild(node, visit);
      };
      visit(ast);
      expect({ file, numbers }).toEqual({ file, numbers: [] });
    }
  });
});

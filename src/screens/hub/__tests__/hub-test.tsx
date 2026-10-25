/// <reference types="node" />
import fs from "fs";
import path from "path";
import { AccessibilityInfo, BackHandler, Dimensions, StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { act, fireEvent, render, screen, userEvent, within } from "@testing-library/react-native";
import { router } from "expo-router";
import { openCapture } from "@/capture/openCapture";
import * as api from "@/lib/escapd-api";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { color, hit, radius, ref, space } from "@/theme/tokens";
import { HubScreen } from "../HubScreen";

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
jest.mock("@/capture/useDevelopment", () => ({ POLL_MS: 5000 }));
jest.mock("@/tutorial/assets", () => ({ TUTORIAL_ROOM_ID: "tutorial-room" }));

const mockPreferences = { hotspotAssist: false, setHotspotAssist: jest.fn() };
jest.mock("@/game/preferences", () => ({ usePreferences: () => mockPreferences }));
const mockTap = jest.fn();
jest.mock("@/game/feedback", () => ({ useFeedback: () => ({ tap: mockTap, success: jest.fn(), warning: jest.fn() }) }));
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
  mocked.watchRoom.mockReturnValue(() => Promise.resolve("ok"));
  mocked.currentSession.mockResolvedValue(null);
  setWindow(393, 852, 1);
});

const card = (name: string) => screen.getByRole("button", { name });
const styleOf = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) ?? {};
/** The live Button draws its fill, edge, corners and dimming on an inner surface; layout stays on the pressable. */
const surfaceOf = (button: Parameters<typeof within>[0]) => within(button).getByTestId("button-surface", { includeHiddenElements: true });
const buttonLook = (button: Parameters<typeof within>[0]) => ({ ...styleOf(button), ...styleOf(surfaceOf(button)) });
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

    expect(screen.getByRole("header", { name: "Choose a case" })).toBeTruthy();
    expect(screen.getByText("Three files on the desk.")).toBeTruthy();
    expect(screen.getAllByRole("button").map((b) => b.props.accessibilityLabel)).toEqual([
      "How you play",
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

  it("shows REPLAY and the SOLVED stamp for a solved own case, and plays it", async () => {
    player({ tutorial: session("completed"), own: room("r1", "ready"), ownSession: session("completed") });
    await renderHub();
    expect(card("The Study. Replay the first case.")).toBeTruthy();
    // A brass case stamp: brass mono text in a 1 pt brass border, never oxblood.
    const stamp = screen.getByText("SOLVED", hidden);
    expect(StyleSheet.flatten(stamp.props.style).color).toBe(color.accent);
    expect(StyleSheet.flatten(stamp.parent?.props.style)).toMatchObject({ borderColor: color.accent, borderRadius: radius.control });
    // A real press: the selection haptic fires on press-in.
    await userEvent.setup().press(card("Your case. Solved. Replay the case."));
    expect(push).toHaveBeenCalledWith({ pathname: "/play/[roomId]", params: { roomId: "r1" } });
    expect(mockTap).toHaveBeenCalledTimes(1);
  });

  it("maps the case states: CONTINUE, OPEN after an abandoned run, SEE WHY, and a draft as none", async () => {
    player({ tutorial: session("active"), own: room("r1", "ready"), ownSession: session("active") });
    await renderHub();
    expect(card("The Study. Continue the first case.")).toBeTruthy();
    expect(card("Your case. Continue the case.")).toBeTruthy();
    await screen.unmount();

    player({ tutorial: session("abandoned"), own: room("r1", "ready"), ownSession: session("abandoned") });
    await renderHub();
    expect(card("The Study. Unseal the first case.")).toBeTruthy();
    expect(card("Your case. Open the case.")).toBeTruthy();
    await screen.unmount();

    player({ own: room("r3", "failed") });
    await renderHub();
    await fireEvent.press(card("Your case. It didn't develop. See why."));
    expect(push).toHaveBeenCalledWith({ pathname: "/capture/develop", params: { roomId: "r3" } });
    await screen.unmount();

    player({ own: room("d1", "draft") });
    await renderHub();
    expect(card("Your case. None yet.")).toBeTruthy();
  });

  it("shows OFFLINE or TRY LATER when the fetch fails, keeping THE STUDY and YOUR ROOM enabled", async () => {
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
    expect(screen.getByRole("button", { name: "How you play" }).props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.getByTestId("hub-card-study-busy", hidden)).toBeTruthy();
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
    expect(StyleSheet.flatten(notice.props.style)).toMatchObject({
      backgroundColor: color.surface,
      borderColor: color.hairline,
      borderRadius: radius.control,
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

  it("follows a developing case and announces the flip to ready", async () => {
    const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility");
    let onStatus: (status: string) => void = () => {};
    mocked.watchRoom.mockImplementation((_id, onChange) => {
      onStatus = onChange;
      return () => Promise.resolve("ok");
    });
    player({ own: room("r2", "generating") });
    await renderHub();
    expect(card("Your case. Developing.")).toBeTruthy();
    // The warm one-line Thinking state (its hidden sizer holds the line).
    expect(screen.getByText("DEVELOPING", hidden)).toBeTruthy();
    expect(mocked.watchRoom).toHaveBeenCalledWith("r2", expect.any(Function));
    // The first fetch is never announced.
    expect(announce).not.toHaveBeenCalled();

    await act(async () => onStatus("ready"));
    expect(announce).toHaveBeenCalledWith("Your case is ready.");
    await fireEvent.press(card("Your case. Open the case."));
    expect(push).toHaveBeenCalledWith({ pathname: "/play/[roomId]", params: { roomId: "r2" } });
  });

  it("How you play: the live sheet with the Show interactives switch and the guide replay", async () => {
    await renderHub();
    await fireEvent.press(screen.getByRole("button", { name: "How you play" }));
    expect(screen.getByRole("header", { name: "How you play" })).toBeTruthy();

    const toggle = screen.getByRole("switch", { name: "Show interactives" });
    // React Native's Switch, as Case options draws it: the brass track and a warm thumb.
    expect(toggle.props).toMatchObject({ value: false, onTintColor: color.accent, tintColor: color.hairline, thumbTintColor: color.text });
    await fireEvent(toggle, "valueChange", true);
    expect(mockPreferences.setHotspotAssist).toHaveBeenCalledWith(true);

    await fireEvent.press(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByTestId("hub-sheet")).toBeNull();

    await fireEvent.press(screen.getByRole("button", { name: "How you play" }));
    const guide = screen.getByRole("button", { name: "How to photograph a room" });
    // The live secondary Button: walnut with a brass hairline, 8 pt rounded, never under 48.
    expect(buttonLook(guide)).toMatchObject({
      backgroundColor: color.raised,
      borderWidth: H.hairline,
      borderColor: color.hairline,
      borderRadius: radius.control,
      minHeight: hit.min,
      paddingVertical: space.md,
    });
    expect(styleOf(screen.getByText("How to photograph a room"))).toMatchObject({ color: color.text });
    await fireEvent.press(guide);
    expect(push).toHaveBeenCalledWith({ pathname: "/capture/guide", params: { replay: "1" } });
    expect(screen.queryByTestId("hub-sheet")).toBeNull();
  });

  it("leaves How you play's focus ring to the live IconButton: one brass ring, nothing composed around it", async () => {
    await renderHub();
    const help = screen.getByRole("button", { name: "How you play" });
    expect(focusRings()).toHaveLength(0);
    await fireEvent(help, "focus");
    const rings = focusRings();
    expect(rings).toHaveLength(1);
    expect(styleOf(rings[0])).toMatchObject({ borderColor: color.accent, borderRadius: ref.radius.pill });
    // Drawn inside the button itself, so it follows the 48 circle.
    expect(help.queryAll((node) => node === rings[0])).toHaveLength(1);
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

    await fireEvent.press(screen.getByRole("button", { name: "How you play" }));
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

  it("deals the fan with the glass on 393 x 852, drops the glass alone on a short screen, and stacks at large text", async () => {
    await renderHub();
    expect(screen.getByTestId("hub-fanned")).toBeTruthy();
    expect(screen.getByTestId("hub-glass", hidden)).toBeTruthy();
    await screen.unmount();

    // 375 x 667: a 610 column (no insets here) is under the glass's 649.4.
    setWindow(375, 667, 1);
    await renderHub();
    expect(screen.getByTestId("hub-fanned")).toBeTruthy();
    expect(screen.queryByTestId("hub-glass", hidden)).toBeNull();
    await screen.unmount();

    // From the first larger text step the cards stack and the glass goes.
    setWindow(393, 852, 1.12);
    await renderHub();
    expect(screen.getByTestId("hub-stacked")).toBeTruthy();
    expect(screen.queryByTestId("hub-glass", hidden)).toBeNull();
    expect(StyleSheet.flatten(screen.getByTestId("hub-card-study").props.style).minHeight).toBe(ref.layout.hub.stackedMinHeight);
    await screen.unmount();

    // Narrower than 375 also stacks.
    setWindow(360, 800, 1);
    await renderHub();
    expect(screen.getByTestId("hub-stacked")).toBeTruthy();
  });

  it("returns focus to How you play once the sheet has left, never while it is still leaving", async () => {
    const focus = jest.spyOn(AccessibilityInfo, "sendAccessibilityEvent").mockImplementation(() => {});
    await renderHub();
    const help = screen.getByRole("button", { name: "How you play" });
    // By the ref's testID (under jest it is RN's mocked View, not the query's
    // host element): a deep comparison of two elements walks the whole tree.
    // The live Sheet also focuses its own title 300 ms after it opens.
    const helpFocus = () =>
      focus.mock.calls.filter(
        ([target, type]) => (target as unknown as { props?: { testID?: string } }).props?.testID === "hub-how-you-play" && type === "focus",
      ).length;
    // The live Sheet has no exit callback: focus returns after its 200 ms slide plus the margin.
    const waitOutExit = () => act(() => new Promise((resolve) => setTimeout(resolve, H.sheetExit + H.sheetFocusMargin + 50)));

    await fireEvent.press(help);
    await fireEvent.press(screen.getByRole("button", { name: "Close" }));
    // Still leaving: VoiceOver would ignore a move outside its modal layer.
    expect(helpFocus()).toBe(0);
    await waitOutExit();
    expect(helpFocus()).toBe(1);

    // Reopened before that exit ended, or left for the guide: no return.
    focus.mockClear();
    await fireEvent.press(help);
    await fireEvent.press(screen.getByRole("button", { name: "Close" }));
    await fireEvent.press(help);
    await fireEvent.press(screen.getByRole("button", { name: "How to photograph a room" }));
    await waitOutExit();
    expect(helpFocus()).toBe(0);
    focus.mockRestore();
  });

  it("deals the fan on the window's axis: centre card at 135.5 on 393, side cards 105 out", async () => {
    const lefts = () =>
      ["hub-card-study", "hub-card-room", "hub-card-case"].map((id) => StyleSheet.flatten(screen.getByTestId(id).props.style).left);
    await renderHub();
    expect(lefts()).toEqual([30.5, 135.5, 240.5]);
    await screen.unmount();

    setWindow(440, 956, 1);
    await renderHub();
    expect(lefts()).toEqual([54, 159, 264]);
  });

  it("centres a side card's plate label and note on the face the centre card leaves exposed", async () => {
    await renderHub();
    const box = (text: string) => StyleSheet.flatten(screen.getByText(text, hidden).props.style);
    expect(box("THE STUDY")).toMatchObject({ left: 4, right: H.fan.cover, color: color.accent });
    expect(box("YOUR ROOM")).toMatchObject({ left: 4, right: 4 });
    // Loading: the note line is kept, blank; the tag still sits on its column.
    expect(box("YOUR CASE")).toMatchObject({ left: H.fan.cover, right: 4 });
    expect(StyleSheet.flatten(screen.getByText("Photograph", hidden).props.style).color).toBe(color.textSecondary);
  });

  it("mounts a stacked card's plate at its right end, 88 wide and 4 in, on any width", async () => {
    setWindow(440, 956, 1.12);
    await renderHub();
    const plate = StyleSheet.flatten(screen.getByTestId("hub-card-study-plate", hidden).props.style);
    expect(plate).toMatchObject({ top: 4, right: 4, bottom: 4, width: 88, backgroundColor: color.canvas, borderColor: color.rim });
    expect(plate.borderRadius).toBe(radius.thumb);
    // The card reserves the plate, so the text column never runs under it.
    expect(StyleSheet.flatten(screen.getByTestId("hub-card-study").props.style).paddingRight).toBe(92);
  });

  it("keeps the glass under reduced motion, as a still image in the same place", async () => {
    await renderHub({ reducedMotion: true });
    expect(screen.getByTestId("hub-glass", hidden)).toBeTruthy();
  });

  it("uses only tokens: no colour, font or raw style values in the screen's source", () => {
    const dir = path.join(ROOT, "src/screens/hub");
    const files = [path.join(ROOT, "app/index.tsx"), ...fs.readdirSync(dir).filter((f) => /\.tsx?$/.test(f)).map((f) => path.join(dir, f))];
    for (const file of files) {
      const source = fs.readFileSync(file, "utf8");
      expect({ file, hex: source.match(/#[0-9a-f]{3,8}\b/gi) }).toEqual({ file, hex: null });
      expect({ file, rgb: source.match(/rgba?\(/g) }).toEqual({ file, rgb: null });
      expect({ file, font: source.match(/fontFamily\s*[:=]\s*["']/g) }).toEqual({ file, font: null });
      // The play screen's look: live type and colours, no Noir text, pools or panels.
      expect({ file, noir: source.match(/NoirText|LightPools?\b|NoticeLine|ref\.(type|color|panel|gameCard|illustration|light|space|radius)\b/g) }).toEqual({
        file,
        noir: null,
      });
    }
  });
});

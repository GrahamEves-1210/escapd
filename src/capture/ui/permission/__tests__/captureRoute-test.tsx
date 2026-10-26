// The /capture route shell (app/capture/index.tsx): Checking until the
// permission read and the guide backstop resolve, the guide for a first-timer,
// the rangefinder once access is granted, the Settings re-check, the camera's
// flat ground under both states, the status bar and the iOS edge swipe.
import { AppState, StyleSheet, type AppStateStatus } from "react-native";
import { act, render, screen } from "@testing-library/react-native";
import { useCameraPermissions, type PermissionResponse } from "expo-camera";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";
import { captureGuideSeenThisSession, hasSeenCaptureGuide } from "@/capture/guideSeen";
import { addPlate, clearPlates, removePlate } from "@/capture/roll";
import type { CameraPermissionProps } from "@/capture/ui/types";
import { setMode } from "@/game/mode";
import { modeThemes, motion, ref } from "@/theme/tokens";
import CaptureScreen from "../../../../../app/capture/index";

jest.mock("expo-camera", () => ({ useCameraPermissions: jest.fn() }));
jest.mock("expo-router", () => {
  const { useEffect } = jest.requireActual<typeof import("react")>("react");
  return {
    router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
    useLocalSearchParams: jest.fn(() => ({})),
    // Focus effects run as effects: the screen is focused from mount until unmount.
    useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]),
    Stack: { Screen: jest.fn(() => null) },
  };
});
jest.mock("expo-status-bar", () => ({ setStatusBarStyle: jest.fn() }));
jest.mock("@/capture/guideSeen", () => ({
  captureGuideSeenThisSession: jest.fn(() => false),
  hasSeenCaptureGuide: jest.fn(),
}));
jest.mock("@/capture/ui/Rangefinder", () => {
  const { Text } = jest.requireActual<typeof import("react-native")>("react-native");
  return { Rangefinder: () => <Text testID="rangefinder">rangefinder</Text> };
});
const permissionProps: CameraPermissionProps[] = [];
jest.mock("@/capture/ui/CameraPermission", () => {
  const { Text } = jest.requireActual<typeof import("react-native")>("react-native");
  return {
    CameraPermission: (props: CameraPermissionProps) => {
      permissionProps.push(props);
      return <Text testID="permission">{props.checking ? "checking" : "sheet"}</Text>;
    },
  };
});

const hook = jest.mocked(useCameraPermissions);
const sessionSeen = jest.mocked(captureGuideSeenThisSession);
const seen = jest.mocked(hasSeenCaptureGuide);
const params = jest.mocked(useLocalSearchParams);

const response = (granted: boolean): PermissionResponse => ({
  status: (granted ? "granted" : "undetermined") as PermissionResponse["status"],
  granted,
  canAskAgain: true,
  expires: "never",
});

const request = jest.fn(async () => response(false));
const get = jest.fn(async () => response(false));

function withPermission(value: PermissionResponse | null) {
  hook.mockReturnValue([value, request, get]);
}

beforeEach(() => {
  jest.clearAllMocks();
  permissionProps.length = 0;
  clearPlates();
  sessionSeen.mockReturnValue(false);
  seen.mockResolvedValue(true);
  params.mockReturnValue({});
});

describe("/capture", () => {
  it("is Checking until the permission read resolves", async () => {
    withPermission(null);
    await render(<CaptureScreen />);
    expect(screen.getByTestId("permission").props.children).toBe("checking");
    expect(screen.queryByTestId("rangefinder")).toBeNull();
  });

  it("lays the camera's flat ground under both states, with no grain or silk", async () => {
    withPermission(response(false));
    await render(<CaptureScreen />);
    const root = screen.getByTestId("permission").parent as unknown as { props: { style?: unknown }; children: { type: unknown }[] };
    expect(StyleSheet.flatten(root.props.style as never)).toMatchObject({ flex: 1, backgroundColor: ref.color.ground });
    // Nothing else sits under the state (03 draws its own white ground over this).
    expect(root.children.map((child) => child.type)).toEqual(["Text"]);
  });

  it("keeps the iOS edge swipe on: there is no back control on 03", async () => {
    withPermission(response(false));
    await render(<CaptureScreen />);
    expect(jest.mocked(Stack.Screen).mock.calls.at(-1)?.[0]).toMatchObject({ options: { gestureEnabled: true } });
  });

  it("sets dark status-bar glyphs on 03's white, and light ones once the camera has faded in or /capture is left", async () => {
    jest.useFakeTimers();
    try {
      sessionSeen.mockReturnValue(true);
      withPermission(response(false));
      await render(<CaptureScreen />);
      expect(jest.mocked(setStatusBarStyle).mock.calls.at(-1)?.[0]).toBe("dark");
      withPermission(response(true));
      await screen.rerender(<CaptureScreen />);
      expect(jest.mocked(setStatusBarStyle).mock.calls.at(-1)?.[0]).toBe("dark");
      await act(() => jest.advanceTimersByTime(motion.sceneCrossfade));
      expect(jest.mocked(setStatusBarStyle).mock.calls.at(-1)?.[0]).toBe("light");
      withPermission(response(false));
      await screen.rerender(<CaptureScreen />);
      expect(jest.mocked(setStatusBarStyle).mock.calls.at(-1)?.[0]).toBe("dark");
      await screen.unmount();
      expect(jest.mocked(setStatusBarStyle).mock.calls.at(-1)?.[0]).toBe("light");
    } finally {
      jest.useRealTimers();
    }
  });

  it("inside a mode, lays the mode's ground and keeps light glyphs, since 03 is the mode's dark sheet", async () => {
    setMode("crime_scene");
    try {
      withPermission(response(false));
      await render(<CaptureScreen />);
      const root = screen.getByTestId("permission").parent as unknown as { props: { style?: unknown } };
      expect(StyleSheet.flatten(root.props.style as never)).toMatchObject({ backgroundColor: modeThemes.crime_scene.surface });
      expect(jest.mocked(setStatusBarStyle).mock.calls.at(-1)?.[0]).toBe("light");
      expect(jest.mocked(setStatusBarStyle)).not.toHaveBeenCalledWith("dark");
    } finally {
      setMode(null);
    }
  });

  it("stays on Checking until the guide flag is read, then shows the sheet when access isn't granted", async () => {
    withPermission(response(false));
    let answer: (value: boolean) => void = () => {};
    seen.mockImplementation(() => new Promise((resolve) => (answer = resolve)));
    await render(<CaptureScreen />);
    expect(screen.getByTestId("permission").props.children).toBe("checking");
    await act(async () => answer(true));
    expect(screen.getByTestId("permission").props.children).toBe("sheet");
  });

  it("sends a first-timer to the photo guide and never opens the camera", async () => {
    withPermission(response(true));
    seen.mockResolvedValue(false);
    await render(<CaptureScreen />);
    expect(router.replace).toHaveBeenCalledWith("/capture/guide");
    expect(screen.queryByTestId("rangefinder")).toBeNull();
  });

  it("opens the rangefinder straight away when the guide was seen this session and access is granted", async () => {
    sessionSeen.mockReturnValue(true);
    withPermission(response(true));
    await render(<CaptureScreen />);
    expect(seen).not.toHaveBeenCalled();
    expect(screen.getByTestId("rangefinder")).toBeTruthy();
    expect(screen.queryByTestId("permission")).toBeNull();
  });

  it("never checks the guide in retake mode", async () => {
    addPlate({ uri: "file://plate-0.jpg", width: 1200, height: 1600 });
    params.mockReturnValue({ retake: "0" });
    withPermission(response(false));
    await render(<CaptureScreen />);
    expect(seen).not.toHaveBeenCalled();
    expect(screen.getByTestId("permission").props.children).toBe("sheet");
    expect(permissionProps.at(-1)?.retakeIndex).toBe(0);
  });

  it("takes ?retake as a slot: a filled one, or an open one inside the photos, never one past them", async () => {
    for (let i = 0; i < 4; i++) addPlate({ uri: `file://plate-${i}.jpg`, width: 1200, height: 1600 });
    removePlate(1);
    withPermission(response(false));
    params.mockReturnValue({ retake: "1" });
    await render(<CaptureScreen />);
    expect(permissionProps.at(-1)?.retakeIndex).toBe(1);
    // Three photos are filled, but slot 3 still names the fourth.
    params.mockReturnValue({ retake: "3" });
    await render(<CaptureScreen />);
    expect(permissionProps.at(-1)?.retakeIndex).toBe(3);
    expect(permissionProps.at(-1)?.plateCount).toBe(3);
    params.mockReturnValue({ retake: "4" });
    await render(<CaptureScreen />);
    expect(permissionProps.at(-1)?.retakeIndex).toBeNull();
  });

  it("re-reads the permission when the app comes back from Settings", async () => {
    const listeners: ((state: AppStateStatus) => void)[] = [];
    const add = jest.spyOn(AppState, "addEventListener").mockImplementation((_type, listener) => {
      listeners.push(listener as (state: AppStateStatus) => void);
      return { remove: jest.fn() } as never;
    });
    withPermission(response(false));
    await render(<CaptureScreen />);
    await act(async () => listeners.forEach((listener) => listener("active")));
    expect(get).toHaveBeenCalledTimes(1);
    add.mockRestore();
  });
});

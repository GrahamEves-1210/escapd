// The /capture route shell (app/capture/index.tsx): Checking until the
// permission read and the guide backstop resolve, the guide for a first-timer,
// the rangefinder once access is granted, the Settings re-check, and the one
// flat ground under both states.
import { AppState, StyleSheet, type AppStateStatus } from "react-native";
import { act, render, screen } from "@testing-library/react-native";
import { useCameraPermissions, type PermissionResponse } from "expo-camera";
import { router, useLocalSearchParams } from "expo-router";
import { captureGuideSeenThisSession, hasSeenCaptureGuide } from "@/capture/guideSeen";
import { addPlate, clearPlates } from "@/capture/roll";
import type { CameraPermissionProps } from "@/capture/ui/types";
import { color } from "@/theme/tokens";
import CaptureScreen from "../../../../../app/capture/index";

jest.mock("expo-camera", () => ({ useCameraPermissions: jest.fn() }));
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
  useLocalSearchParams: jest.fn(() => ({})),
}));
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

  it("lays both states on one flat color.canvas with the live grain beneath them, and no silk", async () => {
    withPermission(response(false));
    await render(<CaptureScreen />);
    const root = screen.getByTestId("permission").parent as unknown as { props: { style?: unknown }; children: { type: unknown }[] };
    expect(StyleSheet.flatten(root.props.style as never)).toMatchObject({ flex: 1, backgroundColor: color.canvas });
    // The grain is the first layer (an Image), drawn before either state; nothing else sits under them.
    expect(root.children.map((child) => child.type)).toEqual(["Image", "Text"]);
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

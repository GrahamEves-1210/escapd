/// <reference types="node" />
import fs from "fs";
import path from "path";
import { AccessibilityInfo, BackHandler, Platform, StyleSheet } from "react-native";
import { act, fireEvent, render, screen, userEvent, waitFor } from "@testing-library/react-native";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { processPhoto, type ProcessedPlate, type RawPhoto } from "@/capture/process-photo";
import { addPlate, clearPlates, getPlates, getRollPlanState, getSlots, removePlate, setRollLens } from "@/capture/roll";
import { platePrompts } from "@/capture/slots";
import { LENS_FOV, dialPoint, rollPlan, targetX } from "@/capture/turn";
import { setMode } from "@/game/mode";
import { modeThemes, motion, ref } from "@/theme/tokens";
import { ART } from "../../art";
import { CHROME } from "../../look";
import { Rangefinder } from "../../Rangefinder";
import { COPY, counterCopy, libraryError, promptCopy, shutterLabel, thinkingCopy, turnCopy } from "../copy";
import { ArrowLeftIcon } from "@/components/icons";
import { SquareButton } from "../SquareButton";
import { ULTRA_WIDE_LENS } from "../useLenses";
import { resetTurnSensorForTests } from "../useTurnTracking";
import { frameFor, viewfinderLayout } from "../Viewfinder";

// A stand-in CameraView: a class (so the screen's ref gets its methods) that
// renders a host View carrying every prop, so tests can read flash and
// selectedLens and fire onCameraReady / onMountError.
jest.mock("expo-camera", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  // `mounted`: the selectedLens each CameraView was created with; `swapped`: any changed on a mounted one.
  const mockCamera = { takePictureAsync: jest.fn(), getAvailableLensesAsync: jest.fn(), mounted: [] as unknown[], swapped: [] as unknown[] };
  class CameraView extends React.Component<Record<string, unknown>> {
    constructor(props: Record<string, unknown>) {
      super(props);
      mockCamera.mounted.push(props.selectedLens);
    }
    componentDidUpdate(prev: Record<string, unknown>) {
      if (prev.selectedLens !== this.props.selectedLens) mockCamera.swapped.push(this.props.selectedLens);
      if (prev.ratio !== this.props.ratio) mockCamera.swapped.push(this.props.ratio);
    }
    takePictureAsync(options: unknown) {
      return mockCamera.takePictureAsync(options);
    }
    getAvailableLensesAsync() {
      return mockCamera.getAvailableLensesAsync();
    }
    render() {
      return React.createElement(View, this.props);
    }
  }
  return { CameraView, mockCamera };
});
jest.mock("expo-router", () => {
  const { useEffect } = jest.requireActual<typeof import("react")>("react");
  return {
    router: { push: jest.fn(), back: jest.fn() },
    useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]),
    // Every camera in a test is focused unless a test says otherwise (mockFocus).
    useIsFocused: () => mockFocus.focused,
  };
});
const mockFocus = { focused: true };
jest.mock("expo-image-picker", () => ({ launchImageLibraryAsync: jest.fn() }));
// A DeviceMotion the test drives (as in turnDial-test): off unless a test turns it on.
type MockMotionListener = (sample: unknown) => void;
jest.mock("expo-sensors", () => {
  const listeners = new Set<MockMotionListener>();
  return {
    DeviceMotion: {
      isAvailableAsync: jest.fn(async () => false),
      setUpdateInterval: jest.fn(),
      addListener: jest.fn((fn: MockMotionListener) => {
        listeners.add(fn);
        return { remove: () => listeners.delete(fn) };
      }),
    },
    mockMotion: { listeners },
  };
});
jest.mock("@/capture/process-photo", () => ({ processPhoto: jest.fn() }));
// Stable spies in the full shape, so a test can see which haptic a moment gave.
const mockFeedback = { tick: jest.fn(), tap: jest.fn(), press: jest.fn(), thud: jest.fn(), shutter: jest.fn(), success: jest.fn(), warning: jest.fn(), error: jest.fn() };
jest.mock("@/game/feedback", () => ({ useFeedback: () => mockFeedback }));
// A bake that is ready at once ("baked/<mode>/<photo>"), and none in the shell, as the real one.
jest.mock("@/components/noir/treatPhoto", () => ({
  ...jest.requireActual("@/components/noir/treatPhoto"),
  useTreatedPhoto: (source: string, genre: string | null) => (genre ? `baked/${genre}/${source}` : null),
}));

const sensors = jest.requireMock<{
  DeviceMotion: { isAvailableAsync: jest.Mock };
  mockMotion: { listeners: Set<MockMotionListener> };
}>("expo-sensors");
const camera = jest.requireMock<{
  mockCamera: { takePictureAsync: jest.Mock; getAvailableLensesAsync: jest.Mock; mounted: unknown[]; swapped: unknown[] };
}>("expo-camera").mockCamera;
const launch = jest.mocked(ImagePicker.launchImageLibraryAsync);
const develop = jest.mocked(processPhoto);
const push = jest.mocked(router.push);
const back = jest.mocked(router.back);
const announce = jest.mocked(AccessibilityInfo.announceForAccessibility);
const hidden = { includeHiddenElements: true } as const;
// The roll's prompts: 1x's 7 photos 51.4 apart (the default lens), 0.5x's 5 72 apart.
const SEVEN = platePrompts(rollPlan("main").stops);
const FIVE = platePrompts(rollPlan("wide").stops);
/** 1x's turn between photos. */
const STEP = 360 / 7;

const raw = (name: string): RawPhoto => ({ uri: `file://raw-${name}.jpg`, width: 3000, height: 4000 });
const plateFor = (photo: RawPhoto): ProcessedPlate => ({ uri: photo.uri.replace("raw", "plate"), width: 1200, height: 1600 });
const picked = (...names: string[]) => ({ canceled: false, assets: names.map(raw) }) as ImagePicker.ImagePickerResult;

function seedRoll(count: number) {
  for (let i = 0; i < count; i++) addPlate({ uri: `file://old-${i}.jpg`, width: 1200, height: 1600 });
}

/** processPhoto calls that finish only when the test says so. */
function holdProcessing() {
  const pending: { finish: () => void; fail: () => void }[] = [];
  develop.mockImplementation((photo) => new Promise<ProcessedPlate>((resolve, reject) => {
    pending.push({ finish: () => resolve(plateFor(photo)), fail: () => reject(new Error("decode failed")) });
  }));
  return pending;
}

// The viewfinder area on 393 x 852 (safe 59 / 34): x 14-379, y 140-626.7: 1x's 3:4 well fills it; 0.5x's 9:16 one is 273.8 wide.
const AREA = { width: 365, height: 486.7 };

async function renderCamera(retakeIndex: number | null = null) {
  const onClose = jest.fn();
  await render(<Rangefinder retakeIndex={retakeIndex} onClose={onClose} />);
  // The mount (and the camera in it) mounts once the viewfinder area is laid out.
  await fireEvent(screen.getByTestId("viewfinder"), "layout", { nativeEvent: { layout: { x: 0, y: 0, ...AREA } } });
  return { onClose };
}

const cameraProps = () => screen.getByTestId("camera", hidden).props;
/**
 * The camera says it's ready. Twice: once the lens list is read a camera for
 * the roll's lens may mount in its place (each lens is its own CameraView),
 * and that one says so too.
 */
const cameraReady = async () => {
  await act(async () => cameraProps().onCameraReady());
  await act(async () => cameraProps().onCameraReady());
};
/** The player picks a lens; the new lens's camera mounts and says it's ready. */
const pickLens = async (name: string) => {
  await fireEvent.press(screen.getByRole("radio", { name }));
  await act(async () => cameraProps().onCameraReady());
};
const prompt = () => screen.getByRole("header").props.accessibilityLabel as string;
const counter = () => screen.getByTestId("plate-counter").props.accessibilityLabel as string;
/** The turn dial's count ("Photo 2 of 7"): its screen-reader line, without the full stop or the "far enough" sentence. */
const dialLine = () => (screen.getByTestId("turn-dial").props.accessibilityLabel as string).split(".")[0];
/** The plan's count engraved beside the frame counter's window ("/7"). */
const counterTotal = () => [screen.getByTestId("plate-counter-total", hidden).props.children].flat().join("");
const stateOf = (node: { props: { accessibilityState?: Record<string, unknown> } }) => node.props.accessibilityState ?? {};
const flat = (node: { props: Record<string, unknown> }) => StyleSheet.flatten(node.props.style as Parameters<typeof StyleSheet.flatten>[0]) ?? {};
const flush = () => act(async () => {});
/** The thumbnail's photo (expo-image hands its native view a list of sources). */
const thumbnailUri = () => ([screen.getByTestId("last-plate-photo", hidden).props.source].flat()[0] as { uri: string }).uri;

let motionClock = 100;
/** The phone upright, turning right at `rate` deg/s for `seconds`: iOS's DeviceMotion, 30 samples a second, deg/s and seconds. */
async function turnPhone(rate: number, seconds: number) {
  await act(async () => {
    const samples = Math.round(seconds * 30);
    for (let i = 0; i <= samples; i += 1) {
      motionClock += i === 0 ? 0 : 1 / 30;
      const sample = {
        // A turn to the right is a negative rotation about the phone's y axis (up).
        rotationRate: { alpha: 0, beta: -rate, gamma: 0, timestamp: motionClock },
        accelerationIncludingGravity: { x: 0, y: -9.8, z: 0, timestamp: motionClock },
      };
      for (const fn of sensors.mockMotion.listeners) fn(sample);
    }
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  clearPlates();
  resetTurnSensorForTests();
  sensors.DeviceMotion.isAvailableAsync.mockResolvedValue(false);
  sensors.mockMotion.listeners.clear();
  motionClock = 100;
  develop.mockImplementation(async (photo) => plateFor(photo));
  camera.takePictureAsync.mockResolvedValue(raw("shot"));
  camera.mounted.length = 0;
  camera.swapped.length = 0;
  mockFocus.focused = true;
  // An iPhone with an ultra-wide, as most are: 0.5 is offered once the camera is ready; the 360 runs on 1x.
  camera.getAvailableLensesAsync.mockResolvedValue([{ deviceType: ULTRA_WIDE_LENS, localizedName: "Back Ultra Wide Camera" }]);
});

describe("Rangefinder: camera starting", () => {
  it("opens on plate I with the controls that need the camera dimmed, and back and library live", async () => {
    await renderCamera();
    expect(prompt()).toBe("Start here. Stand in the middle. Face any wall.");
    // A new roll starts on 1x's 8, the default lens, before and after the lenses are read.
    expect(counter()).toBe("Next: photo 1. 0 of 7 photos taken.");
    expect(screen.getByText("1", hidden)).toBeTruthy();
    expect(screen.getByText(COPY.privacy)).toBeTruthy();
    expect(stateOf(screen.getByRole("button", { name: "Take photo 1, Start here" }))).toMatchObject({ disabled: true });
    expect(stateOf(screen.getByRole("switch", { name: "Flash" }))).toMatchObject({ disabled: true, checked: false });
    expect(stateOf(screen.getByRole("switch", { name: "Framing grid" }))).toMatchObject({ disabled: true, checked: false });
    expect(stateOf(screen.getByRole("button", { name: "Close the camera" })).disabled).toBeFalsy();
    expect(stateOf(screen.getByRole("button", { name: "Choose photos from your library" }))).toMatchObject({ disabled: false });
    // The empty well before plate I: disabled, never a target.
    expect(stateOf(screen.getByRole("button", { name: "Review your photos, 0 photos taken" }))).toMatchObject({ disabled: true });
    expect(screen.queryByRole("radio")).toBeNull();
  });

  it("draws 1x's frame 3:4 with the 4:3 feed, flash off and the default lens", async () => {
    await renderCamera();
    expect(cameraProps()).toMatchObject({ facing: "back", mode: "picture", ratio: "4:3", flash: "off" });
    expect(cameraProps().selectedLens).toBeUndefined();
  });

  it("moves screen-reader focus to the prompt once the rangefinder has faded in", async () => {
    jest.useFakeTimers();
    try {
      await renderCamera();
      expect(AccessibilityInfo.sendAccessibilityEvent).not.toHaveBeenCalled();
      await act(async () => {
        jest.advanceTimersByTime(motion.sceneCrossfade);
      });
      expect(AccessibilityInfo.sendAccessibilityEvent).toHaveBeenCalledWith(expect.anything(), "focus");
    } finally {
      jest.useRealTimers();
    }
  });
});

describe("Rangefinder: ready", () => {
  it("brings the shutter, flash and grid live", async () => {
    await renderCamera();
    await cameraReady();
    expect(stateOf(screen.getByRole("button", { name: "Take photo 1, Start here" }))).toMatchObject({ disabled: false, busy: false });
    expect(stateOf(screen.getByRole("switch", { name: "Flash" }))).toMatchObject({ disabled: false });
    expect(stateOf(screen.getByRole("switch", { name: "Framing grid" }))).toMatchObject({ disabled: false });
  });

  it("toggles flash (glyph and checked state) and the framing grid", async () => {
    await renderCamera();
    await cameraReady();
    await fireEvent.press(screen.getByRole("switch", { name: "Flash" }));
    expect(stateOf(screen.getByRole("switch", { name: "Flash" }))).toMatchObject({ checked: true });
    expect(cameraProps().flash).toBe("on");
    await fireEvent.press(screen.getByRole("switch", { name: "Framing grid" }));
    expect(stateOf(screen.getByRole("switch", { name: "Framing grid" }))).toMatchObject({ checked: true });
    await fireEvent.press(screen.getByRole("switch", { name: "Flash" }));
    expect(cameraProps().flash).toBe("off");
    // Each toggle is a light tick.
    expect(mockFeedback.tick).toHaveBeenCalledTimes(3);
  });

  it("offers 0.5x only when the lens list reports an ultra-wide, and starts on 1x", async () => {
    camera.getAvailableLensesAsync.mockResolvedValue([
      { deviceType: "AVCaptureDeviceTypeBuiltInWideAngleCamera", localizedName: "Back Camera" },
      { deviceType: ULTRA_WIDE_LENS, localizedName: "Back Ultra Wide Camera" },
    ]);
    await renderCamera();
    expect(screen.queryByRole("radio")).toBeNull();
    expect(cameraProps().selectedLens).toBeUndefined();
    await cameraReady();
    expect(screen.getByTestId("lens").props).toMatchObject({ accessibilityRole: "radiogroup", accessibilityLabel: "Lens" });
    // The 360 and its turn guide are tuned for 1x: the default, the phone's own back camera.
    expect(stateOf(screen.getByRole("radio", { name: "Main lens" }))).toMatchObject({ selected: true });
    expect(stateOf(screen.getByRole("radio", { name: "Ultra-wide lens" }))).toMatchObject({ selected: false });
    expect(cameraProps().selectedLens).toBeUndefined();
    expect(screen.getByText("0.5")).toBeTruthy();
    expect(screen.getByText("1.0")).toBeTruthy();
    // The default is not a change: no tick.
    expect(mockFeedback.tick).not.toHaveBeenCalled();
    // The player can switch to 0.5, and back.
    await fireEvent.press(screen.getByRole("radio", { name: "Ultra-wide lens" }));
    expect(cameraProps().selectedLens).toBe(ULTRA_WIDE_LENS);
    expect(mockFeedback.tick).toHaveBeenCalledTimes(1);
    // A fresh camera for the new lens: the shutter, flash and lens wait until it says it's ready.
    expect(stateOf(screen.getByTestId("shutter"))).toMatchObject({ disabled: true });
    expect(stateOf(screen.getByRole("radio", { name: "Main lens" }))).toMatchObject({ disabled: true });
    await act(async () => cameraProps().onCameraReady());
    expect(stateOf(screen.getByTestId("shutter"))).toMatchObject({ disabled: false });
    // The lens already chosen: nothing moves, so no tick.
    await fireEvent.press(screen.getByRole("radio", { name: "Ultra-wide lens" }));
    expect(mockFeedback.tick).toHaveBeenCalledTimes(1);
    await pickLens("Main lens");
    expect(cameraProps().selectedLens).toBeUndefined();
    expect(mockFeedback.tick).toHaveBeenCalledTimes(2);
  });

  it("never swaps the lens under a running camera: each lens mounts its own, created on that lens", async () => {
    await renderCamera();
    await cameraReady();
    await pickLens("Ultra-wide lens");
    await pickLens("Main lens");
    expect(camera.mounted).toEqual([undefined, ULTRA_WIDE_LENS, undefined]);
    // Neither the lens nor the feed's ratio ever changes on a mounted camera: each lens's camera starts on its own.
    expect(camera.swapped).toEqual([]);
    expect(cameraProps().ratio).toBe("4:3");
  });

  it("frames each lens its own way: 1x 3:4 with the 4:3 feed, 0.5x a tall 9:16 with the 16:9 feed, and crops each photo to it", async () => {
    await renderCamera();
    await cameraReady();
    const well = () => flat(screen.getByTestId("viewfinder-well"));
    expect(well().width).toBe(AREA.width);
    expect(well().height).toBeCloseTo(AREA.height, 0);
    await fireEvent.press(screen.getByTestId("shutter"));
    await flush();
    expect(develop).toHaveBeenLastCalledWith(raw("shot"), 3 / 4);
    await pickLens("Ultra-wide lens");
    expect(cameraProps().ratio).toBe("16:9");
    expect(well().height).toBe(AREA.height);
    expect(well().width).toBeCloseTo((AREA.height * 9) / 16, 6);
    expect(frameFor("wide")).toEqual({ aspect: 9 / 16, ratio: "16:9" });
    await fireEvent.press(screen.getByTestId("shutter"));
    await flush();
    expect(develop).toHaveBeenLastCalledWith(raw("shot"), 9 / 16);
  });

  it("never loops with two cameras mounted at once on different lenses (one left under the review screen, one pushed for a retake)", async () => {
    // The worst case: both say they're focused. Each commits its own lens once, on a change of its own.
    await render(
      <>
        <Rangefinder retakeIndex={null} onClose={jest.fn()} />
        <Rangefinder retakeIndex={null} onClose={jest.fn()} />
      </>,
    );
    for (const area of screen.getAllByTestId("viewfinder")) await fireEvent(area, "layout", { nativeEvent: { layout: { x: 0, y: 0, ...AREA } } });
    const cams = () => screen.getAllByTestId("camera", hidden);
    for (let i = 0; i < 2; i += 1) {
      await act(async () => cams()[i].props.onCameraReady());
      await act(async () => cams()[i].props.onCameraReady());
    }
    // The first camera goes to 0.5; the second stays on 1.0 and doesn't pull the roll back.
    await fireEvent.press(screen.getAllByRole("radio", { name: COPY.ultraWide })[0]);
    await flush();
    expect(getRollPlanState().lens).toBe("wide");
    expect(stateOf(screen.getAllByRole("radio", { name: COPY.mainLens })[1])).toMatchObject({ selected: true });
    // The second one changing its own lens commits once, and the first doesn't answer back.
    await fireEvent.press(screen.getAllByRole("radio", { name: COPY.mainLens })[0]);
    await fireEvent.press(screen.getAllByRole("radio", { name: COPY.ultraWide })[1]);
    await flush();
    expect(getRollPlanState().lens).toBe("wide");
  });

  it("only the focused camera tells the roll its lens", async () => {
    setRollLens("wide");
    mockFocus.focused = false;
    await renderCamera();
    await cameraReady();
    await act(async () => cameraProps().onCameraReady());
    await fireEvent.press(screen.getByRole("radio", { name: COPY.mainLens }));
    await flush();
    // Not focused: the roll keeps its lens.
    expect(getRollPlanState().lens).toBe("wide");
  });

  it("keeps the ultra-wide once seen, when the ultra-wide's own camera reports a list without it", async () => {
    await renderCamera();
    await cameraReady();
    await pickLens(COPY.ultraWide);
    const mounts = camera.mounted.length;
    // The ultra-wide's camera lists only the main lens (or nothing) as it starts.
    await act(async () => cameraProps().onAvailableLensesChanged({ lenses: [{ deviceType: "AVCaptureDeviceTypeBuiltInWideAngleCamera", localizedName: "Back Camera" }] }));
    await act(async () => cameraProps().onAvailableLensesChanged({ lenses: [] }));
    await flush();
    // Still 0.5: no flip back to 1.0, no new camera, the segment still there.
    expect(cameraProps().selectedLens).toBe(ULTRA_WIDE_LENS);
    expect(camera.mounted).toHaveLength(mounts);
    expect(stateOf(screen.getByRole("radio", { name: COPY.ultraWide }))).toMatchObject({ selected: true });
    expect(getRollPlanState().lens).toBe("wide");
  });

  it("frees the shutter if a new lens's camera never says it's ready", async () => {
    jest.useFakeTimers();
    try {
      await renderCamera();
      await cameraReady();
      await fireEvent.press(screen.getByRole("radio", { name: "Ultra-wide lens" }));
      expect(stateOf(screen.getByTestId("shutter"))).toMatchObject({ disabled: true });
      await act(async () => {
        jest.advanceTimersByTime(2000);
      });
      expect(stateOf(screen.getByTestId("shutter"))).toMatchObject({ disabled: false });
    } finally {
      jest.useRealTimers();
    }
  });

  it("stays on 1x where the phone reports no ultra-wide", async () => {
    camera.getAvailableLensesAsync.mockResolvedValue([{ deviceType: "AVCaptureDeviceTypeBuiltInWideAngleCamera", localizedName: "Back Camera" }]);
    await renderCamera();
    await cameraReady();
    expect(cameraProps().selectedLens).toBeUndefined();
  });

  it("keeps the centre slot empty without an ultra-wide lens", async () => {
    camera.getAvailableLensesAsync.mockResolvedValue([{ deviceType: "AVCaptureDeviceTypeBuiltInWideAngleCamera", localizedName: "Back Camera" }]);
    await renderCamera();
    await cameraReady();
    expect(screen.queryByRole("radio")).toBeNull();
  });
});

describe("Rangefinder: capture", () => {
  it("takes, re-encodes and keeps the plate, then advances the prompt, counter and thumbnail", async () => {
    await renderCamera();
    await cameraReady();
    await fireEvent.press(screen.getByRole("button", { name: "Take photo 1, Start here" }));
    await flush();
    expect(camera.takePictureAsync).toHaveBeenCalledWith({ quality: 0.92, exif: false });
    // The shutter firing: one shutter cue, nothing stacked on it.
    expect(mockFeedback.shutter).toHaveBeenCalledTimes(1);
    expect(mockFeedback.tick).not.toHaveBeenCalled();
    expect(mockFeedback.success).not.toHaveBeenCalled();
    // Cropped to 1x's 3:4 frame the player saw.
    expect(develop).toHaveBeenCalledWith(raw("shot"), 3 / 4);
    expect(frameFor("main")).toEqual({ aspect: 3 / 4, ratio: "4:3" });
    expect(getPlates().map((p) => p.uri)).toEqual(["file://plate-shot.jpg"]);
    expect(prompt()).toBe("Turn right a little. Keep a sliver of the last photo in view.");
    expect(counter()).toBe("Next: photo 2. 1 of 7 photos taken.");
    expect(screen.getByRole("button", { name: "Take photo 2, Turn right a little" })).toBeTruthy();
    expect(thumbnailUri()).toBe("file://plate-shot.jpg");
    // The privacy note is only for plate I: it fades, then goes.
    await waitFor(() => expect(screen.queryByText(COPY.privacy)).toBeNull());
    // Jest runs as iOS, which has no live regions: the new prompt is announced.
    expect(announce).toHaveBeenCalledWith("Turn right a little. Keep a sliver of the last photo in view.");
  });

  it("is busy while the plate develops: taps ignored, library, flash and thumbnail dimmed, back and grid live", async () => {
    seedRoll(1);
    const pending = holdProcessing();
    await renderCamera();
    await cameraReady();
    const user = userEvent.setup();
    // A camera opened on a photo already taken: photo 2 is placed by photo 1, not a turn from where the player stands.
    await user.press(screen.getByRole("button", { name: "Take photo 2, Photo 2" }));
    await flush();
    expect(stateOf(screen.getByTestId("shutter"))).toMatchObject({ busy: true });
    await user.press(screen.getByTestId("shutter"));
    expect(camera.takePictureAsync).toHaveBeenCalledTimes(1);
    expect(stateOf(screen.getByRole("button", { name: "Choose photos from your library" }))).toMatchObject({ disabled: true });
    expect(stateOf(screen.getByRole("switch", { name: "Flash" }))).toMatchObject({ disabled: true });
    expect(stateOf(screen.getByRole("button", { name: "Review your photos, 1 photo taken" }))).toMatchObject({ disabled: true });
    expect(stateOf(screen.getByRole("switch", { name: "Framing grid" }))).toMatchObject({ disabled: false });
    expect(stateOf(screen.getByRole("button", { name: "Close the camera" })).disabled).toBeFalsy();
    // The prompt holds the plate being developed.
    expect(prompt()).toBe("Photo 2. From the middle, face photo 1's view, then turn right a little.");
    await act(async () => pending[0].finish());
    // Photo 2 taken here: photo 3 is the next turn from it.
    expect(prompt()).toBe("Keep turning. Keep a sliver of the last photo in view.");
    expect(stateOf(screen.getByTestId("shutter"))).toMatchObject({ busy: false, disabled: false });
  });

  it("shows the thinking line in the subtitle slot only once a wait passes ~1 s", async () => {
    jest.useFakeTimers();
    try {
      const pending = holdProcessing();
      await renderCamera();
      await cameraReady();
      await userEvent.setup({ advanceTimers: jest.advanceTimersByTime }).press(screen.getByTestId("shutter"));
      await flush();
      expect(prompt()).toBe("Start here. Stand in the middle. Face any wall.");
      await act(async () => {
        jest.advanceTimersByTime(ref.layout.camera.thinkingDelay);
      });
      expect(prompt()).toBe("Start here. Preparing photo 1");
      expect(screen.getByTestId("thinking", hidden)).toBeTruthy();
      await act(async () => pending[0].finish());
      expect(screen.queryByTestId("thinking", hidden)).toBeNull();
      expect(prompt()).toBe("Turn right a little. Keep a sliver of the last photo in view.");
    } finally {
      jest.useRealTimers();
    }
  });

  it("turns the subtitle into the error line until the next attempt", async () => {
    camera.takePictureAsync.mockRejectedValueOnce(new Error("busy"));
    await renderCamera();
    await cameraReady();
    await fireEvent.press(screen.getByTestId("shutter"));
    await flush();
    expect(prompt()).toBe(`Start here. ${COPY.captureError}`);
    expect(screen.getByText(COPY.captureError, hidden)).toBeTruthy();
    // A failed shot: the error haptic, and no shutter cue (nothing was taken).
    expect(mockFeedback.error).toHaveBeenCalledTimes(1);
    expect(mockFeedback.shutter).not.toHaveBeenCalled();
    expect(getPlates()).toHaveLength(0);
    await fireEvent.press(screen.getByTestId("shutter"));
    await flush();
    expect(prompt()).toBe("Turn right a little. Keep a sliver of the last photo in view.");
  });

  it("says when the camera didn't start, keeps the shutter, flash and grid dimmed and never offers a lens", async () => {
    camera.getAvailableLensesAsync.mockResolvedValue([{ deviceType: ULTRA_WIDE_LENS, localizedName: "Back Ultra Wide Camera" }]);
    await renderCamera();
    await act(async () => cameraProps().onMountError({ message: "no camera" }));
    expect(prompt()).toBe(`Start here. ${COPY.mountError}`);
    expect(stateOf(screen.getByTestId("shutter"))).toMatchObject({ disabled: true });
    expect(stateOf(screen.getByRole("switch", { name: "Flash" }))).toMatchObject({ disabled: true });
    expect(stateOf(screen.getByRole("switch", { name: "Framing grid" }))).toMatchObject({ disabled: true });
    expect(stateOf(screen.getByRole("button", { name: "Choose photos from your library" }))).toMatchObject({ disabled: false });
    expect(screen.queryByRole("radio")).toBeNull();
  });
});

describe("Rangefinder: the photos taken", () => {
  it("names the review screen, then says the case is ready to build from 3 photos", async () => {
    seedRoll(2);
    await renderCamera();
    expect(screen.getByRole("button", { name: "Review your photos, 2 photos taken" })).toBeTruthy();
    await act(async () => {
      addPlate({ uri: "file://third.jpg", width: 1200, height: 1600 });
    });
    const thumbnail = screen.getByRole("button", { name: "Review your photos, 3 photos taken. Ready to build." });
    expect(stateOf(thumbnail)).toMatchObject({ disabled: false });
    expect(thumbnailUri()).toBe("file://third.jpg");
    await fireEvent.press(thumbnail);
    expect(push).toHaveBeenCalledWith("/capture/review");
  });

  it("gives the success haptic when the 7th photo fills the set on 1x, and only then", async () => {
    seedRoll(5);
    await renderCamera();
    await cameraReady();
    await fireEvent.press(screen.getByTestId("shutter"));
    await flush();
    expect(getPlates()).toHaveLength(6);
    expect(mockFeedback.success).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId("shutter"));
    await flush();
    expect(getPlates()).toHaveLength(7);
    expect(mockFeedback.success).toHaveBeenCalledTimes(1);
    expect(mockFeedback.shutter).toHaveBeenCalledTimes(2);
    expect(stateOf(screen.getByTestId("shutter"))).toMatchObject({ disabled: true });
  });

  it("gives it at the 5th on a roll being taken on 0.5x", async () => {
    setRollLens("wide");
    seedRoll(3);
    await renderCamera();
    await cameraReady();
    expect(stateOf(screen.getByRole("radio", { name: COPY.ultraWide }))).toMatchObject({ selected: true });
    expect(counter()).toBe("Next: photo 4. 3 of 5 photos taken.");
    await fireEvent.press(screen.getByTestId("shutter"));
    await flush();
    expect(mockFeedback.success).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId("shutter"));
    await flush();
    expect(getPlates()).toHaveLength(5);
    expect(mockFeedback.success).toHaveBeenCalledTimes(1);
  });

  it("presses lightly on the square header buttons and the last-photo thumbnail", async () => {
    seedRoll(1);
    await renderCamera();
    await cameraReady();
    const user = userEvent.setup();
    await user.press(screen.getByTestId("back"));
    await user.press(screen.getByTestId("last-plate"));
    expect(mockFeedback.press).toHaveBeenCalledTimes(2);
  });

  it("is full at 7 photos on 1x: all the way round, 7 on the counter, shutter and library off, flash and grid live", async () => {
    seedRoll(7);
    await renderCamera();
    await cameraReady();
    expect(prompt()).toBe("All the way round. Review your photos.");
    expect(counter()).toBe("7 of 7 photos taken. That's all the way round.");
    expect(counterCopy({ index: 7, retake: false, prompts: SEVEN })).toMatchObject({ current: 6, numeral: "7", solo: false });
    expect(stateOf(screen.getByTestId("shutter"))).toMatchObject({ disabled: true });
    expect(stateOf(screen.getByRole("button", { name: "Choose photos from your library" }))).toMatchObject({ disabled: true });
    expect(stateOf(screen.getByRole("switch", { name: "Flash" }))).toMatchObject({ disabled: false });
    expect(stateOf(screen.getByRole("button", { name: "Review your photos, 7 photos taken. Ready to build." }))).toMatchObject({ disabled: false });
  });

  it("is full at 5 photos on 0.5x", async () => {
    setRollLens("wide");
    seedRoll(5);
    await renderCamera();
    await cameraReady();
    expect(counter()).toBe("5 of 5 photos taken. That's all the way round.");
    expect(stateOf(screen.getByTestId("shutter"))).toMatchObject({ disabled: true });
  });

  it("imports library picks one by one and counts the failures in the error line", async () => {
    launch.mockResolvedValue(picked("a", "b", "c"));
    develop.mockImplementation(async (photo) => {
      if (photo.uri.includes("raw-b")) throw new Error("decode failed");
      return plateFor(photo);
    });
    await renderCamera();
    await fireEvent.press(screen.getByRole("button", { name: "Choose photos from your library" }));
    await flush();
    expect(launch).toHaveBeenCalledWith(expect.objectContaining({ allowsMultipleSelection: true, selectionLimit: 7 }));
    expect(getPlates().map((p) => p.uri)).toEqual(["file://plate-a.jpg", "file://plate-c.jpg"]);
    // Library photos weren't taken from where the player stands: photo 3 is placed by photo 2.
    expect(prompt()).toBe(`Photo 3. ${libraryError(1)}`);
    expect(libraryError(1)).toBe("One photo couldn't be used.");
    expect(libraryError(2)).toBe("2 photos couldn't be used.");
  });

  it("counts a multi-photo import in the thinking line and holds the prompt until it ends", async () => {
    jest.useFakeTimers();
    try {
      const pending = holdProcessing();
      launch.mockResolvedValue(picked("a", "b"));
      await renderCamera();
      await userEvent.setup({ advanceTimers: jest.advanceTimersByTime }).press(screen.getByRole("button", { name: COPY.library }));
      await flush();
      await act(async () => {
        jest.advanceTimersByTime(ref.layout.camera.thinkingDelay);
      });
      // A fixed status for screen readers; the visible line counts real progress.
      expect(prompt()).toBe("Start here. Preparing 2 photos");
      expect(screen.getByText("Preparing photo 1 of 2", hidden)).toBeTruthy();
      await act(async () => pending[0].finish());
      expect(getPlates()).toHaveLength(1);
      expect(prompt()).toBe("Start here. Preparing 2 photos");
      expect(counter()).toBe("Next: photo 1. 0 of 7 photos taken.");
      expect(screen.getByText("Preparing photo 2 of 2", hidden)).toBeTruthy();
      await act(async () => pending[1].finish());
      expect(prompt()).toBe("Photo 3. From the middle, face photo 2's view, then turn right a little.");
      expect(counter()).toBe("Next: photo 3. 2 of 7 photos taken.");
      expect(screen.queryByTestId("thinking", hidden)).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });
});

describe("Rangefinder: photos keep their slots", () => {
  it("aims the next shot at the first open slot: its prompt, its numeral, and the count of photos filled", async () => {
    seedRoll(4);
    removePlate(1);
    await renderCamera();
    await cameraReady();
    // Out of turn: the open slot's view and where to aim, between its neighbours (not "Turn right a little").
    expect(prompt()).toBe("Photo 2. From the middle, aim between photos 1 and 3.");
    expect(counter()).toBe("Next: photo 2. 3 of 7 photos taken.");
    expect(screen.getByRole("button", { name: "Take photo 2, Photo 2" })).toBeTruthy();
    await fireEvent.press(screen.getByTestId("shutter"));
    await flush();
    // The shot fills slot 2; the others never moved.
    expect(getSlots().map((p) => p?.uri)).toEqual(["file://old-0.jpg", "file://plate-shot.jpg", "file://old-2.jpg", "file://old-3.jpg"]);
    expect(counter()).toBe("Next: photo 5. 4 of 7 photos taken.");
  });

  it("takes an open slot from the review screen as a first take, not a retake, then returns", async () => {
    seedRoll(4);
    removePlate(2);
    const { onClose } = await renderCamera(2);
    await cameraReady();
    // Out of turn: where to aim, as for a retake.
    expect(prompt()).toBe("Photo 3. From the middle, aim between photos 2 and 4.");
    expect(counter()).toBe("Taking photo 3.");
    expect(screen.getByRole("button", { name: "Take photo 3, Photo 3" })).toBeTruthy();
    expect(screen.getByTestId("back").props.accessibilityLabel).toBe(COPY.cancelFill);
    await fireEvent.press(screen.getByTestId("shutter"));
    await flush();
    expect(getSlots()[2]?.uri).toBe("file://plate-shot.jpg");
    expect(getPlates()).toHaveLength(4);
    expect(back).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("Rangefinder: retake mode", () => {
  it("retakes the plate's prompt with its numeral alone on the counter, no privacy note and cancel labels", async () => {
    seedRoll(3);
    const { onClose } = await renderCamera(1);
    // Out of turn: the view's name and where to aim, between its neighbours round the circle.
    expect(prompt()).toBe("Photo 2. From the middle, aim between photos 1 and 3.");
    expect(counter()).toBe("Retaking photo 2.");
    // The retaken plate's numeral shows alone: its neighbours are hidden.
    expect(flat(screen.getByText("2", hidden)).opacity).toBe(1);
    for (const neighbour of ["1", "3"]) expect(flat(screen.getByText(neighbour, hidden))).toMatchObject({ opacity: 0 });
    expect(screen.getByRole("button", { name: "Retake photo 2, Photo 2" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Choose a photo instead" })).toBeTruthy();
    expect(screen.queryByText(COPY.privacy)).toBeNull();
    // The thumbnail shows the plate being replaced, with no ring, and cancels.
    expect(thumbnailUri()).toBe("file://old-1.jpg");
    const thumbnail = screen.getByTestId("last-plate");
    expect(thumbnail.props.accessibilityLabel).toBe(COPY.cancelRetake);
    await fireEvent.press(thumbnail);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
  });

  it("replaces the photo and returns to the review screen; back is ignored until it settles", async () => {
    seedRoll(3);
    const pending = holdProcessing();
    const backPress = jest.spyOn(BackHandler, "addEventListener");
    const { onClose } = await renderCamera(1);
    await cameraReady();
    const user = userEvent.setup();
    await user.press(screen.getByTestId("shutter"));
    await flush();
    await user.press(screen.getByTestId("back"));
    const hardwareBack = backPress.mock.calls.at(-1)?.[1];
    expect(hardwareBack?.({ type: "hardwareBackPress", timeStamp: 0 })).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => pending[0].finish());
    expect(getPlates()[1].uri).toBe("file://plate-shot.jpg");
    expect(back).toHaveBeenCalledTimes(1);
    backPress.mockRestore();
  });
});

describe("Rangefinder: back", () => {
  it("closes the camera from the back button and Android back", async () => {
    const backPress = jest.spyOn(BackHandler, "addEventListener");
    const { onClose } = await renderCamera();
    await fireEvent.press(screen.getByRole("button", { name: "Close the camera" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    const hardwareBack = backPress.mock.calls.at(-1)?.[1];
    expect(hardwareBack?.({ type: "hardwareBackPress", timeStamp: 0 })).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(2);
    backPress.mockRestore();
  });
});

describe("Rangefinder: hit areas and focus outlines", () => {
  // The kit focus ring's inset: its offset plus its own width.
  const RING_INSET = -(ref.focus.offset + ref.focus.width);
  const ringsIn = (node: ReturnType<typeof screen.getByTestId>) =>
    node.queryAll((n) => flat(n).borderWidth === ref.focus.width && flat(n).borderColor === ref.focus.color);

  it("draws back and library as 44 square push buttons with 48 hit areas inside the header row", async () => {
    await renderCamera();
    const slop = (ref.button.square.hit - ref.button.square.size) / 2;
    expect(ref.button.square.hit).toBeGreaterThanOrEqual(ref.hit.min);
    // Native hit-testing drops touches outside a parent, so the row carries the slop.
    expect(flat(screen.getByTestId("prompt").parent!)).toMatchObject({ paddingVertical: slop, paddingHorizontal: ref.layout.camera.edge });
    for (const id of ["back", "library"]) {
      const control = screen.getByTestId(id);
      expect(flat(control)).toMatchObject({ width: ref.button.square.size, height: ref.button.square.size, borderRadius: ref.button.square.radius });
      // The control carries no border or fill of its own: the button is its picture, centred on it.
      expect(flat(control).borderWidth).toBeUndefined();
      expect(flat(control).backgroundColor).toBeUndefined();
      const art = screen.getByTestId(`${id}-art`, hidden);
      expect(art.props.source).toEqual([ART.buttonSquare].flat());
      expect(flat(art)).toMatchObject({ width: CHROME.square, left: (ref.button.square.size - CHROME.square) / 2 });
      expect(control.props.hitSlop).toBe(slop);
      // The ring follows the rounded square, 2 outside it.
      await fireEvent(control, "focus");
      const rings = ringsIn(control);
      expect(rings).toHaveLength(1);
      expect(flat(rings[0])).toMatchObject({ top: RING_INSET, borderRadius: ref.button.square.radius - RING_INSET });
    }
  });

  it("keeps the flat square everywhere else: without `chrome` the button is the palette's raised fill and rim, with no picture", async () => {
    await render(<SquareButton icon={ArrowLeftIcon} accessibilityLabel="Back" onPress={jest.fn()} testID="plain" />);
    const control = screen.getByTestId("plain");
    expect(flat(control)).toMatchObject({
      width: ref.button.square.size,
      height: ref.button.square.size,
      borderRadius: ref.button.square.radius,
      backgroundColor: ref.button.square.fill,
      borderWidth: ref.button.square.borderWidth,
      borderColor: ref.layout.camera.squareRim,
    });
    expect(screen.queryByTestId("plain-art", hidden)).toBeNull();
    // The ring follows the rounded square, 2 outside its 1 pt rim.
    await fireEvent(control, "focus");
    const rings = ringsIn(control);
    expect(flat(rings[0])).toMatchObject({
      top: RING_INSET - ref.button.square.borderWidth,
      borderRadius: ref.button.square.radius - RING_INSET + ref.button.square.borderWidth,
    });
  });

  it("makes flash and the grid round push buttons filling 48 targets with a round ring, centred on the glyph columns", async () => {
    await renderCamera();
    await cameraReady();
    const { left, right } = ref.layout.camera.controlColumns;
    expect(flat(screen.getByTestId("flash").parent!.parent!)).toMatchObject({
      paddingLeft: left - ref.button.bare.hit / 2,
      paddingRight: right - ref.button.bare.hit / 2,
    });
    for (const id of ["flash", "grid"]) {
      const control = screen.getByTestId(id);
      expect(flat(control)).toMatchObject({ width: ref.button.bare.hit, height: ref.button.bare.hit });
      expect(control.props.hitSlop).toBeUndefined();
      expect(screen.getByTestId(`${id}-art`, hidden).props.source).toEqual([ART.buttonRound].flat());
      expect(flat(screen.getByTestId(`${id}-art`, hidden))).toMatchObject({ width: CHROME.round, height: CHROME.round });
      await fireEvent(control, "focus");
      const rings = ringsIn(control);
      expect(rings).toHaveLength(1);
      expect(flat(rings[0])).toMatchObject({ top: RING_INSET, borderRadius: ref.radius.round });
    }
  });

  it("makes each lens half a 50 x 48 target that offers the large-content viewer, ringed as one track", async () => {
    camera.getAvailableLensesAsync.mockResolvedValue([{ deviceType: ULTRA_WIDE_LENS, localizedName: "Back Ultra Wide Camera" }]);
    await renderCamera();
    await cameraReady();
    const halves = [
      // 1x is chosen by default, so it carries the mark.
      { half: screen.getByRole("radio", { name: COPY.ultraWide }), label: COPY.ultraWideLabel, title: COPY.ultraWideLabel },
      { half: screen.getByRole("radio", { name: COPY.mainLens }), label: COPY.mainLensLabel, title: `${COPY.mainLensLabel}${COPY.lensMark}` },
    ];
    for (const { half, label, title } of halves) {
      expect(flat(half)).toMatchObject({ width: ref.button.segment.width / 2, height: ref.hit.comfortable });
      expect(half.props).toMatchObject({ accessibilityShowsLargeContentViewer: true, accessibilityLargeContentTitle: title });
      expect(screen.getByText(label).props.maxFontSizeMultiplier).toBe(ref.layout.camera.lensMaxFontScale);
    }
    const lens = screen.getByTestId("lens");
    expect(flat(lens)).toMatchObject({ width: ref.button.segment.width, height: ref.hit.comfortable });
    // Either half focused draws one ring around the whole track, concentric with its 16 corners.
    await fireEvent(halves[1].half, "focus");
    const rings = ringsIn(lens);
    expect(rings).toHaveLength(1);
    expect(flat(rings[0])).toMatchObject({ top: RING_INSET, borderRadius: ref.button.segment.radius - RING_INSET });
    expect(rings[0].parent?.props.testID).toBe("lens-track");
  });

  it("rings the 75 shutter as a circle, measured from its unbordered box", async () => {
    await renderCamera();
    await cameraReady();
    const shutter = screen.getByTestId("shutter");
    expect(flat(shutter)).toMatchObject({ width: ref.button.shutter.ring, height: ref.button.shutter.ring });
    expect(flat(shutter).borderWidth).toBeUndefined();
    await fireEvent(shutter, "focus");
    const rings = ringsIn(shutter);
    expect(rings).toHaveLength(1);
    expect(rings[0].parent?.props.testID).toBe("shutter");
    expect(flat(rings[0])).toMatchObject({ top: RING_INSET, borderRadius: ref.radius.round });
  });

  it("rings the thumbnail 2 outside its 72 frame, concentric with its 24 corners", async () => {
    seedRoll(1);
    await renderCamera();
    const thumbnail = screen.getByTestId("last-plate");
    expect(flat(thumbnail)).toMatchObject({ width: ref.button.thumbnail.size, height: ref.button.thumbnail.size });
    expect(flat(thumbnail).borderWidth).toBeUndefined();
    await fireEvent(thumbnail, "focus");
    const rings = ringsIn(thumbnail);
    expect(rings).toHaveLength(1);
    expect(flat(rings[0])).toMatchObject({ top: RING_INSET, borderRadius: ref.button.thumbnail.radius - RING_INSET });
    await fireEvent(thumbnail, "blur");
    expect(ringsIn(thumbnail)).toHaveLength(0);
  });

  it("caps the counter's numerals at 1.25 and lays the plan's numerals on one wide strip, so none wraps", async () => {
    seedRoll(2);
    await renderCamera();
    const C = ref.layout.camera.counter;
    expect(flat(screen.getByTestId("plate-counter"))).toMatchObject({ width: C.width, height: C.height, overflow: "hidden" });
    const strip = screen.getByTestId("plate-counter-strip", hidden);
    expect(flat(strip)).toMatchObject({ flexDirection: "row", gap: C.gap, width: C.width * 7 });
    for (const { numeral } of SEVEN) {
      const text = screen.getByText(numeral, hidden);
      expect(text.props.maxFontSizeMultiplier).toBe(C.maxFontScale);
      expect(text.parent?.props.testID).toBe("plate-counter-strip");
    }
        // On 0.5x, with 2 taken on 1x, the rest re-space: 6 in all, and the strip shrinks to 6.
    await cameraReady();
    await pickLens(COPY.ultraWide);
    expect(rollPlan("wide", rollPlan("main").stops.slice(0, 2)).shots).toBe(6);
    expect(flat(screen.getByTestId("plate-counter-strip", hidden)).width).toBe(C.width * 6);
    expect(screen.queryByText("8", hidden)).toBeNull();
  });
});

describe("Rangefinder: the camera's look", () => {
  const L = ref.layout.camera;
  const source = (id: string) => screen.getByTestId(id, hidden).props.source;
  const picture = (art: unknown) => [art].flat();

  it("lays the body under everything: leather over the palette's ground, under the studio's light, taking no touches", async () => {
    await renderCamera();
    const root = screen.getByTestId("viewfinder").parent!;
    expect(flat(root)).toMatchObject({ backgroundColor: ref.color.ground });
    // The body first, then the header row.
    const body = screen.getByTestId("camera-body", hidden);
    expect(root.children[0]).toBe(body);
    expect(root.children[1]).toBe(screen.getByTestId("prompt").parent);
    expect(body.props).toMatchObject({ pointerEvents: "none", accessibilityElementsHidden: true, importantForAccessibility: "no-hide-descendants" });
    // The leather is a repeated tile filling the screen; the light one stretched picture.
    expect(screen.getByTestId("camera-leather", hidden).props).toMatchObject({ source: ART.leather, resizeMode: "repeat" });
    expect(flat(screen.getByTestId("camera-leather", hidden))).toMatchObject({ position: "absolute", width: "100%", height: "100%" });
    expect(screen.getByTestId("camera-light", hidden).props).toMatchObject({ source: picture(ART.light), contentFit: "fill" });
  });

  it("frames the preview in brass that lies wholly outside it, scaled with the well, per lens", async () => {
    await renderCamera();
    await cameraReady();
    const F = CHROME.finder;
    const outside = (wide: boolean) => {
      const box = viewfinderLayout(AREA, wide ? L.frameAspectWide : L.frameAspect);
      const rim = (F.margin * box.width) / (wide ? F.drawn.wide : F.drawn.main);
      return { left: box.x - rim, top: box.y - rim, width: box.width + rim * 2, height: box.height + rim * 2 };
    };
    const frame = () => screen.getByTestId("viewfinder-frame", hidden);
    expect(frame().props).toMatchObject({ source: picture(ART.finder), pointerEvents: "none", contentFit: "fill" });
    expect(flat(frame())).toMatchObject({ position: "absolute", ...outside(false) });
    // The frame is the well's sibling, not its child: nothing of it is clipped into (or drawn over) the preview.
    expect(screen.getByTestId("viewfinder-well")).not.toContainElement(frame());
    // 1x's frame is drawn for a 365 preview: on it the brass is its own 13 margin all round.
    expect(outside(false).left).toBeCloseTo(-F.margin);
    await pickLens(COPY.ultraWide);
    expect(frame().props.source).toEqual(picture(ART.finderWide));
    expect(flat(frame())).toMatchObject(outside(true));
    expect(outside(true).left).toBeCloseTo(viewfinderLayout(AREA, L.frameAspectWide).x - F.margin, 0);
  });

  it("keeps the glass quiet: one soft still picture, four etched marks, and a blink that is clear at rest; none takes a touch", async () => {
    await renderCamera();
    const glass = screen.getByTestId("viewfinder-glass", hidden);
    expect(glass.props).toMatchObject({ pointerEvents: "none", accessibilityElementsHidden: true });
    expect(screen.getByTestId("viewfinder-well")).toContainElement(glass);
    const marks = glass.queryAll((n) => flat(n).opacity === CHROME.finder.tick.opacity);
    expect(marks).toHaveLength(4);
    for (const mark of marks) expect(Math.max(Number(flat(mark).width), Number(flat(mark).height))).toBe(CHROME.finder.tick.length);
    // The feed is under the glass, and the turn dial and the note over it.
    const order = screen.getByTestId("viewfinder-well").children.map((c) => (typeof c === "string" ? c : c.props.testID));
    expect(order.indexOf("viewfinder-glass")).toBe(1);
    expect(order.indexOf("turn-dial")).toBeGreaterThan(order.indexOf("viewfinder-glass"));
    const blink = screen.getByTestId("shutter-blink", hidden);
    expect(blink.props.pointerEvents).toBe("none");
    expect(flat(blink)).toMatchObject({ backgroundColor: ref.color.void, opacity: 0 });
  });

  it("fits the viewfinder as one 3:4 well, its corner a share of its width, centred in the area", async () => {
    await renderCamera();
    const box = viewfinderLayout(AREA);
    // 1x's frame: on 852 exactly the area.
    expect(box.width).toBe(AREA.width);
    expect(box.width / box.height).toBeCloseTo(L.frameAspect);
    expect(box.y).toBeCloseTo((AREA.height - box.height) / 2);
    // 0.5x's tall frame: as tall as the area, centred across it.
    const tall = viewfinderLayout(AREA, L.frameAspectWide);
    expect(tall.height).toBe(AREA.height);
    expect(tall.width).toBeCloseTo(273.8, 0);
    const well = flat(screen.getByTestId("viewfinder-well"));
    expect(well).toMatchObject({
      left: box.x,
      top: box.y,
      width: box.width,
      height: box.height,
      backgroundColor: ref.color.void,
      borderRadius: CHROME.finder.radius * box.width,
      overflow: "hidden",
    });
    expect(well.borderWidth).toBeUndefined();
    expect(screen.getByTestId("camera", hidden).parent?.parent?.props.testID).toBe("viewfinder-well");
    // A short screen shrinks the well and keeps it 3:4, centred.
    const short = viewfinderLayout({ width: AREA.width, height: AREA.height / 2 });
    expect(short.width / short.height).toBeCloseTo(L.frameAspect);
    expect(short.x).toBeGreaterThan(0);
  });

  it("sets the prompt in the serif over the grey system meta line", async () => {
    await renderCamera();
    expect(flat(screen.getByText("Start here"))).toMatchObject({ ...ref.type.serifTitle, color: ref.color.textPrimary });
    const meta = flat(screen.getByText("Stand in the middle. Face any wall."));
    expect(meta).toMatchObject({ ...ref.type.meta, color: ref.color.textSecondary });
    expect(meta.fontFamily).toBeUndefined();
    // One line each fills the square buttons' 44.
    expect(L.promptTop + ref.type.serifTitle.lineHeight + L.metaGap + ref.type.meta.lineHeight).toBe(ref.button.square.size);
    expect(flat(screen.getByText("Stand in the middle. Face any wall.").parent!).marginTop ?? flat(screen.getByText("Stand in the middle. Face any wall.")).marginTop).toBe(L.metaGap);
  });

  it("writes errors in white beside a white warning glyph: no amber, no oxblood", async () => {
    camera.takePictureAsync.mockRejectedValueOnce(new Error("busy"));
    await renderCamera();
    await cameraReady();
    await fireEvent.press(screen.getByTestId("shutter"));
    await flush();
    expect(flat(screen.getByText(COPY.captureError, hidden))).toMatchObject({ ...ref.type.meta, color: ref.color.textPrimary });
    const glyph = screen.getByTestId("notice-icon", hidden).children[0] as { props: Record<string, unknown> };
    expect(glyph.props).toMatchObject({ color: ref.color.textPrimary, width: L.noticeIcon });
  });

  it("draws the privacy note as a see-through black pill in white meta text", async () => {
    await renderCamera();
    expect(flat(screen.getByTestId("privacy-note"))).toMatchObject({
      borderRadius: ref.radius.round,
      paddingHorizontal: L.note.padX,
      maxWidth: viewfinderLayout(AREA).width - L.note.inset * 2,
    });
    expect(flat(screen.getByTestId("privacy-note-fill"))).toMatchObject({ backgroundColor: ref.color.void, opacity: L.note.fillOpacity });
    expect(flat(screen.getByText(COPY.privacy))).toMatchObject({ ...ref.type.meta, color: ref.color.textPrimary });
  });

  it("draws flash as Once's filled white bolt and the grid as an outline that fills when on", async () => {
    await renderCamera();
    await cameraReady();
    expect(screen.getByTestId("phosphor-react-native-lightning-slash-fill", hidden).props.color).toBe(ref.button.bare.glyph);
    expect(screen.getByTestId("phosphor-react-native-grid-nine-regular", hidden)).toBeTruthy();
    await fireEvent.press(screen.getByRole("switch", { name: "Flash" }));
    await fireEvent.press(screen.getByRole("switch", { name: "Framing grid" }));
    expect(screen.getByTestId("phosphor-react-native-lightning-fill", hidden)).toBeTruthy();
    expect(screen.getByTestId("phosphor-react-native-grid-nine-fill", hidden)).toBeTruthy();
  });

  it("draws the lens selector as a slot in a brass rim with a sliding cursor; the chosen label is followed by the xmark", async () => {
    camera.getAvailableLensesAsync.mockResolvedValue([{ deviceType: ULTRA_WIDE_LENS, localizedName: "Back Ultra Wide Camera" }]);
    await renderCamera();
    await cameraReady();
    const G = ref.button.segment;
    expect(flat(screen.getByTestId("lens-track", hidden))).toMatchObject({ width: G.width, height: G.height, borderRadius: G.radius, backgroundColor: G.fill });
    expect(flat(screen.getByTestId("lens-thumb", hidden))).toMatchObject({ width: G.thumbWidth, height: G.thumbHeight, top: G.inset });
    // The rim round the slot and the cursor are pictures, each its margin bigger than its box.
    expect(source("lens-track-art")).toEqual(picture(ART.lensTrack));
    expect(flat(screen.getByTestId("lens-track-art", hidden))).toMatchObject({ left: -CHROME.lens.track, width: G.width + CHROME.lens.track * 2, height: G.height + CHROME.lens.track * 2 });
    const cursor = screen.getByTestId("lens-thumb", hidden).children[0] as ReturnType<typeof screen.getByTestId>;
    expect(cursor.props.source).toEqual(picture(ART.lensThumb));
    expect(flat(cursor)).toMatchObject({ left: -CHROME.lens.thumb, width: G.thumbWidth + CHROME.lens.thumb * 2 });
    expect(flat(screen.getByText("1.0"))).toMatchObject({ ...ref.type.label });
    const mark = () => screen.getAllByTestId("lens-mark", hidden);
    expect(mark()).toHaveLength(1);
    expect(mark()[0].props.color).toBe(G.active);
    // The mark sits beside the chosen label (1.0 by default), in its thumb's box.
    expect(screen.getByText("1.0").parent?.props).toEqual(mark()[0].parent?.parent?.props);
    await fireEvent.press(screen.getByRole("radio", { name: COPY.ultraWide }));
    expect(mark()).toHaveLength(1);
    expect(screen.getByText("0.5").parent?.props).toEqual(mark()[0].parent?.parent?.props);
  });

  it("sets the counter's italic numerals in a brass-framed window, the plan's count engraved beside it", async () => {
    seedRoll(2);
    await renderCamera();
    const C = L.counter;
    const K = CHROME.counter;
    expect(flat(screen.getByTestId("plate-counter"))).toMatchObject({ backgroundColor: ref.color.void, borderRadius: K.radius });
    expect(flat(screen.getByText("3", hidden))).toMatchObject({ ...ref.type.counter, opacity: 1 });
    // At rest the window shows the current numeral alone: its neighbours show only as the strip rolls.
    for (const neighbour of ["2", "4"]) expect(flat(screen.getByText(neighbour, hidden))).toMatchObject({ opacity: 0 });
    // The bezel and the count overflow the window's own box, which is all the row sees.
    const box = screen.getByTestId("plate-counter").parent!;
    expect(flat(box)).toEqual({ width: C.width, height: C.height });
    expect(source("plate-counter-bezel")).toEqual(picture(ART.counter));
    expect(flat(screen.getByTestId("plate-counter-bezel", hidden))).toMatchObject({ left: -K.margin, top: -K.margin, width: C.width + K.margin * 2, height: C.height + K.margin * 2 });
    const total = screen.getByTestId("plate-counter-total", hidden);
    expect(counterTotal()).toBe("/7");
    expect(flat(total)).toMatchObject({ fontFamily: ref.type.counter.fontFamily, fontSize: K.total.size, color: ref.color.textSecondary, position: "absolute", left: C.width + K.total.gap });
    // Screen readers hear the count from the counter's own label.
    expect(total.props).toMatchObject({ accessible: false, importantForAccessibility: "no", maxFontSizeMultiplier: C.maxFontScale });
    expect(counter()).toBe("Next: photo 3. 2 of 7 photos taken.");
    expect(counterCopy({ index: 2, retake: false, prompts: SEVEN })).toMatchObject({ current: 2, numeral: "3", solo: false });
  });

  it("builds the shutter: the brass release centred on its control inside the advance lever, its white magnifier on the face", async () => {
    await renderCamera();
    const B = ref.button.shutter;
    const K = CHROME.shutter;
    const ring = screen.getByTestId("shutter-ring", hidden);
    expect(flat(ring)).toMatchObject({ position: "absolute", left: (B.ring - K.art) / 2, top: (B.ring - K.art) / 2, width: K.art, height: K.art });
    expect(ring.props.pointerEvents).toBe("none");
    const [rest, down] = ring.children as ReturnType<typeof screen.getByTestId>[];
    expect(rest.props.source).toEqual(picture(ART.shutter));
    // The pressed release lies over it, clear until the press.
    expect(down.props.testID).toBe("shutter-down");
    expect(flat(down)).toMatchObject({ opacity: 0 });
    expect((down.children[0] as typeof rest).props.source).toEqual(picture(ART.shutterDown));
    // The lever, under the release, centred on it, at rest.
    const lever = screen.getByTestId("shutter-lever", hidden);
    expect(lever.props.pointerEvents).toBe("none");
    expect(flat(lever)).toMatchObject({ left: (B.ring - K.lever) / 2, top: (B.ring - K.lever) / 2, width: K.lever, height: K.lever, transform: [{ rotate: `${K.rest}deg` }] });
    expect((lever.children[0] as typeof rest).props.source).toEqual(picture(ART.lever));
    const parts = screen.getByTestId("shutter").children.map((c) => (typeof c === "string" ? c : c.props.testID));
    expect(parts.indexOf("shutter-lever")).toBeLessThan(parts.indexOf("shutter-ring"));
    expect(flat(screen.getByTestId("shutter-disk", hidden))).toMatchObject({ width: ref.button.shutter.disk, height: ref.button.shutter.disk });
    expect(screen.getByTestId("shutter-glass", hidden).props.color).toBe(ref.color.textPrimary);
    // Its centre sits `drop` below the bottom row's: the room is above it.
    expect(flat(screen.getByTestId("shutter").parent!)).toMatchObject({ paddingTop: L.shutter.drop * 2 });
  });

  it("piles the prints in the tray: the newest on top, the one before leaning under it, a third sheet from 3, ringed from 3", async () => {
    seedRoll(1);
    await renderCamera();
    const T = ref.button.thumbnail;
    const Y = CHROME.tray;
    const P = CHROME.print;
    const tray = screen.getByTestId("last-plate-tray", hidden);
    expect(tray.props).toMatchObject({ source: picture(ART.tray), pointerEvents: "none" });
    expect(flat(tray)).toMatchObject({ left: -Y.side, top: -Y.top, width: T.size + Y.side * 2, height: T.size + Y.top + Y.side });
    // The control itself carries no fill: the tray is its picture.
    expect(flat(screen.getByTestId("last-plate")).backgroundColor).toBeUndefined();
    // The well clips the prints from the cover's edge down.
    const well = screen.getByTestId("last-plate-image", hidden);
    expect(flat(well)).toMatchObject({ left: Y.inset, top: Y.slot, width: T.size - Y.inset * 2, height: T.size - Y.inset - Y.slot, overflow: "hidden" });
    expect(well.props.pointerEvents).toBe("none");
    // One photo: one print, its photo behind the sheet's cut-out, cover-cropped.
    expect(thumbnailUri()).toBe("file://old-0.jpg");
    const photo = screen.getByTestId("last-plate-photo", hidden);
    expect(photo.props.contentFit).toBe("cover");
    expect(flat(photo.parent!)).toMatchObject({ left: P.border, top: P.border, right: P.border, bottom: P.border, overflow: "hidden" });
    const sheet = photo.parent!.parent!;
    expect(flat(sheet)).toMatchObject({ width: P.width, height: P.height, top: P.top, left: (T.size - Y.inset * 2 - P.width) / 2 });
    expect(P.top + P.height).toBeLessThanOrEqual(T.size - Y.inset - Y.slot);
    expect(screen.queryByTestId("last-plate-under", hidden)).toBeNull();
    expect(screen.queryByTestId("last-plate-pile", hidden)).toBeNull();
    expect(flat(screen.getByTestId("last-plate-ring", hidden))).toMatchObject({ borderWidth: L.cue.width, borderColor: L.cue.color, borderRadius: Y.radius, opacity: 0 });
    // Two: the one before lies under it, leaning.
    await act(async () => seedRoll(1));
    const uriOf = (id: string) => ([screen.getByTestId(id, hidden).props.source].flat()[0] as { uri: string }).uri;
    expect(thumbnailUri()).toBe("file://old-0.jpg");
    expect(screen.getAllByTestId("last-plate-photo", hidden)).toHaveLength(1);
    expect(uriOf("last-plate-under")).toBe("file://old-0.jpg");
    // It is the same print that was on top a moment ago (kept mounted, so its photo never blinks), now leaning aside.
    expect(screen.getByTestId("last-plate-under", hidden).parent!.parent!.parent!.props.testID).toBe("last-plate-image");
    expect(screen.queryByTestId("last-plate-pile", hidden)).toBeNull();
    // Three: a third sheet under those, and the way-on ring.
    await act(async () => seedRoll(1));
    expect(flat(screen.getByTestId("last-plate-pile", hidden))).toMatchObject({ transform: [{ rotate: `${P.leanBack}deg` }] });
  });

  it("slides a new print out from under the tray's cover as its photo joins the roll, and winds the lever on", async () => {
    await renderCamera();
    await cameraReady();
    expect(screen.queryByTestId("last-plate-photo", hidden)).toBeNull();
    await fireEvent.press(screen.getByTestId("shutter"));
    await flush();
    // The newest photo is the top print at once (it is what slides), whatever the animation's clock.
    expect(thumbnailUri()).toBe("file://plate-shot.jpg");
    expect(screen.getByTestId("last-plate-image", hidden)).toContainElement(screen.getByTestId("last-plate-photo", hidden));
    await fireEvent.press(screen.getByTestId("shutter"));
    await flush();
    expect(screen.getAllByTestId("last-plate-photo", hidden)).toHaveLength(1);
    expect(screen.getByTestId("last-plate-under", hidden)).toBeTruthy();
    expect(getPlates()).toHaveLength(2);
  });

  it("opens on a roll with its pile at rest: the top print square and out, the one under it leaning, nothing sliding", async () => {
    seedRoll(3);
    await renderCamera();
    const P = CHROME.print;
    const sheetOf = (id: string) => flat(screen.getByTestId(id, hidden).parent!.parent!);
    expect(sheetOf("last-plate-photo").transform).toEqual([{ translateY: 0 }, { rotate: "0deg" }]);
    expect(sheetOf("last-plate-under").transform).toEqual([{ translateY: 0 }, { rotate: `${P.lean}deg` }]);
    expect(thumbnailUri()).toBe("file://old-2.jpg");
    expect(screen.getByTestId("last-plate-pile", hidden)).toBeTruthy();
  });

  it("holds the retaken photo's print alone in retake mode", async () => {
    seedRoll(4);
    await renderCamera(1);
    expect(thumbnailUri()).toBe("file://old-1.jpg");
    expect(screen.queryByTestId("last-plate-under", hidden)).toBeNull();
    expect(screen.queryByTestId("last-plate-pile", hidden)).toBeNull();
  });
});

// On Android `accessible` sets isFocusable, which would make a display element
// a keyboard and D-pad stop; screenReaderFocusable keeps it one TalkBack element.
describe.each([
  { os: "ios", accessible: true },
  { os: "android", accessible: false },
] as const)("Rangefinder: keyboard stops on $os", ({ os, accessible }) => {
  let platform: jest.ReplaceProperty<typeof Platform.OS> | undefined;
  beforeEach(() => {
    platform = jest.replaceProperty(Platform, "OS", os);
  });
  afterEach(() => platform?.restore());

  it("keeps the prompt and the plate counter single screen-reader elements that are never keyboard stops", async () => {
    camera.takePictureAsync.mockRejectedValueOnce(new Error("busy"));
    await renderCamera();
    expect(screen.getByTestId("prompt").props).toMatchObject({
      accessible,
      screenReaderFocusable: true,
      accessibilityRole: "header",
      accessibilityLabel: "Start here. Stand in the middle. Face any wall.",
      accessibilityLiveRegion: "polite",
    });
    expect(screen.getByTestId("plate-counter").props).toMatchObject({
      accessible,
      screenReaderFocusable: true,
      accessibilityRole: "text",
      // 1x's 8 on either: the default lens, and Android's only one.
      accessibilityLabel: "Next: photo 1. 0 of 7 photos taken.",
    });
    // Their texts stay out of Android's accessibility tree: each element is read once, by its label.
    for (const text of ["Start here", "Stand in the middle. Face any wall.", "1"]) {
      expect(screen.getByText(text, hidden).props.importantForAccessibility).toBe("no");
    }
    // The error line inside the prompt is not a stop either.
    await cameraReady();
    await fireEvent.press(screen.getByTestId("shutter"));
    await flush();
    expect(screen.getByTestId("prompt").props.accessibilityLabel).toBe(`Start here. ${COPY.captureError}`);
    expect(screen.getByTestId("notice", hidden).props.accessible).toBeUndefined();
  });
});

describe("copy", () => {
  it("counts library imports as real progress, sized to the longest line", () => {
    expect(thinkingCopy({ done: 1, total: 4 }, "2")).toEqual({
      line: "Preparing photo 2 of 4",
      accessibilityLabel: "Preparing 4 photos",
      sizeTo: ["Preparing photo 4 of 4"],
    });
    expect(thinkingCopy({ done: 0, total: 1 }, "3")).toEqual({ line: "Preparing photo 3", accessibilityLabel: "Preparing photo 3" });
    expect(thinkingCopy(null, "3").line).toBe("Preparing photo 3");
  });

  it("words 0.5x's 360 in 5: start in the middle, turn right a little each time, halfway, back to the start", () => {
    expect(FIVE.map((p) => p.title)).toEqual(["Start here", "Turn right a little", "Keep turning", "Halfway round", "Last turn"]);
    expect(FIVE[0].detail).toBe("Stand in the middle. Face any wall.");
    expect(FIVE[1].detail).toBe("Keep a sliver of the last photo in view.");
    expect(FIVE[3].detail).toBe("You're facing away from photo 1.");
    expect(FIVE[4].detail).toBe("After this one, you're back at the start.");
    expect(FIVE.map((p) => p.name)).toEqual(["Start", "Right", "Back right", "Back left", "Left"]);
    expect(FIVE.map((p) => p.numeral)).toEqual(["1", "2", "3", "4", "5"]);
    // No spot-by-spot prompts, no darkroom words.
    const all = JSON.stringify([FIVE, SEVEN]);
    expect(all).not.toMatch(/doorway|corner|busiest|close view|plate|roll|develop/i);
  });

  it("words 1x's 360 in 7 by where each stop falls, not by compass: halfway is the later of the two nearest straight behind", () => {
    expect(SEVEN.map((p) => p.title)).toEqual([
      "Start here",
      "Turn right a little",
      "Keep turning",
      "Keep turning",
      "Halfway round",
      "Nearly round",
      "Last turn",
    ]);
    expect(SEVEN[2].detail).toBe("Keep a sliver of the last photo in view.");
    expect(SEVEN[4].detail).toBe("You're facing away from photo 1.");
    // Names stay compass names, one each.
    expect(SEVEN.map((p) => p.name)).toEqual(["Start", "Front right", "Right", "Back right", "Back left", "Left", "Front left"]);
    expect(SEVEN.map((p) => p.numeral)).toEqual(["1", "2", "3", "4", "5", "6", "7"]);
    // 6 and 8 photos read as before: one stop straight behind.
    expect(platePrompts([0, 60, 120, 180, 240, 300]).map((p) => p.title)).toEqual(["Start here", "Turn right a little", "Keep turning", "Halfway round", "Nearly round", "Last turn"]);
    expect(platePrompts([0, 45, 90, 135, 180, 225, 270, 315])[4].title).toBe("Halfway round");
    // Stops re-spaced after a lens switch keep their names by where they look.
    expect(platePrompts([0, 72, 144, 198, 252, 306]).map((p) => p.name)).toEqual(["Start", "Right", "Back right", "Behind", "Left", "Front left"]);
    expect(platePrompts([0, 72, 144, 198, 252, 306])[3].title).toBe("Halfway round");
  });

  it("aims a retake between the photos either side of it, round the circle, naming it by its number", () => {
    expect(promptCopy({ index: 0, retake: true, prompts: FIVE })).toEqual({ title: "Photo 1", detail: "From the middle, aim between photos 5 and 2." });
    expect(promptCopy({ index: 3, retake: true, prompts: FIVE })).toEqual({ title: "Photo 4", detail: "From the middle, aim between photos 3 and 5." });
    expect(promptCopy({ index: 4, retake: true, prompts: FIVE })).toEqual({ title: "Photo 5", detail: "From the middle, aim between photos 4 and 1." });
    expect(shutterLabel({ index: 3, retake: true, prompts: FIVE })).toBe("Retake photo 4, Photo 4");
    expect(shutterLabel({ index: 3, retake: true, filling: true, prompts: FIVE })).toBe("Take photo 4, Photo 4");
    // On 1x photo 1 sits between 7 and 2.
    expect(promptCopy({ index: 0, retake: true, prompts: SEVEN })).toEqual({ title: "Photo 1", detail: "From the middle, aim between photos 7 and 2." });
    expect(promptCopy({ index: 6, retake: true, prompts: SEVEN })).toEqual({ title: "Photo 7", detail: "From the middle, aim between photos 6 and 1." });
  });

  it("places a photo out of turn by the neighbours that exist, never a turn from where the player happens to stand", () => {
    const filled = (...slots: number[]) => Array.from({ length: 5 }, (_, i) => slots.includes(i));
    const out = (index: number, f: boolean[]) => promptCopy({ index, retake: false, inTurn: false, filled: f, prompts: FIVE });
    expect(out(2, filled(0, 1, 3))).toEqual({ title: "Photo 3", detail: "From the middle, aim between photos 2 and 4." });
    expect(out(3, filled(0, 1, 2))).toEqual({ title: "Photo 4", detail: "From the middle, face photo 3's view, then turn right a little." });
    expect(out(0, filled(1, 2, 3))).toEqual({ title: "Photo 1", detail: "From the middle, face photo 2's view, then turn left a little." });
    // Round the circle: photo 1's neighbours are 5 and 2.
    expect(out(0, filled(1, 4))).toEqual({ title: "Photo 1", detail: "From the middle, aim between photos 5 and 2." });
    expect(out(4, filled(0, 3))).toEqual({ title: "Photo 5", detail: "From the middle, aim between photos 4 and 1." });
    // In turn, the turn prompts; a retake is always placed.
    expect(promptCopy({ index: 3, retake: false, inTurn: true, prompts: FIVE }).title).toBe("Halfway round");
    expect(promptCopy({ index: 3, retake: true, filled: filled(0, 1, 2, 3), prompts: FIVE }).detail).toBe("From the middle, face photo 3's view, then turn right a little.");
    // On 1x the last photo's neighbour round the circle is photo 1.
    const seven = (...slots: number[]) => Array.from({ length: 7 }, (_, i) => slots.includes(i));
    expect(promptCopy({ index: 6, retake: false, inTurn: false, filled: seven(0, 1, 2), prompts: SEVEN })).toEqual({
      title: "Photo 7",
      detail: "From the middle, face photo 1's view, then turn left a little.",
    });
  });

  it("words a turn edge to edge where a plan's photos only just meet, so there is no part of the last one to keep in view", () => {
    expect(promptCopy({ index: 1, retake: false, edgeToEdge: true, prompts: FIVE })).toEqual({ title: "Turn right a little", detail: COPY.edgeDetail });
    expect(promptCopy({ index: 1, retake: false, edgeToEdge: false, prompts: FIVE }).detail).toBe("Keep a sliver of the last photo in view.");
    // The other details aren't about overlap and stay.
    expect(promptCopy({ index: 3, retake: false, edgeToEdge: true, prompts: FIVE }).detail).toBe("You're facing away from photo 1.");
    expect(promptCopy({ index: 4, retake: false, edgeToEdge: true, prompts: FIVE }).detail).toBe("After this one, you're back at the start.");
  });

  it("counts the turn dial's photos against the plan, and says when all are taken", () => {
    expect(turnCopy({ index: 1, retake: false, prompts: FIVE }, false)).toEqual({ line: "Photo 2 of 5", accessibilityLabel: "Photo 2 of 5." });
    expect(turnCopy({ index: 1, retake: false, prompts: FIVE }, true).accessibilityLabel).toBe(`Photo 2 of 5. ${COPY.turnReached}`);
    expect(turnCopy({ index: 5, retake: false, prompts: FIVE }, false)).toEqual({ line: "5 of 5 taken", accessibilityLabel: "5 of 5 taken, all the way round." });
    expect(turnCopy({ index: 2, retake: true, prompts: FIVE }, false).line).toBe("Photo 3 of 5");
    expect(turnCopy({ index: 1, retake: false, prompts: SEVEN }, false).line).toBe("Photo 2 of 7");
    expect(turnCopy({ index: 7, retake: false, prompts: SEVEN }, false)).toEqual({ line: "7 of 7 taken", accessibilityLabel: "7 of 7 taken, all the way round." });
    expect(counterCopy({ index: 3, retake: false, prompts: SEVEN }).accessibilityLabel).toBe("Next: photo 4. 3 of 7 photos taken.");
    expect(promptCopy({ index: 7, retake: false, prompts: SEVEN })).toEqual({ title: "All the way round", detail: "Review your photos." });
  });
});

describe("Rangefinder: the turn dial", () => {
  const dial = () => screen.getByTestId("turn-dial");

  it("counts the photos round the room on the feed, and stays static with no motion sensor (as under Jest)", async () => {
    await renderCamera();
    await cameraReady();
    expect(dial().props.accessibilityLabel).toBe("Photo 1 of 7.");
    expect(dialLine()).toBe("Photo 1 of 7");
    expect(screen.getAllByTestId("turn-dial-rest", hidden)).toHaveLength(6);
    expect(screen.getByTestId("turn-dial-target", hidden)).toBeTruthy();
    expect(screen.queryAllByTestId("turn-dial-taken", hidden)).toHaveLength(0);
    await fireEvent.press(screen.getByTestId("shutter"));
    await flush();
    expect(dialLine()).toBe("Photo 2 of 7");
    expect(screen.getAllByTestId("turn-dial-taken", hidden)).toHaveLength(1);
    expect(screen.queryByTestId("turn-dial-arc", hidden)).toBeNull();
    // The dial sits in the viewfinder, etched on the glass with no words: the count shows in the frame counter.
    expect(screen.getByTestId("viewfinder-well")).toContainElement(dial());
    expect(screen.queryByText("Photo 2 of 7", hidden)).toBeNull();
    expect(counterTotal()).toBe("/7");
  });

  it("plans 7 stops on 1x and 5 on 0.5x before the first photo", async () => {
    await renderCamera();
    await cameraReady();
    expect(dialLine()).toBe("Photo 1 of 7");
    expect(screen.getAllByTestId("turn-dial-rest", hidden)).toHaveLength(6);
    await pickLens(COPY.ultraWide);
    expect(dialLine()).toBe("Photo 1 of 5");
    expect(counterTotal()).toBe("/5");
    expect(screen.getAllByTestId("turn-dial-rest", hidden)).toHaveLength(4);
    expect(counter()).toBe("Next: photo 1. 0 of 5 photos taken.");
    await pickLens(COPY.mainLens);
    expect(dialLine()).toBe("Photo 1 of 7");
  });

  it("says when all are taken, and keeps a full roll as it is when the lens changes", async () => {
    seedRoll(7);
    await renderCamera();
    await cameraReady();
    expect(dialLine()).toBe("7 of 7 taken, all the way round");
    expect(screen.getAllByTestId("turn-dial-taken", hidden)).toHaveLength(7);
    await pickLens(COPY.ultraWide);
    // The 7 already go all the way round: still full.
    expect(dialLine()).toBe("7 of 7 taken, all the way round");
    expect(screen.getAllByTestId("turn-dial-taken", hidden)).toHaveLength(7);
    expect(stateOf(screen.getByTestId("shutter"))).toMatchObject({ disabled: true });
  });

  it("marks the retaken photo's stop in retake mode", async () => {
    seedRoll(4);
    await renderCamera(2);
    expect(dialLine()).toBe("Photo 3 of 7");
    expect(screen.getAllByTestId("turn-dial-taken", hidden)).toHaveLength(3);
    expect(screen.getByTestId("turn-dial-target", hidden)).toBeTruthy();
  });
});

describe("Rangefinder: the turn after a photo is removed", () => {
  const C = ref.layout.camera.turn.dial / 2;
  const R = C - ref.layout.camera.turn.ring;
  const shoot = async () => {
    await fireEvent.press(screen.getByTestId("shutter"));
    await flush();
  };
  /** The next stop's ring sits at this place round the dial (degrees, photo 1 at the top). */
  const expectTargetAtDeg = (deg: number) => {
    const ring = screen.getByTestId("turn-dial-target", hidden);
    const p = dialPoint(C, C, R, deg);
    expect(ring.props.cx).toBeCloseTo(p.x, 3);
    expect(ring.props.cy).toBeCloseTo(p.y, 3);
  };
  /** The next stop's ring sits at this slot's place round the dial (1x: 51.4 apart, photo 1 at the top). */
  const expectTargetAt = (slot: number) => expectTargetAtDeg(slot * STEP);
  const arc = () => screen.queryByTestId("turn-dial-arc", hidden);

  /** Photos 1 to `count` with the camera on 1x, turning a stop (51.4) between each: the player ends facing photo `count`'s view. */
  async function walkRound(count: number) {
    sensors.DeviceMotion.isAvailableAsync.mockResolvedValue(true);
    await renderCamera();
    await cameraReady();
    await flush();
    for (let i = 0; i < count; i += 1) {
      if (i > 0) await turnPhone(STEP, 1);
      await shoot();
    }
    expect(getPlates()).toHaveLength(count);
    mockFeedback.tick.mockClear();
  }

  it("tracks the turn live between photos taken in order, with the turn guide on the feed", async () => {
    await walkRound(2);
    expect(prompt()).toBe("Keep turning. Keep a sliver of the last photo in view.");
    // The last photo's edge and the mark where it should sit for 1x's turn.
    const box = viewfinderLayout(AREA);
    expect(screen.getByTestId("turn-guide", hidden)).toBeTruthy();
    expect(Number(screen.getByTestId("turn-guide-mark-line", hidden).props.x1)).toBeCloseTo(targetX(STEP, LENS_FOV.main) * box.width, 6);
    await turnPhone(STEP, 0.5);
    expect(arc()).toBeTruthy();
    // 42.9 of 51.4: not yet far enough.
    await turnPhone((STEP * 2) / 3, 0.5);
    expect(mockFeedback.tick).not.toHaveBeenCalled();
    await turnPhone(STEP, 1 / 6);
    expect(mockFeedback.tick).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("turn-dial-target-reached", hidden)).toBeTruthy();
    expect(screen.getByTestId("turn-guide-mark-reached", hidden)).toBeTruthy();
  });

  it("removing the last photo: the same slot next, aimed by its place, with no turn on from where the player stands", async () => {
    await walkRound(4);
    // The review screen's x on photo 4; the player still faces its view.
    await act(async () => {
      removePlate(3);
    });
    expect(counter()).toBe("Next: photo 4. 3 of 7 photos taken.");
    expect(dialLine()).toBe("Photo 4 of 7");
    expectTargetAt(3);
    // Not a turn prompt plus a live turn: that sent the player a stop past photo 4's place.
    expect(prompt()).toBe("Photo 4. From the middle, face photo 3's view, then turn right a little.");
    expect(screen.getByRole("button", { name: "Take photo 4, Photo 4" })).toBeTruthy();
    expect(screen.queryByTestId("turn-guide", hidden)).toBeNull();
    await turnPhone(STEP, 1);
    expect(arc()).toBeNull();
    expect(mockFeedback.tick).not.toHaveBeenCalled();
    await shoot();
    expect(getSlots()).toHaveLength(4);
    // Photo 4 taken again here: the turn picks up from it toward photo 5, straight behind photo 1.
    expect(prompt()).toBe("Halfway round. You're facing away from photo 1.");
    await turnPhone(STEP, 1);
    expect(mockFeedback.tick).toHaveBeenCalledTimes(1);
  });

  it("removing a middle photo: the open slot next, aimed between its neighbours, then on round from the last photo", async () => {
    await walkRound(4);
    await act(async () => {
      removePlate(2);
    });
    expect(counter()).toBe("Next: photo 3. 3 of 7 photos taken.");
    expect(dialLine()).toBe("Photo 3 of 7");
    expectTargetAt(2);
    expect(prompt()).toBe("Photo 3. From the middle, aim between photos 2 and 4.");
    await turnPhone(STEP, 1);
    expect(arc()).toBeNull();
    expect(mockFeedback.tick).not.toHaveBeenCalled();
    await shoot();
    expect(getSlots()[2]?.uri).toBe("file://plate-shot.jpg");
    // Next is photo 5, after photo 4: the player is at photo 3's place, so the camera says where 5 goes.
    expect(counter()).toBe("Next: photo 5. 4 of 7 photos taken.");
    expectTargetAt(4);
    expect(prompt()).toBe("Photo 5. From the middle, face photo 4's view, then turn right a little.");
    await turnPhone(STEP, 1);
    expect(mockFeedback.tick).not.toHaveBeenCalled();
  });

  it("removing the first photo: slot 1 next, aimed back from photo 2", async () => {
    await walkRound(4);
    await act(async () => {
      removePlate(0);
    });
    expect(counter()).toBe("Next: photo 1. 3 of 7 photos taken.");
    expect(dialLine()).toBe("Photo 1 of 7");
    expectTargetAt(0);
    expect(prompt()).toBe("Photo 1. From the middle, face photo 2's view, then turn left a little.");
    await turnPhone(STEP, 1);
    expect(arc()).toBeNull();
    expect(mockFeedback.tick).not.toHaveBeenCalled();
  });

  it("counts the turn from the moment the shutter fires, including while the photo is prepared", async () => {
    sensors.DeviceMotion.isAvailableAsync.mockResolvedValue(true);
    const pending = holdProcessing();
    await renderCamera();
    await cameraReady();
    await flush();
    const user = userEvent.setup();
    await user.press(screen.getByTestId("shutter"));
    await act(async () => pending[0].finish());
    await turnPhone(STEP, 1);
    await user.press(screen.getByTestId("shutter"));
    await flush();
    expect(stateOf(screen.getByTestId("shutter"))).toMatchObject({ busy: true });
    // The player turns on as soon as they hear the shutter, while photo 2 is still being prepared.
    await turnPhone(STEP, 0.5);
    expect(arc()).toBeNull();
    mockFeedback.tick.mockClear();
    await act(async () => pending[1].finish());
    await flush();
    expect(prompt()).toBe("Keep turning. Keep a sliver of the last photo in view.");
    // Half the turn already made: half way, not back at the start.
    expect(arc()).toBeTruthy();
    await turnPhone(STEP, 0.5);
    expect(mockFeedback.tick).toHaveBeenCalledTimes(1);
  });

  it("starts static on a camera opened with photos already taken (no turn to count from)", async () => {
    sensors.DeviceMotion.isAvailableAsync.mockResolvedValue(true);
    seedRoll(2);
    await renderCamera();
    await cameraReady();
    await flush();
    expect(prompt()).toBe("Photo 3. From the middle, face photo 2's view, then turn right a little.");
    await turnPhone(STEP, 1);
    expect(arc()).toBeNull();
    expect(mockFeedback.tick).not.toHaveBeenCalled();
  });

  it("follows the lens in use: switching to 0.5 mid-turn keeps the turn and measures it against 0.5's", async () => {
    await walkRound(1);
    await turnPhone(STEP, 0.5);
    expect(arc()).toBeTruthy();
    await pickLens(COPY.ultraWide);
    mockFeedback.tick.mockClear();
    expect(cameraProps().selectedLens).toBe(ULTRA_WIDE_LENS);
    // The turn so far still counts.
    expect(arc()).toBeTruthy();
    expect(prompt()).toBe("Turn right a little. Keep a sliver of the last photo in view.");
    // One photo in: 0.5's own even 5, 72 apart. That photo was taken on 1x (its own view and frame), so it isn't laid over 0.5's feed.
    expect(dialLine()).toBe("Photo 2 of 5");
    expect(screen.queryByTestId("turn-guide", hidden)).toBeNull();
    // 25.7 turned, 48 more: 73.7 of 72 (far enough is within half the 1.7 shared: 71.2).
    await turnPhone(60, 0.8);
    expect(mockFeedback.tick).toHaveBeenCalledTimes(1);
    await pickLens(COPY.mainLens);
    expect(dialLine()).toBe("Photo 2 of 7");
    // Back on the lens the last photo was taken on: the guide again, its mark for 1x's turn on 1x's 3:4 feed.
    // (73.7 turned: past 1x's 51.4 too, so the mark is solid.)
    expect(Number(screen.getByTestId("turn-guide-mark-reached", hidden).props.x1)).toBeCloseTo(targetX(STEP, LENS_FOV.main) * AREA.width, 6);
  });

  it("switching to 0.5 after 3 photos keeps them where they are and re-spaces the rest for 0.5", async () => {
    await walkRound(3);
    expect(dialLine()).toBe("Photo 4 of 7");
    await pickLens(COPY.ultraWide);
    mockFeedback.tick.mockClear();
    // 3 taken at 0, 51.4 and 102.9; 3 more 64.3 apart.
    const wide = rollPlan("wide", rollPlan("main").stops.slice(0, 3));
    expect(wide.shots).toBe(6);
    expect(counter()).toBe("Next: photo 4. 3 of 6 photos taken.");
    expect(dialLine()).toBe("Photo 4 of 6");
    expect(screen.getAllByTestId("turn-dial-taken", hidden)).toHaveLength(3);
    expect(screen.getAllByTestId("turn-dial-rest", hidden)).toHaveLength(2);
    expectTargetAtDeg(wide.stops[3]);
    // Still the turn from photo 3, the player's place: the re-spaced stop nearest straight behind (167).
    expect(prompt()).toBe("Halfway round. You're facing away from photo 1.");
    await turnPhone(wide.step, 1);
    expect(mockFeedback.tick).toHaveBeenCalledTimes(1);
    await shoot();
    expectTargetAtDeg(wide.stops[4]);
    // A switch back once photo 4 is in: the 4 keep their places and the rest re-space for 1x.
    await pickLens(COPY.mainLens);
    const back = rollPlan("main", wide.stops.slice(0, 4));
    expect(counter()).toBe(`Next: photo 5. 4 of ${back.shots} photos taken.`);
    expectTargetAtDeg(back.stops[4]);
  });

  it("opens again on the lens the roll was being taken on, with its plan", async () => {
    await walkRound(2);
    await pickLens(COPY.ultraWide);
    expect(counter()).toBe("Next: photo 3. 2 of 6 photos taken.");
    await screen.unmount();
    await renderCamera();
    // Before the lenses are read and after: still 0.5's plan.
    expect(counter()).toBe("Next: photo 3. 2 of 6 photos taken.");
    await cameraReady();
    expect(stateOf(screen.getByRole("radio", { name: COPY.ultraWide }))).toMatchObject({ selected: true });
    expect(cameraProps().selectedLens).toBe(ULTRA_WIDE_LENS);
    expect(counter()).toBe("Next: photo 3. 2 of 6 photos taken.");
  });

  it("runs the 360 on 1x where the phone has no ultra-wide, its photos overlapping, with no lens to switch", async () => {
    camera.getAvailableLensesAsync.mockResolvedValue([]);
    await walkRound(1);
    expect(screen.queryByRole("radio")).toBeNull();
    expect(prompt()).toBe("Turn right a little. Keep a sliver of the last photo in view.");
    expect(screen.getByTestId("turn-guide", hidden)).toBeTruthy();
  });
});

describe("Rangefinder: inside a mode", () => {
  const theme = modeThemes.crime_scene;
  const uriOf = (node: { props: { source?: unknown } }) => ([node.props.source].flat()[0] as { uri: string }).uri;
  beforeEach(() => setMode("crime_scene"));
  afterEach(() => setMode(null));

  it("takes the mode's ground under the leather, its inks and wells; the brass is the same in every mode", async () => {
    seedRoll(2);
    await renderCamera();
    expect(flat(screen.getByTestId("rangefinder-root"))).toMatchObject({ backgroundColor: theme.surface });
    expect(screen.getByTestId("phosphor-react-native-arrow-left-bold", hidden).props.color).toBe(theme.ink);
    expect(screen.getByTestId("back-art", hidden).props.source).toEqual([ART.buttonSquare].flat());
    const placed = promptCopy({ index: 2, retake: false, inTurn: false, filled: [true, true], prompts: SEVEN });
    expect(flat(screen.getByText(placed.title))).toMatchObject({ ...ref.type.serifTitle, color: theme.ink });
    expect(flat(screen.getByText(placed.detail)).color).toBe(theme.inkMuted);
    expect(flat(screen.getByTestId("viewfinder-well"))).toMatchObject({ backgroundColor: theme.ground });
    expect(flat(screen.getByTestId("plate-counter"))).toMatchObject({ backgroundColor: theme.ground });
    expect(flat(screen.getByTestId("plate-counter-total", hidden)).color).toBe(theme.inkMuted);
    expect(screen.getByTestId("shutter-glass", hidden).props.color).toBe(theme.ink);
  });

  it("shows the prints in the mode's baked treatment, ringed in its stamp colour from 3", async () => {
    seedRoll(3);
    await renderCamera();
    expect(uriOf(screen.getByTestId("last-plate-photo-treated", hidden))).toBe("baked/crime_scene/file://old-2.jpg");
    expect(uriOf(screen.getByTestId("last-plate-under-treated", hidden))).toBe("baked/crime_scene/file://old-1.jpg");
    expect(flat(screen.getByTestId("last-plate-ring", hidden))).toMatchObject({ borderWidth: ref.layout.camera.cue.width, borderColor: theme.stamp });
    // Still the way on to the review screen.
    await userEvent.setup().press(screen.getByTestId("last-plate"));
    expect(push).toHaveBeenCalledWith("/capture/review");
  });

  it("bakes each new photo as it is taken, and the live feed is never treated", async () => {
    await renderCamera();
    await cameraReady();
    await userEvent.setup().press(screen.getByRole("button", { name: "Take photo 1, Start here" }));
    expect(uriOf(screen.getByTestId("last-plate-photo-treated", hidden))).toBe("baked/crime_scene/file://plate-shot.jpg");
    expect(screen.queryByTestId("camera-treated", hidden)).toBeNull();
  });

  it("draws the lens selector's slot in the mode's well and its chosen label's mark in the mode's ink", async () => {
    camera.getAvailableLensesAsync.mockResolvedValue([{ deviceType: ULTRA_WIDE_LENS, localizedName: "Back Ultra Wide Camera" }]);
    await renderCamera();
    await cameraReady();
    expect(flat(screen.getByTestId("lens-track", hidden)).backgroundColor).toBe(theme.ground);
    expect(screen.getByTestId("lens-mark", hidden).props.color).toBe(theme.ink);
  });
});

describe("Rangefinder: in the shell (no mode)", () => {
  it("shows the last photo as taken, with the cross-dissolve and no treatment", async () => {
    seedRoll(2);
    await renderCamera();
    expect(thumbnailUri()).toBe("file://old-1.jpg");
    expect(screen.queryByTestId("last-plate-photo-treated", hidden)).toBeNull();
  });
});

describe("tokens only", () => {
  const ROOT = path.join(__dirname, "..");
  const files = [path.join(ROOT, "../Rangefinder.tsx"), ...fs.readdirSync(ROOT).filter((f) => /\.tsx?$/.test(f)).map((f) => path.join(ROOT, f))];
  // Comments and string contents are not values; strip them before scanning.
  const code = (file: string) =>
    fs.readFileSync(file, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "")
      .replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g, '""');

  it.each(files.map((f) => [path.basename(f), f]))("%s has no colour, font or size literals", (_name, file) => {
    const source = fs.readFileSync(file, "utf8");
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|fontFamily\s*[:=]/);
    // Plain arithmetic only (0, 1, 2); the capture quality is not a design value.
    const numbers = (code(file).match(/(?<![\w.$])\d+(?:\.\d+)?(?![\w.])/g) ?? []).filter((n) => !["0", "1", "2", "0.92"].includes(n));
    expect(numbers).toEqual([]);
  });
});

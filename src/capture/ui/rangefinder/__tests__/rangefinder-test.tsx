/// <reference types="node" />
import fs from "fs";
import path from "path";
import { AccessibilityInfo, BackHandler, Platform, StyleSheet } from "react-native";
import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { processPhoto, type ProcessedPlate, type RawPhoto } from "@/capture/process-photo";
import { addPlate, clearPlates, getPlates, getSlots, removePlate } from "@/capture/roll";
import { MAX_PLATES, PLATE_PROMPTS } from "@/capture/slots";
import { setMode } from "@/game/mode";
import { modeThemes, motion, ref } from "@/theme/tokens";
import { Rangefinder } from "../../Rangefinder";
import { COPY, counterCopy, libraryError, promptCopy, shutterLabel, thinkingCopy, turnCopy } from "../copy";
import { ULTRA_WIDE_LENS } from "../useLenses";
import { viewfinderLayout } from "../Viewfinder";

// A stand-in CameraView: a class (so the screen's ref gets its methods) that
// renders a host View carrying every prop, so tests can read flash and
// selectedLens and fire onCameraReady / onMountError.
jest.mock("expo-camera", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  const mockCamera = { takePictureAsync: jest.fn(), getAvailableLensesAsync: jest.fn() };
  class CameraView extends React.Component<Record<string, unknown>> {
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
  };
});
jest.mock("expo-image-picker", () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock("@/capture/process-photo", () => ({ processPhoto: jest.fn() }));
// Stable spies in the full shape, so a test can see which haptic a moment gave.
const mockFeedback = { tick: jest.fn(), tap: jest.fn(), press: jest.fn(), thud: jest.fn(), shutter: jest.fn(), success: jest.fn(), warning: jest.fn(), error: jest.fn() };
jest.mock("@/game/feedback", () => ({ useFeedback: () => mockFeedback }));
// A bake that is ready at once ("baked/<mode>/<photo>"), and none in the shell, as the real one.
jest.mock("@/components/noir/treatPhoto", () => ({
  ...jest.requireActual("@/components/noir/treatPhoto"),
  useTreatedPhoto: (source: string, genre: string | null) => (genre ? `baked/${genre}/${source}` : null),
}));

const camera = jest.requireMock<{ mockCamera: { takePictureAsync: jest.Mock; getAvailableLensesAsync: jest.Mock } }>("expo-camera").mockCamera;
const launch = jest.mocked(ImagePicker.launchImageLibraryAsync);
const develop = jest.mocked(processPhoto);
const push = jest.mocked(router.push);
const back = jest.mocked(router.back);
const announce = jest.mocked(AccessibilityInfo.announceForAccessibility);
const hidden = { includeHiddenElements: true } as const;

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

// The viewfinder area on 393 x 852 (safe 59 / 34): x 14-379, y 140-626.7.
const AREA = { width: 365, height: 486.7 };

async function renderCamera(retakeIndex: number | null = null) {
  const onClose = jest.fn();
  await render(<Rangefinder retakeIndex={retakeIndex} onClose={onClose} />);
  // The mount (and the camera in it) mounts once the viewfinder area is laid out.
  await fireEvent(screen.getByTestId("viewfinder"), "layout", { nativeEvent: { layout: { x: 0, y: 0, ...AREA } } });
  return { onClose };
}

const cameraProps = () => screen.getByTestId("camera", hidden).props;
const cameraReady = () => act(async () => cameraProps().onCameraReady());
const prompt = () => screen.getByRole("header").props.accessibilityLabel as string;
const counter = () => screen.getByTestId("plate-counter").props.accessibilityLabel as string;
const stateOf = (node: { props: { accessibilityState?: Record<string, unknown> } }) => node.props.accessibilityState ?? {};
const flat = (node: { props: Record<string, unknown> }) => StyleSheet.flatten(node.props.style as Parameters<typeof StyleSheet.flatten>[0]) ?? {};
const flush = () => act(async () => {});
/** The thumbnail's photo (expo-image hands its native view a list of sources). */
const thumbnailUri = () => ([screen.getByTestId("last-plate-photo", hidden).props.source].flat()[0] as { uri: string }).uri;

beforeEach(() => {
  jest.clearAllMocks();
  clearPlates();
  develop.mockImplementation(async (photo) => plateFor(photo));
  camera.takePictureAsync.mockResolvedValue(raw("shot"));
  camera.getAvailableLensesAsync.mockResolvedValue([]);
});

describe("Rangefinder: camera starting", () => {
  it("opens on plate I with the controls that need the camera dimmed, and back and library live", async () => {
    await renderCamera();
    expect(prompt()).toBe("Start here. Stand in the middle. Face any wall.");
    expect(counter()).toBe("Next: photo 1. 0 of 6 photos taken.");
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

  it("draws the frame 3:4 with the 4:3 feed, flash off and the default lens", async () => {
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

  it("offers 0.5x only when the lens list reports an ultra-wide, and starts on it", async () => {
    camera.getAvailableLensesAsync.mockResolvedValue([
      { deviceType: "AVCaptureDeviceTypeBuiltInWideAngleCamera", localizedName: "Back Camera" },
      { deviceType: ULTRA_WIDE_LENS, localizedName: "Back Ultra Wide Camera" },
    ]);
    await renderCamera();
    expect(screen.queryByRole("radio")).toBeNull();
    // Before the list arrives: the main lens.
    expect(cameraProps().selectedLens).toBeUndefined();
    await cameraReady();
    expect(screen.getByTestId("lens").props).toMatchObject({ accessibilityRole: "radiogroup", accessibilityLabel: "Lens" });
    // The 360 goes round best on the ultra-wide, so it is the default.
    expect(stateOf(screen.getByRole("radio", { name: "Ultra-wide lens" }))).toMatchObject({ selected: true });
    expect(stateOf(screen.getByRole("radio", { name: "Main lens" }))).toMatchObject({ selected: false });
    expect(cameraProps().selectedLens).toBe(ULTRA_WIDE_LENS);
    expect(screen.getByText("0.5")).toBeTruthy();
    expect(screen.getByText("1.0")).toBeTruthy();
    // The default is not a change: no tick.
    expect(mockFeedback.tick).not.toHaveBeenCalled();
    // The player can still switch, and back.
    await fireEvent.press(screen.getByRole("radio", { name: "Main lens" }));
    expect(cameraProps().selectedLens).toBeUndefined();
    expect(mockFeedback.tick).toHaveBeenCalledTimes(1);
    // The lens already chosen: nothing moves, so no tick.
    await fireEvent.press(screen.getByRole("radio", { name: "Main lens" }));
    expect(mockFeedback.tick).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByRole("radio", { name: "Ultra-wide lens" }));
    expect(cameraProps().selectedLens).toBe(ULTRA_WIDE_LENS);
    expect(mockFeedback.tick).toHaveBeenCalledTimes(2);
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
    expect(develop).toHaveBeenCalledWith(raw("shot"));
    expect(getPlates().map((p) => p.uri)).toEqual(["file://plate-shot.jpg"]);
    expect(prompt()).toBe("Turn right a little. Keep part of the last photo in view.");
    expect(counter()).toBe("Next: photo 2. 1 of 6 photos taken.");
    expect(screen.getByRole("button", { name: "Take photo 2, Turn right a little" })).toBeTruthy();
    expect(thumbnailUri()).toBe("file://plate-shot.jpg");
    // The privacy note is only for plate I.
    expect(screen.queryByText(COPY.privacy)).toBeNull();
    // Jest runs as iOS, which has no live regions: the new prompt is announced.
    expect(announce).toHaveBeenCalledWith("Turn right a little. Keep part of the last photo in view.");
  });

  it("is busy while the plate develops: taps ignored, library, flash and thumbnail dimmed, back and grid live", async () => {
    seedRoll(1);
    const pending = holdProcessing();
    await renderCamera();
    await cameraReady();
    const user = userEvent.setup();
    await user.press(screen.getByRole("button", { name: "Take photo 2, Turn right a little" }));
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
    expect(prompt()).toBe("Turn right a little. Keep part of the last photo in view.");
    await act(async () => pending[0].finish());
    expect(prompt()).toBe("Keep turning. Keep part of the last photo in view.");
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
      expect(prompt()).toBe("Turn right a little. Keep part of the last photo in view.");
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
    expect(prompt()).toBe("Turn right a little. Keep part of the last photo in view.");
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

  it("gives the success haptic when the 6th photo fills the set, and only then", async () => {
    seedRoll(MAX_PLATES - 2);
    await renderCamera();
    await cameraReady();
    await fireEvent.press(screen.getByTestId("shutter"));
    await flush();
    expect(getPlates()).toHaveLength(MAX_PLATES - 1);
    expect(mockFeedback.success).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId("shutter"));
    await flush();
    expect(getPlates()).toHaveLength(MAX_PLATES);
    expect(mockFeedback.success).toHaveBeenCalledTimes(1);
    expect(mockFeedback.shutter).toHaveBeenCalledTimes(2);
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

  it("holds 6 photos: the most-a-case-takes prompt, 6 on the counter, shutter and library off, flash and grid live", async () => {
    seedRoll(MAX_PLATES);
    await renderCamera();
    await cameraReady();
    expect(prompt()).toBe(`${COPY.fullTitle}. ${COPY.fullDetail}`);
    expect(counter()).toBe("6 of 6 photos taken. That's the most a case takes.");
    expect(counterCopy({ index: MAX_PLATES, retake: false })).toMatchObject({ current: MAX_PLATES - 1, numeral: "6", solo: false });
    expect(stateOf(screen.getByTestId("shutter"))).toMatchObject({ disabled: true });
    expect(stateOf(screen.getByRole("button", { name: "Choose photos from your library" }))).toMatchObject({ disabled: true });
    expect(stateOf(screen.getByRole("switch", { name: "Flash" }))).toMatchObject({ disabled: false });
    expect(stateOf(screen.getByRole("button", { name: "Review your photos, 6 photos taken. Ready to build." }))).toMatchObject({ disabled: false });
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
    expect(launch).toHaveBeenCalledWith(expect.objectContaining({ allowsMultipleSelection: true, selectionLimit: MAX_PLATES }));
    expect(getPlates().map((p) => p.uri)).toEqual(["file://plate-a.jpg", "file://plate-c.jpg"]);
    expect(prompt()).toBe(`Keep turning. ${libraryError(1)}`);
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
      expect(counter()).toBe("Next: photo 1. 0 of 6 photos taken.");
      expect(screen.getByText("Preparing photo 2 of 2", hidden)).toBeTruthy();
      await act(async () => pending[1].finish());
      expect(prompt()).toBe("Keep turning. Keep part of the last photo in view.");
      expect(counter()).toBe("Next: photo 3. 2 of 6 photos taken.");
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
    expect(prompt()).toBe("Turn right a little. Keep part of the last photo in view.");
    expect(counter()).toBe("Next: photo 2. 3 of 6 photos taken.");
    expect(screen.getByRole("button", { name: "Take photo 2, Turn right a little" })).toBeTruthy();
    await fireEvent.press(screen.getByTestId("shutter"));
    await flush();
    // The shot fills slot 2; the others never moved.
    expect(getSlots().map((p) => p?.uri)).toEqual(["file://old-0.jpg", "file://plate-shot.jpg", "file://old-2.jpg", "file://old-3.jpg"]);
    expect(counter()).toBe("Next: photo 5. 4 of 6 photos taken.");
  });

  it("takes an open slot from the review screen as a first take, not a retake, then returns", async () => {
    seedRoll(4);
    removePlate(2);
    const { onClose } = await renderCamera(2);
    await cameraReady();
    // Out of turn: where to aim, as for a retake.
    expect(prompt()).toBe("Back right. From the middle, aim between photos 2 and 4.");
    expect(counter()).toBe("Taking photo 3.");
    expect(screen.getByRole("button", { name: "Take photo 3, Back right" })).toBeTruthy();
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
    expect(prompt()).toBe("Front right. From the middle, aim between photos 1 and 3.");
    expect(counter()).toBe("Retaking photo 2.");
    // The retaken plate's numeral shows alone: its neighbours are hidden.
    expect(flat(screen.getByText("2", hidden)).opacity).toBeUndefined();
    for (const neighbour of ["1", "3"]) expect(flat(screen.getByText(neighbour, hidden))).toMatchObject({ opacity: 0 });
    expect(screen.getByRole("button", { name: "Retake photo 2, Front right" })).toBeTruthy();
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

  it("draws back and library as Once's 44 squares with 48 hit areas inside the header row", async () => {
    await renderCamera();
    const slop = (ref.button.square.hit - ref.button.square.size) / 2;
    expect(ref.button.square.hit).toBeGreaterThanOrEqual(ref.hit.min);
    // Native hit-testing drops touches outside a parent, so the row carries the slop.
    expect(flat(screen.getByTestId("prompt").parent!)).toMatchObject({ paddingVertical: slop, paddingHorizontal: ref.layout.camera.edge });
    for (const id of ["back", "library"]) {
      const control = screen.getByTestId(id);
      expect(flat(control)).toMatchObject({
        width: ref.button.square.size,
        height: ref.button.square.size,
        borderRadius: ref.button.square.radius,
        backgroundColor: ref.button.square.fill,
        borderWidth: ref.button.square.borderWidth,
        borderColor: ref.layout.camera.squareRim,
      });
      expect(control.props.hitSlop).toBe(slop);
      // The ring follows the rounded square, 2 outside its 1 pt rim.
      await fireEvent(control, "focus");
      const rings = ringsIn(control);
      expect(rings).toHaveLength(1);
      expect(flat(rings[0])).toMatchObject({
        top: RING_INSET - ref.button.square.borderWidth,
        borderRadius: ref.button.square.radius - RING_INSET + ref.button.square.borderWidth,
      });
    }
  });

  it("makes flash and the grid bare 48 targets with a round ring, centred on Once's glyph columns", async () => {
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
      // The ultra-wide is chosen by default, so it carries the mark.
      { half: screen.getByRole("radio", { name: COPY.ultraWide }), label: COPY.ultraWideLabel, title: `${COPY.ultraWideLabel}${COPY.lensMark}` },
      { half: screen.getByRole("radio", { name: COPY.mainLens }), label: COPY.mainLensLabel, title: COPY.mainLensLabel },
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

  it("caps the counter's numerals at 1.25 and lays them on one wide strip, so none wraps", async () => {
    seedRoll(2);
    await renderCamera();
    const C = ref.layout.camera.counter;
    expect(flat(screen.getByTestId("plate-counter"))).toMatchObject({ width: C.width, height: C.height, overflow: "hidden" });
    const strip = screen.getByTestId("plate-counter-strip", hidden);
    expect(flat(strip)).toMatchObject({ flexDirection: "row", gap: C.gap, width: C.width * PLATE_PROMPTS.length });
    for (const { numeral } of PLATE_PROMPTS) {
      const text = screen.getByText(numeral, hidden);
      expect(text.props.maxFontSizeMultiplier).toBe(C.maxFontScale);
      expect(text.parent?.props.testID).toBe("plate-counter-strip");
    }
  });
});

describe("Rangefinder: Once's look", () => {
  const L = ref.layout.camera;

  it("lays Once's flat ground with nothing under the chrome", async () => {
    await renderCamera();
    const root = screen.getByTestId("viewfinder").parent!;
    expect(flat(root)).toMatchObject({ backgroundColor: ref.color.ground });
    // No grain or glow: the header row is the first child.
    expect(root.children[0]).toBe(screen.getByTestId("prompt").parent);
  });

  it("fits the viewfinder as one 3:4 void well at radius 40, centred in the area", async () => {
    await renderCamera();
    const box = viewfinderLayout(AREA);
    expect(box.width).toBe(AREA.width);
    expect(box.width / box.height).toBeCloseTo(L.frameAspect);
    expect(box.y).toBeCloseTo((AREA.height - box.height) / 2);
    const well = flat(screen.getByTestId("viewfinder-well"));
    expect(well).toMatchObject({
      left: box.x,
      top: box.y,
      width: box.width,
      height: box.height,
      backgroundColor: ref.color.void,
      borderRadius: ref.radius.viewfinder,
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
      maxWidth: AREA.width - L.note.inset * 2,
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

  it("draws the segment as a void track with a raised thumb; the chosen label is followed by the xmark", async () => {
    camera.getAvailableLensesAsync.mockResolvedValue([{ deviceType: ULTRA_WIDE_LENS, localizedName: "Back Ultra Wide Camera" }]);
    await renderCamera();
    await cameraReady();
    const G = ref.button.segment;
    expect(flat(screen.getByTestId("lens-track", hidden))).toMatchObject({ width: G.width, height: G.height, borderRadius: G.radius, backgroundColor: G.fill });
    expect(flat(screen.getByTestId("lens-thumb", hidden))).toMatchObject({
      width: G.thumbWidth,
      height: G.thumbHeight,
      borderRadius: G.thumbRadius,
      backgroundColor: G.thumbFill,
      top: G.inset,
    });
    expect(flat(screen.getByText("1.0"))).toMatchObject({ ...ref.type.label });
    const mark = () => screen.getAllByTestId("lens-mark", hidden);
    expect(mark()).toHaveLength(1);
    expect(mark()[0].props.color).toBe(G.active);
    // The mark sits beside the chosen label (0.5 by default), in its thumb's box.
    expect(screen.getByText("0.5").parent?.props).toEqual(mark()[0].parent?.parent?.props);
    await fireEvent.press(screen.getByRole("radio", { name: COPY.mainLens }));
    expect(mark()).toHaveLength(1);
    expect(screen.getByText("1.0").parent?.props).toEqual(mark()[0].parent?.parent?.props);
  });

  it("sets the counter in the italic numerals on a void pill", async () => {
    seedRoll(2);
    await renderCamera();
    expect(flat(screen.getByTestId("plate-counter"))).toMatchObject({ backgroundColor: ref.color.void, borderRadius: ref.radius.nested });
    expect(flat(screen.getByText("3", hidden))).toMatchObject({ ...ref.type.counter });
    expect(counterCopy({ index: 2, retake: false })).toMatchObject({ current: 2, numeral: "3", solo: false });
  });

  it("builds the shutter: a shade ring glowing upward around the gradient disk and its white magnifier", async () => {
    await renderCamera();
    expect(flat(screen.getByTestId("shutter-ring", hidden))).toMatchObject({
      backgroundColor: ref.button.shutter.ringFill,
      borderRadius: ref.radius.round,
      boxShadow: ref.effect.shutterGlow,
    });
    expect(flat(screen.getByTestId("shutter-disk", hidden))).toMatchObject({ width: ref.button.shutter.disk, height: ref.button.shutter.disk });
    expect(screen.getByTestId("shutter-glass", hidden).props.color).toBe(ref.color.textPrimary);
    // Its centre sits `drop` below the bottom row's: the room is above it.
    expect(flat(screen.getByTestId("shutter").parent!)).toMatchObject({ paddingTop: L.shutter.drop * 2 });
  });

  it("frames the last plate in shade around a void well, and rings it in grey from 3 plates", async () => {
    seedRoll(2);
    await renderCamera();
    const T = ref.button.thumbnail;
    expect(flat(screen.getByTestId("last-plate"))).toMatchObject({ backgroundColor: T.frameFill, borderRadius: T.radius });
    expect(flat(screen.getByTestId("last-plate-image", hidden))).toMatchObject({ top: T.frameWidth, backgroundColor: ref.color.void, borderRadius: T.imageRadius });
    expect(flat(screen.getByTestId("last-plate-ring", hidden))).toMatchObject({ borderWidth: L.cue.width, borderColor: L.cue.color, borderRadius: T.radius });
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
      accessibilityLabel: "Next: photo 1. 0 of 6 photos taken.",
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

  it("words the 360: start in the middle, turn right a little each time, back to the start", () => {
    expect(PLATE_PROMPTS.map((p) => p.title)).toEqual(["Start here", "Turn right a little", "Keep turning", "Halfway round", "Nearly round", "Last turn"]);
    expect(PLATE_PROMPTS[0].detail).toBe("Stand in the middle. Face any wall.");
    expect(PLATE_PROMPTS[1].detail).toBe("Keep part of the last photo in view.");
    expect(PLATE_PROMPTS[5].detail).toBe("After this one, you're back at the start.");
    expect(PLATE_PROMPTS.map((p) => p.name)).toEqual(["Start", "Front right", "Back right", "Behind", "Back left", "Front left"]);
    // No spot-by-spot prompts, no darkroom words.
    const all = JSON.stringify(PLATE_PROMPTS);
    expect(all).not.toMatch(/doorway|corner|busiest|close view|plate|roll|develop/i);
  });

  it("aims a retake between the photos either side of it, round the circle", () => {
    expect(promptCopy({ index: 0, retake: true })).toEqual({ title: "Start", detail: "From the middle, aim between photos 6 and 2." });
    expect(promptCopy({ index: 3, retake: true })).toEqual({ title: "Behind", detail: "From the middle, aim between photos 3 and 5." });
    expect(promptCopy({ index: 5, retake: true })).toEqual({ title: "Front left", detail: "From the middle, aim between photos 5 and 1." });
    expect(shutterLabel({ index: 3, retake: true })).toBe("Retake photo 4, Behind");
    expect(shutterLabel({ index: 3, retake: true, filling: true })).toBe("Take photo 4, Behind");
  });

  it("counts the turn dial's photos, and says when all are taken", () => {
    expect(turnCopy({ index: 1, retake: false }, 6, false)).toEqual({ line: "Photo 2 of 6", accessibilityLabel: "Photo 2 of 6." });
    expect(turnCopy({ index: 1, retake: false }, 6, true).accessibilityLabel).toBe(`Photo 2 of 6. ${COPY.turnReached}`);
    expect(turnCopy({ index: 6, retake: false }, 6, false)).toEqual({ line: "6 of 6 taken", accessibilityLabel: "6 of 6 taken, all the way round." });
    expect(turnCopy({ index: 2, retake: true }, 6, false).line).toBe("Photo 3 of 6");
  });
});

describe("Rangefinder: the turn dial", () => {
  const dial = () => screen.getByTestId("turn-dial");

  it("counts the photos round the room on the feed, and stays static with no motion sensor (as under Jest)", async () => {
    await renderCamera();
    await cameraReady();
    expect(dial().props.accessibilityLabel).toBe("Photo 1 of 6.");
    expect(screen.getByText("Photo 1 of 6", hidden)).toBeTruthy();
    expect(screen.getByTestId("turn-dial-target", hidden)).toBeTruthy();
    expect(screen.queryAllByTestId("turn-dial-taken", hidden)).toHaveLength(0);
    await fireEvent.press(screen.getByTestId("shutter"));
    await flush();
    expect(screen.getByText("Photo 2 of 6", hidden)).toBeTruthy();
    expect(screen.getAllByTestId("turn-dial-taken", hidden)).toHaveLength(1);
    expect(screen.queryByTestId("turn-dial-arc", hidden)).toBeNull();
    // Its words sit in the viewfinder, after the feed and before the privacy note.
    expect(screen.getByTestId("viewfinder-well")).toContainElement(dial());
  });

  it("plans the same 6 stops on either lens (the photo limit), and says when all are taken", async () => {
    camera.getAvailableLensesAsync.mockResolvedValue([{ deviceType: ULTRA_WIDE_LENS, localizedName: "Back Ultra Wide Camera" }]);
    seedRoll(MAX_PLATES);
    await renderCamera();
    await cameraReady();
    expect(screen.getByText("6 of 6 taken", hidden)).toBeTruthy();
    expect(screen.getAllByTestId("turn-dial-taken", hidden)).toHaveLength(6);
    await fireEvent.press(screen.getByRole("radio", { name: COPY.mainLens }));
    expect(screen.getAllByTestId("turn-dial-taken", hidden)).toHaveLength(6);
  });

  it("marks the retaken photo's stop in retake mode", async () => {
    seedRoll(4);
    await renderCamera(2);
    expect(screen.getByText("Photo 3 of 6", hidden)).toBeTruthy();
    expect(screen.getAllByTestId("turn-dial-taken", hidden)).toHaveLength(3);
    expect(screen.getByTestId("turn-dial-target", hidden)).toBeTruthy();
  });
});

describe("Rangefinder: inside a mode", () => {
  const theme = modeThemes.crime_scene;
  const uriOf = (node: { props: { source?: unknown } }) => ([node.props.source].flat()[0] as { uri: string }).uri;
  beforeEach(() => setMode("crime_scene"));
  afterEach(() => setMode(null));

  it("takes the mode's ground, raised square buttons, inks and wells", async () => {
    seedRoll(2);
    await renderCamera();
    expect(flat(screen.getByTestId("rangefinder-root"))).toMatchObject({ backgroundColor: theme.surface });
    expect(flat(screen.getByTestId("back"))).toMatchObject({ backgroundColor: theme.raised, borderColor: theme.rim });
    expect(flat(screen.getByText(PLATE_PROMPTS[2].title))).toMatchObject({ ...ref.type.serifTitle, color: theme.ink });
    expect(flat(screen.getByText(PLATE_PROMPTS[2].detail)).color).toBe(theme.inkMuted);
    expect(flat(screen.getByTestId("viewfinder-well"))).toMatchObject({ backgroundColor: theme.ground });
    expect(flat(screen.getByTestId("plate-counter"))).toMatchObject({ backgroundColor: theme.ground });
    expect(flat(screen.getByTestId("shutter-ring", hidden))).toMatchObject({ backgroundColor: theme.ground, boxShadow: ref.effect.shutterGlow });
    expect(screen.getByTestId("shutter-glass", hidden).props.color).toBe(theme.ink);
  });

  it("shows the last photo in the mode's baked treatment, framed in the mode's near-black, ringed in its stamp colour from 3", async () => {
    seedRoll(3);
    await renderCamera();
    expect(uriOf(screen.getByTestId("last-plate-photo-treated", hidden))).toBe("baked/crime_scene/file://old-2.jpg");
    expect(flat(screen.getByTestId("last-plate"))).toMatchObject({ backgroundColor: theme.ground });
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

  it("draws the lens segment in the mode's well, raised thumb and ink", async () => {
    camera.getAvailableLensesAsync.mockResolvedValue([{ deviceType: ULTRA_WIDE_LENS, localizedName: "Back Ultra Wide Camera" }]);
    await renderCamera();
    await cameraReady();
    expect(flat(screen.getByTestId("lens-track", hidden)).backgroundColor).toBe(theme.ground);
    expect(flat(screen.getByTestId("lens-thumb", hidden)).backgroundColor).toBe(theme.raised);
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

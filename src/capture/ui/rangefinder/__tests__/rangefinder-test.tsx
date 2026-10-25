/// <reference types="node" />
import fs from "fs";
import path from "path";
import { AccessibilityInfo, BackHandler, Platform, StyleSheet } from "react-native";
import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { processPhoto, type ProcessedPlate, type RawPhoto } from "@/capture/process-photo";
import { addPlate, clearPlates, getPlates } from "@/capture/roll";
import { MAX_PLATES, PLATE_PROMPTS } from "@/capture/slots";
import { motion, ref } from "@/theme/tokens";
import { Rangefinder } from "../../Rangefinder";
import { COPY, libraryError, thinkingCopy } from "../copy";
import { ULTRA_WIDE_LENS } from "../useLenses";

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
const mockTap = jest.fn();
jest.mock("@/game/feedback", () => ({
  useFeedback: () => ({ tap: () => mockTap(), success: () => {}, warning: () => {} }),
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

async function renderCamera(retakeIndex: number | null = null) {
  const onClose = jest.fn();
  await render(<Rangefinder retakeIndex={retakeIndex} onClose={onClose} />);
  // The frame (and the camera in it) mounts once the viewfinder area is laid out.
  await fireEvent(screen.getByTestId("viewfinder"), "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 365, height: 486.7 } } });
  return { onClose };
}

const cameraProps = () => screen.getByTestId("camera", hidden).props;
const cameraReady = () => act(async () => cameraProps().onCameraReady());
const prompt = () => screen.getByRole("header").props.accessibilityLabel as string;
const counter = () => screen.getByTestId("plate-counter").props.accessibilityLabel as string;
const stateOf = (node: { props: { accessibilityState?: Record<string, unknown> } }) => node.props.accessibilityState ?? {};
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
    expect(prompt()).toBe("From the doorway. Wide. Include the floor and two walls.");
    expect(counter()).toBe("Next: plate I. 0 of 6 plates taken.");
    expect(screen.getByText("PLATE")).toBeTruthy();
    expect(screen.getByText("I")).toBeTruthy();
    expect(screen.getByText(COPY.privacy)).toBeTruthy();
    expect(stateOf(screen.getByRole("button", { name: "Take plate I, From the doorway" }))).toMatchObject({ disabled: true });
    expect(stateOf(screen.getByRole("switch", { name: "Flash" }))).toMatchObject({ disabled: true, checked: false });
    expect(stateOf(screen.getByRole("switch", { name: "Framing grid" }))).toMatchObject({ disabled: true, checked: false });
    expect(stateOf(screen.getByRole("button", { name: "Close the camera" }))).toMatchObject({ disabled: false });
    expect(stateOf(screen.getByRole("button", { name: "Choose photos from your library" }))).toMatchObject({ disabled: false });
    // The empty well before plate I: disabled, never a target.
    expect(stateOf(screen.getByRole("button", { name: "Open the light table, 0 plates" }))).toMatchObject({ disabled: true });
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
    expect(stateOf(screen.getByRole("button", { name: "Take plate I, From the doorway" }))).toMatchObject({ disabled: false, busy: false });
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
  });

  it("offers 0.5x only when the lens list reports an ultra-wide, defaulting to 1x", async () => {
    camera.getAvailableLensesAsync.mockResolvedValue([
      { deviceType: "AVCaptureDeviceTypeBuiltInWideAngleCamera", localizedName: "Back Camera" },
      { deviceType: ULTRA_WIDE_LENS, localizedName: "Back Ultra Wide Camera" },
    ]);
    await renderCamera();
    expect(screen.queryByRole("radio")).toBeNull();
    await cameraReady();
    expect(screen.getByTestId("lens").props).toMatchObject({ accessibilityRole: "radiogroup", accessibilityLabel: "Lens" });
    expect(stateOf(screen.getByRole("radio", { name: "Main lens" }))).toMatchObject({ selected: true });
    expect(stateOf(screen.getByRole("radio", { name: "Ultra-wide lens" }))).toMatchObject({ selected: false });
    expect(screen.getByText("0.5×")).toBeTruthy();
    await fireEvent.press(screen.getByRole("radio", { name: "Ultra-wide lens" }));
    expect(cameraProps().selectedLens).toBe(ULTRA_WIDE_LENS);
    await fireEvent.press(screen.getByRole("radio", { name: "Main lens" }));
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
    await fireEvent.press(screen.getByRole("button", { name: "Take plate I, From the doorway" }));
    await flush();
    expect(camera.takePictureAsync).toHaveBeenCalledWith({ quality: 0.92, exif: false });
    expect(mockTap).toHaveBeenCalledTimes(1);
    expect(develop).toHaveBeenCalledWith(raw("shot"));
    expect(getPlates().map((p) => p.uri)).toEqual(["file://plate-shot.jpg"]);
    expect(prompt()).toBe("Opposite corner. Overlap the first plate.");
    expect(counter()).toBe("Next: plate II. 1 of 6 plates taken.");
    expect(screen.getByRole("button", { name: "Take plate II, Opposite corner" })).toBeTruthy();
    expect(thumbnailUri()).toBe("file://plate-shot.jpg");
    // The privacy note is only for plate I.
    expect(screen.queryByText(COPY.privacy)).toBeNull();
    // Jest runs as iOS, which has no live regions: the new prompt is announced.
    expect(announce).toHaveBeenCalledWith("Opposite corner. Overlap the first plate.");
  });

  it("is busy while the plate develops: taps ignored, library, flash and thumbnail dimmed, back and grid live", async () => {
    seedRoll(1);
    const pending = holdProcessing();
    await renderCamera();
    await cameraReady();
    const user = userEvent.setup();
    await user.press(screen.getByRole("button", { name: "Take plate II, Opposite corner" }));
    await flush();
    expect(stateOf(screen.getByTestId("shutter"))).toMatchObject({ busy: true });
    await user.press(screen.getByTestId("shutter"));
    expect(camera.takePictureAsync).toHaveBeenCalledTimes(1);
    expect(stateOf(screen.getByRole("button", { name: "Choose photos from your library" }))).toMatchObject({ disabled: true });
    expect(stateOf(screen.getByRole("switch", { name: "Flash" }))).toMatchObject({ disabled: true });
    expect(stateOf(screen.getByRole("button", { name: "Open the light table, 1 plate" }))).toMatchObject({ disabled: true });
    expect(stateOf(screen.getByRole("switch", { name: "Framing grid" }))).toMatchObject({ disabled: false });
    expect(stateOf(screen.getByRole("button", { name: "Close the camera" }))).toMatchObject({ disabled: false });
    // The prompt holds the plate being developed.
    expect(prompt()).toBe("Opposite corner. Overlap the first plate.");
    await act(async () => pending[0].finish());
    expect(prompt()).toBe("The busiest wall. The wall with the most objects.");
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
      expect(prompt()).toBe("From the doorway. Wide. Include the floor and two walls.");
      await act(async () => {
        jest.advanceTimersByTime(ref.layout.camera.thinkingDelay);
      });
      expect(prompt()).toBe("From the doorway. Preparing plate I");
      expect(screen.getByTestId("thinking", hidden)).toBeTruthy();
      await act(async () => pending[0].finish());
      expect(screen.queryByTestId("thinking", hidden)).toBeNull();
      expect(prompt()).toBe("Opposite corner. Overlap the first plate.");
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
    expect(prompt()).toBe(`From the doorway. ${COPY.captureError}`);
    expect(screen.getByText(COPY.captureError, hidden)).toBeTruthy();
    expect(getPlates()).toHaveLength(0);
    await fireEvent.press(screen.getByTestId("shutter"));
    await flush();
    expect(prompt()).toBe("Opposite corner. Overlap the first plate.");
  });

  it("says when the camera didn't start, keeps the shutter, flash and grid dimmed and never offers a lens", async () => {
    camera.getAvailableLensesAsync.mockResolvedValue([{ deviceType: ULTRA_WIDE_LENS, localizedName: "Back Ultra Wide Camera" }]);
    await renderCamera();
    await act(async () => cameraProps().onMountError({ message: "no camera" }));
    expect(prompt()).toBe(`From the doorway. ${COPY.mountError}`);
    expect(stateOf(screen.getByTestId("shutter"))).toMatchObject({ disabled: true });
    expect(stateOf(screen.getByRole("switch", { name: "Flash" }))).toMatchObject({ disabled: true });
    expect(stateOf(screen.getByRole("switch", { name: "Framing grid" }))).toMatchObject({ disabled: true });
    expect(stateOf(screen.getByRole("button", { name: "Choose photos from your library" }))).toMatchObject({ disabled: false });
    expect(screen.queryByRole("radio")).toBeNull();
  });
});

describe("Rangefinder: the roll", () => {
  it("names the light table, then marks it as the way on from 3 plates", async () => {
    seedRoll(2);
    await renderCamera();
    expect(screen.getByRole("button", { name: "Open the light table, 2 plates" })).toBeTruthy();
    await act(async () => {
      addPlate({ uri: "file://third.jpg", width: 1200, height: 1600 });
    });
    const thumbnail = screen.getByRole("button", { name: "Continue to the light table, 3 plates" });
    expect(stateOf(thumbnail)).toMatchObject({ disabled: false });
    expect(thumbnailUri()).toBe("file://third.jpg");
    await fireEvent.press(thumbnail);
    expect(push).toHaveBeenCalledWith("/capture/review");
  });

  it("holds a full roll: full-roll prompt, FULL over VI, shutter and library off, flash and grid live", async () => {
    seedRoll(MAX_PLATES);
    await renderCamera();
    await cameraReady();
    expect(prompt()).toBe(`${COPY.fullTitle}. ${COPY.fullDetail}`);
    expect(counter()).toBe("Roll full. 6 of 6 plates taken.");
    expect(screen.getByText("FULL")).toBeTruthy();
    expect(screen.getByText("VI")).toBeTruthy();
    expect(stateOf(screen.getByTestId("shutter"))).toMatchObject({ disabled: true });
    expect(stateOf(screen.getByRole("button", { name: "Choose photos from your library" }))).toMatchObject({ disabled: true });
    expect(stateOf(screen.getByRole("switch", { name: "Flash" }))).toMatchObject({ disabled: false });
    expect(stateOf(screen.getByRole("button", { name: "Continue to the light table, 6 plates" }))).toMatchObject({ disabled: false });
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
    expect(prompt()).toBe(`The busiest wall. ${libraryError(1)}`);
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
      expect(prompt()).toBe("From the doorway. Preparing 2 photos");
      expect(screen.getByText("Preparing photo 1 of 2", hidden)).toBeTruthy();
      await act(async () => pending[0].finish());
      expect(getPlates()).toHaveLength(1);
      expect(prompt()).toBe("From the doorway. Preparing 2 photos");
      expect(counter()).toBe("Next: plate I. 0 of 6 plates taken.");
      expect(screen.getByText("Preparing photo 2 of 2", hidden)).toBeTruthy();
      await act(async () => pending[1].finish());
      expect(prompt()).toBe("The busiest wall. The wall with the most objects.");
      expect(counter()).toBe("Next: plate III. 2 of 6 plates taken.");
      expect(screen.queryByTestId("thinking", hidden)).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });
});

describe("Rangefinder: retake mode", () => {
  it("retakes the plate's prompt with RETAKE on the counter, no privacy note and cancel labels", async () => {
    seedRoll(3);
    const { onClose } = await renderCamera(1);
    expect(prompt()).toBe("Opposite corner. Overlap the first plate.");
    expect(counter()).toBe("Retaking plate II.");
    expect(screen.getByText("RETAKE")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retake plate II, Opposite corner" })).toBeTruthy();
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

  it("replaces the plate and returns to the light table; back is ignored until it settles", async () => {
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
  const SLOP = (ref.hit.comfortable - ref.hit.min) / 2;
  const RING_INSET = -(ref.focus.offset + ref.focus.width);
  const flat = (node: { props: Record<string, unknown> }) => StyleSheet.flatten(node.props.style as Parameters<typeof StyleSheet.flatten>[0]) ?? {};
  const slopOf = (node: { props: Record<string, unknown> }) => {
    const slop = node.props.hitSlop as number | { top: number } | undefined;
    return typeof slop === "number" ? slop : slop?.top;
  };

  it("gives library, flash and grid 48 x 48 hit areas that lie inside their wrappers", async () => {
    await renderCamera();
    await cameraReady();
    for (const id of ["library", "flash", "grid"]) {
      const control = screen.getByTestId(id);
      expect(flat(control)).toMatchObject({ width: ref.hit.min, height: ref.hit.min });
      expect(slopOf(control)).toBe(SLOP);
      // Native hit-testing drops touches outside a parent, so the wrapper is the
      // 48 box itself, with a 44 footprint.
      expect(flat(control.parent!)).toMatchObject({ padding: SLOP, margin: -SLOP });
    }
  });

  it("makes each lens half a 50 x 48 target that offers the large-content viewer, ringed as one track", async () => {
    camera.getAvailableLensesAsync.mockResolvedValue([{ deviceType: ULTRA_WIDE_LENS, localizedName: "Back Ultra Wide Camera" }]);
    await renderCamera();
    await cameraReady();
    const halves = [
      { half: screen.getByRole("radio", { name: COPY.ultraWide }), label: COPY.ultraWideLabel },
      { half: screen.getByRole("radio", { name: COPY.mainLens }), label: COPY.mainLensLabel },
    ];
    for (const { half, label } of halves) {
      expect(flat(half)).toMatchObject({ width: ref.layout.camera.lensOptionWidth, height: ref.hit.comfortable });
      expect(slopOf(half)).toBeUndefined();
      expect(half.props).toMatchObject({ accessibilityShowsLargeContentViewer: true, accessibilityLargeContentTitle: label });
      expect(screen.getByText(label).props.maxFontSizeMultiplier).toBe(ref.layout.camera.lensMaxFontScale);
    }
    const lens = screen.getByTestId("lens");
    expect(flat(lens)).toMatchObject({ height: ref.hit.comfortable });
    // Either half focused draws one pill around the whole 36 track.
    await fireEvent(halves[1].half, "focus");
    const rings = lens.queryAll((node) => flat(node).top === RING_INSET && flat(node).borderWidth === ref.focus.width);
    expect(rings).toHaveLength(1);
    expect(flat(rings[0].parent!)).toMatchObject({ width: ref.layout.camera.lensOptionWidth * 2, height: ref.button.segment.height });
    expect(flat(rings[0].parent!).borderWidth).toBeUndefined();
  });

  it("measures the shutter's focus outline from its 76 outer edge: an 84 circle clear of its ring", async () => {
    await renderCamera();
    await cameraReady();
    const shutter = screen.getByTestId("shutter");
    expect(flat(shutter)).toMatchObject({ width: ref.button.shutter.ring, height: ref.button.shutter.ring });
    // Yoga places absolute children inside a parent's border, so the box has none.
    expect(flat(shutter).borderWidth).toBeUndefined();
    await fireEvent(shutter, "focus");
    const rings = shutter.queryAll((node) => flat(node).top === RING_INSET && flat(node).borderWidth === ref.focus.width);
    expect(rings).toHaveLength(1);
    expect(rings[0].parent?.props.testID).toBe("shutter");
  });

  it("lets the counter's lines measure past its 70 inner width, so III never breaks at the 1.25 cap", async () => {
    seedRoll(2);
    await renderCamera();
    for (const text of ["PLATE", "III"]) {
      const line = screen.getByText(text);
      expect(flat(line)).toMatchObject({ marginHorizontal: -ref.space.sm });
      expect(line.props.maxFontSizeMultiplier).toBe(ref.layout.camera.counterMaxFontScale);
      expect(line.props.numberOfLines).toBeUndefined();
    }
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
      accessibilityLabel: "From the doorway. Wide. Include the floor and two walls.",
      accessibilityLiveRegion: "polite",
    });
    expect(screen.getByTestId("plate-counter").props).toMatchObject({
      accessible,
      screenReaderFocusable: true,
      accessibilityRole: "text",
      accessibilityLabel: "Next: plate I. 0 of 6 plates taken.",
    });
    // Their texts stay out of Android's accessibility tree: each element is read once, by its label.
    for (const text of ["From the doorway", "Wide. Include the floor and two walls.", "PLATE", "I"]) {
      expect(screen.getByText(text).props.importantForAccessibility).toBe("no");
    }
    // The error line inside the prompt is not a stop either.
    await cameraReady();
    await fireEvent.press(screen.getByTestId("shutter"));
    await flush();
    expect(screen.getByTestId("prompt").props.accessibilityLabel).toBe(`From the doorway. ${COPY.captureError}`);
    expect(screen.getByTestId("notice", hidden).props.accessible).toBeUndefined();
  });
});

describe("copy", () => {
  it("counts library imports as real progress, sized to the longest line", () => {
    expect(thinkingCopy({ done: 1, total: 4 }, "II")).toEqual({
      line: "Preparing photo 2 of 4",
      accessibilityLabel: "Preparing 4 photos",
      sizeTo: ["Preparing photo 4 of 4"],
    });
    expect(thinkingCopy({ done: 0, total: 1 }, "III")).toEqual({ line: "Preparing plate III", accessibilityLabel: "Preparing plate III" });
    expect(thinkingCopy(null, "III").line).toBe("Preparing plate III");
  });

  it("uses the one-line plate V detail", () => {
    expect(PLATE_PROMPTS[4].detail).toBe("Optional. Anything still unseen.");
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

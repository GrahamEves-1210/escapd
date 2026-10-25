/// <reference types="node" />
import fs from "fs";
import path from "path";
import { AccessibilityInfo, BackHandler, Dimensions, Platform, StyleSheet } from "react-native";
import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { processPhoto, type ProcessedPlate, type RawPhoto } from "@/capture/process-photo";
import { addPlate, clearPlates, getPlates } from "@/capture/roll";
import { MAX_PLATES, PLATE_PROMPTS } from "@/capture/slots";
import { color, hit, motion, radius, ref, space, type as typeScale } from "@/theme/tokens";
import { Rangefinder } from "../../Rangefinder";
import { COPY, libraryError, plateLabel, thinkingCopy } from "../copy";
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

// The viewfinder area on 393 x 852 (safe 59 / 34): x 14-379, y 129-638.
const AREA = { width: 365, height: 509 };

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
    expect(prompt()).toBe("From the doorway. Wide. Include the floor and two walls.");
    expect(counter()).toBe("Next: plate I. 0 of 6 plates taken.");
    expect(screen.getByText("PLATE")).toBeTruthy();
    expect(screen.getByText("I")).toBeTruthy();
    expect(screen.getByText(COPY.privacy)).toBeTruthy();
    expect(stateOf(screen.getByRole("button", { name: "Take plate I, From the doorway" }))).toMatchObject({ disabled: true });
    expect(stateOf(screen.getByRole("switch", { name: "Flash" }))).toMatchObject({ disabled: true, checked: false });
    expect(stateOf(screen.getByRole("switch", { name: "Framing grid" }))).toMatchObject({ disabled: true, checked: false });
    expect(stateOf(screen.getByRole("button", { name: "Close the camera" })).disabled).toBeFalsy();
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
    expect(stateOf(screen.getByRole("button", { name: "Close the camera" })).disabled).toBeFalsy();
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
  // The live IconButton's hitSlop, and the kit focus ring's inset.
  const SLOP = space.xs;
  const RING_INSET = -(ref.focus.offset + ref.focus.width);
  const slopOf = (node: { props: Record<string, unknown> }) => {
    const slop = node.props.hitSlop as number | { top: number } | undefined;
    return typeof slop === "number" ? slop : slop?.top;
  };

  it("draws back, library, flash and grid as live 48 IconButtons whose 56 hit areas lie inside their rows", async () => {
    await renderCamera();
    await cameraReady();
    for (const id of ["back", "library", "flash", "grid"]) {
      const control = screen.getByTestId(id);
      expect(flat(control)).toMatchObject({ width: hit.min, height: hit.min, borderRadius: radius.round });
      expect(slopOf(control)).toBe(SLOP);
      // Native hit-testing drops touches outside a parent, so the row itself
      // carries the slop above and below, and its side padding is wider still.
      const row = flat(control.parent!);
      expect(row).toMatchObject({ paddingVertical: SLOP, paddingHorizontal: ref.layout.camera.buttons.edge });
      expect(ref.layout.camera.buttons.edge).toBeGreaterThanOrEqual(SLOP);
    }
  });

  it("makes each lens half a 50 x 48 target that offers the large-content viewer, ringed in brass as one track", async () => {
    camera.getAvailableLensesAsync.mockResolvedValue([{ deviceType: ULTRA_WIDE_LENS, localizedName: "Back Ultra Wide Camera" }]);
    await renderCamera();
    await cameraReady();
    const halves = [
      { half: screen.getByRole("radio", { name: COPY.ultraWide }), label: COPY.ultraWideLabel },
      { half: screen.getByRole("radio", { name: COPY.mainLens }), label: COPY.mainLensLabel },
    ];
    for (const { half, label } of halves) {
      expect(flat(half)).toMatchObject({ width: ref.layout.camera.lensOptionWidth, height: hit.min });
      expect(slopOf(half)).toBeUndefined();
      expect(half.props).toMatchObject({ accessibilityShowsLargeContentViewer: true, accessibilityLargeContentTitle: label });
      expect(screen.getByText(label).props.maxFontSizeMultiplier).toBe(ref.layout.camera.lensMaxFontScale);
    }
    const lens = screen.getByTestId("lens");
    expect(flat(lens)).toMatchObject({ height: hit.min });
    // Either half focused draws one ring around the whole 36 track, concentric with its 8 pt corners.
    await fireEvent(halves[1].half, "focus");
    const rings = lens.queryAll((node) => flat(node).top === RING_INSET && flat(node).borderWidth === ref.focus.width);
    expect(rings).toHaveLength(1);
    expect(flat(rings[0])).toMatchObject({ borderColor: color.accent, borderRadius: radius.control - RING_INSET });
    expect(flat(rings[0].parent!)).toMatchObject({ width: ref.layout.camera.lensOptionWidth * 2, height: ref.layout.camera.lensTrack });
    expect(flat(rings[0].parent!).borderWidth).toBeUndefined();
  });

  it("measures the shutter's brass focus ring from its 76 outer edge: an 84 circle clear of its ring", async () => {
    await renderCamera();
    await cameraReady();
    const shutter = screen.getByTestId("shutter");
    expect(flat(shutter)).toMatchObject({ width: ref.layout.camera.shutter.size, height: ref.layout.camera.shutter.size });
    // Yoga places absolute children inside a parent's border, so the box has none.
    expect(flat(shutter).borderWidth).toBeUndefined();
    await fireEvent(shutter, "focus");
    const rings = shutter.queryAll((node) => flat(node).top === RING_INSET && flat(node).borderWidth === ref.focus.width);
    expect(rings).toHaveLength(1);
    expect(rings[0].parent?.props.testID).toBe("shutter");
    expect(flat(rings[0])).toMatchObject({ borderColor: color.accent, borderRadius: radius.round });
  });

  it("rings the thumbnail 2 outside its 72 mount, concentric with radius.thumbRing", async () => {
    seedRoll(1);
    await renderCamera();
    const thumbnail = screen.getByTestId("last-plate");
    expect(flat(thumbnail)).toMatchObject({ width: ref.layout.camera.plateBox, height: ref.layout.camera.plateBox });
    expect(flat(thumbnail).borderWidth).toBeUndefined();
    await fireEvent(thumbnail, "focus");
    const rings = thumbnail.queryAll((node) => flat(node).top === RING_INSET && flat(node).borderWidth === ref.focus.width);
    expect(rings).toHaveLength(1);
    expect(flat(rings[0])).toMatchObject({ borderColor: color.accent, borderRadius: radius.thumbRing - RING_INSET });
    await fireEvent(thumbnail, "blur");
    expect(thumbnail.queryAll((node) => flat(node).top === RING_INSET)).toHaveLength(0);
  });

  it("caps the counter's lines at 1.25 and lets them measure against the whole 72 window, so III never breaks", async () => {
    seedRoll(2);
    await renderCamera();
    const window = screen.getByTestId("plate-counter");
    expect(flat(window)).toMatchObject({ width: ref.layout.camera.plateBox, height: ref.layout.camera.plateBox });
    for (const text of ["PLATE", "III"]) {
      const line = screen.getByText(text);
      expect(line.props.maxFontSizeMultiplier).toBe(ref.layout.camera.counterMaxFontScale);
      expect(line.props.numberOfLines).toBeUndefined();
      // Text, then its fade wrapper, then the 72 window itself: never the 64 plate.
      expect(line.parent?.parent?.props.testID).toBe("plate-counter");
    }
  });
});

describe("Rangefinder: the play screen's look", () => {
  const L = ref.layout.camera;

  it("lays the soot ground under the live grain, with no silk", async () => {
    await renderCamera();
    const root = screen.getByTestId("viewfinder").parent!;
    expect(flat(root)).toMatchObject({ backgroundColor: color.canvas });
    // The grain is the root's first child, under every control and the opaque mount.
    expect(root.children[0]).toMatchObject({ props: expect.objectContaining({ resizeMode: "repeat", pointerEvents: "none" }) });
  });

  it("mounts the feed on a 3:4 plate in a walnut mount, fitted and centred in the area", async () => {
    await renderCamera();
    // 365 x 509: the plate takes the full 351 width (365 less 2 x 7), 468 tall; the mount adds 34 below for the label.
    expect(viewfinderLayout(AREA, 1)).toEqual({
      mount: { x: 0, y: 3.5, width: 365, height: 502 },
      plate: { width: 351, height: 468 },
      label: typeScale.stamp.lineHeight,
    });
    // As rendered at the test window's text size (the label line follows it, capped).
    const { mount, plate } = viewfinderLayout(AREA, Dimensions.get("window").fontScale);
    expect(flat(screen.getByTestId("viewfinder-mount"))).toMatchObject({
      left: mount.x,
      top: mount.y,
      width: mount.width,
      height: mount.height,
      padding: L.mount.pad,
      backgroundColor: color.surface,
      borderWidth: L.hairline,
      borderColor: color.hairline,
      borderRadius: radius.mount,
    });
    expect(flat(screen.getByTestId("viewfinder-plate"))).toMatchObject({
      width: plate.width,
      height: plate.height,
      backgroundColor: color.canvas,
      borderRadius: radius.image,
      overflow: "hidden",
    });
    // The camera lives on the plate; the brackets over it are brass.
    expect(screen.getByTestId("camera", hidden).parent?.parent?.props.testID).toBe("viewfinder-plate");
    for (const corner of ["tl", "tr", "bl", "br"]) {
      expect(flat(screen.getByTestId(`bracket-${corner}`, hidden))).toMatchObject({ borderColor: color.accent, width: L.bracketArm });
    }
  });

  it("caps the plate label's line, so large text shrinks the plate rather than wrapping the label", () => {
    const large = viewfinderLayout(AREA, 2);
    expect(large.label).toBe(typeScale.stamp.lineHeight * L.labelMaxFontScale);
    expect(large.plate.width / large.plate.height).toBeCloseTo(L.frameAspect);
    expect(large.mount.height).toBeLessThanOrEqual(AREA.height);
  });

  it("stamps the brass plate label under the plate and keeps it in step with the roll", async () => {
    await renderCamera();
    const label = () => screen.getByTestId("plate-label", hidden);
    const text = (value: string) => screen.getByText(value, hidden);
    expect(label().props).toMatchObject({ accessibilityElementsHidden: true, importantForAccessibility: "no-hide-descendants" });
    expect(text("ESCAPD 400  ·  PLATE I")).toBeTruthy();
    expect(flat(text("ESCAPD 400  ·  PLATE I"))).toMatchObject({ ...typeScale.stamp, color: color.accent });
    expect(text("ESCAPD 400  ·  PLATE I").props.maxFontSizeMultiplier).toBe(L.labelMaxFontScale);
    await cameraReady();
    await fireEvent.press(screen.getByTestId("shutter"));
    await flush();
    expect(text("ESCAPD 400  ·  PLATE II")).toBeTruthy();
    expect(plateLabel({ index: MAX_PLATES, retake: false })).toBe("ESCAPD 400  ·  ROLL FULL");
    expect(plateLabel({ index: 1, retake: true })).toBe("ESCAPD 400  ·  PLATE II");
  });

  it("sets the prompt in Playfair over a Jakarta detail, one line each the buttons' 48", async () => {
    await renderCamera();
    expect(flat(screen.getByText("From the doorway"))).toMatchObject({ ...typeScale.narrativeTitle, color: color.text });
    expect(flat(screen.getByText("Wide. Include the floor and two walls."))).toMatchObject({ ...typeScale.caption, color: color.textSecondary });
    expect(typeScale.narrativeTitle.lineHeight + typeScale.caption.lineHeight).toBe(hit.min);
  });

  it("writes errors in secondary text beside a warning glyph, never in the error red", async () => {
    camera.takePictureAsync.mockRejectedValueOnce(new Error("busy"));
    await renderCamera();
    await cameraReady();
    await fireEvent.press(screen.getByTestId("shutter"));
    await flush();
    expect(flat(screen.getByText(COPY.captureError, hidden))).toMatchObject({ ...typeScale.caption, color: color.textSecondary });
    const glyph = screen.getByTestId("notice-icon", hidden).children[0] as { props: Record<string, unknown> };
    expect(glyph.props).toMatchObject({ color: color.warning, width: L.noticeIcon });
  });

  it("draws the privacy note as a walnut notice panel on the plate", async () => {
    await renderCamera();
    expect(flat(screen.getByTestId("privacy-note"))).toMatchObject({
      backgroundColor: color.surface,
      borderColor: color.hairline,
      borderRadius: radius.control,
      maxWidth: 351 - (space.lg + L.bracketArm + space.sm) * 2,
    });
    expect(flat(screen.getByText(COPY.privacy))).toMatchObject({ ...typeScale.caption, color: color.textSecondary });
  });

  it("builds the counter and the thumbnail as small walnut mounts, the counter in brass mono", async () => {
    seedRoll(3);
    await renderCamera();
    expect(flat(screen.getByText("PLATE"))).toMatchObject({ ...typeScale.stamp, color: color.accent });
    expect(flat(screen.getByText("IV"))).toMatchObject({ ...typeScale.code, color: color.accent });
    expect(flat(screen.getByTestId("last-plate-mount", hidden))).toMatchObject({ borderWidth: L.hairline, borderRadius: radius.thumbRing });
    // From 3 plates the continue cue is a 2 pt brass ring over the mount's edge.
    expect(flat(screen.getByTestId("last-plate-ring", hidden))).toMatchObject({ borderWidth: L.ringWidth, borderRadius: radius.thumbRing });
  });

  it("rings the shutter in brass around its manila core and ink magnifier", async () => {
    await renderCamera();
    const shutter = screen.getByTestId("shutter");
    expect(flat(shutter.children[0] as never)).toMatchObject({ borderWidth: L.shutter.ringWidth, borderColor: color.accent });
    expect(flat(screen.getByTestId("shutter-core"))).toMatchObject({ width: L.shutter.core, height: L.shutter.core });
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

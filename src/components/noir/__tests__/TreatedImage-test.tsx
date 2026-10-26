import type { ReactElement } from "react";
import { StyleSheet } from "react-native";
import { getAnimatedStyle } from "react-native-reanimated";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { ref } from "@/theme/tokens";
import { TreatedImage } from "../TreatedImage";
import { clearTreatedPhotos, treatPhoto } from "../treatPhoto";

jest.mock("expo-file-system", () => {
  class Directory {
    uri = "file:///cache/treated-photos";
    create() {}
  }
  class File {
    uri: string;
    constructor(_dir: unknown, name: string) {
      this.uri = `file:///cache/treated-photos/${name}`;
    }
    exists = false;
    async write() {}
  }
  return { Directory, File, Paths: { cache: {} } };
});

const PHOTO = "file:///photos/study.jpg";
const hidden = { includeHiddenElements: true } as const;
// A fresh event each time: expo-image marks the one it is given.
const load = () => ({ nativeEvent: { source: { width: 1200, height: 1600, url: "", mediaType: null }, cacheType: "none" } });

const styleOf = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) ?? {};
const animatedStyleOf = getAnimatedStyle as unknown as (node: unknown) => { opacity?: number };
/** The opacity of the treated layer's fading wrapper, the Animated.View around the treated image. */
const treatedOpacity = () => animatedStyleOf(screen.getByTestId("photo-treated", hidden).parent).opacity;

function renderPhoto(ui: ReactElement, reducedMotion = false) {
  return render(<ThemeProvider reducedMotion={reducedMotion}>{ui}</ThemeProvider>);
}

beforeEach(() => {
  clearTreatedPhotos();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("TreatedImage", () => {
  it("shows the original until the treatment is baked, fades the treatment in over it, then lets the original go", async () => {
    jest.useFakeTimers();
    await renderPhoto(<TreatedImage testID="photo" source={PHOTO} genre="noir" />);
    expect(screen.getByTestId("photo-original", hidden).props.source).toEqual([expect.objectContaining({ uri: PHOTO })]);
    expect(screen.queryByTestId("photo-treated", hidden)).toBeNull();
    await act(async () => {
      await jest.runAllTimersAsync();
    });
    const treated = screen.getByTestId("photo-treated", hidden);
    expect(treated.props.source).toEqual([expect.objectContaining({ uri: expect.stringMatching(/^file:\/\/\/cache\/treated-photos\//) })]);
    expect(treatedOpacity()).toBe(0);
    await fireEvent(treated, "load", load());
    // Mid-fade, the original is still underneath.
    await act(async () => {
      jest.advanceTimersByTime(ref.motion.treatment.duration / 2);
    });
    expect(screen.getByTestId("photo-original", hidden)).toBeTruthy();
    await act(async () => {
      jest.advanceTimersByTime(ref.motion.treatment.duration);
    });
    expect(treatedOpacity()).toBe(1);
    // Covered: one image left to decode and move.
    expect(screen.queryByTestId("photo-original", hidden)).toBeNull();
    expect(screen.getByTestId("photo-treated", hidden)).toBeTruthy();
  });

  it("under reduced motion the treatment is simply there once it loads, and the original goes a frame later", async () => {
    await renderPhoto(<TreatedImage testID="photo" source={PHOTO} genre="crime_scene" />, true);
    const treated = await screen.findByTestId("photo-treated", hidden);
    await fireEvent(screen.getByTestId("photo-original", hidden), "load", load());
    await fireEvent(treated, "load", load());
    expect(treatedOpacity()).toBe(1);
    await waitFor(() => expect(screen.queryByTestId("photo-original", hidden)).toBeNull());
  });

  it("original brings back an original that has gone, and fades the treatment off once it has loaded again", async () => {
    const ui = (original: boolean) => <TreatedImage testID="photo" source={PHOTO} genre="paranormal" original={original} />;
    const { rerender } = await renderPhoto(ui(false), true);
    await fireEvent(screen.getByTestId("photo-original", hidden), "load", load());
    await fireEvent(await screen.findByTestId("photo-treated", hidden), "load", load());
    await waitFor(() => expect(screen.queryByTestId("photo-original", hidden)).toBeNull());
    await rerender(<ThemeProvider reducedMotion>{ui(true)}</ThemeProvider>);
    // Mounted afresh: still covered until it has loaded.
    expect(treatedOpacity()).toBe(1);
    await fireEvent(screen.getByTestId("photo-original", hidden), "load", load());
    expect(treatedOpacity()).toBe(0);
  });

  it("a photo baked before it mounted shows at once, with no original underneath", async () => {
    await treatPhoto(PHOTO, "paranormal");
    await renderPhoto(<TreatedImage testID="photo" source={{ uri: PHOTO }} genre="paranormal" />);
    expect(screen.queryByTestId("photo-original", hidden)).toBeNull();
    expect(treatedOpacity()).toBe(1);
  });

  it("original brings the untreated photo back, and fades the treatment off once it has loaded", async () => {
    await treatPhoto(PHOTO, "paranormal");
    const ui = (original: boolean) => <TreatedImage testID="photo" source={PHOTO} genre="paranormal" original={original} />;
    const { rerender } = await renderPhoto(ui(false), true);
    await fireEvent(screen.getByTestId("photo-treated", hidden), "load", load());
    await rerender(<ThemeProvider reducedMotion>{ui(true)}</ThemeProvider>);
    const original = screen.getByTestId("photo-original", hidden);
    // Still covered until the original is there underneath.
    expect(treatedOpacity()).toBe(1);
    await fireEvent(original, "load", load());
    expect(treatedOpacity()).toBe(0);
  });

  it("in the shell it is just the photo", async () => {
    await renderPhoto(<TreatedImage testID="photo" source={PHOTO} genre={null} />);
    await act(async () => {});
    expect(screen.getByTestId("photo-original", hidden)).toBeTruthy();
    expect(screen.queryByTestId("photo-treated", hidden)).toBeNull();
  });

  it("puts the frame's style and accessibility on the frame, hides both images, and reports one load", async () => {
    const onLoad = jest.fn();
    await renderPhoto(
      <TreatedImage
        testID="photo"
        source={PHOTO}
        genre="noir"
        style={{ width: 120, height: 160, borderRadius: 8 }}
        accessible
        accessibilityRole="image"
        accessibilityLabel="The study, first view"
        onLoad={onLoad}
      />,
      true,
    );
    const frame = screen.getByRole("image", { name: "The study, first view" });
    expect(styleOf(frame)).toMatchObject({ width: 120, height: 160, borderRadius: 8, overflow: "hidden" });
    await fireEvent(screen.getByTestId("photo-original", hidden), "load", load());
    const treated = await screen.findByTestId("photo-treated", hidden);
    await fireEvent(treated, "load", load());
    expect(onLoad).toHaveBeenCalledTimes(1);
    expect(onLoad.mock.calls[0][0].source).toMatchObject({ width: 1200, height: 1600 });
    expect(treated.props.accessible).toBe(false);
    // The original then goes; the photo still reports one load.
    await waitFor(() => expect(screen.queryByTestId("photo-original", hidden)).toBeNull());
    expect(onLoad).toHaveBeenCalledTimes(1);
  });
});

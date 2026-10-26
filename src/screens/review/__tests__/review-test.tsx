// The review screen (/capture/review, "Photos") in its reference layout: the
// behaviour it had before the rebuild (remove, retake, add, flagged photos,
// the build rules, back), round 4's plain language and tips list, its
// haptics, and the reference geometry that matters for use (tap targets, the
// flagged rim, the bar's states).
import { StyleSheet } from "react-native";
import { act, render, screen, userEvent } from "@testing-library/react-native";
import { router, useLocalSearchParams } from "expo-router";
import { addPlate, clearPlates, getPlates, getSlots, removePlate, replacePlate } from "@/capture/roll";
import { MAX_PLATES, MIN_PLATES, promptFor } from "@/capture/slots";
import { setMode } from "@/game/mode";
import { modeThemes, ref } from "@/theme/tokens";
import LightTableScreen from "../../../../app/capture/review";
import { COPY, plateLabel } from "../copy";

jest.mock("expo-router", () => ({
  router: { back: jest.fn(), replace: jest.fn(), push: jest.fn(), canGoBack: jest.fn(() => true) },
  useLocalSearchParams: jest.fn(() => ({})),
}));

// Stable spies, so a test can see which haptic a moment gave.
const mockFeedback = { tick: jest.fn(), tap: jest.fn(), press: jest.fn(), thud: jest.fn(), success: jest.fn(), warning: jest.fn(), error: jest.fn() };
jest.mock("@/game/feedback", () => ({ useFeedback: () => mockFeedback }));
// A bake that is ready at once ("baked/<mode>/<photo>"), and none in the shell, as the real one.
jest.mock("@/components/noir/treatPhoto", () => ({
  ...jest.requireActual("@/components/noir/treatPhoto"),
  useTreatedPhoto: (source: string, genre: string | null) => (genre ? `baked/${genre}/${source}` : null),
}));

const L = ref.layout.review;
const params = useLocalSearchParams as jest.Mock;
const styleOf = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) ?? {};
/** Pressable styles are functions of the press state; read them at rest. */
const restStyleOf = (node: { props: { style?: unknown } }) => {
  const style = node.props.style;
  return StyleSheet.flatten((typeof style === "function" ? style({ pressed: false }) : style) as never) ?? {};
};

function fill(count: number) {
  clearPlates();
  for (let i = 0; i < count; i++) addPlate({ uri: `file:///plate-${i}.jpg`, width: 3, height: 4 });
}

function renderAt(flag?: string, issue?: string) {
  params.mockReturnValue({ ...(flag === undefined ? {} : { flag }), ...(issue === undefined ? {} : { issue }) });
  return render(<LightTableScreen />);
}

beforeEach(() => {
  jest.clearAllMocks();
  (router.canGoBack as jest.Mock).mockReturnValue(true);
});

afterEach(() => clearPlates());

describe("layout and copy", () => {
  it("shows the header, the count, every photo with its prompt, the hint, the tips and the privacy note, in plain words", async () => {
    fill(4);
    await renderAt();
    expect(screen.getByRole("header", { name: COPY.title })).toBeTruthy();
    expect(screen.getByRole("header", { name: COPY.heading })).toBeTruthy();
    expect(screen.getByText(COPY.caption(4, MAX_PLATES))).toBeTruthy();
    expect(screen.getByText("4 of 6. Retake anything dark, blurred, or too close to read the room.")).toBeTruthy();
    expect(screen.getByRole("header", { name: "Photos" })).toBeTruthy();
    expect(screen.getByRole("header", { name: "Your photos" })).toBeTruthy();
    expect(screen.getByText("1 · From the\u00A0doorway")).toBeTruthy();
    expect(screen.getByText("2 · Opposite\u00A0corner")).toBeTruthy();
    expect(screen.getByText("3 · The busiest\u00A0wall")).toBeTruthy();
    expect(screen.getByText("4 · A close\u00A0view")).toBeTruthy();
    expect(screen.getByLabelText("Photo 1, From the doorway")).toBeTruthy();
    // The last word is held to the one before it, so a label breaks "1 · From / the doorway".
    expect(plateLabel(promptFor(0))).toBe("1 · From the\u00A0doorway");
    expect(plateLabel(promptFor(5))).toBe("6 · Last\u00A0photo");
    expect(screen.getByText("Tap a photo to retake it")).toBeTruthy();
    expect(screen.getByRole("header", { name: "Before you build" })).toBeTruthy();
    for (const line of COPY.checks) expect(screen.getByText(line)).toBeTruthy();
    expect(screen.getByLabelText("1. Keep people out of the shot.")).toBeTruthy();
    expect(screen.getByLabelText("2. Tuck away mail, documents, and screens.")).toBeTruthy();
    expect(screen.getByLabelText("3. Turn the lights on and hold steady.")).toBeTruthy();
    expect(screen.getByText("Your photos are only used to build your case. No one else sees them.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add a photo" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Build the case" })).toBeTruthy();
  });

  it("lists the tips vertically, with no sideways scroll and no See all", async () => {
    fill(4);
    await renderAt();
    const list = screen.getByTestId("tips");
    expect(screen.getAllByTestId("tip")).toHaveLength(COPY.checks.length);
    expect(styleOf(list)).toMatchObject({ gap: L.tips.gap });
    expect(styleOf(list).flexDirection).toBeUndefined();
    expect(screen.queryByTestId("checks")).toBeNull();
    expect(screen.queryByText("See all")).toBeNull();
    expect(screen.queryByTestId("see-all")).toBeNull();
  });

  it("never uses the old darkroom words, the AI, or alarming phrasing", async () => {
    fill(2);
    await renderAt("0");
    const words = [
      ...Object.values(COPY).flatMap((v) =>
        typeof v === "function" ? [v(3, 6)] : Array.isArray(v) ? v : typeof v === "object" ? Object.values(v) : [v],
      ),
      screen.getByTestId("plate-grid").props.accessibilityLabel ?? "",
    ].join(" ");
    expect(words).not.toMatch(/plate|light table|darkroom|develop|\bAI\b|model|never/i);
  });

  it("lays the plates out three to a row, square, at the reference's spacing", async () => {
    fill(4);
    await renderAt();
    const grid = screen.getByTestId("plate-grid");
    expect(grid.children).toHaveLength(2);
    expect(styleOf(screen.getByTestId("plate-0"))).toMatchObject({ justifyContent: "flex-end", gap: L.grid.labelGap });
    const frame = styleOf(screen.getByTestId("plate-0-frame"));
    expect(frame).toMatchObject({ borderWidth: L.tile.rim, borderColor: ref.color.rim, borderRadius: L.tile.radius });
    // The rim composites over the ground, never over a fill of the frame's own.
    expect(frame.backgroundColor).toBeUndefined();
  });

  it("has no hint and no grid without plates", async () => {
    fill(0);
    await renderAt();
    expect(screen.queryByTestId("plate-grid")).toBeNull();
    expect(screen.queryByText(COPY.hint)).toBeNull();
    expect(screen.getByText(COPY.caption(0, MAX_PLATES))).toBeTruthy();
  });

  it("draws the reference's own glyphs: the square camera on the pill, the finger on its button by the hint", async () => {
    fill(1);
    await renderAt();
    expect(screen.getByTestId("camera-glyph", { includeHiddenElements: true }).props).toMatchObject({ width: L.camera.width, height: L.camera.height });
    expect(screen.getByTestId("tap-glyph", { includeHiddenElements: true }).props).toMatchObject({ width: L.tap.box, height: L.tap.box });
    expect(restStyleOf(screen.getByTestId("add-plate"))).toMatchObject({ marginHorizontal: L.add.inset, minHeight: L.add.height, borderWidth: L.add.border });
  });

  it("gives every control a 44 pt target", async () => {
    fill(1);
    await renderAt();
    expect(restStyleOf(screen.getByTestId("plate-0-remove"))).toMatchObject({ width: ref.hit.min, height: ref.hit.min });
    expect(restStyleOf(screen.getByTestId("review-back"))).toMatchObject({ minWidth: ref.hit.min, minHeight: L.header.height });
    expect(restStyleOf(screen.getByTestId("add-plate")).minHeight).toBeGreaterThanOrEqual(ref.hit.min);
    expect(restStyleOf(screen.getByTestId("develop")).minHeight).toBeGreaterThanOrEqual(ref.hit.min);
  });
});

describe("photos", () => {
  it("removes a photo with its ×, leaving its slot open and the others in theirs, with the light press haptic", async () => {
    fill(4);
    await renderAt();
    await userEvent.setup().press(screen.getByRole("button", { name: "Remove photo 2" }));
    expect(mockFeedback.press).toHaveBeenCalledTimes(1);
    expect(getPlates().map((p) => p.uri)).toEqual(["file:///plate-0.jpg", "file:///plate-2.jpg", "file:///plate-3.jpg"]);
    expect(getSlots().map((p) => p?.uri ?? null)).toEqual(["file:///plate-0.jpg", null, "file:///plate-2.jpg", "file:///plate-3.jpg"]);
    // The count counts filled photos; every photo stays under its own prompt.
    expect(screen.getByText(COPY.caption(3, MAX_PLATES))).toBeTruthy();
    expect(screen.getByText("4 · A close\u00A0view")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retake photo 3" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retake photo 4" })).toBeTruthy();
    // Slot 2 is an open tile under its own label.
    expect(screen.getByText("2 · Opposite\u00A0corner")).toBeTruthy();
    expect(screen.getByTestId("plate-1-open")).toBeTruthy();
    expect(screen.queryByTestId("plate-1-retake")).toBeNull();
  });

  it("draws an open slot as a dashed tile with the camera glyph that takes exactly that photo", async () => {
    fill(4);
    removePlate(1);
    await renderAt();
    const open = screen.getByRole("button", { name: "Take photo 2, Opposite corner. This photo is open." });
    expect(restStyleOf(open)).toMatchObject({ borderStyle: "dashed", borderWidth: L.tile.open.border, borderColor: L.tile.open.rim });
    expect(screen.getByText("Take this photo")).toBeTruthy();
    expect(screen.getAllByTestId("camera-glyph", { includeHiddenElements: true }).length).toBe(2);
    await userEvent.setup().press(open);
    expect(router.push).toHaveBeenCalledWith({ pathname: "/capture", params: { retake: "1" } });
    expect(mockFeedback.press).toHaveBeenCalledTimes(1);
  });

  it("removing the last photo shortens the set instead of leaving an open tile", async () => {
    fill(4);
    removePlate(3);
    await renderAt();
    expect(getSlots()).toHaveLength(3);
    expect(screen.queryByTestId("plate-3")).toBeNull();
  });

  it("builds with 3 photos filled and a gap among the first 4: the open tile is marked, not blocking", async () => {
    fill(4);
    removePlate(1);
    await renderAt();
    expect(screen.getByTestId("plate-1-open")).toBeTruthy();
    expect(screen.queryByTestId("develop-helper")).toBeNull();
    expect(screen.getByTestId("develop")).toBeEnabled();
  });

  it("holds the build below 3 filled photos, gaps not counted", async () => {
    fill(3);
    removePlate(1);
    await renderAt();
    expect(screen.getByText(COPY.caption(2, MAX_PLATES))).toBeTruthy();
    expect(screen.getByTestId("develop")).toBeDisabled();
    expect(screen.getByText("Take at least 3 photos to build the case.")).toBeTruthy();
  });

  it("retakes a photo when its tile is tapped, with the light press haptic", async () => {
    fill(4);
    await renderAt();
    await userEvent.setup().press(screen.getByRole("button", { name: "Retake photo 3" }));
    expect(router.push).toHaveBeenCalledWith({ pathname: "/capture", params: { retake: "2" } });
    expect(mockFeedback.press).toHaveBeenCalledTimes(1);
    expect(mockFeedback.thud).not.toHaveBeenCalled();
  });

  it("adds a photo from the outlined pill, which is gone once 6 are taken", async () => {
    fill(MAX_PLATES - 1);
    const { unmount } = await renderAt();
    await userEvent.setup().press(screen.getByRole("button", { name: COPY.add }));
    expect(router.push).toHaveBeenCalledWith("/capture");
    await unmount();
    fill(MAX_PLATES);
    await renderAt();
    expect(screen.queryByRole("button", { name: COPY.add })).toBeNull();
    expect(screen.queryByTestId("add-plate")).toBeNull();
  });
});

describe("flagged photos", () => {
  it("marks the flagged photos in the warning colour, gently, and holds the build", async () => {
    fill(4);
    // An older build's ?flag=1 (no reason): the general reason.
    await renderAt("1");
    expect(screen.getByTestId("plate-1-flag", { includeHiddenElements: true })).toHaveTextContent("May show a person or something private");
    expect(styleOf(screen.getByTestId("plate-1-flag", { includeHiddenElements: true })).color).toBe(L.warning);
    expect(styleOf(screen.getByText("2 · Opposite\u00A0corner")).color).toBe(L.warning);
    expect(styleOf(screen.getByTestId("plate-1-frame"))).toMatchObject({ borderWidth: L.tile.flaggedRim, borderColor: L.warning });
    expect(screen.queryByTestId("plate-0-flag", { includeHiddenElements: true })).toBeNull();
    expect(styleOf(screen.getByTestId("plate-0-frame")).borderColor).toBe(ref.color.rim);
    expect(screen.getByText("Retake the marked photos, then build the case.")).toBeTruthy();
    expect(styleOf(screen.getByTestId("develop-helper")).color).toBe(L.warning);
    expect(screen.getByTestId("develop")).toBeDisabled();
  });

  it("says why each flagged photo needs a retake, and screen readers hear it with the tile", async () => {
    fill(5);
    await renderAt("0:person,2:private_text,3:person_private_text,4:unreadable");
    const reason = (i: number) => screen.getByTestId(`plate-${i}-flag`, { includeHiddenElements: true });
    expect(reason(0)).toHaveTextContent("Someone's in this shot");
    expect(reason(2)).toHaveTextContent("Mail, a document, or a screen is readable");
    expect(reason(3)).toHaveTextContent("Someone's in this shot, and some text is readable");
    expect(reason(4)).toHaveTextContent("This photo couldn't be read");
    expect(screen.queryByTestId("plate-1-flag", { includeHiddenElements: true })).toBeNull();
    // The reason is drawn under the label and read with the tile, not twice.
    expect(reason(0).props.importantForAccessibility).toBe("no-hide-descendants");
    expect(screen.getByRole("button", { name: "Retake photo 1. Someone's in this shot." })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retake photo 3. Mail, a document, or a screen is readable." })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retake photo 2" })).toBeTruthy();
  });

  it("marks flagged photos by slot, so a gap before them doesn't shift the marks", async () => {
    fill(4);
    removePlate(1);
    await renderAt("2:person");
    expect(screen.getByTestId("plate-2-flag", { includeHiddenElements: true })).toHaveTextContent("Someone's in this shot");
    expect(styleOf(screen.getByTestId("plate-2-frame")).borderColor).toBe(L.warning);
    expect(styleOf(screen.getByTestId("plate-3-frame")).borderColor).toBe(ref.color.rim);
  });

  it("shows a failure about the whole set as a calm note at the top", async () => {
    fill(4);
    await renderAt("", "too_few_objects");
    expect(screen.getByTestId("review-issue")).toHaveTextContent(
      "The case needs a little more to work with. Add a close view of a desk, shelf, or table, then build again.",
    );
    expect(styleOf(screen.getByTestId("review-issue")).backgroundColor).toBe(ref.color.raised);
    expect(screen.getByTestId("develop")).toBeEnabled();
  });

  it("shows no note for an issue it doesn't know, or without one", async () => {
    fill(4);
    const { unmount } = await renderAt(undefined, "something_else");
    expect(screen.queryByTestId("review-issue")).toBeNull();
    await unmount();
    await renderAt();
    expect(screen.queryByTestId("review-issue")).toBeNull();
  });

  it("drops a photo's mark once it is retaken, and the case can be built again", async () => {
    fill(4);
    await renderAt("0,2");
    expect(screen.getByTestId("plate-0-flag", { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByTestId("plate-2-flag", { includeHiddenElements: true })).toBeTruthy();
    await act(() => replacePlate(0, { uri: "file:///plate-0-retaken.jpg", width: 3, height: 4 }));
    expect(screen.queryByTestId("plate-0-flag", { includeHiddenElements: true })).toBeNull();
    expect(screen.getByTestId("develop")).toBeDisabled();
    await act(() => replacePlate(2, { uri: "file:///plate-2-retaken.jpg", width: 3, height: 4 }));
    expect(screen.queryByTestId("plate-2-flag", { includeHiddenElements: true })).toBeNull();
    expect(screen.queryByTestId("develop-helper")).toBeNull();
    expect(screen.getByTestId("develop")).toBeEnabled();
    await userEvent.setup().press(screen.getByTestId("develop"));
    expect(router.push).toHaveBeenCalledWith("/capture/develop");
  });

  it("ignores flags that name no photo", async () => {
    fill(3);
    await renderAt("x,7, ,");
    expect(screen.queryByText(COPY.reasons.general, { includeHiddenElements: true })).toBeNull();
    expect(screen.getByTestId("develop")).toBeEnabled();
  });
});

describe("build bar", () => {
  it(`needs at least ${MIN_PLATES} photos, said as a tip`, async () => {
    fill(MIN_PLATES - 1);
    await renderAt();
    expect(screen.getByText(COPY.tooFew(MIN_PLATES))).toBeTruthy();
    expect(screen.getByText("Take at least 3 photos to build the case.")).toBeTruthy();
    expect(styleOf(screen.getByTestId("develop-helper")).color).toBe(ref.color.textSecondary);
    const bar = screen.getByRole("button", { name: COPY.develop });
    expect(bar).toBeDisabled();
    expect(restStyleOf(bar).opacity).toBe(ref.button.disabledOpacity.pill);
    await userEvent.setup().press(bar);
    expect(router.push).not.toHaveBeenCalled();
    expect(mockFeedback.thud).not.toHaveBeenCalled();
  });

  it("builds with enough clean photos, as a paper bar with square-ish corners and a thud as it commits", async () => {
    fill(MIN_PLATES);
    await renderAt();
    expect(screen.queryByTestId("develop-helper")).toBeNull();
    const bar = screen.getByTestId("develop");
    expect(restStyleOf(bar)).toMatchObject({ backgroundColor: ref.color.paper, borderRadius: L.footer.radius, minHeight: L.footer.bar });
    expect(restStyleOf(bar).opacity).toBeUndefined();
    await userEvent.setup().press(bar);
    expect(router.push).toHaveBeenCalledWith("/capture/develop");
    expect(mockFeedback.thud).toHaveBeenCalledTimes(1);
    expect(mockFeedback.press).not.toHaveBeenCalled();
  });
});

describe("navigation", () => {
  it("goes back to the camera", async () => {
    fill(3);
    await renderAt();
    await userEvent.setup().press(screen.getByRole("button", { name: COPY.backLabel }));
    expect(router.back).toHaveBeenCalled();
  });

  it("opens the camera when there is nothing to go back to", async () => {
    (router.canGoBack as jest.Mock).mockReturnValue(false);
    fill(3);
    await renderAt();
    await userEvent.setup().press(screen.getByRole("button", { name: COPY.backLabel }));
    expect(router.replace).toHaveBeenCalledWith("/capture");
    expect(router.back).not.toHaveBeenCalled();
  });
});

describe("inside a mode", () => {
  const hidden = { includeHiddenElements: true } as const;
  const theme = modeThemes.crime_scene;
  beforeEach(() => setMode("crime_scene"));
  afterEach(() => setMode(null));

  it("takes the mode's ground, inks, raised fills and rims", async () => {
    fill(4);
    await renderAt(undefined, "too_few_objects");
    expect(styleOf(screen.getByTestId("review-root")).backgroundColor).toBe(theme.surface);
    expect(styleOf(screen.getByRole("header", { name: COPY.title })).color).toBe(theme.ink);
    expect(styleOf(screen.getByRole("header", { name: COPY.heading })).color).toBe(theme.ink);
    expect(styleOf(screen.getByText(COPY.caption(4, MAX_PLATES))).color).toBe(theme.ink);
    expect(styleOf(screen.getByText(COPY.back)).color).toBe(theme.ink);
    expect(styleOf(screen.getByTestId("review-issue")).backgroundColor).toBe(theme.raised);
    expect(styleOf(screen.getByText("1 · From the doorway")).color).toBe(theme.inkMuted);
    expect(styleOf(screen.getByTestId("plate-0-frame")).borderColor).toBe(theme.rim);
    expect(styleOf(screen.getByText(COPY.hint)).color).toBe(theme.inkMuted);
    expect(styleOf(screen.getByTestId("privacy-note")).color).toBe(theme.inkMuted);
    expect(restStyleOf(screen.getByTestId("add-plate")).borderColor).toBe(theme.ink);
    expect(styleOf(screen.getByTestId("develop-footer")).backgroundColor).toBe(theme.surface);
  });

  it("shows every photo in the mode's baked treatment", async () => {
    fill(2);
    await renderAt();
    for (const i of [0, 1]) {
      const treated = screen.getByTestId(`plate-${i}-photo-treated`, hidden);
      expect([treated.props.source].flat()[0]).toMatchObject({ uri: `baked/crime_scene/file:///plate-${i}.jpg` });
    }
  });

  it("makes the build bar the mode's primary button, still dimmed while blocked", async () => {
    fill(MIN_PLATES);
    await renderAt();
    const bar = screen.getByTestId("develop");
    expect(restStyleOf(bar)).toMatchObject({ backgroundColor: theme.accent, borderRadius: L.footer.radius, minHeight: L.footer.bar });
    expect(styleOf(screen.getByText(COPY.develop)).color).toBe(theme.accentInk);
    await userEvent.setup().press(bar);
    expect(router.push).toHaveBeenCalledWith("/capture/develop");
    expect(mockFeedback.thud).toHaveBeenCalledTimes(1);
  });

  it("keeps the flagged amber, which is a warning, not the mode's colour", async () => {
    fill(3);
    await renderAt("1:person");
    expect(styleOf(screen.getByTestId("plate-1-frame")).borderColor).toBe(L.warning);
    expect(styleOf(screen.getByTestId("develop-helper")).color).toBe(L.warning);
  });
});

describe("in the shell (no mode)", () => {
  it("shows the photos as taken, with no treatment", async () => {
    fill(2);
    await renderAt();
    expect(screen.queryByTestId("plate-0-photo-treated", { includeHiddenElements: true })).toBeNull();
    const original = screen.getByTestId("plate-0-photo-original", { includeHiddenElements: true });
    expect([original.props.source].flat()[0]).toMatchObject({ uri: "file:///plate-0.jpg" });
  });
});

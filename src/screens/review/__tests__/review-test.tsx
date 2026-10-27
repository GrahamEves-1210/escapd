// The review screen (/capture/review, "Your photos"), round 6: the behaviour
// it has always had (remove, retake, add, flagged photos, the build rules,
// back), round 4's plain language and tips list, its haptics, and the
// geometry that matters for use in the camera's (02) and the photo guide's
// (04) language: the camera's header, 02's last photo grown into 3:4 tiles
// two to a row with italic numerals, the guide's ghost pill to add a photo,
// and the guide's pinned foot with its pill to build (tap targets, the
// flagged ring, the pill's states).
import { Dimensions, StyleSheet } from "react-native";
import { act, render, screen, userEvent, within } from "@testing-library/react-native";
import { router, useLocalSearchParams } from "expo-router";
import { addPlate, clearPlates, getPlates, getSlots, removePlate, replacePlate, setRollLens } from "@/capture/roll";
import { MAX_PLATES, MIN_PLATES, platePrompts, promptFor } from "@/capture/slots";
import { dialStops } from "@/capture/turn";
import { SQUARE_SLOP } from "@/capture/ui/rangefinder/SquareButton";
import { setMode } from "@/game/mode";
import { modeThemes, ref } from "@/theme/tokens";
import LightTableScreen from "../../../../app/capture/review";
import { COPY, plateLabelSpoken, plateName } from "../copy";

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
const THUMB = ref.button.thumbnail;
const GHOST = ref.button.ghost;
const params = useLocalSearchParams as jest.Mock;
const styleOf = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) ?? {};
/** Pressable styles are functions of the press state; read them at rest. */
const restStyleOf = (node: { props: { style?: unknown } }) => {
  const style = node.props.style;
  return StyleSheet.flatten((typeof style === "function" ? style({ pressed: false }) : style) as never) ?? {};
};
type Node = ReturnType<typeof screen.getByTestId>;
/** Host views under `root` whose flattened style matches. */
const viewsWhere = (root: Node, match: (style: Record<string, unknown>) => boolean) =>
  root.queryAll((node) => node.type === "View" && match(styleOf(node)));
/** The kit's ghost pill (the shell's) draws its 1 pt hairline on an inner layer. */
const ghostEdges = (pill: Node) => viewsWhere(pill, (s) => s.borderColor === GHOST.border && s.borderWidth === GHOST.borderWidth);
// The roll's prompts: 1x's 6 (also the plan before any camera has said which lens), 0.5x's 5.
const SIX = platePrompts(dialStops(6));
/** The header: the title and the count, read as one ("Your photos, 4 of 6 photos taken"). */
const headerName = (count: number) => `${COPY.title}, ${COPY.countSpoken(count, MAX_PLATES)}`;

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
  it("shows the header, the count, every photo with its name, the hint, the tips and the privacy note, in plain words", async () => {
    fill(4);
    await renderAt();
    // The camera's header: the serif title over the grey count, one screen-reader header, read politely as it changes.
    const header = screen.getByRole("header", { name: "Your photos, 4 of 6 photos taken" });
    expect(header.props.accessibilityLiveRegion).toBe("polite");
    expect(screen.getByText("Your photos")).toBeTruthy();
    expect(screen.getByText("4 of 6 taken")).toBeTruthy();
    expect(screen.getByText(COPY.count(4, MAX_PLATES))).toBeTruthy();
    expect(screen.getByText("Retake anything dark or blurred. Together they should go all the way round.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Back to the camera" })).toBeTruthy();
    // Each photo's numeral, then its name.
    const names = ["Start", "Front\u00A0right", "Back\u00A0right", "Behind"];
    names.forEach((name, i) => {
      const cell = within(screen.getByTestId(`plate-${i}`));
      expect(cell.getByText(String(i + 1))).toBeTruthy();
      expect(cell.getByText(name)).toBeTruthy();
    });
    expect(screen.getByLabelText("Photo 1, Start")).toBeTruthy();
    expect(plateLabelSpoken(promptFor(3, SIX))).toBe("Photo 4, Behind");
    // Named by where each looks from the middle; the last word is held to the one before it.
    expect(plateName(promptFor(1, SIX))).toBe("Front\u00A0right");
    expect(plateName(promptFor(5, SIX))).toBe("Front\u00A0left");
    expect(screen.getByText("Tap a photo to retake it")).toBeTruthy();
    expect(screen.getByRole("header", { name: "Before you build" })).toBeTruthy();
    for (const line of COPY.checks) expect(screen.getByText(line)).toBeTruthy();
    expect(screen.getByLabelText("1. Stand in the middle and turn all the way round.")).toBeTruthy();
    expect(screen.getByLabelText("2. Keep faces out of the shot.")).toBeTruthy();
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

  it("lays the photos out two to a row in 3:4 tiles, 02's last photo grown", async () => {
    fill(5);
    await renderAt();
    const grid = screen.getByTestId("plate-grid");
    expect(styleOf(grid)).toMatchObject({ marginHorizontal: ref.space.edge, gap: L.grid.rowGap });
    // Five photos: two rows of two, then one.
    expect(grid.children.map((row) => (typeof row === "string" ? 0 : row.children.length))).toEqual([2, 2, 1]);
    expect(styleOf(grid.children[0] as Node)).toMatchObject({ flexDirection: "row", gap: L.grid.gap });
    // Two columns across the screen inside ref.space.edge, the shot's 3:4 as the viewfinder framed it.
    const tile = (Dimensions.get("window").width - ref.space.edge * 2 - L.grid.gap) / 2;
    const cell = screen.getByTestId("plate-0");
    expect(styleOf(cell)).toMatchObject({ width: tile, gap: L.grid.labelGap });
    expect(viewsWhere(cell, (s) => s.width === tile && s.height === tile / ref.layout.camera.frameAspect)).toHaveLength(1);
    // The thumbnail's near-black frame, the photo at its nested corners inside it, the faint 1 pt rim over the photo.
    expect(restStyleOf(screen.getByTestId("plate-0-retake"))).toMatchObject({ backgroundColor: THUMB.frameFill, borderRadius: THUMB.radius });
    expect(styleOf(screen.getByTestId("plate-0-frame"))).toMatchObject({
      top: THUMB.frameWidth,
      left: THUMB.frameWidth,
      right: THUMB.frameWidth,
      bottom: THUMB.frameWidth,
      borderRadius: THUMB.imageRadius,
      overflow: "hidden",
    });
    expect(viewsWhere(cell, (s) => s.borderColor === THUMB.imageRim && s.borderWidth === ref.layout.camera.hairline)).toHaveLength(1);
    // No ring on a clean photo.
    expect(screen.queryByTestId("plate-0-ring")).toBeNull();
    // The numeral in the counter's italic, then the name in the camera's serif title.
    expect(styleOf(within(cell).getByText("1"))).toMatchObject({ ...L.type.numeral, color: ref.color.textPrimary });
    expect(styleOf(within(cell).getByText("Start"))).toMatchObject({ ...ref.type.serifTitle, color: ref.color.textPrimary });
  });

  it("has no hint and no grid without plates", async () => {
    fill(0);
    await renderAt();
    expect(screen.queryByTestId("plate-grid")).toBeNull();
    expect(screen.queryByText(COPY.hint)).toBeNull();
    expect(screen.getByText(COPY.count(0, MAX_PLATES))).toBeTruthy();
    expect(screen.getByRole("header", { name: headerName(0) })).toBeTruthy();
  });

  it("draws the ESCAPD glyphs: the square camera on the guide's ghost pill, the finger by the hint", async () => {
    fill(1);
    await renderAt();
    expect(screen.getByTestId("camera-glyph", { includeHiddenElements: true }).props).toMatchObject({ width: L.camera.width, height: L.camera.height });
    expect(screen.getByTestId("tap-glyph", { includeHiddenElements: true }).props).toMatchObject({ width: L.tap.box, height: L.tap.box });
    // "Add a photo" is the guide's own dark hairline pill (ref.button.ghost) in its reading column.
    expect(restStyleOf(screen.getByTestId("add-plate"))).toMatchObject({
      marginHorizontal: ref.space.reading,
      minHeight: GHOST.height,
      borderWidth: GHOST.borderWidth,
      borderColor: GHOST.border,
      backgroundColor: GHOST.fill,
      borderRadius: ref.radius.round,
      gap: L.add.gap,
    });
    expect(styleOf(screen.getByText(COPY.add))).toMatchObject({ ...ref.type.headline, color: GHOST.label });
  });

  it("gives every control a 44 pt target", async () => {
    fill(1);
    await renderAt();
    expect(restStyleOf(screen.getByTestId("plate-0-remove"))).toMatchObject({ width: ref.hit.min, height: ref.hit.min });
    // The camera's 44 square back button, its hit area grown to 48 by its slop.
    const back = screen.getByTestId("review-back");
    expect(restStyleOf(back)).toMatchObject({ width: ref.button.square.size, height: ref.button.square.size });
    expect(back.props.hitSlop).toBe(SQUARE_SLOP);
    expect(ref.button.square.size + SQUARE_SLOP * 2).toBeGreaterThanOrEqual(ref.hit.min);
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
    expect(screen.getByText(COPY.count(3, MAX_PLATES))).toBeTruthy();
    expect(within(screen.getByTestId("plate-3")).getByText("Behind")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retake photo 3" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retake photo 4" })).toBeTruthy();
    // Slot 2 is an open tile under its own name.
    expect(within(screen.getByTestId("plate-1")).getByText("Front\u00A0right")).toBeTruthy();
    expect(screen.getByTestId("plate-1-open")).toBeTruthy();
    expect(screen.queryByTestId("plate-1-retake")).toBeNull();
  });

  it("draws an open slot as a dashed tile with the camera glyph that takes exactly that photo", async () => {
    fill(4);
    removePlate(1);
    await renderAt();
    const open = screen.getByRole("button", { name: "Take photo 2, Front right. This photo is open." });
    expect(restStyleOf(open)).toMatchObject({ borderStyle: "dashed", borderWidth: L.tile.open.border, borderColor: L.tile.open.rim, borderRadius: THUMB.radius });
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
    expect(screen.getByText(COPY.count(2, MAX_PLATES))).toBeTruthy();
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

  it("adds a photo from the ghost pill, which is gone once 6 are taken", async () => {
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

describe("a roll on 0.5x: 5 photos", () => {
  function fillWide(count: number) {
    clearPlates();
    setRollLens("wide");
    for (let i = 0; i < count; i++) addPlate({ uri: `file:///plate-${i}.jpg`, width: 3, height: 4 });
  }

  it("counts against 5 and names each photo by where it looks, 72 degrees apart", async () => {
    fillWide(4);
    await renderAt();
    expect(screen.getByRole("header", { name: "Your photos, 4 of 5 photos taken" })).toBeTruthy();
    expect(screen.getByText("4 of 5 taken")).toBeTruthy();
    ["Start", "Right", "Back\u00A0right", "Back\u00A0left"].forEach((name, i) => {
      expect(within(screen.getByTestId(`plate-${i}`)).getByText(name)).toBeTruthy();
    });
    expect(screen.getByLabelText("Photo 2, Right")).toBeTruthy();
    expect(screen.getByRole("button", { name: COPY.add })).toBeTruthy();
  });

  it("hides Add a photo once 5 are taken, and offers it again for a removed photo's open slot", async () => {
    fillWide(5);
    const { unmount } = await renderAt();
    expect(screen.getByText("5 of 5 taken")).toBeTruthy();
    expect(within(screen.getByTestId("plate-4")).getByText("Left")).toBeTruthy();
    expect(screen.queryByRole("button", { name: COPY.add })).toBeNull();
    await unmount();
    removePlate(1);
    await renderAt();
    expect(screen.getByText("4 of 5 taken")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Take photo 2, Right. This photo is open." })).toBeTruthy();
    expect(screen.getByRole("button", { name: COPY.add })).toBeTruthy();
  });
});

describe("flagged photos", () => {
  it("marks the flagged photos in the warning colour, gently, and holds the build", async () => {
    fill(4);
    // An older build's ?flag=1 (no reason): the general reason.
    await renderAt("1");
    expect(screen.getByTestId("plate-1-flag", { includeHiddenElements: true })).toHaveTextContent("May show a person or something private");
    expect(styleOf(screen.getByTestId("plate-1-flag", { includeHiddenElements: true }))).toMatchObject({ ...L.type.reason, color: L.warning });
    // The name keeps its ink: the reason under it carries the warning.
    expect(styleOf(within(screen.getByTestId("plate-1")).getByText("Front\u00A0right")).color).toBe(ref.color.textPrimary);
    // A warning ring on the frame's outer edge, where the camera draws its way-on ring.
    expect(styleOf(screen.getByTestId("plate-1-ring"))).toMatchObject({ borderWidth: L.tile.flaggedRing, borderColor: L.warning, borderRadius: THUMB.radius });
    expect(screen.queryByTestId("plate-0-flag", { includeHiddenElements: true })).toBeNull();
    expect(screen.queryByTestId("plate-0-ring")).toBeNull();
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
    expect(styleOf(screen.getByTestId("plate-2-ring")).borderColor).toBe(L.warning);
    expect(screen.queryByTestId("plate-3-ring")).toBeNull();
  });

  it("shows a failure about the whole set as a calm note at the top", async () => {
    fill(4);
    await renderAt("", "too_few_objects");
    expect(screen.getByTestId("review-issue")).toHaveTextContent(
      "The case needs a little more to work with. Turn the lights on and retake from the middle of the room. If a photo is open, use it for a close view of a busy desk or shelf.",
    );
    expect(styleOf(screen.getByTestId("review-issue"))).toMatchObject({ backgroundColor: ref.color.raised, padding: L.issue.pad, borderRadius: ref.radius.nested });
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

describe("build pill", () => {
  it(`needs at least ${MIN_PLATES} photos, said as a tip`, async () => {
    fill(MIN_PLATES - 1);
    await renderAt();
    expect(screen.getByText(COPY.tooFew(MIN_PLATES))).toBeTruthy();
    expect(screen.getByText("Take at least 3 photos to build the case.")).toBeTruthy();
    expect(styleOf(screen.getByTestId("develop-helper"))).toMatchObject({ ...L.type.note, color: ref.color.textSecondary });
    const bar = screen.getByRole("button", { name: COPY.develop });
    expect(bar).toBeDisabled();
    expect(restStyleOf(bar).opacity).toBe(ref.button.disabledOpacity.pill);
    await userEvent.setup().press(bar);
    expect(router.push).not.toHaveBeenCalled();
    expect(mockFeedback.thud).not.toHaveBeenCalled();
  });

  it("builds with enough clean photos, from the guide's pinned foot and its dark hairline pill, with a thud as it commits", async () => {
    fill(MIN_PLATES);
    await renderAt();
    expect(screen.queryByTestId("develop-helper")).toBeNull();
    // The guide's foot: its reading column, the pill's foot ref.space.ctaBottom over the (here zero) safe area.
    expect(styleOf(screen.getByTestId("develop-footer"))).toMatchObject({
      backgroundColor: ref.color.ground,
      paddingTop: L.footer.pad,
      paddingHorizontal: ref.space.reading,
      paddingBottom: ref.space.ctaBottom,
    });
    // In the shell, the guide's own ghost pill: 52 tall, the full column, its 1 pt hairline, the headline label.
    const bar = screen.getByTestId("develop");
    expect(restStyleOf(bar)).toMatchObject({ minHeight: GHOST.height, alignSelf: "stretch" });
    expect(ghostEdges(bar)).toHaveLength(1);
    expect(styleOf(screen.getByText(COPY.develop))).toMatchObject({ ...ref.type.headline });
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

  it("takes the mode's ground, inks, raised fills, rims and lit numerals", async () => {
    fill(4);
    await renderAt(undefined, "too_few_objects");
    expect(styleOf(screen.getByTestId("review-root")).backgroundColor).toBe(theme.surface);
    expect(styleOf(screen.getByText(COPY.title)).color).toBe(theme.ink);
    expect(styleOf(screen.getByTestId("review-count")).color).toBe(theme.inkMuted);
    // The camera's square back button in the mode's raised fill and rim.
    expect(restStyleOf(screen.getByTestId("review-back"))).toMatchObject({ backgroundColor: theme.raised, borderColor: theme.rim });
    expect(styleOf(screen.getByTestId("review-issue")).backgroundColor).toBe(theme.raised);
    expect(styleOf(screen.getByTestId("review-lead")).color).toBe(theme.inkMuted);
    const cell = within(screen.getByTestId("plate-0"));
    expect(styleOf(cell.getByText("1")).color).toBe(theme.stamp);
    expect(styleOf(cell.getByText("Start")).color).toBe(theme.ink);
    // The tile's frame in the mode's near-black ground, the photo's well raised.
    expect(restStyleOf(screen.getByTestId("plate-0-retake")).backgroundColor).toBe(theme.ground);
    expect(styleOf(screen.getByTestId("plate-0-frame")).backgroundColor).toBe(theme.raised);
    expect(styleOf(screen.getByText(COPY.hint)).color).toBe(theme.inkMuted);
    expect(styleOf(screen.getByTestId("privacy-note")).color).toBe(theme.inkMuted);
    // "Add a photo": the ghost pill in the mode's well, rim and ink, so the accent stays on "Build the case".
    expect(restStyleOf(screen.getByTestId("add-plate"))).toMatchObject({ backgroundColor: theme.ground, borderColor: theme.rim });
    expect(styleOf(screen.getByText(COPY.add)).color).toBe(theme.ink);
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

  it("makes the build pill the mode's primary button, still dimmed while blocked", async () => {
    fill(MIN_PLATES);
    const { unmount } = await renderAt();
    const bar = screen.getByTestId("develop");
    expect(restStyleOf(bar)).toMatchObject({ backgroundColor: theme.accent, borderRadius: ref.radius.round, minHeight: GHOST.height });
    expect(restStyleOf(bar).opacity).toBeUndefined();
    expect(styleOf(screen.getByText(COPY.develop))).toMatchObject({ ...ref.type.headline, color: theme.accentInk });
    await userEvent.setup().press(bar);
    expect(router.push).toHaveBeenCalledWith("/capture/develop");
    expect(mockFeedback.thud).toHaveBeenCalledTimes(1);
    await unmount();
    fill(MIN_PLATES - 1);
    await renderAt();
    expect(screen.getByTestId("develop")).toBeDisabled();
    expect(restStyleOf(screen.getByTestId("develop"))).toMatchObject({ backgroundColor: theme.accent, opacity: ref.button.disabledOpacity.pill });
    expect(styleOf(screen.getByTestId("develop-helper")).color).toBe(theme.inkMuted);
  });

  it("keeps the flagged amber, which is a warning, not the mode's colour", async () => {
    fill(3);
    await renderAt("1:person");
    expect(styleOf(screen.getByTestId("plate-1-ring")).borderColor).toBe(L.warning);
    expect(styleOf(screen.getByTestId("plate-1-flag", hidden)).color).toBe(L.warning);
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

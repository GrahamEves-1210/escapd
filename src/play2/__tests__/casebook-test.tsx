// The casebook: a book that opens on the table, its leaves a tab apart: found cards, the case and held items,
// crime scene's evidence board, the hints.
import type { ReactElement } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { createGestureController } from "react-native-gesture-handler/jest-utils";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { BOOK_MS, Casebook, TURN_MS, type CasebookProps, type Leaf } from "../Casebook";
import { BOOK, bookLayout } from "../journal/Book";
import { emptyLog, type ThreadLog } from "../journal/threads";

const mockFeedback = { tick: jest.fn(), tap: jest.fn(), press: jest.fn(), paper: jest.fn(), detent: jest.fn() };
jest.mock("@/game/feedback", () => ({ useFeedback: () => mockFeedback }));
jest.mock("@shopify/react-native-skia", () => {
  const base = jest.requireActual("../../../jest/skia-mock");
  const { createElement } = jest.requireActual("react");
  const host = (name: string) => (props: Record<string, unknown>) => createElement(name, props, props.children);
  return { ...base, Path: host("SkiaPath"), Rect: host("SkiaRect"), LinearGradient: host("SkiaLinearGradient"), BlurMask: host("SkiaBlurMask"), DashPathEffect: host("SkiaDash") };
});

const base = {
  objective: "Name who did it at the door.",
  cards: [{ id: "card_1", title: "A slip", text: "Stamped at the station." }],
  items: [{ id: "item_1", name: "Brass key", examinable: false }],
  hints: ["Look where the light falls."],
  canHint: true, glints: true, onGlints: jest.fn(), onHint: jest.fn(), onExamine: jest.fn(), onRestart: jest.fn(), onClose: jest.fn(),
};

/** On the game's screen (its leaves turn to a swipe as well: gestures need their root). */
const mount = (ui: ReactElement) => render(<GestureHandlerRootView>{ui}</GestureHandlerRootView>);
/** The book lying open (reduced motion: no swing, a tab shows its leaf at once). */
const open = (props: Partial<CasebookProps> = {}) => mount(<ThemeProvider reducedMotion><Casebook {...base} {...props} /></ThemeProvider>);
/** Turns to a leaf by its index tab. */
const turnTo = (leaf: Leaf) => fireEvent.press(screen.getByTestId(`v2-casebook-tab-${leaf}`));

describe("Casebook", () => {
  it("opens at what she found; the case, her pockets and the hints are each a tab away", async () => {
    await open();
    expect(screen.getByRole("header", { name: "Casebook" })).toBeTruthy();
    expect(screen.getByText("Stamped at the station.")).toBeTruthy();
    expect(screen.getByTestId("v2-casebook-tab-found").props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId("v2-casebook-tab-case").props.accessibilityState).toMatchObject({ selected: false });
    expect(screen.getByTestId("v2-casebook-tab-case").props.accessibilityLabel).toBe("The case");
    // Crime scene's board is a leaf of crime scene's book only.
    expect(screen.queryByTestId("v2-casebook-tab-board")).toBeNull();
    await turnTo("case");
    expect(screen.getByTestId("v2-casebook-tab-case").props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId("v2-casebook-objective").props.children).toBe(base.objective);
    expect(screen.getByText("Brass key")).toBeTruthy();
    // The leaf turned from is still there (as it was left), but not on the page.
    expect(screen.queryByText("Stamped at the station.")).toBeNull();
    expect(screen.getByText("Stamped at the station.", { includeHiddenElements: true })).toBeTruthy();
    await turnTo("hints");
    expect(screen.getByText("Look where the light falls.")).toBeTruthy();
    expect(screen.getByText("Another hint")).toBeTruthy();
    expect(mockFeedback.paper).toHaveBeenCalled();
  });

  it("is her journal: the objective in her hand, each card taped in as what it is", async () => {
    const cards = [
      { id: "c_uv", title: "Under UV", text: "Glowing violet: p. 94." },
      { id: "c_m", title: "Matchbook", text: "From a bar called the Blue Lantern." },
      { id: "c_t", title: "Taped note", text: "Edge to edge: 5." },
    ];
    await open({ cards });
    for (const c of cards) {
      expect(screen.getByTestId(`v2-casebook-card-${c.id}`)).toBeTruthy();
      expect(screen.getByText(c.text)).toBeTruthy();
    }
    // A polaroid of what it was found on, captioned with its title.
    expect(screen.getByText("Matchbook")).toBeTruthy();
    await turnTo("case");
    expect(screen.getByTestId("v2-casebook-objective").props.children).toBe(base.objective);
    // Hints are the cat's margin notes.
    await turnTo("hints");
    expect(screen.getByText(/^psst/)).toBeTruthy();
  });

  it("never lists a UV trace's report (an old stored room's): only what was found, and a writing trace's bare words", async () => {
    const logged = (places: Record<string, string>): ThreadLog => ({ ...emptyLog(), cards: Object.fromEntries(Object.entries(places).map(([id, place], i) => [id, { at: i, place, batch: 1 }])) });
    // A room stored before: its traces carry nothing of what they look like, and reading one gave a report.
    const oldObjects = [{ id: "drawer" }, { id: "trace_fp", trace: { kind: "footprints" as const, surface: "floor" as const, anchor: "rug", seed: 7 } }];
    const report = { id: "c_report", title: "Footprint report", text: "A man's boot, size eleven. Whoever stood here was no gardener." };
    const slip = { id: "card_1", title: "A slip", text: "Stamped at the station." };
    const old = await open({ cards: [slip, report], objects: oldObjects, log: logged({ card_1: "drawer", c_report: "trace_fp" }), fresh: 2 });
    expect(screen.getByTestId("v2-casebook-card-card_1")).toBeTruthy();
    expect(screen.queryByTestId("v2-casebook-card-c_report")).toBeNull();
    expect(screen.queryByText(/no gardener/)).toBeNull();
    expect(screen.queryByText("Footprint report")).toBeNull();
    await old.unmount();
    // With no log of where it turned up (found before the log was kept), its title gives it away.
    const unlogged = await open({ cards: [slip, report], objects: oldObjects });
    expect(screen.queryByTestId("v2-casebook-card-c_report")).toBeNull();
    await unlogged.unmount();
    // Only a report was ever found: the book opens at the case, and the leaf for what she found says nothing was (no empty board).
    const only = await open({ cards: [report], objects: oldObjects, log: logged({ c_report: "trace_fp" }) });
    expect(screen.getByTestId("v2-casebook-tab-case").props.accessibilityState).toMatchObject({ selected: true });
    await turnTo("found");
    expect(screen.getByTestId("v2-casebook-empty")).toBeTruthy();
    await only.unmount();
    // A room planned now: the writing on the wall is logged as its words and nothing else, and that stays.
    const newObjects = [{ id: "drawer" }, { id: "trace_wr", trace: { kind: "writing" as const, surface: "wall" as const, anchor: "desk", seed: 9, hand: "block" as const } }];
    const words = { id: "c_w", title: "Writing on the wall", text: "Never the first: what lies flat on the floor." };
    await open({
      cards: [slip, words], objects: newObjects, log: logged({ card_1: "drawer", c_w: "trace_wr" }),
      marks: [{ object: "trace_wr", overlay: "glow_mark", mark: "Never the first: what lies flat on the floor." }],
    });
    expect(screen.getByTestId("v2-casebook-card-c_w")).toBeTruthy();
    expect(screen.getByText("Never the first: what lies flat on the floor.")).toBeTruthy();
  });

  it("nothing found yet: opens at the case; the leaf for what she found says so (and doesn't say where to look)", async () => {
    await open({ cards: [] });
    expect(screen.getByTestId("v2-casebook-objective")).toBeTruthy();
    await turnTo("found");
    expect(screen.getByTestId("v2-casebook-empty").props.children).toBe("Nothing yet.");
  });

  it("held items are stickers to examine", async () => {
    const onExamine = jest.fn();
    await open({ items: [{ id: "item_1", name: "Brass key", examinable: true }], onExamine });
    await turnTo("case");
    await fireEvent.press(screen.getByTestId("v2-examine-item_1"));
    expect(onExamine).toHaveBeenCalledWith("item_1");
  });

  it("asks before restarting: a second tap does it", async () => {
    const onRestart = jest.fn();
    await open({ onRestart });
    await turnTo("hints");
    await fireEvent.press(screen.getByTestId("v2-restart"));
    expect(onRestart).not.toHaveBeenCalled();
    expect(screen.getByText("Tap again to restart. Progress will be lost.")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("v2-restart"));
    expect(onRestart).toHaveBeenCalledTimes(1);
  });

  it("glints are a box she ticks", async () => {
    const onGlints = jest.fn();
    await open({ onGlints });
    await turnTo("hints");
    const box = screen.getByTestId("v2-glints");
    expect(box.props.accessibilityRole).toBe("switch");
    expect(box.props.accessibilityState).toMatchObject({ checked: true });
    await fireEvent.press(box);
    expect(onGlints).toHaveBeenCalledWith(false);
  });

  it("asking for a hint is on the hints' leaf", async () => {
    const onHint = jest.fn();
    await open({ onHint });
    await turnTo("hints");
    await fireEvent.press(screen.getByTestId("v2-hint"));
    expect(onHint).toHaveBeenCalledTimes(1);
  });

  it("no more hints for this step: no button, a line saying so", async () => {
    await open({ canHint: false });
    await turnTo("hints");
    expect(screen.queryByTestId("v2-hint")).toBeNull();
    expect(screen.getByTestId("v2-hints-spent")).toBeTruthy();
  });

  it("crime scene: the evidence board is a leaf of its own, crossing options off and back", async () => {
    const onStrike = jest.fn();
    const board = [
      { title: "Who", options: [{ id: "s_a", name: "Ada Finch" }, { id: "s_b", name: "Bram Hollis" }] },
      { title: "Why", options: [{ id: "m_a", name: "Greed" }] },
    ];
    await open({ board, struck: ["s_b"], onStrike });
    await turnTo("board");
    expect(screen.getByTestId("v2-board")).toBeTruthy();
    expect(screen.getByTestId("v2-board-s_b").props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByTestId("v2-board-s_a").props.accessibilityState).toMatchObject({ checked: false });
    // Struck off with a "ruled out" stamp; the one left on a card is circled.
    expect(screen.getAllByText("RULED OUT")).toHaveLength(1);
    expect(screen.getByText("this one?")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("v2-board-s_a"));
    expect(onStrike).toHaveBeenCalledWith("s_a");
  });

  it("the tab for what she found says how many are new until she has turned to it", async () => {
    // Nothing shows as found (only a trace's report was), so the book opens at the case; then cards arrive with the next opening.
    await open({ cards: [], fresh: 0 });
    expect(screen.getByTestId("v2-casebook-tab-found").props.accessibilityLabel).toBe("What I found");
  });
});

describe("Casebook: the book", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockFeedback.paper.mockClear();
  });
  afterEach(() => jest.useRealTimers());
  const advance = (ms: number) => act(async () => {
    jest.advanceTimersByTime(ms);
  });

  it("comes up shut and opens in under 600 ms; shutting is as quick, and only then is it gone", async () => {
    expect(BOOK_MS.rise - BOOK_MS.overlap + BOOK_MS.swing).toBeLessThan(600);
    expect(BOOK_MS.shut - BOOK_MS.overlap + BOOK_MS.sink).toBeLessThan(600);
    const onClose = jest.fn();
    await mount(<Casebook {...base} onClose={onClose} />);
    // While the board swings, a touch anywhere finishes it.
    expect(screen.getByTestId("v2-casebook-skip", { includeHiddenElements: true })).toBeTruthy();
    await advance(700);
    expect(screen.queryByTestId("v2-casebook-skip", { includeHiddenElements: true })).toBeNull();
    expect(mockFeedback.paper).toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId("v2-casebook-close"));
    expect(onClose).not.toHaveBeenCalled();
    await advance(600);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("is skippable: a touch while it opens and it lies open; a touch while it shuts and it is gone", async () => {
    const onClose = jest.fn();
    await mount(<Casebook {...base} onClose={onClose} />);
    await fireEvent.press(screen.getByTestId("v2-casebook-skip", { includeHiddenElements: true }));
    expect(screen.queryByTestId("v2-casebook-skip", { includeHiddenElements: true })).toBeNull();
    await fireEvent.press(screen.getByTestId("v2-casebook-away", { includeHiddenElements: true }));
    expect(onClose).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId("v2-casebook-skip", { includeHiddenElements: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("reduced motion: it is simply open, and simply gone", async () => {
    const onClose = jest.fn();
    await open({ onClose });
    expect(screen.queryByTestId("v2-casebook-skip", { includeHiddenElements: true })).toBeNull();
    await fireEvent.press(screen.getByTestId("v2-casebook-close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("a tab turns the leaf over: paper, the sheet folding across, then the leaf it uncovered", async () => {
    await mount(<Casebook {...base} />);
    await advance(1200);
    mockFeedback.paper.mockClear();
    await turnTo("hints");
    expect(mockFeedback.paper).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("v2-casebook-turn", { includeHiddenElements: true })).toBeTruthy();
    // Mid-turn nothing on the page takes a touch.
    expect(screen.getByText("Look where the light falls.")).toBeTruthy();
    await advance(TURN_MS + 200);
    expect(screen.queryByTestId("v2-casebook-turn", { includeHiddenElements: true })).toBeNull();
    expect(screen.getByTestId("v2-casebook-tab-hints").props.accessibilityState).toMatchObject({ selected: true });
    await fireEvent.press(screen.getByTestId("v2-hint"));
    expect(base.onHint).toHaveBeenCalled();
  });

  it("a swipe across the page turns the leaf: toward the gutter for the next, away from it for the last", async () => {
    await open();
    const swipe = async (dx: number) => {
      const c = createGestureController("v2-casebook-swipe");
      await act(async () => {
        c.begin({ translationX: 0 });
        c.activate({ translationX: dx / 2 });
        c.update({ translationX: dx });
        c.end({ translationX: dx });
        jest.advanceTimersByTime(1);
      });
    };
    expect(screen.getByTestId("v2-casebook-tab-found").props.accessibilityState).toMatchObject({ selected: true });
    await swipe(-90);
    expect(screen.getByTestId("v2-casebook-tab-hints").props.accessibilityState).toMatchObject({ selected: true });
    // The last leaf: nothing further to turn to.
    await swipe(-90);
    expect(screen.getByTestId("v2-casebook-tab-hints").props.accessibilityState).toMatchObject({ selected: true });
    await swipe(90);
    await swipe(90);
    expect(screen.getByTestId("v2-casebook-tab-case").props.accessibilityState).toMatchObject({ selected: true });
    // A short drag is not a turn.
    await swipe(-20);
    expect(screen.getByTestId("v2-casebook-tab-case").props.accessibilityState).toMatchObject({ selected: true });
  });

  it("the page is no narrower than the sheet it replaces, on a phone or a small one", () => {
    // The leaf's own margins take 35 points; the cards' column was 305 points on a 390-point phone and 290 on a 375-point one.
    expect(bookLayout(390, 700).page.width - 35).toBeGreaterThanOrEqual(305);
    expect(bookLayout(375, 560).page.width - 35).toBeGreaterThanOrEqual(290);
    const { page } = bookLayout(390, 700);
    expect(page.y).toBe(BOOK.pageHead);
    expect(page.y + page.height).toBe(700 - (BOOK.foot - BOOK.pageFoot));
  });
});

describe("Casebook: the scrapbook", () => {
  const cards = [
    { id: "c1", title: "Margin note", text: "Between the lines: 4." },
    { id: "c2", title: "Lab slip", text: "Ink on the wall: 7." },
    { id: "c3", title: "Taped note", text: "Edge to edge: 9." },
    { id: "c4", title: "Lab slip", text: "Footprints by the window." },
  ];
  const log: ThreadLog = {
    ...emptyLog(),
    ticked: 2,
    cards: {
      c1: { at: 1, place: "bookshelf", batch: 1 },
      c2: { at: 2, place: "rug", batch: 2 },
      c3: { at: 3, place: null, batch: 3 },
      c4: { at: 4, place: "rug", batch: 4 },
    },
  };
  /** Lays each card out down the page, as a device would. */
  const layOut = async () => {
    for (const [i, c] of cards.entries()) {
      await act(async () => {
        fireEvent(screen.getByTestId(`v2-casebook-card-${c.id}`), "layout", { nativeEvent: { layout: { x: 0, y: i * 200, width: 300, height: 170 } } });
      });
    }
  };

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("ties cards that belong together with red string; new ones get a star and a rustle of paper", async () => {
    mockFeedback.paper.mockClear();
    await mount(<Casebook {...base} cards={cards} log={log} progress={{ solved: 5, total: 8 }} fresh={2} />);
    await layOut();
    // c2 and c4: the same place and the same kind; the others stand alone.
    expect(screen.getByTestId("v2-casebook-string-c2>c4", { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByTestId("v2-casebook-string-c1>c2", { includeHiddenElements: true })).toBeNull();
    expect(screen.getAllByText("new!", { includeHiddenElements: true })).toHaveLength(2);
    expect(screen.getByTestId("v2-casebook-fresh")).toBeTruthy();
    await act(async () => {
      jest.advanceTimersByTime(4000);
    });
    // The book's own opening, then a rustle for each of the two new cards as it lands.
    expect(mockFeedback.paper).toHaveBeenCalledTimes(3);
    // Solved since both were found: it pulls taut with a twang.
    expect(mockFeedback.detent).toHaveBeenCalledTimes(1);
  });

  it("keeps score in the margin: leads ticked off, a note that knows she's close", async () => {
    await open({ cards, log, progress: { solved: 5, total: 8 } });
    await turnTo("case");
    expect(screen.getByTestId("v2-casebook-leads").props.accessibilityLabel).toBe("5 of 8 leads followed");
    expect(screen.getByTestId("v2-casebook-margin-close")).toBeTruthy();
    expect(screen.getByText(/you're close/)).toBeTruthy();
  });

  it("tells the log what it showed as it closes", async () => {
    const onSeen = jest.fn();
    const view = await mount(<Casebook {...base} cards={cards} log={log} progress={{ solved: 5, total: 8 }} onSeen={onSeen} />);
    await view.unmount();
    expect(onSeen).toHaveBeenCalledWith(["c2>c4"], 5);
  });

  it("reduced motion: cards and strings are simply there, nothing twangs", async () => {
    mockFeedback.detent.mockClear();
    await mount(
      <ThemeProvider reducedMotion>
        <Casebook {...base} cards={cards} log={log} progress={{ solved: 5, total: 8 }} fresh={1} />
      </ThemeProvider>,
    );
    await layOut();
    expect(screen.getByTestId("v2-casebook-string-c2>c4", { includeHiddenElements: true })).toBeTruthy();
    await act(async () => {
      jest.advanceTimersByTime(4000);
    });
    expect(mockFeedback.detent).not.toHaveBeenCalled();
  });

  it("with many cards, every one is on the page and readable", async () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ id: `m${i}`, title: i % 2 ? "Lab slip" : `Note ${i}`, text: `Clue number ${i}.` }));
    await mount(<Casebook {...base} cards={many} log={emptyLog()} progress={{ solved: 1, total: 8 }} fresh={10} />);
    for (const c of many) expect(screen.getByText(c.text)).toBeTruthy();
  });
});


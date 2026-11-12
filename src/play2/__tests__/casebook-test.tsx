// The casebook: found cards, held items, hints, and crime scene's evidence board.
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { Casebook } from "../Casebook";
import { emptyLog, type ThreadLog } from "../journal/threads";

const mockFeedback = { tick: jest.fn(), tap: jest.fn(), press: jest.fn(), paper: jest.fn(), detent: jest.fn() };
jest.mock("@/game/feedback", () => ({ useFeedback: () => mockFeedback }));
jest.mock("@shopify/react-native-skia", () => {
  const base = jest.requireActual("../../../jest/skia-mock");
  const { createElement } = jest.requireActual("react");
  const host = (name: string) => (props: Record<string, unknown>) => createElement(name, props, props.children);
  return { ...base, Path: host("SkiaPath"), BlurMask: host("SkiaBlurMask"), DashPathEffect: host("SkiaDash") };
});

const base = {
  objective: "Name who did it at the door.",
  cards: [{ id: "card_1", title: "A slip", text: "Stamped at the station." }],
  items: [{ id: "item_1", name: "Brass key", examinable: false }],
  hints: ["Look where the light falls."],
  canHint: true, glints: true, onGlints: jest.fn(), onHint: jest.fn(), onExamine: jest.fn(), onRestart: jest.fn(), onClose: jest.fn(),
};

describe("Casebook", () => {
  it("shows what was found, what is held and the hints taken", async () => {
    await render(<Casebook {...base} />);
    expect(screen.getByText("Stamped at the station.")).toBeTruthy();
    expect(screen.getByText("Brass key")).toBeTruthy();
    expect(screen.getByText("Look where the light falls.")).toBeTruthy();
    expect(screen.getByText("Another hint")).toBeTruthy();
    expect(screen.queryByTestId("v2-board")).toBeNull();
  });

  it("is her journal: the objective in her hand, each card taped in as what it is", async () => {
    const cards = [
      { id: "c_uv", title: "Under UV", text: "Glowing violet: p. 94." },
      { id: "c_m", title: "Matchbook", text: "From a bar called the Blue Lantern." },
      { id: "c_t", title: "Taped note", text: "Edge to edge: 5." },
    ];
    await render(<Casebook {...base} cards={cards} />);
    expect(screen.getByTestId("v2-casebook-objective").props.children).toBe(base.objective);
    for (const c of cards) {
      expect(screen.getByTestId(`v2-casebook-card-${c.id}`)).toBeTruthy();
      expect(screen.getByText(c.text)).toBeTruthy();
    }
    // A polaroid of what it was found on, captioned with its title.
    expect(screen.getByText("Matchbook")).toBeTruthy();
    // Hints are the cat's margin notes.
    expect(screen.getByText(/^psst/)).toBeTruthy();
  });

  it("never lists a UV trace's report (an old stored room's): only what was found, and a writing trace's bare words", async () => {
    const logged = (places: Record<string, string>): ThreadLog => ({ ...emptyLog(), cards: Object.fromEntries(Object.entries(places).map(([id, place], i) => [id, { at: i, place, batch: 1 }])) });
    // A room stored before: its traces carry nothing of what they look like, and reading one gave a report.
    const oldObjects = [{ id: "drawer" }, { id: "trace_fp", trace: { kind: "footprints" as const, surface: "floor" as const, anchor: "rug", seed: 7 } }];
    const report = { id: "c_report", title: "Footprint report", text: "A man's boot, size eleven. Whoever stood here was no gardener." };
    const slip = { id: "card_1", title: "A slip", text: "Stamped at the station." };
    const old = await render(<Casebook {...base} cards={[slip, report]} objects={oldObjects} log={logged({ card_1: "drawer", c_report: "trace_fp" })} fresh={2} />);
    expect(screen.getByTestId("v2-casebook-card-card_1")).toBeTruthy();
    expect(screen.queryByTestId("v2-casebook-card-c_report")).toBeNull();
    expect(screen.queryByText(/no gardener/)).toBeNull();
    expect(screen.queryByText("Footprint report")).toBeNull();
    await old.unmount();
    // With no log of where it turned up (found before the log was kept), its title gives it away.
    const unlogged = await render(<Casebook {...base} cards={[slip, report]} objects={oldObjects} />);
    expect(screen.queryByTestId("v2-casebook-card-c_report")).toBeNull();
    await unlogged.unmount();
    // Only a report was ever found: the page says nothing was (it doesn't show an empty board).
    const only = await render(<Casebook {...base} cards={[report]} objects={oldObjects} log={logged({ c_report: "trace_fp" })} />);
    expect(screen.getByTestId("v2-casebook-empty")).toBeTruthy();
    await only.unmount();
    // A room planned now: the writing on the wall is logged as its words and nothing else, and that stays.
    const newObjects = [{ id: "drawer" }, { id: "trace_wr", trace: { kind: "writing" as const, surface: "wall" as const, anchor: "desk", seed: 9, hand: "block" as const } }];
    const words = { id: "c_w", title: "Writing on the wall", text: "Never the first: what lies flat on the floor." };
    await render(
      <Casebook {...base} cards={[slip, words]} objects={newObjects} log={logged({ card_1: "drawer", c_w: "trace_wr" })}
        marks={[{ object: "trace_wr", overlay: "glow_mark", mark: "Never the first: what lies flat on the floor." }]} />,
    );
    expect(screen.getByTestId("v2-casebook-card-c_w")).toBeTruthy();
    expect(screen.getByText("Never the first: what lies flat on the floor.")).toBeTruthy();
  });

  it("nothing found yet: says so (and doesn't say where to look)", async () => {
    await render(<Casebook {...base} cards={[]} />);
    expect(screen.getByTestId("v2-casebook-empty").props.children).toBe("Nothing yet.");
    await screen.unmount();
  });

  it("nothing found yet: says so", async () => {
    await render(<Casebook {...base} cards={[]} />);
    expect(screen.getByTestId("v2-casebook-empty")).toBeTruthy();
  });

  it("held items are stickers to examine", async () => {
    const onExamine = jest.fn();
    await render(<Casebook {...base} items={[{ id: "item_1", name: "Brass key", examinable: true }]} onExamine={onExamine} />);
    await fireEvent.press(screen.getByTestId("v2-examine-item_1"));
    expect(onExamine).toHaveBeenCalledWith("item_1");
  });

  it("asks before restarting: a second tap does it", async () => {
    const onRestart = jest.fn();
    await render(<Casebook {...base} onRestart={onRestart} />);
    await fireEvent.press(screen.getByTestId("v2-restart"));
    expect(onRestart).not.toHaveBeenCalled();
    expect(screen.getByText("Tap again to restart. Progress will be lost.")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("v2-restart"));
    expect(onRestart).toHaveBeenCalledTimes(1);
  });

  it("no more hints for this step: no button, a line saying so", async () => {
    await render(<Casebook {...base} canHint={false} />);
    expect(screen.queryByTestId("v2-hint")).toBeNull();
    expect(screen.getByTestId("v2-hints-spent")).toBeTruthy();
  });

  it("crime scene: the evidence board crosses options off and back", async () => {
    const onStrike = jest.fn();
    const board = [
      { title: "Who", options: [{ id: "s_a", name: "Ada Finch" }, { id: "s_b", name: "Bram Hollis" }] },
      { title: "Why", options: [{ id: "m_a", name: "Greed" }] },
    ];
    await render(<Casebook {...base} board={board} struck={["s_b"]} onStrike={onStrike} />);
    expect(screen.getByTestId("v2-board")).toBeTruthy();
    expect(screen.getByTestId("v2-board-s_b").props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByTestId("v2-board-s_a").props.accessibilityState).toMatchObject({ checked: false });
    // Struck off with a "ruled out" stamp; the one left on a card is circled.
    expect(screen.getAllByText("RULED OUT")).toHaveLength(1);
    expect(screen.getByText("this one?")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("v2-board-s_a"));
    expect(onStrike).toHaveBeenCalledWith("s_a");
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
    await render(<Casebook {...base} cards={cards} log={log} progress={{ solved: 5, total: 8 }} fresh={2} />);
    await layOut();
    // c2 and c4: the same place and the same kind; the others stand alone.
    expect(screen.getByTestId("v2-casebook-string-c2>c4", { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByTestId("v2-casebook-string-c1>c2", { includeHiddenElements: true })).toBeNull();
    expect(screen.getAllByText("new!", { includeHiddenElements: true })).toHaveLength(2);
    expect(screen.getByTestId("v2-casebook-fresh")).toBeTruthy();
    await act(async () => {
      jest.advanceTimersByTime(4000);
    });
    expect(mockFeedback.paper).toHaveBeenCalledTimes(2);
    // Solved since both were found: it pulls taut with a twang.
    expect(mockFeedback.detent).toHaveBeenCalledTimes(1);
  });

  it("keeps score in the margin: leads ticked off, a note that knows she's close", async () => {
    await render(<Casebook {...base} cards={cards} log={log} progress={{ solved: 5, total: 8 }} />);
    expect(screen.getByTestId("v2-casebook-leads").props.accessibilityLabel).toBe("5 of 8 leads followed");
    expect(screen.getByTestId("v2-casebook-margin-close")).toBeTruthy();
    expect(screen.getByText(/you're close/)).toBeTruthy();
  });

  it("tells the log what it showed as it closes", async () => {
    const onSeen = jest.fn();
    const view = await render(<Casebook {...base} cards={cards} log={log} progress={{ solved: 5, total: 8 }} onSeen={onSeen} />);
    await view.unmount();
    expect(onSeen).toHaveBeenCalledWith(["c2>c4"], 5);
  });

  it("reduced motion: cards and strings are simply there, nothing twangs", async () => {
    mockFeedback.detent.mockClear();
    await render(
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
    await render(<Casebook {...base} cards={many} log={emptyLog()} progress={{ solved: 1, total: 8 }} fresh={10} />);
    for (const c of many) expect(screen.getByText(c.text)).toBeTruthy();
  });
});


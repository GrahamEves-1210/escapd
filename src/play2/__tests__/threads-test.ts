// The casebook's red string: which cards belong together and when a lead pulls taut.
import { act, renderHook } from "@testing-library/react-native";
import { emptyLog, markSeen, placeOf, readLog, record, stageOf, stringsOf, type ThreadLog } from "../journal/threads";
import { useCaseThreads } from "../journal/useCaseThreads";

const objects = [
  { id: "bookshelf" },
  { id: "rug" },
  { id: "trace_a", trace: { kind: "writing" as const, surface: "wall" as const, anchor: "bookshelf", seed: 1 } },
];

describe("placeOf", () => {
  it("is the object acted on (a held item's control: the item); combining is nowhere", () => {
    expect(placeOf({ type: "inspect", object: "bookshelf" })).toBe("bookshelf");
    expect(placeOf({ type: "use_item", item: "torch", object: "trace_a" })).toBe("trace_a");
    expect(placeOf({ type: "set_control", target: "rug", control: "lifted", value: true })).toBe("rug");
    expect(placeOf({ type: "submit", object: "door", value: ["1"] })).toBe("door");
    expect(placeOf({ type: "combine", items: ["a", "b"] })).toBeNull();
  });
});

describe("record", () => {
  it("notes each new card once: when (steps solved), where, which batch", () => {
    let log = record(emptyLog(), ["c1"], 1, "bookshelf");
    expect(log.cards.c1).toEqual({ at: 1, place: "bookshelf", batch: 1 });
    log = record(log, ["c1", "c2", "c3"], 3, "rug");
    expect(log.cards.c2).toEqual({ at: 3, place: "rug", batch: 2 });
    expect(log.cards.c3.batch).toBe(2);
    expect(log.cards.c1.at).toBe(1);
    // Nothing new: the same log.
    expect(record(log, ["c1", "c2", "c3"], 4, "rug")).toBe(log);
  });

  it("cards in a save it never saw: nowhere, no batch, found before anything since", () => {
    const log = record(emptyLog(), ["c1", "c2"], 3, "door", true);
    expect(log.cards.c1).toEqual({ at: -1, place: null, batch: 0 });
    expect(log.ticked).toBe(3);
    // Not one lead just for having turned up together in the save.
    expect(stringsOf([{ id: "c1", title: "A" }, { id: "c2", title: "B" }], log, 3)).toEqual([]);
  });

  it("an empty casebook (a restart) empties the log", () => {
    const log = markSeen(record(emptyLog(), ["c1"], 1, "rug"), ["x>y"], 2);
    expect(record(log, [], 0, null)).toEqual(emptyLog());
    const empty = emptyLog();
    expect(record(empty, [], 0, null)).toBe(empty);
  });
});

describe("stringsOf", () => {
  const log: ThreadLog = {
    ...emptyLog(),
    cards: {
      c1: { at: 1, place: "bookshelf", batch: 1 },
      c2: { at: 2, place: "rug", batch: 2 },
      c3: { at: 4, place: "trace_a", batch: 3 },
      c4: { at: 4, place: null, batch: 4 },
      c5: { at: 5, place: null, batch: 5 },
    },
  };
  const cards = [
    { id: "c1", title: "Margin note" },
    { id: "c2", title: "Lab slip" },
    { id: "c3", title: "Ink on the wall" },
    { id: "c4", title: "Taped note" },
    { id: "c5", title: "lab  slip" },
  ];

  it("joins a lead's cards in order: same place (a trace is where it marks), same kind", () => {
    const s = stringsOf(cards, log, 5, objects);
    expect(s.map((x) => x.key)).toEqual(["c1>c3", "c2>c5"]);
    // Leads alternate margins so they never tangle.
    expect(s.map((x) => x.side)).toEqual(["left", "right"]);
    expect(s.map((x) => x.lead)).toEqual([0, 1]);
  });

  it("without the room's objects a trace is a place of its own", () => {
    expect(stringsOf(cards, log, 5).map((x) => x.key)).toEqual(["c2>c5"]);
  });

  it("cards one action turned up together are one lead", () => {
    const together: ThreadLog = { ...log, cards: { ...log.cards, c4: { at: 4, place: null, batch: 3 } } };
    expect(stringsOf(cards, together, 5, objects).map((x) => x.key)).toContain("c3>c4");
  });

  it("sags until a step is solved after both its cards were found, then twangs taut once", () => {
    const at4 = stringsOf(cards, log, 4, objects);
    expect(at4.find((x) => x.key === "c1>c3")).toMatchObject({ taut: false, twang: false });
    const at5 = stringsOf(cards, log, 5, objects);
    expect(at5.find((x) => x.key === "c1>c3")).toMatchObject({ taut: true, twang: true });
    expect(at5.find((x) => x.key === "c2>c5")).toMatchObject({ taut: false });
    const seen = markSeen(log, ["c1>c3"], 5);
    expect(stringsOf(cards, seen, 5, objects).find((x) => x.key === "c1>c3")).toMatchObject({ taut: true, twang: false });
  });
});

describe("markSeen", () => {
  it("adds what's new, the same log when nothing is", () => {
    const log = markSeen(emptyLog(), ["a>b"], 2);
    expect(log.taut).toEqual(["a>b"]);
    expect(log.ticked).toBe(2);
    expect(markSeen(log, ["a>b"], 2)).toBe(log);
  });
});

describe("readLog", () => {
  it("reads a saved log; anything else is an empty one", () => {
    const log = record(emptyLog(), ["c1"], 1, "rug");
    expect(readLog(JSON.stringify(log))).toEqual(log);
    expect(readLog(null)).toEqual(emptyLog());
    expect(readLog("{nope")).toEqual(emptyLog());
    expect(readLog(JSON.stringify({ v: 9 }))).toEqual(emptyLog());
  });
});

describe("stageOf", () => {
  it("start, going, close, the last one", () => {
    expect(stageOf(0, 8)).toBe("start");
    expect(stageOf(2, 8)).toBe("going");
    expect(stageOf(5, 8)).toBe("close");
    expect(stageOf(7, 8)).toBe("last");
    expect(stageOf(0, 0)).toBe("start");
  });
});

describe("useCaseThreads", () => {
  it("notes where each card turned up, through the room's act, and keeps it per room", async () => {
    const act2 = jest.fn(async () => null);
    type Room = Parameters<typeof useCaseThreads>[1];
    const room = (cards: { id: string; title: string; text: string }[], solved: number) =>
      ({ phase: { kind: "ready" }, state: {}, cards, progress: { solved, total: 8 }, act: act2 }) as unknown as Room;
    const view = await renderHook((p: { v2: Room }) => useCaseThreads("room-t", p.v2), { initialProps: { v2: room([], 0) } });
    await act(async () => {});
    expect(view.result.current.log).toEqual(emptyLog());
    await act(async () => {
      await view.result.current.act({ type: "inspect", object: "bookshelf" });
    });
    expect(act2).toHaveBeenCalledWith({ type: "inspect", object: "bookshelf" });
    await view.rerender({ v2: room([{ id: "c1", title: "Margin note", text: "x" }], 1) });
    await act(async () => {});
    expect(view.result.current.log!.cards.c1).toEqual({ at: 1, place: "bookshelf", batch: 1 });
    await act(async () => {
      view.result.current.seen(["a>b"], 1);
    });
    expect(view.result.current.log!.taut).toEqual(["a>b"]);
  });
});

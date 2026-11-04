// The cat mounts with its eyes and lids, takes a find and a wrong answer, thinks with "?"s, and dozes off when the light is still (long after a stuck glance would come).
// It says lines (one at a time, rule lines first), and glances where it's told (a mark on that side, now and then a word; thinking, quietly).
// Stroked it purrs (no heart), a screen reader can pet it or rub it, and rough quick taps (never stroking) are too much. The sitting cat purrs too.
// Its cues: a scolding after three wrong answers in a row, a perk once per thing the light finds, glances when the player is stuck (at the way out once everything's been looked at).
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react-native";
import { createGestureController } from "react-native-gesture-handler/jest-utils";
import { makeMutable } from "react-native-reanimated";
import type { PlayState, RoomDefinitionV2 } from "@/engine/v2";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { PET, PeekingCat } from "../PeekingCat";
import { SWISH, SittingCat, TAIL, bendTail, tailBends } from "../SittingCat";
import { useCatCues } from "../useCatCues";

/** A hand on the cat, step by step (the petting gesture). Under fake timers: what the gesture hands the JS thread runs on a timer. */
function hand() {
  const c = createGestureController("cat-rub");
  const step = (fn: () => void) => act(async () => {
    fn();
    jest.advanceTimersByTime(1);
  });
  let moved = false;
  return {
    down: (x: number, y = 30) => step(() => c.begin({ x, y })),
    rub: (x: number, y = 30, velocityX = 0) => step(() => {
      if (!moved) c.activate({ x, y });
      moved = true;
      c.update({ x, y, velocityX });
    }),
    up: (x: number, y = 30) => step(() => {
      if (moved) c.end({ x, y });
      else c.fail({ x, y });
      moved = false;
    }),
  };
}

describe("PeekingCat", () => {
  it("draws, follows a beam and reacts", async () => {
    const x = makeMutable(0.5), y = makeMutable(0.4);
    const frame = { x: 0, y: 100, width: 390, height: 600 };
    const view = await render(<PeekingCat width={58} beamX={x} beamY={y} frame={frame} reaction={null} />);
    expect(screen.getByTestId("v2-cat")).toBeTruthy();
    await view.rerender(<PeekingCat width={58} beamX={x} beamY={y} frame={frame} reaction={{ kind: "found", at: 1 }} />);
    expect(screen.getByText("!")).toBeTruthy();
    await view.rerender(<PeekingCat width={58} beamX={x} beamY={y} frame={frame} reaction={{ kind: "wrong", at: 2 }} />);
    expect(screen.getByLabelText("A black cat watches your light")).toBeTruthy();
    await view.rerender(<PeekingCat width={58} beamX={x} beamY={y} frame={frame} reaction={{ kind: "wrong", at: 2 }} mood="thinking" />);
    expect(screen.getAllByText("?")).toHaveLength(3);
    await view.unmount();
  });

  it("dozes off when the light is still", async () => {
    jest.useFakeTimers();
    try {
      const x = makeMutable(0.5), y = makeMutable(0.4);
      const view = await render(<PeekingCat width={58} beamX={x} beamY={y} frame={null} />);
      expect(screen.queryAllByText("z")).toHaveLength(0);
      // Not before a stuck player's glances (45 s) would get a look in.
      await act(async () => {
        jest.advanceTimersByTime(50000);
      });
      expect(screen.queryAllByText("z")).toHaveLength(0);
      await act(async () => {
        jest.advanceTimersByTime(22000);
      });
      expect(screen.getAllByText("z")).toHaveLength(2);
      await view.unmount();
    } finally {
      jest.useRealTimers();
    }
  });

  it("says a line, one at a time, and takes it down", async () => {
    jest.useFakeTimers();
    try {
      const x = makeMutable(0.5), y = makeMutable(0.4);
      const view = await render(<PeekingCat width={58} beamX={x} beamY={y} frame={null} say={{ text: "Empty.", at: 1 }} />);
      expect(screen.getByText("Empty.")).toBeTruthy();
      // Another flavour line too soon: dropped. A rule line: cuts in.
      await view.rerender(<PeekingCat width={58} beamX={x} beamY={y} frame={null} say={{ text: "Hm.", at: 2 }} />);
      expect(screen.queryByText("Hm.")).toBeNull();
      await view.rerender(<PeekingCat width={58} beamX={x} beamY={y} frame={null} say={{ text: "Think. Don't guess.", at: 3, rule: true }} waiting />);
      expect(screen.getByText("Think. Don't guess.")).toBeTruthy();
      await act(async () => {
        jest.advanceTimersByTime(3000);
      });
      expect(screen.queryByTestId("v2-cat-speech")).toBeNull();
      await view.unmount();
    } finally {
      jest.useRealTimers();
    }
  });

  it("glances where it's told, with a \"!\" (or a \"?\" when it wonders) and now and then a word", async () => {
    const x = makeMutable(0.5), y = makeMutable(0.4);
    const frame = { x: 0, y: 100, width: 390, height: 600 };
    const view = await render(<PeekingCat width={58} beamX={x} beamY={y} frame={frame} lookAt={{ x: 300, y: 200, wonder: true, line: "Over there." }} />);
    expect(screen.getAllByText("?")).toHaveLength(1);
    expect(screen.getByText("Over there.")).toBeTruthy();
    await view.rerender(<PeekingCat width={58} beamX={x} beamY={y} frame={frame} lookAt={null} />);
    expect(screen.queryAllByText("?")).toHaveLength(0);
    // The next glance: an "!"; its word too soon after the last one, so not said.
    await view.rerender(<PeekingCat width={58} beamX={x} beamY={y} frame={frame} lookAt={{ x: 20, y: 400, line: "That way." }} />);
    expect(screen.getByTestId("v2-cat-point")).toHaveTextContent("!");
    expect(screen.queryByText("That way.")).toBeNull();
    await view.unmount();
  });

  it("wakes for a glance", async () => {
    jest.useFakeTimers();
    try {
      const x = makeMutable(0.5), y = makeMutable(0.4);
      const frame = { x: 0, y: 100, width: 390, height: 600 };
      const view = await render(<PeekingCat width={58} beamX={x} beamY={y} frame={frame} />);
      await act(async () => {
        jest.advanceTimersByTime(72000);
      });
      expect(screen.getAllByText("z")).toHaveLength(2);
      await view.rerender(<PeekingCat width={58} beamX={x} beamY={y} frame={frame} lookAt={{ x: 300, y: 200 }} />);
      await act(async () => {
        jest.advanceTimersByTime(500);
      });
      expect(screen.queryAllByText("z")).toHaveLength(0);
      expect(screen.getByTestId("v2-cat-point")).toBeTruthy();
      await view.unmount();
    } finally {
      jest.useRealTimers();
    }
  });

  it("purrs when stroked, never a heart, and opens its eyes again when let go", async () => {
    jest.useFakeTimers();
    try {
      const x = makeMutable(0.5), y = makeMutable(0.4);
      const view = await render(<PeekingCat width={58} beamX={x} beamY={y} frame={null} />);
      // Touch down, rub across it, keep stroking: it purrs.
      const h = hand();
      await h.down(10);
      await h.rub(20);
      await h.rub(48, 32, 600);
      expect(screen.getByTestId("cat-purr")).toHaveTextContent("prr");
      expect(screen.queryByText("♥")).toBeNull();
      await act(async () => {
        jest.advanceTimersByTime(2000);
      });
      expect(screen.getByTestId("cat-purr")).toBeTruthy();
      // Let go: the purr stops.
      await h.up(48);
      expect(screen.queryByTestId("cat-purr")).toBeNull();
      await view.unmount();
    } finally {
      jest.useRealTimers();
    }
  });

  it("stays a button for a screen reader: a pet and a rub purr a moment, still under reduced motion", async () => {
    jest.useFakeTimers();
    try {
      const x = makeMutable(0.5), y = makeMutable(0.4);
      const view = await render(
        <ThemeProvider reducedMotion>
          <PeekingCat width={58} beamX={x} beamY={y} frame={null} />
        </ThemeProvider>,
      );
      const cat = screen.getByRole("button", { name: "Pet the cat" });
      expect(cat.props.accessibilityActions.map((a: { name: string }) => a.name)).toEqual(["activate", "rub"]);
      await fireEvent(cat, "accessibilityAction", { nativeEvent: { actionName: "activate" } });
      expect(screen.getByTestId("cat-purr")).toBeTruthy();
      await act(async () => {
        jest.advanceTimersByTime(PET.a11y + 100);
      });
      expect(screen.queryByTestId("cat-purr")).toBeNull();
      await fireEvent(cat, "accessibilityAction", { nativeEvent: { actionName: "rub" } });
      await act(async () => {
        jest.advanceTimersByTime(PET.a11y + 100);
      });
      expect(screen.getByTestId("cat-purr")).toBeTruthy();
      await act(async () => {
        jest.advanceTimersByTime(PET.a11yRub);
      });
      expect(screen.queryByTestId("cat-purr")).toBeNull();
      await view.unmount();
    } finally {
      jest.useRealTimers();
    }
  });

  it("has had enough after rough, quick taps, but never of being stroked", async () => {
    jest.useFakeTimers();
    try {
      const x = makeMutable(0.5), y = makeMutable(0.4);
      const view = await render(<PeekingCat width={58} beamX={x} beamY={y} frame={null} />);
      const h = hand();
      const stroke = async () => {
        await h.down(10);
        await h.rub(30);
        await h.rub(50);
        await h.up(50);
      };
      const tap = async () => {
        await h.down(29);
        await h.up(29);
      };
      for (let i = 0; i < 8; i++) await stroke();
      expect(screen.queryByText("Enough.")).toBeNull();
      for (let i = 0; i < 4; i++) await tap();
      expect(screen.queryByText("Enough.")).toBeNull();
      await tap();
      expect(screen.getByText("Enough.")).toBeTruthy();
      // Sulking, a hand gets no purr.
      await h.down(10);
      await h.rub(40);
      await act(async () => {
        jest.advanceTimersByTime(PET.settle + 100);
      });
      expect(screen.queryByTestId("cat-purr")).toBeNull();
      await h.up(40);
      // A while later it lets you stroke it again.
      await act(async () => {
        jest.advanceTimersByTime(3200);
      });
      await h.down(10);
      await act(async () => {
        jest.advanceTimersByTime(PET.settle + 100);
      });
      expect(screen.getByTestId("cat-purr")).toBeTruthy();
      await h.up(10);
      await view.unmount();
    } finally {
      jest.useRealTimers();
    }
  });

  it("thinks with its eyes on what it's told to look at, quietly (no mark)", async () => {
    const x = makeMutable(0.5), y = makeMutable(0.4);
    const view = await render(
      <PeekingCat width={60} beamX={x} beamY={y} frame={null} mood="thinking" lookAt={{ x: -60, y: 170, from: "cat", quiet: true, track: { speed: 24, span: 140 } }} />,
    );
    expect(screen.getAllByText("?")).toHaveLength(3);
    expect(screen.queryByTestId("v2-cat-point")).toBeNull();
    await view.unmount();
  });
});

describe("SittingCat", () => {
  it("purrs when stroked, as a button a screen reader can pet", async () => {
    jest.useFakeTimers();
    try {
      const view = await render(<SittingCat width={100} label="The black cat, on the window sill" />);
      const cat = screen.getByRole("button", { name: "The black cat, on the window sill. Pet the cat" });
      const h = hand();
      await h.down(30, 60);
      await h.rub(60, 60);
      expect(screen.getByTestId("cat-purr")).toBeTruthy();
      await h.up(60, 60);
      expect(screen.queryByTestId("cat-purr")).toBeNull();
      await fireEvent(cat, "accessibilityAction", { nativeEvent: { actionName: "activate" } });
      expect(screen.getByTestId("cat-purr")).toBeTruthy();
      await view.unmount();
    } finally {
      jest.useRealTimers();
    }
  });

  it("draws its tail as one image on a strip of triangles along its centre line, behind the body; still under reduced motion", async () => {
    const view = await render(<ThemeProvider reducedMotion><SittingCat width={100} /></ThemeProvider>);
    // Behind the body: drawn before the body's image (the art less its tail).
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf("sitting-cat-tail")).toBeGreaterThan(-1);
    expect(tree.indexOf("sitting-cat-tail")).toBeLessThan(tree.indexOf("cat_sit_body"));
    const mesh = screen.container.queryAll((node) => (node.type as unknown) === "SkiaVertices")[0];
    const n = TAIL.segments;
    expect(n).toBeGreaterThanOrEqual(24);
    expect(mesh.props.textures).toHaveLength(2 * (n + 1));
    expect(mesh.props.indices).toHaveLength(6 * n);
    expect(mesh.props.mode).toBe("triangles");
    expect(screen.container.queryAll((node) => (node.type as unknown) === "SkiaImageShader")[0].props.image).toBeTruthy();
    // Still: the strip lies as the art does (the image maps onto itself).
    expect(mesh.props.vertices.value).toEqual(mesh.props.textures);
    await view.unmount();
  });

  it("bends its tail smoothly from the base: every segment keeps its length (the fur never stretches) and the base stays put under the body", () => {
    const n = TAIL.segments;
    // The centre line's points an equal arc apart, as the art's tail lies.
    for (let i = 0; i < n; i++) {
      const [a, b] = [TAIL.points[i], TAIL.points[i + 1]];
      expect(Math.hypot(b[0] - a[0], b[1] - a[1])).toBeCloseTo(TAIL.step, 0);
    }
    const centre = (v: { x: number; y: number }[], i: number) => {
      const [l, r] = [TAIL.left[i], TAIL.right[i]];
      return { x: (v[2 * i].x * r + v[2 * i + 1].x * l) / (l + r), y: (v[2 * i].y * r + v[2 * i + 1].y * l) / (l + r) };
    };
    const rest = bendTail(Array.from({ length: n }, () => 0));
    const bent = bendTail(tailBends(1.3, 1, 0.5, 0.8));
    for (let i = 0; i < n; i++) {
      const [a, b] = [centre(bent, i), centre(bent, i + 1)];
      expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeCloseTo(Math.hypot(TAIL.points[i + 1][0] - TAIL.points[i][0], TAIL.points[i + 1][1] - TAIL.points[i][1]), 3);
    }
    // The base (under the haunch) barely moves; the tip moves most.
    const moved = (i: number) => Math.hypot(centre(bent, i).x - centre(rest, i).x, centre(bent, i).y - centre(rest, i).y);
    expect(moved(0)).toBeCloseTo(0, 6);
    expect(moved(2)).toBeLessThan(1);
    expect(moved(n)).toBeGreaterThan(20);
    expect(moved(n / 4)).toBeLessThan(moved(n) / 3);
  });

  it("swishes its tail as a cat does: a wave running up it, the tip bending most and trailing, curling more when content, and flicks", () => {
    const n = TAIL.segments;
    const RAD = Math.PI / 180;
    const total = (b: number[], to = n) => b.slice(0, to).reduce((sum, v) => sum + v, 0) / RAD;
    // The swing at the base's end and the tip over a sweep: the base barely, the tip most.
    const sweep = Array.from({ length: 64 }, (_, k) => tailBends((k / 64) * Math.PI * 2, 1, 0, 0));
    const swing = (to: number) => Math.max(...sweep.map((b) => Math.abs(total(b, to))));
    expect(swing(3)).toBeLessThan(1);
    expect(swing(n)).toBeGreaterThan(15);
    expect(swing(n)).toBeLessThanOrEqual(SWISH.wave);
    // It runs up the tail: the base's bend peaks before the tip's.
    const peak = (i: number) => sweep.reduce((best, b, k) => (b[i] > sweep[best][i] ? k : best), 0);
    expect(peak(n - 1)).toBeGreaterThan(peak(0));
    // A content curl and a flick bend the tip, by their totals.
    expect(total(tailBends(0, 0, 1, 0))).toBeCloseTo(SWISH.curl, 0);
    expect(total(tailBends(0, 0, 0, 1))).toBeCloseTo(SWISH.flick, 0);
    expect(total(tailBends(0, 0, 1, 0), n / 2)).toBeLessThan(SWISH.curl * 0.1);
    // Cross, it thrashes much faster than its lazy sweep; content, slower.
    expect(SWISH.cross.speed).toBeGreaterThan(SWISH.sweep.speed * 3);
    expect(SWISH.content.speed).toBeLessThan(SWISH.sweep.speed);
  });
});

describe("useCatCues", () => {
  const box = { x: 0.2, y: 0.3, w: 0.2, h: 0.2 };
  const def = {
    objects: [
      { id: "desk", label: "desk", photo_index: 0, box, archetype: "Drawer", controls: [] },
      { id: "lamp", label: "lamp", photo_index: 1, box, archetype: "Light", controls: [] },
    ],
  } as unknown as RoomDefinitionV2;
  const state = { objects: {}, items: {}, inventory: [], solved: [], fired: [], cards: [], seen: [], overlays: [], completed: false } as PlayState;
  const frame = { x: 0, y: 100, width: 390, height: 600 };

  it("scolds a third wrong answer in a row and perks up once per thing", async () => {
    const react = jest.fn();
    const { result } = await renderHook(() => useCatCues({ def, state, view: 0, photos: 2, frame, watching: true, cooldown: 0, contents: {}, react }));
    await act(async () => {
      result.current.wrong();
      result.current.wrong();
    });
    expect(result.current.say).toBeNull();
    await act(async () => result.current.wrong());
    expect(result.current.say).toMatchObject({ text: "Think. Don't guess.", rule: true });
    await act(async () => {
      result.current.hover("desk");
      result.current.hover("desk");
    });
    expect(react).toHaveBeenCalledTimes(1);
    expect(react).toHaveBeenCalledWith(expect.objectContaining({ kind: "warm" }));
  });

  it("glances at what hasn't been looked at when the player is stuck", async () => {
    jest.useFakeTimers();
    try {
      const { result, rerender } = await renderHook((p: { view: number; seen: string[] }) => useCatCues({
        def, state: { ...state, seen: p.seen }, view: p.view, photos: 2, frame, watching: true, cooldown: 0, contents: {}, react: () => {},
      }), { initialProps: { view: 0, seen: [] } });
      expect(result.current.lookAt).toBeNull();
      await act(async () => {
        jest.advanceTimersByTime(47000);
      });
      // The desk, on this view: its middle, in window points.
      expect(result.current.lookAt?.x).toBeCloseTo(0.3 * 390);
      expect(result.current.lookAt?.y).toBeCloseTo(100 + 0.4 * 600);
      // The desk looked at: progress ends the glance; stuck again, it looks toward the lamp's side.
      await rerender({ view: 0, seen: ["desk"] });
      expect(result.current.lookAt).toBeNull();
      await act(async () => {
        jest.advanceTimersByTime(47000);
      });
      // The turn arrow's height (the photo's middle), on the right (the nearer way round, ties go forward).
      expect(result.current.lookAt?.y).toBe(400);
      expect(result.current.lookAt!.x).toBeGreaterThan(195);
    } finally {
      jest.useRealTimers();
    }
  });

  it("with everything looked at and the case open, glances at the way out (or its arrow), saying so now and then", async () => {
    jest.useFakeTimers();
    const random = jest.spyOn(Math, "random").mockReturnValue(0);
    try {
      const withDoor = {
        objects: [...def.objects, { id: "door", label: "door", photo_index: 1, box: { x: 0.6, y: 0.2, w: 0.2, h: 0.6 }, archetype: "Door", controls: [], exit: true }],
      } as unknown as RoomDefinitionV2;
      const { result, rerender } = await renderHook((p: { view: number }) => useCatCues({
        def: withDoor, state: { ...state, seen: ["desk", "lamp", "door"] }, view: p.view, photos: 2, frame, watching: true, cooldown: 0, contents: {}, react: () => {},
      }), { initialProps: { view: 1 } });
      await act(async () => {
        jest.advanceTimersByTime(47000);
      });
      // The door, on this view; the first glance says where.
      expect(result.current.lookAt?.x).toBeCloseTo(0.7 * 390);
      expect(result.current.lookAt?.line).toBe("Over there.");
      // On the other view: the arrow toward it.
      await rerender({ view: 0 });
      expect(result.current.lookAt?.y).toBe(400);
      expect(result.current.lookAt?.line).toBe("That way.");
      // The glance after (12.5 s on, with no jitter): no word.
      await act(async () => {
        jest.advanceTimersByTime(12000);
      });
      expect(result.current.lookAt).not.toBeNull();
      expect(result.current.lookAt?.line).toBeUndefined();
    } finally {
      random.mockRestore();
      jest.useRealTimers();
    }
  });
});

// The cat at play: the light held near it is a laser pointer (a crouch, the butt wiggle, a pounce; pleased, or embarrassed after a
// miss), rare (a cooldown) and cut short by anything that happens; it grooms now and then, stretches and yawns when the player is
// back, and a gentle rub gets a happy slow blink. A hint walks paw prints to what it names. Its outfit is read from the device.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, render, renderHook, screen } from "@testing-library/react-native";
import { createGestureController } from "react-native-gesture-handler/jest-utils";
import { makeMutable } from "react-native-reanimated";
import type { ObjectDef } from "@/engine/v2";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { LASER, caught, initialLaser, laserTick } from "../cat/laser";
import { CAT_ACCESSORY_KEY, parseCatAccessory, setCatAccessory, useCatAccessory } from "../catAccessory";
import { HintTrail, TRAIL, hintTarget, trailPrints } from "../PawTrail";
import { PET, PeekingCat } from "../PeekingCat";
import { SittingCat } from "../SittingCat";

// The cat's box measures at (0, 700) in the window: its head is about (38, 742).
jest.mock("@/render/PickupFlight", () => ({
  ...jest.requireActual("@/render/PickupFlight"),
  measureInWindow: () => Promise.resolve({ x: 0, y: 700, width: 100, height: 75 }),
}));

const frame = { x: 0, y: 0, width: 390, height: 700 };
const step = (ms: number) => act(async () => {
  jest.advanceTimersByTime(ms);
});

describe("laser play: when", () => {
  const cat = { x: 100, y: 700 };
  const run = (samples: [number, number][], ready = true, from = initialLaser(), t0 = 0) => {
    let s = from, started = -1;
    samples.forEach(([x, y], i) => {
      const r = laserTick(s, x, y, t0 + i * 100, cat, ready);
      s = r.state;
      if (r.start && started < 0) started = i;
    });
    return { s, started };
  };
  const hold = (x: number, y: number, n: number): [number, number][] => [[x + 20, y], ...Array.from({ length: n }, () => [x, y] as [number, number])];

  it("pounces once the light has dwelt near it a moment, still or drawn slowly past", () => {
    expect(run(hold(150, 650, 12)).started).toBe(10);
    // Slowly past (10 pt a sample: 100 pt/s).
    expect(run(Array.from({ length: 14 }, (_, i) => [40 + i * 10, 640] as [number, number])).started).toBeGreaterThan(0);
  });

  it("never for a light far off, racing by, never moved, or while it's busy", () => {
    expect(run(hold(300, 300, 20)).started).toBe(-1);
    expect(run(Array.from({ length: 20 }, (_, i) => [i % 2 ? 40 : 200, 650] as [number, number])).started).toBe(-1);
    expect(run(Array.from({ length: 20 }, () => [150, 650] as [number, number])).started).toBe(-1);
    expect(run(hold(150, 650, 20), false).started).toBe(-1);
  });

  it("is a treat: not again until the cooldown has run and the light has moved again", () => {
    const first = run(hold(150, 650, 12));
    // Held there on and on: nothing more.
    const after = run(Array.from({ length: 30 }, () => [150, 650] as [number, number]), true, first.s, 1200);
    expect(after.started).toBe(-1);
    // Moved, but within the cooldown: nothing.
    expect(run(hold(160, 650, 12), true, first.s, 5000).started).toBe(-1);
    // After it: again.
    expect(run(hold(160, 650, 12), true, first.s, LASER.cooldown + 2000).started).toBeGreaterThan(5);
  });

  it("catches a light that stayed put (mostly), misses one that moved", () => {
    expect(caught({ x: 0, y: 0 }, { x: 10, y: 5 }, 0.1)).toBe(true);
    expect(caught({ x: 0, y: 0 }, { x: 10, y: 5 }, 0.9)).toBe(false);
    expect(caught({ x: 0, y: 0 }, { x: 80, y: 5 }, 0)).toBe(false);
  });
});

describe("PeekingCat at play", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  /** The light brought near its head (window points), then held. */
  const near = async (x: ReturnType<typeof makeMutable<number>>) => {
    await step(600);
    x.set(0.2);
    await step(100);
    x.set(0.18);
  };

  it("crouches, wiggles and pounces on a light held near it: caught, pleased with itself", async () => {
    jest.spyOn(Math, "random").mockReturnValue(0);
    const x = makeMutable(0.5), y = makeMutable(0.95);
    const view = await render(<PeekingCat width={58} beamX={x} beamY={y} frame={frame} playful />);
    expect(screen.getByTestId("cat-tail")).toBeTruthy();
    expect(screen.queryByTestId("cat-swipe")).toBeNull();
    await near(x);
    await step(1200);
    // At play: its paws cut out of the art (the swat's swipe ready).
    expect(screen.getByTestId("cat-swipe")).toBeTruthy();
    await step(2600);
    expect(screen.getByText("Got it.")).toBeTruthy();
    await step(3000);
    expect(screen.queryByTestId("cat-swipe")).toBeNull();
    await view.unmount();
  });

  it("misses a light whisked away, and looks embarrassed", async () => {
    jest.spyOn(Math, "random").mockReturnValue(0);
    const x = makeMutable(0.5), y = makeMutable(0.95);
    const view = await render(<PeekingCat width={58} beamX={x} beamY={y} frame={frame} playful />);
    await near(x);
    await step(1500);
    x.set(0.3);
    await step(2600);
    expect(screen.getByText("Meant to do that.")).toBeTruthy();
    await view.unmount();
  });

  it("not off the ledge, and anything that happens cuts it short", async () => {
    jest.spyOn(Math, "random").mockReturnValue(0);
    const x = makeMutable(0.5), y = makeMutable(0.95);
    const off = await render(<PeekingCat width={58} beamX={x} beamY={y} frame={frame} />);
    await near(x);
    await step(1500);
    expect(screen.queryByTestId("cat-swipe")).toBeNull();
    await off.unmount();

    x.set(0.5);
    const view = await render(<PeekingCat width={58} beamX={x} beamY={y} frame={frame} playful />);
    await near(x);
    await step(1300);
    expect(screen.getByTestId("cat-swipe")).toBeTruthy();
    await view.rerender(<PeekingCat width={58} beamX={x} beamY={y} frame={frame} playful reaction={{ kind: "found", at: 1 }} />);
    await step(4000);
    expect(screen.queryByText("Got it.")).toBeNull();
    expect(screen.queryByTestId("cat-swipe")).toBeNull();
    await view.unmount();
  });

  it("under reduced motion, only its eyes play: no tail, no paws, nothing said", async () => {
    jest.spyOn(Math, "random").mockReturnValue(0);
    const x = makeMutable(0.5), y = makeMutable(0.95);
    const view = await render(<ThemeProvider reducedMotion><PeekingCat width={58} beamX={x} beamY={y} frame={frame} playful /></ThemeProvider>);
    expect(screen.queryByTestId("cat-tail")).toBeNull();
    await near(x);
    await step(5000);
    expect(screen.queryByTestId("cat-swipe")).toBeNull();
    expect(screen.queryByText("Got it.")).toBeNull();
    await view.unmount();
  });

  it("grooms now and then, never often", async () => {
    jest.spyOn(Math, "random").mockReturnValue(0);
    const x = makeMutable(0.5), y = makeMutable(0.4);
    const view = await render(<PeekingCat width={58} beamX={x} beamY={y} frame={frame} />);
    // Not in its first moments.
    await step(30000);
    expect(screen.queryByTestId("cat-swipe")).toBeNull();
    // A while on: a paw up (licked: its tongue out).
    let groomed = false;
    for (let t = 0; t < 14000 && !groomed; t += 250) {
      await step(250);
      groomed = !!screen.queryByTestId("cat-swipe");
    }
    expect(groomed).toBe(true);
    await step(4000);
    expect(screen.queryByTestId("cat-swipe")).toBeNull();
    await view.unmount();
  });

  it("stretches and yawns when the light moves again after it dozed off", async () => {
    jest.spyOn(Math, "random").mockReturnValue(0.99);
    const x = makeMutable(0.5), y = makeMutable(0.4);
    const view = await render(<PeekingCat width={58} beamX={x} beamY={y} frame={frame} />);
    await step(72000);
    expect(screen.getAllByText("z")).toHaveLength(2);
    x.set(0.6);
    await step(500);
    expect(screen.queryAllByText("z")).toHaveLength(0);
    // The yawn uses its paws (a stretch out).
    expect(screen.getByTestId("cat-swipe")).toBeTruthy();
    await step(3000);
    expect(screen.queryByTestId("cat-swipe")).toBeNull();
    await view.unmount();
  });

  it("stretches and yawns when the player comes back to the light after a long while, awake", async () => {
    jest.spyOn(Math, "random").mockReturnValue(0.99);
    const x = makeMutable(0.5), y = makeMutable(0.4);
    const view = await render(<PeekingCat width={58} beamX={x} beamY={y} frame={frame} playful />);
    await step(20000);
    x.set(0.55);
    await step(300);
    // Back soon: nothing.
    expect(screen.queryByTestId("cat-swipe")).toBeNull();
    await step(64000);
    x.set(0.6);
    await step(300);
    expect(screen.getByTestId("cat-swipe")).toBeTruthy();
    await view.unmount();
  });

  it("gives a happy slow blink after a gentle rub, not after a quick one", async () => {
    const x = makeMutable(0.5), y = makeMutable(0.4);
    const view = await render(<PeekingCat width={58} beamX={x} beamY={y} frame={null} />);
    const c = createGestureController("cat-rub");
    const touch = async (velocityX: number) => {
      await act(async () => {
        c.begin({ x: 10, y: 30 });
        jest.advanceTimersByTime(1);
      });
      await act(async () => {
        c.activate({ x: 12, y: 30 });
        jest.advanceTimersByTime(1);
      });
      for (let i = 0; i < 8; i++) {
        await act(async () => {
          c.update({ x: 12 + i * 4, y: 30, velocityX });
          jest.advanceTimersByTime(PET.gentle / 7);
        });
      }
      await act(async () => {
        c.end({ x: 44, y: 30 });
        jest.advanceTimersByTime(1);
      });
    };
    await touch(2400);
    expect(screen.queryByTestId("cat-happy")).toBeNull();
    await touch(120);
    expect(screen.getByTestId("cat-happy")).toBeTruthy();
    await view.unmount();
  });
});

describe("paw prints to a hint", () => {
  const objects = [
    { id: "desk", label: "desk", photo_index: 0, box: { x: 0.6, y: 0.2, w: 0.2, h: 0.2 } },
    { id: "lamp", label: "brass lamp", photo_index: 0, box: { x: 0.1, y: 0.1, w: 0.1, h: 0.1 } },
    { id: "safe", label: "safe", photo_index: 1, box: { x: 0.4, y: 0.4, w: 0.2, h: 0.2 } },
  ] as unknown as ObjectDef[];

  it("finds what a hint names: the thing to do over the thing that helps, never part of a word", () => {
    expect(hintTarget("Take a closer look at the desk.", objects)).toBe("desk");
    expect(hintTarget("With the brass lamp on, inspect the desk.", objects)).toBe("desk");
    expect(hintTarget("Look at the desk while the brass lamp is on.", objects, ["desk", "lamp"])).toBe("desk");
    expect(hintTarget("Switch on the brass lamp.", objects)).toBe("lamp");
    expect(hintTarget("Some things here are meant to be read.", objects)).toBeNull();
    expect(hintTarget("Somebody was unsafe here.", objects)).toBeNull();
  });

  it("steps from the cat to it in a gentle arc, left, right, left, ending short of it", () => {
    const from = { x: 100, y: 700 }, to = { x: 300, y: 200 };
    const prints = trailPrints(from, to);
    expect(prints.length).toBeGreaterThanOrEqual(TRAIL.min);
    expect(prints.length).toBeLessThanOrEqual(TRAIL.max);
    const d = (p: { x: number; y: number }, q: { x: number; y: number }) => Math.hypot(p.x - q.x, p.y - q.y);
    expect(d(prints[0], from)).toBeGreaterThan(TRAIL.clear - TRAIL.sway - 1);
    expect(d(prints[prints.length - 1], to)).toBeLessThan(TRAIL.short + TRAIL.sway + 2);
    // Each nearer than the last.
    for (let i = 1; i < prints.length; i++) expect(d(prints[i], to)).toBeLessThan(d(prints[i - 1], to));
    // Pointing the way it goes (up and to the right: between 0 and 90 degrees, give or take its splay).
    for (const p of prints) expect(p.angle).toBeGreaterThan(-20);
    // Too close: no trail.
    expect(trailPrints(from, { x: 120, y: 680 })).toHaveLength(0);
  });

  it("walks there once the room is back in view, with that thing on the photo; and only once", async () => {
    jest.useFakeTimers();
    try {
      const hint = { text: "Take a closer look at the desk.", at: Date.now() };
      const props = { objects, seen: [], view: 0, frame, head: { x: 40, y: 740 }, origin: { x: 0, y: 0 } };
      const view = await render(<HintTrail hint={hint} {...props} watching={false} />);
      await step(600);
      expect(screen.queryByTestId("v2-paw-trail", { includeHiddenElements: true })).toBeNull();
      await view.rerender(<HintTrail hint={hint} {...props} watching />);
      await step(600);
      expect(screen.getByTestId("v2-paw-trail", { includeHiddenElements: true })).toBeTruthy();
      await step(6000);
      expect(screen.queryByTestId("v2-paw-trail", { includeHiddenElements: true })).toBeNull();
      // Nothing it names on this photo: nothing.
      await view.rerender(<HintTrail hint={{ text: "Open the safe.", at: Date.now() }} {...props} watching />);
      await step(600);
      expect(screen.queryByTestId("v2-paw-trail", { includeHiddenElements: true })).toBeNull();
      await view.unmount();
    } finally {
      jest.useRealTimers();
    }
  });
});

describe("the cat's outfit", () => {
  afterEach(async () => {
    await AsyncStorage.clear();
    await setCatAccessory("none");
  });

  it("reads exactly the kept choice (anything else is none)", () => {
    expect(parseCatAccessory("beret")).toBe("beret");
    expect(parseCatAccessory("crown")).toBe("none");
    expect(parseCatAccessory(null)).toBe("none");
  });

  it("is put on both cats from the device, and changes at once when picked", async () => {
    await AsyncStorage.setItem(CAT_ACCESSORY_KEY, "bow");
    const { result } = await renderHook(() => useCatAccessory());
    await act(async () => {});
    expect(result.current).toBe("bow");
    const x = makeMutable(0.5), y = makeMutable(0.4);
    const view = await render(<><PeekingCat width={58} beamX={x} beamY={y} frame={null} /><SittingCat width={100} label="The black cat" /></>);
    await act(async () => {});
    expect(screen.getAllByTestId("cat-outfit-bow", { includeHiddenElements: true })).toHaveLength(2);
    expect(screen.getByLabelText("A black cat in a bow watches your light")).toBeTruthy();
    await act(async () => setCatAccessory("flowers"));
    expect(screen.getAllByTestId("cat-outfit-flowers", { includeHiddenElements: true })).toHaveLength(2);
    expect(screen.getByRole("button", { name: "The black cat, in a flower crown. Pet the cat" })).toBeTruthy();
    await view.unmount();
  });
});

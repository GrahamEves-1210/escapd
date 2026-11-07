// The cat mounts with its eyes and lids, takes a find and a wrong answer, thinks with "?"s, and dozes off when the light is still (long after a stuck glance would come).
// It never says a word: guessing gets a slow blink and a huff, and it glances where it's told (a mark on that side, now and then a paw that way; thinking, quietly).
// Stroked it purrs (no heart), a screen reader can pet it or rub it, and rough quick taps (never stroking) are too much. The sitting cat purrs too.
// Its cues: a huff after three wrong answers in a row, a perk once per thing the light finds, glances when the player is stuck (at the way out once everything's been looked at).
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react-native";
import { createGestureController } from "react-native-gesture-handler/jest-utils";
import { makeMutable } from "react-native-reanimated";
import type { PlayState, RoomDefinitionV2 } from "@/engine/v2";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { PET, PeekingCat, pupilRoom } from "../PeekingCat";
import { SittingCat, TAIL, WHIP, bendTail, restTail, stepTail, tailBends, type TailMood, type TailState } from "../SittingCat";
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

  it("never says a word: guessing gets a huff from its nose, an empty find a yawn", async () => {
    jest.useFakeTimers();
    try {
      const x = makeMutable(0.5), y = makeMutable(0.4);
      const view = await render(<PeekingCat width={58} beamX={x} beamY={y} frame={null} reaction={{ kind: "empty", at: 1 }} />);
      expect(screen.queryByTestId("cat-huff")).toBeNull();
      await view.rerender(<PeekingCat width={58} beamX={x} beamY={y} frame={null} reaction={{ kind: "guess", at: 2 }} waiting />);
      expect(screen.getByTestId("cat-huff")).toBeTruthy();
      await act(async () => {
        jest.advanceTimersByTime(3000);
      });
      expect(screen.queryByTestId("v2-cat-speech")).toBeNull();
      await view.unmount();
      // Under reduced motion its slow blink says it: no puffs.
      const still = await render(<ThemeProvider reducedMotion><PeekingCat width={58} beamX={x} beamY={y} frame={null} reaction={{ kind: "guess", at: 3 }} /></ThemeProvider>);
      expect(screen.queryByTestId("cat-huff")).toBeNull();
      await still.unmount();
    } finally {
      jest.useRealTimers();
    }
  });

  it("glances where it's told, with a \"!\" (or a \"?\" when it wonders) and now and then a paw that way", async () => {
    jest.useFakeTimers();
    try {
      const x = makeMutable(0.5), y = makeMutable(0.4);
      const frame = { x: 0, y: 100, width: 390, height: 600 };
      const view = await render(<PeekingCat width={58} beamX={x} beamY={y} frame={frame} lookAt={{ x: 300, y: 200, wonder: true }} />);
      expect(screen.getAllByText("?")).toHaveLength(1);
      await act(async () => {
        jest.advanceTimersByTime(600);
      });
      // Just its eyes and a lean: its paws stay in the art.
      expect(screen.queryByTestId("cat-swipe")).toBeNull();
      await view.rerender(<PeekingCat width={58} beamX={x} beamY={y} frame={frame} lookAt={null} />);
      expect(screen.queryAllByText("?")).toHaveLength(0);
      // The next glance: an "!", and a paw patting the ledge that way (cut out of the art for it), never a word.
      await view.rerender(<PeekingCat width={58} beamX={x} beamY={y} frame={frame} lookAt={{ x: 20, y: 400, paw: true }} />);
      expect(screen.getByTestId("v2-cat-point")).toHaveTextContent("!");
      await act(async () => {
        jest.advanceTimersByTime(600);
      });
      expect(screen.getByTestId("cat-swipe")).toBeTruthy();
      expect(screen.queryByTestId("v2-cat-speech")).toBeNull();
      await act(async () => {
        jest.advanceTimersByTime(3000);
      });
      expect(screen.queryByTestId("cat-swipe")).toBeNull();
      await view.unmount();
    } finally {
      jest.useRealTimers();
    }
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
      expect(screen.queryByTestId("cat-huff")).toBeNull();
      for (let i = 0; i < 4; i++) await tap();
      expect(screen.queryByTestId("cat-huff")).toBeNull();
      await tap();
      // Had enough: a huff (and not a word).
      expect(screen.getByTestId("cat-huff")).toBeTruthy();
      expect(screen.queryByTestId("v2-cat-speech")).toBeNull();
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

  it("keeps its pupils inside its irises, whichever way they look and however open", () => {
    // A tilted iris, 6 by 5 points (half sizes), as the art's.
    const eye = { cx: 0, cy: 0, a: 6, b: 5, tilt: 32 };
    const inside = (x: number, y: number) => {
      const t = (eye.tilt * Math.PI) / 180;
      const u = (x * Math.cos(t) + y * Math.sin(t)) / eye.a, v = (-x * Math.sin(t) + y * Math.cos(t)) / eye.b;
      return u * u + v * v <= 1.0001;
    };
    for (const [hw, hh] of [[0.6, 3.5], [2.5, 4], [4.2, 4.2]]) {
      for (let k = 0; k < 16; k++) {
        const q = (k / 16) * Math.PI * 2;
        const [ux, uy] = [Math.cos(q), Math.sin(q)];
        const d = pupilRoom(eye, ux, uy, hw, hh, 0.9);
        for (let i = 0; i < 24; i++) {
          const p = (i / 24) * Math.PI * 2;
          expect(inside(ux * d + Math.cos(p) * hw, uy * d + Math.sin(p) * hh)).toBe(true);
        }
      }
    }
    // A slit has room to look sideways, little up or down.
    expect(pupilRoom(eye, 1, 0, 0.6, 3.5, 0.9)).toBeGreaterThan(2 * pupilRoom(eye, 0, 1, 0.6, 3.5, 0.9));
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
    const rest = bendTail(Array.from({ length: n }, () => 0));
    const bent = bendTail(tailBends([0.05, 0.4, 0.7, 0.9, 1.2, 1.4]));
    for (let i = 0; i < n; i++) {
      const [a, b] = [centre(bent, i), centre(bent, i + 1)];
      expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeCloseTo(Math.hypot(TAIL.points[i + 1][0] - TAIL.points[i][0], TAIL.points[i + 1][1] - TAIL.points[i][1]), 3);
    }
    // The base (under the haunch) barely moves; the tip moves most.
    const moved = (i: number) => Math.hypot(centre(bent, i).x - centre(rest, i).x, centre(bent, i).y - centre(rest, i).y);
    expect(moved(0)).toBeCloseTo(0, 6);
    expect(moved(2)).toBeLessThan(1);
    expect(moved(n)).toBeGreaterThan(50);
    expect(moved(n / 4)).toBeLessThan(moved(n) / 5);
    // The bends add up to the joints' turns, smoothly (no segment turns much more than its neighbours).
    const bends = tailBends([0.05, 0.4, 0.7, 0.9, 1.2, 1.4]);
    expect(bends.reduce((sum, v) => sum + v, 0)).toBeCloseTo(1.4, 1);
    for (let i = 1; i < n; i++) expect(Math.abs(bends[i] - bends[i - 1])).toBeLessThan(0.05);
  });

  it("whips like a cat's tail: a flick is out and back in well under half a second, running up it late, the tip cracking past and snapping back", () => {
    // A flick from rest (no wave, no twitch, nothing else due): each joint's turn at 120 frames a second.
    const f = WHIP.flick;
    let st: TailState = {
      ...restTail(), wa: 0, waGoal: 0, curlGoal: 0, next: 1e9, twitchAt: 1e9,
      goal: f.to, omega: f.omega, back: f.hold, backGoal: 0, backOmega: f.back,
    };
    const tip = WHIP.joints.length - 1;
    const track: number[][] = [];
    for (let k = 0; k < 240; k++) {
      const r = stepTail(st, 0, 1 / 120, () => 0.5);
      st = r.state;
      track.push(r.joints);
    }
    const peakAt = (j: number) => track.reduce((best, v, k) => (v[j] > track[best][j] ? k : best), 0);
    // Out fast at the base (its peak inside a quarter second), running up the tail late: the tip turns furthest
    // after it, then cracks back past rest, all inside 0.7 s.
    expect(peakAt(1) / 120).toBeLessThan(0.25);
    expect(peakAt(tip)).toBeGreaterThan(peakAt(1) + 12);
    expect(peakAt(tip) / 120).toBeLessThan(0.55);
    const back = track.findIndex((v, k) => k > peakAt(tip) && v[tip] < 0);
    expect(back).toBeGreaterThan(0);
    expect(back / 120).toBeLessThan(0.7);
    // The crack: the tip swings past rest the other way, by a good deal (the base barely does), and settles.
    const under = (j: number) => Math.min(...track.map((v) => v[j]));
    expect(-under(tip)).toBeGreaterThan(0.25 * track[peakAt(tip)][tip]);
    expect(-under(tip)).toBeGreaterThan(-under(0) * 3);
    expect(Math.abs(track[track.length - 1][tip])).toBeLessThan(0.05);
    // Fast: the tip turns well over 10 radians a second at its quickest.
    const fastest = Math.max(...track.slice(1).map((v, k) => Math.abs(v[tip] - track[k][tip]) * 120));
    expect(fastest).toBeGreaterThan(10);
    // The floor part barely turns at all.
    expect(Math.max(...track.map((v) => Math.abs(v[0])))).toBeLessThan(0.12);
  });

  it("snakes: at rest a wave runs up it from base to tip (the tip lagging), in an S, never quite repeating", () => {
    let st: TailState = { ...restTail(), wa: WHIP.wave.amp.calm, next: 1e9, twitchAt: 1e9, goal: 0.2, sweep: 0.2 };
    const track: number[][] = [];
    for (let k = 0; k < 60 * 20; k++) {
      const r = stepTail(st, 0, 1 / 60, () => 0.5);
      st = r.state;
      track.push(r.joints.map((v, j) => v - (j ? r.joints[j - 1] : 0)));
    }
    // Each joint's own bend, after the first seconds: the ones above follow the ones below late (a travelling wave):
    // the lag that best lines a higher joint's bend up with a lower one's is later the higher it is.
    const from = 60 * 4;
    const lag = (a: number, b: number) => {
      let best = 0, bestK = 0;
      for (let d = 0; d < 90; d++) {
        let c = 0;
        for (let k = from; k < track.length - 90; k++) c += track[k][a] * track[k + d][b];
        if (c > best) {
          best = c;
          bestK = d;
        }
      }
      return bestK;
    };
    expect(lag(1, 3)).toBeGreaterThan(3);
    expect(lag(1, 5)).toBeGreaterThan(lag(1, 3));
    // An S: somewhere its middle bends one way while the top bends the other.
    expect(track.some((v) => Math.sign(v[2]) !== Math.sign(v[4]) && Math.abs(v[2]) > 0.05 && Math.abs(v[4]) > 0.05)).toBe(true);
    // Never quite periodic: the gaps between the tip's peaks differ.
    const peaks: number[] = [];
    for (let k = from + 1; k < track.length - 1; k++) if (track[k][5] > track[k - 1][5] && track[k][5] >= track[k + 1][5] && track[k][5] > 0) peaks.push(k);
    const gaps = peaks.slice(1).map((p, i) => p - peaks[i]);
    expect(gaps.length).toBeGreaterThan(2);
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeGreaterThan(6);
  });

  it("swishes, rests curled, flicks and twitches by itself; never past its canvas, whatever its mood", () => {
    const pad = TAIL.pad;
    const [w, h] = TAIL.size;
    const box = { left: -pad.left * w, top: -pad.top * w, right: w * (1 + pad.right), bottom: h + pad.bottom * w };
    for (const [mood, seed] of [[0, 1], [0, 2], [1, 3], [2, 4]] as [TailMood, number][]) {
      let x = seed;
      const rand = () => {
        x = (x * 1103515245 + 12345) % 2147483648;
        return x / 2147483648;
      };
      let st = restTail();
      const tips: number[] = [];
      let fastest = 0;
      const seen = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity };
      for (let k = 0; k < 60 * (mood === 0 ? 120 : 30); k++) {
        const r = stepTail(st, mood, 1 / 60, rand);
        const prev = st.th[st.th.length - 1];
        st = r.state;
        fastest = Math.max(fastest, Math.abs(st.th[st.th.length - 1] - prev) * 60);
        tips.push(r.joints[r.joints.length - 1]);
        if (k % 3) continue;
        for (const p of bendTail(tailBends(r.joints))) {
          seen.left = Math.min(seen.left, p.x);
          seen.right = Math.max(seen.right, p.x);
          seen.top = Math.min(seen.top, p.y);
          seen.bottom = Math.max(seen.bottom, p.y);
        }
      }
      expect(seen.left).toBeGreaterThan(box.left);
      expect(seen.right).toBeLessThan(box.right);
      expect(seen.top).toBeGreaterThan(box.top);
      expect(seen.bottom).toBeLessThan(box.bottom);
      // It moves (out and in, calm), and a good way.
      const range = (Math.max(...tips) - Math.min(...tips)) / (Math.PI / 180);
      expect(range).toBeGreaterThan(mood === 2 ? 15 : 40);
      // Cross, it thrashes much faster than when calm or content.
      if (mood === 1) expect(fastest).toBeGreaterThan(6);
      if (mood === 2) expect(fastest).toBeLessThan(6);
    }
  });
});

/** The strip's centre line at point i (between its left and right edges). */
function centre(v: { x: number; y: number }[], i: number) {
  const [l, r] = [TAIL.left[i], TAIL.right[i]];
  return { x: (v[2 * i].x * r + v[2 * i + 1].x * l) / (l + r), y: (v[2 * i].y * r + v[2 * i + 1].y * l) / (l + r) };
}

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

  it("huffs at a third wrong answer in a row and perks up once per thing, never saying a word", async () => {
    jest.useFakeTimers();
    try {
      const react = jest.fn();
      const { result } = await renderHook(() => useCatCues({ def, state, view: 0, photos: 2, frame, watching: true, cooldown: 0, contents: {}, react }));
      expect(result.current).not.toHaveProperty("say");
      await act(async () => {
        result.current.wrong();
        result.current.wrong();
        jest.advanceTimersByTime(1000);
      });
      expect(react).not.toHaveBeenCalled();
      await act(async () => {
        result.current.wrong();
        jest.advanceTimersByTime(1000);
      });
      expect(react).toHaveBeenCalledWith(expect.objectContaining({ kind: "guess" }));
      react.mockClear();
      await act(async () => {
        result.current.hover("desk");
        result.current.hover("desk");
      });
      expect(react).toHaveBeenCalledTimes(1);
      expect(react).toHaveBeenCalledWith(expect.objectContaining({ kind: "warm" }));
    } finally {
      jest.useRealTimers();
    }
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

  it("with everything looked at and the case open, glances at the way out (or its arrow), a paw that way now and then", async () => {
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
      // The door, on this view; the first glance points a paw there too.
      expect(result.current.lookAt?.x).toBeCloseTo(0.7 * 390);
      expect(result.current.lookAt?.paw).toBe(true);
      expect(result.current.lookAt).not.toHaveProperty("line");
      // On the other view: the arrow toward it.
      await rerender({ view: 0 });
      expect(result.current.lookAt?.y).toBe(400);
      expect(result.current.lookAt?.paw).toBe(true);
      // The glance after (12.5 s on, with no jitter): eyes only.
      await act(async () => {
        jest.advanceTimersByTime(12000);
      });
      expect(result.current.lookAt).not.toBeNull();
      expect(result.current.lookAt?.paw).toBe(false);
    } finally {
      random.mockRestore();
      jest.useRealTimers();
    }
  });
});

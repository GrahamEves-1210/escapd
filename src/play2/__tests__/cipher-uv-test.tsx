// The cipher wheel's reading of the room (what the player has found), and UV traces: drawn as what they
// are (their attributes unmistakable), writing as its crisp words, and the close-up that is the trace itself.
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { makeMutable } from "react-native-reanimated";
import { StyleSheet } from "react-native";
import { TRACE_HANDS, TRACE_KINDS, TRACE_PATTERNS, TRACE_SIZES, TRACE_STAINS, TRACE_TREADS, type TracePattern, type TraceSize } from "@/engine/v2";
import { Mechanism } from "../mechanisms";
import { CipherContext, cipherClues, decode, settingFor, slotValues, type CipherClues } from "../mechanisms/cipher";
import type { MechanismTarget } from "../mechanisms/types";
import { fingertip, handStyle, lettering, lookOf, mulberry, SOLE_CM, soleArt, traceArt, type Art } from "../traceArt";
import { describeTrace, TraceView } from "../TraceView";
import { tapTrace, traceAt, UvTrace, type StageTrace } from "../UvTrace";

// The shared Skia stand-in, with the beam mask's parts (a rect and a radial gradient) as host views too.
jest.mock("@shopify/react-native-skia", () => {
  const base = jest.requireActual("../../../jest/skia-mock");
  const { createElement } = jest.requireActual("react");
  const host = (name: string) => (props: { children?: unknown }) => createElement(name, props, props.children);
  return { ...base, Rect: host("SkiaRect"), RadialGradient: host("SkiaRadialGradient"), Paint: host("SkiaPaint"), Line: host("SkiaLine") };
});

// A room's cards as the planner writes them (templates), and as the player was shown them.
const CARDS = [
  { id: "card_1", title: "Telegram", text: "Delivered, never opened until now. The whole message: {{cipher_5}}, letters that spell nothing." },
  { id: "card_2", title: "Pocket diary", text: "Every page blank but one, and on it, circled: +{{offset_4}}." },
  { id: "card_3", title: "Decoded note", text: "Line up the ring and the gibberish turns plain: ◆ {{digits_2}}." },
];
const shown = (id: string, text: string) => ({ id, title: CARDS.find((c) => c.id === id)!.title, text });

describe("the cipher", () => {
  it("reads slot values back out of a rendered card", () => {
    expect(slotValues(CARDS[0].text, "Delivered, never opened until now. The whole message: JMQ, letters that spell nothing.")).toEqual({ cipher_5: "JMQ" });
    expect(slotValues(CARDS[0].text, "Something else entirely.")).toBeNull();
  });

  it("decodes as the planner enciphers: letters back by the setting, a code's letters as digits", () => {
    // planner.ts encipher: "47" at +5 is J (4 + 5) and M (7 + 5); "OAK" at +3 is RDN.
    expect(decode("JM", 5, true)).toBe("47");
    expect(decode("RDN", 3, false)).toBe("OAK");
    expect(decode("D:EH", 3, true)).toBe("0:14");
    expect(settingFor("JM", "47", true)).toBe(5);
    expect(settingFor("JM", "48", true)).toBeNull();
  });

  it("knows nothing before the coded card is found; the line once it is; the setting once the note is shown", () => {
    expect(cipherClues(CARDS, [])).toEqual({ coded: null, source: null, numeric: true, solved: null });
    const coded = shown("card_1", "Delivered, never opened until now. The whole message: J, letters that spell nothing.");
    expect(cipherClues(CARDS, [coded])).toMatchObject({ coded: "J", source: "Telegram", numeric: true, solved: null });
    const note = shown("card_3", "Line up the ring and the gibberish turns plain: ◆ 4.");
    expect(cipherClues(CARDS, [coded, note]).solved).toEqual({ offset: 5, reads: "4", note: "◆ 4" });
  });

  it("the wheel shows the coded line and what it reads at the ring's setting, written as the clue writes it", async () => {
    const t: MechanismTarget = { kind: "item", id: "wheel", label: "Cipher wheel", archetype: "Decoder", variant: "wheel", controls: [{ id: "offset", domain: { kind: "offset", max: 25 } }] };
    const clues: CipherClues = { coded: "JM", source: "Telegram", numeric: true, solved: null };
    const onSet = jest.fn();
    const mount = (state: Record<string, string>, c: CipherClues) => (
      <GestureHandlerRootView>
        <CipherContext.Provider value={c}>
          <Mechanism target={t} state={state} onSet={onSet} onSubmit={jest.fn()} busy={false} cooldown={0} width={358} />
        </CipherContext.Provider>
      </GestureHandlerRootView>
    );
    const view = await render(mount({ offset: "1" }, clues));
    expect(screen.getByTestId("mech-decoder-offset")).toHaveTextContent("+1");
    expect(screen.getByTestId("mech-decoder-reads-0")).toHaveTextContent("8");
    await fireEvent(screen.getByLabelText("Cipher ring"), "accessibilityAction", { nativeEvent: { actionName: "increment" } });
    expect(onSet).toHaveBeenLastCalledWith("offset", "2");
    expect(screen.getByTestId("mech-decoder-offset")).toHaveTextContent("+2");
    expect(screen.getByTestId("mech-decoder-reads-0")).toHaveTextContent("7");
    // Set where the note was shown: it reads, stamped.
    await view.rerender(mount({ offset: "5" }, { ...clues, solved: { offset: 5, reads: "47" } }));
    expect(screen.getByTestId("mech-decoder-reads-0")).toHaveTextContent("4");
    expect(screen.getByTestId("mech-decoder-reads-1")).toHaveTextContent("7");
    expect(screen.getByText("It reads")).toBeTruthy();
    await view.unmount();
    // No coded line found yet: an empty slip, nothing written on it (a screen reader is told).
    await render(mount({ offset: "1" }, { coded: null, source: null, numeric: false, solved: null }));
    expect(screen.queryByText(/No coded message yet/)).toBeNull();
    expect(screen.getByLabelText("No coded message yet")).toBeTruthy();
  });
});

const trace = (over: Partial<StageTrace> = {}): StageTrace => ({
  id: "trace_a", label: "Invisible writing", kind: "writing", surface: "wall", seed: 42, box: { x: 0.1, y: 0.4, w: 0.28, h: 0.09 }, revealed: false, ...over,
});
/** Every point of an art's paths. */
const points = (a: Art): [number, number][] => ((a.blot + " " + a.fill + " " + a.lines).match(/[ML]-?[\d.]+ -?[\d.]+/g) ?? []).map((p) => p.slice(1).split(" ").map(Number) as [number, number]);

describe("UV traces: what they look like", () => {
  it("draws each kind as what it is, the same every time, about its box", () => {
    const box = { x: 80, y: 210, w: 120, h: 140 };
    for (const kind of TRACE_KINDS) {
      if (kind === "writing") continue;
      for (const genre of ["noir", "crime_scene", "paranormal"] as const) {
        const t = { kind, surface: kind === "footprints" ? "floor" as const : "wall" as const, seed: 42 };
        const a = traceArt(t, box, genre);
        expect(a).toEqual(traceArt(t, box, genre));
        expect(a.fill + a.lines).not.toBe("");
        for (const [x, y] of points(a)) {
          expect(x).toBeGreaterThan(box.x - 40);
          expect(x).toBeLessThan(box.x + box.w + 40);
          expect(y).toBeGreaterThan(box.y - 40);
          expect(y).toBeLessThan(box.y + box.h + 40);
        }
      }
    }
  });

  it("a room without the attributes draws from its seed; one with them draws them", () => {
    const old = { kind: "footprints" as const, surface: "floor" as const, seed: 7 };
    expect(lookOf(old, "noir")).toEqual(lookOf(old, "noir"));
    expect(lookOf(old, "paranormal").tread).toBe("bare");
    expect(lookOf({ ...old, size: "large", tread: "rings", pattern: "arch", scar: true, stain: "ink", hand: "block" }, "paranormal"))
      .toEqual({ size: "large", tread: "rings", pattern: "arch", scar: true, stain: "ink", hand: "block" });
  });

  it("three sizes of foot are plainly apart, on the photo and against the close-up's scale", () => {
    const box = { x: 0, y: 0, w: 140, h: 140 };
    const span = (size: TraceSize) => {
      const pts = points(soleArt({ kind: "footprints", surface: "floor", seed: 3, size, tread: "bars" }, 100, 200, SOLE_CM[size] * 10, "noir"));
      return Math.max(...pts.map((p) => p[1])) - Math.min(...pts.map((p) => p[1]));
    };
    // The close-up's sole is as long as its centimetres say.
    for (const size of TRACE_SIZES) expect(span(size) / 10).toBeCloseTo(SOLE_CM[size], 0);
    expect(SOLE_CM.medium - SOLE_CM.small).toBeGreaterThanOrEqual(4);
    expect(SOLE_CM.large - SOLE_CM.medium).toBeGreaterThanOrEqual(4);
    // On the photo, each size's prints cover visibly more floor than the one before.
    const area = (size: TraceSize) => {
      const pts = points(traceArt({ kind: "footprints", surface: "floor", seed: 3, size, tread: "bars" }, box, "noir"));
      return (Math.max(...pts.map((p) => p[0])) - Math.min(...pts.map((p) => p[0]))) * (Math.max(...pts.map((p) => p[1])) - Math.min(...pts.map((p) => p[1])));
    };
    expect(area("medium")).toBeGreaterThan(area("small") * 1.1);
    expect(area("large")).toBeGreaterThan(area("medium") * 1.1);
  });

  it("the treads, the ridge patterns, a scar and the stains each draw differently", () => {
    const box = { x: 0, y: 0, w: 140, h: 140 };
    const treads = TRACE_TREADS.map((tread) => traceArt({ kind: "footprints", surface: "floor", seed: 3, size: "medium", tread }, box, "noir").lines);
    expect(new Set(treads).size).toBe(TRACE_TREADS.length);
    // Bare feet have toes and no tread: far fewer lines than a sole.
    const strokes = (lines: string) => (lines.match(/M/g) ?? []).length;
    expect(strokes(treads[TRACE_TREADS.indexOf("bare")])).toBeLessThan(strokes(treads[TRACE_TREADS.indexOf("bars")]));
    const patterns = TRACE_PATTERNS.map((pattern) => traceArt({ kind: "prints", surface: "on", seed: 3, pattern }, box, "noir").lines);
    expect(new Set(patterns).size).toBe(TRACE_PATTERNS.length);
    // A whorl's ridges close round its core; an arch's never do: they run from side to side.
    const tip = (pattern: TracePattern, scar = false) => fingertip(0, 0, 40, 0, pattern, scar, mulberry(5), 4);
    const widest = (lines: string) => Math.max(...lines.split("M").filter(Boolean).map((seg) => {
      const xs = (seg.match(/-?[\d.]+ -?[\d.]+/g) ?? []).map((q) => Number(q.split(" ")[0]));
      return Math.max(...xs) - Math.min(...xs);
    }));
    expect(widest(tip("arch").lines)).toBeGreaterThan(60);
    // A scar is a gap cut across the ridges: none without one, and the ridges are broken into more pieces by it.
    expect(tip("whorl").cut).toBe("");
    expect(tip("whorl", true).cut).not.toBe("");
    expect(strokes(tip("whorl", true).lines)).toBeGreaterThan(strokes(tip("whorl").lines));
    const scarred = traceArt({ kind: "palm", surface: "wall", seed: 3, scar: true }, box, "noir");
    expect(scarred.cut).toBeTruthy();
    const stains = TRACE_STAINS.map((stain) => traceArt({ kind: "stain", surface: "floor", seed: 3, stain }, box, "noir"));
    expect(new Set(stains.map((a) => a.fill + a.lines)).size).toBe(TRACE_STAINS.length);
    expect(new Set(stains.map((a) => a.tint.fill)).size).toBe(TRACE_STAINS.length);
  });

  it("the three hands differ in their letters, and none is lettered smaller than reads on a phone", () => {
    const styles = TRACE_HANDS.map((h) => handStyle(h));
    expect(new Set(styles.map((st) => `${st.text.fontFamily}/${st.upper}/${st.skew}`)).size).toBe(3);
    for (const hand of TRACE_HANDS) {
      for (const text of ["RYE", "Gambling debts?", "You were told to stay away from the house on the hill"]) {
        const at = lettering(text, hand, { x: 33, y: 298, w: 109, h: 62 }, { w: 390, h: 693 });
        // Capitals 14 points tall or more, whatever the box.
        expect(at.size * handStyle(hand).cap).toBeGreaterThanOrEqual(14);
        // Kept on the photo, wrapped when long.
        expect(at.left).toBeGreaterThanOrEqual(8);
        expect(at.left + at.width).toBeLessThanOrEqual(390 - 8);
        if (text.length > 40) expect(at.lines).toBeGreaterThan(1);
      }
    }
  });
});

describe("UV traces: on the photo", () => {
  const tx = makeMutable(0.24), ty = makeMutable(0.44);
  const props = { marks: [], genre: "noir" as const, w: 390, h: 693, tx, ty, r: 100, lampLit: false };

  it("writing is its words the moment they are known, and nothing at all before (no smear)", async () => {
    const view = await render(<UvTrace {...props} traces={[trace()]} uv />);
    expect(screen.queryByLabelText(/Written in invisible ink/)).toBeNull();
    // Nothing stands in for the words: no canvas, no shapes.
    expect(screen.queryByTestId("v2-uv-traces")).toBeNull();
    expect(screen.queryByTestId("v2-uv-writing-trace_a")).toBeNull();
    await view.rerender(<UvTrace {...props} traces={[trace({ revealed: true, mark: "p. 247" })]} uv />);
    expect(screen.getByLabelText("Written in invisible ink: p. 247")).toBeTruthy();
    // The letters themselves: solid, opaque, with no shadow or blur on them.
    const letters = StyleSheet.flatten(screen.getByTestId("v2-uv-letters").props.style);
    expect(letters.color).toBe("#F4EEFF");
    expect(letters.textShadowRadius).toBeUndefined();
    expect(letters.opacity).toBeUndefined();
    expect(letters.fontSize * handStyle(lookOf(trace(), "noir").hand).cap).toBeGreaterThanOrEqual(14);
  });

  it("words that hold no answer are in the definition and need no finding; block capitals are capitals", async () => {
    await render(<UvTrace {...props} traces={[trace({ mark: "Stay away", hand: "block" })]} uv />);
    expect(screen.getByTestId("v2-uv-letters")).toHaveTextContent("STAY AWAY");
  });

  it("in ordinary light, nothing glows", async () => {
    await render(<UvTrace {...props} traces={[trace({ revealed: true, kind: "prints" }), trace({ id: "w", revealed: true, mark: "p. 247" })]} uv={false} />);
    expect(screen.queryByTestId("v2-uv-traces")).toBeNull();
    expect(StyleSheet.flatten(screen.getByTestId("v2-uv-writing-w").props.style).opacity).toBe(0);
  });

  it("a tap under UV on a trace looks at it; on writing whose words haven't come, finds it; never without UV", () => {
    const words = trace({ revealed: true, mark: "p. 247" });
    const unread = trace({ id: "trace_c", box: { x: 0.6, y: 0.6, w: 0.28, h: 0.09 } });
    const prints = trace({ id: "trace_b", kind: "prints", box: { x: 0.6, y: 0.2, w: 0.12, h: 0.09 } });
    const all = [words, unread, prints];
    expect(tapTrace(all, 0.2, 0.44, true)).toEqual({ look: "trace_a" });
    // Shapes are there to be looked at as soon as the light shows them.
    expect(tapTrace(all, 0.65, 0.25, true)).toEqual({ look: "trace_b" });
    expect(tapTrace(all, 0.7, 0.64, true)).toEqual({ find: "trace_c" });
    expect(tapTrace(all, 0.2, 0.44, false)).toBeNull();
    expect(tapTrace(all, 0.95, 0.95, true)).toBeNull();
    // The magnifier's hit-test: what can be seen, the smallest box first.
    expect(traceAt(all, 0.7, 0.64)).toBeNull();
    expect(traceAt([words, { ...words, id: "small", box: { x: 0.15, y: 0.42, w: 0.05, h: 0.03 } }], 0.17, 0.43)?.id).toBe("small");
  });

  it("a trace to look at is a button for a screen reader", async () => {
    const onOpen = jest.fn();
    await render(<UvTrace {...props} traces={[trace({ revealed: true, mark: "p. 247" })]} uv onOpen={onOpen} />);
    await fireEvent(screen.getByTestId("v2-trace-trace_a"), "accessibilityTap");
    expect(onOpen).toHaveBeenCalledWith("trace_a");
  });
});

/** Every piece of text drawn in a rendered tree. */
type Node = { type: string; children: (Node | string)[] | null } | string | null;
function written(node: Node | Node[]): string[] {
  if (Array.isArray(node)) return node.flatMap(written);
  if (!node || typeof node === "string") return [];
  const kids = node.children ?? [];
  return node.type === "Text" ? [kids.filter((k) => typeof k === "string").join("")] : kids.flatMap((k) => written(k));
}

describe("a trace's close-up", () => {
  const open = async (t: StageTrace) => {
    const onClose = jest.fn();
    const view = await render(<TraceView trace={t} genre="crime_scene" onClose={onClose} />);
    return { onClose, view };
  };

  it("is the trace itself, big: no report, no caption, nothing asked of the engine", async () => {
    const { onClose } = await open(trace({ kind: "prints", label: "Fingerprints", pattern: "loop", scar: true, revealed: true }));
    expect(screen.getByTestId("v2-trace-art")).toBeTruthy();
    // No words on it at all: what it is can be seen.
    expect(written(screen.toJSON())).toHaveLength(0);
    // A screen reader hears what can be seen, not what it means.
    expect(screen.getByTestId("v2-trace-plate").props.accessibilityLabel).toBe("Fingerprints: loop pattern, with a scar across it");
    await fireEvent.press(screen.getByTestId("v2-trace-close"));
    expect(onClose).toHaveBeenCalled();
  });

  it("a footprint is one sole beside a scale in centimetres", async () => {
    await open(trace({ kind: "footprints", label: "Footprints", surface: "floor", size: "large", tread: "zigzag", revealed: true }));
    const texts = written(screen.toJSON());
    // The scale's numbers and its unit, nothing else.
    expect(texts).toEqual(expect.arrayContaining(["5", "10", "15", "20", "25", "30", "cm"]));
    expect(texts).toHaveLength(7);
    expect(describeTrace({ kind: "footprints", label: "Footprints" }, lookOf({ kind: "footprints", surface: "floor", seed: 1, size: "large", tread: "zigzag" }, "noir")))
      .toBe("Footprints: a sole with zigzag, 31 centimetres long");
  });

  it("writing is its words, big, in their hand", async () => {
    await open(trace({ mark: "Blackmail?", hand: "right-slant", revealed: true }));
    const letters = StyleSheet.flatten(screen.getByTestId("v2-uv-letters").props.style);
    expect(screen.getByTestId("v2-uv-letters")).toHaveTextContent("Blackmail?");
    expect(letters.fontSize).toBeGreaterThanOrEqual(34);
    expect(letters.fontFamily).toBe(handStyle("right-slant").text.fontFamily);
  });
});

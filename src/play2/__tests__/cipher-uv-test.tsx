// The cipher wheel's reading of the room (what the player has found), and UV traces: drawn as what they
// are, the words of found writing, and a tap under UV on a found trace looking at it.
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { makeMutable } from "react-native-reanimated";
import { TRACE_KINDS } from "@/engine/v2";
import { Mechanism } from "../mechanisms";
import { CipherContext, cipherClues, decode, settingFor, slotValues, type CipherClues } from "../mechanisms/cipher";
import type { MechanismTarget } from "../mechanisms/types";
import { drawTrace, tapTrace, traceAt, UvTrace, type StageTrace } from "../UvTrace";

// The shared Skia stand-in, with the beam mask's parts (a rect and a radial gradient) as host views too.
jest.mock("@shopify/react-native-skia", () => {
  const base = jest.requireActual("../../../jest/skia-mock");
  const { createElement } = jest.requireActual("react");
  const host = (name: string) => (props: { children?: unknown }) => createElement(name, props, props.children);
  return { ...base, Rect: host("SkiaRect"), RadialGradient: host("SkiaRadialGradient"), Paint: host("SkiaPaint") };
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
    // No coded line found yet: says so, in one line.
    await render(mount({ offset: "1" }, { coded: null, source: null, numeric: false, solved: null }));
    expect(screen.getByText(/No coded message yet/)).toBeTruthy();
  });
});

const trace = (over: Partial<StageTrace> = {}): StageTrace => ({
  id: "trace_a", label: "Invisible writing", kind: "writing", surface: "wall", seed: 42, box: { x: 0.1, y: 0.4, w: 0.28, h: 0.09 }, revealed: false, ...over,
});

describe("UV traces", () => {
  it("draws each kind as what it is, the same every time, inside its box", () => {
    for (const kind of TRACE_KINDS) {
      for (const genre of ["noir", "crime_scene", "paranormal"] as const) {
        const t = trace({ kind, surface: kind === "footprints" ? "floor" : "wall", box: { x: 0.2, y: 0.3, w: 0.3, h: 0.2 } });
        const a = drawTrace(t, 400, 700, genre);
        expect(a).toEqual(drawTrace(t, 400, 700, genre));
        expect(a.blot + a.fill + a.lines).not.toBe("");
        // Every point lies in (or just round) its box: scaled to the object, not scribbled across the room.
        const nums = (a.blot + " " + a.fill + " " + a.lines).match(/[ML]-?[\d.]+ -?[\d.]+/g) ?? [];
        for (const p of nums) {
          const [x, y] = p.slice(1).split(" ").map(Number);
          expect(x).toBeGreaterThan(400 * 0.2 - 60);
          expect(x).toBeLessThan(400 * 0.5 + 60);
          expect(y).toBeGreaterThan(700 * 0.3 - 60);
          expect(y).toBeLessThan(700 * 0.5 + 80);
        }
      }
    }
    // Prints have ridges: many short broken lines, not a few outlines.
    const prints = drawTrace(trace({ kind: "prints" }), 400, 700, "noir");
    expect((prints.lines.match(/M/g) ?? []).length).toBeGreaterThan(30);
  });

  it("writing says its words once found, in invisible ink, only under UV", async () => {
    const tx = makeMutable(0.24), ty = makeMutable(0.44);
    const props = { marks: [], genre: "noir" as const, w: 390, h: 693, tx, ty, r: 100, lampLit: false };
    const view = await render(<UvTrace {...props} traces={[trace()]} uv />);
    expect(screen.queryByLabelText(/Written in invisible ink/)).toBeNull();
    await view.rerender(<UvTrace {...props} traces={[trace({ revealed: true, mark: "p. 247" })]} uv />);
    expect(screen.getByLabelText("Written in invisible ink: p. 247")).toBeTruthy();
    // In ordinary light, nothing glows.
    await view.rerender(<UvTrace {...props} traces={[trace({ revealed: true, kind: "prints" })]} uv={false} />);
    expect(screen.queryByTestId("v2-uv-traces")).toBeNull();
  });

  it("a tap under UV on a found trace looks at it; on one not yet found, finds it; never without UV", () => {
    const found = trace({ revealed: true, mark: "p. 247" });
    const hidden = trace({ id: "trace_b", kind: "prints", box: { x: 0.6, y: 0.2, w: 0.12, h: 0.09 } });
    const all = [found, hidden];
    expect(tapTrace(all, 0.2, 0.44, true)).toEqual({ look: "trace_a" });
    expect(tapTrace(all, 0.65, 0.25, true)).toEqual({ find: "trace_b" });
    expect(tapTrace(all, 0.2, 0.44, false)).toBeNull();
    expect(tapTrace(all, 0.9, 0.9, true)).toBeNull();
    // The magnifier's hit-test: found traces only, the smallest box first.
    expect(traceAt(all, 0.65, 0.25)).toBeNull();
    expect(traceAt([found, { ...found, id: "small", box: { x: 0.15, y: 0.42, w: 0.05, h: 0.03 } }], 0.17, 0.43)?.id).toBe("small");
  });

  it("a found trace is a button for a screen reader", async () => {
    const onOpen = jest.fn();
    await render(<UvTrace traces={[trace({ revealed: true, mark: "p. 247" })]} marks={[]} genre="noir" w={390} h={693} tx={makeMutable(0)} ty={makeMutable(0)} r={100} uv lampLit={false} onOpen={onOpen} />);
    await fireEvent(screen.getByTestId("v2-trace-trace_a"), "accessibilityTap");
    expect(onOpen).toHaveBeenCalledWith("trace_a");
  });
});

// The object puzzles (mechanisms/SafeDial, KeyRing, Telephone, Balance): their arithmetic, and the paths
// in without a gesture (a screen reader's, a tap's). The gestures themselves are worked on the bench.
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { act as flush, fireEvent, render, screen } from "@testing-library/react-native";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { normalize, variantSpec, type ArchetypeId, type ControlDomain } from "@/engine/v2";
import { Mechanism } from "../mechanisms";
import { DIAL_REST, dialled, numberAt, stepNumber, turnDial, type DialWorks } from "../mechanisms/gadgets/dial";
import { HeldContext, leanOf, pansValue, stampOf } from "../mechanisms/gadgets/held";
import { KeyImpression } from "../mechanisms/gadgets/KeyArt";
import { KEY, SOAP, cutsOf, keySlices, sayBitting, soapSlices } from "../mechanisms/gadgets/keys";
import { PHONE, digitsToSend, holeAngle, pulsesOf, travelOf } from "../mechanisms/gadgets/phone";
import { gadgetDomain, type MechanismProps, type MechanismTarget } from "../mechanisms/types";

const RING = ["31021", "12302", "20313", "03121", "23010"];
const WEIGHTS = [{ id: "w_a", name: "Brass weight ▲" }, { id: "w_b", name: "Brass weight ●" }, { id: "w_c", name: "Brass weight ◆" }];

function target(archetype: ArchetypeId, variant: string, over: Partial<MechanismTarget> = {}): MechanismTarget {
  const spec = variantSpec(archetype, variant);
  return { kind: "object", id: `obj-${variant}`, label: "Thing", archetype, variant, controls: [...spec.controls], submit: spec.submit, ...over };
}
const safe = () => target("CombinationLock", "dial");
const keys = () => target("CombinationLock", "keys", { submit: { kind: "keys", bittings: RING } });
const phone = () => target("Telephone", "rotary");
const balance = () => target("Balance", "pans", { kind: "item", controls: [{ id: "pans", domain: { kind: "pans", of: WEIGHTS.map((w) => w.id) } }] });

async function mount(t: MechanismTarget, over: Partial<MechanismProps> = {}) {
  const onSet = jest.fn();
  const onSubmit = jest.fn();
  const onChange = jest.fn();
  const state = over.state ?? { ...variantSpec(t.archetype!, t.variant).initial };
  const view = await render(
    <GestureHandlerRootView>
      <HeldContext.Provider value={WEIGHTS}>
        <Mechanism target={t} state={state} onSet={onSet} onSubmit={onSubmit} onChange={onChange} busy={false} cooldown={0} width={360} {...over} />
      </HeldContext.Provider>
    </GestureHandlerRootView>,
  );
  return { onSet, onSubmit, onChange, view };
}

const act = (label: string, actionName: "activate" | "increment" | "decrement") =>
  fireEvent(screen.getByLabelText(label), "accessibilityAction", { nativeEvent: { actionName } });
const valueOf = (label: string) => screen.getByLabelText(label).props.accessibilityValue.text;
/** Lets the gadgets' own timers run (a key going in, a dial running home). */
const wait = (ms: number) => flush(async () => {
  await new Promise((r) => setTimeout(r, ms));
});

describe("the safe dial's works", () => {
  const to = (w: DialWorks, pos: number) => turnDial(w, pos, 40, 3);

  it("turning right brings lower numbers under the index", () => {
    expect(numberAt(0, 40)).toBe(0);
    expect(numberAt(10, 40)).toBe(30);
    expect(numberAt(-10, 40)).toBe(10);
    expect(numberAt(41, 40)).toBe(39);
  });

  it("registers the number it is turned back from, twice; the third is where it is left", () => {
    let t = to(DIAL_REST, 10);
    expect(t.registered).toEqual([]);
    expect(dialled(t.works, 40, 3)).toBeNull();
    t = to(t.works, -10);
    expect(t.registered).toEqual([30]);
    t = to(t.works, 20);
    expect(t.registered).toEqual([10]);
    expect(t.works.entered).toEqual([30, 10]);
    expect(dialled(t.works, 40, 3)).toEqual(["30", "10", "20"]);
    // Easing back onto the last number registers nothing more.
    t = to(t.works, 19);
    expect(t.registered).toEqual([]);
    expect(dialled(t.works, 40, 3)).toEqual(["30", "10", "21"]);
  });

  it("works the same started the other way round", () => {
    let t = to(DIAL_REST, -5);
    t = to(t.works, 3);
    t = to(t.works, 0);
    expect(dialled(t.works, 40, 3)).toEqual(["5", "37", "0"]);
  });

  it("a whole turn one way lets go of what was registered", () => {
    let t = to(DIAL_REST, 10);
    t = to(t.works, 5);
    expect(t.works.entered).toEqual([30]);
    t = to(t.works, 5 - 40);
    expect(t.cleared).toBe(true);
    expect(t.works.entered).toEqual([]);
    // With nothing registered a whole turn clears nothing (and the first number can be the one it began on).
    const round = to(DIAL_REST, 40);
    expect(round.cleared).toBe(false);
    expect(to(round.works, 39).registered).toEqual([0]);
  });

  it("what it would try is in the core's domain", () => {
    const d = safe().submit as ControlDomain;
    expect(gadgetDomain(d)).toEqual({ kind: "dial", size: 40, count: 3 });
    let t = to(DIAL_REST, 10);
    t = to(t.works, -10);
    t = to(t.works, 20);
    expect(normalize(d, dialled(t.works, 40, 3))).toBe("30|10|20");
  });

  it("each number can be stepped directly (a screen reader's way in)", () => {
    let w = stepNumber(DIAL_REST, 1, 1, 40, 3);
    expect(w.entered).toEqual([0, 1]);
    w = stepNumber(w, 0, -1, 40, 3);
    expect(w.entered).toEqual([39, 1]);
    w = stepNumber(w, 2, 1, 40, 3);
    expect(dialled(w, 40, 3)).toEqual(["39", "1", "1"]);
  });
});

describe("the safe dial", () => {
  it("says nothing it holds, and tries only once all three numbers are in", async () => {
    const t = safe();
    const { onSubmit } = await mount(t);
    expect(valueOf("First number")).toBe("not set");
    // Nothing on it is written: no number, no instruction.
    expect(screen.queryByText(/\d/)).toBeNull();
    await act("Pull the handle", "activate");
    expect(onSubmit).not.toHaveBeenCalled();
    await act("First number", "increment");
    await act("First number", "increment");
    await act("Second number", "decrement");
    await act("Third number", "increment");
    expect([valueOf("First number"), valueOf("Second number"), valueOf("Third number")]).toEqual(["2", "39", "1"]);
    expect(screen.getByTestId("mech-telltale-0-down")).toBeTruthy();
    expect(screen.getByTestId("mech-telltale-2-down")).toBeTruthy();
    await act("Pull the handle", "activate");
    expect(onSubmit).toHaveBeenCalledWith(["2", "39", "1"]);
    expect(normalize(t.submit!, onSubmit.mock.calls[0][0])).toBe("2|39|1");
  });

  it("a tap on the dial's right or left half turns it a tick; tried, it lets go of what was dialled", async () => {
    const { onSubmit, onChange } = await mount(safe());
    await fireEvent.press(screen.getByTestId("mech-safe-right", { includeHiddenElements: true }));
    await fireEvent.press(screen.getByTestId("mech-safe-right", { includeHiddenElements: true }));
    await fireEvent.press(screen.getByTestId("mech-safe-left", { includeHiddenElements: true }));
    expect(valueOf("First number")).toBe("38");
    await fireEvent.press(screen.getByTestId("mech-safe-right", { includeHiddenElements: true }));
    expect(valueOf("Second number")).toBe("39");
    expect(valueOf("Third number")).toBe("38");
    expect(onChange).toHaveBeenCalled();
    await act("Pull the handle", "activate");
    expect(onSubmit).toHaveBeenCalledWith(["38", "39", "38"]);
    expect(screen.getByTestId("mech-telltale-0")).toBeTruthy();
  });

  it("holds while a cooldown runs, and stands open once it gives", async () => {
    const cold = await mount(safe(), { cooldown: 5 });
    await act("First number", "increment");
    await act("Second number", "increment");
    await act("Pull the handle", "activate");
    expect(cold.onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("Try again in 5s")).toBeTruthy();
    // It kept what was dialled for when the cooldown is over.
    expect(valueOf("First number")).toBe("1");
    await cold.view.unmount();
    await mount(target("CombinationLock", "dial", { id: "open-safe" }), { state: { open: true, locked: false } });
    expect(screen.getByTestId("mech-safe-open")).toBeTruthy();
    expect(screen.getByLabelText("Pull the handle").props.accessibilityState.disabled).toBe(true);
  });
});

describe("keys", () => {
  it("a bitting is five cuts of four depths; anything else counts as uncut", () => {
    expect(cutsOf("31021")).toEqual([3, 1, 0, 2, 1]);
    expect(cutsOf("9x")).toEqual([0, 0, 0, 0, 0]);
    expect(sayBitting("30120")).toBe("Cuts from the bow: deep, uncut, shallow, middling, uncut");
  });

  it("a key is its bow, five slices each from its depth's render, and its tip, edge to edge", () => {
    const s = keySlices("31021");
    expect(s.map((x) => x.depth)).toEqual([0, 3, 1, 0, 2, 1, 0]);
    expect(s[0].x).toBe(0);
    for (let i = 1; i < s.length; i++) expect(s[i].x).toBeCloseTo(s[i - 1].x + s[i - 1].w);
    expect(s[s.length - 1].x + s[s.length - 1].w).toBe(KEY.w);
  });

  it("the soap's impression is the key mirrored: its cuts run the other way, edge to edge", () => {
    const s = soapSlices("31021");
    expect(s.map((x) => x.depth)).toEqual([0, 1, 2, 0, 1, 3, 0]);
    for (let i = 1; i < s.length; i++) expect(s[i].x).toBeCloseTo(s[i - 1].x + s[i - 1].w);
    expect(s[s.length - 1].x + s[s.length - 1].w).toBeCloseTo(SOAP.w);
  });

  it("the impression is drawn, never written", async () => {
    await render(<KeyImpression bitting="20313" />);
    expect(screen.getByTestId("key-impression").props.accessibilityLabel).toContain("middling, uncut, deep, shallow, deep");
    expect(screen.queryByText(/\d/)).toBeNull();
  });
});

describe("the key ring", () => {
  it("tries the key chosen, by its cuts, in the core's domain", async () => {
    const t = keys();
    const { onSubmit } = await mount(t);
    expect(screen.getByLabelText("Key 3 of 5").props.accessibilityValue.text).toBe(sayBitting("20313"));
    await act("Key 3 of 5", "activate");
    await wait(260);
    expect(onSubmit).toHaveBeenCalledWith(["20313"]);
    expect(normalize(t.submit!, ["20313"])).toBe("20313");
  });

  it("takes no key while a cooldown runs or once it is open; has no ring until the room hangs one up", async () => {
    const cold = await mount(keys(), { cooldown: 4 });
    await act("Key 1 of 5", "activate");
    await wait(260);
    expect(cold.onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("Try again in 4s")).toBeTruthy();
    await cold.view.unmount();
    const open = await mount(target("CombinationLock", "keys", { id: "open-keys", submit: { kind: "keys", bittings: RING } }), { state: { open: true, locked: false } });
    expect(screen.getByTestId("mech-shackle-open")).toBeTruthy();
    await act("Key 1 of 5", "activate");
    await wait(260);
    expect(open.onSubmit).not.toHaveBeenCalled();
    await open.view.unmount();
    await mount(target("CombinationLock", "keys", { id: "no-ring", submit: { kind: "keys", bittings: RING } }), { state: { open: false, locked: true, ring: false } });
    expect(screen.queryByLabelText("Key 1 of 5")).toBeNull();
  });
});

describe("the rotary dial", () => {
  it("1 goes round the least and 0 the most, a pulse every thirty degrees", () => {
    expect(travelOf(1)).toBe(PHONE.stopAt - 60);
    for (let d = 2; d <= 9; d++) expect(travelOf(d) - travelOf(d - 1)).toBe(30);
    expect(travelOf(0) - travelOf(9)).toBe(30);
    expect(travelOf(0)).toBeLessThan(360);
    expect(pulsesOf(0)).toBe(10);
    expect(pulsesOf(7)).toBe(7);
    expect(holeAngle(3)).toBe(0);
    expect(holeAngle(0)).toBe(150);
  });

  it("sends the number with its last digit, and the next digit starts a new one", () => {
    let s = digitsToSend("", 2, 4);
    expect(s).toEqual({ digits: "2", send: null });
    s = digitsToSend("204", 6, 4);
    expect(s).toEqual({ digits: "", send: "2046" });
    expect(digitsToSend(s.digits, 5, 4)).toEqual({ digits: "5", send: null });
  });
});

describe("the balance's reading", () => {
  it("one pan loaded sinks by itself; two wait for what the engine saw of exactly those two", () => {
    expect(leanOf(null, null, {})).toBe(0);
    expect(leanOf("w_a", null, {})).toBe(-1);
    expect(leanOf(null, "w_b", {})).toBe(1);
    expect(leanOf("w_a", "w_b", { pans: "", tilt: "" })).toBeNull();
    expect(leanOf("w_a", "w_b", { pans: "w_a|w_b", tilt: "right" })).toBe(1);
    expect(leanOf("w_a", "w_b", { pans: "w_a|w_b", tilt: "left" })).toBe(-1);
    // The other way round is another weighing.
    expect(leanOf("w_b", "w_a", { pans: "w_a|w_b", tilt: "left" })).toBeNull();
    expect(pansValue("w_a", "w_b")).toBe("w_a|w_b");
    expect(pansValue("w_a", null)).toBeNull();
    expect(pansValue("w_a", "w_a")).toBeNull();
  });

  it("a weight is stamped with the symbol it is named by", () => {
    expect(stampOf("Brass weight ▲", "?")).toBe("▲");
    expect(stampOf("Brass weight", "●")).toBe("●");
  });
});

// The gadgets drawn from renders that exist (a missing picture would blank the bundle: checked below).
const rendered = (name: string) => existsSync(join(__dirname, "../../../assets/gadgets", `${name}.png`));

/** Dials `d` by its button and waits for the wheel to go round and run home. */
async function dial(d: number) {
  await act(`Dial ${d}`, "activate");
  await wait((travelOf(d) / PHONE.wind + travelOf(d) / PHONE.pace) * 1000 + 120);
}

(rendered("phone-body") ? describe : describe.skip)("the telephone", () => {
  it("dials nothing with the handset down; lifted, sends the number with its last digit", async () => {
    const t = phone();
    const { onSet } = await mount(t);
    await dial(2);
    expect(onSet).not.toHaveBeenCalled();
    await act("Lift the handset", "activate");
    for (const d of [2, 0, 4]) await dial(d);
    expect(onSet).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Dial").props.accessibilityValue.text).toBe("Dialled so far: 2 0 4");
    // Nothing dialled is written anywhere (the plate's numerals are in its picture).
    expect(screen.queryByText(/\d/)).toBeNull();
    await dial(6);
    expect(onSet).toHaveBeenCalledWith("number", "2046");
    expect(normalize(t.controls[0].domain, "2046")).toBe("2046");
  }, 20000);

  it("hanging up lets go of what was dialled", async () => {
    const { onSet } = await mount(target("Telephone", "rotary", { id: "phone-2" }));
    await act("Lift the handset", "activate");
    await dial(5);
    expect(screen.getByLabelText("Dial").props.accessibilityValue.text).toBe("Dialled so far: 5");
    await act("Hang up", "activate");
    expect(screen.getByLabelText("Dial").props.accessibilityValue.text).toBe("Nothing dialled");
    expect(onSet).not.toHaveBeenCalled();
  });
});

(rendered("balance-stand") ? describe : describe.skip)("the balance", () => {
  it("weighs two of the held weights and shows only which side is lower", async () => {
    const t = balance();
    const { onSet, view } = await mount(t, { state: { pans: "", tilt: "" } });
    expect(screen.getByLabelText("Balance. The pans are level")).toBeTruthy();
    await act("Brass weight ▲", "activate");
    expect(screen.getByLabelText("Balance. The left pan is lower")).toBeTruthy();
    expect(onSet).not.toHaveBeenCalled();
    await act("Brass weight ◆", "activate");
    expect(onSet).toHaveBeenCalledWith("pans", "w_a|w_c");
    expect(normalize(t.controls[0].domain, "w_a|w_c")).toBe("w_a|w_c");
    expect(screen.getByLabelText("Brass weight ◆").props.accessibilityValue.text).toBe("on the right pan");
    await view.unmount();
    // The engine's answer: the heavier side, and nothing else.
    await mount(t, { state: { pans: "w_a|w_c", tilt: "right" } });
    expect(screen.getByLabelText("Balance. The right pan is lower")).toBeTruthy();
    expect(screen.queryByText(/\d/)).toBeNull();
    // Taken off, it goes back to the table.
    await act("Brass weight ▲", "activate");
    expect(screen.getByLabelText("Brass weight ▲").props.accessibilityValue.text).toBe("on the table");
  });

  it("offers only the weights the player holds", async () => {
    const onSet = jest.fn();
    await render(
      <GestureHandlerRootView>
        <HeldContext.Provider value={WEIGHTS.slice(0, 2)}>
          <Mechanism target={{ ...balance(), id: "balance-2" }} state={{ pans: "", tilt: "" }} onSet={onSet} onSubmit={jest.fn()} busy={false} cooldown={0} width={360} />
        </HeldContext.Provider>
      </GestureHandlerRootView>,
    );
    expect(screen.getByLabelText("Brass weight ●")).toBeTruthy();
    expect(screen.queryByLabelText("Brass weight ◆")).toBeNull();
  });
});

describe("the gadgets' pictures", () => {
  it("every picture the gadgets ask for is in assets/gadgets at 1x and 2x", () => {
    const source = readFileSync(join(__dirname, "../mechanisms/gadgets/sprites.ts"), "utf8");
    const names = [...source.matchAll(/assets\/gadgets\/([a-z0-9-]+)\.png/g)].map((m) => m[1]);
    expect(names.length).toBeGreaterThan(10);
    const missing = names.flatMap((n) => ["", "@2x"].map((scale) => `${n}${scale}.png`).filter((f) => !existsSync(join(__dirname, "../../../assets/gadgets", f))));
    expect(missing).toEqual([]);
  });
});


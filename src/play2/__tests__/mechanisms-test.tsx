import { GestureHandlerRootView } from "react-native-gesture-handler";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { ARCHETYPES, normalize, variantSpec, type ArchetypeId, type ControlDomain, type FinaleDef, type StateValue } from "@/engine/v2";
import { Mechanism } from "../mechanisms";
import type { MechanismProps, MechanismTarget } from "../mechanisms/types";

const target = (archetype: ArchetypeId | null, variant?: string, label = "Thing"): MechanismTarget => {
  const spec = archetype ? variantSpec(archetype, variant) : null;
  // Its own controls list, as a room's definition has: what's dialled is kept per definition.
  return { kind: "object", id: "obj", label, archetype, variant, controls: [...(spec?.controls ?? [])], submit: spec?.submit };
};

async function mount(t: MechanismTarget, over: Partial<MechanismProps> = {}) {
  const onSet = jest.fn();
  const onSubmit = jest.fn();
  const onChange = jest.fn();
  const state = over.state ?? (t.archetype ? { ...variantSpec(t.archetype, t.variant).initial } : {});
  const view = await render(
    <GestureHandlerRootView>
      <Mechanism target={t} state={state} onSet={onSet} onSubmit={onSubmit} onChange={onChange} busy={false} cooldown={0} width={360} {...over} />
    </GestureHandlerRootView>,
  );
  return { onSet, onSubmit, onChange, view };
}

/** The symbols the wheels stand at, read from their accessibility values. */
const wheels = (n: number) => Array.from({ length: n }, (_, i) => screen.getByLabelText(`Wheel ${i + 1}`).props.accessibilityValue.text);

const act = (label: string, actionName: "activate" | "increment" | "decrement") =>
  fireEvent(screen.getByLabelText(label), "accessibilityAction", { nativeEvent: { actionName } });

/** The value committed for `control` is in its domain, unchanged by normalize. */
function expectValid(t: MechanismTarget, control: string, value: StateValue) {
  const domain = t.controls.find((c) => c.id === control)?.domain as ControlDomain;
  expect(normalize(domain, value)).toBe(value);
}

describe("mechanisms", () => {
  it("draws nothing for scenery, Assemble, a card and the torch", async () => {
    for (const t of [target(null), target("Assemble"), target("Readable", "card"), target("Light", "torch")]) {
      const { view } = await mount(t);
      expect((view.toJSON() as { children: unknown[] | null } | null)?.children ?? []).toHaveLength(0);
      await view.unmount();
    }
  });

  it("opens a drawer and a compartment; a locked one rattles and says so", async () => {
    for (const [variant, verb] of [["drawer", "Pull the drawer open"], ["compartment", "Swing the door open"]]) {
      const t = target("Drawer", variant);
      const { onSet, view } = await mount(t);
      // What a screen reader hears is what the line says.
      if (variant === "compartment") expect(screen.getByText(verb)).toBeTruthy();
      await act(verb, "activate");
      expect(onSet).toHaveBeenCalledWith("open", true);
      expectValid(t, "open", true);
      await view.unmount();
    }
    const { onSet } = await mount(target("Drawer", "drawer"), { state: { open: false, locked: true } });
    await act("Pull the drawer open", "activate");
    expect(onSet).not.toHaveBeenCalled();
    expect(screen.getByText("Locked")).toBeTruthy();
  });

  it("lifts a cushion and tilts a frame", async () => {
    const lift = await mount(target("LiftUnder", "lift", "Cushion"));
    await act("Lift the Cushion", "activate");
    expect(lift.onSet).toHaveBeenCalledWith("lifted", true);
    await lift.view.unmount();
    const frame = await mount(target("FrameTilt", "tilt", "Painting"));
    await act("Tilt the Painting", "activate");
    expect(frame.onSet).toHaveBeenCalledWith("tilted", true);
  });

  it("turns straight to a page with the number wheels, which stand at the page it's open at", async () => {
    const t = target("Readable", "pages");
    const { onSet, view } = await mount(t, { state: { page: "46" } });
    expect(screen.getByText("Open at page 46")).toBeTruthy();
    expect(wheels(3)).toEqual(["0", "4", "6"]);
    await act("Wheel 3", "increment");
    await fireEvent.press(screen.getByLabelText("Turn to page"));
    expect(onSet).toHaveBeenLastCalledWith("page", "47");
    for (const [, v] of onSet.mock.calls) expectValid(t, "page", v);
    // Turned (the close-up mounts afresh): the wheels at the new page.
    await view.rerender(
      <GestureHandlerRootView>
        <Mechanism key="again" target={t} state={{ page: "267" }} onSet={onSet} onSubmit={jest.fn()} busy={false} cooldown={0} width={360} />
      </GestureHandlerRootView>,
    );
    expect(screen.getByText("Open at page 267")).toBeTruthy();
    expect(wheels(3)).toEqual(["2", "6", "7"]);
    await view.unmount();
    // A fresh book opens at page 1: 001.
    await mount(target("Readable", "pages"));
    expect(wheels(3)).toEqual(["0", "0", "1"]);
  });

  it("sets the clock by hour and minute", async () => {
    const t = target("ClockHands", "hands");
    const { onSet } = await mount(t, { state: { time: "12:55" } });
    await act("Hour hand", "increment");
    expect(onSet).toHaveBeenLastCalledWith("time", "1:55");
    await act("Minute hand", "increment");
    expect(onSet).toHaveBeenLastCalledWith("time", "1:00");
    await act("Minute hand", "decrement");
    expect(onSet).toHaveBeenLastCalledWith("time", "1:55");
    for (const [, v] of onSet.mock.calls) expectValid(t, "time", v);
  });

  it("tunes the radio in tenths, inside the band", async () => {
    const t = target("TuningDial", "dial");
    const { onSet, view } = await mount(t, { state: { freq: "96.3" } });
    await act("Tuning dial", "increment");
    expect(onSet).toHaveBeenLastCalledWith("freq", "96.4");
    expectValid(t, "freq", "96.4");
    await view.unmount();
    const low = await mount(t, { state: { freq: "88.0" } });
    await act("Tuning dial", "decrement");
    expect(low.onSet).not.toHaveBeenCalled();
  });

  it("rolls lock wheels in each alphabet and submits them; cooldown holds the submit", async () => {
    for (const alphabet of ["digits", "letters", "symbols"] as const) {
      const t = target("CombinationLock", alphabet);
      const { onSubmit, view } = await mount(t);
      await act("Wheel 1", "increment");
      await act("Wheel 3", "decrement");
      await fireEvent.press(screen.getByText("Try it"));
      const value = onSubmit.mock.calls[0][0];
      expect(normalize(t.submit!, value)).toBe(value.join("|"));
      await view.unmount();
    }
    const { onSubmit } = await mount(target("CombinationLock", "digits"), { cooldown: 5 });
    expect(screen.getByText("Try again in 5s")).toBeTruthy();
    await fireEvent.press(screen.getByText("Try it"));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("keeps the wheels after a try: wrong, to adjust; right, on the answer and stamped open", async () => {
    const t = target("CombinationLock", "digits");
    const first = await mount(t);
    await act("Wheel 1", "increment");
    await act("Wheel 2", "decrement");
    // Turning a wheel says the last try's note is stale.
    expect(first.onChange).toHaveBeenCalledTimes(2);
    await fireEvent.press(screen.getByText("Try it"));
    expect(first.onSubmit).toHaveBeenCalledWith(["1", "9", "0"]);
    await first.view.unmount();
    // Wrong: the close-up mounts afresh, the wheels where they were.
    await mount(t);
    expect(wheels(3)).toEqual(["1", "9", "0"]);
    await act("Wheel 3", "increment");
    await screen.unmount();
    // Right: open, on the answer, the submit swapped for the stamp.
    await mount(t, { state: { open: true, locked: false } });
    expect(wheels(3)).toEqual(["1", "9", "1"]);
    expect(screen.queryByText("Try it")).toBeNull();
    expect(screen.getByTestId("mech-solved")).toBeTruthy();
    expect(screen.getByLabelText("Open")).toBeTruthy();
    // Held: a wheel no longer turns.
    await act("Wheel 1", "increment");
    expect(wheels(3)).toEqual(["1", "9", "1"]);
  });

  it("switches a lamp and a UV lamp", async () => {
    for (const variant of ["lamp", "uv"]) {
      const t = target("Light", variant, "Lamp");
      const { onSet, view } = await mount(t, { state: { on: false } });
      await fireEvent.press(screen.getByRole("switch"));
      expect(onSet).toHaveBeenCalledWith("on", true);
      await view.unmount();
    }
  });

  it("turns the decoder ring through 1..max", async () => {
    const t: MechanismTarget = { ...target("Decoder", "wheel"), kind: "item" };
    const { onSet } = await mount(t, { state: { offset: "1" } });
    await act("Cipher ring", "increment");
    expect(onSet).toHaveBeenLastCalledWith("offset", "2");
    expect(screen.getByTestId("mech-decoder-letter")).toHaveTextContent("C");
    await act("Cipher ring", "decrement");
    await act("Cipher ring", "decrement");
    expect(onSet).toHaveBeenLastCalledWith("offset", "25");
    for (const [, v] of onSet.mock.calls) expectValid(t, "offset", v);
  });

  describe("the door", () => {
    const door = (variant: string) => target("Door", variant, "Door");
    const submitDomain = (variant: string) => ARCHETYPES.Door.variants[variant].submit!;

    it("combination: its wheels and a submit", async () => {
      const finale: FinaleDef = { kind: "combination", object: "door", wheels: 4, alphabet: "digits" };
      const { onSubmit } = await mount(door("combination"), { finale });
      await act("Wheel 4", "increment");
      await fireEvent.press(screen.getByText("Try the door"));
      expect(onSubmit).toHaveBeenCalledWith(["0", "0", "0", "1"]);
      expect(normalize(submitDomain("combination"), onSubmit.mock.calls[0][0])).toBe("0|0|0|1");
    });

    it("accusation: one of each, then Accuse", async () => {
      const opts = (p: string) => [1, 2, 3].map((n) => ({ id: `${p}${n}`, name: `${p.toUpperCase()} ${n}` }));
      const finale: FinaleDef = { kind: "accusation", object: "door", suspects: opts("s"), motives: opts("m"), methods: opts("x") };
      const { onSubmit } = await mount(door("accusation"), { finale });
      await fireEvent.press(screen.getByText("Accuse"));
      expect(onSubmit).not.toHaveBeenCalled();
      await fireEvent.press(screen.getByText("S 2"));
      await fireEvent.press(screen.getByText("M 1"));
      await fireEvent.press(screen.getByText("X 3"));
      await fireEvent.press(screen.getByText("Accuse"));
      expect(onSubmit).toHaveBeenCalledWith(["s2", "m1", "x3"]);
      expect(normalize(submitDomain("accusation"), onSubmit.mock.calls[0][0])).toBe("s2|m1|x3");
    });

    it("accusation: a wrong one keeps the picks, to change one", async () => {
      const opts = (p: string) => [1, 2].map((n) => ({ id: `${p}${n}`, name: `${p.toUpperCase()} ${n}` }));
      const finale: FinaleDef = { kind: "accusation", object: "door", suspects: opts("s"), motives: opts("m"), methods: opts("x") };
      const t = door("accusation");
      const first = await mount(t, { finale });
      for (const l of ["S 2", "M 1", "X 2"]) await fireEvent.press(screen.getByText(l));
      expect(first.onChange).toHaveBeenCalledTimes(3);
      await fireEvent.press(screen.getByText("Accuse"));
      await first.view.unmount();
      const again = await mount(t, { finale });
      expect(screen.getByLabelText("S 2").props.accessibilityState).toMatchObject({ selected: true });
      await fireEvent.press(screen.getByText("M 2"));
      await fireEvent.press(screen.getByText("Accuse"));
      expect(again.onSubmit).toHaveBeenCalledWith(["s2", "m2", "x2"]);
    });

    it("ritual: objects in order, a tap takes one back, then Begin", async () => {
      const finale: FinaleDef = { kind: "ritual", object: "door", length: 3 };
      const ritualChoices = ["clock", "lamp", "mirror", "book"].map((id) => ({ id, label: id.toUpperCase() }));
      const { onSubmit } = await mount(door("ritual"), { finale, ritualChoices });
      for (const l of ["LAMP", "CLOCK", "LAMP", "BOOK", "MIRROR"]) await fireEvent.press(screen.getAllByText(l).at(-1)!); // the chip (a chosen one also shows in its slot)
      await fireEvent.press(screen.getByText("Begin"));
      expect(onSubmit).toHaveBeenCalledWith(["clock", "book", "mirror"]);
      expect(normalize(submitDomain("ritual"), onSubmit.mock.calls[0][0])).toBe("clock|book|mirror");
    });

    it("ritual: every chip keeps a place for its number, so choosing one moves nothing", async () => {
      const finale: FinaleDef = { kind: "ritual", object: "door", length: 3 };
      const ritualChoices = ["clock", "lamp"].map((id) => ({ id, label: id.toUpperCase() }));
      await mount(door("ritual"), { finale, ritualChoices });
      const chip = () => screen.getByLabelText(/^LAMP/);
      const before = chip().children.length;
      await fireEvent.press(screen.getAllByText("LAMP").at(-1)!);
      expect(chip().props.accessibilityLabel).toBe("LAMP, first");
      expect(chip().children.length).toBe(before);
    });

    it("shows open once it is", async () => {
      await mount(door("combination"), { state: { open: true } });
      expect(screen.getByText("The door is open")).toBeTruthy();
    });
  });
});

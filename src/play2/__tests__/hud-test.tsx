// The game's frame (src/play2/hud) and its transitions (src/play2/transitions):
// the rail over the room (a brass key tab back, the case as a slip that folds
// out, the casebook as a book with a paper tab for unread clues), the slip a
// toast is, the tag a held item wears, the close-up's table, the lights
// coming up after the brief, the photo turned away from.
import { AccessibilityInfo } from "react-native";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import type { ItemDef } from "@/engine/v2";
import type { Genre } from "@/lib/puzzle-types";
import { ModeScope } from "@/game/mode";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { motion } from "@/theme/tokens";
import { GROW, InspectView } from "../InspectView";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ItemTag, TAG_LINE, tagLine } from "../hud/ItemTag";
import { forgetNudges, NUDGE, nudgeFor } from "../hud/Nudge";
import { TurnArrow } from "../hud/TurnArrow";
import { SlipToast } from "../hud/SlipToast";
import { CloseStud, NameLabel, PlateButton } from "../hud/Table";
import { railHeight, TopRail } from "../hud/TopRail";
import { Darkness, LightsOn, LIGHTS_MS } from "../transitions/LightsOn";
import { TURN, TurnGhost } from "../transitions/TurnGhost";

const OBJECTIVE = "Somebody locked you in and left the combination scattered in pieces. Find every piece and walk out through the door.";
const MODES: Genre[] = ["noir", "crime_scene", "paranormal"];

const rail = (genre: Genre, props: Partial<React.ComponentProps<typeof TopRail>> = {}) => (
  <ModeScope genre={genre}>
    <TopRail objective={OBJECTIVE} unread={0} onBack={jest.fn()} onCasebook={jest.fn()} {...props} />
  </ModeScope>
);

describe("the rail over the room", () => {
  it.each(MODES)("%s: goes back, opens the casebook, and says the whole case to a screen reader", async (genre) => {
    const onBack = jest.fn();
    const onCasebook = jest.fn();
    await render(rail(genre, { onBack, onCasebook }));
    await fireEvent.press(screen.getByTestId("v2-back"));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("v2-back").props.accessibilityLabel).toBe("Back");
    await fireEvent.press(screen.getByTestId("v2-casebook-open"));
    expect(onCasebook).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("v2-casebook-open").props.accessibilityLabel).toBe("Casebook");
    expect(screen.getByTestId("v2-objective").props.accessibilityLabel).toBe(`Objective: ${OBJECTIVE}`);
    expect(screen.queryByTestId("v2-casebook-badge")).toBeNull();
  });

  it("shows the case on one line, and folds all of it out on a tap, then away again", async () => {
    jest.useFakeTimers();
    try {
      await render(rail("noir"));
      const slip = () => screen.getByTestId("v2-objective");
      expect(screen.getByTestId("v2-objective-line").props.numberOfLines).toBe(1);
      expect(screen.getByTestId("v2-objective-line").props.children).toBe(OBJECTIVE);
      expect(slip().props.accessibilityState).toEqual({ expanded: false });
      await fireEvent.press(slip());
      expect(slip().props.accessibilityState).toEqual({ expanded: true });
      expect(slip().props.accessibilityHint).toMatch(/put it away/);
      // Put away by a second tap…
      await fireEvent.press(slip());
      expect(slip().props.accessibilityState).toEqual({ expanded: false });
      // …or by itself after a few seconds.
      await fireEvent.press(slip());
      await act(async () => {
        jest.advanceTimersByTime(8000);
      });
      expect(slip().props.accessibilityState).toEqual({ expanded: false });
    } finally {
      jest.useRealTimers();
    }
  });

  it("counts the clues not yet read on a paper tab in the book", async () => {
    await render(rail("crime_scene", { unread: 3 }));
    expect(screen.getByTestId("v2-casebook-open").props.accessibilityLabel).toBe("Casebook, 3 new");
    expect(screen.getByTestId("v2-casebook-badge")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
    await render(rail("crime_scene", { unread: 14 }));
    expect(screen.getByText("9+")).toBeTruthy();
  });

  it("is one fixed height per mode (nothing under it jumps); paranormal's carries the presence", () => {
    expect(railHeight("noir")).toBe(railHeight("crime_scene"));
    expect(railHeight("paranormal")).toBeGreaterThan(railHeight("noir"));
    // Never taller than the band it replaced (58 under the status bar, more when the case ran to three lines).
    for (const g of MODES) expect(railHeight(g)).toBeLessThanOrEqual(64);
    expect(railHeight(null)).toBe(railHeight("noir"));
  });
});

describe("a word from the game", () => {
  it("is a slip of paper, announced, that asks to be put away after its moment", async () => {
    jest.useFakeTimers();
    const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => {});
    try {
      const onHide = jest.fn();
      await render(<ModeScope genre="noir"><SlipToast text="It's locked." onHide={onHide} /></ModeScope>);
      expect(screen.getByTestId("toast")).toBeTruthy();
      expect(screen.getByText("It's locked.")).toBeTruthy();
      expect(announce).toHaveBeenCalledWith("It's locked.");
      expect(onHide).not.toHaveBeenCalled();
      await act(async () => {
        jest.advanceTimersByTime(motion.toast + 10);
      });
      expect(onHide).toHaveBeenCalledTimes(1);
    } finally {
      announce.mockRestore();
      jest.useRealTimers();
    }
  });
});

describe("a held item's tag", () => {
  const item: ItemDef = { id: "k", name: "brass key", kind: "key" };

  it("is its name, and nothing about what to do with it", async () => {
    await render(<ModeScope genre="paranormal"><ItemTag item={item} name="Brass key" /></ModeScope>);
    expect(screen.getByTestId("v2-item-card")).toBeTruthy();
    expect(screen.getByText("Brass key")).toBeTruthy();
    expect(screen.queryByTestId("v2-item-line")).toBeNull();
    expect(screen.queryByText(/drag|hold|tap/i)).toBeNull();
  });

  it("carries one short line of its own when the room gives one; a long card stays a hold away", async () => {
    expect(tagLine("Stamped on the bow: No. 7. Somebody filed the teeth.")).toBe("Stamped on the bow: No. 7.");
    expect(tagLine("A novelty card from a spy kit, printed in a jumble of red and blue letters that spell nothing. The small print says: see it through red.")).toBeNull();
    expect(tagLine("")).toBeNull();
    expect(tagLine(undefined)).toBeNull();
    for (const text of ["Short and whole", "x".repeat(TAG_LINE) + "."]) expect((tagLine(text) ?? "").length).toBeLessThanOrEqual(TAG_LINE + 1);
    await render(<ModeScope genre="noir"><ItemTag item={item} name="Brass key" line="Stamped on the bow: No. 7. Somebody filed the teeth." /></ModeScope>);
    expect(screen.getByTestId("v2-item-line").props.children).toBe("Stamped on the bow: No. 7.");
  });
});

describe("the close-up's table", () => {
  it("names the thing on a card, closes with a stud, takes with a plate", async () => {
    const onClose = jest.fn();
    const onTake = jest.fn();
    await render(
      <ModeScope genre="crime_scene">
        <NameLabel name="Drawer" />
        <CloseStud onPress={onClose} testID="close" />
        <PlateButton label="Take it" onPress={onTake} testID="take" />
      </ModeScope>,
    );
    expect(screen.getByRole("header").props.children).toBe("Drawer");
    await fireEvent.press(screen.getByTestId("close"));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("close").props.accessibilityLabel).toBe("Close");
    await fireEvent.press(screen.getByTestId("take"));
    expect(onTake).toHaveBeenCalledTimes(1);
  });

  const view = (props: Partial<React.ComponentProps<typeof InspectView>> = {}) => (
    <InspectView
      target={{ kind: "object", id: "vase", label: "vase", archetype: null, controls: [] }}
      state={{}} contents={[]} busy={false} cooldown={0}
      onSet={jest.fn()} onSubmit={jest.fn()} onPickUp={jest.fn()} onClose={jest.fn()} revision={0} tray={null}
      from={{ x: 120, y: 300 }}
      {...props}
    />
  );

  it("keeps its ids and labels: the thing's name, what's there, the ways to put it back", async () => {
    await render(<ModeScope genre="noir">{view()}</ModeScope>);
    expect(screen.getByTestId("v2-inspect")).toBeTruthy();
    expect(screen.getByRole("header").props.children).toBe("Vase");
    expect(screen.getByTestId("v2-inspect-close").props.accessibilityLabel).toBe("Close");
    expect(screen.getByTestId("v2-inspect-away").props.accessibilityLabel).toBe("Back to the room");
  });

  it("shrinks back into the thing before it closes; with reduced motion it closes at once", async () => {
    jest.useFakeTimers();
    try {
      const onClose = jest.fn();
      await render(<ModeScope genre="noir">{view({ onClose })}</ModeScope>);
      await fireEvent.press(screen.getByTestId("v2-inspect-close"));
      // A second press while it's going changes nothing.
      await fireEvent.press(screen.getByTestId("v2-inspect-away"));
      expect(onClose).not.toHaveBeenCalled();
      await act(async () => {
        jest.advanceTimersByTime(GROW.close + 5);
      });
      expect(onClose).toHaveBeenCalledTimes(1);

      const now = jest.fn();
      await render(<ThemeProvider reducedMotion><ModeScope genre="noir">{view({ onClose: now })}</ModeScope></ThemeProvider>);
      await fireEvent.press(screen.getAllByTestId("v2-inspect-close").at(-1)!);
      expect(now).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it("lays a found item on the table as the thing itself, to pick up", async () => {
    const onPickUp = jest.fn();
    const item: ItemDef = { id: "pencil", name: "soft pencil", kind: "prop" };
    await render(<ModeScope genre="noir">{view({ contents: [{ kind: "item", item }], onPickUp })}</ModeScope>);
    const found = screen.getByTestId("v2-found-pencil");
    expect(found.props.accessibilityLabel).toBe("Pick up Soft pencil");
    await fireEvent.press(found);
    expect(onPickUp).toHaveBeenCalledWith("pencil");
  });
});

describe("show, never tell: the close-up says nothing", () => {
  const drawer = { kind: "object" as const, id: "desk", label: "desk", archetype: "Drawer" as const, variant: "drawer", controls: [] };
  const close = (props: Partial<React.ComponentProps<typeof InspectView>> = {}) => (
    <GestureHandlerRootView>
      <ModeScope genre="noir">
        <InspectView
          target={drawer} state={{ open: false, locked: false }} contents={[]} busy={false} cooldown={0} game="g1"
          onSet={jest.fn()} onSubmit={jest.fn()} onPickUp={jest.fn()} onClose={jest.fn()} revision={0} tray={null}
          {...props}
        />
      </ModeScope>
    </GestureHandlerRootView>
  );
  /** Every string drawn on screen. */
  const said = (): string[] => {
    const out: string[] = [];
    const walk = (n: unknown) => {
      if (typeof n === "string") out.push(n);
      else if (Array.isArray(n)) n.forEach(walk);
      else if (n && typeof n === "object") walk((n as { children?: unknown }).children);
    };
    walk(screen.toJSON());
    return out;
  };

  beforeEach(() => forgetNudges());

  it("a note passed by an older caller isn't shown; an empty thing is seen to be empty, and only a screen reader is told", async () => {
    await render(close({ note: "The drawer slides out.", target: { ...drawer, archetype: null }, state: {} }));
    expect(screen.queryByTestId("v2-inspect-note")).toBeNull();
    expect(said()).toEqual(["Desk"]);
    const empty = screen.getByTestId("v2-empty");
    expect(empty.props.accessibilityLabel).toBe("Nothing here.");
    expect(empty.props.children).toBeUndefined();
  });

  it("a mechanism has no line under it saying what to do or what it is doing", async () => {
    for (const [target, state] of [
      [drawer, { open: false, locked: false }],
      [drawer, { open: true, locked: false }],
      [{ ...drawer, variant: "compartment" }, { open: false, locked: false }],
      [{ ...drawer, archetype: "LiftUnder" as const, variant: "lift", label: "rug" }, { lifted: false }],
      [{ ...drawer, archetype: "LiftUnder" as const, variant: "lift", label: "vase" }, { lifted: true }],
      [{ ...drawer, archetype: "FrameTilt" as const, variant: "tilt", label: "painting" }, { tilted: false }],
      [{ ...drawer, archetype: "Light" as const, variant: "lamp", label: "lamp" }, { on: false }],
    ] as const) {
      const view = await render(close({ target, state }));
      expect(said()).toEqual([target.label.charAt(0).toUpperCase() + target.label.slice(1)]);
      await view.unmount();
    }
  });

  it("an examined item is itself and its own card: never what it's for", async () => {
    const key: ItemDef = { id: "k", name: "brass key", kind: "key" };
    await render(close({ target: { kind: "item", id: "k", label: "brass key", archetype: null, controls: [] }, item: key, state: {} }));
    expect(screen.getByTestId("v2-item-detail")).toBeTruthy();
    expect(said()).toEqual(["Brass key"]);
  });

  it("left alone for five seconds in front of a mechanism she hasn't met, a ghost fingertip shows the gesture, once per kind per game", async () => {
    jest.useFakeTimers();
    try {
      const first = await render(close());
      expect(screen.queryByTestId("v2-nudge", { includeHiddenElements: true })).toBeNull();
      await act(async () => jest.advanceTimersByTime(NUDGE.idleMs - 100));
      expect(screen.queryByTestId("v2-nudge", { includeHiddenElements: true })).toBeNull();
      await act(async () => jest.advanceTimersByTime(200));
      expect(screen.getByTestId("v2-nudge", { includeHiddenElements: true })).toBeTruthy();
      // No words in it.
      expect(said()).toEqual(["Desk"]);
      // It plays and goes.
      await act(async () => jest.advanceTimersByTime(NUDGE.passMs * NUDGE.passes + 100));
      expect(screen.queryByTestId("v2-nudge", { includeHiddenElements: true })).toBeNull();
      await first.unmount();
      // The next drawer in the same game: never again.
      const second = await render(close());
      await act(async () => jest.advanceTimersByTime(NUDGE.idleMs * 3));
      expect(screen.queryByTestId("v2-nudge", { includeHiddenElements: true })).toBeNull();
      await second.unmount();
      // Another kind in the same game, and the same kind in another game, are still new.
      await render(close({ target: { ...drawer, archetype: "LiftUnder", variant: "lift", label: "rug" }, state: { lifted: false } }));
      await act(async () => jest.advanceTimersByTime(NUDGE.idleMs + 100));
      expect(screen.getByTestId("v2-nudge", { includeHiddenElements: true })).toBeTruthy();
      await screen.unmount();
      await render(close({ game: "g2" }));
      await act(async () => jest.advanceTimersByTime(NUDGE.idleMs + 100));
      expect(screen.getByTestId("v2-nudge", { includeHiddenElements: true })).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });

  it("isn't shown for a thing already worked, nor for one she works herself", async () => {
    jest.useFakeTimers();
    try {
      const open = await render(close({ state: { open: true, locked: false } }));
      await act(async () => jest.advanceTimersByTime(NUDGE.idleMs * 2));
      expect(screen.queryByTestId("v2-nudge", { includeHiddenElements: true })).toBeNull();
      await open.unmount();
      // She pulls it open before the five seconds are up (the mechanism's own activate, as a screen reader's).
      const onSet = jest.fn();
      const shut = await render(close({ onSet }));
      await fireEvent(screen.getByLabelText("Pull the drawer open"), "accessibilityAction", { nativeEvent: { actionName: "activate" } });
      expect(onSet).toHaveBeenCalledWith("open", true);
      await act(async () => jest.advanceTimersByTime(NUDGE.idleMs * 2));
      expect(screen.queryByTestId("v2-nudge", { includeHiddenElements: true })).toBeNull();
      await shut.unmount();
      // And the next drawer is no longer new to her.
      await render(close());
      await act(async () => jest.advanceTimersByTime(NUDGE.idleMs * 2));
      expect(screen.queryByTestId("v2-nudge", { includeHiddenElements: true })).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it("knows each gesture that isn't a tap, and leaves the tapped ones alone", () => {
    const t = (archetype: string | null, variant?: string) => nudgeFor({ archetype, variant, label: "x" });
    expect(t("Drawer", "drawer")?.move.by).toMatchObject({ x: 0 });
    expect(t("Drawer", "drawer")!.move.by!.y).toBeGreaterThan(0);
    expect(t("Drawer", "compartment")!.move.by!.y).toBe(0);
    expect(t("LiftUnder")!.move.by!.y).toBeLessThan(0);
    expect(t("ClockHands")!.move.turn).toBeTruthy();
    expect(t("Door", "combination")?.kind).toBe(t("CombinationLock")?.kind);
    expect(t("Door", "accusation")).toBeNull();
    expect(t("Readable", "pages")?.kind).toBe("Wheels");
    expect(t("Readable", "card")).toBeNull();
    expect(t("Light", "lamp")).toBeNull();
    expect(t(null)).toBeNull();
  });
});

describe("a turn arrow, when something came into view that way", () => {
  it("glints without a word", async () => {
    await render(<ModeScope genre="noir"><TurnArrow dir={1} lit /><TurnArrow dir={-1} /></ModeScope>);
    expect(screen.getAllByTestId("v2-turn-lit")).toHaveLength(1);
  });
});

describe("the lights coming up after the brief", () => {
  it("lies dark under the brief, then lets the room through in about half a second; a touch skips it", async () => {
    jest.useFakeTimers();
    try {
      await render(<Darkness />);
      expect(screen.getByTestId("v2-darkness")).toBeTruthy();
      const onDone = jest.fn();
      await render(<LightsOn top={50} bottom={770} onDone={onDone} />);
      expect(screen.getByTestId("v2-lights-on")).toBeTruthy();
      expect(onDone).not.toHaveBeenCalled();
      await act(async () => {
        jest.advanceTimersByTime(LIGHTS_MS + 30);
      });
      expect(onDone).toHaveBeenCalledTimes(1);
      expect(LIGHTS_MS).toBeLessThanOrEqual(520);

      const skipped = jest.fn();
      await render(<LightsOn top={50} bottom={770} onDone={skipped} />);
      await fireEvent.press(screen.getAllByTestId("v2-lights-on-skip").at(-1)!);
      expect(skipped).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it("is nothing at all with reduced motion: the room is simply there", async () => {
    const onDone = jest.fn();
    await render(<ThemeProvider reducedMotion><LightsOn top={50} bottom={770} onDone={onDone} /></ThemeProvider>);
    expect(screen.queryByTestId("v2-lights-on")).toBeNull();
    expect(onDone).toHaveBeenCalledTimes(1);
    await render(<ThemeProvider reducedMotion><Darkness /></ThemeProvider>);
    expect(screen.queryByTestId("v2-darkness")).toBeNull();
  });
});

describe("the photo turned away from", () => {
  const frame = { x: 0, y: 0, width: 390, height: 693 };

  it("lingers in the dark a third of a second, then is gone", async () => {
    jest.useFakeTimers();
    try {
      const onDone = jest.fn();
      await render(<TurnGhost source={{ uri: "file:///a.jpg" }} frame={frame} dir={1} darkness={0.9} onDone={onDone} />);
      expect(screen.getByTestId("v2-turn-ghost")).toBeTruthy();
      await act(async () => {
        jest.advanceTimersByTime(TURN.ms + 5);
      });
      expect(onDone).toHaveBeenCalledTimes(1);
      expect(TURN.ms).toBeGreaterThanOrEqual(250);
      expect(TURN.ms).toBeLessThanOrEqual(500);
    } finally {
      jest.useRealTimers();
    }
  });

  it("isn't drawn with reduced motion", async () => {
    jest.useFakeTimers();
    try {
      const onDone = jest.fn();
      await render(<ThemeProvider reducedMotion><TurnGhost source={{ uri: "file:///a.jpg" }} frame={frame} dir={-1} darkness={0.9} onDone={onDone} /></ThemeProvider>);
      expect(screen.queryByTestId("v2-turn-ghost")).toBeNull();
      await act(async () => {
        jest.advanceTimersByTime(1);
      });
      expect(onDone).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });
});

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
import { ItemTag } from "../hud/ItemTag";
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
  it("says what it is: its label, its name, a line about it", async () => {
    const item: ItemDef = { id: "k", name: "brass key", kind: "key" };
    await render(<ModeScope genre="paranormal"><ItemTag item={item} label="Found" name="Brass key" text="Drag it onto something to use it." /></ModeScope>);
    expect(screen.getByTestId("v2-item-card")).toBeTruthy();
    expect(screen.getByText("Found")).toBeTruthy();
    expect(screen.getByText("Brass key")).toBeTruthy();
    expect(screen.getByText("Drag it onto something to use it.")).toBeTruthy();
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
      state={{}} contents={[]} note="It's locked." busy={false} cooldown={0}
      onSet={jest.fn()} onSubmit={jest.fn()} onPickUp={jest.fn()} onClose={jest.fn()} revision={0} tray={null}
      from={{ x: 120, y: 300 }}
      {...props}
    />
  );

  it("keeps its ids and labels: the thing's name, its note, what's there, the ways to put it back", async () => {
    await render(<ModeScope genre="noir">{view()}</ModeScope>);
    expect(screen.getByTestId("v2-inspect")).toBeTruthy();
    expect(screen.getByRole("header").props.children).toBe("Vase");
    expect(screen.getByTestId("v2-inspect-note").props.children).toBe("It's locked.");
    expect(screen.getByTestId("v2-empty")).toBeTruthy();
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

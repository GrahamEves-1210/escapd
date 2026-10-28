// The casebook: found cards, held items, hints, and crime scene's evidence board.
import { fireEvent, render, screen } from "@testing-library/react-native";
import { Casebook } from "../Casebook";

jest.mock("@/game/feedback", () => ({ useFeedback: () => ({ tick: jest.fn(), tap: jest.fn(), press: jest.fn() }) }));

const base = {
  objective: "Name who did it at the door.",
  cards: [{ id: "card_1", title: "A slip", text: "Stamped at the station." }],
  items: [{ id: "item_1", name: "Brass key", examinable: false }],
  hints: ["Look where the light falls."],
  canHint: true, glints: true, onGlints: jest.fn(), onHint: jest.fn(), onExamine: jest.fn(), onRestart: jest.fn(), onClose: jest.fn(),
};

describe("Casebook", () => {
  it("shows what was found, what is held and the hints taken", async () => {
    await render(<Casebook {...base} />);
    expect(screen.getByText("Stamped at the station.")).toBeTruthy();
    expect(screen.getByText("Brass key")).toBeTruthy();
    expect(screen.getByText("Look where the light falls.")).toBeTruthy();
    expect(screen.getByText("Another hint")).toBeTruthy();
    expect(screen.queryByTestId("v2-board")).toBeNull();
  });

  it("is her journal: the objective in her hand, each card taped in as what it is", async () => {
    const cards = [
      { id: "c_uv", title: "Under UV", text: "Glowing violet: p. 94." },
      { id: "c_m", title: "Matchbook", text: "From a bar called the Blue Lantern." },
      { id: "c_t", title: "Taped note", text: "Edge to edge: 5." },
    ];
    await render(<Casebook {...base} cards={cards} />);
    expect(screen.getByTestId("v2-casebook-objective").props.children).toBe(base.objective);
    for (const c of cards) {
      expect(screen.getByTestId(`v2-casebook-card-${c.id}`)).toBeTruthy();
      expect(screen.getByText(c.text)).toBeTruthy();
    }
    // A polaroid of what it was found on, captioned with its title.
    expect(screen.getByText("Matchbook")).toBeTruthy();
    // Hints are the cat's margin notes.
    expect(screen.getByText(/^psst/)).toBeTruthy();
  });

  it("nothing found yet: says so", async () => {
    await render(<Casebook {...base} cards={[]} />);
    expect(screen.getByTestId("v2-casebook-empty")).toBeTruthy();
  });

  it("held items are stickers to examine", async () => {
    const onExamine = jest.fn();
    await render(<Casebook {...base} items={[{ id: "item_1", name: "Brass key", examinable: true }]} onExamine={onExamine} />);
    await fireEvent.press(screen.getByTestId("v2-examine-item_1"));
    expect(onExamine).toHaveBeenCalledWith("item_1");
  });

  it("asks before restarting: a second tap does it", async () => {
    const onRestart = jest.fn();
    await render(<Casebook {...base} onRestart={onRestart} />);
    await fireEvent.press(screen.getByTestId("v2-restart"));
    expect(onRestart).not.toHaveBeenCalled();
    expect(screen.getByText("Tap again to restart. Progress will be lost.")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("v2-restart"));
    expect(onRestart).toHaveBeenCalledTimes(1);
  });

  it("no more hints for this step: no button, a line saying so", async () => {
    await render(<Casebook {...base} canHint={false} />);
    expect(screen.queryByTestId("v2-hint")).toBeNull();
    expect(screen.getByTestId("v2-hints-spent")).toBeTruthy();
  });

  it("crime scene: the evidence board crosses options off and back", async () => {
    const onStrike = jest.fn();
    const board = [
      { title: "Who", options: [{ id: "s_a", name: "Ada Finch" }, { id: "s_b", name: "Bram Hollis" }] },
      { title: "Why", options: [{ id: "m_a", name: "Greed" }] },
    ];
    await render(<Casebook {...base} board={board} struck={["s_b"]} onStrike={onStrike} />);
    expect(screen.getByTestId("v2-board")).toBeTruthy();
    expect(screen.getByTestId("v2-board-s_b").props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByTestId("v2-board-s_a").props.accessibilityState).toMatchObject({ checked: false });
    // Struck off with a "ruled out" stamp; the one left on a card is circled.
    expect(screen.getAllByText("RULED OUT")).toHaveLength(1);
    expect(screen.getByText("this one?")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("v2-board-s_a"));
    expect(onStrike).toHaveBeenCalledWith("s_a");
  });
});

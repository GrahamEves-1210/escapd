import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
import { ACCESSORIES, ALL_CHARMS, FINISHES } from "@/game/collection/charms";
import { ACCESSORY_KEY, COLLECTION_KEY, loadCollection, unseenCount } from "@/game/collection/store";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { CharmChip, charmChipLabel } from "../CharmChip";
import { CollectionScreen } from "../CollectionScreen";
import { CHARM_ART, TURN, TURN_ART, TURN_MS, WEAR_ART, turnFrame } from "../CharmArt";
import { PIN, PinnedCharm, pinLabel, pinTag } from "../PinnedCharm";

jest.mock("expo-router", () => {
  const { useEffect } = jest.requireActual("react");
  return {
    router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
    useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]),
  };
});

const seed = (cases: Record<string, { genre: string; kind: string; finish: string; at: number }>) =>
  AsyncStorage.setItem(COLLECTION_KEY, JSON.stringify({ cases, seenAt: 0 }));

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

describe("the charm board", () => {
  it("shows her title, the charms she has in their best finish and silhouettes of the rest", async () => {
    await seed({
      a: { genre: "noir", kind: "key", finish: "sticker", at: 1 },
      b: { genre: "noir", kind: "key", finish: "gold", at: 2 },
      c: { genre: "paranormal", kind: "moon", finish: "silver", at: 3 },
    });
    await render(<ThemeProvider><CollectionScreen /></ThemeProvider>);
    await waitFor(() => expect(screen.getByTestId("collection-title")).toHaveTextContent("Night-Owl Sleuth"));
    expect(screen.getByTestId("collection-progress")).toHaveTextContent("3 cases closed · 3 more to Inkwell Inspector");
    expect(screen.getByLabelText("Skeleton Key, gold pin. From 2 cases.")).toBeTruthy();
    expect(screen.getByLabelText("Sleepy Moon, silver pin. From 1 case.")).toBeTruthy();
    expect(screen.getByLabelText("Fedora: not found yet")).toBeTruthy();
    expect(screen.getByTestId("collection-count")).toHaveTextContent("2 of 9 charms · 1 in gold");
    await fireEvent.press(screen.getByLabelText("Skeleton Key, gold pin. From 2 cases."));
    expect(screen.getByTestId("collection-count")).toHaveTextContent("Skeleton Key · gold pin, sticker · 2 cases");
    // Opening the board sees every charm.
    await waitFor(async () => expect(unseenCount(await loadCollection())).toBe(0));
  });

  it("an empty or unreadable board: the first title and every charm a silhouette", async () => {
    await AsyncStorage.setItem(COLLECTION_KEY, "{oops");
    await render(<ThemeProvider><CollectionScreen /></ThemeProvider>);
    await waitFor(() => expect(screen.getByTestId("collection-count")).toHaveTextContent("0 of 9 charms"));
    expect(screen.getByTestId("collection-title")).toHaveTextContent("Armchair Amateur");
    expect(screen.getAllByLabelText(/not found yet/)).toHaveLength(9);
  });

  it("dresses the cat in an unlocked outfit, keeps the pick, and locks the rest", async () => {
    await seed({ a: { genre: "noir", kind: "key", finish: "gold", at: 1 } });
    await AsyncStorage.setItem(ACCESSORY_KEY, "specs");
    await render(<ThemeProvider><CollectionScreen /></ThemeProvider>);
    await waitFor(() => expect(screen.getByTestId("collection-title")).toHaveTextContent("Keyhole Snoop"));
    // A kept pick she no longer has unlocked still reads as chosen; the others stay locked.
    expect(screen.getByTestId("collection-accessory-specs").props.accessibilityState).toMatchObject({ disabled: true, selected: true });
    expect(screen.getByLabelText("Scarf, locked")).toBeTruthy();
    expect(screen.getByLabelText("The black cat, in round spectacles. Pet the cat")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("collection-accessory-scarf"));
    expect(await AsyncStorage.getItem(ACCESSORY_KEY)).toBe("specs");
    await fireEvent.press(screen.getByTestId("collection-accessory-collar"));
    await waitFor(async () => expect(await AsyncStorage.getItem(ACCESSORY_KEY)).toBe("collar"));
    expect(screen.getByTestId("collection-accessory-collar").props.accessibilityState).toMatchObject({ selected: true });
    await fireEvent.press(screen.getByTestId("collection-accessory-none"));
    await waitFor(async () => expect(await AsyncStorage.getItem(ACCESSORY_KEY)).toBe("none"));
  });

  it("goes back home", async () => {
    await render(<ThemeProvider><CollectionScreen /></ThemeProvider>);
    await fireEvent.press(screen.getByTestId("collection-back"));
    expect(router.back).toHaveBeenCalled();
  });
});

describe("home's charm chip", () => {
  it("names her title and charms, shows a dot for a charm she hasn't seen, and opens the board", async () => {
    expect(charmChipLabel(0, 0)).toBe("Charm board. Armchair Amateur, no charms yet");
    await seed({ a: { genre: "noir", kind: "key", finish: "gold", at: 5 } });
    await render(<CharmChip />);
    await waitFor(() => expect(screen.getByTestId("hub-charms").props.accessibilityLabel).toBe("Charm board. Keyhole Snoop, 1 of 9 charms"));
    expect(screen.getByTestId("hub-charms-new")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("hub-charms"));
    expect(router.push).toHaveBeenCalledWith("/collection");
  });
});

describe("case closed's charm", () => {
  it("is tagged New!, or with the finish a replay lifted it to, and labelled for a screen reader", () => {
    expect(pinTag({ status: "new", finish: "sticker" })).toBe("New!");
    expect(pinTag({ status: "upgraded", finish: "gold" })).toBe("Gold!");
    expect(pinTag({ status: "kept", finish: "gold" })).toBeNull();
    expect(pinLabel({ kind: "candle", finish: "silver", status: "new" })).toBe("New charm: Spirit Candle, silver pin. Pinned to your charm board.");
  });
});

describe("the charms' art", () => {
  it("has every charm in every finish, its hollow, a turn for each pin, and every outfit", () => {
    for (const kind of ALL_CHARMS) {
      for (const finish of FINISHES) expect(CHARM_ART[kind][finish]).toBeTruthy();
      expect(CHARM_ART[kind].hollow).toBeTruthy();
      expect(TURN_ART[kind].gold).toBeTruthy();
      expect(TURN_ART[kind].silver).toBeTruthy();
    }
    for (const a of ["none", ...ACCESSORIES] as const) expect(WEAR_ART[a]).toBeTruthy();
  });

  it("steps through a pin's turn a frame at a time, ending on the still, inside the time it hangs over the page", () => {
    expect(TURN.columns * TURN.rows).toBe(TURN.frames);
    expect(turnFrame(0)).toBe(0);
    expect(turnFrame(0.5)).toBe(5);
    expect(turnFrame(1)).toBe(TURN.frames - 1);
    expect(turnFrame(7)).toBe(TURN.frames - 1);
    expect(TURN_MS).toBe(750);
    expect(TURN_MS).toBeLessThan(PIN.appear + PIN.hold);
  });

  it("an unearned charm is its hollow in the velvet; a locked outfit only its shape", async () => {
    await seed({ a: { genre: "noir", kind: "key", finish: "gold", at: 1 } });
    await render(<ThemeProvider><CollectionScreen /></ThemeProvider>);
    await waitFor(() => expect(screen.getByTestId("collection-title")).toHaveTextContent("Keyhole Snoop"));
    expect(screen.getByTestId("collection-velvet")).toBeTruthy();
    const art = (kind: string) => screen.getByTestId(`collection-charm-${kind}-art`, { includeHiddenElements: true }).props.source as number;
    expect(art("fedora")).toBe(CHARM_ART.fedora.hollow);
    expect(art("key")).toBe(CHARM_ART.key.gold);
  });
});

describe("case closed's turn", () => {
  const pin = (finish: "gold" | "silver" | "sticker", reduced = false) => (
    <PinnedCharm charm={{ kind: "moon", finish, status: "new" }} delay={0} from={{ x: 40, y: 80 }} reduced={reduced} colors={["#FFD9A8"]} tagInk="#2A1620" tagPaper="#FFF" testID="pin" />
  );

  it("a pin turns in the air, then the still takes its place when it's pressed on", async () => {
    jest.useFakeTimers();
    try {
      await render(pin("gold"));
      expect(screen.getByTestId("pin-turn")).toBeTruthy();
      await act(() => jest.advanceTimersByTime(PIN.appear + PIN.hold + PIN.swoop + 50));
      expect(screen.queryByTestId("pin-turn")).toBeNull();
      expect(screen.getByTestId("pin-tag")).toHaveTextContent("New!");
    } finally {
      jest.useRealTimers();
    }
  });

  it("a sticker doesn't turn", async () => {
    await render(pin("sticker"));
    expect(screen.queryByTestId("pin-turn")).toBeNull();
  });

  it("reduced motion: no turn, the still where it lands", async () => {
    await render(pin("silver", true));
    expect(screen.queryByTestId("pin-turn")).toBeNull();
  });
});

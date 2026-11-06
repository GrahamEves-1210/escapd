import AsyncStorage from "@react-native-async-storage/async-storage";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
import { ACCESSORY_KEY, COLLECTION_KEY, loadCollection, unseenCount } from "@/game/collection/store";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { CharmChip, charmChipLabel } from "../CharmChip";
import { CollectionScreen } from "../CollectionScreen";
import { pinLabel, pinTag } from "../PinnedCharm";

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

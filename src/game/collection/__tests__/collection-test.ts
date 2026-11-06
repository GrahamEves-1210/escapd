import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  ACCESSORIES, ALL_CHARMS, CHARM_INFO, MODE_CHARMS, TITLES, charmKindOf, finishFor, nextTitle, pickCharm, titleFor, titleNews, unlockAt, unlockedAccessories,
} from "../charms";
import {
  ACCESSORY_KEY, COLLECTION_KEY, awardCharm, casesClosed, loadAccessory, loadCollection, markBoardSeen, parseCollection,
  resetAwardMemory, saveAccessory, subscribeAccessory, titleIfClosed, unseenCount,
} from "../store";

beforeEach(async () => {
  await AsyncStorage.clear();
  resetAwardMemory();
});

describe("charms", () => {
  it("has three charms per mode, nine in all", () => {
    expect(ALL_CHARMS).toHaveLength(9);
    expect(new Set(ALL_CHARMS).size).toBe(9);
    for (const kinds of Object.values(MODE_CHARMS)) expect(kinds).toHaveLength(3);
  });

  it("gives gold for a clean run, silver for a little help, a sticker otherwise", () => {
    expect(finishFor({ hints: 0, wrong: 0 })).toBe("gold");
    expect(finishFor({ hints: 1, wrong: 2 })).toBe("silver");
    expect(finishFor({ hints: 0, wrong: 3 })).toBe("sticker");
    expect(finishFor({ hints: 4, wrong: 0 })).toBe("sticker");
    expect(finishFor(null)).toBe("sticker");
    expect(finishFor({ hints: 0 })).toBe("sticker");
    expect(finishFor({ hints: NaN, wrong: 0 })).toBe("sticker");
  });

  it("picks the room's own charm, the same every time, and fills the board before repeating", () => {
    const a = pickCharm("noir", "room-a", new Set());
    expect(pickCharm("noir", "room-a", new Set())).toBe(a);
    expect(MODE_CHARMS.noir).toContain(a);
    const owned = new Set([a]);
    const b = pickCharm("noir", "room-a", owned);
    expect(b).not.toBe(a);
    owned.add(b);
    const c = pickCharm("noir", "room-a", owned);
    expect(new Set([a, b, c]).size).toBe(3);
    owned.add(c);
    expect(pickCharm("noir", "room-a", owned)).toBe(a);
  });

  it("has a ladder of titles that grows with cases closed, with outfits on the way", () => {
    expect(TITLES.length).toBeGreaterThanOrEqual(6);
    expect(titleFor(0).title).toBe("Armchair Amateur");
    expect(titleFor(3).title).toBe("Night-Owl Sleuth");
    expect(titleFor(999).title).toBe("Legendary Know-It-All");
    expect(titleFor(-4).title).toBe("Armchair Amateur");
    expect(nextTitle(0)?.at).toBe(1);
    expect(nextTitle(999)).toBeNull();
    expect(unlockedAccessories(0)).toEqual([]);
    expect(unlockedAccessories(1)).toEqual(["collar"]);
    expect(unlockedAccessories(3)).toEqual(["collar", "scarf"]);
    expect(unlockedAccessories(100)).toEqual(["collar", "scarf", "specs", "deerstalker"]);
    for (const a of ACCESSORIES) expect(Number.isFinite(unlockAt(a))).toBe(true);
    expect(titleNews(titleFor(1))).toBe("Now a Keyhole Snoop · a bell collar for the cat");
    expect(titleNews(titleFor(3))).toBe("Now a Night-Owl Sleuth · a knitted scarf for the cat");
    expect(titleNews(titleFor(6))).toBe("Now an Inkwell Inspector · spectacles for the cat");
    expect(titleNews(titleFor(10))).toBe("Now an Unflappable Detective · a deerstalker for the cat");
    expect(titleNews(titleFor(15))).toBe("Now a Legendary Know-It-All");
  });

  it("names its charms and outfits as mystery things, never hearts, bows or flowers", () => {
    const words = [...Object.values(CHARM_INFO).map((c) => c.name), ...ACCESSORIES, ...TITLES.map((t) => t.title)].join(" ");
    expect(words).not.toMatch(/heart|lipstick|kiss|bow\b|flower|beret|tiara/i);
  });

  it("reads an older build's charm under its new name", () => {
    expect(charmKindOf("glass")).toBe("matchbook");
    expect(charmKindOf("matchbook")).toBe("matchbook");
    expect(charmKindOf("toString")).toBeNull();
    expect(charmKindOf(7)).toBeNull();
    const kept = parseCollection(JSON.stringify({ cases: { r: { genre: "noir", kind: "glass", finish: "gold", at: 1 } } }));
    expect(kept.cases.r.kind).toBe("matchbook");
  });
});

describe("the board on the device", () => {
  it("reads missing or corrupt data as an empty board, keeping what still makes sense", () => {
    expect(parseCollection(null).cases).toEqual({});
    expect(parseCollection("{not json").cases).toEqual({});
    expect(parseCollection("42").cases).toEqual({});
    expect(parseCollection('{"cases":[1,2]}').cases).toEqual({});
    const kept = parseCollection(JSON.stringify({
      seenAt: "soon",
      cases: {
        ok: { genre: "noir", kind: "key", finish: "gold", at: 5 },
        badKind: { genre: "noir", kind: "teapot", finish: "gold", at: 5 },
        badGenre: { genre: "space", kind: "key", finish: "gold" },
        noAt: { genre: "paranormal", kind: "moon", finish: "sticker" },
        nothing: null,
      },
    }));
    expect(Object.keys(kept.cases).sort()).toEqual(["noAt", "ok"]);
    expect(kept.cases.noAt.at).toBe(0);
    expect(kept.seenAt).toBe(0);
  });

  it("awards one charm per case, and a replay never awards another", async () => {
    const first = await awardCharm("r1", "noir", { hints: 2, wrong: 0 }, 100);
    expect(first.status).toBe("new");
    expect(first.closed).toBe(1);
    expect(first.charm.finish).toBe("sticker");
    expect(first.title?.title).toBe("Keyhole Snoop");
    resetAwardMemory();
    const again = await awardCharm("r1", "noir", { hints: 3, wrong: 4 }, 200);
    expect(again.status).toBe("kept");
    expect(again.charm).toEqual(first.charm);
    expect(again.title).toBeUndefined();
    expect(casesClosed(await loadCollection())).toBe(1);
  });

  it("lifts a replayed case's finish, never lowers it", async () => {
    await awardCharm("r1", "crime_scene", { hints: 1, wrong: 0 }, 100);
    resetAwardMemory();
    const better = await awardCharm("r1", "crime_scene", { hints: 0, wrong: 0 }, 200);
    expect(better.status).toBe("upgraded");
    expect(better.charm.finish).toBe("gold");
    resetAwardMemory();
    const worse = await awardCharm("r1", "crime_scene", { hints: 5, wrong: 5 }, 300);
    expect(worse.charm.finish).toBe("gold");
    expect((await loadCollection()).cases.r1.at).toBe(200);
  });

  it("answers the same case the same way within a run (case closed mounted twice)", async () => {
    const [a, b] = await Promise.all([awardCharm("r9", "paranormal", { hints: 0, wrong: 0 }), awardCharm("r9", "paranormal", { hints: 0, wrong: 0 })]);
    expect(a.status).toBe("new");
    expect(b).toEqual(a);
    expect(casesClosed(await loadCollection())).toBe(1);
  });

  it("gives different charms to a mode's first cases", async () => {
    const kinds = new Set<string>();
    for (const id of ["a", "b", "c"]) kinds.add((await awardCharm(id, "paranormal", null)).charm.kind);
    expect(kinds.size).toBe(3);
  });

  it("starts over a corrupt board instead of failing", async () => {
    await AsyncStorage.setItem(COLLECTION_KEY, "]]corrupt");
    const award = await awardCharm("r1", "noir", { hints: 0, wrong: 0 });
    expect(award.status).toBe("new");
    expect(casesClosed(await loadCollection())).toBe(1);
  });

  it("still awards (for this run) when the device can't keep it", async () => {
    (AsyncStorage.setItem as jest.Mock).mockImplementationOnce(() => Promise.reject(new Error("full")));
    const award = await awardCharm("r1", "noir", { hints: 0, wrong: 0 });
    expect(award.status).toBe("new");
  });

  it("says which title the case will bring before it is awarded", async () => {
    expect((await titleIfClosed("r1"))?.title).toBe("Keyhole Snoop");
    await awardCharm("r1", "noir", null);
    expect((await titleIfClosed("r1"))?.title).toBe("Keyhole Snoop");
    resetAwardMemory();
    expect(await titleIfClosed("r1")).toBeNull();
    expect(await titleIfClosed("r2")).toBeNull();
    await awardCharm("r2", "noir", null);
    expect((await titleIfClosed("r3"))?.title).toBe("Night-Owl Sleuth");
  });

  it("counts charms as new until the board is seen", async () => {
    await awardCharm("r1", "noir", null, 100);
    await awardCharm("r2", "noir", null, 200);
    expect(unseenCount(await loadCollection())).toBe(2);
    await markBoardSeen(150);
    expect(unseenCount(await loadCollection())).toBe(0);
  });
});

describe("the cat's outfit", () => {
  it("keeps exactly the chosen value under escapd.cat.accessory", async () => {
    expect(await loadAccessory()).toBe("none");
    const heard: string[] = [];
    const off = subscribeAccessory((a) => heard.push(a));
    await saveAccessory("specs");
    expect(await AsyncStorage.getItem(ACCESSORY_KEY)).toBe("specs");
    expect(await loadAccessory()).toBe("specs");
    await saveAccessory("none");
    expect(await AsyncStorage.getItem(ACCESSORY_KEY)).toBe("none");
    off();
    await saveAccessory("deerstalker");
    expect(heard).toEqual(["specs", "none"]);
  });

  it("reads an older build's bell as the collar, and its bow, beret and flowers as none", async () => {
    await AsyncStorage.setItem(ACCESSORY_KEY, "bell");
    expect(await loadAccessory()).toBe("collar");
    for (const old of ["bow", "beret", "flowers"]) {
      await AsyncStorage.setItem(ACCESSORY_KEY, old);
      expect(await loadAccessory()).toBe("none");
    }
  });

  it("reads anything else as none", async () => {
    await AsyncStorage.setItem(ACCESSORY_KEY, "tiara");
    expect(await loadAccessory()).toBe("none");
    await saveAccessory("tiara" as never);
    expect(await AsyncStorage.getItem(ACCESSORY_KEY)).toBe("tiara");
  });
});

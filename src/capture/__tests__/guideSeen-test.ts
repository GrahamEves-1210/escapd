// The photo guide's flag for the room being photographed: no stored key any
// more, the guide shows before every new room.
type GuideSeen = typeof import("../guideSeen");

/** A fresh module (flag false), from its own module registry. */
function load(): GuideSeen {
  let loaded: GuideSeen | undefined;
  jest.isolateModules(() => {
    loaded = jest.requireActual<GuideSeen>("../guideSeen");
  });
  if (!loaded) throw new Error("guideSeen did not load");
  return loaded;
}

describe("capture guide flag for the room", () => {
  it("starts unshown", async () => {
    const { hasSeenCaptureGuide, captureGuideSeenThisSession } = load();
    expect(captureGuideSeenThisSession()).toBe(false);
    await expect(hasSeenCaptureGuide()).resolves.toBe(false);
  });

  it("is shown for the room once the guide marks it, at once", async () => {
    const { markCaptureGuideSeen, hasSeenCaptureGuide, captureGuideSeenThisSession } = load();
    const settled = markCaptureGuideSeen();
    expect(captureGuideSeenThisSession()).toBe(true);
    await expect(settled).resolves.toBeUndefined();
    await expect(hasSeenCaptureGuide()).resolves.toBe(true);
  });

  it("shows again for a new room", () => {
    const { markCaptureGuideSeen, resetCaptureGuide, captureGuideSeenThisSession } = load();
    void markCaptureGuideSeen();
    resetCaptureGuide();
    expect(captureGuideSeenThisSession()).toBe(false);
  });

  it("no longer reads or writes the old per-device key", async () => {
    const storage = jest.requireMock<{ getItem: jest.Mock; setItem: jest.Mock; default?: { getItem: jest.Mock; setItem: jest.Mock } }>(
      "@react-native-async-storage/async-storage",
    );
    const store = storage.default ?? storage;
    store.getItem.mockClear();
    store.setItem.mockClear();
    const { markCaptureGuideSeen, hasSeenCaptureGuide } = load();
    await markCaptureGuideSeen();
    await hasSeenCaptureGuide();
    expect(store.getItem).not.toHaveBeenCalled();
    expect(store.setItem).not.toHaveBeenCalled();
  });
});

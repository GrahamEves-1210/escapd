import type AsyncStorageType from "@react-native-async-storage/async-storage";

type GuideSeen = typeof import("../guideSeen");

type Storage = jest.Mocked<typeof AsyncStorageType>;

/** A fresh module (session flag false) and the storage mock it reads, from one module registry. */
function load(): GuideSeen & { storage: Storage } {
  let loaded: (GuideSeen & { storage: Storage }) | undefined;
  jest.isolateModules(() => {
    // The setup file's AsyncStorage mock is a plain CommonJS object.
    const raw = jest.requireMock<Storage & { default?: Storage }>("@react-native-async-storage/async-storage");
    loaded = { ...jest.requireActual<GuideSeen>("../guideSeen"), storage: raw.default ?? raw };
  });
  if (!loaded) throw new Error("guideSeen did not load");
  return loaded;
}

describe("capture guide seen flag", () => {
  it("uses the per-device key from the spec", () => {
    const { CAPTURE_GUIDE_KEY } = load();
    expect(CAPTURE_GUIDE_KEY).toBe("escapd:onboarding:capture-guide");
  });

  it("is unseen when nothing is stored", async () => {
    const { hasSeenCaptureGuide, captureGuideSeenThisSession } = load();
    await expect(hasSeenCaptureGuide()).resolves.toBe(false);
    expect(captureGuideSeenThisSession()).toBe(false);
  });

  it("reads a stored 1 as seen and keeps it for the session", async () => {
    const { hasSeenCaptureGuide, captureGuideSeenThisSession, storage, CAPTURE_GUIDE_KEY } = load();
    await storage.setItem(CAPTURE_GUIDE_KEY, "1");
    await expect(hasSeenCaptureGuide()).resolves.toBe(true);
    expect(captureGuideSeenThisSession()).toBe(true);

    storage.getItem.mockClear();
    await expect(hasSeenCaptureGuide()).resolves.toBe(true);
    expect(storage.getItem).not.toHaveBeenCalled();
  });

  it("treats any other stored value as unseen", async () => {
    const { hasSeenCaptureGuide, captureGuideSeenThisSession, storage, CAPTURE_GUIDE_KEY } = load();
    await storage.setItem(CAPTURE_GUIDE_KEY, "0");
    await expect(hasSeenCaptureGuide()).resolves.toBe(false);
    expect(captureGuideSeenThisSession()).toBe(false);
  });

  it("treats a failed read as unseen without rejecting", async () => {
    const { hasSeenCaptureGuide, captureGuideSeenThisSession, storage } = load();
    storage.getItem.mockRejectedValueOnce(new Error("storage unavailable"));
    await expect(hasSeenCaptureGuide()).resolves.toBe(false);
    expect(captureGuideSeenThisSession()).toBe(false);
  });

  it("marks the guide seen at once, before the write settles, and stores 1", async () => {
    const { markCaptureGuideSeen, hasSeenCaptureGuide, captureGuideSeenThisSession, storage, CAPTURE_GUIDE_KEY } = load();
    const write = markCaptureGuideSeen();
    expect(captureGuideSeenThisSession()).toBe(true);
    await expect(hasSeenCaptureGuide()).resolves.toBe(true);
    await write;
    await expect(storage.getItem(CAPTURE_GUIDE_KEY)).resolves.toBe("1");
  });

  it("keeps the session flag when the write fails, without rejecting", async () => {
    const { markCaptureGuideSeen, captureGuideSeenThisSession, storage } = load();
    storage.setItem.mockRejectedValueOnce(new Error("disk full"));
    await expect(markCaptureGuideSeen()).resolves.toBeUndefined();
    expect(captureGuideSeenThisSession()).toBe(true);
  });

  it("counts a mark made while a read is still running", async () => {
    const { markCaptureGuideSeen, hasSeenCaptureGuide, storage } = load();
    let finishRead: (value: string | null) => void = () => {};
    storage.getItem.mockImplementationOnce(() => new Promise<string | null>((resolve) => {
      finishRead = resolve;
    }));
    const check = hasSeenCaptureGuide();
    void markCaptureGuideSeen();
    finishRead(null);
    await expect(check).resolves.toBe(true);
  });
});

import { act, renderHook } from "@testing-library/react-native";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { processPhoto, type ProcessedPlate, type RawPhoto } from "../process-photo";
import { addPlate, clearPlates, getPlates } from "../roll";
import { MAX_PLATES } from "../slots";
import { useLibraryImport, type LibraryImportResult } from "../useLibraryImport";

jest.mock("expo-image-picker", () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock("expo-router", () => ({ router: { back: jest.fn() } }));
jest.mock("../process-photo", () => ({ processPhoto: jest.fn() }));

const launch = jest.mocked(ImagePicker.launchImageLibraryAsync);
const process = jest.mocked(processPhoto);
const back = jest.mocked(router.back);

const plateFor = (raw: RawPhoto): ProcessedPlate => ({ uri: raw.uri.replace("picked", "plate"), width: 1200, height: 1600 });
const picked = (...uris: string[]) =>
  ({ canceled: false, assets: uris.map((uri) => ({ uri, width: 3000, height: 4000 })) }) as ImagePicker.ImagePickerResult;
const cancelled = { canceled: true, assets: null } as ImagePicker.ImagePickerResult;

function seedRoll(count: number) {
  for (let i = 0; i < count; i++) addPlate({ uri: `file://old-${i}.jpg`, width: 1200, height: 1600 });
}

/** processPhoto calls that finish only when the test says so. */
function holdProcessing() {
  const pending: { raw: RawPhoto; finish: () => void; fail: () => void }[] = [];
  process.mockImplementation((raw) => new Promise<ProcessedPlate>((resolve, reject) => {
    pending.push({ raw, finish: () => resolve(plateFor(raw)), fail: () => reject(new Error("decode failed")) });
  }));
  return pending;
}

beforeEach(() => {
  jest.clearAllMocks();
  clearPlates();
  process.mockImplementation(async (raw) => plateFor(raw));
});

describe("useLibraryImport", () => {
  it("offers the room left on the roll, then re-encodes and adds each pick in order", async () => {
    seedRoll(1);
    launch.mockResolvedValue(picked("file://picked-a.jpg", "file://picked-b.jpg"));
    const { result } = await renderHook(() => useLibraryImport({ retakeIndex: null }));

    let outcome: LibraryImportResult | null = null;
    await act(async () => {
      outcome = await result.current.pick();
    });

    expect(launch).toHaveBeenCalledWith({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: MAX_PLATES - 1,
      quality: 1,
      exif: false,
    });
    expect(process.mock.calls.map(([raw]) => raw.uri)).toEqual(["file://picked-a.jpg", "file://picked-b.jpg"]);
    expect(getPlates().map((p) => p.uri)).toEqual(["file://old-0.jpg", "file://plate-a.jpg", "file://plate-b.jpg"]);
    expect(outcome).toEqual({ total: 2, added: 2, failed: 0, retaken: false });
    expect(result.current.busy).toBe(false);
    expect(result.current.progress).toBeNull();
    expect(back).not.toHaveBeenCalled();
  });

  it("is busy with real progress while the photos are re-encoded, and idle while the picker is open", async () => {
    let openPicker: (value: ImagePicker.ImagePickerResult) => void = () => {};
    launch.mockImplementation(() => new Promise((resolve) => {
      openPicker = resolve;
    }));
    const pending = holdProcessing();
    const { result } = await renderHook(() => useLibraryImport({ retakeIndex: null }));

    let run: Promise<LibraryImportResult | null> = Promise.resolve(null);
    await act(async () => {
      run = result.current.pick();
    });
    expect(result.current.busy).toBe(false);

    await act(async () => {
      openPicker(picked("file://picked-a.jpg", "file://picked-b.jpg", "file://picked-c.jpg"));
    });
    expect(result.current.busy).toBe(true);
    expect(result.current.progress).toEqual({ done: 0, total: 3 });

    await act(async () => pending[0].finish());
    expect(result.current.progress).toEqual({ done: 1, total: 3 });

    await act(async () => pending[1].finish());
    expect(result.current.progress).toEqual({ done: 2, total: 3 });

    await act(async () => {
      pending[2].finish();
      await run;
    });
    expect(result.current.busy).toBe(false);
    expect(result.current.progress).toBeNull();
    expect(getPlates()).toHaveLength(3);
  });

  it("keeps going after a photo fails and counts the failure", async () => {
    launch.mockResolvedValue(picked("file://picked-a.jpg", "file://picked-b.jpg", "file://picked-c.jpg"));
    process.mockImplementation(async (raw) => {
      if (raw.uri.endsWith("a.jpg")) throw new Error("decode failed");
      return plateFor(raw);
    });
    const { result } = await renderHook(() => useLibraryImport({ retakeIndex: null }));

    let outcome: LibraryImportResult | null = null;
    await act(async () => {
      outcome = await result.current.pick();
    });

    expect(outcome).toEqual({ total: 3, added: 2, failed: 1, retaken: false });
    expect(getPlates().map((p) => p.uri)).toEqual(["file://plate-b.jpg", "file://plate-c.jpg"]);
  });

  it("takes no more than the room left, even if the picker returns more", async () => {
    seedRoll(MAX_PLATES - 1);
    launch.mockResolvedValue(picked("file://picked-a.jpg", "file://picked-b.jpg"));
    const { result } = await renderHook(() => useLibraryImport({ retakeIndex: null }));

    let outcome: LibraryImportResult | null = null;
    await act(async () => {
      outcome = await result.current.pick();
    });

    expect(launch).toHaveBeenCalledWith(expect.objectContaining({ allowsMultipleSelection: false, selectionLimit: 1 }));
    expect(outcome).toEqual({ total: 1, added: 1, failed: 0, retaken: false });
    expect(getPlates()).toHaveLength(MAX_PLATES);
  });

  it("does nothing on a full roll", async () => {
    seedRoll(MAX_PLATES);
    const { result } = await renderHook(() => useLibraryImport({ retakeIndex: null }));
    await act(async () => {
      await expect(result.current.pick()).resolves.toBeNull();
    });
    expect(launch).not.toHaveBeenCalled();
  });

  it("resolves null when the picker is cancelled or can't open", async () => {
    const { result } = await renderHook(() => useLibraryImport({ retakeIndex: null }));

    launch.mockResolvedValueOnce(cancelled);
    await act(async () => {
      await expect(result.current.pick()).resolves.toBeNull();
    });

    launch.mockRejectedValueOnce(new Error("no photo library"));
    await act(async () => {
      await expect(result.current.pick()).resolves.toBeNull();
    });

    expect(process).not.toHaveBeenCalled();
    expect(getPlates()).toHaveLength(0);
    expect(result.current.busy).toBe(false);
  });

  it("ignores a second pick while one is running", async () => {
    launch.mockResolvedValue(picked("file://picked-a.jpg"));
    const pending = holdProcessing();
    const { result } = await renderHook(() => useLibraryImport({ retakeIndex: null }));

    let first: Promise<LibraryImportResult | null> = Promise.resolve(null);
    await act(async () => {
      first = result.current.pick();
    });
    await act(async () => {
      await expect(result.current.pick()).resolves.toBeNull();
    });
    expect(launch).toHaveBeenCalledTimes(1);

    await act(async () => {
      pending[0].finish();
      await first;
    });
    expect(getPlates()).toHaveLength(1);
  });

  describe("retake mode", () => {
    it("picks one photo, replaces the plate and returns to the light table", async () => {
      seedRoll(3);
      launch.mockResolvedValue(picked("file://picked-new.jpg"));
      const { result } = await renderHook(() => useLibraryImport({ retakeIndex: 1 }));

      let outcome: LibraryImportResult | null = null;
      await act(async () => {
        outcome = await result.current.pick();
      });

      expect(launch).toHaveBeenCalledWith(expect.objectContaining({ allowsMultipleSelection: false, selectionLimit: 1 }));
      expect(getPlates().map((p) => p.uri)).toEqual(["file://old-0.jpg", "file://plate-new.jpg", "file://old-2.jpg"]);
      expect(outcome).toEqual({ total: 1, added: 1, failed: 0, retaken: true });
      expect(back).toHaveBeenCalledTimes(1);
    });

    it("works on a full roll, since it replaces a plate", async () => {
      seedRoll(MAX_PLATES);
      launch.mockResolvedValue(picked("file://picked-new.jpg"));
      const { result } = await renderHook(() => useLibraryImport({ retakeIndex: MAX_PLATES - 1 }));
      await act(async () => {
        await result.current.pick();
      });
      expect(getPlates()[MAX_PLATES - 1].uri).toBe("file://plate-new.jpg");
      expect(back).toHaveBeenCalledTimes(1);
    });

    it("stays put with the plate unchanged when the photo can't be used", async () => {
      seedRoll(3);
      launch.mockResolvedValue(picked("file://picked-new.jpg"));
      process.mockRejectedValue(new Error("decode failed"));
      const { result } = await renderHook(() => useLibraryImport({ retakeIndex: 2 }));

      let outcome: LibraryImportResult | null = null;
      await act(async () => {
        outcome = await result.current.pick();
      });

      expect(outcome).toEqual({ total: 1, added: 0, failed: 1, retaken: false });
      expect(getPlates()[2].uri).toBe("file://old-2.jpg");
      expect(back).not.toHaveBeenCalled();
    });

    it("drops the photo when the screen closed before it was ready", async () => {
      seedRoll(3);
      launch.mockResolvedValue(picked("file://picked-new.jpg"));
      const pending = holdProcessing();
      const { result, unmount } = await renderHook(() => useLibraryImport({ retakeIndex: 0 }));

      let run: Promise<LibraryImportResult | null> = Promise.resolve(null);
      await act(async () => {
        run = result.current.pick();
      });
      await unmount();
      pending[0].finish();

      await expect(run).resolves.toBeNull();
      expect(getPlates()[0].uri).toBe("file://old-0.jpg");
      expect(back).not.toHaveBeenCalled();
    });
  });
});

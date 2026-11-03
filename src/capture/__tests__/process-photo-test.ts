import { centreCrop, processPhoto } from "@/capture/process-photo";

// The manipulator as a chain: manipulate(source) -> crop(rect) -> renderAsync() -> image; each render a new image.
type Img = { width: number; height: number; saveAsync: jest.Mock };
const mockCalls: { sources: unknown[]; crops: unknown[] } = { sources: [], crops: [] };
let mockDecoded = { width: 0, height: 0 };
jest.mock("expo-image-manipulator", () => {
  const image = (width: number, height: number): Img => ({
    width,
    height,
    saveAsync: jest.fn(async () => ({ uri: `file://out-${width}x${height}.jpg`, width, height })),
  });
  return {
    SaveFormat: { JPEG: "jpeg" },
    ImageManipulator: {
      manipulate: jest.fn((source: unknown) => {
        mockCalls.sources.push(source);
        let crop: { width: number; height: number } | null = null;
        const context = {
          crop: (rect: { width: number; height: number }) => {
            mockCalls.crops.push(rect);
            crop = rect;
            return context;
          },
          renderAsync: async () => (crop ? image(crop.width, crop.height) : image(mockDecoded.width, mockDecoded.height)),
        };
        return context;
      }),
    },
  };
});

beforeEach(() => {
  mockCalls.sources = [];
  mockCalls.crops = [];
});

describe("centreCrop", () => {
  it("cuts a 3:4 frame to 9:16 across its middle, whole pixels inside the image", () => {
    expect(centreCrop(1536, 2048, 9 / 16)).toEqual({ originX: 192, originY: 0, width: 1152, height: 2048 });
    // Odd sizes: never past the edge.
    const odd = centreCrop(1537, 2047, 9 / 16)!;
    expect(odd.originX + odd.width).toBeLessThanOrEqual(1537);
    expect(odd.height).toBe(2047);
  });

  it("cuts a frame too tall from top and bottom, and leaves one already the shape alone", () => {
    expect(centreCrop(1000, 3000, 9 / 16)).toEqual({ originX: 0, originY: 611, width: 1000, height: 1778 });
    expect(centreCrop(1152, 2048, 9 / 16)).toBeNull();
    expect(centreCrop(0, 2048, 9 / 16)).toBeNull();
  });
});

describe("processPhoto", () => {
  it("crops on the decoded image, whichever way round the camera reported its size", async () => {
    // The camera says landscape, the decoded file is upright: the crop follows the file.
    mockDecoded = { width: 1536, height: 2048 };
    const plate = await processPhoto({ uri: "file://shot.jpg", width: 4032, height: 3024 }, 9 / 16);
    expect(mockCalls.crops).toEqual([{ originX: 192, originY: 0, width: 1152, height: 2048 }]);
    expect(plate).toEqual({ uri: "file://out-1152x2048.jpg", width: 1152, height: 2048 });
    // The second pass works on the decoded image, not the file again.
    expect(mockCalls.sources[0]).toBe("file://shot.jpg");
    expect(mockCalls.sources[1]).toMatchObject({ width: 1536, height: 2048 });
  });

  it("re-encodes without cropping when no frame is given", async () => {
    mockDecoded = { width: 1536, height: 2048 };
    const plate = await processPhoto({ uri: "file://lib.jpg", width: 1536, height: 2048 });
    expect(mockCalls.crops).toEqual([]);
    expect(plate.width).toBe(1536);
  });
});

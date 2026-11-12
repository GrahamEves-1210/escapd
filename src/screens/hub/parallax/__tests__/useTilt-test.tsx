// Home's tilt on a phone (useTilt) and a layer sliding by it (ParallaxLayer): the sensor is only listened to
// while home is in front and the app is active, a tilt moves the layers by their depth (opposite ways behind
// and in front of the sill), a still hand moves nothing, and a pinned tilt (development) holds for screenshots.
import { act, render, screen } from "@testing-library/react-native";
import { AppState, Text, type AppStateStatus } from "react-native";
import { getAnimatedStyle } from "react-native-reanimated";
import { PARALLAX } from "../../art/nook";
import { ParallaxLayer } from "../ParallaxLayer";
import { useTilt } from "../useTilt";

type MockListener = (sample: unknown) => void;
jest.mock("expo-sensors", () => {
  const listeners = new Set<MockListener>();
  return {
    DeviceMotion: {
      isAvailableAsync: jest.fn(async () => true),
      setUpdateInterval: jest.fn(),
      addListener: jest.fn((fn: MockListener) => {
        listeners.add(fn);
        return { remove: () => listeners.delete(fn) };
      }),
    },
    mockMotion: { listeners },
  };
});
const sensors = jest.requireMock<{
  DeviceMotion: { isAvailableAsync: jest.Mock; addListener: jest.Mock; setUpdateInterval: jest.Mock };
  mockMotion: { listeners: Set<MockListener> };
}>("expo-sensors");

const G = 9.81;
/** A sample from a phone pitched back 45 degrees and rolled `roll` radians to the right. */
const sample = (roll: number, pitch = Math.PI / 4) => ({
  accelerationIncludingGravity: { x: G * Math.sin(roll), y: -G * Math.cos(roll) * Math.cos(pitch), z: -G * Math.cos(roll) * Math.sin(pitch) },
});
const send = (s: unknown) => act(async () => {
  for (const fn of sensors.mockMotion.listeners) fn(s);
});
const settle = () => act(async () => {
  jest.advanceTimersByTime(1500);
});
const pin = (x: number | null, y?: number) => act(async () => {
  (globalThis as { __ESCAPD_TILT__?: (x: number | null, y?: number) => void }).__ESCAPD_TILT__?.(x, y);
});

function Scene({ enabled }: { enabled: boolean }) {
  const tilt = useTilt(enabled);
  return (
    <>
      <ParallaxLayer tilt={tilt} depth={PARALLAX.depth.sky} testID="far"><Text>sky</Text></ParallaxLayer>
      <ParallaxLayer tilt={tilt} depth={PARALLAX.depth.sill} testID="sill"><Text>sill</Text></ParallaxLayer>
      <ParallaxLayer tilt={tilt} depth={PARALLAX.depth.fore} turn={PARALLAX.turn} testID="near"><Text>curtain</Text></ParallaxLayer>
    </>
  );
}

interface Move { translateX?: number; translateY?: number; rotate?: string }
const slide = (id: string) => {
  const moves = ((getAnimatedStyle as unknown as (node: unknown) => { transform?: Move[] })(screen.getByTestId(id)).transform ?? []) as Move[];
  return { x: moves.find((m) => m.translateX !== undefined)?.translateX ?? 0, y: moves.find((m) => m.translateY !== undefined)?.translateY ?? 0 };
};

describe("home's tilt", () => {
  let appState: ((state: AppStateStatus) => void) | undefined;
  // Reanimated's frame callbacks start up on the first real frame: let one go by before the fake clock takes over.
  beforeAll(async () => {
    const warm = await render(<Scene enabled={false} />);
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    await warm.unmount();
  });
  beforeEach(() => {
    jest.useFakeTimers();
    sensors.mockMotion.listeners.clear();
    sensors.DeviceMotion.addListener.mockClear();
    jest.spyOn(AppState, "addEventListener").mockImplementation((_type, handler) => {
      appState = handler as (state: AppStateStatus) => void;
      return { remove: () => (appState = undefined) } as ReturnType<typeof AppState.addEventListener>;
    });
  });
  afterEach(async () => {
    await pin(null);
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("listens only while home is in front, at the sensor's pace, and lets go when it isn't", async () => {
    const view = await render(<Scene enabled={false} />);
    await settle();
    expect(sensors.DeviceMotion.addListener).not.toHaveBeenCalled();
    await view.rerender(<Scene enabled />);
    await settle();
    expect(sensors.DeviceMotion.setUpdateInterval).toHaveBeenLastCalledWith(PARALLAX.interval);
    expect(sensors.mockMotion.listeners.size).toBe(1);
    await view.rerender(<Scene enabled={false} />);
    expect(sensors.mockMotion.listeners.size).toBe(0);
    await view.unmount();
  });

  it("slides the layers by their depth as the phone tilts: the far ones with the eye, the curtains against it, the sill never", async () => {
    const view = await render(<Scene enabled />);
    await settle();
    // However it is first held is rest.
    await send(sample(0.05));
    expect(slide("far")).toEqual({ x: 0, y: 0 });
    // The right edge dips half the range: the scene is seen from the left. A tremble inside the dead band right after moves nothing.
    jest.setSystemTime(Date.now() + PARALLAX.interval);
    await send(sample(0.05 + PARALLAX.range / 2));
    jest.setSystemTime(Date.now() + PARALLAX.interval);
    await send(sample(0.05 + PARALLAX.range / 2 + PARALLAX.range * PARALLAX.dead * 0.3));
    await settle();
    const far = slide("far"), near = slide("near"), sill = slide("sill");
    // (The rest pose has drifted one sample's worth toward the new pose.)
    expect(far.x).toBeCloseTo(-0.5 * Math.exp(-PARALLAX.interval / 1000 / PARALLAX.recentre) * PARALLAX.depth.sky, 3);
    expect(near.x).toBeGreaterThan(-PARALLAX.depth.fore * 0.4);
    expect(Math.abs(far.y)).toBeLessThan(0.2);
    expect(Math.abs(sill.x) + Math.abs(sill.y)).toBe(0);
    await view.unmount();
  });

  it("stops listening when the app leaves the front, the layers gliding back to rest, and listens again when it is back", async () => {
    const view = await render(<Scene enabled />);
    await settle();
    await send(sample(0));
    jest.setSystemTime(Date.now() + PARALLAX.interval);
    await send(sample(PARALLAX.range));
    await settle();
    expect(slide("far").x).toBeLessThan(-1);
    await act(async () => appState?.("background"));
    await settle();
    expect(sensors.mockMotion.listeners.size).toBe(0);
    expect(slide("far").x).toBeCloseTo(0, 3);
    await act(async () => appState?.("active"));
    await settle();
    expect(sensors.mockMotion.listeners.size).toBe(1);
    await view.unmount();
  });

  it("holds a tilt pinned by hand (development, for screenshots) whatever the sensor says, until it is let go", async () => {
    const view = await render(<Scene enabled />);
    await settle();
    await pin(1, -1);
    expect(slide("far")).toEqual({ x: PARALLAX.depth.sky, y: -PARALLAX.depth.sky * PARALLAX.vertical });
    expect(slide("near").x).toBe(PARALLAX.depth.fore);
    await send(sample(0));
    jest.setSystemTime(Date.now() + PARALLAX.interval);
    await send(sample(-PARALLAX.range));
    await settle();
    expect(slide("far").x).toBe(PARALLAX.depth.sky);
    await pin(null);
    expect(slide("far")).toEqual({ x: 0, y: 0 });
    await view.unmount();
  });
});

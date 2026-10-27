import { AccessibilityInfo, Platform } from "react-native";
import { act, render, screen } from "@testing-library/react-native";
import { dialPoint, dialStops } from "@/capture/turn";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { ref } from "@/theme/tokens";
import { COPY } from "../copy";
import { TurnDial, type TurnDialProps } from "../TurnDial";
import { resetTurnSensorForTests } from "../useTurnTracking";

// A DeviceMotion the test drives: availability, and samples sent to every listener.
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
const announce = jest.mocked(AccessibilityInfo.announceForAccessibility);
const hidden = { includeHiddenElements: true } as const;

let clock = 0;
/** The phone upright (gravity down its y axis), turning at `rate` deg/s for `seconds`, 30 samples a second (iOS axes: beta is y). */
async function turn(rate: number, seconds: number) {
  await act(async () => {
    const samples = Math.round(seconds * 30);
    for (let i = 0; i <= samples; i += 1) {
      clock += i === 0 ? 0 : 1 / 30;
      const sample = {
        rotationRate: { alpha: 0, beta: rate, gamma: 0, timestamp: clock },
        accelerationIncludingGravity: { x: 0, y: -9.8, z: 0, timestamp: clock },
      };
      for (const fn of sensors.mockMotion.listeners) fn(sample);
    }
  });
}

const flush = () => act(async () => {});

function props(overrides: Partial<TurnDialProps> = {}): TurnDialProps {
  return {
    stops: dialStops(6),
    taken: [true, false, false, false, false, false],
    target: 1,
    listening: true,
    active: true,
    resetKey: "shot-1",
    line: "Photo 2 of 6",
    accessibilityLabel: (reached) => (reached ? `Photo 2 of 6. ${COPY.turnReached}` : "Photo 2 of 6."),
    onReached: jest.fn(),
    ...overrides,
  };
}

const arc = () => screen.queryByTestId("turn-dial-arc", hidden);
const arcEnd = () => {
  const d = arc()?.props.d as string;
  const [x, y] = d.split(" ").slice(-2).map(Number);
  return { x, y };
};

beforeEach(() => {
  jest.clearAllMocks();
  resetTurnSensorForTests();
  sensors.DeviceMotion.isAvailableAsync.mockResolvedValue(true);
  sensors.mockMotion.listeners.clear();
  clock = 100;
});

describe("turn dial: the static face", () => {
  it("counts the photo and draws a stop for each: taken white, the next a white ring, the rest grey", async () => {
    await render(<TurnDial {...props({ active: false, taken: [true, true, false, false, false, false], target: 2 })} />);
    expect(screen.getByText("Photo 2 of 6", hidden)).toBeTruthy();
    expect(screen.getAllByTestId("turn-dial-taken", hidden)).toHaveLength(2);
    expect(screen.getAllByTestId("turn-dial-rest", hidden)).toHaveLength(3);
    // White like the taken dots, but hollow (the void inside).
    const target = screen.getByTestId("turn-dial-target", hidden);
    const white = screen.getAllByTestId("turn-dial-taken", hidden)[0].props.fill;
    expect(target.props.stroke).toEqual(white);
    expect(target.props.fill).not.toEqual(white);
    expect(arc()).toBeNull();
    // One screen-reader element with the count; the face and the line are hidden.
    expect(screen.getByTestId("turn-dial").props.accessibilityLabel).toBe("Photo 2 of 6.");
  });

  it("is the privacy note's see-through black pill, top-centred on the feed", async () => {
    const T = ref.layout.camera.turn;
    await render(<TurnDial {...props({ active: false })} />);
    expect(screen.getByTestId("turn-dial").props.style).toMatchObject({ position: "absolute", top: T.inset, alignItems: "center" });
    expect(screen.getByTestId("turn-dial-fill", hidden).props.style).toMatchObject({
      backgroundColor: ref.color.void,
      opacity: ref.layout.camera.note.fillOpacity,
    });
    expect(screen.getByTestId("turn-dial-face", hidden).props).toMatchObject({ width: T.dial, height: T.dial });
  });

  it("shows every stop taken and no target once all 6 are", async () => {
    await render(<TurnDial {...props({ active: false, taken: Array(6).fill(true), target: null, line: "6 of 6 taken" })} />);
    expect(screen.getAllByTestId("turn-dial-taken", hidden)).toHaveLength(6);
    expect(screen.queryByTestId("turn-dial-target", hidden)).toBeNull();
  });

  it("draws 0.5x's five stops 72 apart: photo 3 at 144", async () => {
    await render(<TurnDial {...props({ active: false, stops: dialStops(5), taken: [true, true, false, false, false], target: 2, line: "Photo 3 of 5" })} />);
    expect(screen.getAllByTestId("turn-dial-taken", hidden)).toHaveLength(2);
    expect(screen.getAllByTestId("turn-dial-rest", hidden)).toHaveLength(2);
    const C = ref.layout.camera.turn.dial / 2;
    const R = C - ref.layout.camera.turn.ring;
    const at = dialPoint(C, C, R, 144);
    const target = screen.getByTestId("turn-dial-target", hidden);
    expect(target.props.cx).toBeCloseTo(at.x, 5);
    expect(target.props.cy).toBeCloseTo(at.y, 5);
  });
});

describe("turn dial: live tracking", () => {
  it("grows the arc from the last stop as the phone turns, then fills the next stop with one light tick", async () => {
    const onReached = jest.fn();
    await render(<TurnDial {...props({ onReached })} />);
    await flush();
    expect(sensors.DeviceMotion.addListener).toHaveBeenCalledTimes(1);
    expect(sensors.DeviceMotion.setUpdateInterval).toHaveBeenCalled();
    await turn(60, 0.5);
    // Half a turn: the arc runs from stop 1 (top) clockwise to 30 degrees.
    expect(arc()).toBeTruthy();
    const C = ref.layout.camera.turn.dial / 2;
    const R = C - ref.layout.camera.turn.ring;
    expect(arcEnd().x).toBeCloseTo(C + R * Math.sin(Math.PI / 6), 1);
    expect(arcEnd().y).toBeCloseTo(C - R * Math.cos(Math.PI / 6), 1);
    expect(onReached).not.toHaveBeenCalled();
    expect(screen.getByTestId("turn-dial-target", hidden)).toBeTruthy();
    await turn(60, 0.5);
    expect(onReached).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("turn-dial-target-reached", hidden).props.fill).toEqual(screen.getByTestId("turn-dial-taken", hidden).props.fill);
    expect(announce).toHaveBeenCalledWith(COPY.turnReached);
    expect(screen.getByTestId("turn-dial").props.accessibilityLabel).toBe(`Photo 2 of 6. ${COPY.turnReached}`);
    // Turning on: no second tick for the same photo.
    await turn(60, 0.5);
    expect(onReached).toHaveBeenCalledTimes(1);
  });

  it("counts a turn to the left too, and ignores tremor", async () => {
    const onReached = jest.fn();
    await render(<TurnDial {...props({ onReached })} />);
    await flush();
    await turn(1, 3);
    expect(arc()).toBeNull();
    await turn(-60, 1);
    expect(onReached).toHaveBeenCalledTimes(1);
  });

  it("starts the turn again with each new photo", async () => {
    const onReached = jest.fn();
    const view = await render(<TurnDial {...props({ onReached })} />);
    await flush();
    await turn(60, 1);
    expect(onReached).toHaveBeenCalledTimes(1);
    await view.rerender(<TurnDial {...props({ onReached, taken: [true, true, false, false, false, false], target: 2, resetKey: "shot-2" })} />);
    await flush();
    expect(arc()).toBeNull();
    expect(screen.getByTestId("turn-dial-target", hidden)).toBeTruthy();
    await turn(60, 1);
    expect(onReached).toHaveBeenCalledTimes(2);
  });

  it("steps the arc in quarters under Reduce Motion instead of sweeping", async () => {
    await render(
      <ThemeProvider reducedMotion>
        <TurnDial {...props()} />
      </ThemeProvider>,
    );
    await flush();
    await turn(60, 0.2);
    // 12 degrees is under a quarter: nothing drawn yet.
    expect(arc()).toBeNull();
    await turn(60, 0.2);
    // 24 degrees: still the first quarter, drawn as 15.
    const C = ref.layout.camera.turn.dial / 2;
    const R = C - ref.layout.camera.turn.ring;
    expect(arcEnd().x).toBeCloseTo(C + R * Math.sin(Math.PI / 12), 1);
  });

  it("hides the turn while inactive but keeps counting it, and stops listening when told to", async () => {
    const view = await render(<TurnDial {...props()} />);
    await flush();
    expect(sensors.mockMotion.listeners.size).toBe(1);
    await turn(60, 0.25);
    expect(arc()).toBeTruthy();
    await view.rerender(<TurnDial {...props({ active: false })} />);
    expect(sensors.mockMotion.listeners.size).toBe(1);
    expect(arc()).toBeNull();
    await view.rerender(<TurnDial {...props({ listening: false, active: false })} />);
    expect(sensors.mockMotion.listeners.size).toBe(0);
    expect(arc()).toBeNull();
  });

  it("counts a turn made while hidden (the busy wait after the shutter) and ticks as soon as it shows", async () => {
    const onReached = jest.fn();
    const view = await render(<TurnDial {...props({ onReached, active: false })} />);
    await flush();
    // The shutter fired (a new key) and the player turned on while the photo was prepared.
    await view.rerender(<TurnDial {...props({ onReached, active: false, resetKey: "shot-2" })} />);
    await turn(60, 0.5);
    expect(onReached).not.toHaveBeenCalled();
    await view.rerender(<TurnDial {...props({ onReached, resetKey: "shot-2" })} />);
    await flush();
    // Half the turn already made: the arc shows it, and the rest reaches the stop.
    expect(arc()).toBeTruthy();
    await turn(60, 0.5);
    expect(onReached).toHaveBeenCalledTimes(1);
  });

  it("measures a re-spaced turn from the stop before the target (54 after a switch to 1x)", async () => {
    const onReached = jest.fn();
    const stops = [0, 72, 144, 198, 252, 306];
    await render(<TurnDial {...props({ onReached, stops, taken: [true, true, true, false, false, false], target: 3 })} />);
    await flush();
    // 50 of 54: not yet far enough; 52 is.
    await turn(50, 1);
    expect(onReached).not.toHaveBeenCalled();
    await turn(60, 1 / 30);
    expect(onReached).toHaveBeenCalledTimes(1);
  });

  it("keeps the turn when the step changes mid-turn (a lens switch), measuring it against the new step", async () => {
    const onReached = jest.fn();
    const view = await render(<TurnDial {...props({ onReached })} />);
    await flush();
    await turn(60, 0.5);
    expect(onReached).not.toHaveBeenCalled();
    // 30 degrees turned; a plan of 40-degree turns: 75 % there, not back to 0.
    await view.rerender(<TurnDial {...props({ onReached, stops: dialStops(9) })} />);
    const C = ref.layout.camera.turn.dial / 2;
    const R = C - ref.layout.camera.turn.ring;
    await turn(60, 0.1);
    // 36 of 40: the arc from stop 1 (top) runs 0.9 of a 40-degree turn.
    expect(arcEnd().x).toBeCloseTo(C + R * Math.sin((36 * Math.PI) / 180), 0);
    expect(onReached).not.toHaveBeenCalled();
    await turn(60, 0.05);
    expect(onReached).toHaveBeenCalledTimes(1);
  });
});

describe("turn dial: no sensor", () => {
  it("stays static where the phone has no motion sensor", async () => {
    sensors.DeviceMotion.isAvailableAsync.mockResolvedValue(false);
    const onReached = jest.fn();
    await render(<TurnDial {...props({ onReached })} />);
    await flush();
    expect(sensors.DeviceMotion.addListener).not.toHaveBeenCalled();
    expect(screen.getByText("Photo 2 of 6", hidden)).toBeTruthy();
    expect(screen.getByTestId("turn-dial-target", hidden)).toBeTruthy();
    expect(arc()).toBeNull();
  });

  it("stays static when the availability check fails, or the sensor sends no rotation rate", async () => {
    sensors.DeviceMotion.isAvailableAsync.mockRejectedValue(new Error("no sensor"));
    await render(<TurnDial {...props()} />);
    await flush();
    expect(sensors.DeviceMotion.addListener).not.toHaveBeenCalled();
    resetTurnSensorForTests();
    sensors.DeviceMotion.isAvailableAsync.mockResolvedValue(true);
    await render(<TurnDial {...props()} />);
    await flush();
    await act(async () => {
      for (const fn of sensors.mockMotion.listeners) fn({ rotationRate: null, accelerationIncludingGravity: { x: 0, y: -9.8, z: 0 } });
    });
    expect(arc()).toBeNull();
  });

  it("never asks the sensor on the web", async () => {
    const os = Platform.OS;
    Object.defineProperty(Platform, "OS", { get: () => "web", configurable: true });
    try {
      await render(<TurnDial {...props()} />);
      await flush();
      expect(sensors.DeviceMotion.isAvailableAsync).not.toHaveBeenCalled();
      expect(sensors.DeviceMotion.addListener).not.toHaveBeenCalled();
      expect(screen.getByText("Photo 2 of 6", hidden)).toBeTruthy();
    } finally {
      Object.defineProperty(Platform, "OS", { get: () => os, configurable: true });
    }
  });
});

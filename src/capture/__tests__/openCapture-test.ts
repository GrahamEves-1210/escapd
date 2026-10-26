import { router } from "expo-router";
import { getMode, setMode } from "@/game/mode";
import * as api from "@/lib/escapd-api";
import type { MyAccess } from "@/lib/puzzle-types";
import { resetCaptureGuide } from "../guideSeen";
import { openCapture } from "../openCapture";
import { currentTicket, getRollGenre, setRollGenre, setTicketRoom } from "../roll";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn() },
}));

jest.mock("@/lib/escapd-api", () => ({
  ensureSession: jest.fn(),
  getMyAccess: jest.fn(),
}));

jest.mock("../guideSeen", () => ({
  resetCaptureGuide: jest.fn(),
}));

const mocked = api as jest.Mocked<typeof api>;
const push = jest.mocked(router.push);
const replace = jest.mocked(router.replace);
const reset = jest.mocked(resetCaptureGuide);

const access = (overrides: Partial<MyAccess> = {}): MyAccess => ({
  user_id: "u1", is_anonymous: false, tutorial_completed: true, has_custom_rooms_entitlement: true,
  entitlement_status: "active", entitlement_expires_at: null, will_renew: null, can_generate: true,
  generations_used: 0, generations_cap: 20, min_photos_per_room: 3, max_photos_per_room: 6, ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  setMode(null);
  setRollGenre(null);
  mocked.ensureSession.mockResolvedValue({} as Awaited<ReturnType<typeof api.ensureSession>>);
  mocked.getMyAccess.mockResolvedValue(access());
});

describe("openCapture", () => {
  it("starts a session before it checks access", async () => {
    const calls: string[] = [];
    mocked.ensureSession.mockImplementation(async () => {
      calls.push("session");
      return {} as Awaited<ReturnType<typeof api.ensureSession>>;
    });
    mocked.getMyAccess.mockImplementation(async () => {
      calls.push("access");
      return access();
    });
    await openCapture();
    expect(calls).toEqual(["session", "access"]);
  });

  it("sends a guest to add an email, before any other rule", async () => {
    mocked.getMyAccess.mockResolvedValue(access({ is_anonymous: true, has_custom_rooms_entitlement: false, can_generate: false }));
    await expect(openCapture()).resolves.toBe("account");
    expect(push).toHaveBeenCalledWith({ pathname: "/account", params: { next: "back" } });
  });

  it("sends a player without the custom_rooms entitlement to /pro with the cap", async () => {
    mocked.getMyAccess.mockResolvedValue(access({ has_custom_rooms_entitlement: false, can_generate: false, generations_cap: 12 }));
    await expect(openCapture()).resolves.toBe("pro");
    expect(push).toHaveBeenCalledWith({ pathname: "/pro", params: { cap: "12" } });
  });

  it("sends an entitled player at the monthly cap to develop's cap state", async () => {
    mocked.getMyAccess.mockResolvedValue(access({ can_generate: false }));
    await expect(openCapture()).resolves.toBe("develop");
    expect(push).toHaveBeenCalledWith({ pathname: "/capture/develop", params: { from: "hub" } });
  });

  it("shows the photo guide before every new room, starting the room's guide flag afresh first", async () => {
    await expect(openCapture()).resolves.toBe("guide");
    expect(push).toHaveBeenCalledWith("/capture/guide");
    await expect(openCapture()).resolves.toBe("guide");
    expect(push).toHaveBeenLastCalledWith("/capture/guide");
    expect(reset).toHaveBeenCalledTimes(2);
    // Cleared before the check runs, so a caller that falls back to /capture offline still meets the guide.
    expect(reset.mock.invocationCallOrder[0]).toBeLessThan(mocked.ensureSession.mock.invocationCallOrder[0]);
  });

  it("clears the room's guide flag even when the check then fails", async () => {
    mocked.ensureSession.mockRejectedValue(new Error("Network request failed"));
    await expect(openCapture()).rejects.toThrow("Network request failed");
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("goes straight to the camera with skipGuide (the guide's own continue), keeping the room's flag", async () => {
    await expect(openCapture({ skipGuide: true })).resolves.toBe("capture");
    expect(push).toHaveBeenCalledWith("/capture");
    expect(reset).not.toHaveBeenCalled();
  });

  it("still applies the access rules with skipGuide", async () => {
    mocked.getMyAccess.mockResolvedValue(access({ has_custom_rooms_entitlement: false }));
    await expect(openCapture({ replace: true, skipGuide: true })).resolves.toBe("pro");
    expect(replace).toHaveBeenCalledWith({ pathname: "/pro", params: { cap: "20" } });
  });

  it("replaces instead of pushing when asked", async () => {
    await expect(openCapture({ replace: true })).resolves.toBe("guide");
    expect(replace).toHaveBeenCalledWith("/capture/guide");
    expect(push).not.toHaveBeenCalled();
  });

  it("rejects without navigating when the session can't start", async () => {
    mocked.ensureSession.mockRejectedValue(new Error("Network request failed"));
    await expect(openCapture()).rejects.toThrow("Network request failed");
    expect(mocked.getMyAccess).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("rejects without navigating when access can't be checked", async () => {
    mocked.getMyAccess.mockRejectedValue(new Error("Internal server error"));
    await expect(openCapture({ replace: true })).rejects.toThrow("Internal server error");
    expect(push).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("navigates nowhere once its signal is aborted", async () => {
    const controller = new AbortController();
    mocked.getMyAccess.mockImplementation(async () => {
      controller.abort();
      return access();
    });
    await expect(openCapture({ signal: controller.signal })).resolves.toBeNull();
    expect(push).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("a genre becomes the active mode and the roll's, before any check", async () => {
    mocked.ensureSession.mockImplementation(async () => {
      expect([getMode(), getRollGenre()]).toEqual(["crime_scene", "crime_scene"]);
      return {} as Awaited<ReturnType<typeof api.ensureSession>>;
    });
    await expect(openCapture({ genre: "crime_scene" })).resolves.toBe("guide");
    expect(mocked.ensureSession).toHaveBeenCalledTimes(1);
  });

  it("keeps the mode through a detour to /pro: the continue after the purchase passes none", async () => {
    mocked.getMyAccess.mockResolvedValueOnce(access({ has_custom_rooms_entitlement: false }));
    await expect(openCapture({ genre: "paranormal" })).resolves.toBe("pro");
    // /pro, after its test purchase.
    await expect(openCapture({ replace: true })).resolves.toBe("guide");
    expect([getMode(), getRollGenre()]).toEqual(["paranormal", "paranormal"]);
  });

  it("a new mode starts a new build: a draft room made for the old one is never built in it", async () => {
    await openCapture({ genre: "noir" });
    setTicketRoom("noir-draft");
    await openCapture({ genre: "noir" });
    expect(currentTicket().roomId).toBe("noir-draft");
    await openCapture({ genre: "crime_scene" });
    expect(currentTicket().roomId).toBeNull();
  });

  it("does no work with a signal that is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(openCapture({ signal: controller.signal })).resolves.toBeNull();
    expect(mocked.ensureSession).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });
});

import { StyleSheet } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as api from "@/lib/escapd-api";
import { ref } from "@/theme/tokens";
import TutorialCompleteScreen from "../../../app/tutorial/complete";

jest.mock("expo-router", () => ({
  router: { back: jest.fn(), replace: jest.fn(), push: jest.fn(), canGoBack: jest.fn(() => true) },
  useLocalSearchParams: jest.fn(() => ({})),
}));

jest.mock("@/lib/escapd-api", () => ({ getLatestSession: jest.fn() }));

const mocked = api as jest.Mocked<typeof api>;
const params = useLocalSearchParams as jest.Mock;
const flat = (node: { props: Record<string, unknown> }) => StyleSheet.flatten(node.props.style as Parameters<typeof StyleSheet.flatten>[0]) ?? {};
const P = ref.layout.play;

beforeEach(() => {
  jest.clearAllMocks();
  params.mockReturnValue({ message: "You turn the key...", exit: "The door swings open. You escaped!" });
  mocked.getLatestSession.mockResolvedValue({
    started_at: "2026-10-25T10:00:00.000Z",
    completed_at: "2026-10-25T10:08:00.000Z",
    hints_used: 1,
  } as Awaited<ReturnType<typeof api.getLatestSession>>);
});

describe("Case closed", () => {
  it("closes the case in the reference look: tag pill, serif title, the messages, 07's stat cards", async () => {
    await render(<TutorialCompleteScreen />);
    expect(mocked.getLatestSession).toHaveBeenCalledWith("00000000-0000-4000-8000-000000000001", "completed");
    const title = screen.getByText("The Study");
    expect(title.props.accessibilityRole).toBe("header");
    expect(flat(title)).toMatchObject({ ...P.type.caseTitle, color: ref.color.textPrimary });
    expect(flat(screen.getByText("Case closed"))).toMatchObject({ textTransform: "uppercase", color: ref.color.textLabel });
    expect(screen.getByText("You turn the key...")).toBeTruthy();
    expect(flat(screen.getByText("The door swings open. You escaped!"))).toMatchObject({ color: ref.color.textSecondary });
    expect(await screen.findByLabelText("Time: 8 min")).toBeTruthy();
    expect(screen.getByLabelText("Hints used: 1")).toBeTruthy();
  });

  it("falls back to the default exit line", async () => {
    params.mockReturnValue({});
    mocked.getLatestSession.mockResolvedValue(null);
    await render(<TutorialCompleteScreen />);
    expect(screen.getByText("The door swings open.")).toBeTruthy();
    expect(screen.queryByLabelText(/^Time:/)).toBeNull();
  });

  it("routes from the white bar and the two quiet pills", async () => {
    await render(<TutorialCompleteScreen />);
    const bar = screen.getByTestId("complete-capture");
    expect(flat(bar)).toMatchObject({ backgroundColor: P.bar.fill, borderRadius: P.bar.radius });
    fireEvent.press(bar);
    expect(router.replace).toHaveBeenLastCalledWith("/capture");
    fireEvent.press(screen.getByLabelText("Back to start"));
    expect(router.replace).toHaveBeenLastCalledWith("/");
    fireEvent.press(screen.getByLabelText("Replay The Study"));
    expect(router.replace).toHaveBeenLastCalledWith("/tutorial");
  });
});

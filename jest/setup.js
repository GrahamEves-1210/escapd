// Worklets' own Jest mock: no UI runtime exists under Jest.
jest.mock("react-native-worklets", () => require("react-native-worklets/lib/module/mock"));
require("react-native-reanimated").setUpTests();

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"));
jest.mock("react-native-safe-area-context", () => require("react-native-safe-area-context/jest/mock").default);

// Haptics under Jest: every feel is a no-op spy, so components that give
// feedback (the kit's PillButton among them) render without the real
// preferences provider and its Supabase client. A test that checks a haptic
// mocks "@/game/feedback" itself with the same shape.
jest.mock("@/game/feedback", () => ({
  useFeedback: () => ({
    tick: jest.fn(),
    tap: jest.fn(),
    press: jest.fn(),
    thud: jest.fn(),
    success: jest.fn(),
    warning: jest.fn(),
    error: jest.fn(),
  }),
}));

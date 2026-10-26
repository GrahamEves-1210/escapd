// Worklets' own Jest mock: no UI runtime exists under Jest.
jest.mock("react-native-worklets", () => require("react-native-worklets/lib/module/mock"));
require("react-native-reanimated").setUpTests();

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"));
jest.mock("react-native-safe-area-context", () => require("react-native-safe-area-context/jest/mock").default);

// Feedback under Jest: every cue is a no-op spy, so components that give
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
    paper: jest.fn(),
    pickup: jest.fn(),
    wrongCode: jest.fn(),
    unlock: jest.fn(),
    stamp: jest.fn(),
    solved: jest.fn(),
    shutter: jest.fn(),
    typewriter: jest.fn(),
  }),
}));

// Sound under Jest: expo-audio's players are spies that load and play nothing
// (jest/expo-audio-mock.js). Tests read the players it made through
// `require("expo-audio").__players`.
jest.mock("expo-audio", () => require("./expo-audio-mock"));

// Skia under Jest: jest/skia-mock.js records what a bake draws instead of
// drawing (the package's own mock needs CanvasKit's wasm in every file).
// Tests read and reset it through `require("@shopify/react-native-skia").__skia`.
jest.mock("@shopify/react-native-skia", () => require("./skia-mock"));

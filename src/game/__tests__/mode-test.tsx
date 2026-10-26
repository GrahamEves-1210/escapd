import { act, renderHook } from "@testing-library/react-native";
import { modeThemes, shellTheme } from "@/theme/tokens";
import { GENRES, genreOf, getMode, isGenre, parseGenre, setMode, subscribeMode, themeFor, useMode, useModeTheme } from "../mode";

beforeEach(() => {
  setMode(null);
});

describe("the active mode", () => {
  it("starts in the shell and tells subscribers about each change, once", () => {
    expect(getMode()).toBeNull();
    const listener = jest.fn();
    const unsubscribe = subscribeMode(listener);
    setMode("crime_scene");
    setMode("crime_scene");
    expect(getMode()).toBe("crime_scene");
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    setMode("noir");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("useModeTheme follows it: a mode's theme, or the shell's neutral theme for null", async () => {
    const { result } = await renderHook(() => ({ mode: useMode(), theme: useModeTheme() }));
    expect(result.current).toEqual({ mode: null, theme: shellTheme });
    await act(async () => setMode("paranormal"));
    expect(result.current).toEqual({ mode: "paranormal", theme: modeThemes.paranormal });
    await act(async () => setMode(null));
    expect(result.current.theme).toBe(shellTheme);
  });

  it("the shell's theme is today's reference look, with no photo treatment", () => {
    expect(themeFor(null)).toBe(shellTheme);
    expect(themeFor("noir")).toBe(modeThemes.noir);
    expect(shellTheme).toMatchObject({ genre: null, ground: "#000000", ink: "#FFFFFF", inkMuted: "#949494", treatment: null });
  });
});

describe("genres from outside", () => {
  it("lists the modes in home's order", () => {
    expect(GENRES).toEqual(["noir", "crime_scene", "paranormal"]);
  });

  it("reads a route param, refusing anything else", () => {
    expect(parseGenre("crime_scene")).toBe("crime_scene");
    expect(parseGenre(["paranormal", "noir"])).toBe("paranormal");
    expect(parseGenre("horror")).toBeNull();
    expect(parseGenre(undefined)).toBeNull();
    expect(isGenre("noir")).toBe(true);
    expect(isGenre(3)).toBe(false);
  });

  it("a definition without a genre is noir", () => {
    expect(genreOf({ genre: "paranormal" })).toBe("paranormal");
    expect(genreOf({})).toBe("noir");
    expect(genreOf(null)).toBe("noir");
    expect(genreOf({ genre: "horror" as never })).toBe("noir");
  });
});

// In a case, leaving is the back button's alone: Android's back (the button,
// or its edge swipe) does nothing on the game's screens. Whatever registers
// after this (the close-up putting itself away) still gets it first. The iOS
// edge swipe is off in the routes' options (app/_layout.tsx).
import { useEffect } from "react";
import { BackHandler } from "react-native";

export function useNoBack() {
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => sub.remove();
  }, []);
}

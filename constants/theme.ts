import { useColorScheme } from "react-native";

// Brand colors
const tintColorLight = "#49941C";
const tintColorDark = "#C7F0A6";

export const lightTheme = {
  mode: "light",
  text: "#123A09",
  background: "#FFFFFF",
  primary: "#949494ff",
  secondary: "#62BA28",
  tertiary: "#F2FCE9",
  quaternary: "#476F29",
  quinary: "#78B644",
  quinest: "#F4FBEB",
  ash: "#0000004D",
  error: "#FF4D4F",
  warning: "#FFC107",
  tint: tintColorLight,
  icon: "#687076",
  tabIconDefault: "#687076",
  tabIconSelected: tintColorLight,
};

export const darkTheme = {
  mode: "dark",
  text: "#F2FCE9",
  background: "#132A09",
  primary: "#a6a6a680",
  secondary: "#49941C",
  tertiary: "#2A4D1A",
  quaternary: "#476F29",
  quinary: "#78B644",
  quinest: "#F4FBEB",
  ash: "#D9D9D9",
  error: "#FF4D4F",
  warning: "#FFC107",
  tint: tintColorDark,
  icon: "#9BA1A6",
  tabIconDefault: "#9BA1A6",
  tabIconSelected: tintColorDark,
};

// Hook to use anywhere
export function useTheme() {
  const scheme = useColorScheme();
  return scheme === "dark" ? darkTheme : lightTheme;
}

import { useColorScheme } from "react-native";
import { useThemeStore } from "@/store/useThemeStore";

export const lightTheme = {
  mode: "light",
  // Core
  text: "#0C1A0C",
  textSecondary: "#4A6B4A",
  background: "#FFFFFF",
  // Surfaces
  surface: "#F4FAF4",
  surfaceElevated: "#FFFFFF",
  // Brand greens
  primary: "#476F29",        // deep forest green — main CTA
  secondary: "#3A9E3A",      // mid green — active states, progress
  tertiary: "#EBF5EB",       // soft green tint — section backgrounds
  quaternary: "#1A6B1A",     // CTA buttons (maps to primary for existing usages)
  quinary: "#5BAE5B",        // border accent
  quinest: "#F4FAF4",        // card / input background
  // Accent
  accent: "#F5C518",         // golden yellow — highlights, points
  accentLight: "#FFFBE6",    // soft yellow bg
  // Borders
  ash: "#CDDCCD",            // general border / divider
  borderMid: "#A8C4A8",
  // Status
  error: "#D32F2F",
  warning: "#F5C518",
  success: "#2E7D32",
  // Icons & misc
  icon: "#5E7E5E",
  tint: "#1A6B1A",
  // Skeleton — must contrast clearly on both background and surface
  skeleton: "#D2E4D2",
  skeletonShimmer: "#E8F2E8",
  // Tab bar
  tab: "#0C1A0C",
  tabIconDefault: "#7A9E7A",
  tabIconSelected: "#FFFFFF",
  // Legacy compat
  aqua: "#26A69A",
};

export const darkTheme = {
  mode: "dark",
  // Core
  text: "#E4F2E4",
  textSecondary: "#7A9E7A",
  background: "#090F09",
  // Surfaces
  surface: "#111A11",
  surfaceElevated: "#162016",
  // Brand greens
  primary: "#52C052",        // bright green — main CTA in dark
  secondary: "#52C052",      // active states
  tertiary: "#152215",       // section backgrounds
  quaternary: "#52C052",     // CTA buttons
  quinary: "#3A7A3A",        // border accent
  quinest: "#111A11",        // card / input background
  // Accent
  accent: "#FFD54F",         // yellow
  accentLight: "#1E1800",
  // Borders
  ash: "#1A301A",            // general border / divider
  borderMid: "#264026",
  // Status
  error: "#EF5350",
  warning: "#FFD54F",
  success: "#66BB6A",
  // Icons & misc
  icon: "#507850",
  tint: "#81C784",
  // Skeleton
  skeleton: "#162416",
  skeletonShimmer: "#1E3020",
  // Tab bar
  tab: "#090F09",
  tabIconDefault: "#405A40",
  tabIconSelected: "#FFFFFF",
  // Legacy compat
  aqua: "#4DB6AC",
};

// Hook to use anywhere — respects manual override from settings, falls back to system
export function useTheme() {
  const systemScheme = useColorScheme();
  const stored = useThemeStore((s) => s.colorScheme);
  const effective = stored === "system" ? systemScheme : stored;
  return effective === "dark" ? darkTheme : lightTheme;
}

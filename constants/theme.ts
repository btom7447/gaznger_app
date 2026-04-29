/**
 * Gaznger Design System Tokens — React Native
 *
 * Drop-in replacement for the legacy theme. Preserves the existing
 * `useTheme()` hook contract so every consumer (~104 files) keeps working.
 *
 * Anchor: "Logistical clarity, financially trusted."
 *
 * - Legacy keys (text, surface, primary, accent, tertiary, etc.) preserved
 *   on the top-level theme object so all current consumers compile.
 * - NEW structured groups: colors, space, radius, type, motion, elevation,
 *   plus the semantic surface/foreground/border/money groups.
 * - Vestigial `aqua` removed. `secondary` retained as a back-compat alias.
 */

import { Easing, Platform, TextStyle, ViewStyle } from "react-native";
import { useColorScheme } from "react-native";
import { useThemeStore } from "@/store/useThemeStore";

// ──────────────────────────────────────────────────────────────────
// PALETTE — raw color values, never consumed directly by screens
// ──────────────────────────────────────────────────────────────────

const palette = {
  green50: "#E8F6EE",
  green100: "#C6E9D4",
  green200: "#93D5AE",
  green300: "#5CBE86",
  green400: "#2EA664",
  green500: "#1A7F4F",
  green600: "#156A41",
  green700: "#115634",
  green800: "#0D4127",
  green900: "#082B1A",
  green950: "#04170D",

  gold50: "#FEF7D6",
  gold100: "#FDE9A0",
  gold300: "#F8D24D",
  gold500: "#F5C518",
  gold700: "#B8900E",
  gold900: "#6B5306",

  neutral0: "#FFFFFF",
  neutral50: "#F6F8F7",
  neutral100: "#ECEFEE",
  neutral200: "#DDE2E0",
  neutral300: "#C2C9C6",
  neutral400: "#98A29E",
  neutral500: "#6B7672",
  neutral600: "#4D5754",
  neutral700: "#353D3B",
  neutral800: "#1F2625",
  neutral900: "#121817",
  neutral950: "#0A0E0D",

  success50: "#E6F6EC",
  success100: "#C2E9CF",
  success500: "#1F9D55",
  success700: "#14703B",

  warning50: "#FFF6E0",
  warning100: "#FCE9B5",
  warning500: "#E8A317",
  warning700: "#9F6F0A",

  error50: "#FCE8E8",
  error100: "#F7C7C7",
  error500: "#D1453B",
  error700: "#9B2A22",

  info50: "#E5F0FB",
  info100: "#C3DCF5",
  info500: "#2E73C8",
  info700: "#1E4F8C",
} as const;

// ──────────────────────────────────────────────────────────────────
// SPACING — 4pt grid
// ──────────────────────────────────────────────────────────────────

export const space = {
  s1: 4,
  s2: 8,
  s3: 12,
  s4: 16,
  s5: 24,
  s6: 32,
} as const;

// ──────────────────────────────────────────────────────────────────
// RADII
// ──────────────────────────────────────────────────────────────────

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

// ──────────────────────────────────────────────────────────────────
// TYPE — Nunito loaded via @expo-google-fonts/nunito (see hooks/useFonts.ts).
// Each weight is loaded as a separate PostScript family name on Android,
// so per-style `fontFamily` uses the matching weight family.
// ──────────────────────────────────────────────────────────────────

const fontFamily = {
  light: "Nunito_300Light",
  regular: "Nunito_400Regular",
  medium: "Nunito_500Medium",
  semibold: "Nunito_600SemiBold",
  bold: "Nunito_700Bold",
  heavy: "Nunito_800ExtraBold",
} as const;

// Money variant — tabular figures (iOS supports fontVariant directly;
// Android falls back to default digit width).
const moneyTextStyle: TextStyle = Platform.select({
  ios: { fontVariant: ["tabular-nums"] },
  android: {},
  default: {},
}) as TextStyle;

export const type = {
  family: fontFamily.regular,
  familyNum: fontFamily.regular,

  weight: {
    light: "300" as TextStyle["fontWeight"],
    regular: "400" as TextStyle["fontWeight"],
    medium: "500" as TextStyle["fontWeight"],
    semibold: "600" as TextStyle["fontWeight"],
    bold: "700" as TextStyle["fontWeight"],
    heavy: "800" as TextStyle["fontWeight"],
  },

  display: {
    fontFamily: fontFamily.heavy,
    fontSize: 32,
    lineHeight: 35,
    fontWeight: "800" as TextStyle["fontWeight"],
    letterSpacing: -0.3,
  },
  h1: {
    fontFamily: fontFamily.bold,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "700" as TextStyle["fontWeight"],
    letterSpacing: -0.3,
  },
  h2: {
    fontFamily: fontFamily.bold,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "700" as TextStyle["fontWeight"],
    letterSpacing: 0,
  },
  bodyLg: {
    fontFamily: fontFamily.regular,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400" as TextStyle["fontWeight"],
    letterSpacing: 0,
  },
  body: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "400" as TextStyle["fontWeight"],
    letterSpacing: 0,
  },
  bodySm: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "400" as TextStyle["fontWeight"],
    letterSpacing: 0,
  },
  caption: {
    fontFamily: fontFamily.medium,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "500" as TextStyle["fontWeight"],
    letterSpacing: 0,
  },
  micro: {
    fontFamily: fontFamily.semibold,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "600" as TextStyle["fontWeight"],
    letterSpacing: 0.5,
    textTransform: "uppercase" as TextStyle["textTransform"],
  },

  money: moneyTextStyle,
} as const;

// ──────────────────────────────────────────────────────────────────
// MOTION
// ──────────────────────────────────────────────────────────────────

export const motion = {
  ease: {
    standard: Easing.bezier(0.2, 0.8, 0.2, 1),
    out: Easing.bezier(0, 0, 0.2, 1),
  },
  duration: {
    fast: 120,
    base: 200,
    slow: 320,
  },
} as const;

// ──────────────────────────────────────────────────────────────────
// ELEVATION
// ──────────────────────────────────────────────────────────────────

const elevationLight = {
  flat: {} as ViewStyle,
  card: {
    shadowColor: "#0C1812",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  } as ViewStyle,
  modal: {
    shadowColor: "#0C1812",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.14,
    shadowRadius: 40,
    elevation: 12,
  } as ViewStyle,
};

const elevationDark = {
  flat: {} as ViewStyle,
  card: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.30,
    shadowRadius: 12,
    elevation: 2,
  } as ViewStyle,
  modal: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.55,
    shadowRadius: 40,
    elevation: 12,
  } as ViewStyle,
};

// ──────────────────────────────────────────────────────────────────
// SEMANTIC THEMES
// ──────────────────────────────────────────────────────────────────

interface SemanticTheme {
  mode: "light" | "dark";

  // surfaces
  bg: string;
  bgMuted: string;
  surface: string;
  surfaceElevated: string;
  surfaceSunken: string;

  // foregrounds
  fg: string;
  fgMuted: string;
  fgSubtle: string;
  fgOnPrimary: string;
  fgOnAccent: string;

  // borders
  border: string;
  borderStrong: string;
  divider: string;

  // brand
  primary: string;
  primaryHover: string;
  primaryPressed: string;
  primaryTint: string;

  // accent
  accent: string;
  accentTint: string;

  // money
  moneyFg: string;
  moneyPositive: string;
  moneyNegative: string;

  // status
  success: string;
  successTint: string;
  warning: string;
  warningTint: string;
  error: string;
  errorTint: string;
  info: string;
  infoTint: string;

  // raw palette access (escape hatch)
  palette: typeof palette;

  // elevation per mode
  elevation: typeof elevationLight;

  // shared
  space: typeof space;
  radius: typeof radius;
  type: typeof type;
  motion: typeof motion;

  // ── LEGACY KEYS — preserved for existing consumers ────────────
  text: string;
  textSecondary: string;
  background: string;
  /** Back-compat alias — maps to a primary-adjacent green. New code: use `primary` / `primaryHover`. */
  secondary: string;
  tertiary: string;
  quaternary: string;
  quinary: string;
  quinest: string;
  accentLight: string;
  ash: string;
  borderMid: string;
  icon: string;
  tint: string;
  skeleton: string;
  skeletonShimmer: string;
  tab: string;
  tabIconDefault: string;
  tabIconSelected: string;
}

export const lightTheme: SemanticTheme = {
  mode: "light",

  bg: palette.neutral0,
  bgMuted: palette.neutral50,
  surface: palette.neutral0,
  surfaceElevated: palette.neutral0,
  surfaceSunken: palette.neutral50,

  fg: palette.neutral900,
  fgMuted: palette.neutral600,
  fgSubtle: palette.neutral500,
  fgOnPrimary: palette.neutral0,
  fgOnAccent: palette.neutral900,

  border: palette.neutral200,
  borderStrong: palette.neutral300,
  divider: palette.neutral100,

  primary: palette.green500,
  primaryHover: palette.green600,
  primaryPressed: palette.green700,
  primaryTint: palette.green50,

  accent: palette.gold500,
  accentTint: palette.gold50,

  moneyFg: palette.neutral900,
  moneyPositive: palette.success500,
  moneyNegative: palette.error500,

  success: palette.success500,
  successTint: palette.success50,
  warning: palette.warning500,
  warningTint: palette.warning50,
  error: palette.error500,
  errorTint: palette.error50,
  info: palette.info500,
  infoTint: palette.info50,

  palette,
  elevation: elevationLight,
  space,
  radius,
  type,
  motion,

  // legacy
  text: palette.neutral900,
  textSecondary: palette.neutral600,
  background: palette.neutral0,
  secondary: palette.green600,
  tertiary: palette.green50,
  quaternary: palette.green700,
  quinary: palette.green400,
  quinest: palette.neutral50,
  accentLight: palette.gold50,
  ash: palette.neutral200,
  borderMid: palette.neutral300,
  icon: palette.neutral500,
  tint: palette.green500,
  skeleton: palette.neutral100,
  skeletonShimmer: palette.neutral50,
  tab: palette.neutral900,
  tabIconDefault: palette.neutral400,
  tabIconSelected: palette.neutral0,
};

export const darkTheme: SemanticTheme = {
  mode: "dark",

  bg: palette.neutral950,
  bgMuted: palette.neutral900,
  surface: palette.neutral900,
  surfaceElevated: palette.neutral800,
  surfaceSunken: palette.neutral950,

  fg: "#E8EFEC",
  fgMuted: palette.neutral400,
  fgSubtle: palette.neutral500,
  fgOnPrimary: palette.neutral0,
  fgOnAccent: palette.neutral900,

  border: palette.neutral800,
  borderStrong: palette.neutral700,
  divider: palette.neutral800,

  primary: palette.green400,
  primaryHover: palette.green300,
  primaryPressed: palette.green500,
  primaryTint: "#0F2A1E",

  accent: palette.gold300,
  accentTint: "#2A220A",

  moneyFg: "#E8EFEC",
  moneyPositive: palette.success500,
  moneyNegative: palette.error500,

  success: palette.success500,
  successTint: "#0F2A1A",
  warning: palette.warning500,
  warningTint: "#2A220A",
  error: palette.error500,
  errorTint: "#2A1212",
  info: palette.info500,
  infoTint: "#0F2030",

  palette,
  elevation: elevationDark,
  space,
  radius,
  type,
  motion,

  // legacy
  text: "#E8EFEC",
  textSecondary: palette.neutral400,
  background: palette.neutral950,
  secondary: palette.green400,
  tertiary: "#0F2A1E",
  quaternary: palette.green400,
  quinary: palette.green700,
  quinest: palette.neutral900,
  accentLight: "#2A220A",
  ash: palette.neutral800,
  borderMid: palette.neutral700,
  icon: palette.neutral500,
  tint: palette.green300,
  skeleton: palette.neutral800,
  skeletonShimmer: palette.neutral700,
  tab: palette.neutral950,
  tabIconDefault: palette.neutral700,
  tabIconSelected: palette.neutral0,
};

// ──────────────────────────────────────────────────────────────────
// useTheme — preserves existing hook signature (reads `colorScheme`)
// ──────────────────────────────────────────────────────────────────

export type Theme = SemanticTheme;

export function useTheme(): Theme {
  const systemScheme = useColorScheme();
  const stored = useThemeStore((s) => s.colorScheme);
  const effective = stored === "system" ? systemScheme : stored;
  return effective === "dark" ? darkTheme : lightTheme;
}

// ──────────────────────────────────────────────────────────────────
// formatCurrency — single source of truth for ₦
// ──────────────────────────────────────────────────────────────────

/**
 * Format a number as Naira. Always whole numbers (consumer pricing has no kobo).
 * Returns '₦12,500' style string.
 *
 * @param value numeric amount (assume already in Naira, not kobo)
 * @param opts.signed prepend '+ '/'− ' for non-zero values
 */
export function formatCurrency(
  value: number,
  opts: { signed?: boolean } = {}
): string {
  const isNeg = value < 0;
  const abs = Math.abs(value);
  const num = abs.toLocaleString("en-NG", { maximumFractionDigits: 0 });
  if (opts.signed) {
    if (value === 0) return `₦${num}`;
    return `${isNeg ? "− " : "+ "}₦${num}`;
  }
  return `${isNeg ? "−" : ""}₦${num}`;
}

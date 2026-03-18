/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { lightTheme, darkTheme } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type ThemeColors = typeof lightTheme;

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof ThemeColors
) {
  const scheme = useColorScheme() ?? 'light';
  const colorFromProps = props[scheme];

  if (colorFromProps) {
    return colorFromProps;
  } else {
    const colors = scheme === 'dark' ? darkTheme : lightTheme;
    return colors[colorName];
  }
}

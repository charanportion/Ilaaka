import { useResolvedColorScheme } from '@/lib/theme';
import {
  darkPalette,
  lightPalette,
  radius,
  shadows,
  spacing,
  typography,
  type Palette,
} from '@/lib/design-tokens';

export type Tokens = {
  scheme: 'light' | 'dark';
  colors: Palette;
  radius: typeof radius;
  spacing: typeof spacing;
  shadows: typeof shadows;
  typography: typeof typography;
  isDark: boolean;
};

export function useTokens(): Tokens {
  const scheme = useResolvedColorScheme();
  const isDark = scheme === 'dark';
  return {
    scheme,
    isDark,
    colors: isDark ? darkPalette : lightPalette,
    radius,
    spacing,
    shadows,
    typography,
  };
}

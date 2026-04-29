/**
 * Single source of truth for the Ilaaka design system.
 * Mirrors the CSS custom properties declared in global.css and the
 * Tailwind color/radius tokens declared in tailwind.config.js.
 *
 * Use through `useTokens()` for runtime values (lucide icon `color`,
 * MapLibre paint expressions, RefreshControl `tintColor`, inline styles).
 * Use Tailwind classes (`bg-bg`, `text-ink`, `border-border`, etc.) for
 * everything that goes through `className`.
 */

export type Palette = {
  bg: string;
  surface: string;
  surfaceAlt: string;
  ink: string;
  inkStrong: string;
  inkMuted: string;
  inkSubtle: string;
  border: string;
  borderInput: string;
  accent: string;
  link: string;
  territory: string;
  ctaBg: string;
  ctaFg: string;
  warning: string;
  danger: string;
  success: string;
  focusRing: string;
};

export const lightPalette: Palette = {
  bg:          '#f0f0f3',
  surface:     '#ffffff',
  surfaceAlt:  '#f7f7f9',
  ink:         '#1c2024',
  inkStrong:   '#000000',
  inkMuted:    '#60646c',
  inkSubtle:   '#b0b4ba',
  border:      '#e0e1e6',
  borderInput: '#d9d9e0',
  accent:      '#000000',
  link:        '#000000',
  territory:   '#7F77DD',
  ctaBg:       '#000000',
  ctaFg:       '#ffffff',
  warning:     '#ab6400',
  danger:      '#d93f44',
  success:     '#1a7f37',
  focusRing:   '#000000',
};

export const darkPalette: Palette = {
  bg:          '#0e0f12',
  surface:     '#171717',
  surfaceAlt:  '#1f1f22',
  ink:         '#ECEDEE',
  inkStrong:   '#ffffff',
  inkMuted:    '#9aa0a8',
  inkSubtle:   '#6b6f76',
  border:      '#2a2c31',
  borderInput: '#363a3f',
  accent:      '#ffffff',
  link:        '#ffffff',
  territory:   '#9C95EB',
  ctaBg:       '#ffffff',
  ctaFg:       '#000000',
  warning:     '#e0a858',
  danger:      '#eb8e90',
  success:     '#3fb950',
  focusRing:   '#ffffff',
};

export const radius = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 16,
  xl: 24,
  xxl: 32,
  pill: 9999,
} as const;

export const spacing = {
  0: 0,
  px: 1,
  half: 2,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
  24: 96,
  36: 144,
} as const;

export const shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  whisper: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  standard: {
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
} as const;

export const typography = {
  display:    { fontFamily: 'Inter_900Black',           fontSize: 64, lineHeight: 70, letterSpacing: -3 },
  h1:         { fontFamily: 'Inter_700Bold',            fontSize: 48, lineHeight: 53, letterSpacing: -2 },
  h2:         { fontFamily: 'Inter_600SemiBold',        fontSize: 32, lineHeight: 36, letterSpacing: -1 },
  h3:         { fontFamily: 'Inter_600SemiBold',        fontSize: 20, lineHeight: 24, letterSpacing: -0.25 },
  bodyLg:     { fontFamily: 'Inter_400Regular',         fontSize: 18, lineHeight: 25, letterSpacing: 0 },
  body:       { fontFamily: 'Inter_400Regular',         fontSize: 16, lineHeight: 22, letterSpacing: 0 },
  bodyStrong: { fontFamily: 'Inter_600SemiBold',        fontSize: 16, lineHeight: 22, letterSpacing: 0 },
  caption:    { fontFamily: 'Inter_500Medium',          fontSize: 14, lineHeight: 18, letterSpacing: 0 },
  captionStrong: { fontFamily: 'Inter_600SemiBold',     fontSize: 14, lineHeight: 18, letterSpacing: 0 },
  tag:        { fontFamily: 'Inter_500Medium',          fontSize: 12, lineHeight: 16, letterSpacing: 0 },
  tagStrong:  { fontFamily: 'Inter_700Bold',            fontSize: 12, lineHeight: 16, letterSpacing: 0.4 },
  code:       { fontFamily: 'JetBrainsMono_400Regular', fontSize: 14, lineHeight: 20, letterSpacing: 0 },
  codeStrong: { fontFamily: 'JetBrainsMono_700Bold',    fontSize: 14, lineHeight: 20, letterSpacing: 0 },
} as const;

export type TypographyVariant = keyof typeof typography;

export const FONTS_TO_LOAD = [
  'Inter_400Regular',
  'Inter_500Medium',
  'Inter_600SemiBold',
  'Inter_700Bold',
  'Inter_900Black',
  'JetBrainsMono_400Regular',
  'JetBrainsMono_700Bold',
] as const;

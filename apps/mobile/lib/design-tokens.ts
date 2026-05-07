/**
 * Single source of truth for the Ilaaka design system.
 * Mirrors the CSS custom properties declared in global.css and the
 * Tailwind color/radius tokens declared in tailwind.config.js.
 *
 * Use through `useTokens()` for runtime values (lucide icon `color`,
 * MapLibre paint expressions, RefreshControl `tintColor`, inline styles).
 * Use Tailwind classes (`bg-bg`, `text-ink`, `border-border`, etc.) for
 * everything that goes through `className`.
 *
 * Aesthetic: "Streetlight Cartography" — warm-black ink + paper-cream.
 * Brand chrome is monochrome only. The four-color territory palette
 * (saffron / lime / magenta / teal) is exposed as `TERRITORY_PALETTE`
 * but ZoneMap still consumes the per-user `owner_color` from the server.
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

/* Light — paper-on-ink-text (daytime) */
export const lightPalette: Palette = {
  bg:          '#f8f1e3',
  surface:     '#fffaee',
  surfaceAlt:  '#f3ecda',
  ink:         '#161614',
  inkStrong:   '#0d0d0c',
  inkMuted:    '#5a5a4f',
  inkSubtle:   '#a89e8a',
  border:      '#ebe3cf',
  borderInput: '#d2c8b3',
  accent:      '#0d0d0c',
  link:        '#0d0d0c',
  territory:   '#ff7a1a', // fallback only — server's owner_color overrides per-zone
  ctaBg:       '#0d0d0c',
  ctaFg:       '#f8f1e3',
  warning:     '#b56a17',
  danger:      '#c83a3a',
  success:     '#2a7a3a',
  focusRing:   '#0d0d0c',
};

/* Dark — ink-on-paper-text (nighttime / "streetlight") */
export const darkPalette: Palette = {
  bg:          '#0d0d0c',
  surface:     '#161614',
  surfaceAlt:  '#24241f',
  ink:         '#f3ecda',
  inkStrong:   '#f8f1e3',
  inkMuted:    '#a89e8a',
  inkSubtle:   '#807868',
  border:      '#24241f',
  borderInput: '#3a3a33',
  accent:      '#f8f1e3',
  link:        '#f8f1e3',
  territory:   '#ff7a1a',
  ctaBg:       '#f8f1e3',
  ctaFg:       '#0d0d0c',
  warning:     '#d8923a',
  danger:      '#e8746a',
  success:     '#6cc97a',
  focusRing:   '#f8f1e3',
};

/**
 * Territory palette. Reserved for territory representations only —
 * not consumed by `ZoneMap` today (each zone uses the per-user
 * `owner_color` returned by the API). Available for future surfaces
 * that want to differentiate territory states (claimed / fresh /
 * stolen / rare).
 */
export const TERRITORY_PALETTE = {
  saffron: '#ff7a1a',
  lime:    '#c7f340',
  magenta: '#ff2d87',
  teal:    '#2bd9b8',
} as const;

export type TerritoryColor = keyof typeof TERRITORY_PALETTE;

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

/**
 * Typography variants.
 * - `display` / `h1` / `h2` use Fraunces (high-contrast variable serif).
 *   Variable axes (SOFT/WONK) aren't reachable from `expo-google-fonts`
 *   static cuts — `displayWonk` approximates the wonk-italic moments
 *   from the landing using `Fraunces_900Black_Italic`.
 * - `h3` and all body / caption / tag variants use Manrope.
 * - `code*` and `eyebrow` use JetBrains Mono. Eyebrow is the small
 *   uppercase tracked label that anchors editorial sections (matches
 *   the landing's `.eyebrow` class).
 */
export const typography = {
  display:       { fontFamily: 'Fraunces_900Black',         fontSize: 64, lineHeight: 70, letterSpacing: -3 },
  displayWonk:   { fontFamily: 'Fraunces_900Black_Italic',  fontSize: 64, lineHeight: 70, letterSpacing: -3 },
  h1:            { fontFamily: 'Fraunces_900Black',         fontSize: 48, lineHeight: 53, letterSpacing: -2 },
  h2:            { fontFamily: 'Fraunces_700Bold',          fontSize: 32, lineHeight: 36, letterSpacing: -1 },
  h3:            { fontFamily: 'Manrope_600SemiBold',       fontSize: 20, lineHeight: 24, letterSpacing: -0.25 },
  bodyLg:        { fontFamily: 'Manrope_400Regular',        fontSize: 18, lineHeight: 25, letterSpacing: 0 },
  body:          { fontFamily: 'Manrope_400Regular',        fontSize: 16, lineHeight: 22, letterSpacing: 0 },
  bodyStrong:    { fontFamily: 'Manrope_600SemiBold',       fontSize: 16, lineHeight: 22, letterSpacing: 0 },
  caption:       { fontFamily: 'Manrope_500Medium',         fontSize: 14, lineHeight: 18, letterSpacing: 0 },
  captionStrong: { fontFamily: 'Manrope_600SemiBold',       fontSize: 14, lineHeight: 18, letterSpacing: 0 },
  tag:           { fontFamily: 'Manrope_500Medium',         fontSize: 12, lineHeight: 16, letterSpacing: 0 },
  tagStrong:     { fontFamily: 'Manrope_700Bold',           fontSize: 12, lineHeight: 16, letterSpacing: 0.4 },
  code:          { fontFamily: 'JetBrainsMono_400Regular',  fontSize: 14, lineHeight: 20, letterSpacing: 0 },
  codeStrong:    { fontFamily: 'JetBrainsMono_700Bold',     fontSize: 14, lineHeight: 20, letterSpacing: 0 },
  eyebrow:       { fontFamily: 'JetBrainsMono_500Medium',   fontSize: 11, lineHeight: 14, letterSpacing: 2 },
} as const;

export type TypographyVariant = keyof typeof typography;

export const FONTS_TO_LOAD = [
  'Fraunces_700Bold',
  'Fraunces_900Black',
  'Fraunces_900Black_Italic',
  'Manrope_400Regular',
  'Manrope_500Medium',
  'Manrope_600SemiBold',
  'Manrope_700Bold',
  'JetBrainsMono_400Regular',
  'JetBrainsMono_500Medium',
  'JetBrainsMono_700Bold',
] as const;

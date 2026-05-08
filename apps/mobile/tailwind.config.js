/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Surfaces
        bg:          'var(--bg)',
        surface:     'var(--surface)',
        surfaceAlt:  'var(--surface-alt)',
        // Foreground / text
        ink:         'var(--ink)',
        inkStrong:   'var(--ink-strong)',
        inkMuted:    'var(--ink-muted)',
        inkSubtle:   'var(--ink-subtle)',
        // Borders
        border:      'var(--border)',
        borderInput: 'var(--border-input)',
        // Accents
        accent:      'var(--accent)',
        link:        'var(--link)',
        territory:   'var(--territory)',
        // CTA pair (auto-inverts in dark)
        ctaBg:       'var(--cta-bg)',
        ctaFg:       'var(--cta-fg)',
        // Semantic
        warning:     'var(--warning)',
        danger:      'var(--danger)',
        success:     'var(--success)',
        focusRing:   'var(--focus-ring)',
      },
      borderRadius: {
        none: '0px',
        xs:   '4px',
        sm:   '6px',
        md:   '8px',
        lg:   '16px',
        xl:   '24px',
        '2xl':'32px',
        pill: '9999px',
      },
      fontFamily: {
        // Body: Manrope
        sans:    ['Manrope_400Regular', 'system-ui'],
        medium:  ['Manrope_500Medium', 'system-ui'],
        semi:    ['Manrope_600SemiBold', 'system-ui'],
        bold:    ['Manrope_700Bold', 'system-ui'],
        // Display: Fraunces
        display:     ['Fraunces_900Black', 'Iowan Old Style', 'serif'],
        displayBold: ['Fraunces_700Bold', 'Iowan Old Style', 'serif'],
        displayWonk: ['Fraunces_900Black_Italic', 'Iowan Old Style', 'serif'],
        // `black` previously meant Inter Black; remap to display so any
        // existing `font-black` callers still get the boldest cut.
        black:   ['Fraunces_900Black', 'Iowan Old Style', 'serif'],
        // Mono: JetBrains Mono (eyebrows, stats)
        mono:        ['JetBrainsMono_400Regular', 'ui-monospace'],
        monoMedium:  ['JetBrainsMono_500Medium', 'ui-monospace'],
        monoBold:    ['JetBrainsMono_700Bold', 'ui-monospace'],
      },
      letterSpacing: {
        display: '-3px',
        h1:      '-2px',
        h2:      '-1px',
        h3:      '-0.25px',
      },
    },
  },
  plugins: [],
};

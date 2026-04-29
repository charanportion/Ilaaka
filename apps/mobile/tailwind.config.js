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
        sans:    ['Inter_400Regular', 'system-ui'],
        medium:  ['Inter_500Medium', 'system-ui'],
        semi:    ['Inter_600SemiBold', 'system-ui'],
        bold:    ['Inter_700Bold', 'system-ui'],
        black:   ['Inter_900Black', 'system-ui'],
        mono:    ['JetBrainsMono_400Regular', 'ui-monospace'],
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

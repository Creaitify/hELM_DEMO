import type { Config } from 'tailwindcss';

/**
 * Tokens live in src/styles/tokens.css as CSS custom properties.
 * Tailwind consumes them; it never re-declares a value.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        night: {
          950: 'var(--night-950)',
          900: 'var(--night-900)',
          800: 'var(--night-800)',
          700: 'var(--night-700)',
          line: 'var(--night-line)',
          ink: 'var(--night-ink)',
          muted: 'var(--night-muted)',
          faint: 'var(--night-faint)',
        },
        canvas: 'var(--canvas)',
        surface: {
          DEFAULT: 'var(--surface)',
          subtle: 'var(--surface-subtle)',
          sunk: 'var(--surface-sunk)',
        },
        line: {
          DEFAULT: 'var(--line)',
          strong: 'var(--line-strong)',
        },
        ink: {
          950: 'var(--ink-950)',
          700: 'var(--ink-700)',
          500: 'var(--ink-500)',
          400: 'var(--ink-400)',
        },
        helm: {
          50: 'var(--helm-50)',
          100: 'var(--helm-100)',
          500: 'var(--helm-500)',
          600: 'var(--helm-600)',
          700: 'var(--helm-700)',
        },
        iris: { 500: 'var(--iris-500)' },
        action: {
          200: 'var(--action-200)',
          400: 'var(--action-400)',
          ink: 'var(--action-ink)',
        },
        good: { DEFAULT: 'var(--good)', soft: 'var(--good-soft)' },
        warn: { DEFAULT: 'var(--warn)', soft: 'var(--warn-soft)' },
        bad: { DEFAULT: 'var(--bad)', soft: 'var(--bad-soft)' },
        info: { DEFAULT: 'var(--info)', soft: 'var(--info-soft)' },
        urgent: { DEFAULT: 'var(--urgent)', soft: 'var(--urgent-soft)' },
        chip: { neutral: 'var(--chip-neutral)', line: 'var(--chip-neutral-line)' },
        google: 'var(--google)',
        meta: 'var(--meta)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        micro: ['11px', { lineHeight: '14px', letterSpacing: '0.08em' }],
        meta: ['12px', { lineHeight: '16px' }],
        'meta-lg': ['13px', { lineHeight: '18px' }],
        base: ['15px', { lineHeight: '23px' }],
        body: ['16px', { lineHeight: '25px' }],
        'body-lg': ['18px', { lineHeight: '29px' }],
        'body-xl': ['20px', { lineHeight: '32px' }],
        section: ['20px', { lineHeight: '26px', letterSpacing: '-0.01em' }],
        page: ['30px', { lineHeight: '36px', letterSpacing: '-0.022em' }],
      },
      spacing: {
        '4.5': '18px',
        '13': '52px',
        '18': '72px',
        '22': '88px',
        rail: 'var(--rail-w)',
        'rail-collapsed': 'var(--rail-w-collapsed)',
        scope: 'var(--scope-h)',
      },
      borderRadius: {
        control: '10px',
        field: '12px',
        card: '14px',
        editorial: '20px',
      },
      maxWidth: {
        prose: '720px',
        canvas: '1440px',
        shell: '1320px',
      },
      boxShadow: {
        lift: '0 1px 2px rgba(16,19,28,.045), 0 14px 34px -14px rgba(16,19,28,.16)',
        'lift-lg': '0 2px 4px rgba(16,19,28,.05), 0 30px 66px -22px rgba(16,19,28,.24)',
        'lift-dark': '0 24px 64px -24px rgba(0,0,0,.72)',
        focus: '0 0 0 3px var(--focus-ring)',
      },
      transitionTimingFunction: {
        out: 'var(--ease-out)',
        standard: 'var(--ease-standard)',
      },
      screens: {
        xs: '390px',
      },
    },
  },
  plugins: [],
};

export default config;

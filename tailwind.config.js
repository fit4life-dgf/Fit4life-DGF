/** Fit4Life design system. Colours are CSS variables (see src/index.css) so light and dark share one set of class names. */
const c = (name) => `rgb(var(--${name}) / <alpha-value>)`

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: c('bg'), card: c('card'), card2: c('card2'),
        ink: c('ink'), ink2: c('ink2'), muted: c('muted'), line: c('line'),
        accent: c('accent'),
        steps: c('steps'), readiness: c('readiness'), sleep: c('sleep'), heart: c('heart'),
        water: c('water'), calories: c('calories'), workout: c('workout'),
        recovery: c('recovery'), ai: c('ai'), nutrition: c('nutrition'),
        good: c('good'), warn: c('warn'), bad: c('bad'),
      },
      fontFamily: { sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'] },
      borderRadius: { card: '20px', tile: '16px' },
      boxShadow: { card: '0 1px 2px rgb(16 24 40 / 0.04), 0 1px 3px rgb(16 24 40 / 0.06)' },
      keyframes: {
        rise: { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'none' } },
        pop: { '0%': { transform: 'scale(.6)', opacity: '0' }, '60%': { transform: 'scale(1.08)' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        sheet: { from: { transform: 'translateY(24px)', opacity: '0' }, to: { transform: 'none', opacity: '1' } },
      },
      animation: {
        rise: 'rise .25s ease-out both',
        pop: 'pop .3s ease-out both',
        sheet: 'sheet .22s ease-out both',
      },
    },
  },
  plugins: [],
}

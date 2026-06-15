/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        'tx-blue': {
          950: '#0A1628', 900: '#0F2044', 800: '#1A3260',
          700: '#1E4080', 600: '#2451A3', 500: '#3B6FD4',
          100: '#D6E4FF', 50:  '#EEF4FF',
        },
        'tx-teal': {
          600: '#00917A', 500: '#00B899', 400: '#33C9AE',
          100: '#CCEDE9', 50:  '#E8F8F6',
        },
        'tx-gold': { DEFAULT: '#F59E0B', bg: '#FEF3C7' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        'kpi':    ['2rem',   { lineHeight: '1',      fontWeight: '700', letterSpacing: '-0.03em' }],
        'kpi-lg': ['3rem',   { lineHeight: '1',      fontWeight: '700', letterSpacing: '-0.04em' }],
        'label':  ['0.75rem',{ lineHeight: '1rem',   fontWeight: '500', letterSpacing: '0.05em' }],
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};

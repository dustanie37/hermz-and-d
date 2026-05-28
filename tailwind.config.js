/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        night: {
          950: '#070608',
          900: '#11101A',
          800: '#15141E',
          700: '#1F1D29',
          600: '#2A2734',
        },
        gold: {
          50:  '#FAF4E5',
          100: '#F4E6BF',
          200: '#EDD590',
          300: '#E8C36A',
          400: '#E5B043',
          500: '#E0A22F',
          600: '#B97F1E',
          700: '#946317',
          800: '#6F4A11',
          900: '#4A310B',
        },
        film: {
          50:  '#E8EBFF',
          100: '#D0D6FF',
          200: '#A8B2FF',
          300: '#8597FF',
          400: '#6E7FFF',
          500: '#5B6CFF',
          600: '#3F4FE2',
          700: '#2E3DCC',
          800: '#1F2BA3',
          900: '#141B7A',
        },
        cinema: {
          400: '#33E5DE',
          500: '#00E0D9',
          600: '#00B5AF',
        },
        cream: {
          50:  '#FBF7EE',
          100: '#F2EEE3',
          200: '#E6E0D0',
          300: '#9D9789',
          400: '#5F5B53',
        },
      },
      fontFamily: {
        display: ['"Bebas Neue"', 'Anton', '"Archivo Narrow"', 'system-ui', 'sans-serif'],
        serif:   ['"Instrument Serif"', 'Georgia', 'serif'],
        sans:    ['Geist', '"Inter"', 'system-ui', 'sans-serif'],
        mono:    ['"Geist Mono"', '"JetBrains Mono"', 'monospace'],
      },
      backgroundImage: {
        'gold-shimmer': 'linear-gradient(135deg, #E0A22F 0%, #F4E6BF 50%, #B97F1E 100%)',
        'film-gradient': 'linear-gradient(135deg, #2E3DCC 0%, #5B6CFF 100%)',
        'still-scrim':  'linear-gradient(180deg, rgba(7,6,8,0.4) 0%, transparent 30%, rgba(7,6,8,0.95) 100%)',
      },
      boxShadow: {
        'still': '0 10px 24px rgba(0,0,0,0.5)',
        'still-lg': '0 16px 40px rgba(0,0,0,0.6)',
        'panel': '0 4px 24px rgba(0,0,0,0.4)',
      },
      letterSpacing: {
        'kicker': '0.22em',
        'cinema': '0.32em',
      },
    },
  },
  plugins: [],
}

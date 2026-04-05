/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Primary dark backgrounds
        night: {
          950: '#0a0a0f',
          900: '#0f0f1a',
          800: '#161625',
          700: '#1e1e30',
          600: '#26263c',
        },
        // Gold/amber for Oscar-related accents
        gold: {
          50:  '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        // Slate-blue for movie section accents
        film: {
          50:  '#f0f4ff',
          100: '#e0e9ff',
          200: '#c7d6fe',
          300: '#a5b8fd',
          400: '#8193fa',
          500: '#6170f5',
          600: '#4f55e9',
          700: '#4244ce',
          800: '#3739a6',
          900: '#313384',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Georgia', 'serif'],
      },
      backgroundImage: {
        'gold-shimmer': 'linear-gradient(135deg, #f59e0b 0%, #fcd34d 50%, #d97706 100%)',
        'film-gradient': 'linear-gradient(135deg, #4244ce 0%, #6170f5 100%)',
      },
    },
  },
  plugins: [],
}

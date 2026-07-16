/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './views/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Ariyana brand gold scale (500 = the legacy `primary` #C5A059)
        brand: {
          50: '#FAF6EC',
          100: '#F3EAD3',
          200: '#E7D5A7',
          300: '#DABF7C',
          400: '#CFAF66',
          500: '#C5A059',
          600: '#A9853F',
          700: '#86682F',
          800: '#634C22',
          900: '#423214',
          // Data-mark gold: passes the dataviz palette validator on white
          // (chroma floor + 3:1 contrast), unlike the softer UI golds above.
          chart: '#B08A2E',
        },
        // Legacy aliases kept so existing classNames keep working
        primary: '#C5A059', // Ariyana Gold
        secondary: '#0F172A', // Deep Navy
        accent: '#1E40AF', // Royal Blue
        sidebar: '#0F172A',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-in-right': {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
        'slide-in-right': 'slide-in-right 0.3s ease-out',
      },
    },
  },
  plugins: [],
};

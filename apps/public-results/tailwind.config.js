/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        cond: ['Barlow Condensed', 'sans-serif'],
        mono: ['Roboto Mono', 'monospace'],
      },
      colors: {
        bg: '#020810',
        card: '#081428',
        border: '#1a2d50',
        muted: '#5a6e9a',
        navy: '#0B3D91',
        red: '#D62828',
      },
    },
  },
  plugins: [],
}

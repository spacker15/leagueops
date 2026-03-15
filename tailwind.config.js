/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#0B3D91',
          dark: '#072B6A',
          light: '#1a52b8',
          50: '#e8edf8',
        },
        red: {
          DEFAULT: '#D62828',
          dark: '#a01e1e',
          light: '#f03a3a',
        },
        surface: {
          DEFAULT: '#040e24',
          panel: '#071e4a',
          card: '#0d2d6b',
          elevated: '#112255',
        },
        border: '#2a4080',
        muted: '#8899bb',
      },
      fontFamily: {
        sans: ['var(--font-barlow)', 'system-ui', 'sans-serif'],
        condensed: ['var(--font-barlow-condensed)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-roboto-mono)', 'monospace'],
      },
      animation: {
        pulse: 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        flash: 'flash 1s ease-in-out infinite',
      },
      keyframes: {
        flash: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
      },
    },
  },
  plugins: [],
}

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
          dark: '#061f52',
          light: '#1a52b8',
        },
        red: {
          DEFAULT: '#D62828',
          dark: '#a01e1e',
          light: '#f03a3a',
        },
        surface: {
          DEFAULT: '#020810',
          panel: '#030d20',
          card: '#081428',
          elevated: '#0a1a3a',
        },
        border: '#1a2d50',
        muted: '#5a6e9a',
      },
      fontFamily: {
        sans: ['var(--font-barlow)', 'system-ui', 'sans-serif'],
        condensed: ['var(--font-barlow-condensed)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-roboto-mono)', 'monospace'],
      },
      animation: {
        pulse: 'pulse 1.5s cubic-bezier(0.4,0,0.6,1) infinite',
      },
    },
  },
  plugins: [],
}

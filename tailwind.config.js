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
          DEFAULT: 'var(--surface)',
          panel: '#030d20',
          card: 'var(--surface-card)',
          elevated: 'var(--surface-elevated)',
        },
        border: 'var(--border)',
        muted: 'var(--muted)',
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

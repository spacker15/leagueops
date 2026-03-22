import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/__tests__/**/*.{ts,tsx}', '**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'apps', '.claude', '**/_mock*.ts', '**/_mock*.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      exclude: ['node_modules', '.next', 'apps', '**/*.config.*'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})

import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// Eigenständige Vitest-Config (getrennt von vite.config.ts, damit Build- und Test-Belange
// nicht vermischt werden). React-Plugin + `@`-Alias werden hier erneut deklariert, weil
// Vitest bei vorhandener vitest.config.ts die vite.config.ts nicht automatisch übernimmt.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
})

/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    environmentOptions: {
      // jsdom refuses localStorage on an opaque origin, and its default URL is
      // one. A concrete origin also makes history.pushState work in the
      // archive-navigation tests.
      jsdom: { url: 'http://localhost:3000/' },
    },
  },
})

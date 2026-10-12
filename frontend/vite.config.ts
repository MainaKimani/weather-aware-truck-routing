import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { configDefaults, defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Same-origin /api in dev and preview, matching the production rewrite
  // (RFC §3.2), so session cookies and CSRF work without CORS.
  const proxy = {
    '/api': {
      target: env.API_PROXY_TARGET ?? 'http://localhost:8000',
      changeOrigin: true,
    },
  }

  return {
    plugins: [react(), tailwindcss()],
    // MapLibre starts its worker as an ES module.
    worker: { format: 'es' },
    build: {
      // MapLibre is a single ~1 MB chunk, loaded only when the map mounts.
      // The limit sits just above it, so any other chunk this big still warns.
      chunkSizeWarningLimit: 1100,
    },
    server: { proxy },
    // The end-to-end tests run against the production build (playwright.config.ts).
    preview: { proxy },
    test: {
      environment: 'jsdom',
      // e2e/ is Playwright's, run against real servers.
      exclude: [...configDefaults.exclude, 'e2e/**'],
      setupFiles: ['./src/test/setup.ts'],
      restoreMocks: true,
      unstubGlobals: true,
    },
  }
})

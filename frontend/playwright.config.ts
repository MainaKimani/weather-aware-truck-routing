/**
 * End-to-end smoke tests (RFC §17): the production build in Chromium against
 * the real Django backend with its fake providers, so the whole path from
 * the form to the map runs with no network or keys.
 *
 * Both servers are started here, on their own ports so they don't clash with
 * `make dev`. Locally a server already running on those ports is reused.
 */
import { defineConfig, devices } from '@playwright/test'

const API = 'http://127.0.0.1:8001'
const WEB = 'http://127.0.0.1:4173'
const CI = Boolean(process.env.CI)

export default defineConfig({
  testDir: './e2e',
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  reporter: CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: WEB,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command:
        'uv run python manage.py migrate --noinput && uv run python manage.py runserver 127.0.0.1:8001 --noreload',
      cwd: '../backend',
      url: `${API}/healthz`,
      env: { PROVIDERS: 'fake', FAKE_SCENARIO: 'demo' },
      reuseExistingServer: !CI,
      timeout: 120_000,
    },
    {
      command: 'npm run build && npx vite preview --host 127.0.0.1 --port 4173 --strictPort',
      url: WEB,
      env: { API_PROXY_TARGET: API },
      reuseExistingServer: !CI,
      timeout: 180_000,
    },
  ],
})

import { defineConfig, devices } from '@playwright/test';

const PORT = 5173;
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  // Les specs hors-ligne exigent un SW et le serveur mock dédié :
  // elles tournent via `npm run test:e2e:offline`.
  testIgnore: '**/offline*.spec.ts',
  fullyParallel: true,
  forbidOnly: process.env.CI === 'true',
  retries: process.env.CI === 'true' ? 2 : 0,
  reporter: [['list']],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: 'on-first-retry',
    locale: 'fr-FR',
    timezoneId: 'Africa/Abidjan',
    // Verrou navigateur : aucun service worker pendant les tests existants.
    // Les specs offline tournent contre `vite preview` avec une config
    // dédiée (playwright.offline.config.ts) où ce réglage est levé.
    serviceWorkers: 'block',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});

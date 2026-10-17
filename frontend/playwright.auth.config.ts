import { defineConfig, devices } from '@playwright/test';

/* e2e à session simulée : Clerk est aliasé vers une doublure
   (`vite.auth.config.ts`) et les API sont interceptées par `page.route`.
   Lancement : `npm run test:e2e:auth`. Port distinct pour coexister avec le
   serveur dev de 5173. */

const PORT = 5174;
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './e2e/auth',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: process.env.CI === 'true',
  retries: process.env.CI === 'true' ? 2 : 0,
  reporter: [['list']],
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: 'on-first-retry',
    locale: 'fr-FR',
    timezoneId: 'Africa/Abidjan',
    serviceWorkers: 'block',
    // Neutralise les animations/transitions (index.css respecte
    // `prefers-reduced-motion`) : en-tête stable et sections `.reveal` visibles.
    reducedMotion: 'reduce',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npx vite --config vite.auth.config.ts --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 90_000,
  },
});

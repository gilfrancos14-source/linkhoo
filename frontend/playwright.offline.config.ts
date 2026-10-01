import { defineConfig, devices } from '@playwright/test';

/* Config dédiée aux specs hors-ligne (PWA) — `npm run test:e2e:offline`.
   Différences avec `playwright.config.ts` :
   - `serviceWorkers: 'allow'` : le SW Linkhoo doit s'installer ;
   - le serveur est `e2e/offline-server.mjs` : il sert `dist/` ET les mocks
     d'API (les fetch émis depuis le service worker ne sont pas
     interceptables par `page.route()`) ;
   - `baseURL` :4173, pour coexister avec le serveur dev de5173. */

const PORT = 4173;
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/offline*.spec.ts',
  fullyParallel: true,
  forbidOnly: process.env.CI === 'true',
  retries: process.env.CI === 'true' ? 2 : 0,
  reporter: [['list']],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: 'on-first-retry',
    locale: 'fr-FR',
    timezoneId: 'Africa/Abidjan',
    serviceWorkers: 'allow',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // Le build est exigé avant le lancement : `test:e2e:offline` le fait.
    command: 'node e2e/offline-server.mjs',
    url: baseURL,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});

import { test, expect, type Page } from '@playwright/test';

/* Spec hors-ligne (PWA) — lancée par `npm run test:e2e:offline`
   (config dédiée : service workers autorisés, serveur `dist/` + mocks
   d'API dans `e2e/offline-server.mjs`).

   Séquence de référence :
   1. visite en ligne → le service worker s'installe ;
   2. rechargement en ligne sous contrôle du SW → les caches (pages, API,
      images, assets) se remplissent ;
   3. `context.setOffline(true)` → rechargement : tout doit provenir du
      cache, y compris les données d'API et les images décodées. */

async function waitForServiceWorkerControl(page: Page): Promise<void> {
  await page.waitForFunction(
    async () => {
      try {
        await navigator.serviceWorker.ready;
        return navigator.serviceWorker.controller !== null;
      } catch {
        return false;
      }
    },
    undefined,
    { timeout: 30_000 },
  );
}

async function waitForCaches(page: Page): Promise<void> {
  await page.waitForFunction(
    async () => {
      try {
        const api = await caches.open('linkhoo-api-v1');
        const apiKeys = await api.keys();
        const img = await caches.open('linkhoo-img-v1');
        const imgKeys = await img.keys();
        return apiKeys.length > 0 && imgKeys.length > 0;
      } catch {
        return false;
      }
    },
    undefined,
    { timeout: 30_000 },
  );
}

test.describe('consultation hors-ligne', () => {
  test("l'accueil se recharge hors-ligne avec données et images en cache", async ({
    page,
    context,
  }) => {
    // 1. Première visite en ligne : le SW s'installe en arrière-plan.
    await page.goto('/ci');
    await expect(page.locator('#plus-loues')).toBeVisible();
    await waitForServiceWorkerControl(page);

    // 2. Rechargement sous contrôle du SW : les caches se remplissent.
    await page.reload();
    await expect(page.getByText('Studio Cocody Riviera').first()).toBeVisible();
    await waitForCaches(page);

    // 3. Couper le réseau, puis recharger.
    await context.setOffline(true);
    await page.reload();

    // Données d'API servies depuis le cache : les cartes populaires
    // réapparaissent (sans cache API, PopularSection se masque en erreur).
    await expect(page.locator('#plus-loues')).toBeVisible();
    await expect(page.getByRole('heading', { name: /plus demandés/ })).toBeVisible();
    await expect(page.getByText('Studio Cocody Riviera').first()).toBeVisible();

    // Images réellement décodées depuis le cache (pas seulement présentes).
    const hasDecodedImage = await page.evaluate(() =>
      [...document.images].some((img) => img.complete && img.naturalWidth > 0),
    );
    expect(hasDecodedImage).toBe(true);

    // Manifest accessible depuis le cache : condition d'installabilité.
    const manifestOk = await page.evaluate(async () => {
      const res = await fetch('/manifest.json');
      if (!res.ok) return false;
      const manifest = (await res.json()) as { short_name?: string; display?: string };
      return manifest.short_name === 'Linkhoo' && manifest.display === 'standalone';
    });
    expect(manifestOk).toBe(true);

    // Polices servies depuis le cache local : le texte reste net hors-ligne.
    const fontsLoaded = await page.evaluate(() => document.fonts.status === 'loaded');
    expect(fontsLoaded).toBe(true);
  });

  test('une fiche déjà visitée reste consultable hors-ligne', async ({
    page,
    context,
  }) => {
    await page.goto('/ci');
    await waitForServiceWorkerControl(page);

    // Visite de la fiche sous contrôle du SW : HTML, chunk lazy, fiche API.
    await page.goto('/ci/chambre/rm-1');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Studio Cocody Riviera',
    );

    await context.setOffline(true);
    await page.reload();

    // La navigation hors-ligne retombe sur le cache de pages (ou le shell
    // en cache) et la fiche se reconstruit depuis l'API en cache.
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Studio Cocody Riviera',
    );
    await expect(page.getByText(/Cocody/).first()).toBeVisible();
  });

  test("une page jamais visitée affiche le repli hors-ligne, pas un crash", async ({
    page,
    context,
  }) => {
    await page.goto('/ci');
    await waitForServiceWorkerControl(page);

    // Préchauffage : rechargement sous contrôle du SW pour que le shell
    // (index.html, JS, CSS) soit en cache — sans ça, une page jamais
    // visitée ne reçoit même pas les assets du bundle.
    await page.reload();
    await expect(page.locator('#plus-loues')).toBeVisible();

    await context.setOffline(true);
    // Route non pré-cachée : le SW sert son document de repli (503) ou le
    // shell en cache. Jamais une page blanche.
    await page.goto('/ci/mentions-legales');
    const heading = page.locator('h1');
    await expect(heading).toBeVisible();
    const text = (await heading.first().textContent()) ?? '';
    expect(text.length).toBeGreaterThan(0);
  });
});

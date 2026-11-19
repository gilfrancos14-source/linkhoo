import '@testing-library/jest-dom/vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
import { configure } from '@testing-library/react';
// Les tests rendent souvent des composants isolément (Footer, Header…) sans
// passer par App.tsx : on initialise i18next une fois pour toutes ici, sinon
// les clés de traduction s'affichent à la place du texte français.
import i18n from '../i18n/config';
import { afterEach, beforeEach, expect } from 'vitest';

// Plusieurs suites appellent `vi.resetModules()` (souvent dans un afterEach)
// pour recharger un module avec un env différent. Cela invalide aussi le module
// `chai` sur lequel jest-dom avait enregistré ses matchers : les tests suivants
// échouent alors avec « Invalid Chai property: toBeInTheDocument ». On les
// ré-applique avant ET après chaque test pour être indépendant de l'ordre des
// hooks des fichiers de test.
beforeEach(async () => {
  expect.extend(matchers);
  // LanguageDetector lit navigator.language (en-US sous jsdom) avant le
  // fallback : on force le français pour que les assertions portent sur le
  // même texte que l'application en production.
  if (typeof window !== 'undefined') window.localStorage.setItem('i18nextLng', 'fr');
  await i18n.changeLanguage('fr');
});
afterEach(() => {
  expect.extend(matchers);
});

// Les routes lazy mettent parfois plus d'une seconde à se résoudre quand toute
// la suite tourne en parallèle (transformation Vite + jsdom). Le défaut de
// Testing Library (1 s) provoque des échecs intermittents sur les pages
// chargées à la demande : on laisse 15 s, le délai par test restant à 30 s.
configure({ asyncUtilTimeout: 15_000 });

// JSDOM n'implémente ni IntersectionObserver ni scrollTo : sans ces stubs,
// tout render de page ou section lève.
if (!('IntersectionObserver' in globalThis)) {
  class IntersectionObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  globalThis.IntersectionObserver =
    IntersectionObserverStub as unknown as typeof IntersectionObserver;
}

// Recharts (ResponsiveContainer) mesure son conteneur via ResizeObserver.
if (!('ResizeObserver' in globalThis)) {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}

if (!window.scrollTo) {
  window.scrollTo = (() => {}) as typeof window.scrollTo;
}

// jsdom n'implémente pas matchMedia (LandingSlider lit prefers-reduced-motion).
if (typeof window.matchMedia !== 'function') {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

// Les suites ne doivent pas dépendre du .env local : un clone vierge et la CI
// n'ont pas de frontend/.env, Clerk serait alors déclaré non configuré et une
// vingtaine de tests tomberaient. Valeur de clé de développement (publique)
// identique à celle de .env, lue par import.meta.env via process.env.
const nodeProcess = (
  globalThis as {
    process?: { env: Record<string, string | undefined> };
  }
).process;
if (nodeProcess && !nodeProcess.env.VITE_CLERK_PUBLISHABLE_KEY) {
  nodeProcess.env.VITE_CLERK_PUBLISHABLE_KEY =
    'pk_test_ZXBpYy1zcG9uZ2UtODkzMy5jbGVyay5hY2NvdW50cy5kZXYk';
}

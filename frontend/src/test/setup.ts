import '@testing-library/jest-dom/vitest';

// JSDOM n'implémente ni IntersectionObserver (useRevealOnScroll) ni
// scrollTo : sans ces stubs, tout render de page ou section lève.
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

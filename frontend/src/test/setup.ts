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

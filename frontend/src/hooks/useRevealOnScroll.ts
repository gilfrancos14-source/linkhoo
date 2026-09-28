import { useEffect } from 'react';

const OBSERVER_OPTIONS: IntersectionObserverInit = {
  threshold: 0.05,
  rootMargin: '0px 0px -40px 0px',
};

function isInViewport(el: Element): boolean {
  const rect = el.getBoundingClientRect();
  return rect.top < window.innerHeight && rect.bottom > 0;
}

/**
 * Anime l'apparition des blocs `.reveal` au scroll.
 *
 * Les sections (Popular, Promos, Categories…) montent leurs nœuds après le
 * premier rendu, à la fin du fetch : un simple querySelectorAll() à l'ouverture
 * les rate et ils restent en `opacity: 0` (index.css). Un MutationObserver
 * prend donc en charge les éléments ajoutés plus tard.
 */
export function useRevealOnScroll() {
  useEffect(() => {
    const handled = new WeakSet<Element>();

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    }, OBSERVER_OPTIONS);

    const register = (el: Element) => {
      if (handled.has(el)) return;
      handled.add(el);
      if (isInViewport(el)) {
        el.classList.add('is-visible');
      } else {
        observer.observe(el);
      }
    };

    const scan = (root: Element) => {
      if (root.classList.contains('reveal')) register(root);
      root.querySelectorAll('.reveal').forEach(register);
    };

    scan(document.body);

    const mutations = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) scan(node as Element);
        }
      }
    });
    mutations.observe(document.body, { childList: true, subtree: true });

    return () => {
      mutations.disconnect();
      observer.disconnect();
    };
  }, []);
}

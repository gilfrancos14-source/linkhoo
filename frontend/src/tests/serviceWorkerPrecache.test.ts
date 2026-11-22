import { describe, expect, it } from 'vitest';
// `?raw` (Vite) lit le fichier comme texte sans dépendance node:fs, ce qui
// reste compilable par `tsc -b` du build (types: vite/client uniquement).
import swSource from '../../public/sw.js?raw';
import swLibSource from '../lib/sw.js?raw';

describe('service worker — précache', () => {
  it('ne précharge aucun faux fichier /css/*.css', () => {
    const match = swSource.match(/const PRECACHE = \[([\s\S]*?)\];/);
    const paths = [...(match?.[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(paths.some((p) => p.includes('/css/'))).toBe(false);
  });

  it('précharge les fichiers attendus (index, manifest, icônes)', () => {
    const match = swSource.match(/const PRECACHE = \[([\s\S]*?)\];/);
    const paths = [...(match?.[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(paths).toContain('/index.html');
    expect(paths).toContain('/manifest.json');
    expect(paths).toContain('/icons/icon-192.png');
    expect(paths).toContain('/icons/icon-512.png');
  });

  it('gère la navigation SPA avec un fallback index.html', () => {
    expect(swSource).toContain('isNavigation');
    expect(swSource).toContain("cache.put('/index.html'");
  });

  it('ne met jamais en cache les requêtes authentifiées', () => {
    expect(swSource).toContain("request.headers.has('authorization')");
    expect(swSource).toContain("request.headers.has('cookie')");
  });

  it('public/sw.js et src/lib/sw.js sont synchronisés', () => {
    expect(swLibSource).toBe(swSource);
  });
});

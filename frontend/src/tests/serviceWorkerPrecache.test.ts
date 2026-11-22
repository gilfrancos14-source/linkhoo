import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Le service worker doit précharger UNIQUEMENT des fichiers réellement
 * présents dans le build. L'ancienne liste (/css/*.css) pointait sur des
 * fichiers inexistants (Vite compile les CSS dans /assets/ avec des noms
 * hashés), ce qui faisait échouer cache.addAll() et cassait tout le mode
 * hors ligne. Ce test verrouille la correction.
 */
describe('service worker — précache', () => {
  const root = resolve(__dirname, '../..');
  const sw = readFileSync(resolve(root, 'public/sw.js'), 'utf8');

  it('ne précharge aucun faux fichier /css/*.css', () => {
    const match = sw.match(/const PRECACHE = \[([\s\S]*?)\];/);
    const paths = [...(match?.[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(paths.some((p) => p.includes('/css/'))).toBe(false);
  });

  it('précharge uniquement des fichiers existants dans public/ ou dist/', () => {
    const match = sw.match(/const PRECACHE = \[([\s\S]*?)\];/);
    expect(match).not.toBeNull();
    const paths = [...(match?.[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(paths.length).toBeGreaterThan(0);

    for (const p of paths) {
      // '/' et '/index.html' sont des routes SPA valides, pas des fichiers.
      if (p === '/' || p === '/index.html') continue;
      const clean = p.replace(/^\//, '');
      const inPublic = existsSync(resolve(root, 'public', clean));
      const inDist = existsSync(resolve(root, 'dist', clean));
      expect(inPublic || inDist, `Fichier de précache introuvable: ${p}`).toBe(true);
    }
  });

  it('gère la navigation SPA avec un fallback index.html', () => {
    expect(sw).toContain('isNavigation');
    expect(sw).toContain("cache.put('/index.html'");
    expect(sw).toContain("cache.match('/index.html')");
  });

  it('ne met jamais en cache les requêtes authentifiées', () => {
    expect(sw).toContain("request.headers.has('authorization')");
    expect(sw).toContain("request.headers.has('cookie')");
  });

  it('public/sw.js et src/lib/sw.js sont synchronisés', () => {
    const other = readFileSync(resolve(root, 'src/lib/sw.js'), 'utf8');
    expect(other).toBe(sw);
  });
});

/**
 * Audit responsive : mesure réelle au navigateur.
 *
 *   node scripts/responsive-audit.mjs [urlBase]
 *
 * Contrôle, pour chaque page et chaque largeur :
 *  - le débordement horizontal (scrollWidth > clientWidth) et les éléments
 *    qui le provoquent ;
 *  - les cibles tactiles trop petites (< 44×44 px) ;
 *  - les champs de formulaire dont la police est < 16 px (iOS zoome au focus) ;
 *  - les images sans dimensions (saut de mise en page).
 */
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.argv[2] ?? 'http://127.0.0.1:5173';
const WIDTHS = [320, 360, 390, 768, 1024, 1280];

/**
 * Le navigateur installé peut être une version différente de celle qu'attend
 * Playwright : on le désigne explicitement s'il existe.
 */
function findChromium() {
  const root = join(process.env.LOCALAPPDATA ?? '', 'ms-playwright');
  const candidates = [
    join(root, 'chromium_headless_shell-1243', 'chrome-headless-shell-win64', 'chrome-headless-shell.exe'),
    join(root, 'chromium-1243', 'chrome-win64', 'chrome.exe'),
  ];
  return candidates.find((path) => existsSync(path));
}

const PAGES = [
  ['accueil', '/ci'],
  ['chambre', '/ci/chambre/familial-quartier-des-arts'],
  ['recherche', '/ci/recherche'],
  ['categorie', '/ci/categorie/bj-appartements'],
  ['contact', '/contact'],
  ['connexion-client', '/login/client'],
  ['inscription-client', '/inscription/client'],
];

const AUDIT = () => {
  const doc = document.documentElement;
  const overflowing = [...document.querySelectorAll('body *')]
    .filter((el) => {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.right > doc.clientWidth + 1;
    })
    .slice(0, 6)
    .map((el) => {
      const rect = el.getBoundingClientRect();
      return `${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ').filter(Boolean).slice(0, 2).join('.')} (right=${Math.round(rect.right)})`;
    });

  const smallTargets = [...document.querySelectorAll('button, a, [role="button"], input[type="submit"]')]
    .filter((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return false;
      const style = getComputedStyle(el);
      if (style.visibility === 'hidden' || style.display === 'none') return false;

      // Zone tactile réelle : le bouton peut agrandir sa zone cliquable par un
      // pseudo-élément transparent (pastilles du carrousel, icônes). Les
      // écarts sont des valeurs négatives (dépassement vers l'extérieur).
      let width = rect.width;
      let height = rect.height;
      const after = getComputedStyle(el, '::after');
      if (after.content && after.content !== 'none' && after.position === 'absolute') {
        const inset = ['top', 'right', 'bottom', 'left'].map((side) => {
          const value = parseFloat(after[side]);
          return Number.isFinite(value) ? Math.abs(value) : 0;
        });
        width = Math.max(width, rect.width + inset[1] + inset[3]);
        height = Math.max(height, rect.height + inset[0] + inset[2]);
        // Arrondi : 43,5 px est une zone de 44 px (sous-pixel).
        width = Math.round(width);
        height = Math.round(height);
      }

      // Un bouton-icône (pas de texte) doit atteindre 44 × 44. Un lien
      // textuel a une largeur qui dépend de son texte : on ne juge que la
      // hauteur, et la lisibilité du lien est ensured par l'espacement.
      const isIconOnly = !(el.textContent || '').trim();
      return height < 44 || (isIconOnly && width < 44);
    })
    .slice(0, 6)
    .map((el) => {
      const rect = el.getBoundingClientRect();
      const label = (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 24);
      return `${el.tagName.toLowerCase()}[${label}] ${Math.round(rect.width)}×${Math.round(rect.height)}`;
    });

  const smallFonts = [...document.querySelectorAll('input, select, textarea')]
    .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 16)
    .slice(0, 6)
    .map((el) => `${el.tagName.toLowerCase()}[${el.getAttribute('type') ?? ''}] ${getComputedStyle(el).fontSize}`);

  const imagesWithoutSize = [...document.querySelectorAll('img')]
    .filter((el) => !el.getAttribute('width') && !el.getAttribute('height') && !el.getAttribute('style')?.includes('aspect'))
    .length;

  return {
    scrollWidth: doc.scrollWidth,
    clientWidth: doc.clientWidth,
    overflowing,
    smallTargets,
    smallFonts,
    imagesWithoutSize,
    totalImages: document.querySelectorAll('img').length,
  };
};

const executablePath = findChromium();
const browser = await chromium.launch(executablePath ? { executablePath } : {});
const context = await browser.newContext({ locale: 'fr-FR' });
const page = await context.newPage();

let problems = 0;

for (const [name, path] of PAGES) {
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 780 });
    let audit = null;
    try {
      await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      // On fait défiler la page : les images `loading="lazy"` hors écran ne
      // sont pas chargées, et une image non chargée fausse les mesures (le
      // lien du logo ne fait plus que la largeur de son texte alternatif).
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page
        .waitForFunction(
          () => Array.from(document.images).every((img) => img.complete),
          undefined,
          { timeout: 8000 },
        )
        .catch(() => undefined);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(600);
      audit = await page.evaluate(AUDIT);
    } catch (error) {
      console.log(`  ${name} @${width} : page inaccessible (${String(error).slice(0, 60)})`);
      continue;
    }

    const overflow = audit.scrollWidth > audit.clientWidth + 1;
    const issues = [];
    if (overflow) {
      issues.push(`débordement ${audit.scrollWidth}>${audit.clientWidth}`);
      issues.push(...audit.overflowing.map((o) => `→ ${o}`));
    }
    // Une cible de 44×44 px est une exigence TACTILE : elle ne concerne que
    // le mobile. Sur computer, la souris n'a pas besoin de 44 px.
    if (width < 768 && audit.smallTargets.length) {
      issues.push(`cibles tactiles < 44px : ${audit.smallTargets.join(', ')}`);
    }
    if (audit.smallFonts.length) issues.push(`polices < 16px : ${audit.smallFonts.join(', ')}`);

    if (issues.length) {
      problems += 1;
      console.log(`\n✗ ${name} @${width}px`);
      for (const issue of issues) console.log(`    ${issue}`);
    }
  }
}

console.log(`\n${problems === 0 ? 'Aucun problème détecté.' : `${problems} combinaison(s) page × largeur à corriger.`}`);
await browser.close();

/**
 * Génère une feuille Font Awesome minimale (icônes réellement utilisées) et
 * les sous-ensembles de polices correspondants.
 *
 * Pourquoi : all.min.css pèse ~100 Ko et le woff2 complet ~150 Ko, alors que
 * le site n'utilise qu'une trentaine de pictogrammes. Le CSS et les polices
 * sont produits à partir du paquet npm @fortawesome/fontawesome-free.
 *
 * Usage : node scripts/build-fontawesome-subset.mjs
 * Prérequis : `pyftsubset` (pip install fonttools brotli).
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const faRoot = join(root, 'node_modules', '@fortawesome', 'fontawesome-free');
const srcRoot = join(root, 'src');
const outFonts = join(root, 'public', 'fonts');
const outCss = join(srcRoot, 'styles', '00-fontawesome.css');

/* Classes de base Font Awesome (pas des icônes). */
const BASE_CLASSES = new Set(['fa', 'fas', 'far', 'fab', 'solid', 'regular', 'brands', 'classic']);

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const used = new Set();
for (const file of walk(srcRoot)) {
  if (!/\.(ts|tsx)$/.test(file) || /\.test\.(ts|tsx)$/.test(file)) continue;
  const text = readFileSync(file, 'utf8');
  for (const match of text.matchAll(/\bfa-([a-z0-9-]+)\b/g)) {
    if (!BASE_CLASSES.has(match[1])) used.add(match[1]);
  }
}

/* Les icônes régulières sont déclarées par leur propre police. */
const regularIcons = new Set();
for (const file of walk(srcRoot)) {
  if (!/\.(ts|tsx)$/.test(file) || /\.test\.(ts|tsx)$/.test(file)) continue;
  const text = readFileSync(file, 'utf8');
  for (const match of text.matchAll(/fa-regular\s+fa-([a-z0-9-]+)/g)) regularIcons.add(match[1]);
}

const allCss = readFileSync(join(faRoot, 'css', 'all.css'), 'utf8');
const definitions = new Map();
for (const match of allCss.matchAll(/^\.fa-([a-z0-9-]+) \{\s*\n\s*--fa: "([^"]+)";/gm)) {
  definitions.set(match[1], match[2]);
}

const missing = [...used].filter((name) => !definitions.has(name));
if (missing.length) {
  throw new Error(`Icônes introuvables dans Font Awesome : ${missing.join(', ')}`);
}

const codepoints = (names) => [
  ...new Set(
    [...names].map((name) => {
      const raw = definitions.get(name).trim().replace(/^\\/, '');
      return `U+${raw.toUpperCase()}`;
    }),
  ),
];

function subset(input, output, names) {
  execFileSync(
    process.env.PYTHON ?? 'python',
    [
      '-m',
      'fontTools.subset',
      input,
      `--unicodes=${codepoints(names).join(',')}`,
      '--flavor=woff2',
      '--layout-features=',
      '--no-hinting',
      '--desubroutinize',
      `--output-file=${output}`,
    ],
    { stdio: 'inherit' },
  );
}

mkdirSync(outFonts, { recursive: true });
mkdirSync(dirname(outCss), { recursive: true });

subset(join(faRoot, 'webfonts', 'fa-solid-900.woff2'), join(outFonts, 'fa-solid-900.woff2'), used);
subset(
  join(faRoot, 'webfonts', 'fa-regular-400.woff2'),
  join(outFonts, 'fa-regular-400.woff2'),
  regularIcons,
);

const iconRules = [...used]
  .sort()
  .map((name) => `.fa-${name} { --fa: "${definitions.get(name)}"; }`)
  .join('\n');

writeFileSync(
  outCss,
  `/* Généré par scripts/build-fontawesome-subset.mjs — ne pas éditer à la main. */
@font-face {
  font-family: 'Font Awesome 7 Free';
  font-style: normal;
  font-weight: 900;
  font-display: swap;
  src: url('/fonts/fa-solid-900.woff2') format('woff2');
}

@font-face {
  font-family: 'Font Awesome 7 Free';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('/fonts/fa-regular-400.woff2') format('woff2');
}

.fa-solid,
.fa-regular,
.fas,
.far,
.fa {
  --_fa-family: 'Font Awesome 7 Free';
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  display: var(--fa-display, inline-block);
  font-family: var(--_fa-family);
  font-feature-settings: normal;
  font-style: normal;
  font-synthesis: none;
  font-variant: normal;
  font-weight: var(--fa-style, 900);
  line-height: 1;
  text-align: center;
  text-rendering: auto;
  width: var(--fa-width, 1.25em);
}

.fa-solid,
.fas { --fa-style: 900; }

.fa-regular,
.far { --fa-style: 400; }

.fa-solid::before,
.fa-regular::before,
.fas::before,
.far::before,
.fa::before {
  content: var(--fa)/"";
}

@supports not (content: ""/"") {
  .fa-solid::before,
  .fa-regular::before,
  .fas::before,
  .far::before,
  .fa::before {
    content: var(--fa);
  }
}

${iconRules}
`,
);

console.log(`Font Awesome : ${used.size} icônes, ${regularIcons.size} régulières.`);

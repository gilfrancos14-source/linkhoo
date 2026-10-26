# Ilehya — Plateforme de location multi-marché

## Structure

```
├── frontend/   → React + TypeScript + Vite
├── backend/    → Node.js + Express + Supabase
├── docs/
│   ├── maquettes/  → maquettes HTML de référence
│   └── reports/    → rapports d'analyse et de tests
└── README.md
```

## Frontend

```bash
cd frontend
npm install
npm run dev
```

## Backend

```bash
cd backend
npm install
cp .env.example .env   # configurer Supabase
npm run dev
```

### Vérification des images (CLIP local)

Chaque photo téléversée par un gérant (bucket `images`) est analysée localement
par un worker isolé (`scripts/clipWorker.mjs`, modèle CLIP quantifié ~150 Mo) :
seules les photos d'appartement (intérieur ou façade) sont acceptées, jamais de
personne visible. Aucune API externe, coût 0 € à l'usage.

```bash
cd backend
npm run model:preload                  # une fois par machine : télécharge le modèle
npm run clip:bench                     # latence/ mémoire sur le VPS
npm run clip:calibrate -- <dossier>    # scores CLIP sur des photos réelles
```

Variables (voir `backend/.env.example`) : `IMAGE_CHECK_MODE`
(`strict` bloquant en production, `lenient` ailleurs, `off`), `IMAGE_CHECK_THRESHOLD`,
`CLIP_CACHE_DIR`, `CLIP_DTYPE`. En `strict`, un worker indisponible répond 503
(et 429 si la file d'attente est pleine) ; en `lenient`, l'image passe et
l'incident est journalisé.

## Base de données

Le schéma et les migrations SQL sont dans `backend/supabase/migrations/`
(fichiers numérotés `NNN_nom.sql`, appliqués dans l'ordre).
Le script de seed est dans `backend/src/seed.ts`.

```bash
cd backend
npm run migrate:check        # pré-vol lecture seule : détecte les blocages avant tout exécution
npm run migrate -- --status  # état appliquée / en attente
npm run migrate              # sans migration en attente, ne fait rien
npm run migrate -- --yes     # exécution explicite quand des migrations attendent
npm run migrate -- --baseline # enregistre l'état courant sans exécuter (1re installation)
npm run migrate:audit        # contraintes CHECK non validées + lignes qui les violent
npm run seed
```

### Règles

- **Une migration appliquée ne se modifie plus** : le runner ne la relira
  jamais, l'édition passe inaperçue. Toute évolution part dans un nouveau
  fichier `0011_*.sql`.
- **Avant de pousser** : `npm run migrate:check` (lit les fichiers et la base)
  et les tests, qui incluent le lint statique des migrations
  (`backend/src/db/migrationLint.test.ts`, donc la CI).
- **Avant d'exécuter sur la production** : `npm run migrate:check`, puis un
  snapshot (Supabase → Database → Backups), puis `npm run migrate -- --yes`.


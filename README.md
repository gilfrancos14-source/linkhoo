# Ilehya — Plateforme de location multi-marché

## Stack

| Couche | Technologie |
|---|---|
| Frontend | React + TypeScript + Vite (statique, servi par Nginx) |
| Backend | Node.js + Express + `pg` |
| Base | **PostgreSQL 16** auto-hébergé (VPS LWS) |
| Fichiers | disque local + Nginx (photos publiques) / URLs signées HMAC (documents privés) |
| Auth | Clerk |
| Paiement | pawaPay |

> Historique : la base était Supabase. La pile est désormais auto-hébergée.
> Le pilote `DB_DRIVER=supabase` reste disponible comme filet de sécurité
> pendant la bascule (voir `backend/src/config/supabase.ts`).

## Structure

```
├── frontend/   → React + TypeScript + Vite
├── backend/    → Node.js + Express + adaptateur PostgreSQL
├── deploy/     → Docker Compose prod, Nginx, scripts de sauvegarde
├── docker-compose.dev.yml  → PostgreSQL 16 de développement
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

### Contrôle responsive (mobile-first)

```bash
npm run audit:responsive   # nécessite le serveur de dev sur :5173
```

Le script ouvre les pages principales dans Chromium et mesure, pour chaque
largeur (320 → 1280 px) : le débordement horizontal, la taille des cibles
tactiles (44 × 44 px minimum sur mobile) et la taille des polices de saisie
(16 px minimum, sinon iOS zoome la page au focus).

## Backend

```bash
# 1. Base de données locale (PostgreSQL 16, port 5434)
docker compose -f docker-compose.dev.yml up -d

cd backend
npm install
cp .env.example .env        # renseigner DATABASE_URL, les clés Clerk/pawaPay, etc.

npm run migrate -- --yes    # crée le schéma depuis zéro
npm run seed                # jeu de données de démonstration
npm run dev
```

## Base de données

Le schéma et les migrations SQL sont dans `backend/supabase/migrations/`
(fichiers numérotés `NNN_nom.sql`, appliqués dans l'ordre).
`backend/supabase/bootstrap.sql` est le préambule exécuté avant les migrations :
il crée le schéma `storage`, la table `storage.buckets`, les rôles
`anon`/`authenticated`/`service_role` et l'extension `uuid-ossp`, afin que les
migrations s'appliquent **sans être réécrites** sur un PostgreSQL nu.
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

### Tests d'intégration

L'adaptateur PostgreSQL est couvert par des tests qui s'exécutent sur une vraie
base (ignorés si `DATABASE_URL` est absent) :

```bash
cd backend
DATABASE_URL=postgresql://ilehya:ilehya_dev_password@localhost:5434/ilehya \
  npx vitest run src/db/postgrest.integration.test.ts
```

### Règles

- **Une migration appliquée ne se modifie plus** : le runner ne la relira
  jamais, l'édition passe inaperçue. Toute évolution part dans un nouveau
  fichier `0011_*.sql`.
- **Avant de pousser** : `npm run migrate:check` (lit les fichiers et la base)
  et les tests, qui incluent le lint statique des migrations
  (`backend/src/db/migrationLint.test.ts`, donc la CI).
- **Avant d'exécuter sur la production** : `npm run migrate:check`, puis une
  sauvegarde (`deploy/backup/backup.sh`), puis `npm run migrate -- --yes`.

## Stockage des fichiers

Deux dossiers sous `STORAGE_DIR` (défaut `./storage`, production
`/var/lib/ilehya/storage`) :

- `images/` : photos d'annonces, publiques, servies par Nginx (`/media/…`) ;
- `verification-docs/` : pièces justificatives, privées, servies par l'API via
  une URL signée HMAC avec expiration (`/api/media/verification-docs/…?exp=…&sig=…`).

## Production

Le runbook complet (préparation du VPS, DNS, TLS, migrations, sauvegardes,
restauration, rollback, check-list go/no-go) se trouve dans
[`deploy/README.md`](deploy/README.md).


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


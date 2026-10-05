# Ilehya — Plateforme de location multi-marché

## Structure

```
├── frontend/   → React + TypeScript + Vite
├── backend/    → Node.js + Express + Supabase
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

## Base de données

Le schéma et les migrations SQL sont dans `backend/supabase/migrations/`
(fichiers numérotés `NNN_nom.sql`, appliqués dans l'ordre).
Le script de seed est dans `backend/src/seed.ts`.

```bash
cd backend
npm run migrate            # applique les migrations en attente (SUPABASE_DB_URL requis)
npm run migrate -- --status  # état appliquée / en attente
npm run migrate -- --baseline # enregistre l'état courant sans exécuter (1re installation)
npm run seed
```


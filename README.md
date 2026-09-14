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

Le schéma SQL est dans `backend/supabase/schema.sql`.
Le script de seed est dans `backend/src/seed.ts`.

```bash
cd backend
npm run seed
```

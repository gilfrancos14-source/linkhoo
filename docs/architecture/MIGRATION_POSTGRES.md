# Migration Supabase → PostgreSQL auto-hébergé

Document de référence du passage de la plateforme de Supabase à une pile
auto-hébergée sur VPS LWS (4 vCPU / 8 Go, Ubuntu 24.04 LTS).

**Date de bascule :** mardi 17 novembre 2026.

---

## 1. Cible

```
Internet
   │
   ▼
Nginx (hôte, TLS Let's Encrypt)          https://app.ilehya.com
   ├── /            → frontend statique (build Vite)      /var/www/ilehya
   ├── /media/      → photos d'annonces (cache 30 j)     /var/lib/ilehya/storage/images
   ├── /api/        → API Node (Docker)                  127.0.0.1:3001
   └── /api/media/  → documents privés (URL signée)      API

API Node (Express)                       conteneur Docker
   ├── PostgreSQL 16                       conteneur Docker, réseau privé
   ├── Clerk (authentification)            externe
   ├── pawaPay (paiements)                 externe
   └── Resend (emails)                     externe
```

## 2. Ce qui a changé

| Avant | Après |
|---|---|
| Supabase (Postgres + PostgREST + Storage + Realtime) | PostgreSQL 16 + `pg` + disque local |
| `supabase-js` dans 25 fichiers | adaptateur de compatibilité (`db/postgrest`) — même API |
| Supabase Storage (2 buckets) | disque : `images/` public, `verification-docs/` privé |
| Realtime Broadcast | supprimé (le frontend interroge déjà toutes les 30 s) |
| RLS Supabase | désactivée : l'autorisation est dans l'API (Clerk + métier) |

## 3. Le choix de l'adaptateur

Réécrire 63 appels `supabaseAdmin.from(...)` en SQL explicite représente 5 à 8
jours de travail et, surtout, le principal risque avant une ouverture au
public. L'adaptateur `backend/src/db/postgrest.ts` conserve l'API de
`supabase-js` et la traduit en SQL exécuté par `pg` :

- `from(table).select(cols).eq().order().range()` → `SELECT … WHERE … ORDER BY …`;
- `insert/update/upsert/delete` → `INSERT … RETURNING`, `ON CONFLICT …`;
- `rpc(name, args)` → `SELECT * FROM fonction(arg => $1)` ;
- `count: 'exact'` + `head: true` → `SELECT count(*)` ;
- ressources imbriquées (`room:rooms(...)`, `rooms!inner(...)`) → résolution
  automatique de la clé étrangère, puis rattachement en JavaScript.

**Cette couche est temporaire.** Le plan de nettoyage consiste à porter les
routes domaine par domaine sur des repositories (`db/query.ts`) et à supprimer
`db/postgrest.ts`, `db/storage.ts` et `config/supabase.ts`. Elle ne doit pas
recevoir de nouvelles fonctionnalités.

## 4. Points techniques traités avec attention

- **Types numériques** : `pg` renvoie `BIGINT`/`NUMERIC` en texte, PostgREST
  en nombre. Sans correction, `"150000" > 1000` serait une comparaison de
  chaînes et les montants de paiement deviendraient faux. Les parseurs de
  types sont donc ajustés dans `db/pool.ts`.
- **Dates** : `pg` renvoie des objets `Date`, PostgREST des chaînes ISO. On
  conserve les chaînes pour rester compatible avec le code existant.
- **Colonnes `jsonb`** : `pg` sérialise un tableau JS en littéral PostgreSQL
  (`{a,b}`), ce que PostgreSQL refuse dans une colonne `jsonb`. L'adaptateur
  consulte le type réel de la colonne avant d'écrire.
- **Migrations** : 39 fichiers SQL référencent le schéma `storage` et les
  rôles `anon`/`authenticated`/`service_role`. Plutôt que de les réécrire,
  `backend/supabase/bootstrap.sql` crée ces objets (idempotent, sans effet
  sur Supabase) avant l'application des migrations.
- **Stockage** : MinIO n'est plus distribuable (images Docker Hub retirées,
  binaires `dl.min.io` en 410 Gone). Le disque + Nginx a été retenu :
  moins de RAM, moins de composants, sauvegarde par simple copie.

## 5. Repli

`DB_DRIVER=supabase` rebascule sur l'ancien client `supabase-js` sans toucher
au code (variables d'environnement uniquement). À garder pendant les premières
semaines de production.

## 6. Ce qui reste hors périmètre

- Suppression de la couche de compatibilité (nettoyage progressif).
- CDN et montée en charge.
- Analyse d'images (CLIP) : à surveiller sur 4 vCPU / 8 Go.
- Migration de l'historique : les données Supabase sont fictives.

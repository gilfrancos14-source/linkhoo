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

## 4 bis. Bug métier trouvé pendant la migration

La migration `20261112140000_payment_claim_premium_market.sql` corrige un bug
**antérieur** à la bascule (donc présent aussi sur Supabase) : la fonction
`payment_claim_premium` lisait `c.market` depuis `payment_claim_succeeded`,
qui ne retourne pas de colonne `market`. PostgreSQL validant la référence de
colonne dès la première exécution, **toute activation d'abonnement premium
échouait** (« column c.market does not exist »).

Le bug était latent : aucun paiement premium n'avait jamais abouti. Il aurait
été payé sans jamais activer l'abonnement au premier client premium.

Il est désormais couvert par `backend/src/db/payments.integration.test.ts`,
qui rejoue le cycle complet (activation, rejeu idempotent, montant incohérent
refusé, réservation marquée payée, demande de remboursement et double
remboursement bloqué).

## 5. Repli

`DB_DRIVER=supabase` rebascule sur l'ancien client `supabase-js` sans toucher
au code (variables d'environnement uniquement). À garder pendant les premières
semaines de production.

## 5 bis. Règles de reversement aux gérants

Deux règles décidées le 12/11/2026, appliquées par
`backend/src/payments/commissions.ts` et `backend/src/payments/service/payout.ts`.

**Commission** — elle dépend du statut du gérant, pas du marché :

| Statut | Commission | Versé |
|---|---|---|
| Premium **et** vérifié | 5 % | 95 % |
| Vérifié seulement | 10 % | 90 % |
| Premium seul | 10 % | 90 % |
| Ni premium ni vérifié | 15 % | 85 % |

Le premium ne compte que s'il est actif (`premium_expires_at` non dépassée).

Formule : `commission = brut × pourcentage`, puis
`net = brut − commission − remboursement`. La plateforme prélève donc toujours
sa part sur le montant **brut** payé par le client ; le reste revient au
gérant, déduction faite des remboursements éventuels.

**Versement** — l'argent n'est versé **qu'après la fin du séjour**, avec un
délai de sécurité de 24 h (`payment_payouts.payout_delay_hours`, 24 par
défaut dans `payment_policies`). Les deux chemins respectent la même règle :
le reversement automatique de fin de séjour, et le retrait manuel demandé par
le gérant (dont le montant provient du même calcul de solde).

Le délai de 24 h existe pour couvrir la fenêtre d'annulation qui suit la fin
d'un séjour : verser à l'instant exact de la fin obligerait à reprendre de
l'argent au gérant.

## 5 ter. Annulation et frais d'annulation

Deux règles décidées le 12/11/2026, appliquées par
`backend/src/payments/cancellation.ts`.

**Fenêtre d'annulation** — l'annulation par le client est possible jusqu'à
**24 h avant la date d'arrivée** ; au-delà, l'API la refuse (403,
`CANCELLATION_DEADLINE_PASSED`). La date limite est calculée côté serveur et
exposée dans `GET /api/reservations/mine` (`cancellation_deadline`) : le front
affiche l'information et désactive le bouton, sans jamais dupliquer la règle.

**Frais d'annulation** — en cas d'annulation, le client est remboursé, mais la
plateforme retient **2 %** du montant (frais d'encaissement) : le client
reçoit 98 %. Le frais est un paramètre explicite de la RPC
`payment_request_refund` (`p_platform_fee`) : la réservation est soldée sur le
montant total (part client + frais), sinon le back-office proposerait de
rembourser les 2 % restants. Il est conservé dans `policy_snapshot` et compte
comme « déjà remboursé », pour qu'une seconde demande ne le reverse pas.

Ces frais ne s'appliquent pas aux décisions du back-office (litige, geste
commercial) : le montant remboursé reste celui choisi par l'administrateur.

La commission de la plateforme (5 / 10 / 15 %) n'est prélevée que sur les
séjours **effectués** : une réservation annulée n'aboutit à aucun reversement
en faveur du gérant.

## 6. Ce qui reste hors périmètre

- Suppression de la couche de compatibilité (nettoyage progressif).
- CDN et montée en charge.
- Analyse d'images (CLIP) : à surveiller sur 4 vCPU / 8 Go.
- Migration de l'historique : les données Supabase sont fictives.

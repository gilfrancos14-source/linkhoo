# Analyse Ilehya — dysfonctionnements et dégradations à 5-10 ans

> Rapport d'analyse technique (lecture seule du code, octobre 2026).
> Stack : Express 4 + Supabase (PostgREST) + Clerk + FedaPay / React 19 + Vite 8 + PWA (service worker maison).
> Volume : ~46 000 LOC (15 000 backend / 31 000 frontend).

**Verdict global** : code globalement très défensif — validations Zod partout, RPC SQL atomiques pour les réservations et les paiements, comments de sécurité explicites. Les risques à 5-10 ans ne sont pas dans la logique métier, mais dans **le volume de données, les caches, et la dette de structure**.

Chaque point : **quoi** → **symptôme dans X ans** → sévérité (🔴 critique / 🟠 élevé / 🟡 moyen / 🟢 faible).

---

## 1. Catalogue & recherche — risque n°1 performance

| # | Problème | Fichier | Symptôme dans X ans |
|---|---|---|---|
| 1.1 🔴 | `GET /api/rooms` renvoie **tout le catalogue** en `select('*')`, paginé par `fetchAllRows` jusqu'à 10 000 lignes | `backend/src/routes/rooms.ts:66-86` | 5 000 biens ⇒ réponse de plusieurs Mo à chaque recherche |
| 1.2 🔴 | La **fiche chambre** télécharge le catalogue entier du marché en plus de la chambre ciblée | `frontend/src/pages/RoomDetailPage.tsx:121`, `SearchResultsPage.tsx:43`, `CategoryPage.tsx` | Chaque vue de page = téléchargement complet du catalogue ; TTFB et data mobiles qui s'effondrent |
| 1.3 🟠 | Filtrage (ville / quartier / catégorie / prix) exécuté **en JS côté client** | `SearchResultsPage.tsx:100-111` | CPU mobile saturé ; résultats faux si le serveur tronque |
| 1.4 🟠 | `/rooms/available` charge **toutes** les réservations en conflit + toutes les chambres, filtre en mémoire | `rooms.ts:88-149` | Latence O(taille de table) par recherche |
| 1.5 🟡 | `/rooms/villes` charge toutes les lignes pour dédupliquer en JS | `rooms.ts:153-184` | Idem, coût croissant |
| 1.6 🔴 | `fetchAllRows` **tronque silencieusement** à 10 000 lignes (`console.warn` seulement) | `backend/src/utils/fetchAll.ts:44` | Dans 10 ans, listes incomplètes sans erreur visible = biens « disparus » |

## 2. Réservations & disponibilité

| # | Problème | Fichier | Symptôme |
|---|---|---|---|
| 2.1 🔴 | `GET /reservations/check` : **aucune limite** → troncature PostgREST à 1000 lignes → faux « aucun conflit » | `backend/src/routes/reservations.ts:344-376` | Au-delà de 1000 réservations sur une chambre, l'UI annonce des dates libres qui ne le sont pas (la création via RPC reste protégée, mais l'UI ment) |
| 2.2 🔴 | `date_debut` / `date_fin` stockées en **TEXT** sans CHECK de format | `backend/supabase/schema.sql:68-69` | Comparaison lexicographique dans le SQL (`schema.sql:379-380`) : une date hors format ISO casse **silencieusement** le test de conflit |
| 2.3 🟠 | Pas d'index composite `(room_id, date_debut, date_fin)` | `schema.sql:155` | Balayage par chambre de plus en plus lent |
| 2.4 🟠 | Réservations gérant : fetch de **tous** les ids de chambres puis `.in('room_id', ids)` | `reservations.ts:40-60` | Requête géante + 2 allers-retours dès un gérant multi-biens |
| 2.5 🟠 | `POST /reservations` public, sans rate-limiter dédié (global 200/15 min seulement) | `reservations.ts:131`, `index.ts:142` | Spam de réservations → tables `reservations` + `notifications` qui gonflent |

## 3. Réservation hors-ligne (PWA) — bugs réels

| # | Problème | Fichier | Symptôme |
|---|---|---|---|
| 3.1 🔴 | Rejeu de `POST /reservations` **sans clé d'idempotence** (id généré côté serveur à chaque appel) | `frontend/src/lib/offlineQueue.ts:105-107` → `backend/src/routes/reservations.ts:156` | Timeout 15 s alors que le serveur a créé la ligne ⇒ **réservation dupliquée** au replay |
| 3.2 🟠 | Un item rejeté définitivement (409 dates prises) reste en file **pour toujours** | `offlineQueue.ts:112-114` | File bloquée, rejeu permanent à chaque reconnexion |
| 3.3 🟡 | File en `localStorage`, max 20 items, pas de purge par ancienneté | `offlineQueue.ts:29,76` | Payloads obsolètes rejoués des mois plus tard |

## 4. Premium / paiement FedaPay

| # | Problème | Fichier | Symptôme |
|---|---|---|---|
| 4.1 🔴 | `is_premium` n'est remis à `false` que si **l'intéressé lui-même** appelle `GET /premium/status` (expiration paresseuse) | `backend/src/routes/premium.ts:443-450` | Aucun job de fond : un gérant expiré reste « premium » partout où on lit le drapeau brut |
| 4.2 🟠 | Badge premium affiché **sans vérifier** `premium_expires_at` | `RoomDetailPage.tsx:361`, `ProfilPage.tsx:104,248`, `AdminLayout.tsx:232,255`, `reservations.ts:272` | Badge mentant pendant des mois ; logique dupliquée 6× (2 variantes divergentes déjà : `!expires_at \|\| date > now`) |
| 4.3 🟡 | `upsert` de la transaction écrase `raw_event` | `premium.ts:58-76` | Perte progressive de l'audit trail des paiements |
| 4.4 🟡 | Pas d'historique de statut : chaque re-confirm réécrit `status` | `premium.ts:260-269` | Impossibilité de reconstituer un cycle de paiement |
| 4.5 🟢 | Idempotence webhook/confirm ✅ correcte via `activate_premium_checked` | `premium.ts:112-115` | Rien à corriger — signalé comme point fort |

## 5. Auth & back-office

| # | Problème | Fichier | Symptôme |
|---|---|---|---|
| 5.1 🔴 | JWT admin 24 h stocké en **localStorage** | `frontend/src/lib/adminApi.ts:9`, `backend/src/middleware/requireAdminAuth.ts:38` | Un XSS devient un takeover admin ; aucune révocation possible |
| 5.2 🟠 | Rate-limit **en mémoire** (`MemoryStore`) | `backend/src/index.ts:72-103` | Multi-instances/PM2 dans 3 ans ⇒ limites inefficaces ; redémarrage = reset ; Map d'IP qui grossit |
| 5.3 🟠 | `TRUST_PROXY` non défini par défaut | `index.ts:45-56` | Derrière nginx/Render sans variable : **tous les clients dans le même seau** de rate-limit (risque décrit dans le commentaire du code) |
| 5.4 🔴 | Admin `GET /stats` et `GET /reservations` chargent les **tables entières** en mémoire Node puis filtrent / cherchent en JS | `backend/src/routes/admin.ts:44-60`, `admin.ts:491-530` | Latence linéaire, risque OOM, recherche non indexée |
| 5.5 🟠 | Tout gérant vérifié peut **créer/supprimer les catégories** de son marché ; `rooms.category` est TEXT sans FK | `backend/src/routes/categories.ts:31-126`, `schema.sql:45` | Un gérant supprime une catégorie utilisée par d'autres ⇒ catégories orphelines |
| 5.6 🟡 | `axios`, `jsonwebtoken`, `bcrypt` alors que Clerk + `fetch` existent déjà | `backend/package.json:22,30,31` | Surface de maintenance + CVE inutiles |

## 6. Upload & documents de vérification

| # | Problème | Fichier | Symptôme |
|---|---|---|---|
| 6.1 🟠 | Aucun quota de stockage par gérant / global | `backend/src/routes/upload.ts` | Bucket Supabase qui explose en coût (10 Mo/appel, illimité) |
| 6.2 🟡 | GIF animé écrasé en WebP fixe ; PDF stocké brut sans contrôle structurel | `upload.ts:26-31,87` | Perte de contenu, PDF volumineux acceptés |
| 6.3 🟠 | `file_url` signé (1 h) **persisté** en base à l'upload, sert de repli si la signature échoue | `gerants.ts:183`, repli `gerants.ts:233` | URL morte en cas d'échec de re-signature ⇒ documents de vérification invisibles |

## 7. Notifications & temps réel

| # | Problème | Fichier | Symptôme |
|---|---|---|---|
| 7.1 🟠 | Polling **30 s par client connecté** sur `/notifications/client` | `frontend/src/components/ClientNotificationBanner.tsx:11,34` | 1 000 connectés = ~33 req/s juste pour ça ; Supabase Realtime disponible mais non utilisé |
| 7.2 🟠 | Aucune purge/rotation : `notifications`, `client_notifications`, `newsletter_subscribers`, événements passés | `schema.sql:80-105` | Tables qui croissent sans fin, lectures de plus en plus lentes |
| 7.3 🟡 | GET gérant dédoublonne **deux sources** en mémoire (`gerant_id` + `room_id`) | `backend/src/routes/notifications.ts:60-75` | Coût croissant avec le volume |

## 8. PWA / Service Worker — dette qui arrive vite

| # | Problème | Fichier | Symptôme |
|---|---|---|---|
| 8.1 🔴 | Caches `PRECACHE` et `PAGES` **jamais tondus** : chaque build ajoute ses `/assets/*` hashés, rien n'est supprimé | `frontend/public/sw.js:144-153,120-127` | En 1-2 ans de déploiements : quota navigateur atteint ⇒ install SW qui échoue, images non mises en cache |
| 8.2 🟠 | `SW_VERSION = 'v1'` codé en dur, jamais incrémenté | `sw.js:16` | Purge des anciens caches jamais déclenchée |
| 8.3 🟠 | API en stale-while-revalidate **sans TTL** (`/api/rooms` complet inclus) | `sw.js:157-176` | Biens supprimés / soldes périmés servis indéfiniment |
| 8.4 🟡 | `PRECACHE_URLS` = liste de ~25 fichiers en dur | `sw.js:30-62` | Tout nouvel asset public ajouté manuellement = oubli quasi certain |

## 9. Frontend — performance & maintenabilité

| # | Problème | Fichier | Symptôme |
|---|---|---|---|
| 9.1 🟠 | **CSS monolithique 204 Ko** écrit à la main | `frontend/src/index.css` | Download + parse unique à chaque visite, aucune purge, croissance linéaire |
| 9.2 🟠 | Composants monolithes : `VerificationPage` 858 lignes / 36 Ko, `RoomDetailPage` 27 Ko, `ClientComptePage` 23 Ko, `AjouterChambre` 23 Ko (tests encore plus gros : 40 Ko) | `frontend/src/pages/**` | Chaque modif = risque de régression ; courbe d'apprentissage |
| 9.3 🟠 | Couches de données **dupliquées** : `lib/api.ts` vs `data/rooms.ts` vs `data/categories.ts` vs `lib/reservations.ts` (types en double) | `frontend/src/data/*` | Dérive assurée : une modification de type passe d'un côté, casse l'autre |
| 9.4 🟢 | Cache mémoire `publicCache` purgé seulement à la mutation, pas d'expiration réelle | `frontend/src/lib/api.ts:51-74` | Faible (borné), mais pas de plafond de taille |
| 9.5 🟡 | `request()` : timeout 15 s mais **aucun abort lié à la navigation** | `lib/api.ts:109-118` | Réponses arrivées après démontage → états obsolètes / race |
| 9.6 🟡 | `adminSectionRoutes` monté **2×** dans l'arbre de routes | `frontend/src/App.tsx:79-97` + `:204` | Risque de divergence (commenté aujourd'hui, mais un 3ᵉ ajout divergera) |
| 9.7 🟡 | Validation du marché en dur `ci`/`bj` à 3 endroits | `App.tsx:118`, `premium.ts:341`, CHECK SQL | Ajouter un marché = éditions multipliées, oublis garantis |

## 10. Données / migrations

| # | Problème | Fichier | Symptôme |
|---|---|---|---|
| 10.1 🔴 | **Aucun outil de migration** : `schema.sql` + `migrations.sql` + 4 fichiers `.sql` `IF NOT EXISTS` à exécuter à la main | `backend/supabase/*.sql` | Dans 5 ans : impossible de savoir quel état a quelle base ; `DROP FUNCTION` manuel (`schema.sql:351`) |
| 10.2 🟠 | Seed upsert par ids fixes | `backend/src/seed.ts:393-398` | Un `npm run seed` écrase les éditions admin |
| 10.3 🟡 | `price TEXT` + `price_num INTEGER` + `price_unit TEXT` en triple, cohérence non contrôlée | `schema.sql:12-14` | Divergence affiché / calcclé |
| 10.4 🟠 | `unitFromPriceUnit` mappe tout ce qui n'est pas `/ mois` → `nuit` | `backend/src/utils/duration.ts` | Un futur `price_unit = '/ semaine'` serait facturé **par nuit** |

## 11. CI, tests, dépendances

| # | Problème | Fichier | Symptôme |
|---|---|---|---|
| 11.1 🟠 | `npm audit --audit-level=high` en **continue-on-error** | `.github/workflows/ci.yml` | Les CVE ne bloquent jamais la CI ; silencieux pendant des années |
| 11.2 🟠 | E2E Playwright : **toutes** les routes `/api/**` interceptées, aucun backend réel | `ci.yml` | La CI ne détecte jamais une rupture d'API réelle |
| 11.3 🟡 | Couverture déclarée partielle (include restreint aux lib/data/hooks) | `frontend/vite.config.ts` (`coverage.include`) | Pages de 800 lignes hors mesure |
| 11.4 🟡 | `@types/express ^5` avec `express 4` ; TS 6.0 (front) vs 5.7 (back) | `package.json` | Incompatibilités de types silencieuses au prochain upgrade |
| 11.5 🟡 | Node 22 en CI, pas de `engines` / `.nvmrc` | `ci.yml` | Dérive local / prod |
| 11.6 🟠 | `multer 1.4.5-lts.1`, `axios 0.28`, `fedapay 1.2.5` (SDK ancien) | `backend/package.json` | Dépendances en fin de vie à horizon 3-5 ans |

---

## Plan de remediation priorisé

### P0 — bugs réels / intégrité des données
1. **Idempotence de la file offline** : clé client sur la payload + dédup côté serveur ; purge des items en échec permanent (`offlineQueue.ts`, `reservations.ts`).
2. **Contrainte de format** sur `date_debut` / `date_fin` (`CHECK ... ~ '^\d{4}-\d{2}-\d{2}$'`) + migration SQL.
3. **Expiration premium unifiée** : une fonction `isPremiumActive(row)` réutilisée partout (badges, API, admin) + correction de `GET /reservations/check` (limite ou agrégation SQL).
4. **Rate-limit partagé** (store Supabase/Redis) + vérification obligatoire de `TRUST_PROXY` en prod.

### P1 — performance (bloquant dès la croissance)
5. **Pagination + filtres côté serveur** (ville, quartier, catégorie, prix, dates) sur `/api/rooms` ; supprimer `fetchRoomsByMarket` de `RoomDetailPage` / `CategoryPage`.
6. **Index composites dates** + introduction d'un outil de migration (migration versionnée unique, remplacer les `.sql` manuels).
7. **`/admin/stats` et `/admin/reservations`** : agrégats SQL + pagination, plus de chargement de table entière en mémoire.
8. **Supabase Realtime** à la place du polling 30 s ; rotation/purge des notifications et vieilles tables.

### P2 — dette de maintenance
9. **Tondre les caches SW** : `SW_VERSION` auto (hash de build) + `trimCache` sur `PRECACHE` / `PAGES`.
10. **Scinder `index.css`** + purge ; découper `VerificationPage` et `RoomDetailPage`.
11. **Fusionner `data/*` dans `lib/api.ts`** : un seul jeu de types.
12. `npm audit` bloquant, quotas d'upload, archivage des tables vieillissantes.

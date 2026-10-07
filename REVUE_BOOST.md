# Revue de bugs — fonctionnalité Boost (commit `a3e5e50`)

- **Date** : 6 octobre 2026
- **Périmètre** : commit `a3e5e50` (backend Boost, pages gérant/admin, LandingBoosts, e2e)
- **Méthode** : revue de code indépendante (code-reviewer), focus logique métier, sécurité, concurrence, front
- **Verdict global** : **BLOQUER** — 1 critique, 5 majeurs, 11 mineurs. Base saine (montants serveur, webhook idempotent, pas d'injection, auth correcte) mais cas adverses non couverts par les tests.

---

## ✅ État des corrections (mise à jour du 7 octobre 2026)

Tous les défauts relevés sont corrigés.

| # | Statut | Correction |
|---|---|---|
| C1 | ✅ | Identité visiteur signée : cookie HttpOnly `ilehya_bt` (`visitorId.hmac`, secret `BOOST_TRACK_SECRET`), corps `visitor_id` ignoré côté serveur ; sans cookie valide → 200 `counted:false` + `visitor_issued:true`, aucun crédit ; limiters dédiés IP (40/15 min) et par `boost_id` (150/15 min) ; relance unique côté client (`api.ts`). |
| M1 | ✅ | Statut `ended` (migration `0014`, backfill, expiration paresseuse dans `charge_boost`), `deriveBoostDisplayStatus` branche `ended` avant les dates, filtre admin `ended`, 409 sur `ended` en PATCH admin. |
| M2 | ✅ | Contrôle préalable `pending/active` sur le même `room_id` avant l'`UPDATE` → 409 explicite (catch `23505` en secours sur `schedule`). |
| M3 | ✅ | Rattrapage en arrière-plan (`reconcileInBackground` anti-chevauchement), purge des pendings > 24 h, `withFedapayTimeout(..., 2000)` sur FedaPay. |
| M4 | ✅ | `flagPaidWithoutCampaign()` (`utils/boostAlerts.ts`, id déterministe `boost-paid-<tx>` → idempotent) appelé du webhook, de `/confirm` et du rattrapage ; nouvelle valeur `boost_paid_without_campaign` dans le CHECK `notifications` (0014) ; affichée admin (`SuperAdminLayout`) et gérant (`AdminLayout`) ; `BoostSuccessPage` affiche « contactez le support » sur 409. |
| M5 | ✅ | Classification par `ApiError.status` + détail (`pending`/`declined`/`canceled`) ; retry ≤ 3 sur `pending` uniquement ; `declined`/`canceled` en erreur immédiate ; 409 = support. |
| m1 | ✅ | `openSchedule` clamp `startDay = max(origine, aujourd'hui)` et `endDay = max(origine, startDay)`. |
| m2 | ✅ | Fallback `boostVisitorId()` mémorisé en variable module (`memoFallbackId`). |
| m3 | ✅ | `getCallbackUrl(market)` basé sur `APP_PUBLIC_URL` (allow-list), `req.headers.origin` supprimé. |
| m4 | ✅ | Compteurs (`events_count`/`clicks_count`/`impressions_count`) n'incrémentent que si `v_charge > 0` (0014). |
| m5 | ✅ | `NO_CACHE_PURGE_PATHS` : `/boosts/impression` et `/boosts/click` n'invalident plus le cache public. |
| m6 | ✅ | Webhook : `BOOST_BUDGETS.includes(amount)` exigé avant `activateBoostForTransaction` pour `type='boost'`. |
| m7 | ✅ | `upsertPremiumTransaction({ onlyIfPending: true })` : pas de régression de statut sur rejeu `declined`/`canceled`. |
| m8 | ✅ | Purge des pendings > 24 h (`canceled`) en tête du rattrapage ; plus de `limit 3` bloquant. |
| m9 | ✅ | `adminBoostsQuerySchema` sans `.strict()`, enums élargies (`ended`). |
| m10 | ✅ | Court-circuit sans `FOR UPDATE` quand `p_amount = 0` (0014). |
| m11 | ✅ | `boostEndIso` = `T23:59:59` (début `T12:00:00`), durée max `(90 + 0.5)` jours côté serveur : la fenêtre D → D+90 reste valide, une campagne d'une même journée aussi. |

**Tests / vérifications** : backend `npm test` 1064/1064, `npm run lint`, `npm run typecheck`, `npm run migrate:check` (14 fichiers, 0 en attente) ; frontend `npm test` 1452/1452, `npm run lint`, `npx tsc -b` (pas de script `typecheck`). Nouveaux tests : tracking C1, `/confirm` 409 + alerte M4, webhook M4/m6/m7, notifications admin fusionnées, PATCH admin M1/M2. `npm run test:boosts` exécuté contre la base réelle : **20/20** (transaction rollback), avant et après application de `0014_boost_lifecycle.sql` (`npm run migrate -- --yes`), vérifiée après coup : CHECK `boosts_status_check` avec `ended`, CHECK `notifications_type_check` avec `boost_paid_without_campaign`, 0 campagne `active` expirée, `charge_boost` remplacée.

---

## 🔴 CRITIQUE

### C1. N'importe qui peut vider (ou saborder) le budget prépayé d'une campagne
**Fichiers** : `backend/src/routes/boosts.ts:205-262` (`handleCharge`), `backend/supabase/migrations/0013_boosts.sql:182,219-227`, `backend/src/index.ts:91-97,165`

`POST /api/boosts/click` et `/impression` sont publics (pas d'auth), et la **déduplication repose uniquement sur `visitor_id`, une chaîne fournie par le client** (min 8, max 64, aucun format, aucune signature, aucun lien avec IP/session). Le SQL ne fait que `length(p_visitor_id) < 8`.

**Conséquences en production** :
- `boost_id` est exposé publiquement par `GET /api/boosts/featured` → un script de ~100 requêtes avec `visitor_id` aléatoires à chaque fois **épuise une campagne à 5 000 F** (100 clics × 50 F).
- Seule barrière : le `writeLimiter` global (200 POST / 15 min / IP, `index.ts:91-97`) → **largement suffisant pour tuer n'importe quelle campagne depuis une seule IP**, multipliable avec un botnet.
- Sabotage concurrent : vider le budget d'un concurrent arrête son affichage (statut `exhausted` posé par la RPC).
- Chaque appel prend le verrou `FOR UPDATE` sur la ligne `boosts` → rafale = contention du pool de connexions Supabase (DoS latéral).

```ts
// boosts.ts:205 — aucun contrôle d'habilitation ni de volumétrie par visitor/IP
const { boost_id, visitor_id } = parsedBody.data;
// … le dédup serveur ne vaut que si visitor_id est difficile à falsifier
```

**Fix** :
1. Lier `visitor_id` à un secret serveur : émettre un jeton signé (HMAC `boost_id + visitor_id + jour`) depuis `/featured`, et le renvoyer dans `impression`/`click`, la RPC validant la signature.
2. Ajouter un rate-limiter dédié (`/api/boosts/click`, `/impression`) : ex. 20 req/15 min/IP **et** plafond global par `boost_id`.
3. Option défensive : ignorer les événements dont `visitor_id` n'a pas été émis par le serveur (cookie `HttpOnly` signé plutôt que `localStorage` lisible/modifiable).

---

## 🟠 MAJEURS

### M1. Une campagne terminée reste `status = 'active'` → la chambre ne peut plus jamais être boostée
**Fichiers** : `backend/src/routes/boosts.ts:318`, `backend/supabase/migrations/0013_boosts.sql:200`, `backend/src/utils/boostDisplay.ts:59`

Aucun code ne fait sortir une campagne de `active` quand `ends_at` est passé (la seule transition automatique est `→ exhausted` dans `charge_boost`, l.233). `initiate` fait :

```ts
// boosts.ts:318
if (live.some((row) => row.status === 'active')) {
  return res.status(400).json({ error: 'Une campagne est déjà en cours pour cette chambre.' });
}
```

Conséquences : campagne finie (`display_status = 'ended'` mais `status = 'active'`) →
- le gérant **ne peut plus créer AUCUNE campagne payée** pour cette chambre (400 permanent), seul contournement : « Modifier les dates » sur l'ancienne campagne ;
- le filtre admin `status=active` affiche des campagnes terminées comme « Actives » (`admin.ts:683`).

**Fix** : soit transition `active → ended` dans `charge_boost` quand `v_now > v_ends` (+ statut au CHECK + index partiel), soit dans `initiate` : ne bloquer que si `status='active' AND ends_at > now()`.

### M2. Reprise admin `paused → active` : violation d'index unique → HTTP 500
**Fichiers** : `backend/src/routes/admin.ts:724-766`, `backend/supabase/migrations/0013_boosts.sql:77`

`uq_boosts_room_live` couvre `WHERE status IN ('pending','active')` — **pas `paused`**. Enchaînement :
1. Admin suspend la campagne A d'une chambre ;
2. `initiate` (`.in('status',['pending','active'])`, `boosts.ts:315`) ne voit plus A → le gérant crée et paie la campagne B sur la même chambre ;
3. Admin clique « Reprendre » sur A → `UPDATE … SET status='active'` → **23505** → `next(err)` → **500**, message « Mise à jour impossible. » sans explication, reprise impossible tant que B existe.

**Fix** : avant l'`update`, vérifier l'absence d'une autre ligne `pending/active` sur le même `room_id` et répondre 409 explicite ; ou inclure `paused` dans l'index partiel (et interdire alors toute création tant qu'une campagne en pause existe).

### M3. `GET /api/boosts/mine` peut rester bloqué jusqu'à 45 s → la liste des campagnes ne se charge plus
**Fichiers** : `backend/src/routes/boosts.ts:88-134,527`, `backend/src/config/fedapayHttp.ts:3` (`FEDAPAY_TIMEOUT_MS = 15000`), `frontend/src/lib/api.ts:7` (`REQUEST_TIMEOUT_MS = 15_000`)

```ts
// boosts.ts:527 — exécuté AVANT la requête de liste, à chaque visit
await reconcilePendingBoosts(authUserId);
```

La boucle `for … await` (l.100) fait **jusqu'à 3 appels FedaPay séquentiels de 15 s chacun** en cas de dégradation de FedaPay. Le front abandonne à 15 s → message « Impossible de charger vos campagnes. » **tant que FedaPay répond lentement** ; un gérant avec 3 pendings abandonnés est bloqué en permanence. Même en nominal, 3 appels réseau ajoutent ~1 s à chaque chargement.

**Fix** : exécuter `reconcilePendingBoosts` en arrière-plan (`void … .catch()`), réduire le timeout du rattrapage (ex. 2 s), borner à 1 appel et ne reconciler que les pendings de moins de 24 h.

### M4. Paiement encaissé alors que la campagne n'existe plus : aucun crédit, aucun remboursement, juste un `console.warn`
**Fichiers** : `backend/src/routes/boosts.ts:311-338`, `backend/src/routes/premium.ts:326-340`, `backend/supabase/migrations/0013_boosts.sql:142`

`activate_boost_checked` lève `BOOST_NOT_FOUND` (rollback du claim) si aucune ligne `boosts` en `pending` pour cette transaction. Cas atteignables :
- **supersede** : tentative > 10 min (`BOOST_PENDING_SUPERSEDE_MS`) annulée par une nouvelle initiation, puis paiement terminé sur l'onglet restant ouvert → webhook `approved` → `premium.ts:339` : `console.warn` → **argent encaissé, campagne annulée, ni remboursement ni alerte support** ; l'écran Succès affiche 409 « Cette tentative de paiement n'est plus valable » sans mention du paiement ;
- **suppression de la chambre** pendant le paiement (`rooms(id) ON DELETE CASCADE`) → même issue, et comme `activated_at` est annulé, **chaque retry FedaPay repasse par le même échec**.

**Fix** : persister un état `paid_without_campaign` dans `premium_transactions` (ou table d'incidents), alerter (notification admin), ne jamais annuler un `pending` de moins de X minutes tant que la transaction est `pending` côté FedaPay ; afficher sur `BoostSuccessPage` un message « paiement reçu, contactez le support » quand la réponse vaut 409.

### M5. Un paiement refusé est traité comme « en attente » par la page de succès
**Fichier** : `frontend/src/pages/gerant/BoostSuccessPage.tsx:12,57,65`

```ts
const PENDING_RE = /en attente|pending|non confirm|pas pay|declined|canceled/i;
if (PENDING_RE.test(raw) && attempt < MAX_AUTO_RETRIES) { … 3 s … }
```

Le serveur renvoie `error: 'Paiement declined'` / `'Paiement canceled'` (`boosts.ts:485`) → le regex matche → **3 relances automatiques** puis message : « Le paiement n'a pas encore été confirmé. Si vous venez de payer, réessayez dans quelques secondes. » Le gérant croit son paiement susceptible de passer et peut retenter un paiement.

**Fix** : distinguer par le statut HTTP / champ `status` renvoyé (`ApiError.status` + détail) plutôt que par un regex sur le texte ; ne retry que sur `pending`.

---

## 🟡 MINEURS

| # | Fichier:ligne | Défaut | Correction |
|---|---|---|---|
| m1 | `frontend/src/pages/gerant/BoostsPage.tsx:52-56` + `lib/boosts.ts:47-56` | `openSchedule` pré-remplit `starts_at` = date d'origine (souvent passée) → `validateBoostWindow` rejette « La date de début ne peut pas être dans le passé » : impossible de prolonger simplement la fin d'une campagne en ligne. | Pré-remplir `startDay = max(isoDay(starts_at), isoDay(today))`, ou autoriser côté serveur un `starts_at` passé quand la campagne est déjà `active`. |
| m2 | `frontend/src/components/LandingBoosts.tsx:11-25` | `localStorage` bloqué → chaque appel à `boostVisitorId()` génère un **nouvel identifiant** → dédup 24 h/10 min inopérante → visiteur facturé plusieurs fois (sur-facturation). | Mémoriser le fallback dans une variable module (`let memoId`). |
| m3 | `backend/src/routes/boosts.ts:52-58` | `callback_url` FedaPay construite depuis `req.headers.origin` non validé → `Origin: https://evil.tld` redirige le payeur **après paiement** vers un domaine tiers (phishing post-paiement). Même motif que le premium. | N'utiliser que `APP_PUBLIC_URL` (allow-list), ignorer `Origin`. |
| m4 | `backend/supabase/migrations/0013_boosts.sql:243-244` | `clicks_count`/`impressions_count` incrémentés **y compris quand `v_charge = 0`** (dédup) → compteurs bruts ≠ événements facturés. | Documenter « clics bruts », ou n'incrémenter que si `v_charge > 0`. |
| m5 | `frontend/src/lib/api.ts:143` | Tout POST invalide `clearApiCache()` → les 6 impressions de la landing purgent 6× le cache public (bannières, salles, avis). | Exclure `/boosts/impression` et `/boosts/click` de la purge. |
| m6 | `backend/src/routes/premium.ts:326-333` | Le webhook ne vérifie **pas le montant** pour `type='boost'` (le premium si). Pas exploitable sans la clé secrète FedaPay, mais aucune défense en profondeur. | Ajouter `BOOST_BUDGETS.includes(amount)` avant `activateBoostForTransaction`. |
| m7 | `backend/src/routes/premium.ts:369-380` | Un rejeu tardif de `transaction.declined` **après** un `approved` rétrograde le statut du ledger → audit incohérent. | Ne rétrograder que si la ligne est `pending` (upsert conditionnel). |
| m8 | `backend/src/routes/boosts.ts:96-100` | `reconcilePendingBoosts` ne traite que les **3 pendings les plus récentes** (`order desc, limit 3`) → les plus anciennes restent « Paiement en attente » indéfiniment. | Traiter les plus anciennes d'abord, ou purger celles > 24 h en `canceled`. |
| m9 | `backend/src/routes/admin.ts:681-685` | `adminBoostsQuerySchema.strict()` → n'importe quel paramètre inconnu dans l'URL (`?utm=…`) renvoie 400. | Retirer `.strict()` ou filtrer les clés connues. |
| m10 | `backend/supabase/migrations/0013_boosts.sql:200-207` | Événements à montant 0 (impression CPC, clic CPI) prennent quand même le verrou `FOR UPDATE` → sérialisation inutile sur la landing en rafale. | Court-circuiter avant le `FOR UPDATE` si `p_amount = 0` n'est pas facturable. |
| m11 | `frontend/src/pages/gerant/BoostCreatePage.tsx:70-73`, `lib/boosts.ts:47-48` | Fin de campagne à **midi** heure locale du dernier jour (`${day}T12:00:00`) → demi-journée non livrée pour un budget pleinement payé. | Décision produit : afficher « jusqu'au midi du 5 nov. », ou passer à `T23:59:59` (vérifier cohérence avec la tolérance 12 h serveur). |

---

## ✅ Zones contrôlées — aucun défaut trouvé

- **Montants** : 100 % serveur. `budget_total` validé par `z.union([z.literal(...)])` (`validations/boost.ts:53`), montant facturé calculé par `boostChargeAmount()` depuis `mode` relu en base (`boosts.ts:231`) — aucun montant accepté du client.
- **Webhook / idempotence** : rejeu FedaPay sans double crédit (claim `activated_at NULL → now()` dans `activate_boost_checked` + `upsert` `onConflict: fedapay_transaction_id`) ; webhook et `/confirm` arbitrés par la RPC ; `BOOST_NOT_FOUND` annule le claim (rollback complet). Signature webhook vérifiée, erreurs → 500 pour forcer le retry FedaPay.
- **Injection SQL** : uniquement le client Supabase (requêtes paramétrées) et des RPC à paramètres typés ; `BOOST_ROOM_EMBED` est une constante, aucun concat avec de l'utilisateur. RLS activée sur `boosts`/`boost_dedup`, service role uniquement.
- **Auth/autorisations** : `/initiate`, `/confirm`, `/mine`, `/:id/schedule` derrière `requireClerkAuth` + vérification `gerant_id`/`room.gerant_id`/`meta.clerk_user_id` ; routes admin derrière `requireAdminAuth` ; `is_verified` exigé ; corps admin borné par enums zod.
- **Concurrence charge** : `FOR UPDATE` + fenêtre + vérif budget dans une seule transaction SQL → dépassement de budget et double comptage impossibles ; dédup 24 h/10 min correctement appliquée aux événements facturables.
- **Front — fuites/crashes** : `IntersectionObserver.disconnect()` nettoyé, `setTimeout` de retry clearé au démontage, drapeaux `alive`/`cancelled` présents, `Array.isArray(...)` et `?? []` sur toutes les réponses → pas de crash sur payload anormal ; boucle de retry 3 s bornée (4 appels max).
- **Incohérences front/back** : enums (`cpc`/`cpi`, statuts bruts, 7 `display_status`), champs (`remaining`, `display_status`, `gerant`) et formats (ISO API, `YYYY-MM-DD` inputs, FR affichage) cohérents des deux côtés.

---

## 🔁 Revue indépendante post-correction (7 octobre 2026)

Une seconde revue (code-reviewer, non impliqué dans les correctifs) a relu les 24 fichiers modifiés + les nouveaux. **4 défauts résiduels trouvés, tous corrigés :**

| Défaut | Correction |
|---|---|
| C1 pas totalement clos : le serveur émettait une identité signée à chaque requête sans cookie → 2 requêtes par événement facturé → 40 req/15 min = 20 clics = **un budget d'entrée de 1 000 F vidé par une seule IP**. | `boostIssueLimiter` (10 nouvelles identités / 15 min / IP, `skip` si cookie valide) monté sur `/featured`, `/impression` et `/click` — `index.ts`. Test : 11e requête → 429 (`index.test.ts`). |
| `APP_PUBLIC_URL` non obligatoire : depuis m3, le callback FedaPay pointe sur localhost si la variable manque → paiement jamais confirmé côté gérant. | Fail-fast en production (identique à `ALLOWED_ORIGINS`), `.env.example` passé en OBLIGATOIRE + `BOOST_TRACK_SECRET` documenté. Test : import en production sans la variable → `exit(1)`. |
| m6 appliqué dans 1 chemin sur 3 : ni le rattrapage ni les branches de refus (webhook, `/confirm`) n'alertaient → argent encaissé, support non prévenu. | Contrôle `BOOST_BUDGETS` + `flagPaidWithoutCampaign` ajoutés au rattrapage (`source: 'reconcile-amount'`), à `/confirm` (`'confirm-amount'`, uniquement si `approved`) et au refus webhook (`'webhook-amount'`). Tests dans les 3 routeurs. |
| PATCH admin `/boosts/:id/status` : course check-then-update → `23505` → 500 muet (le catch existait déjà sur `/:id/schedule`). | `23505` → 409 explicite, même message que le contrôle. Test dédié. |

**Points opérationnels restants (configuration, pas de code)** : `TRUST_PROXY=1` obligatoire derrière un proxy (sinon tous les clients partagent le même seau de rate limiting → sous-facturation), `BOOST_TRACK_SECRET` recommandé (clé dédiée, distincte d'`ADMIN_JWT_SECRET`), `APP_PUBLIC_URL` à vérifier avant tout redéploiement (le serveur refuse désormais de démarrer sans elle en production).

---

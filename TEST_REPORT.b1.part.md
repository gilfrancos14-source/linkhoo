# TEST_REPORT B1 — Middlewares + Validations backend

**Projet** : `C:\Dossier personelle\Projet-it\ilehya_location\ilehya-react` (backend Express + Supabase + Vitest 5)
**Baseline** : 24 fichiers / 500 tests verts → **après B1 : 33 fichiers / 672 tests verts** (**+9 fichiers, +172 tests, 0 échec**)
**Vérifications** : `npx vitest run src/middleware src/validations` → 19 fichiers / 325 tests PASS · suite complète `npx vitest run` → 33 fichiers / 672 tests PASS · `npm run lint` (oxlint --deny-warnings) → exit 0 · `npm run typecheck` → exit 0

## Tests ajoutés

### `backend/src/middleware/clerkAuth.ts`
- `backend/src/middleware/clerkAuth.test.ts` : 18 tests — [PASS] **requireClerkAuth › 401 sans en-tête Authorization** — header absent → 401 "Token d'authentification manquant"
- `backend/src/middleware/clerkAuth.test.ts` : [PASS] **requireClerkAuth › 401 pour un schéma d'authentification autre que Bearer** — `Basic …` → 401 manquant
- `backend/src/middleware/clerkAuth.test.ts` : [PASS] **requireClerkAuth › 401 quand verifyToken rejette le jeton** — échec Clerk → 401 "Token d'authentification invalide"
- `backend/src/middleware/clerkAuth.test.ts` : [PASS] **requireClerkAuth › 401 : n'exécute pas le handler suivant quand le jeton échoue** — `next()` non appelé (body sans `auth`)
- `backend/src/middleware/clerkAuth.test.ts` : [PASS] **requireClerkAuth › 200 : pose req.auth (userId, sessionId, sessionClaims) et appelle next()** — payload Clerk transmis sur `req.auth`
- `backend/src/middleware/clerkAuth.test.ts` : [PASS] **requireClerkAuth › appelle verifyToken avec le jeton nu, clockSkewInMs=60000 et la clé secrète** — `Bearer ` stripé + tolérance d'horloge
- `backend/src/middleware/clerkAuth.test.ts` : [PASS] **requireClerkAuth › gère un userId Clerk avec caractères spéciaux** — `user_&?#1` intact
- `backend/src/middleware/clerkAuth.test.ts` : [PASS] **requireClerkOrAdminAuth › 401 sans en-tête Authorization** — aucun jeton → 401 manquant
- `backend/src/middleware/clerkAuth.test.ts` : [PASS] **requireClerkOrAdminAuth › 200 via Clerk : pose req.auth, pas req.admin** — chemin Clerk prioritaire
- `backend/src/middleware/clerkAuth.test.ts` : [PASS] **requireClerkOrAdminAuth › 200 via JWT admin quand Clerk refuse le jeton** — repli JWT admin → `req.admin` rempli
- `backend/src/middleware/clerkAuth.test.ts` : [PASS] **requireClerkOrAdminAuth › 401 quand ni Clerk ni l'admin ne reconnaissent le jeton** — 401 "Token invalide ou expiré"
- `backend/src/middleware/clerkAuth.test.ts` : [PASS] **requireClerkOrAdminAuth › appelle verifyToken avant de retomber sur le JWT admin** — tentative Clerk unique puis fallback
- `backend/src/middleware/clerkAuth.test.ts` : [PASS] **requireAdminOrGerant › 401 sans aucun jeton posé (ni admin, ni auth)** — branche 401 du middleware seul
- `backend/src/middleware/clerkAuth.test.ts` : [PASS] **requireAdminOrGerant › 200 pour l'admin JWT sans requête Supabase** — court-circuit `req.admin` (aucun appel `from`)
- `backend/src/middleware/clerkAuth.test.ts` : [PASS] **requireAdminOrGerant › 200 pour un compte gérant existant** — ligne `gerants` présente → `next()`
- `backend/src/middleware/clerkAuth.test.ts` : [PASS] **requireAdminOrGerant › interroge gerants sur clerk_user_id** — `select('id')` + `eq('clerk_user_id', …)`
- `backend/src/middleware/clerkAuth.test.ts` : [PASS] **requireAdminOrGerant › 403 pour un compte non gérant (client connecté)** — 403 "Accès réservé aux comptes gérant"
- `backend/src/middleware/clerkAuth.test.ts` : [PASS] **requireAdminOrGerant › 500 quand la requête Supabase échoue (erreur remontée à errorHandler)** — `next(err)` → 500 interne

### `backend/src/middleware/errorHandler.ts`
- `backend/src/middleware/errorHandler.test.ts` : 18 tests — [PASS] **errorHandler › consigne l'erreur via console.error** — journalisation du message
- `backend/src/middleware/errorHandler.test.ts` : [PASS] **errorHandler › consigne la valeur brute quand ce n'est pas une Error** — objet non Error journalisé tel quel
- `backend/src/middleware/errorHandler.test.ts` : [PASS] **errorHandler › statut issu de `status` › 404 : renvoie le message de l'erreur** — `status: 404` + `err.message`
- `backend/src/middleware/errorHandler.test.ts` : [PASS] **errorHandler › statut issu de `status` › 400 : garde la limite basse des codes métier** — borne 400 acceptée
- `backend/src/middleware/errorHandler.test.ts` : [PASS] **errorHandler › statut issu de `status` › 599 : garde la limite haute des codes métier** — borne 599 acceptée
- `backend/src/middleware/errorHandler.test.ts` : [PASS] **errorHandler › statut issu de `status` › 500 : masque le message derrière l'erreur interne** — jamais de fuite sur 500
- `backend/src/middleware/errorHandler.test.ts` : [PASS] **errorHandler › statut issu de `statusCode` › 401 : utilise statusCode quand `status` est absent** — repli sur `statusCode`
- `backend/src/middleware/errorHandler.test.ts` : [PASS] **errorHandler › statut issu de `statusCode` › 401 : utilise statusCode quand `status` est undefined** — `status: undefined` ignoré
- `backend/src/middleware/errorHandler.test.ts` : [PASS] **errorHandler › statut issu de `statusCode` › préfère `status` (même invalide) à `statusCode`** — `status: 300` écrase `statusCode: 403` → 500
- `backend/src/middleware/errorHandler.test.ts` : [PASS] **errorHandler › valeurs de statut invalides → 500 › status hors bornes (300)** — repli 500
- `backend/src/middleware/errorHandler.test.ts` : [PASS] **errorHandler › valeurs de statut invalides → 500 › status hors bornes (600)** — repli 500
- `backend/src/middleware/errorHandler.test.ts` : [PASS] **errorHandler › valeurs de statut invalides → 500 › status non numérique (chaîne)** — `'404'` rejeté → 500
- `backend/src/middleware/errorHandler.test.ts` : [PASS] **errorHandler › valeurs de statut invalides → 500 › statut valide mais erreur non Error → « Requête invalide »** — 400 sans message interne
- `backend/src/middleware/errorHandler.test.ts` : [PASS] **errorHandler › valeurs de statut invalides → 500 › erreur sans statut → 500 interne** — `Error` nue
- `backend/src/middleware/errorHandler.test.ts` : [PASS] **errorHandler › valeurs de statut invalides → 500 › valeur null → 500 interne** — entrée `null`
- `backend/src/middleware/errorHandler.test.ts` : [PASS] **errorHandler › valeurs de statut invalides → 500 › valeur undefined → 500 interne** — entrée `undefined`
- `backend/src/middleware/errorHandler.test.ts` : [PASS] **errorHandler › valeurs de statut invalides → 500 › chaîne vide → 500 interne** — entrée `''`
- `backend/src/middleware/errorHandler.test.ts` : [PASS] **errorHandler › n'invoque jamais next (fin de chaîne)** — `next` non appelé (0 appel)

### `backend/src/middleware/requireAdminAuth.ts`
- `backend/src/middleware/requireAdminAuth.test.ts` : 15 tests — [PASS] **requireAdminAuth › 401 sans en-tête Authorization** — message "Token d'authentification manquant"
- `backend/src/middleware/requireAdminAuth.test.ts` : [PASS] **requireAdminAuth › 401 pour un schéma d'authentification autre que Bearer** — `Basic …` → 401 manquant
- `backend/src/middleware/requireAdminAuth.test.ts` : [PASS] **requireAdminAuth › 401 pour « bearer » en minuscules (casse sensible)** — comparaison sensible à la casse
- `backend/src/middleware/requireAdminAuth.test.ts` : [PASS] **requireAdminAuth › 401 pour « Bearer » sans espace final (en-tête non reconnu)** — hors préfixe `Bearer `
- `backend/src/middleware/requireAdminAuth.test.ts` : [PASS] **requireAdminAuth › 401 pour « Bearer » suivi d'espaces seuls (en-tête normalisé, jeton inexistant)** — normalisation Node de l'en-tête
- `backend/src/middleware/requireAdminAuth.test.ts` : [PASS] **requireAdminAuth › 401 pour un jeton blanc après « Bearer » (token non signé)** — `jwt.verify` échoue → "Token invalide ou expiré"
- `backend/src/middleware/requireAdminAuth.test.ts` : [PASS] **requireAdminAuth › 401 pour un jeton malformé** — chaîne non JWT
- `backend/src/middleware/requireAdminAuth.test.ts` : [PASS] **requireAdminAuth › 401 pour un jeton signé avec un autre secret** — signature falsifiée rejetée
- `backend/src/middleware/requireAdminAuth.test.ts` : [PASS] **requireAdminAuth › 401 pour un jeton expiré** — `expiresIn: '-1h'` → 401
- `backend/src/middleware/requireAdminAuth.test.ts` : [PASS] **requireAdminAuth › ne vérifie que la signature : un JWT HS256 du secret admin passe sans claims admin** — documente l'absence de contrôle des claims
- `backend/src/middleware/requireAdminAuth.test.ts` : [PASS] **requireAdminAuth › 200 : pose req.admin et appelle next()** — `adminId`/`email` + `exp`/`iat` présents
- `backend/src/middleware/requireAdminAuth.test.ts` : [PASS] **requireAdminAuth › 401 : n'exécute pas le handler suivant quand le jeton est refusé** — route suivante non atteinte
- `backend/src/middleware/requireAdminAuth.test.ts` : [PASS] **signAdminToken › produit un jeton accepté par requireAdminAuth (aller-retour)** — round-trip sign/verify
- `backend/src/middleware/requireAdminAuth.test.ts` : [PASS] **signAdminToken › signe avec une expiration de 24h** — `exp - iat = 86400`
- `backend/src/middleware/requireAdminAuth.test.ts` : [PASS] **signAdminToken › est rejeté quand le secret change après signature** — liaison au secret courant

### `backend/src/middleware/requireGerantMarket.ts`
- `backend/src/middleware/requireGerantMarket.test.ts` : 11 tests — [PASS] **requireGerantMarket — absence d'authentification › 401 sans req.auth et n'interroge pas Supabase** — 401 + aucun appel `from`
- `backend/src/middleware/requireGerantMarket.test.ts` : [PASS] **requireGerantMarket — absence d'authentification › 401 sans req.auth même avec requireVerified: false** — l'option ne contourne pas l'auth
- `backend/src/middleware/requireGerantMarket.test.ts` : [PASS] **requireGerantMarket — refus (403) › 403 si le compte n'est pas gérant (aucune ligne)** — message "Seuls les gérants vérifiés…"
- `backend/src/middleware/requireGerantMarket.test.ts` : [PASS] **requireGerantMarket — refus (403) › 403 si la requête Supabase échoue** — `error` truthy → 403 (pas 500)
- `backend/src/middleware/requireGerantMarket.test.ts` : [PASS] **requireGerantMarket — refus (403) › 403 si le gérant n'est pas vérifié (comportement par défaut)** — `requireVerified` défaut = true
- `backend/src/middleware/requireGerantMarket.test.ts` : [PASS] **requireGerantMarket — refus (403) › 403 si is_verified est absent (falsy)** — colonne manquante refusée
- `backend/src/middleware/requireGerantMarket.test.ts` : [PASS] **requireGerantMarket — succès › 200 : renvoie market et userId pour un gérant vérifié** — forme `{ market, userId }`
- `backend/src/middleware/requireGerantMarket.test.ts` : [PASS] **requireGerantMarket — succès › 200 : renvoie le marché BJ** — second marché accepté
- `backend/src/middleware/requireGerantMarket.test.ts` : [PASS] **requireGerantMarket — succès › 200 avec requireVerified: false pour un gérant non vérifié** — option contournement vérification
- `backend/src/middleware/requireGerantMarket.test.ts` : [PASS] **requireGerantMarket — succès › requête la table gerants sur clerk_user_id avec les colonnes attendues** — `select('market, is_verified')` + `eq` + `maybeSingle`
- `backend/src/middleware/requireGerantMarket.test.ts` : [PASS] **requireGerantMarket — succès › 200 : distingue un userId contenant des caractères spéciaux** — identifiant non alphanumérique

### `backend/src/middleware/requireProfile.ts`
- `backend/src/middleware/requireProfile.test.ts` : 10 tests — [PASS] **requireProfile — absence d'authentification › 401 sans req.auth (rôle client) et n'interroge pas Supabase** — 401 "Non autorisé" sans appel DB
- `backend/src/middleware/requireProfile.test.ts` : [PASS] **requireProfile — absence d'authentification › 401 sans req.auth (rôle gérant)** — idem côté gérant
- `backend/src/middleware/requireProfile.test.ts` : [PASS] **requireProfile — absence d'authentification › n'appelle pas le handler suivant quand l'auth manque** — `next()` non invoqué
- `backend/src/middleware/requireProfile.test.ts` : [PASS] **requireProfile — rôle client › 200 et appelle next() si la ligne clients existe** — accès autorisé
- `backend/src/middleware/requireProfile.test.ts` : [PASS] **requireProfile — rôle client › interroge clients sur clerk_user_id** — `select('id')` + `eq` + `maybeSingle`
- `backend/src/middleware/requireProfile.test.ts` : [PASS] **requireProfile — rôle client › 403 avec le détail role quand le compte client n'existe pas** — corps `{ error, role: 'client' }`
- `backend/src/middleware/requireProfile.test.ts` : [PASS] **requireProfile — rôle client › 500 quand la requête Supabase échoue (erreur remontée)** — `throw error` → errorHandler
- `backend/src/middleware/requireProfile.test.ts` : [PASS] **requireProfile — rôle gérant › 200 et appelle next() si la ligne gerants existe** — accès autorisé
- `backend/src/middleware/requireProfile.test.ts` : [PASS] **requireProfile — rôle gérant › 403 avec le détail role pour un compte gérant absent** — corps `{ error, role: 'gerant' }`
- `backend/src/middleware/requireProfile.test.ts` : [PASS] **requireProfile — rôle gérant › cible la bonne table selon le rôle demandé** — ordre `['clients', 'gerants']`

### `backend/src/validations/auth.ts`
- `backend/src/validations/auth.test.ts` : 19 tests — [PASS] **roleSchema › accepte les deux rôles métier** — `client` / `gerant`
- `backend/src/validations/auth.test.ts` : [PASS] **roleSchema › refuse tout autre rôle** — `admin`, casse mixte, chaînes vides…
- `backend/src/validations/auth.test.ts` : [PASS] **roleSchema › refuse les valeurs non chaînes** — nombre, null, tableau, objet
- `backend/src/validations/auth.test.ts` : [PASS] **roleSchema › détaille le code d'erreur de l'énumération** — `invalid_value`, path `[]`
- `backend/src/validations/auth.test.ts` : [PASS] **roleSchema › n'accepte pas la casse mixte** — `cLienT` refusé
- `backend/src/validations/auth.test.ts` : [PASS] **bootstrapSchema › accepte un bootstrap client sans marché** — marché facultatif
- `backend/src/validations/auth.test.ts` : [PASS] **bootstrapSchema › accepte un bootstrap client avec marché (marché ignoré par la route mais valide)** — conservé dans `data`
- `backend/src/validations/auth.test.ts` : [PASS] **bootstrapSchema › accepte un bootstrap gérant avec marché** — happy path gérant
- `backend/src/validations/auth.test.ts` : [PASS] **bootstrapSchema › accepte un bootstrap gérant sans marché (contrainte portée par la route)** — pas de raffinement inter-schémas
- `backend/src/validations/auth.test.ts` : [PASS] **bootstrapSchema › exige le champ role** — path `['role']`
- `backend/src/validations/auth.test.ts` : [PASS] **bootstrapSchema › refuse un rôle invalide avec le path du champ** — path `['role']`
- `backend/src/validations/auth.test.ts` : [PASS] **bootstrapSchema › refuse un marché hors CI/BJ** — path `['market']`
- `backend/src/validations/auth.test.ts` : [PASS] **bootstrapSchema › refuse un marché non chaîne** — `42`, `'ci'`
- `backend/src/validations/auth.test.ts` : [PASS] **bootstrapSchema › refuse un corps null ou non objet** — null, string, tableau
- `backend/src/validations/auth.test.ts` : [PASS] **bootstrapSchema › refuse un champ inconnu (strict)** — `unrecognized_keys`
- `backend/src/validations/auth.test.ts` : [PASS] **bootstrapSchema › format de la réponse d'erreur › place le rôle invalide dans fieldErrors.role** — `error.flatten()` côté `details`
- `backend/src/validations/auth.test.ts` : [PASS] **bootstrapSchema › format de la réponse d'erreur › place le marché invalide dans fieldErrors.market** — message contenant `CI`
- `backend/src/validations/auth.test.ts` : [PASS] **bootstrapSchema › format de la réponse d'erreur › place la clé inconnue dans formErrors** — nom de la clé dans `formErrors`
- `backend/src/validations/auth.test.ts` : [PASS] **bootstrapSchema › format de la réponse d'erreur › signale un corps non objet dans formErrors** — `invalid_type`

### `backend/src/validations/common.ts`
- `backend/src/validations/common.test.ts` : 35 tests — [PASS] **marketSchema › n'accepte que CI et BJ** — enumeration stricte
- `backend/src/validations/common.test.ts` : [PASS] **marketSchema › refuse les valeurs non chaînes** — 42 / null / undefined
- `backend/src/validations/common.test.ts` : [PASS] **marketSchema › détaille le code d'erreur** — `invalid_value`
- `backend/src/validations/common.test.ts` : [PASS] **idSchema › accepte un identifiant standard** — `room-1`
- `backend/src/validations/common.test.ts` : [PASS] **idSchema › retire les espaces autour** — trim appliqué
- `backend/src/validations/common.test.ts` : [PASS] **idSchema › refuse une chaîne vide ou composée d'espaces** — `''` / `'   '`
- `backend/src/validations/common.test.ts` : [PASS] **idSchema › accepte jusqu'à 200 caractères et refuse 201** — borne max
- `backend/src/validations/common.test.ts` : [PASS] **idSchema › refuse les valeurs non chaînes** — 1 / null / undefined
- `backend/src/validations/common.test.ts` : [PASS] **idSchema › accepte un UUID et des caractères Unicode** — robustesse encodage
- `backend/src/validations/common.test.ts` : [PASS] **emailSchema › accepte un email valide et le passe en minuscules** — transform lowercase
- `backend/src/validations/common.test.ts` : [PASS] **emailSchema › retire les espaces avant/après** — trim avant validation
- `backend/src/validations/common.test.ts` : [PASS] **emailSchema › accepte la casse déjà minuscule sans modification** — idempotence
- `backend/src/validations/common.test.ts` : [PASS] **emailSchema › refuse un email invalide** — formats malformés + vide
- `backend/src/validations/common.test.ts` : [PASS] **emailSchema › accepte 255 caractères et refuse 256** — borne max
- `backend/src/validations/common.test.ts` : [PASS] **emailSchema › refuse les valeurs non chaînes** — 42 / null
- `backend/src/validations/common.test.ts` : [PASS] **dateStringSchema › accepte une date ISO AAAA-MM-JJ** — format regex
- `backend/src/validations/common.test.ts` : [PASS] **dateStringSchema › accepte une date bissextile** — `2028-02-29`
- `backend/src/validations/common.test.ts` : [PASS] **dateStringSchema › refuse un format autre que AAAA-MM-JJ** — slash, ISO complet, texte
- `backend/src/validations/common.test.ts` : [PASS] **dateStringSchema › refuse un mois invalide avec le message « Date invalide »** — raffinement `Date.parse`
- `backend/src/validations/common.test.ts` : [PASS] **dateStringSchema › refuse un jour invalide** — jour 00
- `backend/src/validations/common.test.ts` : [PASS] **dateStringSchema › refuse les valeurs non chaînes** — nombre / null
- `backend/src/validations/common.test.ts` : [PASS] **optionalText › valeur manquante → chaîne vide par défaut** — `default('')`
- `backend/src/validations/common.test.ts` : [PASS] **optionalText › retire les espaces superflus** — trim
- `backend/src/validations/common.test.ts` : [PASS] **optionalText › accepte une chaîne vide** — optionnel non requis
- `backend/src/validations/common.test.ts` : [PASS] **optionalText › respecte la longueur maximale (exactement max → ok, max+1 → refus)** — borne inclusive
- `backend/src/validations/common.test.ts` : [PASS] **optionalText › refuse les valeurs non chaînes** — 42 / null
- `backend/src/validations/common.test.ts` : [PASS] **marketQuerySchema › accepte une requête vide** — market facultatif
- `backend/src/validations/common.test.ts` : [PASS] **marketQuerySchema › accepte un marché valide et le conserve** — `BJ`
- `backend/src/validations/common.test.ts` : [PASS] **marketQuerySchema › refuse un marché invalide** — path `['market']`
- `backend/src/validations/common.test.ts` : [PASS] **marketQuerySchema › ignore les paramètres inconnus (objet non strict, usage query Express)** — comportement non strict documenté
- `backend/src/validations/common.test.ts` : [PASS] **idParamsSchema › accepte un paramètre id valide** — happy path params
- `backend/src/validations/common.test.ts` : [PASS] **idParamsSchema › exige le paramètre id** — path `['id']`
- `backend/src/validations/common.test.ts` : [PASS] **idParamsSchema › refuse un id vide ou composé d'espaces** — trim + min(1)
- `backend/src/validations/common.test.ts` : [PASS] **idParamsSchema › refuse un id trop long** — 201 caractères
- `backend/src/validations/common.test.ts` : [PASS] **idParamsSchema › ignore les paramètres inconnus (non strict)** — `locale` accepté

### `backend/src/validations/notification.ts`
- `backend/src/validations/notification.test.ts` : 28 tests — [PASS] **notificationCreateSchema › accepte une notification complète** — 8 champs
- `backend/src/validations/notification.test.ts` : [PASS] **notificationCreateSchema › accepte les 7 types de notification** — parcours de l'énumération
- `backend/src/validations/notification.test.ts` : [PASS] **notificationCreateSchema › accepte les seuls champs requis et applique les défauts** — `clientPhone`/`message` = `''`, `reservationId` absent
- `backend/src/validations/notification.test.ts` : [PASS] **notificationCreateSchema › refuse un type inconnu** — path `['type']`
- `backend/src/validations/notification.test.ts` : [PASS] **notificationCreateSchema › refuse un type non chaîne** — 42
- `backend/src/validations/notification.test.ts` : [PASS] **notificationCreateSchema › exige roomTitle, roomId, clientName et clientEmail** — parcours des 4 requis (path exact)
- `backend/src/validations/notification.test.ts` : [PASS] **notificationCreateSchema › normalise l'email du client en minuscules** — `Jean@Example.ci` → minuscules
- `backend/src/validations/notification.test.ts` : [PASS] **notificationCreateSchema › refuse un email client invalide** — path `['clientEmail']`
- `backend/src/validations/notification.test.ts` : [PASS] **notificationCreateSchema › refuse un roomId vide ou non identifiant** — `''` / espaces
- `backend/src/validations/notification.test.ts` : [PASS] **notificationCreateSchema › refuse un roomTitle vide ou trop long** — min(1) et max(300)
- `backend/src/validations/notification.test.ts` : [PASS] **notificationCreateSchema › accepte un roomTitle de 300 caractères** — borne max exacte
- `backend/src/validations/notification.test.ts` : [PASS] **notificationCreateSchema › refuse un clientName vide ou trop long** — min/max
- `backend/src/validations/notification.test.ts` : [PASS] **notificationCreateSchema › borne clientPhone à 30 caractères et le trimme** — 31 refusé, trim appliqué
- `backend/src/validations/notification.test.ts` : [PASS] **notificationCreateSchema › borne le message à 2000 caractères** — 2001 refusé / 2000 accepté
- `backend/src/validations/notification.test.ts` : [PASS] **notificationCreateSchema › refuse un reservationId invalide quand il est fourni** — optionnel mais validé
- `backend/src/validations/notification.test.ts` : [PASS] **notificationCreateSchema › refuse un champ inconnu (strict)** — `unrecognized_keys`
- `backend/src/validations/notification.test.ts` : [PASS] **notificationCreateSchema › refuse un corps non objet** — null / string
- `backend/src/validations/notification.test.ts` : [PASS] **notificationCreateSchema › détaille les erreurs de champs (format details = error.flatten())** — `fieldErrors` = {clientEmail, roomTitle}
- `backend/src/validations/notification.test.ts` : [PASS] **clientNotificationCreateSchema › accepte une notification de confirmation** — happy path
- `backend/src/validations/notification.test.ts` : [PASS] **clientNotificationCreateSchema › accepte les deux types autorisés** — confirmed / rejected
- `backend/src/validations/notification.test.ts` : [PASS] **clientNotificationCreateSchema › refuse un type hors des deux autorisés (contrairement au schéma gérant)** — `reservation`, `verification_*`, `promo`
- `backend/src/validations/notification.test.ts` : [PASS] **clientNotificationCreateSchema › accepte les seuls champs requis avec message par défaut** — `message` = `''`
- `backend/src/validations/notification.test.ts` : [PASS] **clientNotificationCreateSchema › exige clientEmail** — path `['clientEmail']`
- `backend/src/validations/notification.test.ts` : [PASS] **clientNotificationCreateSchema › refuse un email invalide et normalise la casse** — rejet + trim/lowercase
- `backend/src/validations/notification.test.ts` : [PASS] **clientNotificationCreateSchema › refuse roomId ou roomTitle vides** — champs requis vides
- `backend/src/validations/notification.test.ts` : [PASS] **clientNotificationCreateSchema › borne le message à 2000 caractères** — limite haute
- `backend/src/validations/notification.test.ts` : [PASS] **clientNotificationCreateSchema › refuse les champs réservés au schéma gérant (clientName, clientPhone…)** — strict + lecture croisée des deux schémas
- `backend/src/validations/notification.test.ts` : [PASS] **clientNotificationCreateSchema › refuse un corps non objet** — null / tableau

### `backend/src/validations/review.ts`
- `backend/src/validations/review.test.ts` : 18 tests — [PASS] **reviewCreateSchema › accepte un avis complet** — happy path 4 champs
- `backend/src/validations/review.test.ts` : [PASS] **reviewCreateSchema › accepte les seuls champs requis avec commentaire par défaut** — `commentaire` = `''`
- `backend/src/validations/review.test.ts` : [PASS] **reviewCreateSchema › accepte les bornes 1 et 5 pour les deux notes** — bornes incluses
- `backend/src/validations/review.test.ts` : [PASS] **reviewCreateSchema › refuse une note hors bornes** — 0 / 6 / -1 sur les deux notes
- `backend/src/validations/review.test.ts` : [PASS] **reviewCreateSchema › refuse une note non entière** — 4.5 → path `['note_appartement']`
- `backend/src/validations/review.test.ts` : [PASS] **reviewCreateSchema › refuse une note de type chaîne** — `'5'` → path `['note_gerant']`
- `backend/src/validations/review.test.ts` : [PASS] **reviewCreateSchema › exige les deux notes** — suppression de chacune
- `backend/src/validations/review.test.ts` : [PASS] **reviewCreateSchema › exige une réservation identifiée** — vide + absent
- `backend/src/validations/review.test.ts` : [PASS] **reviewCreateSchema › trimme le commentaire et le borne à 2000 caractères** — trim + limite
- `backend/src/validations/review.test.ts` : [PASS] **reviewCreateSchema › refuse un champ inconnu (strict)** — `unrecognized_keys`
- `backend/src/validations/review.test.ts` : [PASS] **reviewCreateSchema › refuse un corps non objet** — null / string
- `backend/src/validations/review.test.ts` : [PASS] **reviewCreateSchema › détaille toutes les erreurs de notes (format details = error.flatten())** — les deux paths dans `fieldErrors`
- `backend/src/validations/review.test.ts` : [PASS] **reviewRoomQuerySchema › accepte une requête avec room_id** — happy path query
- `backend/src/validations/review.test.ts` : [PASS] **reviewRoomQuerySchema › exige room_id** — path `['room_id']`
- `backend/src/validations/review.test.ts` : [PASS] **reviewRoomQuerySchema › refuse un room_id vide ou composé d'espaces** — trim + min(1)
- `backend/src/validations/review.test.ts` : [PASS] **reviewRoomQuerySchema › refuse un room_id trop long** — 201 caractères
- `backend/src/validations/review.test.ts` : [PASS] **reviewRoomQuerySchema › refuse un champ inconnu (strict)** — `unrecognized_keys`
- `backend/src/validations/review.test.ts` : [PASS] **reviewRoomQuerySchema › refuse une valeur non chaîne** — nombre / null

## ÉCHECS À CORRIGER
- Aucun. Les 172 tests ajoutés sont verts, la suite complète (33 fichiers / 672 tests) est verte, `npm run lint` et `npm run typecheck` sortent en code 0.
- (Corrections effectuées en cours de rédaction, sans toucher au code source — les attentes de test étaient erronées, pas le code : claims `exp`/`iat` attendus par `toMatchObject` au lieu de `toEqual` ; message réel `Accès réservé aux comptes gerant` sans accent pour le rôle `gerant` ; en-têtes `Bearer` normalisés par Node ; un JWT signé avec le secret admin passe quelles que soient ses claims.)

## Observations / points d'attention
1. **`requireAdminAuth` ne vérifie que la signature** : un JWT HS256 signé avec `ADMIN_JWT_SECRET` mais sans `adminId`/`email` est accepté et posé sur `req.admin` (test consigné : « ne vérifie que la signature »). Risque faible en l'état (secret serveur uniquement) mais un contrôle `adminId` string non vide serait plus défendant.
2. **`requireGerantMarket` absorbe les erreurs Supabase en 403** : `error || !gerant || !is_verified` partagent le même message — une panne DB est indistinguable d'un accès refusé côté client (c'est le comportement actuel, testé tel quel). `requireProfile`, lui, remonte en 500.
3. **Message 403 de `requireProfile` sans accent** pour le rôle gérant : `Accès réservé aux comptes gerant` (concaténation du rôle brut) — incohérence cosmétique avec les autres messages, à harmoniser si le frontend l'affiche tel quel.
4. **`notificationCreateSchema` (schéma gérant) n'est plus référencé par aucune route** (POST /notifications supprimé, cf. commentaire dans `routes/notifications.ts`) ; il n'est testé qu'au niveau schéma. `clientNotificationCreateSchema`, lui, est bien couvert par `routes/notifications.test.ts`.
5. **`marketQuerySchema` et `idParamsSchema` sont non stricts** : les clés inconnues passent (testé explicitement). Utile pour les params Express (`:id`, `market`) mais à garder en tête si ces schémas sont réutilisés pour un corps de requête.
6. **`dateStringSchema` accepte `2026-02-30`** : `Date.parse` en JS « répare » les jours hors mois (seul le mois hors 01-12 est rejeté). Comportement documenté par les tests (`2026-13-01`, `2026-00-10`, `2026-05-00` refusés) — une validation de calendrier réelle demanderait un contrôle supplémentaire.
7. **Style** : middlewares testés via `buildTestApp` + Supabase mocké (`createSupabaseMock`/`fakeChain`/`useSupabaseTables`) et `verifyToken` mocké (`defaultVerifyToken`), cohérent avec `routes/*.test.ts` ; `errorHandler` testé en unitaire avec `req`/`res`/`next` minimaux (spy `console.error`). Aucun fichier source, helper, `vitest.config.ts` ni `package.json` modifié.

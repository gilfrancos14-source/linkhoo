# TEST_REPORT B2 - Utils + Config + Montage backend

**Projet** : `C:\Dossier personelle\Projet-it\ilehya_location\ilehya-react` (backend Express + Supabase + Vitest 5)
**Baseline (début de vague)** : 24 fichiers / 500 tests verts → **après B2 : +8 fichiers / +115 tests, 0 échec** (suite complète du dépôt : **41 fichiers / 787 tests verts**)
**Vérifications** :
- `npx vitest run src/utils src/config src/index.test.ts` → **8 fichiers / 115 tests PASS**
- suite complète `npx vitest run` → **41 fichiers / 787 tests PASS**
- `npm run lint` (oxlint --deny-warnings) → **exit 0**
- `npm run typecheck` (`tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.test.json`) → **exit 0**
- couverture du périmètre B2 (`--coverage.include=src/utils/** --coverage.include=src/config/** --coverage.include=src/index.ts`) → **94,02 % lignes / 92,13 % instructions / 90,64 % branches** (seul `src/index.ts` reste < 80 % sur les branches, cf. observations)

**Fichiers créés** (8) :
`backend/src/utils/fetchAll.test.ts` (11), `backend/src/utils/gerantQualification.test.ts` (13), `backend/src/utils/googleMaps.test.ts` (29), `backend/src/utils/rateLimiters.test.ts` (6), `backend/src/config/fedapay.test.ts` (8), `backend/src/config/fedapayHttp.test.ts` (16), `backend/src/config/supabase.test.ts` (6), `backend/src/index.test.ts` (26).

## Tests ajoutés

### `backend/src/utils/fetchAll.ts`
- `backend/src/utils/fetchAll.test.ts` : 11 tests - [PASS] **fetchAllRows > renvoie un tableau vide quand la première page est vide** - `run` appelé 1 fois, plage `0→999`
- `backend/src/utils/fetchAll.test.ts` : [PASS] **fetchAllRows > concatène les pages jusqu'à la dernière page partielle** - 1030 lignes sur 2 plages
- `backend/src/utils/fetchAll.test.ts` : [PASS] **fetchAllRows > s'arrête après une page vide reçue en milieu de pagination** - 2 appels seulement
- `backend/src/utils/fetchAll.test.ts` : [PASS] **fetchAllRows > traite une page `null` comme la fin de la table** - `data: null`
- `backend/src/utils/fetchAll.test.ts` : [PASS] **fetchAllRows > traite une donnée non-tableau comme une page vide** - `data: {objet}`
- `backend/src/utils/fetchAll.test.ts` : [PASS] **fetchAllRows > propage l'erreur Supabase retournée par la page** - `error` rejeté tel quel
- `backend/src/utils/fetchAll.test.ts` : [PASS] **fetchAllRows > propage une promesse rejetée par `run`** - `Error('réseau indisponible')`
- `backend/src/utils/fetchAll.test.ts` : [PASS] **fetchAllRows > borne la première requête quand maxRows est inférieur à la page (1000)** - `maxRows=5` → plage `0→4` + avertissement
- `backend/src/utils/fetchAll.test.ts` : [PASS] **fetchAllRows > interrompt la pagination quand le plafond maxRows est atteint** - `maxRows=2500` → 3 plages + avertissement
- `backend/src/utils/fetchAll.test.ts` : [PASS] **fetchAllRows > n'appelle jamais `run` quand maxRows vaut 0** - 0 appel + avertissement
- `backend/src/utils/fetchAll.test.ts` : [PASS] **fetchAllRows > conserve le typage des lignes renvoyées** - typage générique préservé

### `backend/src/utils/gerantQualification.ts`
- `backend/src/utils/gerantQualification.test.ts` : 13 tests - [PASS] **isQualifiedGerant > refuse un gérant null** - `null` → false
- `backend/src/utils/gerantQualification.test.ts` : [PASS] **isQualifiedGerant > refuse un gérant undefined** - `undefined` → false
- `backend/src/utils/gerantQualification.test.ts` : [PASS] **isQualifiedGerant > refuse un gérant dont la vérification est nulle** - `is_verified: null`
- `backend/src/utils/gerantQualification.test.ts` : [PASS] **isQualifiedGerant > refuse un gérant non vérifié même premium** - `is_verified: false`
- `backend/src/utils/gerantQualification.test.ts` : [PASS] **isQualifiedGerant > refuse un gérant vérifié sans premium** - `is_premium: false`
- `backend/src/utils/gerantQualification.test.ts` : [PASS] **isQualifiedGerant > refuse un gérant dont is_premium est nul** - `is_premium: null`
- `backend/src/utils/gerantQualification.test.ts` : [PASS] **isQualifiedGerant > accepte un gérant vérifié et premium sans expiration** - `premium_expires_at: null` → true
- `backend/src/utils/gerantQualification.test.ts` : [PASS] **isQualifiedGerant > accepte un gérant premium sans la clé premium_expires_at** - clé absente
- `backend/src/utils/gerantQualification.test.ts` : [PASS] **isQualifiedGerant > accepte une expiration future** - 2099 → true
- `backend/src/utils/gerantQualification.test.ts` : [PASS] **isQualifiedGerant > refuse une expiration passée** - 2020 → false
- `backend/src/utils/gerantQualification.test.ts` : [PASS] **isQualifiedGerant > refuse une expiration strictement égale à l'instant présent** - horloge figée (`toFake: ['Date']`)
- `backend/src/utils/gerantQualification.test.ts` : [PASS] **isQualifiedGerant > bascule de true à false quand la date d'expiration passe** - avant/après la même échéance
- `backend/src/utils/gerantQualification.test.ts` : [PASS] **isQualifiedGerant > considère une date d'expiration invalide comme non expirée (comportement actuel)** - `'pas-une-date'` → true (voir observations)

### `backend/src/utils/googleMaps.ts`
- `backend/src/utils/googleMaps.test.ts` : 29 tests - [PASS] **parseGoogleMapsUrl — liens directs > extrait les coordonnées d'un lien /maps/@lat,lng** - `@48.8584,2.2945,17z`, aucun `fetch`
- `backend/src/utils/googleMaps.test.ts` : [PASS] **parseGoogleMapsUrl — liens directs > extrait les coordonnées d'un lien place avec /@lat,lng** - `/maps/place/…/@lat,lng`
- `backend/src/utils/googleMaps.test.ts` : [PASS] **parseGoogleMapsUrl — liens directs > extrait les coordonnées du motif data=!3d!4d** - `!3d48.86!4d2.29`
- `backend/src/utils/googleMaps.test.ts` : [PASS] **parseGoogleMapsUrl — liens directs > extrait les coordonnées du paramètre q=** - `q=5.32,-4.01`
- `backend/src/utils/googleMaps.test.ts` : [PASS] **parseGoogleMapsUrl — liens directs > extrait les coordonnées du paramètre ll=** - `ll=6.13,-1.63`
- `backend/src/utils/googleMaps.test.ts` : [PASS] **parseGoogleMapsUrl — liens directs > extrait les coordonnées du paramètre center=** - `center=6.13,-1.63`
- `backend/src/utils/googleMaps.test.ts` : [PASS] **parseGoogleMapsUrl — liens directs > extrait les coordonnées du paramètre viewpoint=** - `viewpoint=1.35,103.82`
- `backend/src/utils/googleMaps.test.ts` : [PASS] **parseGoogleMapsUrl — liens directs > décode un paramètre q encodé en %2C** - `q=48.85%2C2.29`
- `backend/src/utils/googleMaps.test.ts` : [PASS] **parseGoogleMapsUrl — liens directs > accepte un lien sans schéma (https:// préfixé)** - `www.google.com/…`
- `backend/src/utils/googleMaps.test.ts` : [PASS] **parseGoogleMapsUrl — liens directs > ignore les espaces autour du lien** - trim
- `backend/src/utils/googleMaps.test.ts` : [PASS] **parseGoogleMapsUrl — liens directs > accepte un hôte régional google.co.ci** - regex hôte Google
- `backend/src/utils/googleMaps.test.ts` : [PASS] **parseGoogleMapsUrl — liens directs > accepte un hôte maps.google.fr** - préfixe `maps.`
- `backend/src/utils/googleMaps.test.ts` : [PASS] **parseGoogleMapsUrl — rejets > refuse une chaîne vide ou blanche** - `''` / `'    '`
- `backend/src/utils/googleMaps.test.ts` : [PASS] **parseGoogleMapsUrl — rejets > refuse un texte qui n'est pas une URL** - les deux `new URL` échouent
- `backend/src/utils/googleMaps.test.ts` : [PASS] **parseGoogleMapsUrl — rejets > refuse un hôte non-Google même avec des coordonnées** - `example.com`, aucun `fetch`
- `backend/src/utils/googleMaps.test.ts` : [PASS] **parseGoogleMapsUrl — rejets > refuse un service Google qui n'est pas Google Maps** - `mail.google.com`
- `backend/src/utils/googleMaps.test.ts` : [PASS] **parseGoogleMapsUrl — rejets > refuse une recherche Google sans coordonnées exploitables** - `/search?q=locations`
- `backend/src/utils/googleMaps.test.ts` : [PASS] **parseGoogleMapsUrl — rejets > refuse des coordonnées hors bornes (lat > 90)** - `@999,12`
- `backend/src/utils/googleMaps.test.ts` : [PASS] **parseGoogleMapsUrl — rejets > refuse des coordonnées hors bornes via !3d!4d** - `!3d0!4d999`
- `backend/src/utils/googleMaps.test.ts` : [PASS] **parseGoogleMapsUrl — liens courts > suit les redirections jusqu'à la page finale et en extrait les coordonnées** - 301 puis 200, 2 appels `fetch` + options (`redirect:'manual'`, User-Agent)
- `backend/src/utils/googleMaps.test.ts` : [PASS] **parseGoogleMapsUrl — liens courts > résout aussi les liens goo.gl** - 302 puis page `@-4.01,5.32`
- `backend/src/utils/googleMaps.test.ts` : [PASS] **parseGoogleMapsUrl — liens courts > rejette une redirection vers un hôte non-Google (anti-SSRF)** - 1 seul appel
- `backend/src/utils/googleMaps.test.ts` : [PASS] **parseGoogleMapsUrl — liens courts > rejette une page finale dont l'URL n'est plus hébergée par Google** - contrôle post-boucle
- `backend/src/utils/googleMaps.test.ts` : [PASS] **parseGoogleMapsUrl — liens courts > rejette une redirection sans en-tête Location** - header absent
- `backend/src/utils/googleMaps.test.ts` : [PASS] **parseGoogleMapsUrl — liens courts > rejette une chaîne de redirections trop longue (au-delà de 5 sauts)** - **6 appels `fetch` maximum** (`hop 0…5`)
- `backend/src/utils/googleMaps.test.ts` : [PASS] **parseGoogleMapsUrl — liens courts > rejette un lien court qui aboutit à une page sans coordonnées** - extraction nulle
- `backend/src/utils/googleMaps.test.ts` : [PASS] **parseGoogleMapsUrl — liens courts > rejette une redirection dont l'en-tête Location est illisible** - `Location: http://`
- `backend/src/utils/googleMaps.test.ts` : [PASS] **parseGoogleMapsUrl — liens courts > rejette une page finale dont l'URL de réponse est illisible** - `res.url = ':::'`
- `backend/src/utils/googleMaps.test.ts` : [PASS] **parseGoogleMapsUrl — liens courts > rejette un lien court dont l'échec réseau** - `fetch` rejette (timers fake pour ne pas attendre 5 s)

### `backend/src/utils/rateLimiters.ts`
- `backend/src/utils/rateLimiters.test.ts` : 6 tests - [PASS] **createClientLimiter > sous la limite : la requête passe et expose les en-têtes draft-7** - `ratelimit: limit=3…`, `ratelimit-policy: 3;w=900`, pas de `retry-after`
- `backend/src/utils/rateLimiters.test.ts` : [PASS] **createClientLimiter > à la limite : la dernière requête autorisée reste acceptée** - 3e requête 200 avec `remaining=0`
- `backend/src/utils/rateLimiters.test.ts` : [PASS] **createClientLimiter > dépassement : la requête au-delà de la limite reçoit 429** - `{error:'Trop de requêtes…'}` + `retry-after`
- `backend/src/utils/rateLimiters.test.ts` : [PASS] **createClientLimiter > les requêtes GET ne sont jamais comptées (skip)** - 5 GET puis POST n°1 accepté, n°2 bloqué avec `limit=1`
- `backend/src/utils/rateLimiters.test.ts` : [PASS] **createClientLimiter > reset : l'expiration de la fenêtre remet le compteur à zéro** - `setSystemTime(+15 min + 1 s)` → 200
- `backend/src/utils/rateLimiters.test.ts` : [PASS] **createClientLimiter > limite par défaut : 60 écritures par fenêtre de 15 minutes** - `limit=60`, `remaining=59`, `60;w=900`

### `backend/src/config/fedapay.ts`
- `backend/src/config/fedapay.test.ts` : 8 tests - [PASS] **config/fedapay > applique la clé secrète et bascule en environnement live** - `setApiKey` + `setEnvironment('live')`, aucun `setAccountId`, aucun warning
- `backend/src/config/fedapay.test.ts` : [PASS] **config/fedapay > avertit quand les clés manquent mais configure tout de même l'environnement** - `[fedapay] … FEDAPAY_PUBLIC_KEY ou FEDAPAY_SECRET_KEY manquant`, `setApiKey` non appelé
- `backend/src/config/fedapay.test.ts` : [PASS] **config/fedapay > passe en sandbox quand FEDAPAY_ENV vaut sandbox**
- `backend/src/config/fedapay.test.ts` : [PASS] **config/fedapay > traite production comme live** - `production` → `live`
- `backend/src/config/fedapay.test.ts` : [PASS] **config/fedapay > normalise la casse de FEDAPAY_ENV** - `SANDBOX` → `sandbox`
- `backend/src/config/fedapay.test.ts` : [PASS] **config/fedapay > mappe une valeur inconnue de FEDAPAY_ENV sur sandbox** - `recette`
- `backend/src/config/fedapay.test.ts` : [PASS] **config/fedapay > renseigne l'identifiant de compte seulement s'il est présent** - `FEDAPAY_ACCOUNT_ID=acc_123`
- `backend/src/config/fedapay.test.ts` : [PASS] **config/fedapay > applique le timeout axios (patchAxiosTimeout) à l'import** - `axios.defaults.timeout = 15000`

### `backend/src/config/fedapayHttp.ts`
- `backend/src/config/fedapayHttp.test.ts` : 16 tests - [PASS] **isValidEmail > accepte une adresse simple** - `contact@ilehya.com`
- `backend/src/config/fedapayHttp.test.ts` : [PASS] **isValidEmail > accepte une adresse avec sous-domaine et plus-tag** - `prenom.nom+tag@sub.domaine.ci`
- `backend/src/config/fedapayHttp.test.ts` : [PASS] **isValidEmail > accepte une adresse de 255 caractères (borne haute)** - limite haute incluse
- `backend/src/config/fedapayHttp.test.ts` : [PASS] **isValidEmail > refuse une adresse de 256 caractères** - limite dépassée
- `backend/src/config/fedapayHttp.test.ts` : [PASS] **isValidEmail > refuse une adresse sans @**
- `backend/src/config/fedapayHttp.test.ts` : [PASS] **isValidEmail > refuse une adresse sans domaine de premier niveau** - `user@localhost`
- `backend/src/config/fedapayHttp.test.ts` : [PASS] **isValidEmail > refuse une adresse contenant un espace**
- `backend/src/config/fedapayHttp.test.ts` : [PASS] **isValidEmail > refuse une adresse vide**
- `backend/src/config/fedapayHttp.test.ts` : [PASS] **isValidEmail > refuse une adresse à double @**
- `backend/src/config/fedapayHttp.test.ts` : [PASS] **isValidEmail > refuse les valeurs non chaînes** - number / null / undefined / objet / tableau
- `backend/src/config/fedapayHttp.test.ts` : [PASS] **withFedapayTimeout > laisse passer une promesse qui résout avant le timeout** - `Promise.resolve`
- `backend/src/config/fedapayHttp.test.ts` : [PASS] **withFedapayTimeout > propage l'erreur d'origine survenue avant le timeout** - pas de message de timeout
- `backend/src/config/fedapayHttp.test.ts` : [PASS] **withFedapayTimeout > rejette avec le message de timeout au-delà de FEDAPAY_TIMEOUT_MS** - `FedaPay: timeout après 15000ms` (timers fake)
- `backend/src/config/fedapayHttp.test.ts` : [PASS] **withFedapayTimeout > n'intervient plus une promesse résolue** - aucune rejection après expiration du timer interne
- `backend/src/config/fedapayHttp.test.ts` : [PASS] **patchAxiosTimeout > pose le timeout FedaPay sur axios et ne le refait jamais** - drapeau interne : 2e appel no-op
- `backend/src/config/fedapayHttp.test.ts` : [PASS] **patchAxiosTimeout > ne réduit jamais un timeout axios déjà plus court** - instance fraîche à 500 ms inchangée

### `backend/src/config/supabase.ts`
- `backend/src/config/supabase.test.ts` : 6 tests - [PASS] **config/supabase > crée le client public avec la clé anon et sans persistance de session** - `auth: {persistSession:false, autoRefreshToken:false}`
- `backend/src/config/supabase.test.ts` : [PASS] **config/supabase > crée le client admin avec la clé de service et les mêmes options d'auth**
- `backend/src/config/supabase.test.ts` : [PASS] **config/supabase > exporte deux instances distinctes (public et admin)** - 2 `createClient`
- `backend/src/config/supabase.test.ts` : [PASS] **config/supabase > refuse de se monter sans SUPABASE_URL** - throw d'import + aucun `createClient`
- `backend/src/config/supabase.test.ts` : [PASS] **config/supabase > refuse de se monter sans SUPABASE_ANON_KEY**
- `backend/src/config/supabase.test.ts` : [PASS] **config/supabase > refuse de se monter sans SUPABASE_SERVICE_KEY**

### `backend/src/index.ts` (montage)
- `backend/src/index.test.ts` : 26 tests - [PASS] **sert /api/health avec un horodatage ISO** - 200 + `timestamp` parsable
- `backend/src/index.test.ts` : [PASS] **applique les en-têtes de sécurité helmet et masque x-powered-by** - `x-content-type-options: nosniff`, `x-powered-by` absent
- `backend/src/index.test.ts` : [PASS] **met en cache publiquement les endpoints publics de la home** - `Cache-Control: public, max-age=0, stale-while-revalidate=300` sur `/api/banners`
- `backend/src/index.test.ts` : [PASS] **ne pose pas de Cache-Control sur un endpoint hors liste** - `/api/health`
- `backend/src/index.test.ts` : [PASS] **expose GET /api/rooms (paginé via fetchAllRows)** - 200 `[]`
- `backend/src/index.test.ts` : [PASS] **expose GET /api/rooms/popular** - 200 `[]` (2 lectures Supabase parallèles mockées)
- `backend/src/index.test.ts` : [PASS] **expose GET /api/reviews/featured** - 200 `[]`
- `backend/src/index.test.ts` : [PASS] **refuse /api/admin/me sans jeton admin** - 401 `Token d'authentification manquant`
- `backend/src/index.test.ts` : [PASS] **refuse /api/auth/me sans jeton Clerk** - 401 (mount `requireClerkAuth`)
- `backend/src/index.test.ts` : [PASS] **refuse /api/gerants/me sans jeton Clerk** - 401 (mount `requireClerkAuth`)
- `backend/src/index.test.ts` : [PASS] **refuse /api/rooms/mine sans jeton Clerk** - 401 (middleware route)
- `backend/src/index.test.ts` : [PASS] **compte les écritures /api (401 mais en-têtes de rate limit draft-7)** - `ratelimit: limit=200…`, `ratelimit-policy: 200;w=900`
- `backend/src/index.test.ts` : [PASS] **autorise l'origine de développement et refuse les autres** - ACAO `localhost:5173` + credentials, aucun ACAO pour `evil.test`
- `backend/src/index.test.ts` : [PASS] **autorise les préflights OPTIONS /api** - 204 + `access-control-allow-methods` contenant POST
- `backend/src/index.test.ts` : [PASS] **répond 404 sur une route /api inconnue** - `{error:'Route introuvable'}`
- `backend/src/index.test.ts` : [PASS] **répond 404 hors /api** - second middleware 404
- `backend/src/index.test.ts` : [PASS] **transforme une erreur Supabase en 500 masqué** - `{error:'Erreur interne du serveur'}` (jamais de fuite)
- `backend/src/index.test.ts` : [PASS] **répond 400 à un corps JSON malformé** - `err.status=400` géré par `errorHandler`
- `backend/src/index.test.ts` : [PASS] **rejette le webhook FedaPay dont la signature est invalide** - 400 `Webhook signature invalide: …`
- `backend/src/index.test.ts` : [PASS] **accepte 10 inscriptions newsletter puis renvoie 429 à la 11e** - limiter dédiée `limit=10`
- `backend/src/index.test.ts` : [PASS] **compresse en gzip les réponses plus lourdes que le seuil** - 20 chambres factices (> 1 Ko) → `content-encoding: gzip` + corps décompressé
- `backend/src/index.test.ts` : [PASS] **épuise le quota d'écritures /api (200 par fenêtre de 15 min)** - 188×401 puis 429 avec `remaining=0`
- `backend/src/index.test.ts` > production : [PASS] **n'accepte que les origines déclarées** - second montage avec `vi.resetModules()` + `ALLOWED_ORIGINS`
- `backend/src/index.test.ts` > production : [PASS] **refuse l'origine de développement par défaut** - aucun ACAO pour `localhost:5173`
- `backend/src/index.test.ts` > reverse proxy : [PASS] **active trust proxy avec le nombre de sauts déclaré** - `TRUST_PROXY=2` → `app.get('trust proxy') === 2`
- `backend/src/index.test.ts` > reverse proxy : [PASS] **interrompt le démarrage si TRUST_PROXY est invalide** - `process.exit(1)` intercepté (spy) + import en échec

## ÉCHECS À CORRIGER
- **Aucun.** Les 115 tests ajoutés sont verts, la suite complète (41 fichiers / 787 tests) est verte, `npm run lint` et `npm run typecheck` sortent en code 0.
- Corrections effectuées en cours de rédaction, **sans toucher au code source** (les attentes de test étaient erronées, pas le code) :
  1. `src/index.test.ts` : le second montage (production) exigeait `vi.resetModules()` avant `import('./index')` — sinon le module est servi depuis le cache et garde la configuration CORS du premier montage.
  2. `src/index.test.ts` : les hooks `beforeAll`/`afterAll` ont été déplacés au **niveau fichier** — exécutés dans le describe, ils restauraient l'environnement avant le second import, ce qui aurait retiré `CLERK_SECRET_KEY` et déclenché `process.exit(1)` dans `index.ts`.
  3. `src/utils/fetchAll.test.ts` : fichier réécrit proprement après un troncage d'encodage induit par un pipeline PowerShell (accents français), avec `afterEach(() => vi.restoreAllMocks())` pour restaurer les spies `console.warn`.

## Observations / points d'attention
1. **`isQualifiedGerant` considère une date d'expiration invalide comme non expirée** : `new Date('pas-une-date').getTime()` → `NaN`, et `NaN <= now` est faux → la branche « expiré » n'est jamais prise, la fonction renvoie `true`. Un gérant vérifié+premium dont `premium_expires_at` est corrompu garde donc son accès. Testé tel quel (`considère une date d'expiration invalide comme non expirée (comportement actuel)`) — un `Number.isFinite()` avant comparaison serait plus défendant.
2. **`src/index.ts` appelle `app.listen(port)` au chargement du module** : le test neutralise `NetServer.prototype.listen` **pendant la seule durée de l'import** (puis restaure l'original dans un `finally`), donc aucun socket n'est ouvert et supertest utilise le vrai `listen` ensuite. Aucune porte n'est consommée, aucune fuite de serveur.
3. **Ce qui n'est pas couvert dans `index.ts`** (84,21 % lignes / 78,57 % branches / 46,66 % fonctions) : les handlers `uncaughtException`, `SIGTERM` et `SIGINT` (ils appellent `server.close(() => process.exit(...))` : les tester tuerait le worker) et la branche `ALLOWED_ORIGINS` vide en production (idem). La branche `TRUST_PROXY` invalide **est** testée avec `process.exit` espionné. C'est ce qui tire la couverture « fonctions » du périmètre à 72,72 %.
4. **Le rate limiter d'écriture est partagé par toutes les routes `/api`** (200 req / 15 min, `skip` sur GET) : un test qui épuise le quota le vide pour tout le reste de la fenêtre. Le test d'épuisement est donc placé **en dernier** dans le fichier, et le test newsletter (limite 10) avant lui. À garder en tête si l'on ajoute d'autres tests POST `/api` au même fichier.
5. **Compression : seuil 1 Ko.** Toutes les réponses mockées vides (`[]`) sont sous le seuil et ne sont pas compressées ; le test gzip fabrique volontairement 20 chambres factices pour franchir 1 Ko. Un test « tout en 200 vide » aurait échoué sur `content-encoding`.
6. **CORS en production** : `ALLOWED_ORIGINS` est obligatoire dès que `NODE_ENV=production`, sinon `index.ts` appelle `process.exit(1)` (non testé, cf. point 3). Par défaut hors production : `http://localhost:5173,http://127.0.0.1:5173`.
7. **Mock Supabase global pour le montage** : `vi.mock('./config/supabase')` + `createSupabaseMock()` du helper, avec `from` branché sur `fakeChain({data: [], error: null})` et `rpc` résolu à vide. `data: []` rend `existing` truthy côté newsletter (« déjà inscrit » en 200) : comportement propre au mock, pas un constat sur la base.
8. **`config/fedapay.ts` et `config/fedapayHttp.ts` ont des effets de bord à l'import** : chaque scénario repart d'un module vierge (`vi.resetModules()` + import dynamique), sinon seuls les tests suivants verraient les appels `FedaPay.*`. Même technique pour `config/supabase.ts` (throw à l'import si variable absente) et pour le second montage de `index.ts`.
9. **`patchAxiosTimeout` est idempotent** (drapeau interne) : le second appel n'écrase jamais un timeout déjà plus court — couvert par un test sur une instance axios fraîche (isolée via `resetModules`).
10. **`parseGoogleMapsUrl` borne la résolution à 6 appels `fetch`** (`hop 0…5`, `redirect: 'manual'`, `AbortController` + timer 5 s) avec contrôle anti-SSRF **à chaque hop et sur l'URL finale** ; les branches défensives (`Location` illisible, URL finale illisible) sont couvertes. `MAX_REDIRECTS = 5` signifie 6 requêtes au total — c'est le comportement testé.
11. **Style** : tests rédigés dans l'ordre rouge→vert (test d'abord, implémentation inchangée), assertions sur le comportement observable (réponses HTTP, en-têtes, messages), mocks des seules dépendances externes (Supabase, fedapay, `@supabase/supabase-js`, `fetch`), aucun état partagé entre tests (reset des mocks/env en `beforeEach`/`beforeAll`). **Aucun fichier source, helper existant, `vitest.config.ts` ni `package.json` modifié.**

# TEST_REPORT F1 — Logique frontend

Périmètre : `frontend/src/contexts`, `frontend/src/hooks`, `frontend/src/components/ErrorBoundary`, `frontend/src/lib/api.ts`.
Aucun fichier source, config (`vite.config.ts`, `tsconfig*`, `package.json`) ni `src/test/setup.ts` n'a été modifié : uniquement 5 fichiers `*.test.ts(x)` colocalisés créés.

## Tests ajoutés

### frontend/src/contexts/MarketContext.tsx
- `frontend/src/contexts/MarketContext.test.tsx` : [PASS] — 13 tests :
  - `marketSlugFromPath` :
    - [PASS] retourne « ci » pour la racine du marché CI — `marketSlugFromPath('/ci') === 'ci'`
    - [PASS] retourne « bj » pour la racine du marché BJ — `marketSlugFromPath('/bj') === 'bj'`
    - [PASS] lit le segment de marché quelle que soit la profondeur de la route — `/ci/chambres`, `/bj/chambre/12/reserver`, `/bj/`
    - [PASS] retourne null sur les routes sans marché — `/`, `/admin`, `/admin/dashboard`
    - [PASS] retourne null sur un segment qui n'est pas un marché exact — `/CI` (sensibilité à la casse), `/civique`, `''`
  - `MarketProvider` :
    - [PASS] rend ses children — arbre monté, boutons présents
    - [PASS] expose le marché dérivé de l'URL (CI) — `market === 'CI'` sur `/ci/chambres`
    - [PASS] expose le marché dérivé de l'URL (BJ) — `market === 'BJ'` sur `/bj`
    - [PASS] retombe sur CI hors /ci|/bj — fallback sur `/admin/login`
    - [PASS] pose data-market sur `<html>` pour piloter le thème — `documentElement[data-market="BJ"]`
    - [PASS] met à jour data-market quand l'URL change de marché — CI → BJ après clic
    - [PASS] setMarket navigue vers /{marché} avec remplacement de l'historique — pathname `/ci` → `/bj` → `/ci`
  - `useMarket` :
    - [PASS] lève une erreur explicite en dehors de MarketProvider — message `useMarket must be used within MarketProvider` capturé par une error boundary de test

### frontend/src/hooks/useEspace.ts
- `frontend/src/hooks/useEspace.test.tsx` : [PASS] — 17 tests :
  - `enregistrement du jeton Clerk` :
    - [PASS] enregistre getToken comme getter de jeton au montage — `setAuthTokenGetter` appelé 1×, getter résout `session-token`
    - [PASS] ré-enregistre le getter quand l'identité de getToken change — 2ᵉ enregistrement après changement d'identité
  - `redirections hors session` :
    - [PASS] redirige vers /ci/login tant que Clerk n'a pas chargé — `isLoaded=false` → `/ci/login` (replace), aucun appel API
    - [PASS] redirige vers /ci/login si l'utilisateur n'est pas connecté — `isSignedIn=false`, `loading` reste à « repos »
    - [PASS] utilise le chemin du marché courant (BJ) — entrée `/bj/espace` → `/bj/login`
  - `résolution du rôle via apiAuth.me` :
    - [PASS] navigue vers /ci/compte pour un rôle client — 1 appel `me`, `bootstrap` non appelé
    - [PASS] navigue vers /ci/gerant pour un rôle gérant
    - [PASS] affiche l'état de chargement pendant la résolution — `loading` « chargement » tant que `me()` est en vol, puis « repos »
    - [PASS] réessaie apiAuth.me() 3 fois avant d'abandonner — timers fausses, 3 appels, repli sur `/ci/compte`
    - [PASS] réussit après une tentative échouée (2 appels) — retry + navigation vers `/ci/gerant`
  - `repli sur les métadonnées Clerk` :
    - [PASS] retombe sur unsafeMetadata quand me() échoue (bootstrap + navigation) — `bootstrap({role:'gerant', market:'CI'})`
    - [PASS] lit publicMetadata quand unsafeMetadata n'a pas de rôle
    - [PASS] utilise les métadonnées quand me() répond sans rôle — `role: null` → bootstrap
    - [PASS] ignore une valeur de rôle inconnue dans les métadonnées — `role:'admin'` → pas de bootstrap → `/ci/compte`
    - [PASS] passe le marché BJ au bootstrap sur une URL /bj — `bootstrap({…, market:'BJ'})` + `/bj/gerant`
    - [PASS] continue la navigation même si le bootstrap échoue — erreur bootstrap avalée
    - [PASS] navigue vers /ci/compte quand aucun rôle n'est trouvable — `me()` échoue, pas de métadonnées

### frontend/src/hooks/useRevealOnScroll.ts
- `frontend/src/hooks/useRevealOnScroll.test.tsx` : [PASS] — 10 tests (IntersectionObserver mocké et pilotable) :
  - [PASS] marque immédiatement comme visible un élément déjà dans le viewport — classe `is-visible`, aucun `observe()`
  - [PASS] observe les éléments hors viewport sans les rendre visibles tout de suite
  - [PASS] configure l'observateur avec le seuil et la marge de défilement attendus — `{ threshold: 0.05, rootMargin: '0px 0px -40px 0px' }`
  - [PASS] révèle puis cesse d'observer un élément qui entre dans le viewport — `is-visible` ajoutée + `unobserve`
  - [PASS] ignore un élément dont l'intersection est fausse (hors écran)
  - [PASS] n'observe que les éléments de classe « reveal »
  - [PASS] enregistre les éléments ajoutés après le premier rendu (MutationObserver) — `rerender` puis révélation à l'intersection
  - [PASS] rend visible un élément tardif déjà dans le viewport, sans l'observer
  - [PASS] ne ré-enregistre pas un élément déjà traité (même après un déplacement) — garde `WeakSet`
  - [PASS] déconnecte les deux observateurs au démontage — `IntersectionObserver.disconnect` + `MutationObserver.disconnect`

### frontend/src/components/ErrorBoundary.tsx
- `frontend/src/components/ErrorBoundary.test.tsx` : [PASS] — 8 tests (erreurs React assourdies via `console.error`) :
  - [PASS] rend ses enfants tant qu'aucune erreur ne survient
  - [PASS] affiche le fallback générique quand un enfant lève une erreur — titre, message, bouton « Réessayer », lien « Retour à l'accueil » (`href="/"`), contenu en échec masqué
  - [PASS] « Réessayer » remonte l'arbre et rend à nouveau les enfants — reset d'état vérifié quand l'enfant cesse de throw
  - [PASS] reste sur le fallback si l'enfant continue de lever l'erreur
  - [PASS] détecte une erreur de chunk lazy et demande un rechargement de la page — titre « Mise à jour du site », branche `reload` prouvée (pas de reset d'état)
  - [PASS] traite « Loading chunk failed » comme une erreur de chunk
  - [PASS] ne classe pas une erreur ordinaire comme erreur de chunk — « Une erreur est survenue » + « Réessayer »
  - [PASS] se réinitialise quand les children changent (nouvelle route) — reset via `componentDidUpdate`

### frontend/src/lib/api.ts
- `frontend/src/lib/api.test.ts` : [PASS] — 107 tests (module rechargé par test : isolat de `authTokenGetter` et du cache public) :
  - `setAuthTokenGetter / en-tête Authorization` (4) :
    - [PASS] n'envoie aucun Authorization quand aucun getter n'est enregistré
    - [PASS] envoie Authorization: Bearer <jeton> quand le getter renvoie un jeton
    - [PASS] n'envoie pas Authorization quand le getter renvoie null
    - [PASS] réinterroge le getter à chaque requête (jeton rafraîchi)
  - `request` (11) :
    - [PASS] préfixe le chemin par /api et renvoie le corps JSON
    - [PASS] pose Content-Type: application/json par défaut
    - [PASS] fusionne les en-têtes personnalisés avec les en-têtes par défaut
    - [PASS] utilise AbortSignal.timeout(REQUEST_TIMEOUT_MS) quand aucun signal n'est fourni — spy + valeur `REQUEST_TIMEOUT_MS`
    - [PASS] transmet tel quel un signal d'annulation fourni par l'appelant
    - [PASS] transforme une erreur de délai en message explicite — `TimeoutError` → « Délai dépassé… »
    - [PASS] propage une erreur réseau non liée au délai
    - [PASS] throw le message du corps sur un statut d'erreur — 400 `{error}` → message serveur
    - [PASS] throw 'API error <status>' quand le corps n'a pas de message — 404
    - [PASS] throw 'API error <status>' sur un corps non JSON ou vide — 500 HTML, 503 vide
    - [PASS] ne lit pas le corps d'une réponse 204 (DELETE sans contenu)
  - `parseJsonBody` (5) :
    - [PASS] retourne undefined sur une 204
    - [PASS] retourne undefined sur une 205
    - [PASS] retourne undefined sur un corps vide
    - [PASS] parse un corps JSON valide
    - [PASS] laisse remonter l'erreur de parsing sur un corps invalide — `SyntaxError`
  - `apiRooms` (14) :
    - [PASS] list(market) interroge /rooms?market=… via le cache public (`cache: no-cache`)
    - [PASS] list() sans marché interroge /rooms
    - [PASS] list(..., { fresh: true }) contourne le cache mémoire — 2 requêtes réseau
    - [PASS] listMine interroge /rooms/mine
    - [PASS] getPopular interroge /rooms/popular?market=…
    - [PASS] listAvailable construit la requête avec les dates et encode la ville — `%20`
    - [PASS] listAvailable omet le paramètre ville quand il est absent
    - [PASS] get interroge /rooms/:id
    - [PASS] villes construit les deux variantes de chemin
    - [PASS] create POST /rooms avec le corps sérialisé
    - [PASS] update PUT /rooms/:id avec le corps sérialisé
    - [PASS] delete DELETE /rooms/:id — 204 → `undefined`
    - [PASS] toggle PATCH /rooms/:id/toggle
    - [PASS] propage le message du serveur quand la suppression échoue — 409 `{error}`
  - `apiBanners / apiEvents` (3) :
    - [PASS] apiBanners.list avec marché — `/api/banners?market=CI`
    - [PASS] apiBanners.list sans marché — `/api/banners`
    - [PASS] apiEvents.list exige le marché dans la query — `/api/events?market=BJ`
  - `apiReservations` (7) :
    - [PASS] list GET /reservations
    - [PASS] listMine GET /reservations/mine
    - [PASS] cancelMine POST /reservations/:id/cancel
    - [PASS] create POST /reservations avec les données du client
    - [PASS] updateStatut PATCH /reservations/:id avec { statut }
    - [PASS] checkConflict construit la query sans exclude_id
    - [PASS] checkConflict ajoute exclude_id quand il est fourni
  - `apiNewsletter` (2) :
    - [PASS] subscribe POST /newsletter avec l'email
    - [PASS] subscribe transmet le marché quand il est renseigné
  - `apiNotifications` (5) :
    - [PASS] listAdmin GET /notifications
    - [PASS] listClient GET /notifications/client
    - [PASS] markRead PATCH /notifications/:id/read
    - [PASS] markReadClient PATCH /notifications/client/:id/read
    - [PASS] createClient POST /notifications/client avec le corps
  - `apiUpload` (6) :
    - [PASS] envoie le fichier en FormData sur /upload avec le jeton — `file`/`bucket`, `Authorization`, pas de `Content-Type` imposé
    - [PASS] omet le champ bucket quand aucun bucket n'est fourni
    - [PASS] n'ajoute Authorization sans jeton
    - [PASS] throw le message du serveur quand l'upload est refusé — 413
    - [PASS] throw 'Upload failed' sur une erreur sans message — 500
    - [PASS] throw 'Upload failed: réponse vide' quand l'url manque
  - `apiGerants` (8) :
    - [PASS] getMe GET /gerants/me
    - [PASS] updateMe PATCH /gerants/me avec le corps
    - [PASS] deleteDocument DELETE /gerants/:id/documents/:docId — 204
    - [PASS] submitVerification POST /gerants/:id/submit-verification
    - [PASS] setPropertyAddress envoie maps_url, lat et lng quand ils sont fournis
    - [PASS] setPropertyAddress n'envoie que maps_url sans coordonnées
    - [PASS] confirmVerification POST avec transaction_id
    - [PASS] getVerificationStatus GET /gerants/:id/verification-status
  - `apiPremium` (2) :
    - [PASS] initiate POST /premium/initiate avec le marché
    - [PASS] confirm POST /premium/confirm avec transaction_id
  - `apiAuth` (3) :
    - [PASS] me GET /auth/me
    - [PASS] bootstrap POST /auth/bootstrap avec rôle et marché
    - [PASS] bootstrap omet le marché quand il n'est pas renseigné
  - `apiClients` (3) :
    - [PASS] getMe GET /clients/me
    - [PASS] create POST /clients avec le corps
    - [PASS] updateMe PATCH /clients/me avec le corps
  - `apiReviews` (6) :
    - [PASS] listByRoom GET /reviews?room_id=…
    - [PASS] listByRoom encode les identifiants contenant des caractères réservés — `salle 7/a&b` → `salle%207%2Fa%26b`
    - [PASS] listMine GET /reviews/mine
    - [PASS] featured GET /reviews/featured via le cache public (`cache: no-cache`)
    - [PASS] create POST /reviews avec la note et le commentaire
    - [PASS] create omet le commentaire absent
  - `propagation d'erreurs par namespace` (2 × `it.each` sur 14 namespaces = 28 tests) :
    - [PASS] `<namespace> rejette avec le message renvoyé par le serveur` — 500 `{error:'boom serveur'}` pour `apiRooms.get`, `apiBanners.list`, `apiEvents.list`, `apiReservations.list`, `apiReservations.create`, `apiNewsletter.subscribe`, `apiNotifications.listAdmin`, `apiGerants.getMe`, `apiPremium.initiate`, `apiAuth.me`, `apiAuth.bootstrap`, `apiClients.getMe`, `apiReviews.listMine`, `apiReviews.featured`
    - [PASS] `<namespace> rejette avec API error <status> sans message` — 502 sans corps pour les mêmes 14 namespaces

**Total : 155 tests ajoutés (13 + 17 + 10 + 8 + 107), tous PASS.**

Vérifications (workdir `frontend/`) :
- `npx vitest run src/contexts src/hooks src/components/ErrorBoundary.test.tsx src/lib` → **10 fichiers / 205 tests PASS**
- `npx oxlint --deny-warnings src/contexts src/hooks src/components/ErrorBoundary.test.tsx src/lib/api.test.ts` → **0 avertissement / 0 erreur**
- `npm run lint` (global, `oxlint --deny-warnings`) → **exit 0** (dernier run)
- `npx tsc -b` (global) → **exit 0** (dernier run)

## ÉCHECS À CORRIGER
- Aucun.

## Observations / points d'attention
1. **`window.location.reload()` n'est pas spiable sous jsdom** : la propriété est *unforgeable* (`vi.spyOn(window.location, 'reload')` → `TypeError: Cannot redefine property: reload`). Le test « chunk » prouve donc la branche *reload* de façon indirecte et déterministe : après avoir fait cesser l'erreur de l'enfant, cliquer sur « Recharger la page » ne réinitialise **pas** la frontière (l'enfant ne réapparaît pas), alors que l'erreur était bien de type chunk. Un clic jsdom produit une trace bruite `Not implemented: navigation to another Document` dans la sortie du runner : **ce n'est pas un échec**, c'est la preuve que `reload()` est bien appelé.
2. **`request` n'envoie jamais `method: 'GET'`** : `fetch` déduit le GET. Toute assertion doit écrire `init.method ?? 'GET'` (3 tests corrigés sur ce point, aucune régression source à signaler).
3. **`api.ts` a de l'état de module** (`authTokenGetter`, `publicCache`) : les tests le rechargent via `vi.resetModules()` + `await import('./api')` dans chaque `beforeEach`. Si d'autres suites importent `./api` statiquement, elles voient une instance distincte — aucune interférence (isolation par fichier de test).
4. **`ErrorBoundary.tsx` n'est pas dans le périmètre de couverture** de `vite.config.ts` (`coverage.include` ne liste que `lib/data/hooks/utils/contexts` + 3 composants). Si le lead veut compter ces 8 tests dans le % de couverture, il faudra ajouter `src/components/ErrorBoundary.tsx` à `coverage.include` (modification de config réservée au lead).
5. **`useEspace` : `useNavigate` est mocké partiellement** (`react-router-dom` réel + `useNavigate` remplacé) pour assert destinations/`replace` sans installer de `<Routes>` ; `MarketProvider`/`useLocation` restent réels. Les délais de retry (2 × 800 ms) sont couverts sous `vi.useFakeTimers()` avec `advanceTimersByTimeAsync`, puis `vi.useRealTimers()` en `afterEach` — pas de flakiness mesurée.
6. **`data-market` sur `document.documentElement`** : l'attribut persiste entre tests d'un même fichier ; mes fichiers le nettoient en `beforeEach`/`afterEach`. Attention si d'autres suites lisent le thème.
7. La baseline des fichiers F1 (`src/contexts`, `src/hooks`, `src/components`, `src/lib`) avant ma vague était de **79 tests verts** ; apport net F1 : **+155**.
8. Aucun fichier source (`src/**` hors tests), `vite.config.ts`, `src/test/setup.ts` ni `package.json` modifié ; aucun fichier `.test` d'un autre agent touché.
9. **Vague concurrente** : pendant la session, des fichiers de test d'autres agents sont apparus/modifiés en direct (`CardSkeleton.test.tsx`, `PropertyMap.test.tsx`, `SplitAuthLayout.test.tsx`, `Header.test.tsx`…). Plusieurs exécutions intermédiaires de `npm run lint` / `npx tsc -b` ont échoué sur **leurs** erreurs (`.style` sur `Element`, variable inutilisée, erreur de syntaxe transitoire) — aucune ne venait des fichiers F1. État final : lint et tsc globaux à **exit 0**, et les 205 tests du périmètre F1 sont verts.

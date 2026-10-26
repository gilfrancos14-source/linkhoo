# TEST_REPORT P5 — Pages courtes et routage (`App.tsx`)

Périmètre : `frontend/src/App.tsx` (routage complet : routes marché `/ci|/bj`, espaces, lazy, guards) et 6 pages courantes :
`frontend/src/pages/{LandingPage,NotFoundPage,ClientLogin,ClientReservationPage,MentionsLegales,PolitiqueConfidentialite}.tsx`.
Aucun fichier source, config (`vite.config.ts`, `tsconfig*`, `package.json`) ni `src/test/setup.ts` n'a été modifié :
uniquement **7 fichiers `*.test.tsx` colocalisés** créés (70 tests) + ce rapport.

## Tests ajoutés

### frontend/src/App.test.tsx — routage, guards, lazy, chrome
- `frontend/src/App.test.tsx` : [PASS] — 26 tests :
  - **Racine et marché** :
  - [PASS] **rend la LandingPage blanche à la racine, sans chrome** — pane `div[style*="min-height: 100vh"]`, aucun `banner`/`contentinfo`, pathname `/`
  - [PASS] **redirige un segment de marché invalide vers la racine** — `/ch` → pathname `/` + LandingPage
  - [PASS] **redirige une URL inconnue hors marché vers la racine** — `/togo/quelque-part` → pathname `/`
  - [PASS] **rend la page d'accueil complète du marché CI** — `h1` Hero « Trouvez le lieu idéal… » + `banner` + `contentinfo` + `data-market="CI"`
  - [PASS] **applique le thème BJ sur l'accueil /bj** — `h1` Hero + `data-market="BJ"` sur `<html>`
  - [PASS] **affiche la page 404 interne pour une route inconnue du marché** — `/ci/page-inconnue` → `h1` « Page introuvable », « 404 », lien retour `href="/ci"`, chrome présent
  - **Pages de contenu (intégration — pages réelles rendues par la route)** :
  - [PASS] **rend les mentions légales depuis /ci/mentions-legales** — `h1` + 8 `h2` + `banner`
  - [PASS] **rend la politique de confidentialité depuis /bj/politique-de-confidentialite** — `h1` + 11 `h2` + retour `href="/bj"`
  - [PASS] **rend la connexion client sur /ci/login sans chrome de marché** — `h1` « Heureux de vous revoir », `data-path="/ci/login"`, aucun `banner`/`contentinfo`
  - [PASS] **propage le marché aux <Routes> imbriqués : /bj/login configure Clerk en bj** — `data-path="/bj/login"`, `data-signup="/bj/inscription"`, `data-redirect="/bj/compte"`
  - [PASS] **rend le suivi de réservation sur /ci/suivi-reservation avec le chrome** — `h1` + `banner` + lien « Se connecter » (scopé dans `main`) → `href="/ci/login"`
  - [PASS] **rend la connexion gérant sur /ci/login/gerant** — `h1` « Espace gérants », `data-path="/ci/login/gerant"`, chrome masqué
  - **Guards client / gérant (`RoleRouteGuard`)** :
  - [PASS] **redirige /ci/compte non connecté vers /ci/login** — pathname `/ci/login`, `bootstrap` non appelé
  - [PASS] **redirige /bj/compte non connecté vers /bj/login** — pathname `/bj/login` + `data-path="/bj/login"` (pas de repli silencieux sur `ci`)
  - [PASS] **ouvre l'espace client pour un client connecté et bootstrape en bj** — `page-compte` + `bootstrap({ role: 'client', market: 'BJ' })`
  - [PASS] **bascule vers l'espace gérant quand le bootstrap renvoie un autre rôle** — `gerant-layout` + `gerant-dashboard`, pathname `/ci/gerant`, `page-compte` absent
  - [PASS] **redirige /ci/gerant non connecté vers /ci/login/gerant** — pathname `/ci/login/gerant`, `bootstrap` non appelé
  - [PASS] **ouvre l'espace gérant pour un gérant connecté** — layout + dashboard + `bootstrap({ role: 'gerant', market: 'CI' })`
  - **Back-office admin (`AdminRouteGuard`)** :
  - [PASS] **rend la connexion admin racine sur /admin/login** — `h1` « Linkhoo », champ labelisé « Email », aucun `banner` de marché
  - [PASS] **redirige /admin sans token vers /admin/login** — pathname `/admin/login`, `getMe` non appelé
  - [PASS] **ouvre la console admin authentifiée sur /admin** — `admin-layout` + `admin-dashboard`, pathname `/admin` (token + `getMe` résolu)
  - [PASS] **détecte le marché sur /bj/admin et redirige vers /bj/admin/login** — pathname `/bj/admin/login` (slug marché dans la cible du guard), chrome masqué
  - **Lazy, chrome et résilience** :
  - [PASS] **affiche le fallback Suspense puis la page lazy chargée** — `findAllByText('Chargement...')` pendant un import `React.lazy` suspendu (module mocké en promesse), puis `page-chambre` après résolution, plus aucun fallback
  - [PASS] **capture l'erreur d'une page qui plante et propose de réessayer** — `CategoryPage` lève → `h1` « Une erreur est survenue » + bouton « Réessayer », `banner` disparu (ErrorBoundary à la racine de `MarketContent`)
  - [PASS] **ramène en haut de la page à chaque changement de route** — spy `window.scrollTo` : appelé au montage puis appel supplémentaire `toHaveBeenCalledWith(0, 0)` après navigation
  - [PASS] **masque le chrome sur la route d'inscription /ci/inscription** — `h1` « Votre espace client vous attend », aucun `banner`/`contentinfo`

### frontend/src/pages/LandingPage.tsx
- `frontend/src/pages/LandingPage.test.tsx` : [PASS] — 3 tests :
  - [PASS] **rend un conteneur unique occupant toute la hauteur de la fenêtre** — 1 seul enfant, déclaration inline `min-height: 100vh`
  - [PASS] **pose un fond blanc pour la page de transition** — `backgroundColor` calculée `rgb(255, 255, 255)`
  - [PASS] **n'affiche aucun contenu textuel ni lien** — aucun `heading`/`link`/`button`, `body.textContent === ''`

### frontend/src/pages/NotFoundPage.tsx
- `frontend/src/pages/NotFoundPage.test.tsx` : [PASS] — 6 tests :
  - [PASS] **affiche le code 404 et le titre de la page** — « 404 » + `h1` « Page introuvable »
  - [PASS] **explique que la page demandée n'existe pas** — phrase explicite présente
  - [PASS] **encapsule le message dans le conteneur d'erreur principal** — `role="main"` avec classe `error-page`
  - [PASS] **propose un lien de retour à l'accueil calqué sur le marché de l'URL** — marché `bj` → `href="/bj"`
  - [PASS] **navigue vers l'accueil du marché au clic sur le lien de retour** — pathname `/bj`, plus aucun « 404 »
  - [PASS] **retombe sur le marché CI quand l'URL ne porte pas de segment de marché** — `href="/ci"`

### frontend/src/pages/ClientLogin.tsx
- `frontend/src/pages/ClientLogin.test.tsx` : [PASS] — 8 tests :
  - [PASS] **affiche le titre d'accueil et le sous-titre de connexion** — `h1` « Heureux de vous revoir » + sous-titre
  - [PASS] **présente les trois bénéfices de l'espace client** — 3 `listitem` (Retrouvez votre espace / Suivez vos séjours / Partagez votre expérience)
  - [PASS] **étiquette la zone du formulaire pour les lecteurs d'écran** — `region` « Formulaire de connexion » contenant le `SignIn`
  - [PASS] **configure Clerk avec les URLs du marché courant** — `routing=path`, `path=/bj/login`, `signUpUrl=/bj/inscription`, `fallbackRedirectUrl=/bj/compte`
  - [PASS] **retombe sur le marché ci quand l'URL ne porte pas de segment de marché** — `path=/ci/login`, `redirect=/ci/compte`
  - [PASS] **redirige un utilisateur déjà connecté vers son espace compte** — pathname `/bj/compte`, `SignIn` absent
  - [PASS] **affiche le formulaire tant que Clerk n'a pas terminé son chargement** — `isLoaded=false` → formulaire rendu, pathname inchangé
  - [PASS] **signale l'absence de clé Clerk plutôt que d'afficher le formulaire** — `vi.stubEnv` + `resetModules` + import dynamique → « Clé Clerk manquante dans frontend/.env »

### frontend/src/pages/ClientReservationPage.tsx
- `frontend/src/pages/ClientReservationPage.test.tsx` : [PASS] — 9 tests :
  - [PASS] **affiche le titre et l'explication de sécurité** — `h1` « Suivi de réservation » + message de sécurité
  - [PASS] **propose un fil d'Ariane jusqu'à l'accueil du marché** — `nav[aria-label="Fil d'Ariane"]`, lien `href="/ci"`, `aria-current="page"`
  - [PASS] **invite à se connecter avec un lien vers la page de connexion du marché** — lien `href="/bj/login"` + texte d'état vide
  - [PASS] **propose de parcourir les appartements vers l'accueil du marché** — lien `href="/bj"`
  - [PASS] **navigue vers la connexion au clic sur « Se connecter »** — pathname `/bj/login`
  - [PASS] **reste sur la page quand l'utilisateur n'est pas connecté** — pathname conservé + `h1` présent
  - [PASS] **reste sur la page tant que Clerk n'a pas chargé** — `isLoaded=false && isSignedIn=true` → pas de redirection
  - [PASS] **redirige un utilisateur connecté vers son espace compte** — pathname `/bj/compte`, `h1` absent
  - [PASS] **n'affiche jamais la redirection quand la clé Clerk est absente** — `clerkConfigured=false` court-circuite la redirection même connecté

### frontend/src/pages/MentionsLegales.tsx
- `frontend/src/pages/MentionsLegales.test.tsx` : [PASS] — 8 tests :
  - [PASS] **affiche le titre de la page et sa date de mise à jour** — `h1` + « Dernière mise à jour : 9 septembre 2026 »
  - [PASS] **contient les huit sections légales dans l'ordre** — 8 `h2` listés et comparés (`1. Éditeur du site` … `8. Droit applicable`)
  - [PASS] **détaille l'éditeur et ses coordonnées** — `linkhoo.com`, directeur, email (2 occurrences) et téléphone
  - [PASS] **indique l'hébergeur du site** — `h2` « 2. Hébergeur » + « Vercel Inc. »
  - [PASS] **propose un retour à l'accueil calqué sur le marché de l'URL** — `href="/bj"` + navigation effective vers `/bj`
  - [PASS] **relie la politique de confidentialité depuis la section données personnelles** — `href="/bj/politique-de-confidentialite"`
  - [PASS] **annonce les droits RGPD et le contact pour les données personnelles** — mention RGPD + « nous contacter à l'adresse »
  - [PASS] **avertit sur les cookies techniques sans consentement de tracking** — `h2` « 5. Cookies » + phrase « Aucun cookie de tracking »

### frontend/src/pages/PolitiqueConfidentialite.tsx
- `frontend/src/pages/PolitiqueConfidentialite.test.tsx` : [PASS] — 10 tests :
  - [PASS] **affiche le titre de la page et sa date de mise à jour** — `h1` + date
  - [PASS] **contient les onze sections légales dans l'ordre** — 11 `h2` comparés (`1. Responsable du traitement` … `11. Modifications`)
  - [PASS] **détaille le responsable du traitement** — liste scoppée : « Linkhoo SAS », adresse, email, téléphone
  - [PASS] **liste les trois familles de données collectées** — liste de 3 `listitem` (identification / navigation / transaction)
  - [PASS] **précise les durées de conservation** — 3 ans / 5 ans (comptable) / 13 mois
  - [PASS] **énumère les six droits RGPD de l'utilisateur** — 6 `listitem` (accès, rectification, effacement, portabilité, opposition, limitation)
  - [PASS] **engage la responsabilité sur la sécurité des données** — `h2` « 8. Sécurité » + TLS/SSL + sauvegardes
  - [PASS] **indique comment introduire une réclamation auprès de la CNIL** — `h2` « 10. Réclamation » + `www.cnil.fr` + adresse Fontenoy
  - [PASS] **interdit la vente des données à des tiers** — « Nous ne vendons jamais vos données à des tiers. »
  - [PASS] **propose un retour à l'accueil calqué sur le marché de l'URL** — `href="/bj"` + navigation vers `/bj`

**Total : 70 tests ajoutés (26 + 3 + 6 + 8 + 9 + 8 + 10), tous PASS.**

## Vérifications (workdir `frontend/`)

- `npx vitest run src/App.test.tsx` → **1 fichier / 26 tests PASS**
- `npx vitest run src/pages/NotFoundPage.test.tsx` → **6 PASS** ; `…/LandingPage.test.tsx` → **3 PASS** ;
  `…/MentionsLegales.test.tsx` + `…/PolitiqueConfidentialite.test.tsx` + `…/LandingPage.test.tsx` → **21 PASS** ;
  `…/ClientReservationPage.test.tsx` → **9 PASS** ; `…/ClientLogin.test.tsx` → **8 PASS**
- `npm run lint` (`oxlint --deny-warnings`) → **exit 0** (dernier passage, en fin de session)
- `npx tsc -b` → **exit 0** en début de session ; **exit 2 en fin de session**, uniquement sur des fichiers qui ne
  m'appartiennent pas (voir « ÉCHECS À CORRIGER ») : **aucune erreur dans mes 7 fichiers**
- `npx vitest run` (global, exécuté **une seule fois**, à la fin) → **62 fichiers / 872 tests** dont
  **3 fichiers / 22 tests en échec, tous hors périmètre** ; **mes 7 fichiers / 70 tests : PASS**
  (baseline annoncée : 38 fichiers / 479 tests — la différence vient des vagues concurrentes en cours).

## ÉCHECS À CORRIGER

**Mon périmètre : aucun échec restant** (70/70 PASS).

Échecs observés dans la suite globale mais sur des fichiers d'**autres agents** (hors périmètre, non corrigés, listés à titre d'information) :
- `src/pages/gerant/AjouterChambre.test.tsx` → **20 échecs / 37** (fichier en cours d'écriture par une autre vague)
- `src/pages/gerant/DashboardPage.test.tsx` → **1 échec / 20** — « Unable to find an element with the text: Chambre 8 »
- `src/lib/reservations.test.ts` → **1 échec / 13** — `expected {…(19)} to deeply equal {…(17)}` (champs `dureeNombre`/`dureeUnite` ajoutés côté source non reflétés dans le test)

Erreurs `tsc -b` finales, également hors périmètre (désynchronisation types `Reservation` / `ReservationCreatePayload`
suite à l'ajout de `duree_nombre` / `duree_unite`) :
- `src/lib/api.test.ts(59,3)` : `ReservationCreatePayload` privé de `duree_nombre` / `duree_unite`
- `src/pages/gerant/ReservationsPage.test.tsx(47,3)` : `dureeNombre?: number | undefined` non assignable à `number`

Aucune de ces erreurs n'est due à mes fichiers : elles concernent `src/lib/*` et `src/pages/gerant/*`.

## Corrections pendant le TDD (échecs rencontrés puis verts, côté test uniquement)

1. **Apostrophe dans un littéral `'…l'accueil'`** → erreur de parse oxc dans `NotFoundPage.test.tsx` : littéral repris en double quotes.
2. **Route de harnais trop permissive** : `/:market` capturait `/introuvable` (marché « introuvable ») et masquait le 404 → harnais `renderNotFoundStandalone` pour le cas « pas de segment de marché ».
3. **Textes dupliqués dans le DOM** : `bonjour@linkhoo.com` (2×), `Données de navigation :` (2×), `Se connecter` (page + pied de page) → `getAllByText` / `within()` pour scoper.
4. **`100vh` calculé en `768px` par jsdom** (`LandingPage`) → assertion sur la déclaration inline plutôt que sur la valeur calculée.
5. **`useMarket must be used within MarketProvider`** (`ClientReservationPage.test.tsx`, 8 échecs) : `vi.resetModules()` +
   `import()` dynamique recrée une copie neuve de `src/contexts/MarketContext`, incompatible avec le `MarketProvider` importé statiquement.
   Correctif test : import dynamique **du page ET du MarketProvider** dans le même graphe de modules ; tests statiques sans `resetModules`.
6. **Erreur de syntaxe `}));`** dans une factory `vi.mock(async () => {…})` de `App.test.tsx` → corrigée en `});`.
7. **`getByRole('link', { name: 'Se connecter' })` ambigu** dans le test d'intégration `/ci/suivi-reservation` (le Footer a le même lien) → `within(screen.getByRole('main'))`.

## Observations / points d'attention

1. **`clerkConfigured` est une constante lue au chargement du module** (`ClientLogin`, `ClientReservationPage`, `RegisterRolePage`, `RoleRouteGuard`, `GerantLogin`, `ClientNotificationBanner`). Tester la branche « clé absente » impose `vi.stubEnv('VITE_CLERK_PUBLISHABLE_KEY', '')` + `vi.resetModules()` + `import()` dynamique — et, si le module importe `useHomePath`, **il faut aussi réimporter dynamiquement `MarketProvider`**, sinon les deux instances du contexte ne dialoguent pas (erreur « must be used within MarketProvider »).
2. **Les paramètres parents se propagent bien dans les `<Routes>` imbriqués** (react-router 7 : `params: Object.assign({}, parentParams, match.params)` dans `useRoutesImpl`). Vérifié empiriquement : sur `/bj/login`, `ClientLogin` (qui lit `useParams().market`) reçoit bien `bj` → `data-path="/bj/login"`. Le commentaire suggérant le contraire dans `GerantLogin` concerne donc un cas non reproductible ici ; les guards (`RoleRouteGuard`) ciblent bien `/bj/login`, pas un repli `/ci/login`.
3. **Fallback 404 racine** : la route racine `<Route path="*" element={<CatchAllRedirect />} />` semble **inatteignable** — toute URL non racine tombe sur `/:market/*` (le splat correspond aussi à zéro segment) ou sur `/admin*`. Le 404 « utile » est bien celui déclaré dans `MarketContent` (`path="*"` → `NotFoundPage`), testé par `/ci/page-inconnue`. Observation de lisibilité, pas un bug de comportement.
4. **Pièges jsdom** (stubs posés dans `vi.hoisted()`, avant les `vi.mock`) : `IntersectionObserver`, `window.matchMedia` (lu au chargement de `BannerCarousel`, donc importé par toutes les sections de la home), `Element.prototype.scrollIntoView`, `Element.prototype.scrollTo`, et `window.scrollTo` **remplacé par un spy** pour vérifier `ScrollToTop` de `App.tsx`.
5. **Aucune dépendance réseau** : `./lib/api` (mock partiel + `Proxy` auto-mock pour `apiBanners`/`apiEvents`/…), `./lib/adminApi`, `./lib/notifications`, `@clerk/clerk-react`, et `./data/{rooms,categories,banners,events}` mockés **partiellement via `importOriginal`** pour conserver les helpers purs (`formatEventDate`, `groupEventsByCity`, `shiftIsoDate`) tout en supprimant les `fetch*`.
6. **Pages rendues réellement** (intégration) : `LandingPage`, `NotFoundPage`, `MentionsLegales`, `PolitiqueConfidentialite`, `ClientLogin`, `ClientReservationPage`, plus `GerantLogin`, `AdminLogin`, `RegisterRolePage` sur leurs routes. **Pages remplacées par des doubles légers** (coût/risque trop élevés : back-office, Leaflet, données) : `ClientComptePage`, `gerant/AdminLayout` + `gerant/DashboardPage`, `admin/SuperAdminLayout` + `admin/AdminDashboardPage` — les layouts stubs rendent un `<Outlet />` pour que les enfants de route s'affichent. `RoomDetailPage` est mocké en **promesse non résolue** (observation du fallback Suspense) et `CategoryPage` en **composant qui lève** (observation de l'`ErrorBoundary`).
7. **`React.lazy` sous test** : toujours `findBy*`/`findAllBy*` jamais d'assertion synchrone sur le premier rendu ; le fallback `RouteFallback` (« Chargement... ») existe aux niveaux racine et marché, d'où `findAllByText`.
8. **Le test `ErrorBoundary` silencie `console.error`** via `vi.spyOn(...).mockImplementation(() => {})` + `mockRestore()` explicite : React journalise le crash, sinon la sortie est polluée.
9. **Chrome (`Header`/`Footer`) masqué par `hideChrome`** : `/login`, `/inscription`, `/gerant`, `/admin`, `/sso-callback` → testé sur `/ci/login`, `/ci/login/gerant`, `/ci/inscription`, `/bj/admin/login` (rôle `banner`/`contentinfo` absents) et à l'inverse affiché sur `/ci`, `/ci/page-inconnue`, `/ci/mentions-legales`, `/ci/suivi-reservation`.
10. **Couverture** : les pages restent exclues de `coverage.include` dans `vite.config.ts` (choix assumé du projet) — je n'ai modifié aucune config ; ces 70 tests valident le comportement sans peser sur le % de couverture.
11. **Vague concurrente** : d'autres agents écrivent en parallèle (`src/pages/gerant/*`, `src/lib/*`). Les 22 échecs de la suite globale et les 2 erreurs `tsc -b` finales sont tous dans leurs fichiers ; ils peuvent disparaître (ou évoluer) après ma session. `npm run lint` est resté à **exit 0** à chaque passage.

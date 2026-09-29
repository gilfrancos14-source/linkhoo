# TEST_REPORT F3 — Composants B

**Périmètre** : 8 composants de `frontend/src/components/` — un fichier `*.test.tsx` par composant.
**Bilan** : **80 tests ajoutés / 80 PASS / 0 échec** dans ma cible.
**Vérifications** : `npx vitest run src/components` (mes 8 fichiers : 8 files / 80 tests verts),
`npm run lint` et `npx tsc -b` : **0 erreur imputable à mes fichiers** (toutes les erreurs restantes
pointent `Header.test.tsx`, fichier d'un autre agent — voir « Observations »).

## Tests ajoutés

### CardSkeleton
- `frontend/src/components/CardSkeleton.test.tsx` : [PASS] rend 4 cartes fantômes par défaut — compte `.card-skeleton` avec la valeur par défaut de `count`
- `frontend/src/components/CardSkeleton.test.tsx` : [PASS] respecte la prop count — 1 puis 7 cartes après rerender
- `frontend/src/components/CardSkeleton.test.tsx` : [PASS] masque les cartes fantômes des technologies d'assistance — `aria-hidden="true"` sur chaque skeleton
- `frontend/src/components/CardSkeleton.test.tsx` : [PASS] affiche la structure média / corps / lignes de chaque carte — `.card-skeleton__media`, 2 lignes (72 % / 46 %, variante `--sm`)
- `frontend/src/components/CardSkeleton.test.tsx` : [PASS] ne rend rien quand count vaut 0 — cas limite du compteur

### Pagination
- `frontend/src/components/Pagination.test.tsx` : [PASS] ne rend rien avec une seule page — `totalPages <= 1` → `null`
- `frontend/src/components/Pagination.test.tsx` : [PASS] ne rend rien avec zéro page — cas limite `totalPages = 0`
- `frontend/src/components/Pagination.test.tsx` : [PASS] expose la navigation « Pagination » avec tous les numéros de pages — `nav` aria-label + 7 boutons (Préc + 5 pages + Suiv)
- `frontend/src/components/Pagination.test.tsx` : [PASS] marque la page courante avec la classe is-active — page 3 active, page 4 non active
- `frontend/src/components/Pagination.test.tsx` : [PASS] désactive « Préc » sur la première page et « Suiv » sur la dernière — bornes 1 et `totalPages`
- `frontend/src/components/Pagination.test.tsx` : [PASS] avance la page courante au clic sur « Suiv » — harness d'état réel : page 2 devient active
- `frontend/src/components/Pagination.test.tsx` : [PASS] revient à la page précédente au clic sur « Préc » — depuis la page 3 → page 2
- `frontend/src/components/Pagination.test.tsx` : [PASS] va directement à la page cliquée — clic sur « 4 » → page 4 active
- `frontend/src/components/Pagination.test.tsx` : [PASS] appelle onPageChange avec le numéro de page ciblé — Suiv→3, Préc→1, « 5 »→5
- `frontend/src/components/Pagination.test.tsx` : [PASS] n'appelle pas onPageChange quand le bouton est désactivé — Préc en page 1, Suiv en dernière page
- `frontend/src/components/Pagination.test.tsx` : [PASS] applique la prop className aux boutons — classes `pager__btn` / `pager__btn is-active`

### PropertyMap (mock `react-leaflet` via `vi.mock`)
- `frontend/src/components/PropertyMap.test.tsx` : [PASS] centre la carte sur les coordonnées fournies avec le zoom par défaut — `MapContainer` reçoit center/zoom (17)
- `frontend/src/components/PropertyMap.test.tsx` : [PASS] respecte les props height et zoom — div `.property-map` hauteur 300 px + zoom 12
- `frontend/src/components/PropertyMap.test.tsx` : [PASS] est non interactif par défaut — `dragging=false` (et dérivés scrollWheel/keyboard…)
- `frontend/src/components/PropertyMap.test.tsx` : [PASS] active les interactions quand interactive vaut true — `dragging=true`
- `frontend/src/components/PropertyMap.test.tsx` : [PASS] affiche un marqueur positionné par défaut — `Marker position=[lat,lng]`
- `frontend/src/components/PropertyMap.test.tsx` : [PASS] n'affiche aucun marqueur avec showMarker=false — branchement conditionnel
- `frontend/src/components/PropertyMap.test.tsx` : [PASS] affiche le lien Google Maps (mapsUrl fourni) quand la carte est interactive — Popup + lien `target=_blank`/`rel=noopener`
- `frontend/src/components/PropertyMap.test.tsx` : [PASS] construit l'URL Google Maps par défaut sans mapsUrl — `https://www.google.com/maps?q=5.324,-4.012`
- `frontend/src/components/PropertyMap.test.tsx` : [PASS] n'affiche pas de popup quand la carte est non interactive — pas de Popup ni de lien
- `frontend/src/components/PropertyMap.test.tsx` : [PASS] rend les deux couches de fond (Plan puis Satellite) — 2 `BaseLayer`, URLs OSM et Esri vérifiées
- `frontend/src/components/PropertyMap.test.tsx` : [PASS] transmet les clics de carte à onMapClick et recenter la vue — `eventHandlers.click({latlng})` → callback(6.15, 1.23) ; `Recenter` appelle `setView`
- `frontend/src/components/PropertyMap.test.tsx` : [PASS] n'installe aucun gestionnaire de clic sans onMapClick — pas d'eventHandlers, pas de `setView`

### BackToTop
- `frontend/src/components/BackToTop.test.tsx` : [PASS] reste masqué en haut de page — scroll event avec `scrollY = 0` → aucun bouton
- `frontend/src/components/BackToTop.test.tsx` : [PASS] reste masqué à la limite exacte de 500 px — seuil strict `> 500` (frontière testée)
- `frontend/src/components/BackToTop.test.tsx` : [PASS] apparaît dès que le scroll dépasse 500 px — `scrollY = 501` → bouton aria-label « Retour en haut de page »
- `frontend/src/components/BackToTop.test.tsx` : [PASS] disparaît à nouveau quand on remonte sous le seuil — 800 → 200 : bouton retiré du DOM
- `frontend/src/components/BackToTop.test.tsx` : [PASS] défile en douceur jusqu'en haut au clic — `window.scrollTo({top:0, behavior:'smooth'})` (spy)
- `frontend/src/components/BackToTop.test.tsx` : [PASS] retire son écouteur de scroll au démontage — `removeEventListener('scroll', …)` au `unmount`

### SplitAuthLayout
- `frontend/src/components/SplitAuthLayout.test.tsx` : [PASS] affiche le titre et le sous-titre dans le panneau info — `h1` + paragraphe
- `frontend/src/components/SplitAuthLayout.test.tsx` : [PASS] étiquette le côté formulaire avec la prop formLabel — `section` = région aria portant le `formLabel`, children dedans
- `frontend/src/components/SplitAuthLayout.test.tsx` : [PASS] rend les children dans la zone de formulaire — `.register-page__form`
- `frontend/src/components/SplitAuthLayout.test.tsx` : [PASS] liste chaque bénéfice avec son titre et son texte — liste balisée, 3 items, titres + textes
- `frontend/src/components/SplitAuthLayout.test.tsx` : [PASS] masque les icônes de bénéfices aux technologies d'assistance — spans `aria-hidden` contenant un svg
- `frontend/src/components/SplitAuthLayout.test.tsx` : [PASS] n'affiche aucune liste de bénéfices sans la prop — `benefits` absent → pas de `list`
- `frontend/src/components/SplitAuthLayout.test.tsx` : [PASS] n'affiche aucune liste de bénéfices pour un tableau vide — `benefits=[]` → pas de `list`
- `frontend/src/components/SplitAuthLayout.test.tsx` : [PASS] honorise une icône de bénéfice de type 'user' — rendu de l'icône demandée
- `frontend/src/components/SplitAuthLayout.test.tsx` : [PASS] exporte l'apparence Clerk utilisée par les pages de connexion — `clerkFormAppearance` (variables + éléments)
- `frontend/src/components/SplitAuthLayout.test.tsx` : [PASS] reste utilisable avec un formulaire interactif en enfant — saisie clavier dans un champ des children

### AdminGerantDrawer
- `frontend/src/components/AdminGerantDrawer.test.tsx` : [PASS] affiche l'en-tête du gérant avec ses badges de marché et de statut — prénom/nom, e-mail, badge « CI », badge « En attente »
- `frontend/src/components/AdminGerantDrawer.test.tsx` : [PASS] affiche « Chargement... » puis charge les documents du gérant — état loading puis résolution différée ; `getVerificationDocuments('g-1')`
- `frontend/src/components/AdminGerantDrawer.test.tsx` : [PASS] affiche « Aucun document soumis. » quand la liste est vide — état vide géré
- `frontend/src/components/AdminGerantDrawer.test.tsx` : [PASS] affiche une erreur quand le chargement des documents échoue — message « Erreur lors du chargement des documents », loading terminé
- `frontend/src/components/AdminGerantDrawer.test.tsx` : [PASS] ferme via la croix de l'en-tête (après l'animation de 300 ms) — `onClose` appelé (timeout 300 ms du source), `onUpdated` non appelé
- `frontend/src/components/AdminGerantDrawer.test.tsx` : [PASS] ferme via le clic sur l'overlay — fermeture par la zone d'ombre
- `frontend/src/components/AdminGerantDrawer.test.tsx` : [PASS] « Commencer la révision » appelle l'API et notifie onUpdated — `startGerantReview('g-1')` + callback avec statut `under_review`
- `frontend/src/components/AdminGerantDrawer.test.tsx` : [PASS] désactive « Approuver » tant que les documents ne sont pas tous approuvés — `disabled` + `title` explicatif
- `frontend/src/components/AdminGerantDrawer.test.tsx` : [PASS] approuve chaque document puis valide la demande complète — workflow complet : 2 `reviewDocument(..., 'approved')` → bouton actif → `approveGerantVerification` → `onUpdated` + `onClose`
- `frontend/src/components/AdminGerantDrawer.test.tsx` : [PASS] rejette un document individuellement avec un motif — confirm désactivé vide → `reviewDocument('d-front','rejected',motif)` → badge « Rejeté »
- `frontend/src/components/AdminGerantDrawer.test.tsx` : [PASS] annule la saisie du motif de rejet d'un document — « Annuler » referme sans appel API, boutons réapparaissent
- `frontend/src/components/AdminGerantDrawer.test.tsx` : [PASS] rejette la demande globalement avec un motif — champ footer, confirm désactivé puis `rejectGerantVerification('g-1', motif)` → `onUpdated` + `onClose`
- `frontend/src/components/AdminGerantDrawer.test.tsx` : [PASS] signale l'adresse absente et bloque la validation — badge « Absente », texte explicatif, pas de carte, `title='Adresse Google Maps manquante'`
- `frontend/src/components/AdminGerantDrawer.test.tsx` : [PASS] affiche la carte, les coordonnées et le lien Google Maps quand l'adresse est fournie — carte mockée, coordonnées `toFixed(5)`, lien cible/href
- `frontend/src/components/AdminGerantDrawer.test.tsx` : [PASS] n'affiche aucune action en pied de drawer hors statut pending / under_review — pas de révision/approbation/rejet, croix toujours présente
- `frontend/src/components/AdminGerantDrawer.test.tsx` : [PASS] affiche l'erreur renvoyée par l'API lors de la validation d'un document — message d'erreur du rejet `reviewDocument`

### ClientNotificationBanner
- `frontend/src/components/ClientNotificationBanner.test.tsx` : [PASS] ne rend rien tant que Clerk n'a pas chargé — `isLoaded=false` → rendu vide, aucun fetch
- `frontend/src/components/ClientNotificationBanner.test.tsx` : [PASS] ne rend rien pour un utilisateur déconnecté — `isSignedIn=false` → ni fetch ni getter de jeton
- `frontend/src/components/ClientNotificationBanner.test.tsx` : [PASS] ne rend rien quand aucune notification n'est non lue — filtre `read` + rendu vide après chargement
- `frontend/src/components/ClientNotificationBanner.test.tsx` : [PASS] affiche une notification non lue (titre, message, bouton Fermer) — notification lue ignorée
- `frontend/src/components/ClientNotificationBanner.test.tsx` : [PASS] affiche le titre d'erreur pour une réservation rejetée — variante `client-notif--error` + « Réservation non disponible »
- `frontend/src/components/ClientNotificationBanner.test.tsx` : [PASS] utilise la variante success pour une confirmation — classe `client-notif--success`
- `frontend/src/components/ClientNotificationBanner.test.tsx` : [PASS] enregistre le getter de jeton Clerk avant le chargement — `setAuthTokenGetter` appelé une fois, getter résout `session-token`
- `frontend/src/components/ClientNotificationBanner.test.tsx` : [PASS] marque la notification comme lue au clic sur « Fermer » et la masque — `markClientNotificationAsRead('notif-1')` + disparition locale
- `frontend/src/components/ClientNotificationBanner.test.tsx` : [PASS] ferme localement même quand l'API de lecture échoue — fermeture résiliente, pas d'alerte
- `frontend/src/components/ClientNotificationBanner.test.tsx` : [PASS] ne plante pas quand le premier chargement échoue — erreur avalée (polling de secours), rendu vide
- `frontend/src/components/ClientNotificationBanner.test.tsx` : [PASS] recharge les notifications toutes les 30 secondes — timers fictifs : appel initial + 1 rechargement après 30 000 ms

### MarketSelector
- `frontend/src/components/MarketSelector.test.tsx` : [PASS] affiche le code du marché courant et annonce la liste — libellé « CI », `aria-haspopup=listbox`, `aria-expanded=false`, URL /ci
- `frontend/src/components/MarketSelector.test.tsx` : [PASS] ouvre la liste des marchés au clic sur le déclencheur — listbox, 2 options, `aria-selected` sur le marché actif
- `frontend/src/components/MarketSelector.test.tsx` : [PASS] bascule vers le marché Bénin : URL, libellé et fermeture — navigation → /bj (marché dérivé de l'URL), libellé « BJ », dropdown fermé
- `frontend/src/components/MarketSelector.test.tsx` : [PASS] bascule vers le marché Côte d'Ivoire depuis /bj — navigation /bj → /ci
- `frontend/src/components/MarketSelector.test.tsx` : [PASS] referme la liste sans naviguer quand on clique le marché déjà actif — chemin /ci inchangé
- `frontend/src/components/MarketSelector.test.tsx` : [PASS] referme la liste avec la touche Échap — gestionnaire `keydown` du composant
- `frontend/src/components/MarketSelector.test.tsx` : [PASS] referme la liste quand on clique à l'extérieur — gestionnaire `mousedown` « outside »
- `frontend/src/components/MarketSelector.test.tsx` : [PASS] ne referme pas la liste sur un mousedown à l'intérieur du sélecteur — garde `ref.contains(target)`
- `frontend/src/components/MarketSelector.test.tsx` : [PASS] referme la liste sur un mousedown extérieur même sans clic complet — fermeture sur `mousedown` seul

## ÉCHECS À CORRIGER
- Aucun — les 80 tests des 8 fichiers F3 sont verts, aucune modification source n'a été nécessaire, aucun bug source détecté dans ces composants.

## Observations / points d'attention

- **Fichiers créés (8)** — uniquement des `*.test.tsx`, aucune source, config ni `setup.ts` touché :
  1. `frontend/src/components/MarketSelector.test.tsx` (9 tests)
  2. `frontend/src/components/Pagination.test.tsx` (11 tests)
  3. `frontend/src/components/PropertyMap.test.tsx` (12 tests)
  4. `frontend/src/components/BackToTop.test.tsx` (6 tests)
  5. `frontend/src/components/CardSkeleton.test.tsx` (5 tests)
  6. `frontend/src/components/SplitAuthLayout.test.tsx` (10 tests)
  7. `frontend/src/components/AdminGerantDrawer.test.tsx` (16 tests)
  8. `frontend/src/components/ClientNotificationBanner.test.tsx` (11 tests)

- **État de `npx vitest run src/components` (vague complète, fichiers des autres agents inclus)** :
  23 fichiers / 214 tests, 213 verts. Les 2 fichiers rouges sont **hors périmètre F3** :
  - `src/components/Header.test.tsx` :: suite en échec — erreur de transformation oxc « Unterminated string literal » ligne 86 (`'Lien — retour à l'accueil'` : apostrophe ASCII dans une chaîne délimitée par des `'`) — autre agent.
  - `src/components/ReviewsSection.test.tsx` :: `affiche le commentaire, l'auteur et la notation de chaque avis` — assertion en échec sur le contenu des avis — autre agent.

- **Lint / tsc** : `npm run lint` et `npx tsc -b` ne signalent **que** `Header.test.tsx` (7 erreurs tsc + 1 lint, toutes situées dans ce fichier). Vérifié par filtrage : **0 erreur ailleurs** — mes 8 fichiers sont propres (l'arbre était vert lint+tsc juste avant l'apparition de `Header.test.tsx`).

- **Techniques de mocking retenues (toutes dans les fichiers de test)** :
  - `PropertyMap` : `vi.mock('react-leaflet', …)` avec composants DOM (MapContainer/TileLayer/Marker/Popup/LayersControl.BaseLayer/useMap) + `vi.hoisted` pour capter `eventHandlers` et `setView`. Le JSX dans la factory `vi.mock` fonctionne sous Vitest 5 + Vite/oxc.
  - `AdminGerantDrawer` : mock de `../lib/adminApi` et surtout mock de `./PropertyMap` pour éviter la charge de `leaflet`/CSS/images dans ce test.
  - `ClientNotificationBanner` : `clerkConfigured` est calculé **au chargement du module** depuis `import.meta.env` → nécessite `vi.stubEnv('VITE_CLERK_PUBLISHABLE_KEY', 'pk_…')` + `vi.resetModules()` + `import()` dynamique par test (même motif que `RoleRouteGuard.test.tsx`).
  - `MarketSelector` : rendu sous `MemoryRouter` + `MarketProvider` avec sonde `useLocation` pour vérifier la navigation (le marché EST l'URL).
  - `BackToTop` : `window.scrollY` forcé par `Object.defineProperty` (jsdom ne défile pas) et `window.scrollTo` espionné via `vi.spyOn`.

- **Points d'attention sur le comportement source (non bloquants, comportements couverts par les tests)** :
  - `BackToTop` ne vérifie la position **qu'au premier événement scroll** : si la page est rechargée avec un scroll restauré > 500 px, le bouton n'apparaît qu'au prochain scroll. Testé tel quel (seuil strict `> 500`, frontière exacte à 500 exclue).
  - `AdminGerantDrawer.handleClose` ferme `onClose` avec un délai fixe de 300 ms (animation) → les tests utilisent `waitFor` timeout 2000 ms ; le drawer passe par `requestAnimationFrame` pour `pointer-events: auto`, les tests attendent cet état avant tout clic `user-event` (sinon `pointer-events: none` bloquerait l'interaction).
  - `ClientNotificationBanner` avale toutes les erreurs de fetch (volontaire, polling de secours) : vérifié qu'aucune alerte n'est affichée.
  - Aucun des 8 composants ne nécessite de modifier le source pour être testable.

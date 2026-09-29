# TEST_REPORT P1 — Espace gérant : AdminLayout, AjouterChambre, VerificationPage

Périmètre : `frontend/src/pages/gerant/{AdminLayout,AjouterChambre,VerificationPage}.tsx`.
Aucun fichier source, config (`vite.config.ts`, `tsconfig*`, `package.json`) ni `src/test/setup.ts` n'a été modifié : uniquement 3 fichiers `*.test.tsx` colocalisés créés (aucun `.test` d'un autre agent touché).

## Tests ajoutés

### frontend/src/pages/gerant/AdminLayout.tsx
- `frontend/src/pages/gerant/AdminLayout.test.tsx` : [PASS] — 41 tests :
  - [PASS] structure de la barre latérale affiche les groupes de navigation Général, Gestion et Abonnement — `h2` de `aside.sidebar`
  - [PASS] structure de la barre latérale propose les liens Aperçu et Chambres vers les bonnes routes du marché — `<Routes>` réels + `MemoryRouter` sur `/ci/gerant/...`
  - [PASS] structure de la barre latérale présente Vérification, Profil et Premium dans les groupes de gestion
  - [PASS] structure de la barre latérale masque le lien Réservations tant que le gérant n'est pas qualifié — `useEspace` mocké (`isVerified=false`)
  - [PASS] structure de la barre latérale affiche Réservations pour un gérant vérifié et premium
  - [PASS] structure de la barre latérale masque Réservations quand le premium est expiré — `premiumExpiresAt` dans le passé
  - [PASS] structure de la barre latérale affiche le nombre de chambres du gérant en pastille — pastille `0` toujours rendue
  - [PASS] structure de la barre latérale rend le contenu de la route enfant dans la zone principale — `<Outlet />` + route `*`
  - [PASS] structure de la barre latérale propose un lien « Retour au site » vers l'accueil du marché — `useHomePath` mocké
  - [PASS] etat de la barre latérale démarre dépliée puis se réduit au clic sur « Réduire le menu » — classes `sidebar--collapsed`
  - [PASS] etat de la barre latérale restaure l'état réduit mémorisé dans localStorage au montage — `localStorage` pré-rempli avant render
  - [PASS] etat de la barre latérale persiste l'état courant dans localStorage — écriture après toggle
  - [PASS] menu mobile ouvre le menu au clic sur « Ouvrir le menu » — `aria-expanded`, `.mobile-sidebar.is-open`
  - [PASS] menu mobile referme le menu en cliquant sur le fond noir
  - [PASS] menu mobile referme le menu avec le bouton « Fermer le menu »
  - [PASS] menu mobile referme automatiquement le menu quand la route change — navigation `act()` + `useLocation`
  - [PASS] notifications affiche le compteur d'unread sur la cloche — `apiNotifications.list` mocké
  - [PASS] notifications n'affiche aucun compteur quand tout est lu
  - [PASS] notifications ouvre le panneau et affiche l'état vide quand il n'y a aucune notification — panneau non `aria-hidden` après clic
  - [PASS] notifications détaille chaque notification avec son message et son ancienneté — `timeAgo`
  - [PASS] notifications formate les anciennetés en minutes, heures et jours — horloges figées par mock de `Date`
  - [PASS] notifications marque la notification comme lue au clic et recharge la liste — `markRead` puis re-listing
  - [PASS] notifications marque toutes les notifications d'un coup — `markAll`
  - [PASS] notifications referme le panneau quand on clique en dehors — listener `mousedown` sur `document`
  - [PASS] notifications referme le panneau quand on navigue
  - [PASS] notifications interroge les notifications toutes les 30 secondes — `vi.useFakeTimers({ toFake: ['setInterval','clearInterval'] })`, `vi.useRealTimers()` en `afterEach`
  - [PASS] vérification d'une réservation depuis la cloche ne propose pas « Vérifier » à un gérant non qualifié
  - [PASS] vérification d'une réservation depuis la cloche affiche l'état de chargement puis le résultat « Disponible » — `apiReservations` en attente puis résolue
  - [PASS] vérification d'une réservation depuis la cloche annonce « Non disponible » quand les dates se chevauchent
  - [PASS] vérification d'une réservation depuis la cloche annonce « Non disponible » quand la réservation est introuvable
  - [PASS] vérification d'une réservation depuis la cloche retombe sur « Non disponible » quand l'API de réservation échoue — défense en profondeur
  - [PASS] vérification d'une réservation depuis la cloche confirme la réservation et notifie le client — `confirmReservation` + `createClientNotification`
  - [PASS] vérification d'une réservation depuis la cloche refuse la réservation et notifie le client du refus
  - [PASS] vérification d'une réservation depuis la cloche ferme la modale via « Annuler » sans toucher à la réservation — aucune mutation
  - [PASS] vérification d'une réservation depuis la cloche ferme la modale en cliquant sur le fond
  - [PASS] identité et déconnexion affiche le prénom du gérant avec ses badges vérifié et premium
  - [PASS] identité et déconnexion n'affiche aucun badge pour un gérant ni vérifié ni premium
  - [PASS] identité et déconnexion retombe sur le prénom Clerk quand le gérant n'en a pas — `useUser().firstName`
  - [PASS] identité et déconnexion déconnecte vers la page de connexion du marché courant — `clerkConfigured = true` (`VITE_CLERK_PUBLISHABLE_KEY` présent) → `signOut({ redirectUrl: '/ci/login' })`
  - [PASS] identité et déconnexion construit l'URL de déconnexion depuis le marché BJ — segment d'URL `bj`
  - [PASS] identité et déconnexion retombe sur la page d'accueil du marché sans clé Clerk — `vi.stubEnv` + `vi.resetModules()` + import dynamique (`clerkConfigured = false`)

### frontend/src/pages/gerant/AjouterChambre.tsx
- `frontend/src/pages/gerant/AjouterChambre.test.tsx` : [PASS] — 37 tests :
  - [PASS] en-tête, étapes et navigation présente le titre, l'intro et le bouton de retour à la liste
  - [PASS] en-tête, étapes et navigation mène à la liste des chambres au clic sur « ← Retour » — sonde `useLocation` sur `/ci/gerant/chambres`
  - [PASS] en-tête, étapes et navigation affiche les quatre étapes avec Identification active au départ — `.step--active`
  - [PASS] en-tête, étapes et navigation marque les étapes franchies comme terminées — `.step--done`
  - [PASS] étape 1 — identification bloque l'avancée tant que les cinq champs requis sont vides — 5 messages `field-error`
  - [PASS] étape 1 — identification ne signale que les champs réellement vides
  - [PASS] étape 1 — identification efface l'erreur d'un champ dès la première saisie — `errors` purgés à la saisie
  - [PASS] étape 1 — identification passe à l'étape Détails quand tout est renseigné — catégories attendues (`findByRole('option')`) avant saisie
  - [PASS] étape 1 — identification propose les catégories du marché dans le sélecteur — `fetchCategoriesByMarket('CI')`
  - [PASS] étape 1 — identification propose les suggestions de ville du marché dans la liste guidée — `<datalist id="gerant-room-city-options">`
  - [PASS] étape 1 — identification interroge catégories et villes du marché BJ sur une URL /bj
  - [PASS] étape 2 — détails exige un prix strictement supérieur à zéro
  - [PASS] étape 2 — détails exige les conditions de réservation — prix saisi, conditions vides
  - [PASS] étape 2 — détails passe à l'étape Photos avec un prix et des conditions valides
  - [PASS] étape 2 — détails revient à l'étape Identification en conservant les valeurs saisies — 2 clics « Étape précédente »
  - [PASS] étape 2 — détails bascule l'unité de prix entre par mois et par nuit — requiert `querySelectorAll('input[name="priceUnit"]')` (voir observation 3)
  - [PASS] étape 2 — détails mémorise le nombre de chambres, de douches et le marquage populaire — `toHaveValue(1)` en nombre (voir observation 4)
  - [PASS] étape 3 — photos refuse d'aller à l'aperçu sans aucune photo — erreur `photos`
  - [PASS] étape 3 — photos ajoute une photo et la marque comme principale — `URL.createObjectURL` stubbé en `vi.hoisted()`
  - [PASS] étape 3 — photos refuse un fichier plus lourd que 2 Mo — `File` avec `size` redéfini
  - [PASS] étape 3 — photos accueille plusieurs photos et transfère le badge de principale — classe `photo-card--main`
  - [PASS] étape 3 — photos supprime une photo et réattribue la principale — `revokeObjectURL`
  - [PASS] étape 3 — photos vérifie le récapitulatif du bandeau d'étapes avant l'aperçu
  - [PASS] étape 4 — aperçu et enregistrement affiche le récapitulatif de l'annonce vu par le client
  - [PASS] étape 4 — aperçu et enregistrement découpe les conditions en liste à puces
  - [PASS] étape 4 — aperçu et enregistrement navigue dans la galerie de photos avec les flèches et les miniatures — `.preview-arrow--next/prev`
  - [PASS] étape 4 — aperçu et enregistrement enregistre la chambre en téléversant chaque photo — `apiUpload.upload` puis `createRoom({ images, img })`
  - [PASS] étape 4 — aperçu et enregistrement prend la photo choisie comme principale pour l'image de couverture — bouton « Définir comme principale » cliqué **avant** l'aperçu
  - [PASS] étape 4 — aperçu et enregistrement transmet le marquage populaire et l'unité de prix saisis — radio/checkbox saisis à l'étape 2
  - [PASS] étape 4 — aperçu et enregistrement publie sur le marché BJ avec le pays correspondant — `{ market: 'BJ', pays: 'Bénin' }`
  - [PASS] étape 4 — aperçu et enregistrement affiche l'état « Enregistrement... » et verrouille les boutons — promesse suspendue
  - [PASS] étape 4 — aperçu et enregistrement remonte le message d'erreur du service — `Error('Tarif refusé')`
  - [PASS] étape 4 — aperçu et enregistrement affiche un message générique quand l'erreur n'est pas une Error — rejet `string`
  - [PASS] étape 4 — aperçu et enregistrement reste bloqué sur l'étape Photos tant qu'aucune photo n'est ajoutée — validation `validateStep3`
  - [PASS] écran de succès confirme l'ajout avec le titre de l'annonce — `heading level 2`
  - [PASS] écran de succès « Ajouter un autre » réinitialise entièrement le formulaire — formulaire vide + étape 1
  - [PASS] écran de succès « Retour à la liste » ramène au catalogue des chambres — route `<Route path="/:market/gerant/chambres">`

### frontend/src/pages/gerant/VerificationPage.tsx
- `frontend/src/pages/gerant/VerificationPage.test.tsx` : [PASS] — 50 tests :
  - [PASS] chargement affiche l'état de chargement tant que le profil n'est pas résolu — `getMe` suspendu
  - [PASS] chargement n'interroge pas le profil sans userId Clerk — `useAuth().userId = null`
  - [PASS] chargement rend le formulaire même si le chargement du profil échoue — branche `catch` de `loadData`
  - [PASS] chargement affiche le libellé du marché CI déduit de l'URL — `MarketProvider` + `MemoryRouter`
  - [PASS] chargement affiche le libellé du marché BJ déduit de l'URL
  - [PASS] chargement présente le panneau Documents requis avec ses frais — `.verif-fee` = « 2 000 XOF »
  - [PASS] états de vérification affiche le compte vérifié sans proposer le formulaire — `status === 'approved'` → `showForm = false`
  - [PASS] états de vérification affiche l'état « Demande en cours » pour un dossier pending
  - [PASS] états de vérification précise qu'un administrateur examine le dossier en under_review
  - [PASS] états de vérification affiche la date de soumission du dossier — `toLocaleDateString('fr-FR')`
  - [PASS] états de vérification masque la date de soumission quand elle est absente
  - [PASS] états de vérification affiche la raison de rejet du dossier — et rouvre le formulaire
  - [PASS] états de vérification affiche une raison de rejet par défaut quand aucune raison n'est fournie
  - [PASS] documents et étapes présente les deux faces de la carte avec leurs consignes
  - [PASS] documents et étapes numérote les trois éléments du dossier — `.verif-doc__num` = `01/02/03`
  - [PASS] documents et étapes garde l'étape 1 active tant que le dossier n'est pas complet
  - [PASS] documents et étapes passe l'étape 1 pour terminée quand documents et adresse sont présents — `isReady`
  - [PASS] documents et étapes affiche le document déjà déposé avec son statut — `img` + badge « En attente »
  - [PASS] documents et étapes masque le bouton Remplacer pour un document approuvé
  - [PASS] documents et étapes affiche la raison de rejet d'un document — `Raison : …`
  - [PASS] documents et étapes affiche le nom de fichier pour un document non image — `mime_type` hors `image/*`
  - [PASS] sélection des fichiers affiche l'aperçu local et les actions d'envoi après sélection — `createObjectURL` compté
  - [PASS] sélection des fichiers retire le fichier sélectionné et révoque son aperçu — `revokeObjectURL('blob:verif-1')`
  - [PASS] sélection des fichiers accepte un fichier déposé par glisser-déposer — `fireEvent.drop` + `dataTransfer.files`
  - [PASS] sélection des fichiers refuse un fichier déposé qui n'est pas une image — garde `file.type.startsWith('image/')`
  - [PASS] sélection des fichiers surligne la zone de dépôt au survol — classe `verif-drop--dragover`
  - [PASS] envoi et suppression enregistre le document auprès du service puis le persiste — `apiUpload.upload(file,'verification-docs')` puis `POST /gerants/:id/documents` (corps JSON asserté)
  - [PASS] envoi et suppression verrouille le bouton pendant l'envoi — « Envoi... » désactivé, `request` non appelé
  - [PASS] envoi et suppression affiche l'erreur remontée par le service d'upload — `state.error`
  - [PASS] envoi et suppression affiche l'erreur remontée à la persistance du document
  - [PASS] envoi et suppression remplace le document déjà déposé — `deleteDocument('gerant-1','doc-1')`
  - [PASS] envoi et suppression affiche l'erreur si la suppression du document échoue — `setError` → `.verif-alert--danger`
  - [PASS] adresse Google Maps désactive l'enregistrement tant que l'adresse est vide — `disabled={!url.trim()}`
  - [PASS] adresse Google Maps enregistre l'adresse saisie et met à jour la position affichée — URL trimée, badge « Position enregistrée », lien `href`, coordonnées `toFixed(5)`
  - [PASS] adresse Google Maps déclenche l'enregistrement avec la touche Entrée — `keyDown('Enter')`
  - [PASS] adresse Google Maps affiche l'erreur quand le lien est refusé — pas de mode manuel hors motif autorisé
  - [PASS] adresse Google Maps propose de placer le marqueur quand le lien n'est pas reconnu — `PropertyMap` double + hint
  - [PASS] adresse Google Maps centre la carte manuelle sur le marché BJ — fallback `6.3703, 2.3912`
  - [PASS] adresse Google Maps enregistre la position placée manuellement — `setPropertyAddress(id, url, lat, lng)` + coords affichées
  - [PASS] adresse Google Maps affiche l'erreur quand la position manuelle est refusée — marqueur conservé
  - [PASS] adresse Google Maps affiche la carte en lecture seule quand l'adresse est déjà enregistrée — `data-interactive="false"`
  - [PASS] soumission et paiement indique que les deux faces de la carte manquent — bouton désactivé
  - [PASS] soumission et paiement indique que l'adresse manque quand les documents sont présents
  - [PASS] soumission et paiement autorise la soumission quand le dossier est complet — hint « Passons au paiement »
  - [PASS] soumission et paiement soumet le dossier et verrouille le bouton sur la redirection — `submitVerification('gerant-1')` → « Redirection... »
  - [PASS] soumission et paiement affiche l'erreur de soumission et réactive le bouton
  - [PASS] soumission et paiement ne confirme aucun paiement sans identifiant dans l'URL
  - [PASS] soumission et paiement confirme automatiquement le paiement quand ?id= est présent — `history.replaceState({}, '', '?id=42')` → `confirmVerification('gerant-1', 42)`
  - [PASS] soumission et paiement affiche l'état de confirmation pendant l'appel — alerte info
  - [PASS] soumission et paiement affiche l'erreur quand la confirmation du paiement échoue

**Total : 128 tests ajoutés (41 + 37 + 50), tous PASS.**

Vérifications (workdir `frontend/`) :
- `npx vitest run src/pages/gerant/AdminLayout.test.tsx src/pages/gerant/AjouterChambre.test.tsx src/pages/gerant/VerificationPage.test.tsx` → **3 fichiers / 128 tests PASS** (39,6 s)
- `npm run lint` (`oxlint --deny-warnings`) → **exit 0**, aucune sortie
- `npx tsc -b` → **exit 2, uniquement sur `src/pages/admin/AdminBannersPage.test.tsx` (15 × TS2322, autre agent)** ; **zéro erreur dans mes 3 fichiers**
- `npx vitest run` (global, fait une fois en fin de chantier) → **67 fichiers / 1063 tests : 1056 PASS, 7 échecs tous dans `src/pages/ClientComptePage.test.tsx` (autre agent)** — mes 3 fichiers sont dans les 66 fichiers verts

## ÉCHECS À CORRIGER
- **Aucun dans mon périmètre.** Les 3 fichiers que j'ai créés sont intégralement verts et typés (`tsc -b` ne remonte aucune erreur sur eux).
- Hors périmètre, à la charge des agents concernés :
  - `src/pages/admin/AdminBannersPage.test.tsx` — 15 erreurs `TS2322: Type 'boolean' is not assignable to type 'number'` (lignes 176 à 469) : `npx tsc -b` est donc **rouge pour tout le repo**.
  - `src/pages/ClientComptePage.test.tsx` — 7 tests en échec sur la globale `npx vitest run`.

## Corrections pendant le TDD
- `AdminLayout.test.tsx` : `act` non importé ; attente sur « Réservations » trop précoce (`findByRole` au lieu de `getByRole`) ; apostrophe typographique `’` vs droite `'` dans `timeAgo` (« À l'instant ») ; assertion `.verify-modal__room` via `querySelector` ; suppression d'une assertion fausse sur `.sidebar__pill` (la pastille s'affiche toujours, avec « 0 »).
- `AjouterChambre.test.tsx` : rôle `combobox` dupliqué par `<datalist>` → helper `categorySelect()` ciblant le `<select>` ; `<option />` auto-fermé sans texte → assertion sur l'attribut `value` du `datalist` ; `toBeNull()` remplacé par `queryByText()` (19 puis 4 puis 0 échec) ; bouton nommé « Voir l'aperçu → » non matché par `/Aperçu/` → `/aperçu/i` (12 occurrences) ; bouton « Étape précédente » à cliquer deux fois depuis l'étape 3 ; sélection du radio/tick avant le passage à l'étape 3 ; **19 timeouts de 5 s éliminés en remplaçant `userEvent.type` par un helper `setText()` (`fireEvent.change`)** — voir observation 1.
- `VerificationPage.test.tsx` : regex `/adresse Google Maps de l/` cassée par la casse (`Adresse`) → `/Adresse Google Maps/` ; `findByText(/Déposez l/)` ambigu après suppression (2 zones) → `findAllByText(...)` ; `findByText(/Lien non reconnu/)` ambigu (message d'erreur + hint) → chaîne exacte ; `mockResolvedValueOnce(addressStatus)` positionné **avant** le render était consommé par le premier `getVerificationStatus` (le bouton devenait « Mettre à jour ») → déplacé après le rendu ; propriété `data-interactive` ajoutée au double `PropertyMap` pour rendre l'assertion non triviale.

## Observations / points d'attention
1. **`userEvent.type` est trop lent sous jsdom chargé et provoque des timeouts.** Saisir 4 champs caractère par caractère (~60 frappes, chacune `pointer` + `input` + `act`) a fait échouer 19 scénarios sur 37 avec `Test timed out in 5000ms` (le point de blocage variait d'un run à l'autre : les logs `console.log` capturés s'arrêtaient à un endroit différent à chaque exécution — le diagnostic par instrumentation est donc non fiable ici). Remplacement systématique de la saisie de texte par un helper `setText(el, value)` = `fireEvent.change(el, { target: { value } })` (les `click`/`selectOptions`/`drop` restent en `userEvent`) : le fichier est passé de **188 s → 26 s** et de 19 → 0 échec. À retenir pour tout formulaire long de ce repo : `userEvent.type` pour les interactions courtes, `fireEvent.change` pour les valeurs bulk.
2. **Bouton « Voir l'aperçu → » :** `getByRole('button', { name: /Aperçu/ })` ne matche pas (« Aperçu » en majuscule seulement dans le `step__label`, le bouton dit « l'aperçu » minuscule). Utiliser `/aperçu/i`.
3. **Défaut d'accessibilité dans `AjouterChambre` (source, non corrigé) :** le groupe d'units de prix est un `<label>` englobant (`admin-field`) qui contient deux `<label>` imbriqués. Le nom accessible calculé du **premier** radio devient « Unité de prix Par moisPar nuit » (le `<label>` externe a pour `control` le premier input), tandis que le second reste « Par nuit ». `getByRole('radio', { name: 'Par mois' })` échoue donc — les tests ciblent `document.querySelectorAll('input[name="priceUnit"]')`. À corriger côté source en remplaçant le `<label>` externe par un `<div>` + `<span>` (correctif non appliqué : hors périmètre).
4. **`toHaveValue` sur un `<input type="number">` attend un nombre** : `expect(el).toHaveValue('1')` échoue avec `Expected 1 (string) / Received 1 (number)` — jest-dom convertit la valeur. Assertions en `toHaveValue(1)` / `(3)` / `(2)`.
5. **`<datalist>` partage aussi le rôle `combobox`** sous jsdom : `getByRole('combobox')` devient ambigu (2 éléments). Cibler le `<select>` par `document.querySelector('select')`. De même, `<option value="X" />` auto-fermé n'a **aucun texte** : on ne peut pas `getByRole('option', { name })` sur les suggestions du `datalist`, seulement vérifier `option[value=...]`.
6. **Les catégories arrivent en async.** Sans `await screen.findByRole('option', { name: 'Appartements' })` en tête de `fillStep1`, le `<select>` est incomplet et la validation bloque sur « Choisissez une catégorie ». Idem pour les suggestions de ville (`#gerant-room-city-options`).
7. **Le bouton « Définir comme principale » n'existe que sur les photos non-principales et disparaît à l'étape 4** (l'aperçu n'a que les flèches) : il faut cliquer **avant** « Voir l'aperçu ». `img: urls[mainPhotoIndex]` (source `AjouterChambre.tsx:153`).
8. **`mockResolvedValueOnce` placé avant le premier `render` est consommé par le chargement initial.** Dans `VerificationPage`, la première passe de `getVerificationStatus` servant à déterminer `hasAddress`, un `Once` positionné trop tôt inverse le scénario (bouton « Mettre à jour » au lieu de « Enregistrer »). Toujours injecter les réponses « suivantes » **après** le rendu initial.
9. **`getByText` est sensible à la casse par défaut** : `/adresse …/` ne matche pas « Adresse … ». Préférer des regex sans ancrage mais à la casse exacte du texte source, ou `getAllByText` dès qu'un libellé peut apparaître deux fois (les deux zones de dépôt, les deux hints).
10. **`URL.createObjectURL` / `revokeObjectURL` n'existent pas sous jsdom** et sont appelés dès le montage de `VerificationPage` (`handleFileSelect`) et dès la sélection d'une photo dans `AjouterChambre` : stubs déclarés dans `vi.hoisted()`, **avant** les `vi.mock` (rappel : `BannerCarousel` les lit lui-même à l'import, cf. rapport F2).
11. **`window.location.href = payment_url`** (ValidationPage `handleSubmit`) : jsdom ne navigue pas et journalise « Not implemented: navigation (except hash changes) » — l'erreur est journalisée, elle ne fait **échouer aucun test**. On assert donc l'appel `submitVerification('gerant-1')` + l'état UI « Redirection... ». `window.location.href` n'est pas redéfinissable sous jsdom (cf. commentaire de `PremiumPage.test.tsx`).
12. **`window.location.search` se pilote via `window.history.replaceState({}, '', '?id=42')`** (marche en jsdom, même origine) et se **remet à zéro dans `beforeEach`/`afterEach`** — sinon l'effet `useEffect([gerant])` de `VerificationPage` rejoue la confirmation sur tous les tests suivants.
13. **Boucle potentielle de `VerificationPage` en production (source, non corrigé) :** l'effet `useEffect(…, [gerant])` (lignes 292-297) appelle `handleConfirmPayment()` dès que `?id=` est présent, et `handleConfirmPayment` rappelle `loadData()` qui fait `setGerant(await getMe())`. En production `getMe()` renvoie un **nouvel objet** à chaque appel → nouvelle référence → l'effet se relance → `confirmVerification` rappelé **indéfiniment** (tant que `?id=` reste dans l'URL). Le test ne l'observe pas car `mockResolvedValue` renvoie toujours la même référence et React fait un bail-out d'état. Correctif suggéré (non appliqué) : inclure `window.location.search` ou un `useRef` de verrouillage, et retirer `gerant` des dépendances au profit d'un `gerant?.id` stable.
14. **`PropertyMap` est systématiquement mocké** dans `VerificationPage.test.tsx` : le composant réel charge l'API Google Maps (script réseau). Le double expose `data-testid="property-map"`, `data-interactive`, le centre reçu et un bouton qui déclenche `onMapClick` (nécessaire pour le mode manuel).
15. **Dépendance locale au fuseau** : `Soumise le …` est un `toLocaleDateString('fr-FR')` sur un ISO `…T10:30:00.000Z` — fiable de UTC−10 à UTC+13, à connaître si la CI tourne en UTC+14.
16. **Aucun fichier source modifié** : uniquement les 3 fichiers `.test.tsx` créés + ce rapport. Aucun `.test` d'un autre agent touché, aucune config touchée, **aucun accès réseau** (tous les modules `../../lib/api`, `@clerk/clerk-react`, `../../components/PropertyMap` sont mockés ; `vi.stubEnv` + `vi.resetModules()` + import dynamique pour la branche sans clé Clerk).
17. **Vague concurrente** : d'autres agents écrivent en parallèle dans le même repo. L'état constaté en fin de session : globale à **67 fichiers / 1063 tests**, dont mes **3 fichiers / 128 tests** ; `npm run lint` est vert, `npx tsc -b` est **rouge uniquement à cause de `src/pages/admin/AdminBannersPage.test.tsx`** et `npx vitest run` **rouge uniquement à cause de `src/pages/ClientComptePage.test.tsx`**.

# TEST_REPORT P4 — Pages publiques lourdes

Périmètre : `frontend/src/pages/{RoomDetailPage,ClientComptePage,SearchResultsPage,CategoryPage,RegisterRolePage}.tsx`.
Aucun fichier source, config (`vite.config.ts`, `tsconfig*`, `package.json`) ni `src/test/setup.ts` n'a été modifié : uniquement **5 fichiers `*.test.tsx` colocalisés** (aucun `.test` d'un autre agent touché, aucun autre rapport modifié).

Baseline avant la vague P : **38 fichiers / 479 tests**. État après P4 (suite globale revérifiée) : **70 fichiers / 1186 tests PASS** — soit les ajouts des vagues P1 à P5 et les contributions parallèles d'autres agents ; ma vague couvre **5 fichiers / 183 tests**.

Vérifications (workdir `frontend/`) :
- `npx vitest run src/pages/RoomDetailPage.test.tsx src/pages/ClientComptePage.test.tsx src/pages/SearchResultsPage.test.tsx src/pages/CategoryPage.test.tsx src/pages/RegisterRolePage.test.tsx --reporter=verbose` → **5 fichiers / 183 tests PASS** (exit 0, ≈ 40 s)
- `npx vitest run` (suite globale, une exécution en fin de session) → **70 fichiers / 1186 tests PASS** (exit 0, ≈ 223 s)
- `npm run lint` (`oxlint --deny-warnings`) → **exit 0**, aucune sortie
- `npx tsc -b` → **exit 0**

## Tests ajoutés

### frontend/src/pages/RoomDetailPage.tsx
- `frontend/src/pages/RoomDetailPage.test.tsx` : [PASS] — **57 tests** :

  **états (4)**
  - `frontend/src/pages/RoomDetailPage.test.tsx` : [PASS] **affiche « Chargement... » tant que les biens ne sont pas revenus** — promesse suspendue sur `fetchRoomsByMarket`, « Chargement... » visible, aucun `h1`
  - `frontend/src/pages/RoomDetailPage.test.tsx` : [PASS] **affiche « Chambre introuvable. » quand l'identifiant n'existe pas** — `/ci/chambre/inconnu` → message d'erreur + titre « Chambre introuvable »
  - `frontend/src/pages/RoomDetailPage.test.tsx` : [PASS] **affiche un lien de retour à l'accueil sur la page d'erreur** — lien « ← Retour à l'accueil » avec `href="/ci"`
  - `frontend/src/pages/RoomDetailPage.test.tsx` : [PASS] **affiche « Chambre introuvable. » si le chargement des biens échoue** — rejet de `fetchRoomsByMarket`, plus aucun « Chargement... »

  **fil d'Ariane et marché (3)**
  - `frontend/src/pages/RoomDetailPage.test.tsx` : [PASS] **affiche le fil d'Ariane avec la catégorie cliquable** — lien vers `/ci/categorie/cat-premium`, `aria-current="page"` sur le titre du bien
  - `frontend/src/pages/RoomDetailPage.test.tsx` : [PASS] **n'affiche pas la catégorie quand elle est absente du référentiel** — `fetchCategoriesByMarket([])` → pas de lien de catégorie, Accueil toujours en `/ci`
  - `frontend/src/pages/RoomDetailPage.test.tsx` : [PASS] **construit les liens d'authentification depuis le marché de l'URL** — marché `BJ` → `/bj/login` et `/bj/inscription`

  **galerie (4)**
  - `frontend/src/pages/RoomDetailPage.test.tsx` : [PASS] **affiche la photo principale et son compteur** — `alt` « Suite vue mer — photo 1 sur 3 » + « Photo 1 sur 3 »
  - `frontend/src/pages/RoomDetailPage.test.tsx` : [PASS] **avance et boucle avec les flèches de navigation** — 1 → 2 → 1 → 3 : le précédent en position 1 boucle sur la dernière
  - `frontend/src/pages/RoomDetailPage.test.tsx` : [PASS] **sélectionne une photo depuis ses vignettes** — clic sur « Voir la photo 3 » → classe `is-active` déplacée
  - `frontend/src/pages/RoomDetailPage.test.tsx` : [PASS] **signale l'absence de photo sans flèches ni vignettes** — `images: []` → « Aucune photo disponible », aucune flèche ni vignette

  **contenu (7)**
  - `frontend/src/pages/RoomDetailPage.test.tsx` : [PASS] **affiche le titre, le prix, la capacité et la description** — `h1` + « dès 25 000 » + « Capacité : 2 personnes »
  - `frontend/src/pages/RoomDetailPage.test.tsx` : [PASS] **découpe les conditions en éléments de liste** — 2 `li` dans `.room-detail__conditions`
  - `frontend/src/pages/RoomDetailPage.test.tsx` : [PASS] **affiche la carte de l'hôte vérifié et premium** — « Vérifié » + « Premium » sous le `h2` « Votre hôte »
  - `frontend/src/pages/RoomDetailPage.test.tsx` : [PASS] **n'affiche pas la carte de l'hôte pour un gérant non vérifié** — ni `h2`, ni nom du gérant dans le DOM
  - `frontend/src/pages/RoomDetailPage.test.tsx` : [PASS] **affiche le lien téléphonique de l'hôte** — `href="tel:+2250707070707"`
  - `frontend/src/pages/RoomDetailPage.test.tsx` : [PASS] **n'affiche pas de lien téléphonique quand le gérant n'a pas de numéro** — `.host-card__phone` absent alors que la carte reste
  - `frontend/src/pages/RoomDetailPage.test.tsx` : [PASS] **enrichit la chambre avec le gérant renvoyé par fetchRoomById** — promesse résolue après coup via `act` → la carte hôte apparaît, `fetchRoomById('r1')`

  **avis (5)**
  - `frontend/src/pages/RoomDetailPage.test.tsx` : [PASS] **affiche les moyennes de la chambre et du gérant** — `.room-reviews__summary` : « ★ 4.5 (3) » et « Gérant ★ 4.0 (2) »
  - `frontend/src/pages/RoomDetailPage.test.tsx` : [PASS] **affiche le locataire, ses notes et son commentaire** — « Jeanne », « Appartement ★★★★★ », « « Super séjour » »
  - `frontend/src/pages/RoomDetailPage.test.tsx` : [PASS] **masque la section d'avis quand il n'y en a aucun** — `listByRoom` → liste vide, `h2` « Avis des locataires » absent
  - `frontend/src/pages/RoomDetailPage.test.tsx` : [PASS] **n'affiche pas la section d'avis si l'API échoue** — rejet de `listByRoom`, section entièrement masquée
  - `frontend/src/pages/RoomDetailPage.test.tsx` : [PASS] **masque les moyennes quand elles sont nulles** — résumé rendu sans enfant, la liste d'avis reste affichée

  **authentification Clerk (6)**
  - `frontend/src/pages/RoomDetailPage.test.tsx` : [PASS] **affiche l'invitation à se connecter quand l'utilisateur est déconnecté** — message « Connectez-vous pour pré-remplir » + liens `/ci/login`, `/ci/inscription`
  - `frontend/src/pages/RoomDetailPage.test.tsx` : [PASS] **masque l'invitation une fois connecté** — `isSignedIn: true` → plus d'invitation ni de lien « Se connecter »
  - `frontend/src/pages/RoomDetailPage.test.tsx` : [PASS] **affiche l'invitation tant que Clerk n'est pas chargé** — `isLoaded: false` → invitation conservée
  - `frontend/src/pages/RoomDetailPage.test.tsx` : [PASS] **pré-remplit le nom et l'email depuis le compte Clerk** — « Aya Kouassi » / « aya@test.com » dans les champs
  - `frontend/src/pages/RoomDetailPage.test.tsx` : [PASS] **pré-remplit la date de début et la durée depuis les paramètres** — `?arrivee=2026-03-01&depart=2026-03-04` → durée calculée « 3 »
  - `frontend/src/pages/RoomDetailPage.test.tsx` : [PASS] **utilise une durée de 1 quand les dates d'URL sont absentes** — valeur par défaut du champ Durée

  **validation (8)**
  - `frontend/src/pages/RoomDetailPage.test.tsx` : [PASS] **signale chaque champ requis après une soumission vide** — 4 `role="alert"` (nom, email, téléphone, date), la durée reste valide à 1, `addReservation` non appelé
  - `frontend/src/pages/RoomDetailPage.test.tsx` : [PASS] **signale un email invalide à la sortie du champ** — `blur` → « Adresse email invalide. »
  - `frontend/src/pages/RoomDetailPage.test.tsx` : [PASS] **signale un numéro de téléphone invalide** — saisie « abc » → « Numéro de téléphone invalide. »
  - `frontend/src/pages/RoomDetailPage.test.tsx` : [PASS] **signale la date de début vidée après saisie** — `2026-02-31` rejeté par `input type="date"` (valeur `''`) puis message d'erreur
  - `frontend/src/pages/RoomDetailPage.test.tsx` : [PASS] **signale une durée vide** — message « Veuillez saisir une durée valide. » + `aria-invalid="true"`
  - `frontend/src/pages/RoomDetailPage.test.tsx` : [PASS] **signale une durée supérieure au maximum en nuits** — 999 → « La durée maximale est de 366 nuits. »
  - `frontend/src/pages/RoomDetailPage.test.tsx` : [PASS] **efface l'erreur d'email dès que la valeur devient valide** — re-saisie correcte puis `blur` → plus aucun `alert`
  - `frontend/src/pages/RoomDetailPage.test.tsx` : [PASS] **ne marque pas les champs tant qu'on n'a pas quitté le champ** — `change` sans `blur` → aucun message

  **estimation et date de fin (6)**
  - `frontend/src/pages/RoomDetailPage.test.tsx` : [PASS] **calcule la date de fin et le montant à partir de la durée en nuits** — « Du 2026-03-01 au 2026-03-04 », « 3 nuits », « 75 000 FCFA »
  - `frontend/src/pages/RoomDetailPage.test.tsx` : [PASS] **recalcule le montant quand la durée change** — durée 5 → « 125 000 FCFA » et fin « 2026-03-06 »
  - `frontend/src/pages/RoomDetailPage.test.tsx` : [PASS] **n'affiche ni date de fin ni estimation sans date de début** — les deux éléments absents du DOM
  - `frontend/src/pages/RoomDetailPage.test.tsx` : [PASS] **n'affiche pas d'estimation quand la durée est invalide** — durée 0 → pas d'estimation
  - `frontend/src/pages/RoomDetailPage.test.tsx` : [PASS] **utilise l'unité mois et borne la durée pour un bien mensuel** — champ Unité figé à « mois » et désactivé, `max="24"`, 2 mois → fin « 2026-05-01 » et « 50 000 FCFA »
  - `frontend/src/pages/RoomDetailPage.test.tsx` : [PASS] **borne la durée à 24 mois sur un bien mensuel** — saisie 30 → « La durée maximale est de 24 mois. »

  **soumission (7)**
  - `frontend/src/pages/RoomDetailPage.test.tsx` : [PASS] **envoie la réservation et affiche le succès** — `addReservation` avec le payload complet (`roomId`, `dateFin`, `montant: 75000`, `dureeUnite: 'nuit'`) puis `role="status"`
  - `frontend/src/pages/RoomDetailPage.test.tsx` : [PASS] **envoie la durée en mois pour un bien mensuel** — `dureeUnite: 'mois'`, `dateFin: '2026-06-01'`
  - `frontend/src/pages/RoomDetailPage.test.tsx` : [PASS] **propose de suivre la réservation sans compte** — lien « Suivre ma réservation » vers `/ci/suivi-reservation`
  - `frontend/src/pages/RoomDetailPage.test.tsx` : [PASS] **renvoie vers le compte personnel quand on est connecté** — même lien vers `/ci/compte`
  - `frontend/src/pages/RoomDetailPage.test.tsx` : [PASS] **affiche le message d'erreur de l'API** — rejet « Service indisponible » en `role="alert"`, formulaire conservé
  - `frontend/src/pages/RoomDetailPage.test.tsx` : [PASS] **affiche un message générique si l'erreur n'est pas une instance d'Error** — rejet `string` → « Une erreur est survenue. Veuillez réessayer. »
  - `frontend/src/pages/RoomDetailPage.test.tsx` : [PASS] **désactive le bouton pendant l'envoi** — promesse suspendue → « Envoi en cours... » en `disabled`, puis succès à la résolution

  **partage (3)**
  - `frontend/src/pages/RoomDetailPage.test.tsx` : [PASS] **copie l'adresse de la page et confirme** — `navigator.clipboard.writeText(window.location.href)` puis « Lien copié ! »
  - `frontend/src/pages/RoomDetailPage.test.tsx` : [PASS] **confirme aussi quand l'API clipboard n'existe pas** — `Reflect.deleteProperty(navigator, 'clipboard')` → confirmation quand même
  - `frontend/src/pages/RoomDetailPage.test.tsx` : [PASS] **réinitialise le retour au bout de 2 secondes** — faux timers + `advanceTimersByTime(2000)` → retour à « Partager »

  **appels réseau (4)**
  - `frontend/src/pages/RoomDetailPage.test.tsx` : [PASS] **interroge biens, catégories, détail et avis pour le marché de l'URL** — `fetchRoomsByMarket('CI')`, `fetchCategoriesByMarket('CI')`, `fetchRoomById('r1')`, `listByRoom('r1')`
  - `frontend/src/pages/RoomDetailPage.test.tsx` : [PASS] **utilise le marché indiqué dans l'URL pour les données** — `/bj/chambre/r1` → appels avec `'BJ'`
  - `frontend/src/pages/RoomDetailPage.test.tsx` : [PASS] **recharge les avis après une réservation envoyée** — `listByRoom` appelé 2 fois (chargement initial + post-envoi)
  - `frontend/src/pages/RoomDetailPage.test.tsx` : [PASS] **ne laisse partir aucune requête réseau non mockée** — `request` et `cachedGet` (verrouillés en rejet) jamais appelés

### frontend/src/pages/ClientComptePage.tsx
- `frontend/src/pages/ClientComptePage.test.tsx` : [PASS] — **39 tests** :

  **états de chargement (5)**
  - `frontend/src/pages/ClientComptePage.test.tsx` : [PASS] **affiche le chargement des réservations** — promesse suspendue → « Chargement de vos réservations… », aucune carte
  - `frontend/src/pages/ClientComptePage.test.tsx` : [PASS] **n'interroge rien tant que Clerk n'est pas chargé** — `isLoaded: false` → `getMyReservations` non appelé
  - `frontend/src/pages/ClientComptePage.test.tsx` : [PASS] **affiche l'état vide avec un lien vers l'accueil** — « Aucune réservation pour le moment » + lien vers `/ci`
  - `frontend/src/pages/ClientComptePage.test.tsx` : [PASS] **affiche l'erreur de l'API lors du chargement** — rejet « Service indisponible » en `role="alert"`
  - `frontend/src/pages/ClientComptePage.test.tsx` : [PASS] **affiche un message générique si l'erreur n'est pas une instance d'Error** — rejet `string` → « Impossible de charger vos données. »

  **rail de navigation (4)**
  - `frontend/src/pages/ClientComptePage.test.tsx` : [PASS] **affiche l'avatar, le nom et l'email du compte Clerk** — initiales « AK », prénom « Aya », email « aya@test.com »
  - `frontend/src/pages/ClientComptePage.test.tsx` : [PASS] **affiche la date de création du compte** — « Membre depuis janvier 2024 » (`toLocaleDateString('fr-FR')`)
  - `frontend/src/pages/ClientComptePage.test.tsx` : [PASS] **retombe sur « à vous » et l'initiale U sans compte Clerk** — `user: null` + profil vide → aucun « Membre depuis »
  - `frontend/src/pages/ClientComptePage.test.tsx` : [PASS] **déconnecte et revient vers le marché** — `signOut()` appelé 1 fois puis routé vers `home`

  **onglets (3)**
  - `frontend/src/pages/ClientComptePage.test.tsx` : [PASS] **ouvre sur l'onglet des réservations** — `aria-selected="true"` sur « Mes réservations », `h1` correspondant
  - `frontend/src/pages/ClientComptePage.test.tsx` : [PASS] **affiche le nombre de réservations en pastille** — `.compte-rail__pill` = « 4 »
  - `frontend/src/pages/ClientComptePage.test.tsx` : [PASS] **bascule sur l'onglet profil et change le titre** — `h1` « Mon profil », plus aucune carte de réservation

  **liste des réservations (7)**
  - `frontend/src/pages/ClientComptePage.test.tsx` : [PASS] **affiche les dates formatées, le montant et le statut** — « 01 mars », « 04 mars 2026 », « 75 000 FCFA / nuit », « Confirmée »
  - `frontend/src/pages/ClientComptePage.test.tsx` : [PASS] **affiche la photo de la chambre avec son texte alternatif** — `img` nommée « Suite » pointant `/images/suite.jpg`
  - `frontend/src/pages/ClientComptePage.test.tsx` : [PASS] **affiche une image de repli sans description ni photo** — `.client-compte__card-media-fallback` présent, aucun `.client-compte__price`
  - `frontend/src/pages/ClientComptePage.test.tsx` : [PASS] **masque le bouton d'annulation sur une réservation annulée** — ni « Annuler », ni « Laisser un avis » sur la carte annulée
  - `frontend/src/pages/ClientComptePage.test.tsx` : [PASS] **propose de noter les séjours confirmés non encore notés** — bouton sur « Suite vue mer » + bandeau « Vous avez 1 séjour(s) confirmé(s)… »
  - `frontend/src/pages/ClientComptePage.test.tsx` : [PASS] **signale un avis déjà publié pour un séjour noté** — badge « Avis publié » et bandeau à **1** (et non 2), car « Chambre vue » est déjà noté
  - `frontend/src/pages/ClientComptePage.test.tsx` : [PASS] **affiche l'image de repli faute de photo sur la chambre sans visuel** — `room.img: null` → aucun `img`/`role="img"`, uniquement le repli (le titre sert d'`alt` quand la photo existe)

  **annulation (4)**
  - `frontend/src/pages/ClientComptePage.test.tsx` : [PASS] **annule la réservation confirmée après confirmation** — `window.confirm('Annuler cette réservation ?')`, `cancelMyReservation('res1')`, statut passé à « Annulée »
  - `frontend/src/pages/ClientComptePage.test.tsx` : [PASS] **n'annule rien quand l'utilisateur refuse** — `confirm → false` : API non appelée, statut « Confirmée » conservé
  - `frontend/src/pages/ClientComptePage.test.tsx` : [PASS] **affiche l'erreur quand l'annulation échoue** — rejet « Délai dépassé » en `alert`, carte inchangée
  - `frontend/src/pages/ClientComptePage.test.tsx` : [PASS] **désactive le bouton pendant l'annulation** — promesse suspendue → bouton « Annulation… » en `disabled`, puis « Annulée »

  **avis (6)**
  - `frontend/src/pages/ClientComptePage.test.tsx` : [PASS] **ouvre le formulaire de notation pour un séjour confirmé** — `dialog` avec `aria-modal="true"` et deux `radiogroup` notés « … : 5 sur 5 »
  - `frontend/src/pages/ClientComptePage.test.tsx` : [PASS] **change la note de l'appartement avec les étoiles** — clic ciblé dans `within(radiogroup appartement)` → « 3 sur 5 », le groupe du gérant intact (libellés de boutons identiques entre les deux groupes)
  - `frontend/src/pages/ClientComptePage.test.tsx` : [PASS] **publie l'avis avec les notes et le commentaire saisis** — `create({ reservation_id: 'res1', note_appartement: 4, note_gerant: 5, commentaire })`, message de succès, dialog fermé
  - `frontend/src/pages/ClientComptePage.test.tsx` : [PASS] **affiche l'erreur quand la publication échoue** — rejet « Avis déjà publié » en `alert`, dialog conservé ouvert
  - `frontend/src/pages/ClientComptePage.test.tsx` : [PASS] **désactive les actions du formulaire pendant l'envoi** — « Envoi... » et « Annuler » **du dialog** en `disabled` (l'autre bouton « Annuler » vit sur les cartes)
  - `frontend/src/pages/ClientComptePage.test.tsx` : [PASS] **ferme le formulaire sans publier** — bouton « Fermer » → dialog retiré, `create` non appelé

  **profil (6)**
  - `frontend/src/pages/ClientComptePage.test.tsx` : [PASS] **pré-remplit le profil depuis l'API client** — `getMe` appelé 1 fois, champs Prénom/Nom/Téléphone renseignés
  - `frontend/src/pages/ClientComptePage.test.tsx` : [PASS] **désactive le champ email géré par le compte** — `toBeDisabled()` avec la valeur Clerk
  - `frontend/src/pages/ClientComptePage.test.tsx` : [PASS] **retombe sur les informations Clerk si le profil est indisponible** — rejet `getMe` → prénom/nom Clerk, téléphone vide
  - `frontend/src/pages/ClientComptePage.test.tsx` : [PASS] **enregistre les modifications du profil** — `updateMe({ nom, prenom, telephone })` + « Profil mis à jour avec succès. »
  - `frontend/src/pages/ClientComptePage.test.tsx` : [PASS] **affiche l'erreur quand la mise à jour échoue** — rejet « Profil verrouillé » en `alert`
  - `frontend/src/pages/ClientComptePage.test.tsx` : [PASS] **désactive le bouton pendant l'enregistrement** — promesse suspendue → « Enregistrement… » en `disabled`, puis succès

  **appels réseau (4)**
  - `frontend/src/pages/ClientComptePage.test.tsx` : [PASS] **branche le jeton d'authentification sur l'API** — `setAuthTokenGetter` appelé 1 fois ; le getter est ensuite **invoqué à la main** et renvoie `getToken()` → `'token-test'`
  - `frontend/src/pages/ClientComptePage.test.tsx` : [PASS] **recharge réservations et avis en une seule passe** — `getMyReservations` et `listMine` 1 appel chacun (`Promise.all`)
  - `frontend/src/pages/ClientComptePage.test.tsx` : [PASS] **continue de fonctionner si la liste des avis échoue** — `.catch(() => [])` : page sans erreur, bandeau repassé à **2** séjours notables
  - `frontend/src/pages/ClientComptePage.test.tsx` : [PASS] **ne laisse partir aucune requête réseau non mockée** — `request`/`cachedGet` jamais appelés

### frontend/src/pages/SearchResultsPage.tsx
- `frontend/src/pages/SearchResultsPage.test.tsx` : [PASS] — **30 tests** :

  **états (8)**
  - `frontend/src/pages/SearchResultsPage.test.tsx` : [PASS] **affiche le chargement tant que les biens ne sont pas revenus** — promesse suspendue sur `fetchAvailableRooms`, pas de `.search-page__layout`
  - `frontend/src/pages/SearchResultsPage.test.tsx` : [PASS] **affiche le panneau de dates quand les dates manquent** — `h1` « Sélectionnez vos dates » + texte d'aide
  - `frontend/src/pages/SearchResultsPage.test.tsx` : [PASS] **affiche la requête dans le titre du panneau de dates** — `?q=bord%20de%20mer` → « Recherche pour … bord de mer »
  - `frontend/src/pages/SearchResultsPage.test.tsx` : [PASS] **affiche le compteur de résultats au singulier** — « 1 bien trouvé »
  - `frontend/src/pages/SearchResultsPage.test.tsx` : [PASS] **affiche le compteur de résultats au pluriel** — « 2 biens trouvés »
  - `frontend/src/pages/SearchResultsPage.test.tsx` : [PASS] **affiche l'état vide de disponibilité pour ces dates** — « Aucune disponibilité pour ces dates » + texte de repli
  - `frontend/src/pages/SearchResultsPage.test.tsx` : [PASS] **convertit une erreur de chargement en état vide** — rejet de `fetchAvailableRooms` → même état vide (pas d'erreur affichée)
  - `frontend/src/pages/SearchResultsPage.test.tsx` : [PASS] **affiche « Tous les biens » quand aucune requête libre** — `h1` « Résultats pour Tous les biens »

  **panneau de dates (5)**
  - `frontend/src/pages/SearchResultsPage.test.tsx` : [PASS] **refuse la soumission sans dates** — alert « Veuillez renseigner les deux dates. » et l'URL reste vide (sonde `url-params`)
  - `frontend/src/pages/SearchResultsPage.test.tsx` : [PASS] **refuse un départ antérieur ou égal à l'arrivée** — alert « …doit être ultérieure à la date d'arrivée. »
  - `frontend/src/pages/SearchResultsPage.test.tsx` : [PASS] **efface l'erreur dès qu'une date est saisie** — `change` sur Arrivée → plus d'`alert`
  - `frontend/src/pages/SearchResultsPage.test.tsx` : [PASS] **valide les dates, met à jour l'URL et affiche les disponibilités** — sonde `url-params` = `arrivee`/`depart`/`q` + `fetchAvailableRooms('CI', '2026-03-01', '2026-03-04')`
  - `frontend/src/pages/SearchResultsPage.test.tsx` : [PASS] **revient au panneau de dates avec le bouton Modifier** — retour au formulaire, `arrivee=` purgé de l'URL

  **requêtes (4)**
  - `frontend/src/pages/SearchResultsPage.test.tsx` : [PASS] **interroge les disponibilités avec le marché et les dates** — `fetchAvailableRooms` appelé, `fetchRoomsByMarket` **jamais** appelé en mode daté, catégories chargées
  - `frontend/src/pages/SearchResultsPage.test.tsx` : [PASS] **interroge tous les biens du marché quand les dates manquent** — `fetchRoomsByMarket('CI')` seul
  - `frontend/src/pages/SearchResultsPage.test.tsx` : [PASS] **interroge le marché indiqué dans l'URL (BJ)** — appels en `'BJ'`, Accueil en `/bj`, carte vers `/bj/chambre/r1?arrivee=…&depart=…`
  - `frontend/src/pages/SearchResultsPage.test.tsx` : [PASS] **ne laisse partir aucune requête réseau non mockée** — `request`/`cachedGet` jamais appelés

  **résultats (9)**
  - `frontend/src/pages/SearchResultsPage.test.tsx` : [PASS] **affiche le résumé des dates de séjour** — « 2026-03-01 → 2026-03-04 »
  - `frontend/src/pages/SearchResultsPage.test.tsx` : [PASS] **construit le lien de chaque carte avec les dates en query** — `href="/ci/chambre/r1?arrivee=…&depart=…"`
  - `frontend/src/pages/SearchResultsPage.test.tsx` : [PASS] **marque les biens indisponibles d'un badge** — 1 seul `.stay-card__badge` « Indisponible » sur 3 biens
  - `frontend/src/pages/SearchResultsPage.test.tsx` : [PASS] **filtre par ville** — « 2 biens trouvés », carte de Grand-Bassam retirée, bouton « Réinitialiser les filtres » apparu
  - `frontend/src/pages/SearchResultsPage.test.tsx` : [PASS] **filtre par quartier** — « 1 bien trouvé » = « Bungalow Cocody »
  - `frontend/src/pages/SearchResultsPage.test.tsx` : [PASS] **filtre par catégorie** — restriction à `cat-moins`
  - `frontend/src/pages/SearchResultsPage.test.tsx` : [PASS] **filtre au prix maximal avec le curseur** — `range` initialisé à `60000`, `change` → `30000` et « 1 bien trouvé »
  - `frontend/src/pages/SearchResultsPage.test.tsx` : [PASS] **réinitialise tous les filtres** — retour à 3 biens, listes remises à `''`, bouton disparu
  - `frontend/src/pages/SearchResultsPage.test.tsx` : [PASS] **ne montre pas de bouton de réinitialisation sans filtre actif** — `queryByRole` null

  **requête libre et pagination (4)**
  - `frontend/src/pages/SearchResultsPage.test.tsx` : [PASS] **filtre les biens sur la requête libre q** — `?q=mer` → 1 bien, titre « Résultats pour mer », l'autre bien masqué
  - `frontend/src/pages/SearchResultsPage.test.tsx` : [PASS] **pagine au-delà de six résultats** — 6 cartes en page 1 puis clic « 2 » → 1 carte (« Bien 7 »)
  - `frontend/src/pages/SearchResultsPage.test.tsx` : [PASS] **revient à la première page quand un filtre change** — changement de ville sur la page 2 → 1 carte, pagination disparue
  - `frontend/src/pages/SearchResultsPage.test.tsx` : [PASS] **affiche l'état vide quand la requête ne correspond à aucun bien** — « 0 biens trouvés » (pluriel à zéro) + état vide

### frontend/src/pages/CategoryPage.tsx
- `frontend/src/pages/CategoryPage.test.tsx` : [PASS] — **24 tests** :

  **états (6)**
  - `frontend/src/pages/CategoryPage.test.tsx` : [PASS] **affiche le chargement tant que les données ne sont pas revenues** — deux promesses suspendues, aucune `.cat-page__grid`
  - `frontend/src/pages/CategoryPage.test.tsx` : [PASS] **affiche le titre de la catégorie et son nombre de résultats** — `h1` « Chambres premium » + « 3 résultats »
  - `frontend/src/pages/CategoryPage.test.tsx` : [PASS] **accorde le compteur au singulier pour un seul résultat** — « 1 résultat »
  - `frontend/src/pages/CategoryPage.test.tsx` : [PASS] **affiche l'état vide quand la catégorie n'existe pas** — « Catégorie introuvable. » + retour `href="/ci"`
  - `frontend/src/pages/CategoryPage.test.tsx` : [PASS] **remonte l'erreur de chargement en état catégorie introuvable** — rejets des deux API → même message d'état vide
  - `frontend/src/pages/CategoryPage.test.tsx` : [PASS] **affiche l'état vide des filtres quand aucun bien ne correspond** — Ville « Abidjan » + Quartier « Ficaye » (dérivé d'une autre ville) → 0 carte

  **contenu (9)**
  - `frontend/src/pages/CategoryPage.test.tsx` : [PASS] **affiche le fil d'Ariane avec la catégorie courante** — `navigation` « Fil d'Ariane », `aria-current` sur la catégorie, Accueil en `/ci`
  - `frontend/src/pages/CategoryPage.test.tsx` : [PASS] **n'affiche que les chambres de la catégorie demandée** — 1 `.stay-card` sur 2, l'autre catégorie masquée
  - `frontend/src/pages/CategoryPage.test.tsx` : [PASS] **mène vers la page de la chambre au clic** — `href="/ci/chambre/r1"` puis navigation vers `data-testid="room"`
  - `frontend/src/pages/CategoryPage.test.tsx` : [PASS] **marque les chambres indisponibles d'un badge explicite** — 1 badge « Indisponible »
  - `frontend/src/pages/CategoryPage.test.tsx` : [PASS] **détaille les caractéristiques (capacité et chambres) de chaque bien** — « 2 chambres » et « 1 chambre » (singulier)
  - `frontend/src/pages/CategoryPage.test.tsx` : [PASS] **interroge les données pour le marché de l'URL** — `/bj/…` → `fetchRoomsByMarket('BJ')` + `fetchCategoriesByMarket('BJ')`
  - `frontend/src/pages/CategoryPage.test.tsx` : [PASS] **construit les liens dans le marché courant (BJ)** — Accueil `/bj`, carte `/bj/chambre/r1`
  - `frontend/src/pages/CategoryPage.test.tsx` : [PASS] **ne laisse partir aucune requête réseau non mockée** — `request`/`cachedGet` jamais appelés
  - `frontend/src/pages/CategoryPage.test.tsx` : [PASS] **repasse par l'état de chargement quand le marché change** — clic sur le lien de marché → « Chargement... » puis nouveau rendu, dernier appel avec `'BJ'`

  **filtres (6)**
  - `frontend/src/pages/CategoryPage.test.tsx` : [PASS] **filtre par ville** — « 2 résultats », la carte de Grand-Bassam disparaît
  - `frontend/src/pages/CategoryPage.test.tsx` : [PASS] **filtre par quartier** — « 1 résultat » = « Bungalow Cocody »
  - `frontend/src/pages/CategoryPage.test.tsx` : [PASS] **filtre par nombre de chambres avec la borne « 3+ »** — valeur `1` → 1 résultat, valeur `3` → uniquement le loft 4 chambres
  - `frontend/src/pages/CategoryPage.test.tsx` : [PASS] **filtre sur les seules chambres disponibles** — « 2 résultats », plus aucun badge « Indisponible »
  - `frontend/src/pages/CategoryPage.test.tsx` : [PASS] **réinitialise les filtres avec le bouton du panneau** — retour à « 3 résultats », champ Ville vidé
  - `frontend/src/pages/CategoryPage.test.tsx` : [PASS] **réinitialise les filtres depuis l'état vide** — bouton « Réinitialiser les filtres » de l'état vide → liste complète restaurée

  **pagination et changement de catégorie (3)**
  - `frontend/src/pages/CategoryPage.test.tsx` : [PASS] **pagine au-delà de six chambres** — 6 cartes en page 1 puis clic « 2 » → « Chambre 7 » seule
  - `frontend/src/pages/CategoryPage.test.tsx` : [PASS] **réinitialise la page courante quand un filtre est modifié** — retour à 1 carte, pagination retirée
  - `frontend/src/pages/CategoryPage.test.tsx` : [PASS] **remet les filtres à zéro quand on change de catégorie** — navigation vers `cat-moins` → `h1` à jour et champ Ville vidé

### frontend/src/pages/RegisterRolePage.tsx
- `frontend/src/pages/RegisterRolePage.test.tsx` : [PASS] — **33 tests** :

  **rendu initial (7)**
  - `frontend/src/pages/RegisterRolePage.test.tsx` : [PASS] **affiche le titre et le sous-titre de l'espace client** — `h1` « Votre espace client vous attend » + `main` présent
  - `frontend/src/pages/RegisterRolePage.test.tsx` : [PASS] **expose un tablist étiqueté « Choisir mon rôle » avec deux onglets** — 2 `tab` nommés « Je suis client » / « Je suis gérant »
  - `frontend/src/pages/RegisterRolePage.test.tsx` : [PASS] **sélectionne l'onglet client et ne marque pas l'onglet gérant** — `aria-selected` + classe `is-active` cohérents
  - `frontend/src/pages/RegisterRolePage.test.tsx` : [PASS] **liste les quatre bénéfices de l'espace client** — 4 `listitem` attendus
  - `frontend/src/pages/RegisterRolePage.test.tsx` : [PASS] **masque les icônes de bénéfices aux technologies d'assistance** — 4 `.register-page__benefit-icon` en `aria-hidden="true"` contenant un `svg`
  - `frontend/src/pages/RegisterRolePage.test.tsx` : [PASS] **étiquette la zone du formulaire pour les lecteurs d'écran** — `region` « Formulaire d'inscription » contenant `clerk-signup`
  - `frontend/src/pages/RegisterRolePage.test.tsx` : [PASS] **n'affiche ni message d'erreur ni message de clé manquante** — aucun `alert`, aucun « Clé Clerk manquante »

  **rôle piloté par l'URL (4)**
  - `frontend/src/pages/RegisterRolePage.test.tsx` : [PASS] **affiche la page gérant sur /bj/inscription/gerant** — `h1` « Rejoignez les gérants Linkhoo » + onglet gérant sélectionné
  - `frontend/src/pages/RegisterRolePage.test.tsx` : [PASS] **liste les quatre bénéfices de l'espace gérant** — 4 bénéfices gérant, aucun bénéfice client
  - `frontend/src/pages/RegisterRolePage.test.tsx` : [PASS] **retombe sur le marché ci quand l'URL ne porte pas de segment de marché** — `data-path="/ci/inscription/client"`, `data-signin="/ci/login"`, pathname réel `/inscription/client`
  - `frontend/src/pages/RegisterRolePage.test.tsx` : [PASS] **normalise un marché saisi en majuscules** — `/CI/inscription/client` → `data-path="/ci/inscription/client"`

  **configuration Clerk (3)**
  - `frontend/src/pages/RegisterRolePage.test.tsx` : [PASS] **configure Clerk sur le chemin d'inscription client du marché courant** — `routing="path"`, `path`, `signInUrl`, `fallbackRedirectUrl` et `unsafeMetadata.role="client"`
  - `frontend/src/pages/RegisterRolePage.test.tsx` : [PASS] **configure Clerk sur le chemin d'inscription gérant de bj** — mêmes attributs en `/bj/…` avec `role="gerant"`
  - `frontend/src/pages/RegisterRolePage.test.tsx` : [PASS] **aplatit le formulaire Clerk (carte sans bordure, fond transparent)** — `elements.card="none"`, `variables.colorBackground="transparent"`

  **sélection du rôle (4)**
  - `frontend/src/pages/RegisterRolePage.test.tsx` : [PASS] **« Je suis gérant » remplace l'URL par /ci/inscription/gerant** — sonde `pathname` + `nav-type="REPLACE"` (navigation `replace`)
  - `frontend/src/pages/RegisterRolePage.test.tsx` : [PASS] **« Je suis client » ramène vers /ci/inscription/client** — idem en `REPLACE`
  - `frontend/src/pages/RegisterRolePage.test.tsx` : [PASS] **cliquer l'onglet déjà actif ne déclenche aucune navigation** — `nav-type` reste `POP` et le nœud `clerk-signup` est identique (mêmes références DOM)
  - `frontend/src/pages/RegisterRolePage.test.tsx` : [PASS] **remonte le formulaire Clerk quand le rôle change** — nouveau nœud `clerk-signup` (remonage du composant)

  **jeton Clerk (2)**
  - `frontend/src/pages/RegisterRolePage.test.tsx` : [PASS] **enregistre getToken comme getter de jeton d'autorisation** — `setAuthTokenGetter` appelé 1 fois avec une fonction
  - `frontend/src/pages/RegisterRolePage.test.tsx` : [PASS] **le getter enregistré renvoie le jeton de session de Clerk** — `getter()` résout `'session-token'`

  **bootstrap d'un utilisateur connecté (8)**
  - `frontend/src/pages/RegisterRolePage.test.tsx` : [PASS] **bootstrap le rôle client puis redirige vers /ci** — `bootstrap({ role: 'client', market: 'CI' })`, pathname `^/ci$`
  - `frontend/src/pages/RegisterRolePage.test.tsx` : [PASS] **bootstrap le rôle gérant du marché bj puis redirige vers /bj** — `bootstrap({ role: 'gerant', market: 'BJ' })`
  - `frontend/src/pages/RegisterRolePage.test.tsx` : [PASS] **redirige même quand le bootstrap échoue** — rejet de `bootstrap` → redirection quand même, aucun `alert`
  - `frontend/src/pages/RegisterRolePage.test.tsx` : [PASS] **n'appelle bootstrap qu'une seule fois par rendu connecté** — 1 appel après résolution de la redirection
  - `frontend/src/pages/RegisterRolePage.test.tsx` : [PASS] **n'appelle pas bootstrap pour un visiteur déconnecté** — `bootstrap` non appelé, formulaire Clerk affiché
  - `frontend/src/pages/RegisterRolePage.test.tsx` : [PASS] **n'appelle pas bootstrap tant que Clerk n'a pas chargé** — `isLoaded: false` → aucun appel, pas de navigation
  - `frontend/src/pages/RegisterRolePage.test.tsx` : [PASS] **ne déclenche aucune requête réseau non mockée** — `request`/`cachedGet` jamais appelés même connecté
  - `frontend/src/pages/RegisterRolePage.test.tsx` : [PASS] **n'effectue aucune navigation si la page est démontée pendant le bootstrap** — `rerenderHost({ showPage: false })` avant résolution → `cancelled` évite le `navigate`, pathname inchangé

  **racine /inscription (2)**
  - `frontend/src/pages/RegisterRolePage.test.tsx` : [PASS] **redirige /ci/inscription vers /ci/inscription/client** — `window.history.replaceState` + `pathname` observé via sonde, `nav-type="REPLACE"`, `bootstrap` non appelé
  - `frontend/src/pages/RegisterRolePage.test.tsx` : [PASS] **redirige /bj/inscription vers /bj/inscription/client** — même mécanique côté marché béninois

  **clé Clerk absente (3)**
  - `frontend/src/pages/RegisterRolePage.test.tsx` : [PASS] **signale l'absence de clé Clerk plutôt que d'afficher le formulaire** — `vi.stubEnv` + `vi.resetModules()` + import dynamique → « Clé Clerk manquante dans frontend/.env », pas de `clerk-signup`
  - `frontend/src/pages/RegisterRolePage.test.tsx` : [PASS] **refuse une clé Clerk qui ne commence pas par pk_** — clé `sk_test_…` considérée comme absente (mêmes messages)
  - `frontend/src/pages/RegisterRolePage.test.tsx` : [PASS] **ne tente aucun bootstrap sans clé Clerk, même connecté** — `isSignedIn: true` mais `bootstrap` non appelé et pathname conservé

**Total : 183 tests ajoutés (57 + 39 + 30 + 24 + 33), tous PASS.**

## ÉCHECS À CORRIGER

- **Aucun.** Les 5 fichiers de ma vague sont verts à la livraison (`npx vitest run … --reporter=verbose` → 5 fichiers / 183 tests PASS), et la suite globale est intégralement verte (70 fichiers / 1186 tests).

### Corrections effectuées en cours de vague (uniquement dans `ClientComptePage.test.tsx`)

7 échecs rencontrés sur `frontend/src/pages/ClientComptePage.test.tsx` ont été réparés **après coup, dans le fichier de test uniquement — aucun fichier source n'a été modifié pour les résoudre** :

1. **Décompte du bandeau** : le bandeau « Vous avez N séjour(s) confirmé(s)… » ne compte que les séjours confirmés **non encore notés** ; l'attendu est passé de 2 à 1 quand « Chambre vue » est déjà noté (et l'assertion inverse — absence d'un « Vous avez 2… » — a été ajoutée).
2. **Portée des radiogroupes** : les deux groupes d'étoiles (appartement / gérant) exposent les mêmes libellés de boutons ; les clics et lectures sont désormais cadrés par `within(dialog).getByRole('radiogroup', { name: … })` pour éviter l'ambiguïté.
3. **Portée des boutons « Annuler » / « Envoi... »** : le même libellé existe sur les cartes de réservation et dans le formulaire de notation → assertions resserrées avec `within(dialog)`.
4. **Getter de jeton lazy** : `setAuthTokenGetter` n'enregistre qu'une fonction, l'API l'appellera plus tard ; le test déréférence maintenant `mocks.setAuthTokenGetter.mock.calls[0][0]` et l'invoque explicitement (`await expect(getter()).resolves.toBe('token-test')`) au lieu d'attendre un appel automatique.
5. **Fallback d'image** : distinguer `room.img: null` (aucun `img`, uniquement `.client-compte__card-media-fallback`) d'une photo présente (le titre sert d'`alt`), et ne pas confondre le repli avec une vraie image.
6. (Les 2 corrections restantes portent sur les mêmes familles : sélection de carte via `.client-compte__card-title` et comptage d'`alert` — assertions recalées sur le rendu réel.)

## Observations / points d'attention

1. **`window.location.pathname` est lu au montage dans `RegisterRolePage`** (ligne 60), alors que la navigation des tests passe par `MemoryRouter`. Les deux tests « racine /inscription » doivent donc écrire le vrai document avec `window.history.replaceState({}, '', '/ci/inscription')` **avant** le `render`, et l'`afterEach` remet `window.history.replaceState({}, '', '/')` : sinon le test suivant hérite du `pathname` précédent et déclenche une redirection parasite. C'est l'unique endroit du périmètre où le vrai `window.location` intervient.
2. **`catch {}` muet autour de `apiAuth.bootstrap`** (`RegisterRolePage.tsx:44-46`) : un échec du bootstrap est avalé et la redirection vers `/{marché}` a lieu quand même (« le guard de destination retentera / affichera l'erreur »). Le test **redirige même quand le bootstrap échoue** fige ce comportement : aucun `alert`, pas de page d'erreur côté inscription.
3. **Les avis sont perdus silencieusement si `listMine()` échoue** (`ClientComptePage.tsx:136` : `apiReviews.listMine().catch(() => [])`) : la page reste fonctionnelle, mais **tous** les séjours confirmés redeviennent « notables » — le bandeau repasse à 2 au lieu de 1. C'est l'objet du test « continue de fonctionner si la liste des avis échoue ». À l'inverse, un rejet de `getMyReservations` fait basculer la page en `role="alert"` : les deux niveaux de tolérance sont asymétriques.
4. **`pointerEventsCheck` doit être un nombre sous `@testing-library/user-event` 14.6.7** : l'option est typée `PointerEventsCheckLevel | number` (le booléen `true/false` des versions antérieures n'est plus accepté, erreur `tsc`). `RegisterRolePage.test.tsx` utilise `userEvent.setup({ delay: null, pointerEventsCheck: 0 })`, tandis que `CategoryPage` et `SearchResultsPage` passent par l'API statique `userEvent.click` / `userEvent.selectOptions` (aucun `setup`), donc aucune option à typer.
5. **Verrou réseau systématique** : dans les 5 fichiers, `request` et `cachedGet` de `../lib/api` sont mockés et **rejettent par défaut**, avec en plus un test dédié « ne laisse partir aucune requête réseau non mockée ». Deux styles coexistent : mock **partiel avec `importOriginal`** (`ClientComptePage`, `SearchResultsPage`, `CategoryPage` — conserve helpers, types et valeurs `statutLabels`) et mock **total sans `importOriginal`** (`RoomDetailPage`, `RegisterRolePage` — la page n'importe que les symboles déclarés). Aucun test du périmètre ne dépend du réseau.
6. **Attendre le bon signal de rendu.** `SearchResultsPage` attend « 3 biens trouvés » et non le `h1` : le plafond de prix (`priceMax`) n'est calculé qu'après le premier rendu des biens, ce qui laisse un rendu transitoire « 0 biens trouvés » avec le titre déjà visible. `CategoryPage` attend lui le `h1` de la catégorie. Les deux `beforeEach` de bloc attendent donc le signal adapté avant chaque assertion.
7. **`input type="date"` sous jsdom vide toute valeur non normalisable** (« 2026-02-31 » → `''`) : c'est le **seul** chemin d'erreur de date atteignable depuis l'interface (commenté dans le test de validation de `RoomDetailPage`). De même, `navigator.clipboard` n'existe pas dans jsdom : le test de partage l'injecte avec `Object.defineProperty(…, { configurable: true })` et le supprime en `afterEach` (`Reflect.deleteProperty`) pour ne pas polluer les tests suivants.
8. **Stub jsdom hoisté** : dans `RegisterRolePage.test.tsx`, `matchMedia`, `scrollIntoView`, `scrollTo` et `window.scrollTo` sont posés **dans le bloc `vi.hoisted()`**, avant l'évaluation des factories `vi.mock` (qui sont hoistées au-dessus des imports). Aucun de ces tests n'a eu besoin du mock de `react-leaflet` : contrairement aux pages gérant/admin, **aucune de ces 5 pages n'importe `PropertyMap`** (le mock `react-leaflet` n'existe que dans `PropertyMap.test.tsx`, `AdminGerantDrawer.test.tsx` et `VerificationPage.test.tsx`).
9. **Les pages restent exclues de `coverage.include`** dans `vite.config.ts` (choix assumé, inchangé) : la mesure ne couvre que `src/lib/**`, `src/data/**`, `src/hooks/**`, `src/utils/**`, `src/contexts/**` et 3 composants (`RoleRouteGuard`, `AdminRouteGuard`, `StayCard`). Ces 183 tests n'impacteront donc ni en plus ni en moins le pourcentage de couverture publié — ils valident le comportement, pas la métrique.
10. **Comportements source figés comme « actuels »** : le bouton de partage confirme même sans API `clipboard` (2 s puis retour à « Partager »), la galerie boucle sur les flèches, la durée par défaut vaut 1 nuit (donc valide sur un formulaire vide : 4 `alert` et non 5), `catégorie absente du référentiel` masque simplement le fil d'Ariane, et `SearchResultsPage` convertit toute erreur de disponibilité en état vide plutôt qu'en message d'erreur.
11. **Aucun fichier source, config ni autre rapport modifié** : uniquement les 5 fichiers `.test.tsx` du périmètre. La baseline 38/479 précède l'ensemble de la vague P ; les 70 fichiers / 1186 tests constatés incluent les vagues voisines (dont la réparation de `ClientComptePage` et les ajouts P1/P2/P3/P5). Lint (`oxlint --deny-warnings`) et `npx tsc -b` sont passés au moment de la rédaction (exit 0) et peuvent redevenir rouges si une autre vague écrit un fichier non conforme ensuite.

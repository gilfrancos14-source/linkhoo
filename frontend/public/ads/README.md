# Espace publicitaire du hero

Les visuels placés ici sont affichés dans le cercle publicitaire à droite du hero
(landing + pages marché), en défilement automatique toutes les 4 secondes.

Formats acceptés : **JPG, PNG, WebP, SVG et GIF animé** (le GIF est animé
automatiquement par le navigateur, aucune configuration supplémentaire).

## Publier une offre

1. Déposer le fichier dans ce dossier, par exemple `offre-black-friday.gif`.
2. Renseigner son chemin (`/ads/offre-black-friday.gif`) dans
   `src/components/landing/partnerAds.ts`, avec la clé de texte i18n associée.
3. Ajouter si besoin un `href` pour rendre le visuel cliquable.

Recommandation : image **carrée** (idéalement 520 × 520 px ou plus) pour un rendu
net dans le cercle de 260 px. Le texte i18n reste affiché en repli si le visuel
est absent ou ne charge pas.

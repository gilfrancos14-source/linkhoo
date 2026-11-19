# PWA — état actuel (audit sécurité)

> **Document obsolète remplacé.** Les variantes `*PWA` (pages de suivi et de
> paiement) et la file d’attente du Service Worker ont été supprimées lors de
> l’audit de sécurité : elles permettaient de rejouer des requêtes de paiement
> et de persister des jetons/PII côté navigateur.

État retenu :

- `public/sw.js` (v4) : cache uniquement des GET publics marqués
  `X-Public-Api: 1`, aucun cache/file d’attente pour les requêtes
  authentifiées ni pour `/api/reservations/*`, `/api/premium/*`,
  `/api/payments/*` et `/api/auth/*`.
- `src/lib/offlineQueue.ts` : file locale limitée aux actions non financières,
  TTL 7 jours, email du formulaire remplacé par une valeur neutre, purge au
  logout via `src/lib/pwaCleanup.ts`.
- `src/lib/navigation.ts` : redirection checkée (HTTPS + domaine pawaPay).
- Les tokens de confirmation de paiement transitent par l’URL de retour
  (`/{market}/reservation/paiement/:token`) et sont vérifiés côté serveur.

# PWA — intégration

> **Guide historique remplacé par `README-PWA-Phase2.md`.**
> Les composants/pages `PWAIntegration`, `ReservationPaymentPagePWA` et
> `ClientReservationPagePWA` n’existent plus : ils n’étaient pas montés dans
> l’application et contoursaient les garde-fous de paiement.

Ce qui reste branché dans l’application :

- `Footer.tsx` et `components/landing/LandingFooter.tsx` montent
  `PWAControlPanel` en mode inline.
- `useOfflineQueue`, `useCacheManager` et `usePushNotifications` restent
  utilisés par ce panneau, mais la file est désormais limitée aux requêtes sûres
  (POST non-financier, TTL 7 jours, purge au logout).
- Le Service Worker (`public/sw.js` v4) n’intercepte plus les flux de paiement.

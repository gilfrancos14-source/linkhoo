-- ============================================================
-- 0034 — Favoris des clients
-- ============================================================
-- Un favori est un geste explicite du client (clic sur le cœur), indépendant
-- de toute réservation : réserver une chambre ne doit pas l'ajouter aux
-- favoris, et annuler une réservation ne doit pas la retirer.
--
-- La clé primaire composite (client_id, room_id) rend l'ajout idempotent :
-- re-cliquer sur un cœur déjà actif ne crée jamais de doublon.
--
-- Exécuter via `npm run migrate -- --yes` (pré-vol : `npm run migrate:check`).

CREATE TABLE IF NOT EXISTS client_favorites (
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (client_id, room_id)
);

-- Liste des favoris d'un client, du plus récent au plus ancien.
CREATE INDEX IF NOT EXISTS idx_client_favorites_client_created
  ON client_favorites (client_id, created_at DESC);

-- Suppression en cascade depuis la chambre (rooms) : l'index room_id évite
-- un balayage complet de la table à chaque suppression d'annonce.
CREATE INDEX IF NOT EXISTS idx_client_favorites_room
  ON client_favorites (room_id);

-- Le backend lit/écrit avec la clé service (bypass RLS). Sans politique,
-- la clé anon ne peut jamais lire les favoris d'un client : le classement
-- reste privé même si le front interroge Supabase directement.
ALTER TABLE client_favorites ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- P1 #6 — Index composites sur les dates de réservation
--
-- Le test de chevauchement (has_date_conflict / create_reservation_checked)
-- filtre sur (room_id, date_debut, date_fin). L'index existant sur room_id
-- seul oblige à vérifier TOUTES les réservations d'une chambre ; l'index
-- composite permet un Index Range Scan direct sur l'intervalle de dates.
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_reservations_room_dates
  ON reservations (room_id, date_debut, date_fin);

-- L'admin pagine par (created_at DESC, id ASC) : l'index existant sur
-- created_at seul suffit pour le tri, l'id sert d'amortisseur d'égalité.

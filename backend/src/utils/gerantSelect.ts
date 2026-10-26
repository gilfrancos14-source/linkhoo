// F3 : listes de colonnes explicites au lieu de `select('*')`.
//
// `*` renvoie aujourd'hui des colonnes internes (et en renverrait de nouvelles
// automatiquement après toute migration). Ces constantes figent le contrat
// public des profils gérants et des documents de vérification.
//
// Ce sont des littéraux (pas des `.join()`) : supabase-js infère les types de
// ligne à partir du type littéral de la chaîne.

export const GERANT_COLUMNS =
  'id, clerk_user_id, email, nom, prenom, phone, address, date_of_birth, nationality, market, is_verified, verified_at, verification_requested_at, verification_status, verification_rejection_reason, verification_submitted_at, verification_reviewed_at, property_maps_url, property_lat, property_lng, is_premium, premium_expires_at, created_at';

// `file_url` est volontairement exclue : elle est toujours signée à la lecture
// et n'est plus persistée (voir migrations 0023 et routes/gerants.ts).
export const VERIFICATION_DOCUMENT_COLUMNS =
  'id, gerant_id, document_type, file_path, original_filename, mime_type, file_size, status, rejection_reason, reviewed_by, reviewed_at, created_at';

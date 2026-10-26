// Listes de colonnes explicites, en remplacement de `select('*')`.
//
// `*` expose aujourd'hui toute colonne interne et, surtout, exposerait
// automatiquement celles ajoutées par une migration future. Ces constantes
// figent le contrat public de chaque lecture.
//
// Ce sont des littéraux (pas de `.join()`) : supabase-js infère les types de
// ligne à partir du type littéral de la chaîne. Les colonnes suivent les
// migrations d'installation (0001, 0002, 0004, 0016, 0017).

export const ROOM_COLUMNS =
  'id, title, subtitle, info, price, price_num, price_unit, img, alt, images, description, capacity, category, market, pays, ville, quartier, chambres, douches, disponible, date_dispo, conditions, gerant_id, promo_group, promo_start, promo_end, is_popular, created_at, updated_at';

export const CATEGORY_COLUMNS = 'id, title, img, alt, market';

// `order` est un mot réservé SQL : PostgREST exige l'identifiant cité.
export const BANNER_COLUMNS = 'id, section, img, alt, link, market, "order", created_at';

// `client_key` est une clé d'idempotence interne : jamais renvoyée au client.
export const RESERVATION_COLUMNS =
  'id, client_name, client_email, client_phone, room_id, room_title, date_debut, date_fin, montant, duree_nombre, duree_unite, message, statut, created_at, responded_at';

export const NOTIFICATION_COLUMNS =
  'id, type, room_title, room_id, client_name, client_email, client_phone, message, date, read, reservation_id, gerant_id';

export const CLIENT_NOTIFICATION_COLUMNS =
  'id, type, room_title, room_id, client_email, message, date, read';

export const CLIENT_COLUMNS =
  'id, clerk_user_id, email, nom, prenom, telephone, created_at, updated_at';

export const EVENT_COLUMNS = 'id, market, city, title, description, event_date, img, alt, created_at';

export const TOURISM_COLUMNS =
  'id, market, city, title, description, img, alt, featured, created_at';

export const ESCAPADE_COLUMNS = 'id, market, lieu, description, images, created_at';

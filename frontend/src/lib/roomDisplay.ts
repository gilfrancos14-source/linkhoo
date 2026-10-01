/** Formattage et valeurs de repli partagés par toutes les vues d'un bien. */

/** Sous-espaces insécables déjà présents dans certaines données seed. */
const SPACES = /[\s\u00A0\u202F\u2009]/g;

const CURRENCY_RE = /fcfa|€|euro/i;

/** Longueur maximale d'un sous-titre de carte. */
export const SUBTITLE_MAX = 120;

/**
 * Groupe les milliers d'un prix avec une espace ASCII : '75000' → '75 000'.
 * Idempotent sur les données déjà groupées ('15 000' reste '15 000') et
 * renvoie la valeur brute quand elle n'est pas purement numérique
 * ('50 000 FCFA', 'sur demande', …).
 */
export function formatPrice(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const raw = String(value).trim();
  if (!raw) return '';
  const compact = raw.replace(SPACES, '');
  if (!/^\d+$/.test(compact)) return raw;
  return compact.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/**
 * Prix affichable : groupé, avec « FCFA » seulement si la devise n'est déjà
 * présente ni dans le prix ni dans l'unité (évite « FCFA FCFA »).
 */
export function priceWithCurrency(
  price: string | number | null | undefined,
  priceUnit?: string | null,
): string {
  const formatted = formatPrice(price);
  if (!formatted) return '';
  if (CURRENCY_RE.test(`${formatted} ${priceUnit ?? ''}`)) return formatted;
  return `${formatted} FCFA`;
}

/** '1' → '1 personne', 4 → '4 personnes'. */
export function formatCapacity(count: number): string {
  const safe = Number.isFinite(count) && count > 0 ? Math.floor(count) : 1;
  return `${safe} personne${safe > 1 ? 's' : ''}`;
}

function firstSentence(text: string | null | undefined): string {
  const trimmed = (text ?? '').trim();
  if (!trimmed) return '';
  const stop = trimmed.search(/[.!?…]/);
  const sentence = stop >= 0 ? trimmed.slice(0, stop + 1) : trimmed;
  if (sentence.length <= SUBTITLE_MAX) return sentence;
  return `${trimmed.slice(0, SUBTITLE_MAX - 1).trimEnd()}…`;
}

export interface RoomSubtitleSource {
  subtitle?: string | null;
  description?: string | null;
  quartier?: string | null;
  ville?: string | null;
}

/**
 * Texte sous le titre sur une carte. Les chambres saisies sans sous-titre
 * (formulaires antérieurs) retombent sur la première phrase de la
 * description, puis sur le lieu — on n'affiche jamais une ligne vide.
 */
export function roomSubtitle(room: RoomSubtitleSource): string {
  const subtitle = (room.subtitle ?? '').trim();
  if (subtitle) return subtitle;
  const fromDescription = firstSentence(room.description);
  if (fromDescription) return fromDescription;
  return [room.quartier, room.ville]
    .map((value) => (value ?? '').trim())
    .filter(Boolean)
    .join(', ');
}

export interface RoomMetaSource {
  chambres?: number | null;
}

/**
 * Pastilles sous le titre d'une carte (le nombre de chambres). Les valeurs
 * absentes sont retirées : jamais de puce vide.
 */
export function roomMeta(room: RoomMetaSource): string[] {
  const chambres = Math.floor(Number(room.chambres));
  if (!Number.isFinite(chambres) || chambres <= 0) return [];
  return [`${chambres} chambre${chambres > 1 ? 's' : ''}`];
}

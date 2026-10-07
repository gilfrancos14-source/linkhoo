import type { MarketCode } from '../config/markets';

import type { DureeUnite } from './duration';

export const API_BASE = '/api';

export const REQUEST_TIMEOUT_MS = 15_000;

/** Attente maximale du jeton Clerk avant de requêter sans lui : un appel
   dont le getter ne résout jamais (clerk-js absent, hors-ligne) ne doit
   jamais bloquer une requête — surtout pas un GET public de la home. */
export const AUTH_TOKEN_WAIT_MS = 4_000;

let authTokenGetter: (() => Promise<string | null>) | null = null;

export function setAuthTokenGetter(getter: () => Promise<string | null>) {
  authTokenGetter = getter;
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), ms);
      }),
    ]);
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Jeton courant, borné : jamais d'attente indéfinie (voir AUTH_TOKEN_WAIT_MS). */
async function resolveAuthToken(): Promise<string | null> {
  if (!authTokenGetter) return null;
  return withTimeout(authTokenGetter(), AUTH_TOKEN_WAIT_MS);
}

// ── Cache public (GET) ──
// Déduplication des appels en vol + TTL : les 4 sections de la home qui
// demandent les mêmes bannières/salles ne déclenchent qu'une seule requête
// réseau, et un retour sur l'accueil ne re-télécharge rien pendant `ttl`.
//
// Règles :
// - ne mettre en cache QUE des endpoints publics (réponses identiques pour
//   tous les utilisateurs) ;
// - ne JAMAIS muter le tableau/objet résolu : il est partagé entre tous les
//   consommateurs (toujours .map()/.filter(), jamais .sort() sur place) ;
// - toute écriture appelle clearApiCache() via request()/adminRequest().
const PUBLIC_CACHE_TTL_MS = 60_000;
const publicCache = new Map<string, { expires: number; promise: Promise<unknown> }>();

export function clearApiCache(): void {
  publicCache.clear();
}

/** Mutations qui ne changent aucun contenu public : pas de purge de cache. */
const NO_CACHE_PURGE_PATHS = new Set(['/boosts/impression', '/boosts/click']);

export async function cachedGet<T>(path: string, ttlMs = PUBLIC_CACHE_TTL_MS): Promise<T> {
  const now = Date.now();
  const hit = publicCache.get(path);
  if (hit && hit.expires > now) return hit.promise as Promise<T>;

  // `cache: 'no-cache'` force une revalidation conditionnelle (304) auprès du
  // serveur : après une mutation qui a purgé ce cache mémoire, la réponse
  // serveur fraîche doit être visible immédiatement — le cache HTTP du
  // navigateur ne doit jamais nous servir une version périmée.
  const promise = request<T>(path, { cache: 'no-cache', public: true }).catch((err) => {
    // Une erreur n'est jamais mise en cache : le prochain appel réessaiera.
    publicCache.delete(path);
    throw err;
  });
  publicCache.set(path, { expires: now + ttlMs, promise });
  return promise;
}

/**
 * Lit une réponse JSON en tolérant un corps vide : `res.json()` lève
 * « Unexpected end of JSON input » sur une 204 ou une réponse sans corps.
 */
export async function parseJsonBody<T>(res: Response): Promise<T> {
  if (res.status === 204 || res.status === 205) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

/** Options étendues : `public` marque un GET d'endpoint public. */
export interface RequestOptions extends RequestInit {
  /** GET public : ni attente ni envoi du jeton. Nécessaire pour que le
      service worker puisse intercepter et mettre en cache ces requêtes
      (il refuse toute requête portant `Authorization`). */
  public?: boolean;
}

/**
 * Erreur HTTP porteuse du statut : `instanceof Error` reste vrai pour tous
 * les appelants, et la file offline s'en sert pour distinguer un échec
 * définitif (4xx hors 408/429 → l'élément est retiré de la file) d'une
 * erreur transitoire (réseau, timeout, 5xx → nouvelle tentative).
 */
export class ApiError extends Error {
  readonly status: number;
  /** Détail serveur du refus (ex. `status: 'declined' | 'pending'` d'une
      transaction FedaPay) — seul moyen de distinguer un refus d'un retard. */
  readonly detail: unknown;

  constructor(message: string, status: number, detail?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

export async function request<T>(path: string, options?: RequestOptions): Promise<T> {
  const { public: isPublic, headers: extraHeaders, ...rest } = options ?? {};
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(extraHeaders as Record<string, string> | undefined),
  };

  if (!isPublic) {
    const token = await resolveAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers,
    signal: rest.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  }).catch((e: unknown) => {
    if (e instanceof Error && e.name === 'TimeoutError') {
      throw new Error('Délai dépassé. Vérifiez votre connexion puis réessayez.');
    }
    throw e;
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.error || `API error ${res.status}`, res.status, body.status);
  }
  // Toute mutation invalide le cache public : une création/édition ne doit
  // jamais être masquée par une réponse mise en cache 60 s plus tôt.
  // Exception m5 : les événements de tracking Boost ne changent AUCUN contenu
  // public — 6 impressions sur la landing ne doivent pas purger bannières,
  // salles et avis.
  if ((rest.method ?? 'GET').toUpperCase() !== 'GET' && !NO_CACHE_PURGE_PATHS.has(path)) {
    clearApiCache();
  }
  return parseJsonBody<T>(res);
}

// ── Rooms ──
export interface GerantInfo {
  nom: string;
  prenom: string;
  phone: string | null;
  is_verified: boolean;
  is_premium: boolean;
  /** Date d'expiration de l'abonnement : requise pour calculer l'activité
      du badge (`isPremiumActive`) — sans elle, un premium expiré reste « actif ». */
  premium_expires_at?: string | null;
}

export interface RoomData {
  id: string;
  title: string;
  subtitle: string;
  info: string;
  price: string;
  price_num: number;
  price_unit: string;
  img: string;
  alt: string;
  images: string[];
  description: string;
  capacity?: string;
  category: string;
  market: MarketCode;
  pays: string;
  ville: string;
  quartier: string;
  chambres: number;
  douches: number;
  disponible: boolean;
  date_dispo: string;
  conditions: string;
  gerant_id?: string;
  gerant?: GerantInfo;
  /** Position boostée par l'abonnement du gérant (quota 1 sur 3 en recherche). */
  gerant_premium?: boolean;
  is_popular?: boolean;
  promo_group?: string | null;
  promo_start?: string | null;
  promo_end?: string | null;
}

export interface RoomListParams {
  market?: string;
  ville?: string;
  quartier?: string;
  category?: string;
  prixMin?: number;
  prixMax?: number;
  chambres?: number;
  disponible?: boolean;
  page?: number;
  limit?: number;
}

export interface RoomListPage {
  items: RoomData[];
  total: number;
  page: number;
  limit: number;
}

export const apiRooms = {
  // `fresh: true` contourne le cache mémoire : réservé aux écrans de gestion
  // (back-office) qui doivent refléter l'état exact de la base au montage.
  list: (market?: string, opts?: { fresh?: boolean }) => {
    const path = market ? `/rooms?market=${market}` : '/rooms';
    if (opts?.fresh) return request<RoomData[]>(path, { cache: 'no-cache' });
    return cachedGet<RoomData[]>(path);
  },
  // Liste filtrée et paginée côté serveur : la page ne télécharge plus
  // tout le catalogue pour filtrer en mémoire.
  listPaged: (params: RoomListParams) => {
    const search = new URLSearchParams();
    if (params.market) search.set('market', params.market);
    if (params.ville) search.set('ville', params.ville);
    if (params.quartier) search.set('quartier', params.quartier);
    if (params.category) search.set('category', params.category);
    if (params.prixMin !== undefined) search.set('prix_min', String(params.prixMin));
    if (params.prixMax !== undefined) search.set('prix_max', String(params.prixMax));
    if (params.chambres !== undefined) search.set('chambres', String(params.chambres));
    if (params.disponible !== undefined) search.set('disponible', String(params.disponible));
    if (params.page !== undefined) search.set('page', String(params.page));
    if (params.limit !== undefined) search.set('limit', String(params.limit));
    const qs = search.toString();
    return cachedGet<RoomListPage>(`/rooms${qs ? `?${qs}` : ''}`);
  },
  listMine: () => request<RoomData[]>('/rooms/mine'),
  getPopular: (market: string) => cachedGet<RoomData[]>(`/rooms/popular?market=${market}`),
  listAvailable: (market: string, arrivee: string, depart: string, ville?: string) =>
    request<RoomData[]>(
      `/rooms/available?market=${market}&arrivee=${arrivee}&depart=${depart}` +
        (ville ? `&ville=${encodeURIComponent(ville)}` : '')
    ),
  get: (id: string) => request<RoomData>(`/rooms/${id}`, { public: true }),
  villes: (market?: string) =>
    request<string[]>(market ? `/rooms/villes?market=${market}` : '/rooms/villes', { public: true }),
  quartiers: (market?: string) =>
    request<string[]>(market ? `/rooms/quartiers?market=${market}` : '/rooms/quartiers', { public: true }),
  create: (data: Omit<RoomData, 'id'>) => request<RoomData>('/rooms', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<RoomData>) => request<RoomData>(`/rooms/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request<void>(`/rooms/${id}`, { method: 'DELETE' }),
  toggle: (id: string) => request<RoomData>(`/rooms/${id}/toggle`, { method: 'PATCH' }),
};

// ── Banners ──
export interface BannerData {
  id: string;
  section: string;
  img: string;
  alt: string;
  link: string;
  market: MarketCode;
  order: number;
}

export const apiBanners = {
  list: (market?: string) => cachedGet<BannerData[]>(market ? `/banners?market=${market}` : '/banners'),
};

// ── Events ──
// `market` est obligatoire côté API (400 sinon) : sans lui, les villes CI et
// BJ se mélangeraient et le marqueur de la carte serait faux.
export interface EventData {
  id: string;
  market: MarketCode;
  city: string;
  title: string;
  description: string;
  event_date: string;
  img: string | null;
  alt: string | null;
  created_at?: string;
}

export const apiEvents = {
  list: (market: string) => cachedGet<EventData[]>(`/events?market=${market}`),
};

// ── Tourisme ──
// Une destination = une carte de la section Tourisme. Le serveur répond par
// la partition { big, small } : `big` = les grosses cartes (ville avec un
// événement dans les 30 prochains jours, ou « mettre en avant » coché par un
// admin), `small` = le reste — jamais de carte inventée pour compléter.
export interface DestinationData {
  id: string;
  market: MarketCode;
  city: string;
  title: string;
  description: string;
  img: string;
  alt: string | null;
  featured: boolean;
  created_at?: string;
}

export interface TourismPartition {
  big: DestinationData[];
  small: DestinationData[];
}

export const apiTourism = {
  list: (market: string) => cachedGet<TourismPartition>(`/tourism?market=${market}`),
};

// ── Reservations ──
export interface ReservationData {
  id: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  room_id: string;
  room_title: string;
  date_debut: string;
  date_fin: string;
  duree_nombre: number | null;
  duree_unite: DureeUnite | null;
  montant: number;
  statut: 'en_attente' | 'confirmee' | 'annulee';
  created_at: string;
  responded_at: string | null;
  gerant_phone?: string | null;
  gerant_nom?: string | null;
  gerant_prenom?: string | null;
  gerant_is_verified?: boolean;
  gerant_is_premium?: boolean;
  /** Clé d'idempotence générée côté client (anti doublon des rejeux). */
  client_key?: string | null;
}

export interface ClientReservationData {
  id: string;
  room_title: string;
  date_debut: string;
  date_fin: string;
  duree_nombre: number | null;
  duree_unite: DureeUnite | null;
  statut: 'en_attente' | 'confirmee' | 'annulee';
  created_at: string;
}

export interface ClientMineReservationData extends ClientReservationData {
  room_id: string | null;
  montant: number | null;
  responded_at: string | null;
  room?: { img: string | null; alt: string | null; description: string | null } | null;
}

export type ReservationCreatePayload = Omit<
  ReservationData,
  'id' | 'created_at' | 'responded_at' | 'statut' | 'duree_nombre' | 'duree_unite'
> & {
  duree_nombre: number;
  duree_unite: DureeUnite;
};

export const apiReservations = {
  list: () => request<ReservationData[]>('/reservations'),
  listMine: () => request<ClientMineReservationData[]>('/reservations/mine'),
  cancelMine: (id: string) =>
    request<ClientMineReservationData>(`/reservations/${id}/cancel`, { method: 'POST' }),
  create: (data: ReservationCreatePayload) => request<ReservationData>('/reservations', { method: 'POST', body: JSON.stringify(data) }),
  updateStatut: (id: string, statut: string) => request<ReservationData>(`/reservations/${id}`, { method: 'PATCH', body: JSON.stringify({ statut }) }),
  checkConflict: (roomId: string, dateDebut: string, dateFin: string, excludeId?: string) =>
    request<{ hasConflict: boolean }>(`/reservations/check?room_id=${roomId}&date_debut=${dateDebut}&date_fin=${dateFin}${excludeId ? `&exclude_id=${excludeId}` : ''}`),
};

// ── Newsletter ──
interface NewsletterSubscribeData {
  email: string;
  market?: MarketCode;
}

export const apiNewsletter = {
  subscribe: (data: NewsletterSubscribeData) =>
    request<{ id?: string; email?: string; message?: string }>('/newsletter', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// ── Contact (formulaire « Contactez-nous ») ──
export interface ContactPayload {
  nom: string;
  prenom?: string;
  email: string;
  telephone?: string;
  pays: string;
  sujet: 'reservation' | 'compte-gerant' | 'partenariat' | 'presse' | 'autre';
  message: string;
  market?: MarketCode;
  /** Pot de miel : doit rester vide (vide côté client, rempli par les robots). */
  website?: string;
}

export const apiContact = {
  send: (data: ContactPayload) =>
    request<{ message: string; id?: string }>('/contact', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// ── Notifications ──
export const apiNotifications = {
  listAdmin: () => request<any[]>('/notifications'),
  listClient: () => request<any[]>('/notifications/client'),
  markRead: (id: string) => request<void>(`/notifications/${id}/read`, { method: 'PATCH' }),
  markReadClient: (id: string) => request<void>(`/notifications/client/${id}/read`, { method: 'PATCH' }),
  createClient: (data: any) => request<any>('/notifications/client', { method: 'POST', body: JSON.stringify(data) }),
};

// ── Upload ──
export const apiUpload = {
  upload: async (file: File, bucket?: string): Promise<{ url: string; path: string }> => {
    const headers: Record<string, string> = {};
    if (authTokenGetter) {
      const token = await authTokenGetter();
      if (token) headers['Authorization'] = `Bearer ${token}`;
    }
    const formData = new FormData();
    formData.append('file', file);
    if (bucket) formData.append('bucket', bucket);
    const res = await fetch(`${API_BASE}/upload`, { method: 'POST', headers, body: formData });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || 'Upload failed');
    }
    const data = await parseJsonBody<{ url: string; path: string }>(res);
    if (!data?.url) throw new Error('Upload failed: réponse vide');
    return data;
  },
};

// ── Gerants ──
export interface GerantData {
  id: string;
  clerk_user_id: string;
  email: string;
  nom: string;
  prenom: string;
  phone: string | null;
  /** Adresse de domicile saisie à l'étape 1 de la vérification. */
  address?: string | null;
  market: MarketCode;
  is_verified: boolean;
  verified_at: string | null;
  verification_requested_at: string | null;
  verification_status: 'none' | 'pending' | 'under_review' | 'approved' | 'rejected';
  verification_rejection_reason: string | null;
  verification_submitted_at: string | null;
  verification_reviewed_at: string | null;
  property_maps_url: string | null;
  property_lat: number | null;
  property_lng: number | null;
  is_premium: boolean;
  premium_expires_at: string | null;
  created_at: string;
}

export type VerificationDocType = 'national_id' | 'selfie' | 'id_card_front' | 'id_card_back';

export interface VerificationDocument {
  id: string;
  gerant_id: string;
  document_type: VerificationDocType;
  file_url: string;
  file_path: string;
  original_filename: string | null;
  mime_type: string | null;
  file_size: number | null;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

interface PropertyAddress {
  property_maps_url: string | null;
  property_lat: number | null;
  property_lng: number | null;
}

export interface VerificationStatusResponse extends PropertyAddress {
  verification_status: string;
  verification_rejection_reason: string | null;
  verification_submitted_at: string | null;
  verification_reviewed_at: string | null;
  documents: VerificationDocument[];
}

export const apiGerants = {
  getMe: () => {
    return request<GerantData>('/gerants/me');
  },
  updateMe: (data: { nom?: string; prenom?: string; phone?: string; address?: string }) =>
    request<GerantData>('/gerants/me', { method: 'PATCH', body: JSON.stringify(data) }),
  deleteDocument: (id: string, docId: string) =>
    request<void>(`/gerants/${id}/documents/${docId}`, { method: 'DELETE' }),
  submitVerification: (id: string) =>
    request<{ success: boolean; gerant: GerantData }>(`/gerants/${id}/submit-verification`, { method: 'POST' }),
  setPropertyAddress: (id: string, mapsUrl: string, lat?: number, lng?: number) =>
    request<PropertyAddress & { verification_status: string }>(`/gerants/${id}/property-address`, {
      method: 'PATCH',
      body: JSON.stringify(lat !== undefined && lng !== undefined ? { maps_url: mapsUrl, lat, lng } : { maps_url: mapsUrl }),
    }),
  getVerificationStatus: (id: string) =>
    request<VerificationStatusResponse>(`/gerants/${id}/verification-status`),
};

// ── Premium ──
interface PremiumInitiateResponse {
  transaction_id: number;
  payment_url: string;
}

export const apiPremium = {
  initiate: (market: string) =>
    request<PremiumInitiateResponse>('/premium/initiate', {
      method: 'POST',
      body: JSON.stringify({ market }),
    }),
  confirm: (transactionId: number) =>
    request<{
      success: boolean;
      already_active: boolean;
      premium_expires_at: string | null;
      gerant: GerantData;
    }>('/premium/confirm', {
      method: 'POST',
      body: JSON.stringify({ transaction_id: transactionId }),
    }),
};

// ── Boost (sponsorisation de chambres) ──
export type BoostMode = 'cpc' | 'cpi';

export type BoostDisplayStatus =
  | 'pending'
  | 'scheduled'
  | 'live'
  | 'paused'
  | 'ended'
  | 'exhausted'
  | 'canceled';

export interface BoostRoomRef {
  id: string;
  title: string;
  price: string | null;
  price_num: number | null;
  img: string | null;
  ville: string | null;
  quartier: string | null;
  market: string;
  disponible: boolean;
}

export interface BoostData {
  id: string;
  market: string;
  room_id: string;
  mode: BoostMode;
  status: string;
  display_status: BoostDisplayStatus;
  budget_total: number;
  spent: number;
  remaining: number;
  starts_at: string;
  ends_at: string;
  activated_at: string | null;
  created_at: string | null;
  room: BoostRoomRef | null;
}

export interface BoostFeaturedItem {
  id: string;
  room_id: string;
  market: string;
  mode: BoostMode;
  title: string;
  price: string | null;
  price_num: number | null;
  img: string | null;
  ville: string | null;
  quartier: string | null;
  category: string | null;
}

export interface BoostConfig {
  currency: string;
  price_cpc: number;
  price_cpi: number;
  budgets: number[];
  max_duration_days: number;
}

export interface BoostFeaturedResponse {
  items: BoostFeaturedItem[];
  config: { currency: string; price_cpc: number; price_cpi: number };
}

export interface BoostChargeResponse {
  counted: boolean;
  billed: boolean;
  exhausted: boolean;
  remaining: number | null;
  /** Serveur qui vient de poser le cookie visiteur : l'événement n'a pas été
      facturé, il faut relancer UNE fois (voir `trackEvent`). */
  visitor_issued?: boolean;
}

/**
 * Envoie un événement de tracking. Si le serveur répond `visitor_issued`
 * (cookie visiteur absent/forgé, il vient d'en émettre un), on repasse une
 * seule fois avec le cookie — jamais de boucle.
 */
async function trackEvent(
  path: '/boosts/impression' | '/boosts/click',
  boostId: string,
  visitorId: string,
): Promise<BoostChargeResponse> {
  const send = () =>
    request<BoostChargeResponse>(path, {
      method: 'POST',
      body: JSON.stringify({ boost_id: boostId, visitor_id: visitorId }),
      public: true,
    });
  const first = await send();
  if (first?.visitor_issued) return send();
  return first;
}

export const apiBoosts = {
  config: () => cachedGet<BoostConfig>('/boosts/config'),
  // Cache mémoire 300 s : la rotation aléatoire serveur reste vivante sans
  // re-faire un tour complet de la base à chaque navigation.
  featured: () => cachedGet<BoostFeaturedResponse>('/boosts/featured', 300_000),
  impression: (boostId: string, visitorId: string) =>
    trackEvent('/boosts/impression', boostId, visitorId),
  click: (boostId: string, visitorId: string) =>
    trackEvent('/boosts/click', boostId, visitorId),
  initiate: (data: {
    room_id: string;
    mode: BoostMode;
    budget_total: number;
    starts_at: string;
    ends_at: string;
  }) =>
    request<{ transaction_id: number; payment_url: string; boost_id: string }>('/boosts/initiate', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  confirm: (transactionId: number) =>
    request<{ success: boolean; already_activated: boolean; boost: BoostData }>(
      '/boosts/confirm',
      { method: 'POST', body: JSON.stringify({ transaction_id: transactionId }) }
    ),
  mine: () => request<{ items: BoostData[] }>('/boosts/mine'),
  updateSchedule: (id: string, data: { starts_at: string; ends_at: string }) =>
    request<{ boost: BoostData }>(`/boosts/${id}/schedule`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
};

// ── Auth (rôles) ──
export type AuthRole = 'client' | 'gerant';

export interface AuthBootstrapResponse {
  role: AuthRole | null;
  profile_role: AuthRole | null;
  clerk_role: AuthRole | null;
}

export const apiAuth = {
  me: () => request<AuthBootstrapResponse>('/auth/me'),
  bootstrap: (data: { role: AuthRole; market?: MarketCode }) =>
    request<AuthBootstrapResponse>('/auth/bootstrap', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// ── Clients ──
export interface ClientProfileData {
  id: string;
  clerk_user_id: string;
  email: string;
  nom: string | null;
  prenom: string | null;
  telephone: string | null;
  created_at: string;
}

export const apiClients = {
  getMe: () => request<ClientProfileData>('/clients/me'),
  create: (data: {
    clerk_user_id: string;
    email: string;
    nom?: string;
    prenom?: string;
    telephone?: string;
  }) => request<ClientProfileData>('/clients', { method: 'POST', body: JSON.stringify(data) }),
  updateMe: (data: { nom?: string; prenom?: string; telephone?: string }) =>
    request<ClientProfileData>('/clients/me', { method: 'PATCH', body: JSON.stringify(data) }),
};

// ── Reviews ──
export interface ReviewData {
  id: string;
  room_id: string | null;
  gerant_id: string | null;
  client_name: string;
  reservation_id?: string;
  note_appartement: number;
  note_gerant: number;
  commentaire: string | null;
  created_at: string;
}

export interface RoomReviewsResponse {
  reviews: ReviewData[];
  room_avg: number | null;
  room_count: number;
  gerant_avg: number | null;
  gerant_count: number;
}

export interface FeaturedReviewData {
  id: string;
  client_name: string;
  note_appartement: number;
  commentaire: string;
  created_at: string;
  room: { title: string | null } | null;
}

export const apiReviews = {
  listByRoom: (roomId: string) =>
    request<RoomReviewsResponse>(`/reviews?room_id=${encodeURIComponent(roomId)}`, { public: true }),
  listMine: () => request<ReviewData[]>('/reviews/mine'),
  featured: () => cachedGet<FeaturedReviewData[]>('/reviews/featured'),
  create: (data: {
    reservation_id: string;
    note_appartement: number;
    note_gerant: number;
    commentaire?: string;
  }) => request<ReviewData>('/reviews', { method: 'POST', body: JSON.stringify(data) }),
};

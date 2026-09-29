import type { DureeUnite } from './duration';

export const API_BASE = '/api';

export const REQUEST_TIMEOUT_MS = 15_000;

let authTokenGetter: (() => Promise<string | null>) | null = null;

export function setAuthTokenGetter(getter: () => Promise<string | null>) {
  authTokenGetter = getter;
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

export async function cachedGet<T>(path: string, ttlMs = PUBLIC_CACHE_TTL_MS): Promise<T> {
  const now = Date.now();
  const hit = publicCache.get(path);
  if (hit && hit.expires > now) return hit.promise as Promise<T>;

  // `cache: 'no-cache'` force une revalidation conditionnelle (304) auprès du
  // serveur : après une mutation qui a purgé ce cache mémoire, la réponse
  // serveur fraîche doit être visible immédiatement — le cache HTTP du
  // navigateur ne doit jamais nous servir une version périmée.
  const promise = request<T>(path, { cache: 'no-cache' }).catch((err) => {
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

export async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };

  if (authTokenGetter) {
    const token = await authTokenGetter();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    signal: options?.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  }).catch((e: unknown) => {
    if (e instanceof Error && e.name === 'TimeoutError') {
      throw new Error('Délai dépassé. Vérifiez votre connexion puis réessayez.');
    }
    throw e;
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API error ${res.status}`);
  }
  // Toute mutation invalide le cache public : une création/édition ne doit
  // jamais être masquée par une réponse mise en cache 60 s plus tôt.
  if ((options?.method ?? 'GET').toUpperCase() !== 'GET') clearApiCache();
  return parseJsonBody<T>(res);
}

// ── Rooms ──
export interface GerantInfo {
  nom: string;
  prenom: string;
  phone: string | null;
  is_verified: boolean;
  is_premium: boolean;
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
  capacity: string;
  category: string;
  market: 'CI' | 'BJ';
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
  is_popular?: boolean;
  promo_group?: string | null;
  promo_start?: string | null;
  promo_end?: string | null;
}

export const apiRooms = {
  // `fresh: true` contourne le cache mémoire : réservé aux écrans de gestion
  // (back-office) qui doivent refléter l'état exact de la base au montage.
  list: (market?: string, opts?: { fresh?: boolean }) => {
    const path = market ? `/rooms?market=${market}` : '/rooms';
    if (opts?.fresh) return request<RoomData[]>(path, { cache: 'no-cache' });
    return cachedGet<RoomData[]>(path);
  },
  listMine: () => request<RoomData[]>('/rooms/mine'),
  getPopular: (market: string) => cachedGet<RoomData[]>(`/rooms/popular?market=${market}`),
  listAvailable: (market: string, arrivee: string, depart: string, ville?: string) =>
    request<RoomData[]>(
      `/rooms/available?market=${market}&arrivee=${arrivee}&depart=${depart}` +
        (ville ? `&ville=${encodeURIComponent(ville)}` : '')
    ),
  get: (id: string) => request<RoomData>(`/rooms/${id}`),
  villes: (market?: string) => request<string[]>(market ? `/rooms/villes?market=${market}` : '/rooms/villes'),
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
  market: 'CI' | 'BJ';
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
  market: 'CI' | 'BJ';
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
  message: string;
  statut: 'en_attente' | 'confirmee' | 'annulee';
  created_at: string;
  responded_at: string | null;
  gerant_phone?: string | null;
  gerant_nom?: string | null;
  gerant_prenom?: string | null;
  gerant_is_verified?: boolean;
  gerant_is_premium?: boolean;
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
  market?: 'CI' | 'BJ';
}

export const apiNewsletter = {
  subscribe: (data: NewsletterSubscribeData) =>
    request<{ id?: string; email?: string; message?: string }>('/newsletter', {
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
  market: 'CI' | 'BJ';
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
  updateMe: (data: { nom?: string; prenom?: string; phone?: string }) =>
    request<GerantData>('/gerants/me', { method: 'PATCH', body: JSON.stringify(data) }),
  deleteDocument: (id: string, docId: string) =>
    request<void>(`/gerants/${id}/documents/${docId}`, { method: 'DELETE' }),
  submitVerification: (id: string) =>
    request<{ transaction_id: number; payment_url: string }>(`/gerants/${id}/submit-verification`, { method: 'POST' }),
  setPropertyAddress: (id: string, mapsUrl: string, lat?: number, lng?: number) =>
    request<PropertyAddress & { verification_status: string }>(`/gerants/${id}/property-address`, {
      method: 'PATCH',
      body: JSON.stringify(lat !== undefined && lng !== undefined ? { maps_url: mapsUrl, lat, lng } : { maps_url: mapsUrl }),
    }),
  confirmVerification: (id: string, transactionId: number) =>
    request<{ success: boolean; gerant: GerantData }>(`/gerants/${id}/confirm-verification`, {
      method: 'POST',
      body: JSON.stringify({ transaction_id: transactionId }),
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

// ── Auth (rôles) ──
export type AuthRole = 'client' | 'gerant';

export interface AuthBootstrapResponse {
  role: AuthRole | null;
  profile_role: AuthRole | null;
  clerk_role: AuthRole | null;
}

export const apiAuth = {
  me: () => request<AuthBootstrapResponse>('/auth/me'),
  bootstrap: (data: { role: AuthRole; market?: 'CI' | 'BJ' }) =>
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
    request<RoomReviewsResponse>(`/reviews?room_id=${encodeURIComponent(roomId)}`),
  listMine: () => request<ReviewData[]>('/reviews/mine'),
  featured: () => cachedGet<FeaturedReviewData[]>('/reviews/featured'),
  create: (data: {
    reservation_id: string;
    note_appartement: number;
    note_gerant: number;
    commentaire?: string;
  }) => request<ReviewData>('/reviews', { method: 'POST', body: JSON.stringify(data) }),
};

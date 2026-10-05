import { API_BASE, REQUEST_TIMEOUT_MS, parseJsonBody, clearApiCache } from './api';
import type { VerificationDocument } from './api';

let adminToken: string | null = localStorage.getItem('admin_token');

export function setAdminToken(token: string | null) {
  adminToken = token;
  if (token) {
    localStorage.setItem('admin_token', token);
  } else {
    localStorage.removeItem('admin_token');
  }
}

export function getAdminToken(): string | null {
  return adminToken;
}

async function adminRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };

  if (adminToken) {
    headers['Authorization'] = `Bearer ${adminToken}`;
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
  // Une mutation admin (bannières, événements, promos…) invalide le cache
  // public de la home pour que les changements apparaissent immédiatement.
  if ((options?.method ?? 'GET').toUpperCase() !== 'GET') clearApiCache();
  return parseJsonBody<T>(res);
}

export interface AdminData {
  id: string;
  email: string;
  nom: string;
  prenom: string;
}

export interface AdminStats {
  gerants: {
    total: number;
    verified: number;
    pendingVerifications: number;
    premium: number;
    byMarket: { CI: number; BJ: number };
    newThisMonth: number;
  };
  rooms: {
    total: number;
    available: number;
    unavailable: number;
  };
  reservations: {
    total: number;
    pending: number;
    confirmed: number;
    cancelled: number;
    totalRevenue: number;
  };
}

export interface AdminGerant {
  id: string;
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

export interface AdminBanner {
  id: string;
  section: 'popular' | 'promos' | 'categories' | 'events';
  img: string;
  alt: string;
  link: string;
  market: 'CI' | 'BJ';
  order: number;
  created_at?: string;
}

export interface AdminEvent {
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

export interface AdminDestination {
  id: string;
  market: 'CI' | 'BJ';
  city: string;
  title: string;
  description: string;
  img: string;
  alt: string | null;
  featured: boolean;
  created_at?: string;
}

// Réponse de GET /tourism : le serveur a déjà tranché quelles destinations
// sont grosses cartes. Le back-office concatène `big` puis `small` pour
// obtenir la liste complète dans l'ordre serveur, avec l'effet réel de la
// règle (et du checkbox « mettre en avant »).
export interface AdminTourismPartition {
  big: AdminDestination[];
  small: AdminDestination[];
}

export interface AdminReservation {
  id: string;
  client_name: string;
  client_email: string;
  client_phone: string | null;
  room_id: string;
  room_title: string;
  date_debut: string;
  date_fin: string;
  montant: number;
  message: string;
  statut: 'en_attente' | 'confirmee' | 'annulee';
  created_at: string;
  responded_at: string | null;
  gerant_id: string | null;
}

/**
 * Compteurs des cartes du tableau de bord : calculés en SQL sur TOUTES les
 * réservations des gérants non qualifiés (indépendants du filtre statut et
 * de la recherche), comme l'ancien calcul JS sur la liste complète.
 */
export interface AdminReservationCounts {
  total: number;
  pending: number;
  confirmed: number;
  cancelled: number;
}

/** Réponse paginée de GET /api/admin/reservations (filtres en SQL). */
export interface AdminReservationsResponse {
  items: AdminReservation[];
  total: number;
  page: number;
  limit: number;
  counts: AdminReservationCounts;
}

export interface AdminNotification {
  id: string;
  type: string;
  room_title: string;
  room_id: string;
  client_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  message: string | null;
  reservation_id: string | null;
  read: boolean;
  date: string;
}

interface AdminNotificationsResponse {
  notifications: AdminNotification[];
  unread_count: number;
}

export const apiAdmin = {
  login: (email: string, password: string) =>
    adminRequest<{ token: string; admin: AdminData }>('/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  getMe: () => adminRequest<AdminData>('/admin/me'),

  getStats: () => adminRequest<AdminStats>('/admin/stats'),

  changePassword: (currentPassword: string, newPassword: string) =>
    adminRequest<{ message: string }>('/admin/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  getGerants: (params?: { market?: string; verification_status?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.market) searchParams.set('market', params.market);
    if (params?.verification_status) searchParams.set('verification_status', params.verification_status);
    const qs = searchParams.toString();
    return adminRequest<AdminGerant[]>(`/admin/gerants${qs ? `?${qs}` : ''}`);
  },

  revokeGerantVerification: (id: string) =>
    adminRequest<AdminGerant>(`/admin/gerants/${id}/revoke-verification`, { method: 'PATCH' }),

  getVerificationDocuments: (gerantId: string) =>
    adminRequest<VerificationDocument[]>(`/admin/gerants/${gerantId}/documents`),

  reviewDocument: (docId: string, status: 'approved' | 'rejected', rejectionReason?: string) =>
    adminRequest<VerificationDocument>(`/admin/documents/${docId}/review`, {
      method: 'PATCH',
      body: JSON.stringify({ status, rejection_reason: rejectionReason }),
    }),

  startGerantReview: (gerantId: string) =>
    adminRequest<AdminGerant>(`/admin/gerants/${gerantId}/start-review`, { method: 'PATCH' }),

  approveGerantVerification: (gerantId: string) =>
    adminRequest<AdminGerant>(`/admin/gerants/${gerantId}/approve-verification`, { method: 'PATCH' }),

  rejectGerantVerification: (gerantId: string, rejectionReason: string) =>
    adminRequest<AdminGerant>(`/admin/gerants/${gerantId}/reject-verification`, {
      method: 'PATCH',
      body: JSON.stringify({ rejection_reason: rejectionReason }),
    }),

  getReservations: (params?: { statut?: string; search?: string; page?: number; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.statut) searchParams.set('statut', params.statut);
    if (params?.search) searchParams.set('search', params.search);
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    const qs = searchParams.toString();
    return adminRequest<AdminReservationsResponse>(`/admin/reservations${qs ? `?${qs}` : ''}`);
  },

  checkAvailability: (reservationId: string) =>
    adminRequest<{ statut: string; reason: string | null }>(`/admin/reservations/${reservationId}/check-availability`, {
      method: 'POST',
    }),

  getNotifications: () => adminRequest<AdminNotificationsResponse>('/admin/notifications'),

  markNotificationRead: (id: string) =>
    adminRequest<void>(`/admin/notifications/${id}/read`, { method: 'PATCH' }),

  getBanners: (market?: string, section?: string) => {
    const searchParams = new URLSearchParams();
    if (market) searchParams.set('market', market);
    if (section) searchParams.set('section', section);
    const qs = searchParams.toString();
    return adminRequest<AdminBanner[]>(`/banners${qs ? `?${qs}` : ''}`);
  },

  createBanner: (data: Omit<AdminBanner, 'id' | 'created_at'>) =>
    adminRequest<AdminBanner>('/banners', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateBanner: (id: string, data: Partial<Omit<AdminBanner, 'id' | 'created_at'>>) =>
    adminRequest<AdminBanner>(`/banners/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteBanner: (id: string) =>
    adminRequest<void>(`/banners/${id}`, { method: 'DELETE' }),

  // `market` est obligatoire : le GET /events exige ?market=CI|BJ (400 sinon).
  // `include_past=1` donne accès aux événements passés (réservé au back-office,
  // la route exige alors un token admin valide).
  getEvents: (market: string) =>
    adminRequest<AdminEvent[]>(`/events?market=${market}&include_past=1`),

  createEvent: (data: Omit<AdminEvent, 'id' | 'created_at'>) =>
    adminRequest<AdminEvent>('/events', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateEvent: (id: string, data: Partial<Omit<AdminEvent, 'id' | 'created_at'>>) =>
    adminRequest<AdminEvent>(`/events/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteEvent: (id: string) =>
    adminRequest<void>(`/events/${id}`, { method: 'DELETE' }),

  // `market` est obligatoire : le GET /tourism exige ?market=CI|BJ (400 sinon).
  getDestinations: (market: string) =>
    adminRequest<AdminTourismPartition>(`/tourism?market=${market}`),

  createDestination: (data: Omit<AdminDestination, 'id' | 'created_at'>) =>
    adminRequest<AdminDestination>('/tourism', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateDestination: (id: string, data: Partial<Omit<AdminDestination, 'id' | 'created_at'>>) =>
    adminRequest<AdminDestination>(`/tourism/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteDestination: (id: string) =>
    adminRequest<void>(`/tourism/${id}`, { method: 'DELETE' }),

  uploadFile: async (file: File): Promise<{ url: string; path: string }> => {
    const headers: Record<string, string> = {};
    if (adminToken) {
      headers['Authorization'] = `Bearer ${adminToken}`;
    }
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/upload`, { method: 'POST', headers, body: formData });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || 'Upload failed');
    }
    const data = await parseJsonBody<{ url: string; path: string }>(res);
    if (!data?.url) throw new Error('Upload failed: réponse vide');
    return data;
  },

  updateRoomPromoGroup: (roomId: string, data: { promo_group: string | null; promo_start?: string | null; promo_end?: string | null }) =>
    adminRequest<any>(`/admin/rooms/${roomId}/promo-group`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
};

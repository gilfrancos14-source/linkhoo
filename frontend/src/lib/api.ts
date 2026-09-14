const API_BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API error ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ── Rooms ──
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
}

export const apiRooms = {
  list: (market?: string) => request<RoomData[]>(market ? `/rooms?market=${market}` : '/rooms'),
  get: (id: string) => request<RoomData>(`/rooms/${id}`),
  create: (data: Omit<RoomData, 'id'>) => request<RoomData>('/rooms', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<RoomData>) => request<RoomData>(`/rooms/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request<void>(`/rooms/${id}`, { method: 'DELETE' }),
  toggle: (id: string) => request<RoomData>(`/rooms/${id}/toggle`, { method: 'PATCH' }),
};

// ── Categories ──
export interface CategoryData {
  id: string;
  title: string;
  img: string;
  alt: string;
  market: 'CI' | 'BJ';
}

export const apiCategories = {
  list: (market?: string) => request<CategoryData[]>(market ? `/categories?market=${market}` : '/categories'),
  create: (data: Omit<CategoryData, 'id'>) => request<CategoryData>('/categories', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<CategoryData>) => request<CategoryData>(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request<void>(`/categories/${id}`, { method: 'DELETE' }),
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
  list: (market?: string) => request<BannerData[]>(market ? `/banners?market=${market}` : '/banners'),
  create: (data: Omit<BannerData, 'id'>) => request<BannerData>('/banners', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<BannerData>) => request<BannerData>(`/banners/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request<void>(`/banners/${id}`, { method: 'DELETE' }),
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
  montant: number;
  message: string;
  statut: 'en_attente' | 'confirmee' | 'annulee';
  created_at: string;
  responded_at: string | null;
}

export const apiReservations = {
  list: () => request<ReservationData[]>('/reservations'),
  create: (data: Omit<ReservationData, 'id' | 'created_at' | 'responded_at'>) => request<ReservationData>('/reservations', { method: 'POST', body: JSON.stringify(data) }),
  updateStatut: (id: string, statut: string) => request<ReservationData>(`/reservations/${id}`, { method: 'PATCH', body: JSON.stringify({ statut }) }),
  checkConflict: (roomId: string, dateDebut: string, dateFin: string, excludeId?: string) =>
    request<{ hasConflict: boolean }>(`/reservations/check?room_id=${roomId}&date_debut=${dateDebut}&date_fin=${dateFin}${excludeId ? `&exclude_id=${excludeId}` : ''}`),
};

// ── Notifications ──
export const apiNotifications = {
  listAdmin: () => request<any[]>('/notifications'),
  listClient: (email: string) => request<any[]>(`/notifications/client?email=${encodeURIComponent(email)}`),
  markRead: (id: string) => request<void>(`/notifications/${id}/read`, { method: 'PATCH' }),
  markReadClient: (id: string) => request<void>(`/notifications/client/${id}/read`, { method: 'PATCH' }),
  create: (data: any) => request<any>('/notifications', { method: 'POST', body: JSON.stringify(data) }),
  createClient: (data: any) => request<any>('/notifications/client', { method: 'POST', body: JSON.stringify(data) }),
};

// ── Upload ──
export const apiUpload = {
  upload: async (file: File): Promise<{ url: string; path: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/upload`, { method: 'POST', body: formData });
    if (!res.ok) throw new Error('Upload failed');
    return res.json();
  },
};

export interface Notification {
  id: string;
  type: 'reservation' | 'reservation_confirmed' | 'reservation_rejected';
  roomTitle: string;
  roomId: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  message: string;
  date: string;
  read: boolean;
  reservationId?: string;
}

const STORAGE_KEY = 'ilehya-notifications';

export function getNotifications(): Notification[] {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
}

export function getUnreadCount(): number {
  return getNotifications().filter((n) => !n.read).length;
}

export function addNotification(data: Omit<Notification, 'id' | 'date' | 'read'>): void {
  const notifications = getNotifications();
  notifications.unshift({
    ...data,
    id: 'notif-' + Date.now(),
    date: new Date().toISOString(),
    read: false,
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
}

export function markAsRead(id: string): void {
  const notifications = getNotifications().map((n) =>
    n.id === id ? { ...n, read: true } : n
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
}

export function markAllAsRead(): void {
  const notifications = getNotifications().map((n) => ({ ...n, read: true }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
}

const CLIENT_STORAGE_KEY = 'ilehya-client-notifications';

export interface ClientNotification {
  id: string;
  type: 'reservation_confirmed' | 'reservation_rejected';
  roomTitle: string;
  roomId: string;
  clientEmail: string;
  message: string;
  date: string;
  read: boolean;
}

export function getClientNotifications(email: string): ClientNotification[] {
  const all = JSON.parse(localStorage.getItem(CLIENT_STORAGE_KEY) || '[]') as ClientNotification[];
  return all.filter((n) => n.clientEmail === email);
}

export function addClientNotification(data: Omit<ClientNotification, 'id' | 'date' | 'read'>): void {
  const all = JSON.parse(localStorage.getItem(CLIENT_STORAGE_KEY) || '[]') as ClientNotification[];
  all.unshift({
    ...data,
    id: 'client-notif-' + Date.now(),
    date: new Date().toISOString(),
    read: false,
  });
  localStorage.setItem(CLIENT_STORAGE_KEY, JSON.stringify(all));
}

export function markClientNotificationAsRead(id: string, email: string): void {
  const all = JSON.parse(localStorage.getItem(CLIENT_STORAGE_KEY) || '[]') as ClientNotification[];
  const updated = all.map((n) => (n.id === id && n.clientEmail === email ? { ...n, read: true } : n));
  localStorage.setItem(CLIENT_STORAGE_KEY, JSON.stringify(updated));
}

export function addTestNotification(): void {
  if (!import.meta.env.DEV) return;
  const testReservationId = 'res-test-' + Date.now();
  const reservations = JSON.parse(localStorage.getItem('ilehya-reservations') || '[]');
  reservations.unshift({
    id: testReservationId,
    clientName: 'Amina Bello',
    clientEmail: 'amina.bello@email.com',
    clientPhone: '+229 96 45 67 89',
    roomId: 'familial-quartier-des-arts',
    roomTitle: 'Familial — Quartier des arts',
    dateDebut: '2026-10-01',
    dateFin: '2026-12-31',
    montant: 660,
    message: 'Bonjour, je souhaite réserver cet appartement pour 3 mois. Est-il disponible ?',
    statut: 'en_attente',
    createdAt: new Date().toISOString(),
  });
  localStorage.setItem('ilehya-reservations', JSON.stringify(reservations));

  addNotification({
    type: 'reservation',
    roomTitle: 'Familial — Quartier des arts',
    roomId: 'familial-quartier-des-arts',
    clientName: 'Amina Bello',
    clientEmail: 'amina.bello@email.com',
    clientPhone: '+229 96 45 67 89',
    message: 'Bonjour, je souhaite réserver cet appartement pour 3 mois. Est-il disponible ?',
    reservationId: testReservationId,
  });
}

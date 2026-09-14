import { apiNotifications } from './api';

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

export async function getNotifications(): Promise<Notification[]> {
  try {
    const data = await apiNotifications.listAdmin();
    return data.map((d: any) => ({
      id: d.id,
      type: d.type,
      roomTitle: d.room_title,
      roomId: d.room_id,
      clientName: d.client_name,
      clientEmail: d.client_email,
      clientPhone: d.client_phone,
      message: d.message,
      date: d.date,
      read: d.read,
      reservationId: d.reservation_id,
    }));
  } catch {
    return JSON.parse(localStorage.getItem('ilehya-notifications') || '[]');
  }
}

export async function getUnreadCount(): Promise<number> {
  const notifs = await getNotifications();
  return notifs.filter((n) => !n.read).length;
}

export async function addNotification(data: Omit<Notification, 'id' | 'date' | 'read'>): Promise<void> {
  await apiNotifications.create({
    type: data.type,
    room_title: data.roomTitle,
    room_id: data.roomId,
    client_name: data.clientName,
    client_email: data.clientEmail,
    client_phone: data.clientPhone,
    message: data.message,
    reservation_id: data.reservationId,
  });
}

export async function markAsRead(id: string): Promise<void> {
  await apiNotifications.markRead(id);
}

export async function markAllAsRead(): Promise<void> {
  const notifs = await getNotifications();
  await Promise.all(notifs.filter((n) => !n.read).map((n) => apiNotifications.markRead(n.id)));
}

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

export async function getClientNotifications(email: string): Promise<ClientNotification[]> {
  try {
    const data = await apiNotifications.listClient(email);
    return data.map((d: any) => ({
      id: d.id,
      type: d.type,
      roomTitle: d.room_title,
      roomId: d.room_id,
      clientEmail: d.client_email,
      message: d.message,
      date: d.date,
      read: d.read,
    }));
  } catch {
    const all = JSON.parse(localStorage.getItem('ilehya-client-notifications') || '[]') as ClientNotification[];
    return all.filter((n) => n.clientEmail === email);
  }
}

export async function addClientNotification(data: Omit<ClientNotification, 'id' | 'date' | 'read'>): Promise<void> {
  await apiNotifications.createClient({
    type: data.type,
    room_title: data.roomTitle,
    room_id: data.roomId,
    client_email: data.clientEmail,
    message: data.message,
  });
}

export async function markClientNotificationAsRead(id: string, _email: string): Promise<void> {
  await apiNotifications.markReadClient(id);
}

export async function addTestNotification(): Promise<void> {
  if (!import.meta.env.DEV) return;
  await addNotification({
    type: 'reservation',
    roomTitle: 'Familial — Quartier des arts',
    roomId: 'familial-quartier-des-arts',
    clientName: 'Amina Bello',
    clientEmail: 'amina.bello@email.com',
    clientPhone: '+229 96 45 67 89',
    message: 'Bonjour, je souhaite réserver cet appartement pour 3 mois.',
  });
}

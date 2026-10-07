import { apiNotifications } from './api';

export interface Notification {
  id: string;
  type: 'reservation' | 'reservation_confirmed' | 'reservation_rejected' | 'verification_submitted' | 'verification_approved' | 'verification_rejected' | 'reservation_cancelled' | 'boost_paid_without_campaign';
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

export async function getClientNotifications(): Promise<ClientNotification[]> {
  const data = await apiNotifications.listClient();
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
}

export async function addClientNotification(data: Omit<ClientNotification, 'id' | 'date' | 'read'>): Promise<void> {
  await apiNotifications.createClient({
    type: data.type,
    roomTitle: data.roomTitle,
    roomId: data.roomId,
    clientEmail: data.clientEmail,
    message: data.message,
  });
}

export async function markClientNotificationAsRead(id: string): Promise<void> {
  await apiNotifications.markReadClient(id);
}

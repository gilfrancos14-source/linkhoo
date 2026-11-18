import { useEffect, useState } from 'react';

interface PushNotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: any;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
  silent?: boolean;
  requireInteraction?: boolean;
}

interface PushNotificationReturn {
  permission: 'granted' | 'denied' | 'default';
  requestPermission: () => Promise<'granted' | 'denied' | 'default'>;
  showNotification: (options: PushNotificationOptions) => Promise<void>;
  supported: boolean;
}

export const usePushNotifications = (): PushNotificationReturn => {
  const [permission, setPermission] = useState<'granted' | 'denied' | 'default'>('default');
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    // Vérifier si les notifications push sont supportées
    setSupported('Notification' in window && 'serviceWorker' in navigator);
    
    // Vérifier la permission actuelle
    if ('Notification' in window) {
      setPermission(Notification.permission as 'granted' | 'denied' | 'default');
    }
  }, []);

  const requestPermission = async (): Promise<'granted' | 'denied' | 'default'> => {
    if (!supported) {
      return 'denied';
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result;
    } catch (error) {
      console.error('Erreur lors de la demande de permission pour les notifications:', error);
      return 'denied';
    }
  };

  const showNotification = async (options: PushNotificationOptions): Promise<void> => {
    if (!supported || permission !== 'granted') {
      console.warn('Les notifications ne sont pas supportées ou la permission n\'est pas accordée');
      return;
    }

    try {
      // Si le service worker est disponible, utiliser l'API du SW
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification(options.title, {
          body: options.body,
          icon: options.icon || '/icons/icon-192.png',
          badge: options.badge || '/icons/icon-192.png',
          tag: options.tag,
          data: options.data,
          actions: options.actions,
          silent: options.silent || false,
          requireInteraction: options.requireInteraction || false
        } as NotificationOptions);
      } else {
        // Fallback direct au navigateur
        new Notification(options.title, {
          body: options.body,
          icon: options.icon || '/icons/icon-192.png',
          badge: options.badge || '/icons/icon-192.png',
          tag: options.tag,
          data: options.data,
          actions: options.actions,
          silent: options.silent || false,
          requireInteraction: options.requireInteraction || false
        } as NotificationOptions);
      }
    } catch (error) {
      console.error('Erreur lors de l\'affichage de la notification:', error);
    }
  };

  return {
    permission,
    requestPermission,
    showNotification,
    supported
  };
};
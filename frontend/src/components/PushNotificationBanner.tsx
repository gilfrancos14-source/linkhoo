import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePushNotifications } from '../hooks/usePushNotifications';

interface PushNotificationBannerProps {
  onPermissionChange?: (permission: 'granted' | 'denied' | 'default') => void;
}

const PushNotificationBanner: React.FC<PushNotificationBannerProps> = ({ onPermissionChange }) => {
  const { t } = useTranslation();
  const { permission, requestPermission, supported } = usePushNotifications();
  const [showBanner, setShowBanner] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Afficher la bannière uniquement si les notifications sont supportées
    // et que la permission n'a pas encore été demandée ou accordée
    if (supported && permission === 'default') {
      setShowBanner(true);
    } else {
      setShowBanner(false);
      onPermissionChange?.(permission);
    }
  }, [permission, supported, onPermissionChange]);

  const handleRequestPermission = async () => {
    setIsLoading(true);
    try {
      const result = await requestPermission();
      onPermissionChange?.(result);
      setShowBanner(false);
    } catch (error) {
      console.error('Erreur lors de la demande de permission:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    // Sauvegarder dans le stockage local que l'utilisateur a refusé
    localStorage.setItem('push_notification_dismissed', 'true');
    onPermissionChange?.('denied');
  };

  if (!showBanner || !supported) {
    return null;
  }

  return (
    <div className="push-notification-banner">
      <div className="notification-content">
        <div className="notification-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
          </svg>
        </div>
        <div className="notification-text">
          <h3>{t('pwa.pushTitle')}</h3>
          <p>{t('pwa.pushDescription')}</p>
        </div>
        <div className="notification-actions">
          <button 
            onClick={handleRequestPermission}
            disabled={isLoading}
            className="btn btn-primary"
          >
            {isLoading ? t('pwa.enabling') : t('pwa.enable')}
          </button>
          <button 
            onClick={handleDismiss}
            className="btn btn-secondary"
            disabled={isLoading}
          >
            {t('pwa.refuse')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PushNotificationBanner;
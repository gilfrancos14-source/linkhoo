import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import PushNotificationBanner from './PushNotificationBanner';
import OfflineQueueStatus from './OfflineQueueStatus';
import InstallPrompt from './InstallPrompt';
import CacheManager from './CacheManager';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { useOfflineQueue } from '../hooks/useOfflineQueue';
import { useCacheManager } from '../hooks/useCacheManager';
import '../css/pwa-components.css';

interface PWAControlPanelProps {
  className?: string;
  showNotifications?: boolean;
  showOfflineQueue?: boolean;
  showInstallPrompt?: boolean;
  showCacheManager?: boolean;
  autoShow?: boolean;
  variant?: 'floating' | 'inline';
}

const PWAControlPanel: React.FC<PWAControlPanelProps> = ({
  className = '',
  showNotifications = true,
  showOfflineQueue = true,
  showInstallPrompt = true,
  showCacheManager = true,
  autoShow = true,
  variant = 'floating'
}) => {
  const { t } = useTranslation();
  const { permission: pushPermission } = usePushNotifications();
  const { status: offlineStatus } = useOfflineQueue();
  const { stats: cacheStats } = useCacheManager();
  
  const [isVisible, setIsVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<'notifications' | 'offline' | 'cache' | 'install'>('notifications');

  // Auto-show après un délai
  useEffect(() => {
    if (autoShow) {
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [autoShow]);

  // Déterminer l'onglet actif basé sur l'état actuel
  useEffect(() => {
    if (pushPermission === 'default' && showNotifications) {
      setActiveTab('notifications');
    } else if (offlineStatus.pendingRequests.length > 0 && showOfflineQueue) {
      setActiveTab('offline');
    } else if (cacheStats && cacheStats.totalSize > 1024 * 1024 && showCacheManager) {
      setActiveTab('cache');
    } else if (showInstallPrompt) {
      setActiveTab('install');
    }
  }, [pushPermission, offlineStatus, cacheStats, showNotifications, showOfflineQueue, showCacheManager, showInstallPrompt]);

  const toggleVisibility = () => {
    setIsVisible(!isVisible);
  };

  const getTabBadge = (tab: 'notifications' | 'offline' | 'cache' | 'install') => {
    switch (tab) {
      case 'notifications':
        return pushPermission === 'default' ? t('pwa.badgeNew') : '';
      case 'offline':
        return offlineStatus.pendingRequests.length > 0 
          ? `${offlineStatus.pendingRequests.length}` 
          : offlineStatus.totalSynced > 0 
            ? `${offlineStatus.totalSynced}` 
            : '';
      case 'cache':
        return cacheStats && cacheStats.totalSize > 1024 * 1024 
          ? `${Math.round(cacheStats.totalSize / 1024 / 1024)}MB` 
          : '';
      case 'install':
        return t('pwa.badgeRecommended');
      default:
        return '';
    }
  };

  const getTabIcon = (tab: 'notifications' | 'offline' | 'cache' | 'install') => {
    switch (tab) {
      case 'notifications':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
          </svg>
        );
      case 'offline':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
        );
      case 'cache':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 11H5m14 0a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2m14 0V9a2 2 0 0 0-2-2M5 11V9a2 2 0 0 1 2-2m0 0V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2M7 7h10"></path>
          </svg>
        );
      case 'install':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
        );
      default:
        return null;
    }
  };

  if (!isVisible) {
    if (variant === 'inline') {
      return (
        <div className={`pwa-control-panel-toggle pwa-control-panel-toggle--inline ${className}`}>
          <button
            type="button"
            onClick={toggleVisibility}
            className="pwa-inline-toggle-btn"
            title={t('pwa.settings')}
            aria-label={t('pwa.settings')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M12 1v6m0 6v6m-9-9h6m6 0h6m-2.6-7.4l4.2 4.2m-4.2 7.4l4.2-4.2M3.4 16.6l4.2-4.2m0 7.4l-4.2-4.2"></path>
            </svg>
            <span>{t('pwa.application')}</span>
          </button>
        </div>
      );
    }
    return (
      <div className={`pwa-control-panel-toggle ${className}`}>
        <button 
          onClick={toggleVisibility}
          className="control-panel-toggle-btn"
          title={t('pwa.settings')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M12 1v6m0 6v6m-9-9h6m6 0h6m-2.6-7.4l4.2 4.2m-4.2 7.4l4.2-4.2M3.4 16.6l4.2-4.2m0 7.4l-4.2-4.2"></path>
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className={`pwa-control-panel ${className}`}>
      <div className="control-panel-header">
        <h3>{t('pwa.settings')}</h3>
        <button 
          onClick={toggleVisibility}
          className="close-btn"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div className="control-panel-tabs">
        {showNotifications && (
          <button
            className={`tab-btn ${activeTab === 'notifications' ? 'active' : ''}`}
            onClick={() => setActiveTab('notifications')}
          >
            {getTabIcon('notifications')}
            {t('pwa.notifications')}
            {getTabBadge('notifications') && (
              <span className="tab-badge">{getTabBadge('notifications')}</span>
            )}
          </button>
        )}

        {showOfflineQueue && (
          <button
            className={`tab-btn ${activeTab === 'offline' ? 'active' : ''}`}
            onClick={() => setActiveTab('offline')}
          >
            {getTabIcon('offline')}
            {t('pwa.offline')}
            {getTabBadge('offline') && (
              <span className="tab-badge">{getTabBadge('offline')}</span>
            )}
          </button>
        )}

        {showCacheManager && (
          <button
            className={`tab-btn ${activeTab === 'cache' ? 'active' : ''}`}
            onClick={() => setActiveTab('cache')}
          >
            {getTabIcon('cache')}
            {t('pwa.cache')}
            {getTabBadge('cache') && (
              <span className="tab-badge">{getTabBadge('cache')}</span>
            )}
          </button>
        )}

        {showInstallPrompt && (
          <button
            className={`tab-btn ${activeTab === 'install' ? 'active' : ''}`}
            onClick={() => setActiveTab('install')}
          >
            {getTabIcon('install')}
            {t('pwa.install')}
            {getTabBadge('install') && (
              <span className="tab-badge">{getTabBadge('install')}</span>
            )}
          </button>
        )}
      </div>

      <div className="control-panel-content">
        {activeTab === 'notifications' && showNotifications && (
          <div className="tab-content">
            <PushNotificationBanner />
          </div>
        )}

        {activeTab === 'offline' && showOfflineQueue && (
          <div className="tab-content">
            <OfflineQueueStatus />
          </div>
        )}

        {activeTab === 'cache' && showCacheManager && (
          <div className="tab-content">
            <CacheManager />
          </div>
        )}

        {activeTab === 'install' && showInstallPrompt && (
          <div className="tab-content">
            <InstallPrompt autoShow={false} />
          </div>
        )}
      </div>
    </div>
  );
};

export default PWAControlPanel;
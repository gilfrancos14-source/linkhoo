import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOfflineQueue } from '../hooks/useOfflineQueue';

interface OfflineQueueStatusProps {
  className?: string;
}

const OfflineQueueStatus: React.FC<OfflineQueueStatusProps> = ({ className = '' }) => {
  const { i18n, t } = useTranslation();
  const locale = i18n.language.split('-')[0];
  const localeMap: Record<string, string> = { fr: 'fr-FR', en: 'en-US', es: 'es-ES' };
  const { status, syncAll, retryFailed, clearQueue } = useOfflineQueue();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Afficher le composant uniquement s'il y a des requêtes en attente
    setIsVisible(status.pendingRequests.length > 0 || status.totalSynced > 0 || status.totalFailed > 0);
  }, [status]);

  if (!isVisible) {
    return null;
  }

  const handleSync = async () => {
    try {
      await syncAll();
    } catch (error) {
      console.error('Erreur lors de la synchronisation:', error);
    }
  };

  const handleRetry = async () => {
    try {
      await retryFailed();
    } catch (error) {
      console.error('Erreur lors de la nouvelle tentative:', error);
    }
  };

  const handleClear = () => {
    clearQueue();
  };

  const formatTime = (date: Date | null) => {
    if (!date) return t('pwa.never');
    return date.toLocaleTimeString(localeMap[locale] ?? 'fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className={`offline-queue-status ${className}`}>
      <div className="queue-header">
        <h3>{t('pwa.offlineTitle')}</h3>
        <div className="queue-status">
          {status.isSyncing ? (
            <span className="status syncing">
              <span className="status-dot"></span>
              {t('pwa.syncing')}
            </span>
          ) : status.pendingRequests.length > 0 ? (
            <span className="status pending">
              <span className="status-dot"></span>
              {t('pwa.pending', { count: status.pendingRequests.length })}
            </span>
          ) : (
            <span className="status idle">
              <span className="status-dot"></span>
              {t('pwa.upToDate')}
            </span>
          )}
        </div>
      </div>

      <div className="queue-stats">
        <div className="stat-item">
          <span className="stat-label">{t('pwa.synced')}</span>
          <span className="stat-value success">{status.totalSynced}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">{t('pwa.failures')}</span>
          <span className="stat-value error">{status.totalFailed}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">{t('pwa.lastSync')}</span>
          <span className="stat-value">{formatTime(status.lastSync)}</span>
        </div>
      </div>

      {status.pendingRequests.length > 0 && (
        <div className="queue-items">
          <h4>{t('pwa.pendingRequests')}</h4>
          <div className="queue-list">
            {status.pendingRequests.slice(0, 3).map((request) => (
              <div key={request.id} className="queue-item">
                <div className="item-method">
                  <span className={`method-badge ${request.method.toLowerCase()}`}>
                    {request.method}
                  </span>
                </div>
                <div className="item-url">
                  <div className="url-path">{new URL(request.url).pathname}</div>
                  <div className="url-time">
                    {new Date(request.timestamp).toLocaleTimeString(
                      localeMap[locale] ?? 'fr-FR',
                      { hour: '2-digit', minute: '2-digit' },
                    )}
                  </div>
                </div>
                <div className="item-retries">
                  {request.retries > 0 && (
                    <span className="retries-badge">
                      {t('pwa.attempt', { count: request.retries })}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {status.pendingRequests.length > 3 && (
              <div className="queue-more">
                {t('pwa.more', { count: status.pendingRequests.length - 3 })}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="queue-actions">
        <button 
          onClick={handleSync}
          disabled={status.isSyncing}
          className="btn btn-primary sync-btn"
        >
          {status.isSyncing ? (
            <>
              <span className="spinner"></span>
              {t('pwa.syncing')}
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10"></polyline>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
              </svg>
              {t('pwa.syncNow')}
            </>
          )}
        </button>
        
        {status.totalFailed > 0 && (
          <button 
            onClick={handleRetry}
            className="btn btn-secondary retry-btn"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10"></polyline>
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
            </svg>
            {t('pwa.retry', { count: status.totalFailed })}
          </button>
        )}
        
        <button 
          onClick={handleClear}
          className="btn btn-danger clear-btn"
          disabled={status.pendingRequests.length === 0}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
          {t('pwa.clear')}
        </button>
      </div>
    </div>
  );
};

export default OfflineQueueStatus;
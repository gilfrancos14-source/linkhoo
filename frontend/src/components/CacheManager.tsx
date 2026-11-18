import React, { useEffect, useState } from 'react';
import { useCacheManager } from '../hooks/useCacheManager';

interface CacheManagerProps {
  className?: string;
  autoOptimize?: boolean;
  optimizeThreshold?: number; // en pourcentage
}

const CacheManager: React.FC<CacheManagerProps> = ({ 
  className = '', 
  autoOptimize = true,
  optimizeThreshold = 80 
}) => {
  const { 
    stats, 
    isLoading, 
    error, 
    refreshStats, 
    clearCache, 
    clearAllCaches, 
    optimizeCache 
  } = useCacheManager();
  
  const [isVisible, setIsVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [usagePercentage, setUsagePercentage] = useState(0);

  // Calculer le pourcentage d'utilisation
  useEffect(() => {
    if (stats && stats.totalSize) {
      // Estimer le quota (typiquement 50MB pour les PWA)
      const estimatedQuota = 50 * 1024 * 1024;
      const percentage = (stats.totalSize / estimatedQuota) * 100;
      setUsagePercentage(Math.min(percentage, 100));
    }
  }, [stats]);

  // Auto-optimisation
  useEffect(() => {
    if (autoOptimize && usagePercentage > optimizeThreshold && !isLoading) {
      const timer = setTimeout(() => {
        handleOptimize();
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [usagePercentage, optimizeThreshold, autoOptimize, isLoading]);

  // Afficher/masquer le gestionnaire de cache
  const toggleVisibility = () => {
    setIsVisible(!isVisible);
    if (!isVisible && !stats) {
      refreshStats();
    }
  };

  // Formater la taille
  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Gérer l'optimisation
  const handleOptimize = async () => {
    try {
      await optimizeCache();
    } catch (error) {
      console.error('Erreur lors de l\'optimisation:', error);
    }
  };

  // Gérer la suppression d'un cache spécifique
  const handleClearCache = async (cacheName?: string) => {
    try {
      await clearCache(cacheName);
    } catch (error) {
      console.error('Erreur lors de la suppression du cache:', error);
    }
  };

  // Gérer la suppression de tous les caches
  const handleClearAllCaches = async () => {
    try {
      await clearAllCaches();
    } catch (error) {
      console.error('Erreur lors de la suppression de tous les caches:', error);
    }
  };

  if (!isVisible) {
    return (
      <div className={`cache-manager-toggle ${className}`}>
        <button 
          onClick={toggleVisibility}
          className="cache-toggle-btn"
          title="Gestion du cache"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 11H5m14 0a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2m14 0V9a2 2 0 0 0-2-2M5 11V9a2 2 0 0 1 2-2m0 0V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2M7 7h10"></path>
          </svg>
          <span className="cache-size">{stats ? formatSize(stats.totalSize) : '0 KB'}</span>
        </button>
      </div>
    );
  }

  return (
    <div className={`cache-manager ${className}`}>
      <div className="cache-header">
        <div className="cache-title">
          <h3>Gestion du cache</h3>
          <div className="cache-usage">
            <div className="usage-bar">
              <div 
                className="usage-fill"
                style={{ width: `${usagePercentage}%` }}
              ></div>
            </div>
            <span className="usage-text">{usagePercentage.toFixed(1)}%</span>
          </div>
        </div>
        
        <div className="cache-actions">
          <button 
            onClick={refreshStats}
            disabled={isLoading}
            className="btn btn-secondary refresh-btn"
          >
            {isLoading ? (
              <span className="spinner"></span>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10"></polyline>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
              </svg>
            )}
          </button>
          
          <button 
            onClick={toggleVisibility}
            className="btn btn-secondary close-btn"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>

      {error && (
        <div className="cache-error">
          <p>{error}</p>
        </div>
      )}

      {stats && (
        <div className="cache-stats">
          <div className="stats-overview">
            <div className="stat-item">
              <span className="stat-label">Total caches:</span>
              <span className="stat-value">{stats.totalCaches}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Espace utilisé:</span>
              <span className="stat-value">{formatSize(stats.totalSize)}</span>
            </div>
          </div>

          <button 
            onClick={() => setShowDetails(!showDetails)}
            className="btn btn-link details-toggle"
          >
            {showDetails ? 'Masquer les détails' : 'Voir les détails'}
          </button>

          {showDetails && (
            <div className="cache-details">
              <div className="cache-list">
                {Object.entries(stats.caches).map(([name, cache]) => (
                  <div key={name} className="cache-item">
                    <div className="cache-name">{name}</div>
                    <div className="cache-info">
                      <span className="cache-count">{cache.count} éléments</span>
                      <span className="cache-size">{formatSize(cache.size)}</span>
                    </div>
                    <div className="cache-actions">
                      <button 
                        onClick={() => handleClearCache(name)}
                        className="btn btn-danger btn-sm"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="cache-actions-bottom">
        <button 
          onClick={handleOptimize}
          disabled={isLoading || !stats || usagePercentage < optimizeThreshold}
          className="btn btn-primary optimize-btn"
        >
          {isLoading ? (
            <>
              <span className="spinner"></span>
              Optimisation...
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10"></polyline>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
              </svg>
              Optimiser le cache
            </>
          )}
        </button>
        
        <button 
          onClick={handleClearAllCaches}
          disabled={isLoading || !stats || stats.totalCaches === 0}
          className="btn btn-danger clear-all-btn"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
          Tout effacer
        </button>
      </div>
    </div>
  );
};

export default CacheManager;
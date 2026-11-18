import { useState, useEffect, useCallback } from 'react';

interface CacheStats {
  totalCaches: number;
  totalSize: number;
  caches: {
    [key: string]: {
      count: number;
      size: number;
    };
  };
}

interface CacheManagerReturn {
  stats: CacheStats | null;
  isLoading: boolean;
  error: string | null;
  refreshStats: () => Promise<void>;
  clearCache: (cacheName?: string) => Promise<void>;
  clearAllCaches: () => Promise<void>;
  optimizeCache: () => Promise<void>;
  isCacheOptimizationSupported: boolean;
}

export const useCacheManager = (): CacheManagerReturn => {
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCacheOptimizationSupported, setIsCacheOptimizationSupported] = useState(false);

  // Vérifier si l'optimisation du cache est supportée
  useEffect(() => {
    const checkSupport = async () => {
      try {
        // Vérifier si les APIs nécessaires sont disponibles
        const hasCaches = 'caches' in window;
        const hasStorageEstimate = 'storage' in navigator && 'estimate' in navigator.storage;
        
        setIsCacheOptimizationSupported(hasCaches && hasStorageEstimate);
      } catch (error) {
        console.error('Erreur lors de la vérification du support de l\'optimisation du cache:', error);
        setIsCacheOptimizationSupported(false);
      }
    };

    checkSupport();
  }, []);

  // Charger les statistiques du cache au démarrage
  useEffect(() => {
    refreshStats();
  }, []);

  const refreshStats = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const cacheStats = await getCacheStats();
      setStats(cacheStats);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur lors de la récupération des statistiques du cache';
      setError(errorMessage);
      console.error(errorMessage, error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearCache = useCallback(async (cacheName?: string) => {
    try {
      if (cacheName) {
        // Supprimer un cache spécifique
        await caches.delete(cacheName);
      } else {
        // Supprimer tous les caches sauf ceux qui sont nécessaires
        const cacheNames = await caches.keys();
        
        for (const name of cacheNames) {
          // Ne pas supprimer les caches système importants
          if (!name.startsWith('linkhoo-')) {
            await caches.delete(name);
          }
        }
      }

      // Rafraîchir les statistiques
      await refreshStats();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur lors de la suppression du cache';
      setError(errorMessage);
      throw error;
    }
  }, [refreshStats]);

  const clearAllCaches = useCallback(async () => {
    try {
      const cacheNames = await caches.keys();
      
      // Supprimer tous les caches
      await Promise.all(
        cacheNames.map(name => caches.delete(name))
      );

      // Rafraîchir les statistiques
      await refreshStats();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur lors de la suppression de tous les caches';
      setError(errorMessage);
      throw error;
    }
  }, [refreshStats]);

  const optimizeCache = useCallback(async () => {
    if (!isCacheOptimizationSupported) {
      throw new Error('L\'optimisation du cache n\'est pas supportée par ce navigateur');
    }

    try {
      setIsLoading(true);
      setError(null);

      // Obtenir l'estimation de l'espace de stockage
      const storageEstimate = await navigator.storage.estimate();
      const usage = storageEstimate.usage || 0;
      const quota = storageEstimate.quota || 0;
      const usagePercentage = (usage / quota) * 100;

      // Si l'utilisation est supérieure à 80%, optimiser
      if (usagePercentage > 80) {
        await performCacheOptimization();
      }

      // Rafraîchir les statistiques
      await refreshStats();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur lors de l\'optimisation du cache';
      setError(errorMessage);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [isCacheOptimizationSupported, refreshStats]);

  const performCacheOptimization = async () => {
    try {
      const cacheNames = await caches.keys();
      
      for (const cacheName of cacheNames) {
        const cache = await caches.open(cacheName);
        const requests = await cache.keys();
        
        // Pour chaque requête dans le cache
        for (const request of requests) {
          try {
            const response = await cache.match(request);
            
            if (response) {
              const responseClone = response.clone();
              
              // Si la réponse est une image, vérifier sa taille
              const contentType = response.headers.get('content-type');
              if (contentType && contentType.startsWith('image/')) {
                const blob = await responseClone.blob();
                const size = blob.size;
                
                // Si l'image est trop grande (> 1MB), la supprimer
                if (size > 1024 * 1024) {
                  await cache.delete(request);
                }
              }
              
              // Si la réponse est vieille de plus de 30 jours, la supprimer
              const dateHeader = response.headers.get('date');
              if (dateHeader) {
                const responseDate = new Date(dateHeader);
                const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                
                if (responseDate < thirtyDaysAgo) {
                  await cache.delete(request);
                }
              }
            }
          } catch (error) {
            console.error(`Erreur lors de l'optimisation de l'élément ${request.url}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Erreur lors de l\'optimisation du cache:', error);
      throw error;
    }
  };

  const getCacheStats = async (): Promise<CacheStats> => {
    try {
      const cacheNames = await caches.keys();
      const stats: CacheStats = {
        totalCaches: cacheNames.length,
        totalSize: 0,
        caches: {}
      };

      for (const cacheName of cacheNames) {
        const cache = await caches.open(cacheName);
        const keys = await cache.keys();
        let size = 0;
        let itemCount = 0;

        for (const request of keys) {
          try {
            const response = await cache.match(request);
            if (response) {
              const blob = await response.blob();
              size += blob.size;
              itemCount++;
            }
          } catch (error) {
            console.error(`Erreur lors de la récupération de la taille de ${request.url}:`, error);
          }
        }

        stats.caches[cacheName] = {
          count: itemCount,
          size: size
        };
        stats.totalSize += size;
      }

      return stats;
    } catch (error) {
      console.error('Erreur lors de la récupération des statistiques du cache:', error);
      throw error;
    }
  };

  return {
    stats,
    isLoading,
    error,
    refreshStats,
    clearCache,
    clearAllCaches,
    optimizeCache,
    isCacheOptimizationSupported
  };
};
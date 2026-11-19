import { useEffect, useState, useCallback } from 'react';

interface OfflineRequest {
  id: string;
  data: any;
  url: string;
  method: string;
  timestamp: number;
  retries: number;
  maxRetries?: number;
}

const OFFLINE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// Les écritures financières / d'authentification ne sont jamais mises en file :
// un rejeu tardif pourrait créer un doublon ou utiliser un jeton expiré.
const UNSAFE_OFFLINE_PATHS = [
  /\/api\/reservations(?:\/|$)/,
  /\/api\/premium(?:\/|$)/,
  /\/api\/payments(?:\/|$)/,
  /\/api\/auth(?:\/|$)/,
  /\/api\/admin(?:\/|$)/,
];

function isSafeOfflineRequest(url: string, method: string): boolean {
  if (method.toUpperCase() !== 'POST') return false;
  try {
    const { pathname } = new URL(url, window.location.href);
    return !UNSAFE_OFFLINE_PATHS.some((pattern) => pattern.test(pathname));
  } catch {
    return false;
  }
}

interface SyncStatus {
  isSyncing: boolean;
  lastSync: Date | null;
  pendingRequests: OfflineRequest[];
  totalSynced: number;
  totalFailed: number;
}

interface OfflineQueueReturn {
  status: SyncStatus;
  addRequest: (request: Omit<OfflineRequest, 'id' | 'timestamp' | 'retries'>) => string;
  removeRequest: (id: string) => void;
  syncAll: () => Promise<void>;
  retryFailed: () => Promise<void>;
  clearQueue: () => void;
  isOnline: boolean;
}

export const useOfflineQueue = (): OfflineQueueReturn => {
  const [status, setStatus] = useState<SyncStatus>({
    isSyncing: false,
    lastSync: null,
    pendingRequests: [],
    totalSynced: 0,
    totalFailed: 0
  });
  
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Détecter les changements de statut en ligne/hors-ligne
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Charger les requêtes hors-ligne depuis IndexedDB
  useEffect(() => {
    loadOfflineRequests();
  }, []);

  const loadOfflineRequests = useCallback(async () => {
    try {
      const requests = await getIndexedDBRequests();
      const usable = requests.filter((request) =>
        Date.now() - request.timestamp <= OFFLINE_MAX_AGE_MS &&
        isSafeOfflineRequest(request.url, request.method),
      );
      requests.filter((request) => !usable.includes(request)).forEach((request) => {
        void deleteIndexedDBRequest(request.id);
      });
      setStatus(prev => ({
        ...prev,
        pendingRequests: usable
      }));
    } catch (error) {
      console.error('Erreur lors du chargement des requêtes hors-ligne:', error);
    }
  }, []);

  const addRequest = useCallback((request: Omit<OfflineRequest, 'id' | 'timestamp' | 'retries'>): string => {
    if (!isSafeOfflineRequest(request.url, request.method)) return '';
    const id = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newRequest: OfflineRequest = {
      ...request,
      id,
      timestamp: Date.now(),
      retries: 0,
      maxRetries: 3
    };

    // Sauvegarder dans IndexedDB
    saveIndexedDBRequest(newRequest);

    // Mettre à jour l'état local
    setStatus(prev => ({
      ...prev,
      pendingRequests: [...prev.pendingRequests, newRequest]
    }));

    // Si en ligne, essayer de synchroniser immédiatement
    if (isOnline) {
      syncSingleRequest(newRequest);
    }

    return id;
  }, [isOnline]);

  const removeRequest = useCallback((id: string) => {
    // Supprimer de IndexedDB
    deleteIndexedDBRequest(id);

    // Mettre à jour l'état local
    setStatus(prev => ({
      ...prev,
      pendingRequests: prev.pendingRequests.filter(req => req.id !== id)
    }));
  }, []);

  const syncSingleRequest = useCallback(async (request: OfflineRequest) => {
    if (
      Date.now() - request.timestamp > OFFLINE_MAX_AGE_MS ||
      !isSafeOfflineRequest(request.url, request.method)
    ) {
      await deleteIndexedDBRequest(request.id);
      setStatus(prev => ({
        ...prev,
        pendingRequests: prev.pendingRequests.filter((item) => item.id !== request.id),
      }));
      return;
    }
    try {
      const response = await fetch(request.url, {
        method: request.method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request.data)
      });

      if (response.ok) {
        // Supprimer de IndexedDB
        deleteIndexedDBRequest(request.id);
        
        // Mettre à jour l'état
        setStatus(prev => ({
          ...prev,
          totalSynced: prev.totalSynced + 1,
          pendingRequests: prev.pendingRequests.filter(req => req.id !== request.id),
          lastSync: new Date()
        }));
      } else {
        // Gérer l'échec
        handleFailedRequest(request);
      }
    } catch (error) {
      console.error(`Erreur lors de la synchronisation de la requête ${request.id}:`, error);
      handleFailedRequest(request);
    }
  }, []);

  const handleFailedRequest = useCallback((request: OfflineRequest) => {
    const updatedRequest = {
      ...request,
      retries: request.retries + 1
    };

    if (updatedRequest.retries >= (updatedRequest.maxRetries || 3)) {
      // Trop d'échecs, supprimer la requête
      deleteIndexedDBRequest(request.id);
      setStatus(prev => ({
        ...prev,
        totalFailed: prev.totalFailed + 1,
        pendingRequests: prev.pendingRequests.filter(req => req.id !== request.id)
      }));
    } else {
      // Mettre à jour avec le nouveau nombre de tentatives
      updateIndexedDBRequest(updatedRequest);
      setStatus(prev => ({
        ...prev,
        pendingRequests: prev.pendingRequests.map(req => 
          req.id === request.id ? updatedRequest : req
        )
      }));
    }
  }, []);

  const syncAll = useCallback(async () => {
    if (status.isSyncing || !isOnline || status.pendingRequests.length === 0) {
      return;
    }

    setStatus(prev => ({ ...prev, isSyncing: true }));

    try {
      // Synchroniser toutes les requêtes en parallèle
      await Promise.all(
        status.pendingRequests.map(request => syncSingleRequest(request))
      );
    } catch (error) {
      console.error('Erreur lors de la synchronisation de la file d\'attente:', error);
    } finally {
      setStatus(prev => ({ ...prev, isSyncing: false }));
    }
  }, [status.pendingRequests, isOnline, syncSingleRequest]);

  const retryFailed = useCallback(async () => {
    // Cette fonction est utile pour réessayer manuellement les requêtes échouées
    await syncAll();
  }, [syncAll]);

  const clearQueue = useCallback(() => {
    // Vider la file d'attente
    const allRequests = status.pendingRequests;
    allRequests.forEach(request => deleteIndexedDBRequest(request.id));
    
    setStatus({
      isSyncing: false,
      lastSync: null,
      pendingRequests: [],
      totalSynced: 0,
      totalFailed: 0
    });
  }, [status.pendingRequests]);

  // Fonctions IndexedDB
  const getIndexedDBRequests = async (): Promise<OfflineRequest[]> => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('linkhoo-pwa', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction('offlineRequests', 'readonly');
        const store = transaction.objectStore('offlineRequests');
        const getRequest = store.getAll();
        
        getRequest.onsuccess = () => resolve(getRequest.result);
        getRequest.onerror = () => reject(getRequest.error);
      };
      
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('offlineRequests')) {
          const store = db.createObjectStore('offlineRequests', { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  };

  const saveIndexedDBRequest = async (request: OfflineRequest) => {
    return new Promise<void>((resolve, reject) => {
      const requestDB = indexedDB.open('linkhoo-pwa', 1);
      
      requestDB.onerror = () => reject(requestDB.error);
      requestDB.onsuccess = () => {
        const db = requestDB.result;
        const transaction = db.transaction('offlineRequests', 'readwrite');
        const store = transaction.objectStore('offlineRequests');
        const addRequest = store.add(request);
        
        addRequest.onsuccess = () => resolve();
        addRequest.onerror = () => reject(addRequest.error);
      };
    });
  };

  const updateIndexedDBRequest = async (request: OfflineRequest) => {
    return new Promise<void>((resolve, reject) => {
      const requestDB = indexedDB.open('linkhoo-pwa', 1);
      
      requestDB.onerror = () => reject(requestDB.error);
      requestDB.onsuccess = () => {
        const db = requestDB.result;
        const transaction = db.transaction('offlineRequests', 'readwrite');
        const store = transaction.objectStore('offlineRequests');
        const putRequest = store.put(request);
        
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      };
    });
  };

  const deleteIndexedDBRequest = async (id: string) => {
    return new Promise<void>((resolve, reject) => {
      const requestDB = indexedDB.open('linkhoo-pwa', 1);
      
      requestDB.onerror = () => reject(requestDB.error);
      requestDB.onsuccess = () => {
        const db = requestDB.result;
        const transaction = db.transaction('offlineRequests', 'readwrite');
        const store = transaction.objectStore('offlineRequests');
        const deleteRequest = store.delete(id);
        
        deleteRequest.onsuccess = () => resolve();
        deleteRequest.onerror = () => reject(deleteRequest.error);
      };
    });
  };

  return {
    status,
    addRequest,
    removeRequest,
    syncAll,
    retryFailed,
    clearQueue,
    isOnline
  };
};
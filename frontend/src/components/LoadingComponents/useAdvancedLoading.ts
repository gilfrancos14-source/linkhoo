import { useState, useCallback, useEffect, useRef } from 'react';

export interface AdvancedLoadingState {
  isLoading: boolean;
  error: string | null;
  progress: number;
  message: string;
  submessage: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

export interface NotificationItem extends AdvancedLoadingState {
  id: string;
}

interface UseAdvancedLoadingOptions {
  initialLoading?: boolean;
  initialError?: string | null;
  initialProgress?: number;
  initialMessage?: string;
  initialSubmessage?: string;
  initialType?: 'info' | 'success' | 'warning' | 'error';
  showNotification?: boolean;
  notificationDuration?: number;
  maxNotifications?: number;
}

export function useAdvancedLoading(options: UseAdvancedLoadingOptions = {}) {
  const {
    initialLoading = false,
    initialError = null,
    initialProgress = 0,
    initialMessage = 'Chargement...',
    initialSubmessage = 'Veuillez patienter',
    initialType = 'info',
    showNotification = true,
    notificationDuration = 3000,
    maxNotifications = 5,
  } = options;

  const [state, setState] = useState<AdvancedLoadingState>({
    isLoading: initialLoading,
    error: initialError,
    progress: initialProgress,
    message: initialMessage,
    submessage: initialSubmessage,
    type: initialType,
  });

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const pushNotification = useCallback(
    (notif: AdvancedLoadingState) => {
      const id = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setNotifications(prev => {
        const next = [...prev, { ...notif, id }];
        return next.length > maxNotifications ? next.slice(-maxNotifications) : next;
      });
      timersRef.current[id] = setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== id));
        delete timersRef.current[id];
      }, notificationDuration);
    },
    [notificationDuration, maxNotifications]
  );

  useEffect(() => {
    return () => {
      Object.values(timersRef.current).forEach(clearTimeout);
      timersRef.current = {};
    };
  }, []);

  const updateState = useCallback((newState: Partial<AdvancedLoadingState>) => {
    setState(prev => ({ ...prev, ...newState }));
  }, []);

  const startLoading = useCallback(
    (message = initialMessage, submessage = initialSubmessage) => {
      const next: AdvancedLoadingState = {
        isLoading: true,
        error: null,
        progress: 0,
        message,
        submessage,
        type: 'info',
      };
      updateState(next);
      if (showNotification) pushNotification(next);
    },
    [initialMessage, initialSubmessage, showNotification, updateState, pushNotification]
  );

  const updateProgress = useCallback((progress: number, message?: string) => {
    setState(prev => ({
      ...prev,
      progress,
      message: message ?? prev.message,
    }));
  }, []);

  const setError = useCallback(
    (error: string, type: 'warning' | 'error' = 'error') => {
      const next: AdvancedLoadingState = {
        isLoading: false,
        error,
        progress: 0,
        message: 'Erreur',
        submessage: error,
        type,
      };
      updateState(next);
      if (showNotification) pushNotification(next);
    },
    [showNotification, updateState, pushNotification]
  );

  const setSuccess = useCallback(
    (message: string, submessage?: string) => {
      const next: AdvancedLoadingState = {
        isLoading: false,
        error: null,
        progress: 100,
        message,
        submessage: submessage || 'Opération terminée avec succès',
        type: 'success',
      };
      updateState(next);
      if (showNotification) pushNotification(next);
    },
    [showNotification, updateState, pushNotification]
  );

  const stopLoading = useCallback(() => {
    updateState({ isLoading: false, progress: 0 });
  }, [updateState]);

  const reset = useCallback(() => {
    setState({
      isLoading: false,
      error: null,
      progress: 0,
      message: initialMessage,
      submessage: initialSubmessage,
      type: initialType,
    });
    setNotifications([]);
    Object.values(timersRef.current).forEach(clearTimeout);
    timersRef.current = {};
  }, [initialMessage, initialSubmessage, initialType]);

  return {
    ...state,
    startLoading,
    updateProgress,
    setError,
    setSuccess,
    stopLoading,
    reset,
    notifications,
  };
}

interface AsyncOperationOptions {
  loading?: UseAdvancedLoadingOptions;
  simulateProgress?: boolean;
  onSuccess?: (data: any) => void;
  onError?: (error: string) => void;
  onFinally?: () => void;
}

export function useAsyncOperation<T = any>(
  asyncFunction: () => Promise<T>,
  options: AsyncOperationOptions = {}
) {
  const loading = useAdvancedLoading(options.loading || {});
  const [data, setData] = useState<T | null>(null);

  const { simulateProgress = false, onSuccess, onError, onFinally } = options;
  const { startLoading, updateProgress, setSuccess, setError, stopLoading } = loading;

  const execute = useCallback(
    async (customMessage?: string) => {
      try {
        startLoading(customMessage || 'Chargement...');

        if (simulateProgress) {
          for (let i = 0; i <= 90; i += 10) {
            updateProgress(i);
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }

        const result = await asyncFunction();
        setData(result);
        setSuccess('Opération terminée', 'Données chargées avec succès');
        onSuccess?.(result);
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Une erreur est survenue';
        setError(errorMessage);
        onError?.(errorMessage);
        throw error;
      } finally {
        stopLoading();
        onFinally?.();
      }
    },
    [asyncFunction, simulateProgress, onSuccess, onError, onFinally, startLoading, updateProgress, setSuccess, setError, stopLoading]
  );

  return { ...loading, data, execute };
}

interface PaginatedOperationOptions {
  loading?: UseAdvancedLoadingOptions;
  pageSize?: number;
  initialData?: any[];
}

export function usePaginatedOperation<T = any>(
  fetchFunction: (page: number, pageSize: number) => Promise<{ data: T[]; hasMore: boolean }>,
  options: PaginatedOperationOptions = {}
) {
  const loading = useAdvancedLoading(options.loading || {});
  const [data, setData] = useState<T[]>(options.initialData || []);

  // Page 0 = rien encore chargé. Si initialData est fourni, on considère que la page 1 est déjà chargée.
  const [page, setPage] = useState<number>(
    options.initialData && options.initialData.length > 0 ? 1 : 0
  );
  const [hasMore, setHasMore] = useState(true);
  const [pageSize] = useState(options.pageSize || 10);

  const { isLoading, startLoading, setError, stopLoading, reset: resetLoading } = loading;
  const initialData = options.initialData;

  const loadMore = useCallback(
    async (customMessage?: string) => {
      if (isLoading || !hasMore) return;

      try {
        startLoading(customMessage || 'Chargement de plus de données...');
        const result = await fetchFunction(page + 1, pageSize);
        setData(prev => [...prev, ...result.data]);
        setPage(prev => prev + 1);
        setHasMore(result.hasMore);
        stopLoading();
        loading.setSuccess('Chargement terminé', `${result.data.length} éléments ajoutés`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Une erreur est survenue';
        setError(errorMessage);
        stopLoading();
      }
    },
    [fetchFunction, page, hasMore, pageSize, isLoading, startLoading, setError, stopLoading, loading]
  );

  const reset = useCallback(() => {
    setData(initialData || []);
    setPage(initialData && initialData.length > 0 ? 1 : 0);
    setHasMore(true);
    resetLoading();
  }, [initialData, resetLoading]);

  return { ...loading, data, page, hasMore, loadMore, reset };
}
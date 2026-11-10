import React from 'react';

interface PageLoaderProps {
  loading: boolean;
  error?: string | null;
  children: React.ReactNode;
  skeleton?: boolean;
  skeletonCount?: number;
  retryCallback?: () => void;
  className?: string;
}

export const PageLoader: React.FC<PageLoaderProps> = ({
  loading,
  error,
  children,
  skeleton = false,
  retryCallback,
  className = '',
}) => {
  return (
    <div className={`relative ${className}`}>
      <div className="relative z-10">{children}</div>

      {loading && (
        <div className="absolute top-4 right-4 z-20 bg-white bg-opacity-90 backdrop-blur-sm rounded-lg shadow-lg p-4">
          {skeleton ? (
            <div className="flex items-center space-x-2">
              <div className="h-4 w-4 bg-gray-300 rounded animate-pulse" />
              <div className="h-4 w-4 bg-gray-300 rounded animate-pulse" style={{ animationDelay: '0.2s' }} />
              <div className="h-4 w-4 bg-gray-300 rounded animate-pulse" style={{ animationDelay: '0.4s' }} />
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <div className="h-4 w-4 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
              <span className="text-sm text-gray-600">Chargement...</span>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white bg-opacity-95">
          <div className="text-center p-8 bg-red-50 rounded-lg max-w-md">
            <div className="text-red-500 text-5xl mb-4">⚠️</div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2 m-0">Oups!</h3>
            <p className="text-gray-600 mb-4 mt-0">{error}</p>
            {retryCallback ? (
              <button
                onClick={retryCallback}
                className="appearance-none border-0 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors cursor-pointer"
              >
                Réessayer
              </button>
            ) : (
              <p className="text-sm text-gray-500 mt-0">Veuillez recharger la page.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface DashboardLoaderProps {
  loading: boolean;
  message?: string;
}

export const DashboardLoader: React.FC<DashboardLoaderProps> = ({
  loading,
  message = 'Chargement de votre tableau de bord...',
}) => {
  if (!loading) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white bg-opacity-95 backdrop-blur-sm">
      <div className="text-center">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin mx-auto" />
          <div
            className="absolute inset-0 w-16 h-16 border-4 border-blue-200 border-r-blue-300 rounded-full animate-spin-reverse mx-auto"
            style={{ animationDelay: '0.5s' }}
          />
        </div>
        <p className="mt-4 text-gray-600 font-medium">{message}</p>
      </div>
    </div>
  );
};

interface CardLoaderProps {
  count?: number;
  className?: string;
}

export const CardLoader: React.FC<CardLoaderProps> = ({ count = 1, className = '' }) => {
  return (
    <div className={`space-y-4 ${className}`}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="h-6 w-1/3 bg-gray-300 rounded animate-pulse" />
            <div className="h-8 w-20 bg-gray-300 rounded animate-pulse" />
          </div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-300 rounded animate-pulse" />
            <div className="h-4 bg-gray-300 rounded w-5/6 animate-pulse" />
            <div className="h-4 bg-gray-300 rounded w-4/6 animate-pulse" />
          </div>
          <div className="mt-4 flex justify-between items-center">
            <div className="h-10 w-24 bg-gray-300 rounded animate-pulse" />
            <div className="h-10 w-24 bg-gray-300 rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
};
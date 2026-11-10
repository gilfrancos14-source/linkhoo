import React from 'react';

interface ModernListLoaderProps {
  count?: number;
  className?: string;
  showAvatar?: boolean;
  showMedia?: boolean;
  showTitle?: boolean;
  showDescription?: boolean;
  showFooter?: boolean;
}

export const ModernListLoader: React.FC<ModernListLoaderProps> = ({
  count = 3,
  className = '',
  showAvatar = true,
  showMedia = false,
  showTitle = true,
  showDescription = true,
  showFooter = true,
}) => {
  return (
    <div className={`space-y-4 ${className}`}>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden transition-all duration-300 hover:shadow-md"
        >
          {showMedia && (
            <div className="h-48 w-full bg-gradient-to-r from-blue-50 to-indigo-50 animate-pulse" />
          )}

          <div className="p-5">
            {showAvatar && (
              <div className="flex items-center space-x-3 mb-4">
                <div className="h-12 w-12 rounded-full bg-gradient-to-r from-blue-400 to-indigo-500 animate-pulse" />
                <div className="space-y-2">
                  <div className="h-4 w-32 bg-gradient-to-r from-gray-200 to-gray-300 rounded animate-pulse" />
                  <div className="h-3 w-24 bg-gradient-to-r from-gray-200 to-gray-300 rounded animate-pulse" />
                </div>
              </div>
            )}

            {showTitle && (
              <div className="space-y-2 mb-3">
                <div className="h-6 w-3/4 bg-gradient-to-r from-gray-200 to-gray-300 rounded animate-pulse" />
                <div className="h-4 w-1/2 bg-gradient-to-r from-gray-200 to-gray-300 rounded animate-pulse" />
              </div>
            )}

            {showDescription && (
              <div className="space-y-2 mb-4">
                <div className="h-4 bg-gradient-to-r from-gray-200 to-gray-300 rounded animate-pulse" />
                <div className="h-4 w-5/6 bg-gradient-to-r from-gray-200 to-gray-300 rounded animate-pulse" />
                <div className="h-4 w-2/3 bg-gradient-to-r from-gray-200 to-gray-300 rounded animate-pulse" />
              </div>
            )}

            {showFooter && (
              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <div className="flex space-x-2">
                  <div className="h-10 w-24 bg-gradient-to-r from-blue-500 to-indigo-500 rounded animate-pulse" />
                  <div className="h-10 w-24 bg-gradient-to-r from-gray-200 to-gray-300 rounded animate-pulse" />
                </div>
                <div className="h-10 w-10 rounded-full bg-gradient-to-r from-gray-200 to-gray-300 animate-pulse" />
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

interface ModernTableLoaderProps {
  rows?: number;
  columns?: number;
  className?: string;
}

const TABLE_COLS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
  6: 'grid-cols-6',
  7: 'grid-cols-7',
  8: 'grid-cols-8',
  9: 'grid-cols-9',
  10: 'grid-cols-10',
  11: 'grid-cols-11',
  12: 'grid-cols-12',
};

export const ModernTableLoader: React.FC<ModernTableLoaderProps> = ({
  rows = 5,
  columns = 4,
  className = '',
}) => {
  const colsClass = TABLE_COLS[columns] ?? 'grid-cols-4';

  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden ${className}`}>
      <div className={`grid ${colsClass} gap-4 p-4 border-b border-gray-100`}>
        {Array.from({ length: columns }).map((_, index) => (
          <div key={index} className="h-6 bg-gradient-to-r from-gray-200 to-gray-300 rounded animate-pulse" />
        ))}
      </div>

      <div className="divide-y divide-gray-100">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className={`grid ${colsClass} gap-4 p-4`}>
            {Array.from({ length: columns }).map((_, colIndex) => (
              <div key={colIndex} className="h-10 bg-gradient-to-r from-gray-50 to-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

interface ModernCardGridLoaderProps {
  count?: number;
  className?: string;
}

export const ModernCardGridLoader: React.FC<ModernCardGridLoaderProps> = ({
  count = 6,
  className = '',
}) => {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ${className}`}>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden transition-all duration-300 hover:shadow-md"
        >
          <div className="h-48 bg-gradient-to-r from-blue-50 to-indigo-50 animate-pulse" />
          <div className="p-4">
            <div className="h-6 w-3/4 bg-gradient-to-r from-gray-200 to-gray-300 rounded animate-pulse mb-3" />
            <div className="h-4 w-full bg-gradient-to-r from-gray-200 to-gray-300 rounded animate-pulse mb-2" />
            <div className="h-4 w-5/6 bg-gradient-to-r from-gray-200 to-gray-300 rounded animate-pulse mb-4" />
            <div className="flex justify-between items-center">
              <div className="h-10 w-24 bg-gradient-to-r from-blue-500 to-indigo-500 rounded animate-pulse" />
              <div className="h-10 w-10 rounded-full bg-gradient-to-r from-gray-200 to-gray-300 animate-pulse" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
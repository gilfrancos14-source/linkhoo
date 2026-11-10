import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circle' | 'rect' | 'avatar';
  width?: string | number;
  height?: string | number;
  animate?: boolean;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'rect',
  width,
  height,
  animate = true,
}) => {
  const baseClasses = 'bg-gray-200 rounded';

  const variantClasses = {
    text: 'h-4',
    circle: 'rounded-full',
    rect: '',
    avatar: 'rounded-full',
  };

  const isRound = variant === 'circle' || variant === 'avatar';

  const style: React.CSSProperties = {
    width: width || (isRound ? '40px' : '100%'),
    height: height || (isRound ? '40px' : '16px'),
  };

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${animate ? 'animate-pulse' : ''} ${className}`}
      style={style}
    />
  );
};

interface SkeletonListProps {
  count: number;
  className?: string;
  avatar?: boolean;
  lines?: number;
}

export const SkeletonList: React.FC<SkeletonListProps> = ({
  count,
  className = '',
  avatar = false,
  lines = 3,
}) => {
  return (
    <div className={`space-y-4 ${className}`}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="flex items-start space-x-4">
          {avatar && <Skeleton variant="avatar" className="flex-shrink-0" />}
          <div className="flex-1 space-y-2">
            {Array.from({ length: lines }).map((_, lineIndex) => (
              <div key={lineIndex}>
                <Skeleton
                  variant="text"
                  className={lineIndex === 0 ? 'w-3/4' : lineIndex === 1 ? 'w-1/2' : 'w-5/6'}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

interface SkeletonCardProps {
  className?: string;
  showAvatar?: boolean;
  showMedia?: boolean;
  showTitle?: boolean;
  showDescription?: boolean;
  showFooter?: boolean;
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({
  className = '',
  showAvatar = false,
  showMedia = false,
  showTitle = true,
  showDescription = true,
  showFooter = true,
}) => {
  return (
    <div className={`bg-white rounded-lg shadow-md overflow-hidden ${className}`}>
      {showMedia && <div className="h-48 w-full bg-gray-200 animate-pulse" />}

      <div className="p-4">
        {showAvatar && (
          <div className="flex items-center space-x-3 mb-4">
            <Skeleton variant="avatar" />
            <div className="space-y-2">
              <Skeleton variant="text" width="120px" />
              <Skeleton variant="text" width="80px" />
            </div>
          </div>
        )}

        {showTitle && (
          <div className="space-y-2 mb-3">
            <Skeleton variant="text" width="70%" height="20px" />
            <Skeleton variant="text" width="50%" height="16px" />
          </div>
        )}

        {showDescription && (
          <div className="space-y-2 mb-4">
            <Skeleton variant="text" />
            <Skeleton variant="text" width="90%" />
            <Skeleton variant="text" width="60%" />
          </div>
        )}

        {showFooter && (
          <div className="flex items-center justify-between pt-3 border-t border-gray-200">
            <div className="flex space-x-2">
              <Skeleton variant="rect" width="80px" height="32px" />
              <Skeleton variant="rect" width="80px" height="32px" />
            </div>
            <Skeleton variant="circle" width="32px" height="32px" />
          </div>
        )}
      </div>
    </div>
  );
};

interface SkeletonGridProps {
  columns?: number;
  count: number;
  className?: string;
}

const GRID_COLS_LG: Record<number, string> = {
  1: 'lg:grid-cols-1',
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
  5: 'lg:grid-cols-5',
  6: 'lg:grid-cols-6',
  7: 'lg:grid-cols-7',
  8: 'lg:grid-cols-8',
  9: 'lg:grid-cols-9',
  10: 'lg:grid-cols-10',
  11: 'lg:grid-cols-11',
  12: 'lg:grid-cols-12',
};

export const SkeletonGrid: React.FC<SkeletonGridProps> = ({
  columns = 3,
  count,
  className = '',
}) => {
  const lgCols = GRID_COLS_LG[columns] ?? 'lg:grid-cols-3';

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 ${lgCols} gap-4 ${className}`}>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={index} />
      ))}
    </div>
  );
};
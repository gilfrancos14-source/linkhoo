import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  className?: string;
  variant?: 'dots' | 'bars' | 'pulse' | 'spinner';
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  text = 'Chargement...',
  className = '',
  variant = 'dots',
}) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  };

  const baseClasses = `inline-flex items-center justify-center ${className}`;

  switch (variant) {
    case 'dots':
      return (
        <div className={`${baseClasses} space-x-1`}>
          <div className={`${sizeClasses[size]} animate-bounce rounded-full bg-blue-500`} style={{ animationDelay: '0ms' }} />
          <div className={`${sizeClasses[size]} animate-bounce rounded-full bg-blue-500`} style={{ animationDelay: '150ms' }} />
          <div className={`${sizeClasses[size]} animate-bounce rounded-full bg-blue-500`} style={{ animationDelay: '300ms' }} />
          {text && <span className="ml-2 text-sm text-gray-600">{text}</span>}
        </div>
      );

    case 'bars':
      return (
        <div className={`${baseClasses} space-x-1`}>
          <div className={`${sizeClasses[size]} animate-pulse bg-blue-500 rounded`} style={{ animationDelay: '0ms' }} />
          <div className={`${sizeClasses[size]} animate-pulse bg-blue-500 rounded`} style={{ animationDelay: '150ms' }} />
          <div className={`${sizeClasses[size]} animate-pulse bg-blue-500 rounded`} style={{ animationDelay: '300ms' }} />
          {text && <span className="ml-2 text-sm text-gray-600">{text}</span>}
        </div>
      );

    case 'pulse':
      return (
        <div className={`${baseClasses}`}>
          <div className={`${sizeClasses[size]} animate-pulse bg-blue-500 rounded-full`} />
          {text && <span className="ml-2 text-sm text-gray-600">{text}</span>}
        </div>
      );

    case 'spinner':
    default:
      return (
        <div className={`${baseClasses}`}>
          <div className={`${sizeClasses[size]} border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin`} />
          {text && <span className="ml-2 text-sm text-gray-600">{text}</span>}
        </div>
      );
  }
};

interface LoadingSkeletonProps {
  className?: string;
  lines?: number;
  avatar?: boolean;
  media?: boolean;
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  className = '',
  lines = 3,
  avatar = false,
  media = false,
}) => {
  return (
    <div className={`animate-pulse ${className}`}>
      {avatar && <div className="mb-4 h-12 w-12 rounded-full bg-gray-300" />}
      {media && <div className="mb-4 h-48 w-full rounded-lg bg-gray-300" />}
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`mb-2 h-4 rounded bg-gray-200 ${i === 0 ? 'w-3/4' : i === 1 ? 'w-1/2' : 'w-5/6'}`}
        />
      ))}
    </div>
  );
};

interface LoadingScreenProps {
  message?: string;
  submessage?: string;
  className?: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  message = 'Chargement',
  submessage = 'Veuillez patienter...',
  className = '',
}) => {
  return (
    <div className={`flex flex-col items-center justify-center space-y-4 p-8 ${className}`}>
      <LoadingSpinner size="lg" text={message} />
      <p className="text-sm text-gray-500">{submessage}</p>
    </div>
  );
};
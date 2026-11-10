import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface AdvancedLoadingProps {
  type?: 'page' | 'card' | 'inline' | 'fullscreen';
  message?: string;
  progress?: number; // 0-100
  showProgress?: boolean;
  variant?: 'wave' | 'pulse' | 'dots' | 'bars';
  className?: string;
}

export const AdvancedLoading: React.FC<AdvancedLoadingProps> = ({
  type = 'page',
  message = 'Chargement',
  progress,
  showProgress = false,
  variant = 'dots',
  className = '',
}) => {
  const baseClasses = 'flex flex-col items-center justify-center';

  const containerClasses = {
    page: 'min-h-[60vh]',
    card: 'h-64',
    inline: 'h-12',
    fullscreen: 'fixed inset-0 z-50 bg-white bg-opacity-90',
  };

  const renderLoadingAnimation = () => {
    switch (variant) {
      case 'wave':
        return (
          <div className="flex space-x-1">
            {[0, 0.2, 0.4, 0.6, 0.8].map((delay) => (
              <motion.div
                key={delay}
                className="h-8 w-2 bg-blue-500 rounded-full"
                animate={{
                  scaleY: [1, 1.5, 1],
                }}
                transition={{
                  duration: 1.2,
                  repeat: Infinity,
                  delay: delay,
                  ease: 'easeInOut',
                }}
              />
            ))}
          </div>
        );

      case 'pulse':
        return (
          <motion.div
            className="h-12 w-12 bg-blue-500 rounded-full"
            animate={{
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        );

      case 'bars':
        return (
          <div className="flex space-x-2">
            {[0, 0.1, 0.2].map((delay) => (
              <motion.div
                key={delay}
                className="h-8 w-2 bg-blue-500 rounded"
                animate={{
                  height: [20, 40, 20],
                }}
                transition={{
                  duration: 1.2,
                  repeat: Infinity,
                  delay: delay,
                }}
              />
            ))}
          </div>
        );

      case 'dots':
      default:
        return (
          <div className="flex space-x-2">
            {[0, 0.2, 0.4].map((delay) => (
              <motion.div
                key={delay}
                className="h-3 w-3 bg-blue-500 rounded-full"
                animate={{
                  scale: [1, 1.5, 1],
                }}
                transition={{
                  duration: 1.2,
                  repeat: Infinity,
                  delay: delay,
                }}
              />
            ))}
          </div>
        );
    }
  };

  const renderProgress = () => {
    if (!showProgress || progress === undefined) return null;
    
    return (
      <div className="w-full max-w-xs mt-4">
        <div className="flex justify-between text-sm text-gray-600 mb-1">
          <span>Progression</span>
          <span>{progress}%</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-blue-500 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>
    );
  };

  const renderContent = () => (
    <>
      {renderLoadingAnimation()}
      {message && (
        <motion.p
          className="mt-4 text-gray-600 font-medium"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          {message}
        </motion.p>
      )}
      {renderProgress()}
    </>
  );

  if (type === 'fullscreen') {
    return (
      <AnimatePresence>
        <motion.div
          className={`fixed inset-0 z-50 flex items-center justify-center bg-white bg-opacity-90 backdrop-blur-sm ${className}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {renderContent()}
        </motion.div>
      </AnimatePresence>
    );
  }

  return (
    <motion.div
      className={`${baseClasses} ${containerClasses[type]} ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {renderContent()}
    </motion.div>
  );
};

interface LoadingCardProps {
  title?: string;
  description?: string;
  className?: string;
}

export const LoadingCard: React.FC<LoadingCardProps> = ({
  title,
  description,
  className = '',
}) => {
  return (
    <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
      {title && (
        <div className="h-6 w-1/3 bg-gray-300 rounded mb-4 animate-pulse" />
      )}
      <div className="space-y-3">
        <div className="h-4 bg-gray-300 rounded animate-pulse" />
        <div className="h-4 bg-gray-300 rounded w-5/6 animate-pulse" />
        <div className="h-4 bg-gray-300 rounded w-4/6 animate-pulse" />
      </div>
      {description && (
        <div className="mt-4 h-4 bg-gray-300 rounded w-full animate-pulse" />
      )}
    </div>
  );
};
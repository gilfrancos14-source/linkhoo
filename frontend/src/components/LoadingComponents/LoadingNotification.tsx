import React, { useEffect, useState } from 'react';
import { LoadingSpinner } from './LoadingSpinner';

interface LoadingNotificationProps {
  message: string;
  submessage?: string;
  duration?: number;
  onClose?: () => void;
  type?: 'info' | 'success' | 'warning' | 'error';
}

export const LoadingNotification: React.FC<LoadingNotificationProps> = ({
  message,
  submessage,
  duration = 5000,
  onClose,
  type = 'info',
}) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        onClose?.();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <div className="w-6 h-6 text-green-500">✓</div>;
      case 'warning':
        return <div className="w-6 h-6 text-yellow-500">⚠</div>;
      case 'error':
        return <div className="w-6 h-6 text-red-500">✕</div>;
      default:
        return <LoadingSpinner size="sm" variant="dots" text="" />;
    }
  };

  const getBgColor = () => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-blue-50 border-blue-200';
    }
  };

  if (!isVisible) return null;

  return (
    <div className={`fixed top-4 right-4 z-50 max-w-sm rounded-lg border ${getBgColor()} shadow-lg transition-all duration-300 transform translate-x-0`}>
      <div className="flex items-start p-4">
        <div className="flex-shrink-0">{getIcon()}</div>
        <div className="ml-3 flex-1">
          <p className="text-sm font-medium text-gray-900">{message}</p>
          {submessage && <p className="mt-1 text-sm text-gray-500">{submessage}</p>}
        </div>
        <button
          onClick={() => {
            setIsVisible(false);
            onClose?.();
          }}
          className="appearance-none border-0 bg-transparent ml-4 flex-shrink-0 rounded-md text-gray-400 hover:text-gray-500 focus:outline-none cursor-pointer"
        >
          <span className="sr-only">Fermer</span>
          <div className="w-5 h-5">×</div>
        </button>
      </div>
    </div>
  );
};

interface LoadingProgressBarProps {
  progress: number;
  message?: string;
  className?: string;
}

export const LoadingProgressBar: React.FC<LoadingProgressBarProps> = ({
  progress,
  message,
  className = '',
}) => {
  const clamped = Math.max(0, Math.min(100, progress));

  return (
    <div className={`w-full max-w-md mx-auto ${className}`}>
      {message && (
        <div className="mb-2 flex justify-between text-sm">
          <span className="text-gray-700 font-medium">{message}</span>
          <span className="text-gray-500">{clamped}%</span>
        </div>
      )}
      <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500 ease-out"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
};

interface LoadingStepperProps {
  steps: { label: string; description?: string }[];
  currentStep: number;
  className?: string;
}

export const LoadingStepper: React.FC<LoadingStepperProps> = ({
  steps,
  currentStep,
  className = '',
}) => {
  return (
    <div className={`max-w-md mx-auto ${className}`}>
      <div className="space-y-4">
        {steps.map((step, index) => (
          <div key={index} className="flex items-start">
            <div
              className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                index < currentStep
                  ? 'bg-green-500 text-white'
                  : index === currentStep
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-500'
              }`}
            >
              {index < currentStep ? '✓' : index + 1}
            </div>
            <div className="ml-3">
              <p
                className={`text-sm font-medium ${
                  index < currentStep
                    ? 'text-green-600'
                    : index === currentStep
                    ? 'text-blue-600'
                    : 'text-gray-500'
                }`}
              >
                {step.label}
              </p>
              {step.description && <p className="text-xs text-gray-500 mt-1">{step.description}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useInstallPrompt } from '../hooks/useInstallPrompt';

interface InstallPromptProps {
  className?: string;
  autoShow?: boolean;
  maxShowCount?: number;
  delay?: number;
}

const InstallPrompt: React.FC<InstallPromptProps> = ({ 
  className = '', 
  autoShow = false,
  maxShowCount = 3,
  delay = 5000 
}) => {
  const { t } = useTranslation();
  const { 
    isInstallable, 
    isInstalled, 
    installPrompt, 
    showInstallPrompt, 
    dismissPrompt,
    trackInstall 
  } = useInstallPrompt();
  
  const [isVisible, setIsVisible] = useState(false);
  const [showCount, setShowCount] = useState(0);
  const [isInstalling, setIsInstalling] = useState(false);

  // Compter le nombre de fois que le prompt a été montré
  useEffect(() => {
    const count = parseInt(localStorage.getItem('install_prompt_shown_count') || '0');
    setShowCount(count);
  }, []);

  // Auto-show après un délai
  useEffect(() => {
    if (autoShow && isInstallable && !isInstalled && showCount < maxShowCount) {
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, delay);
      
      return () => clearTimeout(timer);
    }
  }, [autoShow, isInstallable, isInstalled, showCount, maxShowCount, delay]);

  // Gérer l'installation
  const handleInstall = async () => {
    if (!installPrompt) return;
    
    setIsInstalling(true);
    try {
      const success = await showInstallPrompt();
      if (success) {
        trackInstall();
        setIsVisible(false);
      }
    } catch (error) {
      console.error('Erreur lors de l\'installation:', error);
    } finally {
      setIsInstalling(false);
    }
  };

  // Gérer le rejet
  const handleDismiss = () => {
    dismissPrompt();
    setIsVisible(false);
  };

  // Ne pas afficher si l'application est déjà installée
  if (isInstalled) {
    return null;
  }

  // Ne pas afficher si le prompt n'est pas disponible
  if (!isInstallable) {
    return null;
  }

  // Ne pas afficher si le nombre maximum d'affichages est atteint
  if (showCount >= maxShowCount) {
    return null;
  }

  return (
    <div className={`install-prompt ${className} ${isVisible ? 'visible' : 'hidden'}`}>
      <div className="install-prompt-content">
        <div className="install-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
        </div>
        
        <div className="install-text">
          <h3>{t('pwa.installTitle')}</h3>
          <p>{t('pwa.installDescription')}</p>
        </div>
        
        <div className="install-actions">
          <button 
            onClick={handleInstall}
            disabled={isInstalling}
            className="btn btn-primary install-btn"
          >
            {isInstalling ? (
              <>
                <span className="spinner"></span>
                {t('pwa.installing')}
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                {t('pwa.install')}
              </>
            )}
          </button>
          
          <button 
            onClick={handleDismiss}
            className="btn btn-secondary dismiss-btn"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
            {t('pwa.later')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default InstallPrompt;
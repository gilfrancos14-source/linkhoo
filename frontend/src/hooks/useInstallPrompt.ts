import { useState, useEffect, useCallback } from 'react';

// Analytics optionnel : présent uniquement si un script gtag est chargé.
declare const gtag: (command: string, action: string, params: Record<string, unknown>) => void;

interface InstallPromptReturn {
  isInstallable: boolean;
  isInstalled: boolean;
  installPrompt: Event | null;
  showInstallPrompt: () => Promise<boolean>;
  dismissPrompt: () => void;
  trackInstall: () => void;
}

export const useInstallPrompt = (): InstallPromptReturn => {
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);
  const [promptDismissed, setPromptDismissed] = useState(false);

  // Vérifier si l'application est déjà installée
  useEffect(() => {
    const checkIfInstalled = () => {
      // Vérifier si l'application est installée en mode PWA
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                          (window.navigator as any).standalone;
      
      // Vérifier si l'application est ouverte depuis un écran d'accueil
      const isFromHomeScreen = window.matchMedia('(display-mode: fullscreen)').matches;
      
      setIsInstalled(isStandalone || isFromHomeScreen);
    };

    // Écouter les changements de mode d'affichage
    const handleDisplayModeChange = () => {
      checkIfInstalled();
    };

    // Vérifier initialement
    checkIfInstalled();

    // Écouter les changements
    window.addEventListener('appinstalled', checkIfInstalled);
    window.matchMedia('(display-mode: standalone)').addEventListener('change', handleDisplayModeChange);
    window.matchMedia('(display-mode: fullscreen)').addEventListener('change', handleDisplayModeChange);

    return () => {
      window.removeEventListener('appinstalled', checkIfInstalled);
      window.matchMedia('(display-mode: standalone)').removeEventListener('change', handleDisplayModeChange);
      window.matchMedia('(display-mode: fullscreen)').removeEventListener('change', handleDisplayModeChange);
    };
  }, []);

  // Capturer l'événement de prompt d'installation
  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      // Empêcher le comportement par défaut
      event.preventDefault();
      
      // Sauvegarder le prompt pour une utilisation ultérieure
      setInstallPrompt(event);
      setIsInstallable(true);
      setPromptDismissed(false);
    };

    // Écouter l'événement de prompt
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const showInstallPrompt = useCallback(async (): Promise<boolean> => {
    if (!installPrompt || promptDismissed || isInstalled) {
      return false;
    }

    try {
      // Convertir l'événement en BeforeInstallPromptEvent
      const promptEvent = installPrompt as any;
      
      // Afficher le prompt d'installation
      const result = await promptEvent.prompt();
      
      // L'utilisateur a cliqué sur installer
      if (result.outcome === 'accepted') {
        // L'installation a commencé
        trackInstall();
        return true;
      } else {
        // L'utilisateur a refusé
        setPromptDismissed(true);
        return false;
      }
    } catch (error) {
      console.error('Erreur lors de l\'affichage du prompt d\'installation:', error);
      return false;
    }
  }, [installPrompt, promptDismissed, isInstalled]);

  const dismissPrompt = useCallback(() => {
    setPromptDismissed(true);
    setInstallPrompt(null);
    setIsInstallable(false);
  }, []);

  const trackInstall = useCallback(() => {
    // Envoyer un événement d'analyse pour suivre l'installation
    if (typeof gtag !== 'undefined') {
      gtag('event', 'pwa_install', {
        event_category: 'engagement',
        event_label: 'app_install'
      });
    }

    // Sauvegarder dans le stockage local que l'utilisateur a vu le prompt
    localStorage.setItem('install_prompt_shown', 'true');
    
    // Mettre à jour l'état
    setPromptDismissed(true);
    setInstallPrompt(null);
    setIsInstallable(false);
  }, []);

  return {
    isInstallable,
    isInstalled,
    installPrompt,
    showInstallPrompt,
    dismissPrompt,
    trackInstall
  };
};
import React, { useEffect } from 'react';
import PWAControlPanel from './PWAControlPanel';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { useOfflineQueue } from '../hooks/useOfflineQueue';
import { useCacheManager } from '../hooks/useCacheManager';

const PWAIntegration: React.FC = () => {
  const { permission: pushPermission } = usePushNotifications();
  const { status: offlineStatus } = useOfflineQueue();
  const { stats: cacheStats } = useCacheManager();

  // Écouter les messages du service worker
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const { type, data } = event.data;
      
      switch (type) {
        case 'OFFLINE_QUEUE_ADDED':
          console.log('Requête ajoutée à la file d\'attente:', data);
          // Afficher une notification à l'utilisateur
          break;
          
        case 'OFFLINE_REQUEST_SYNCED':
          console.log('Requête synchronisée:', data);
          // Mettre à jour l'interface
          break;
          
        case 'OFFLINE_REQUEST_FAILED':
          console.log('Requête échouée:', data);
          // Afficher une erreur
          break;
      }
    };
    
    navigator.serviceWorker?.addEventListener('message', handleMessage);
    
    return () => {
      navigator.serviceWorker?.removeEventListener('message', handleMessage);
    };
  }, []);

  // Vérifier l'état de la connexion
  useEffect(() => {
    const handleOnline = () => {
      console.log('Application en ligne');
      // Synchroniser les requêtes hors-ligne
      navigator.serviceWorker?.controller?.postMessage({ type: 'SYNC_OFFLINE_QUEUE' });
    };
    
    const handleOffline = () => {
      console.log('Application hors ligne');
      // Afficher une bannière hors-ligne
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div className="pwa-integration">
      {/* Panneau de contrôle PWA - à placer dans le layout principal */}
      <PWAControlPanel 
        className="main-control-panel"
        showNotifications={true}
        showOfflineQueue={true}
        showInstallPrompt={true}
        showCacheManager={true}
        autoShow={false}
      />
      
      {/* Exemple d'utilisation du composant de bannière de notifications */}
      {pushPermission === 'default' && (
        <div className="notification-banner-container">
          {/* Le PushNotificationBanner sera géré par le PWAControlPanel */}
        </div>
      )}
      
      {/* Exemple d'utilisation du composant de file d'attente hors-ligne */}
      {offlineStatus.pendingRequests.length > 0 && (
        <div className="offline-queue-container">
          {/* Le OfflineQueueStatus sera géré par le PWAControlPanel */}
        </div>
      )}
      
      {/* Exemple d'utilisation du composant de gestion du cache */}
      {cacheStats && cacheStats.totalSize > 1024 * 1024 && (
        <div className="cache-manager-container">
          {/* Le CacheManager sera géré par le PWAControlPanel */}
        </div>
      )}
    </div>
  );
};

export default PWAIntegration;

// Exemple d'utilisation dans un composant de formulaire
export const OfflineFormExample: React.FC = () => {
  const formFields = [
    {
      name: 'name',
      label: 'Nom',
      type: 'text',
      placeholder: 'Entrez votre nom',
      required: true,
      validation: (value: string) => {
        if (value.length < 2) {
          return 'Le nom doit contenir au moins 2 caractères';
        }
        return null;
      }
    },
    {
      name: 'email',
      label: 'Email',
      type: 'email',
      placeholder: 'entrez@email.com',
      required: true,
      validation: (value: string) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          return 'Email invalide';
        }
        return null;
      }
    },
    {
      name: 'message',
      label: 'Message',
      type: 'textarea',
      placeholder: 'Entrez votre message',
      required: false
    },
    {
      name: 'newsletter',
      label: 'S\'abonner à la newsletter',
      type: 'checkbox',
      required: false
    },
    {
      name: 'contact',
      label: 'Préférence de contact',
      type: 'radio',
      required: true,
      options: [
        { value: 'email', label: 'Email' },
        { value: 'phone', label: 'Téléphone' },
        { value: 'sms', label: 'SMS' }
      ]
    }
  ];

  const handleSubmit = async (values: Record<string, any>) => {
    console.log('Formulaire soumis:', values);
    
    // Simuler une API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Retourner une réponse
    return {
      success: true,
      message: 'Message envoyé avec succès'
    };
  };

  // Démo : les données ne sont pas encore branchées sur le formulaire.
  void formFields;
  void handleSubmit;

  return (
    <div className="offline-form-example">
      <h2>Formulaire hors-ligne</h2>
      <p>Ce formulaire fonctionne même sans connexion internet. Les données sont sauvegardées localement et synchronisées dès que la connexion est rétablie.</p>
      
      {/* Importer le composant OfflineForm dans le composant parent */}
      {/*
      import OfflineForm from './OfflineForm';
      
      <OfflineForm 
        fields={formFields}
        onSubmit={handleSubmit}
        className="contact-form"
        autoSave={true}
        showAutoSaveToggle={true}
        submitButtonText="Envoyer le message"
        submittingText="Envoi en cours..."
      />
      */}
    </div>
  );
};

// Exemple d'utilisation dans un composant de réservation
export const OfflineReservationForm: React.FC = () => {
  const formFields = [
    {
      name: 'checkin',
      label: 'Date d\'arrivée',
      type: 'date',
      required: true
    },
    {
      name: 'checkout',
      label: 'Date de départ',
      type: 'date',
      required: true,
      validation: (value: string, allValues: any) => {
        if (allValues.checkin && new Date(value) <= new Date(allValues.checkin)) {
          return 'La date de départ doit être après la date d\'arrivée';
        }
        return null;
      }
    },
    {
      name: 'guests',
      label: 'Nombre de voyageurs',
      type: 'number',
      min: 1,
      max: 10,
      required: true,
      validation: (value: number) => {
        if (value < 1 || value > 10) {
          return 'Le nombre de voyageurs doit être entre 1 et 10';
        }
        return null;
      }
    },
    {
      name: 'special_requests',
      label: 'Demandes spéciales',
      type: 'textarea',
      placeholder: 'Indiquez vos préférences ou besoins spéciaux',
      required: false
    }
  ];

  const handleSubmit = async (values: Record<string, any>) => {
    console.log('Réservation soumise:', values);
    
    // Simuler une API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Retourner une réponse
    return {
      success: true,
      bookingId: `BK${Date.now()}`,
      message: 'Réservation confirmée !'
    };
  };

  // Démo : les données ne sont pas encore branchées sur le formulaire.
  void formFields;
  void handleSubmit;

  return (
    <div className="offline-reservation-form">
      <h2>Réservation hors-ligne</h2>
      <p>Effectuez votre réservation même sans connexion. Votre réservation sera sauvegardée et confirmée dès que la connexion sera rétablie.</p>
      
      {/* Importer le composant OfflineForm dans le composant parent */}
      {/*
      import OfflineForm from './OfflineForm';
      
      <OfflineForm 
        fields={formFields}
        onSubmit={handleSubmit}
        className="reservation-form"
        autoSave={true}
        showAutoSaveToggle={true}
        submitButtonText="Réserver maintenant"
        submittingText="Confirmation en cours..."
      />
      */}
    </div>
  );
};

// Exemple d'utilisation dans un composant de contact
export const OfflineContactForm: React.FC = () => {
  const formFields = [
    {
      name: 'name',
      label: 'Nom complet',
      type: 'text',
      placeholder: 'Jean Dupont',
      required: true,
      validation: (value: string) => {
        if (value.length < 3) {
          return 'Veuillez entrer votre nom complet';
        }
        return null;
      }
    },
    {
      name: 'email',
      label: 'Email',
      type: 'email',
      placeholder: 'jean@example.com',
      required: true,
      validation: (value: string) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          return 'Veuillez entrer une adresse email valide';
        }
        return null;
      }
    },
    {
      name: 'phone',
      label: 'Téléphone',
      type: 'tel',
      placeholder: '+33 1 23 45 67 89',
      required: false,
      validation: (value: string) => {
        if (value && !/^\+?[0-9\s-()]+$/.test(value)) {
          return 'Veuillez entrer un numéro de téléphone valide';
        }
        return null;
      }
    },
    {
      name: 'subject',
      label: 'Sujet',
      type: 'select',
      required: true,
      options: [
        { value: '', label: 'Sélectionner un sujet' },
        { value: 'reservation', label: 'Réservation' },
        { value: 'modification', label: 'Modification de réservation' },
        { value: 'annulation', label: 'Annulation' },
        { value: 'question', label: 'Question générale' },
        { value: 'reclamation', label: 'Réclamation' }
      ]
    },
    {
      name: 'message',
      label: 'Message',
      type: 'textarea',
      placeholder: 'Décrivez votre demande ou votre question...',
      required: true,
      validation: (value: string) => {
        if (value.length < 10) {
          return 'Veuillez entrer un message d\'au moins 10 caractères';
        }
        return null;
      }
    },
    {
      name: 'newsletter',
      label: 'S\'abonner à notre newsletter',
      type: 'checkbox',
      required: false
    }
  ];

  const handleSubmit = async (values: Record<string, any>) => {
    console.log('Message de contact soumis:', values);
    
    // Simuler une API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Retourner une réponse
    return {
      success: true,
      message: 'Votre message a été envoyé avec succès. Nous vous répondrons dans les plus brefs délais.'
    };
  };

  // Démo : les données ne sont pas encore branchées sur le formulaire.
  void formFields;
  void handleSubmit;

  return (
    <div className="offline-contact-form">
      <h2>Contact hors-ligne</h2>
      <p>Envoyez-nous un message même sans connexion internet. Votre message sera sauvegardé et envoyé dès que la connexion sera rétablie.</p>
      
      {/* Importer le composant OfflineForm dans le composant parent */}
      {/*
      import OfflineForm from './OfflineForm';
      
      <OfflineForm 
        fields={formFields}
        onSubmit={handleSubmit}
        className="contact-form"
        autoSave={true}
        showAutoSaveToggle={true}
        submitButtonText="Envoyer le message"
        submittingText="Envoi en cours..."
      />
      */}
    </div>
  );
};
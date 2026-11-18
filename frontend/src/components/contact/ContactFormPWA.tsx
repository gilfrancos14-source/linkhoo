import React, { useState } from 'react';
import OfflineForm from '../OfflineForm';

const ContactFormPWA: React.FC = () => {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  
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
          return "Veuillez entrer un message d'au moins 10 caractères";
        }
        return null;
      }
    },
    {
      name: 'newsletter',
      label: "S'abonner à notre newsletter",
      type: 'checkbox',
      required: false
    }
  ];

  const handleSubmit = async (values: Record<string, any>) => {
    console.log('Message de contact soumis:', values);
    
    try {
      // Simuler une API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Retourner une réponse
      return {
        success: true,
        message: 'Votre message a été envoyé avec succès. Nous vous répondrons dans les plus brefs délais.'
      };
    } catch {
      // En cas d'erreur, retourner une réponse qui indique que les données ont été sauvegardées
      return {
        success: false,
        message: 'Votre message a été sauvegardé et sera envoyé dès que la connexion sera rétablie.',
        offline: true
      };
    }
  };

  const handleFormSubmit = (result: any) => {
    setIsSubmitted(true);
    setSubmitSuccess(result.success);
    
    // Réinitialiser après 3 secondes
    setTimeout(() => {
      setIsSubmitted(false);
      setSubmitSuccess(false);
    }, 3000);
  };

  return (
    <div className="ct-contact-form">
      <h2 className="ct-contact-form__title">Contactez-nous</h2>
      <p className="ct-contact-form__subtitle">
        Envoyez-nous un message même sans connexion internet. Votre message sera sauvegardé et envoyé dès que la connexion sera rétablie.
      </p>
      
      {isSubmitted && (
        <div className={`ct-contact-form__alert ${submitSuccess ? 'success' : 'warning'}`}>
          {submitSuccess ? (
            <>
              <svg className="icon" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 12L11 14L15 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="2"/>
              </svg>
              {submitSuccess ? 'Message envoyé avec succès !' : 'Message sauvegardé hors-ligne'}
            </>
          ) : (
            <>
              <svg className="icon" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 8V12M12 16H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="2"/>
              </svg>
              Connection perdue. Votre message a été sauvegardé.
            </>
          )}
        </div>
      )}
      
      <OfflineForm 
        fields={formFields}
        onSubmit={handleSubmit}
        className="ct-contact-form__form"
        autoSave={true}
        showAutoSaveToggle={true}
        submitButtonText="Envoyer le message"
        submittingText="Envoi en cours..."
        onFormSubmit={handleFormSubmit}
      />
    </div>
  );
};

export default ContactFormPWA;
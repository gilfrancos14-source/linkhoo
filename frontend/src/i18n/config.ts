import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Importation des fichiers de traduction
import frTranslations from './resources/fr.json';
import enTranslations from './resources/en.json';
import esTranslations from './resources/es.json';

i18n
  .use(LanguageDetector)  // Détecte automatiquement la langue du navigateur
  .use(initReactI18next)
  .init({
    resources: {
      fr: {
        translation: frTranslations
      },
      en: {
        translation: enTranslations
      },
      es: {
        translation: esTranslations
      }
    },
    lng: 'fr',  // Langue par défaut
    fallbackLng: 'fr',  // Langue de fallback si une traduction manque
    
    interpolation: {
      escapeValue: false  // React already escapes by default
    },
    
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage']
    }
  });

export default i18n;
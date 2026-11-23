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
    // Pas de `lng` figé : le LanguageDetector peut appliquer la langue
    // enregistrée dans localStorage (ou celle du navigateur) au chargement.
    fallbackLng: 'fr',  // Langue par défaut / de fallback si une traduction manque
    
    interpolation: {
      escapeValue: false  // React already escapes by default
    },
    
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage']
    }
  });

// Garde l'attribut lang du document synchronisé pour l'accessibilité et le SEO.
const syncDocumentLang = (language: string) => {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = language.split('-')[0];
  }
};
syncDocumentLang(i18n.language);
i18n.on('languageChanged', syncDocumentLang);

export default i18n;
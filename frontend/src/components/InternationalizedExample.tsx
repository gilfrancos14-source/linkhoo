import React from 'react';
import { useTranslation } from 'react-i18next';

const InternationalizedExample: React.FC = () => {
  const { t, i18n } = useTranslation();

  return (
    <div className="internationalized-example">
      <h1>{t('home.title')}</h1>
      <p>{t('home.subtitle')}</p>
      
      <div className="language-info">
        <p>Langue actuelle: {i18n.language}</p>
        <button 
          onClick={() => i18n.changeLanguage('fr')}
          className="lang-btn"
          disabled={i18n.language === 'fr'}
        >
          🇫🇷 Français
        </button>
        <button 
          onClick={() => i18n.changeLanguage('en')}
          className="lang-btn"
          disabled={i18n.language === 'en'}
        >
          🇬🇧 English
        </button>
      </div>
      
      <div className="example-section">
        <h2>{t('navigation.home')}</h2>
        <p>{t('navigation.services')}</p>
        <p>{t('navigation.contact')}</p>
        <p>{t('navigation.about')}</p>
      </div>
      
      <div className="example-section">
        <h2>{t('common.loading')}</h2>
        <p>{t('common.error')}</p>
        <p>{t('common.save')}</p>
        <p>{t('common.cancel')}</p>
        <p>{t('common.login')}</p>
      </div>
    </div>
  );
};

export default InternationalizedExample;
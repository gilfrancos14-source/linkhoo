import { useTranslation } from 'react-i18next';

const I18nTestPage = () => {
  const { t, i18n } = useTranslation();

  return (
    <div className="i18n-test-page">
      <h1>{t('home.title')}</h1>
      <p>{t('home.subtitle')}</p>
      
      <div className="test-section">
        <h2>{t('navigation.home')}</h2>
        <p>{t('navigation.services')}</p>
        <p>{t('navigation.contact')}</p>
        <p>{t('navigation.about')}</p>
      </div>
      
      <div className="test-section">
        <h2>{t('contact.title')}</h2>
        <p>{t('contact.name')}</p>
        <p>{t('contact.email')}</p>
        <p>{t('contact.message')}</p>
        <p>{t('contact.send')}</p>
      </div>
      
      <div className="test-section">
        <h2>{t('common.loading')}</h2>
        <p>{t('common.error')}</p>
        <p>{t('common.save')}</p>
        <p>{t('common.cancel')}</p>
      </div>
      
      <div className="language-info">
        <p>Langue actuelle: {i18n.language}</p>
        <button 
          onClick={() => i18n.changeLanguage('fr')}
          className="lang-btn"
        >
          Français
        </button>
        <button 
          onClick={() => i18n.changeLanguage('en')}
          className="lang-btn"
        >
          English
        </button>
        <button 
          onClick={() => i18n.changeLanguage('es')}
          className="lang-btn"
        >
          Español
        </button>
      </div>
    </div>
  );
};

export default I18nTestPage;
import { useTranslation } from 'react-i18next';
import Icon from './icons';

export default function LandingBackToTop() {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      className="acc-to-top"
      aria-label={t('landing.backToTop')}
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
    >
      <Icon name="arrowUp" size={20} />
    </button>
  );
}

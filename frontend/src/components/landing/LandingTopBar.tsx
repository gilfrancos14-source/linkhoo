import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import Icon from './icons';

/**
 * Bandeau d'accueil : n'est affiché que lorsque le navigateur est réellement
 * hors ligne. L'utilisateur peut le fermer ; il réapparaît si une nouvelle
 * coupure survient après un retour à la connexion.
 */
export default function LandingTopBar() {
  const { t } = useTranslation();
  const online = useOnlineStatus();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (online) setDismissed(false);
  }, [online]);

  if (online || dismissed) return null;

  return (
    <div className="acc-offline" role="status" aria-live="polite">
      <div className="acc-container acc-offline__inner">
        <p className="acc-offline__msg">
          <Icon name="wifiOff" size={16} />
          <span>{t('landing.topbar.offlineMessage')}</span>
        </p>
        <div className="acc-offline__actions">
          <button
            type="button"
            className="acc-offline__retry"
            onClick={() => window.location.reload()}
          >
            <Icon name="rotateCw" size={14} />
            {t('landing.topbar.retry')}
          </button>
          <button
            type="button"
            className="acc-offline__close"
            aria-label={t('landing.topbar.close')}
            onClick={() => setDismissed(true)}
          >
            <Icon name="x" size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}

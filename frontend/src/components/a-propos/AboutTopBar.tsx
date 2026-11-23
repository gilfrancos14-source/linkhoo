import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Icon from '../landing/icons';

export default function AboutTopBar() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <div className="ab-topbar">
      <div className="ab-topbar__inner">
        <p className="ab-topbar__msg">
          <Icon name="megaphone" size={16} />
          <span>{t('about.topbar.message')}</span>
        </p>
        <div className="ab-topbar__actions">
          <span className="ab-topbar__badge">
            <Icon name="globe" size={14} />
            {t('about.topbar.countries')}
          </span>
          <button
            type="button"
            className="ab-topbar__close"
            aria-label={t('about.topbar.close')}
            onClick={() => setVisible(false)}
          >
            <Icon name="x" size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

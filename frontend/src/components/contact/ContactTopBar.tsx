import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Icon from '../landing/icons';

export default function ContactTopBar() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <div className="ct-announce">
      <div className="ct-announce__inner">
        <p className="ct-announce__msg">
          <Icon name="megaphone" size={12} />
          <span>{t('contact.topbar.message')}</span>
        </p>
        <div className="ct-announce__actions">
          <span className="ct-announce__badge">
            <Icon name="globe" size={12} />
            {t('contact.topbar.countries')}
          </span>
          <button
            type="button"
            className="ct-announce__close"
            aria-label={t('contact.topbar.close')}
            onClick={() => setVisible(false)}
          >
            <Icon name="x" size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

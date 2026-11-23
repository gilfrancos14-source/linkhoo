import { useTranslation } from 'react-i18next';
import Icon from '../landing/icons';

export default function ContactLocation() {
  const { t } = useTranslation();

  return (
    <div className="ct-card ct-location">
      <div className="ct-card__head ct-card__head--compact">
        <span className="ct-card__head-pin">
          <Icon name="mapPin" size={12} />
        </span>
        <div>
          <h2 className="ct-location__title">{t('contact.location.title')}</h2>
          <p className="ct-location__lead">{t('contact.location.lead')}</p>
        </div>
      </div>

      <div className="ct-map">
        <iframe
          className="ct-map__frame"
          title={t('contact.location.mapTitle')}
          src="https://www.google.com/maps?q=Cotonou,+B%C3%A9nin&z=13&hl=fr&output=embed"
          loading="lazy"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
        />

        <a
          className="ct-map__link"
          href="https://www.google.com/maps/place/Cotonou"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Icon name="map" size={11} />
          {t('contact.location.mapLink')}
        </a>
      </div>
    </div>
  );
}

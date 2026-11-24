import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Icon from './icons';
import { COUNTRIES, type Country } from './data';

interface LandingCountriesProps {
  country: Country | null;
  onCountryChange: (country: Country | null) => void;
}

export default function LandingCountries({ country, onCountryChange }: LandingCountriesProps) {
  const { t } = useTranslation();
  const loginSlug = country?.marketSlug ?? 'ci';

  return (
    <section className="acc-countries-section" id="ou-louer">
      <div className="acc-container acc-countries">
        <div>
          <p className="acc-countries__eyebrow">
            <Icon name="mapPin" size={20} />
            {t('landing.countries.eyebrow')}
          </p>
          <h2 className="acc-countries__title">{t('landing.countries.title')}</h2>
          <p className="acc-countries__desc">
            {t('landing.countries.desc')}
          </p>

          <Link to={`/${loginSlug}/login/gerant`} className="acc-manage-card">
            <span className="acc-manage-card__icon">
              <Icon name="userRoundCog" size={24} />
            </span>
            <span className="acc-manage-card__text">
              <span className="acc-manage-card__brand">{t('landing.countries.manageBrand')}</span>{' '}
              <b>{t('landing.countries.manageBold')}</b>
              <small>{t('landing.countries.manageSmall')}</small>
            </span>
            <Icon name="chevronRight" size={16} />
          </Link>
        </div>

        <div className="acc-country-grid">
          {COUNTRIES.map((item) => {
            const selected = country?.code === item.code;
            return (
              <button
                key={item.code}
                type="button"
                className={`acc-country-card${selected ? ' acc-country-card--active' : ''}`}
                aria-pressed={selected}
                onClick={() => onCountryChange(item)}
              >
                <span className="acc-flag" style={{ background: item.flag }} aria-hidden="true" />
                <span className="acc-country-card__name">
                  {t(`markets.${item.code}`, { defaultValue: item.label })}
                </span>
                {selected && (
                  <span className="acc-country-card__arrow">
                    <Icon name="arrowRight" size={14} />
                  </span>
                )}
              </button>
            );
          })}
          {country && (
            <Link
              to={`/${country.marketSlug ?? country.code.toLowerCase()}`}
              className="acc-country-continue"
            >
              {t('landing.countries.continue', {
                country: t(`markets.${country.code}`, { defaultValue: country.label }),
              })}
              <Icon name="arrowRight" size={16} aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

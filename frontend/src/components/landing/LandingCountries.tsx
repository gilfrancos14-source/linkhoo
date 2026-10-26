import { Link } from 'react-router-dom';
import Icon from './icons';
import { COUNTRIES, type Country } from './data';

interface LandingCountriesProps {
  country: Country;
  onCountryChange: (country: Country) => void;
}

export default function LandingCountries({ country, onCountryChange }: LandingCountriesProps) {
  const loginSlug = country.marketSlug ?? 'ci';

  return (
    <section className="acc-countries-section" id="ou-louer">
      <div className="acc-container acc-countries">
        <div>
          <p className="acc-countries__eyebrow">
            <Icon name="mapPin" size={20} />
            Où louer ?
          </p>
          <h2 className="acc-countries__title">Choisissez un Pays</h2>
          <p className="acc-countries__desc">
            Explorez nos marchés disponibles et trouvez le logement qu&apos;il vous faut dans votre
            pays.
          </p>

          <Link to={`/${loginSlug}/login/gerant`} className="acc-manage-card">
            <span className="acc-manage-card__icon">
              <Icon name="userRoundCog" size={24} />
            </span>
            <span className="acc-manage-card__text">
              <span className="acc-manage-card__brand">Connectez-vous</span>{' '}
              <b>pour gérer votre marché</b>
              <small>Accédez à vos annonces, statistiques et plus encore.</small>
            </span>
            <Icon name="chevronRight" size={16} />
          </Link>
        </div>

        <div className="acc-country-grid">
          {COUNTRIES.map((item) => {
            const selected = item.code === country.code;
            return (
              <button
                key={item.code}
                type="button"
                className={`acc-country-card${selected ? ' acc-country-card--active' : ''}`}
                aria-pressed={selected}
                onClick={() => onCountryChange(item)}
              >
                <span className="acc-flag" style={{ background: item.flag }} aria-hidden="true" />
                <span className="acc-country-card__name">{item.label}</span>
                {selected && (
                  <span className="acc-country-card__arrow">
                    <Icon name="arrowRight" size={14} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

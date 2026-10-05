import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { LANDING_COUNTRIES, type LandingFlagId } from '../data/landing';
import {
  FlagBF,
  FlagBJ,
  FlagCD,
  FlagCG,
  FlagCI,
  FlagCM,
  FlagGA,
  FlagGN,
  FlagML,
  FlagNE,
  FlagSN,
  FlagTG,
} from './flags';

const FLAGS: Record<LandingFlagId, (props: { width?: number }) => ReactNode> = {
  sn: FlagSN,
  ci: FlagCI,
  tg: FlagTG,
  bj: FlagBJ,
  cm: FlagCM,
  bf: FlagBF,
  cg: FlagCG,
  ga: FlagGA,
  gn: FlagGN,
  ml: FlagML,
  ne: FlagNE,
  cd: FlagCD,
};

// Bloc « Choisissez un Pays » — structure CoinAfrique : une seule rangée de
// drapeaux ronds avec le nom dessous. Les marchés ouverts sont cliquables,
// les autres sont annoncés « Bientôt ».
export default function CountrySelector() {
  return (
    <section className="landing-countries" id="pays">
      <div className="container">
        <div className="section-head reveal">
          <p className="eyebrow">Où louer ?</p>
          <h2 className="section-title">Choisissez un <em>Pays</em></h2>
        </div>

        <ul className="landing-countries__grid" role="list">
          {LANDING_COUNTRIES.map((country) => {
            const Flag = FLAGS[country.flag];
            const content = (
              <>
                <span className="landing-countries__flag" aria-hidden="true">
                  <Flag width={56} />
                </span>
                <span className="landing-countries__label">{country.label}</span>
                {!country.slug && <span className="landing-countries__soon">Bientôt</span>}
              </>
            );

            return (
              <li key={country.id} className="landing-countries__item reveal">
                {country.slug ? (
                  <Link to={`/${country.slug}`} className="landing-countries__card">
                    {content}
                  </Link>
                ) : (
                  <span className="landing-countries__card is-disabled" aria-disabled="true">
                    {content}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

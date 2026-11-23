import { Trans, useTranslation } from 'react-i18next';
import Icon from '../landing/icons';
import { ABOUT_TEAM_ICONS } from './data';

interface AboutTeamValue {
  title: string;
  text: string;
}

export default function AboutTeam() {
  const { t } = useTranslation();
  const values = t('about.team.values', { returnObjects: true }) as unknown as AboutTeamValue[];

  return (
    <section className="ab-team">
      <div className="ab-team__inner">
        <div className="ab-team__content">
          <span className="ab-badge">{t('about.team.badge')}</span>
          <h2 className="ab-section-title">
            <Trans
              i18nKey="about.team.title"
              components={{ brand: <span className="ab-text-brand" /> }}
            />
          </h2>
          <p className="ab-section-lead">{t('about.team.lead')}</p>

          <ul className="ab-team__values" role="list">
            {values.map((value, index) => (
              <li key={value.title}>
                <span className="ab-team__icon">
                  <Icon name={ABOUT_TEAM_ICONS[index] ?? 'house'} size={20} />
                </span>
                <p className="ab-team__value-title">{value.title}</p>
                <p className="ab-team__value-text">{value.text}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="ab-team__visual">
          <p className="ab-hand ab-team__hand">
            <Trans i18nKey="about.team.hand" components={{ br: <br /> }} />
          </p>
        </div>
      </div>
    </section>
  );
}

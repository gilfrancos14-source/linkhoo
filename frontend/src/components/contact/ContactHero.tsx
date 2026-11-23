import { Trans, useTranslation } from 'react-i18next';
import Icon from '../landing/icons';
import { CONTACT_HIGHLIGHT_ICONS } from './data';

interface ContactHighlight {
  title: string;
  text: string;
}

export default function ContactHero() {
  const { t } = useTranslation();
  const highlights = t('contact.highlights', { returnObjects: true }) as unknown as ContactHighlight[];

  return (
    <section className="ct-hero">
      <div className="ct-hero__inner">
        <div className="ct-hero__content">
          <span className="ct-badge">
            <Icon name="send" size={11} />
            {t('contact.hero.badge')}
          </span>

          <h1 className="ct-hero__title">
            {t('contact.hero.title1')}
            <br />
            <span>{t('contact.hero.title2')}</span>
          </h1>

          <p className="ct-hero__lead">{t('contact.hero.lead')}</p>

          <ul className="ct-highlights" role="list">
            {highlights.map((item, index) => (
              <li key={item.title}>
                <span className="ct-highlights__icon">
                  <Icon name={CONTACT_HIGHLIGHT_ICONS[index] ?? 'house'} size={18} />
                </span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="ct-hero__visual">
          <div className="ct-hero__script">
            <p>
              <Trans i18nKey="contact.hero.script" components={{ br: <br /> }} />
            </p>
            <svg viewBox="0 0 110 14" fill="none" aria-hidden="true">
              <path d="M2 12C30 4 70 3 108 3" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </div>

          <span className="ct-hero__badge" aria-hidden="true">
            <Icon name="house" size={22} />
          </span>

          <div className="ct-hero__card">
            <span className="ct-hero__card-icon">
              <Icon name="messagesSquare" size={16} />
            </span>
            <p>
              <Trans i18nKey="contact.hero.reply" components={{ br: <br /> }} />
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

import Icon from '../landing/icons';
import { CONTACT_HIGHLIGHTS } from './data';

export default function ContactHero() {
  return (
    <section className="ct-hero">
      <div className="ct-hero__inner">
        <div className="ct-hero__content">
          <span className="ct-badge">
            <Icon name="send" size={11} />
            Nous contacter
          </span>

          <h1 className="ct-hero__title">
            Une question ?
            <br />
            <span>Nous sommes là pour vous !</span>
          </h1>

          <p className="ct-hero__lead">
            Notre équipe est à votre écoute pour répondre à toutes vos questions, vous accompagner
            et vous aider à profiter pleinement de Linkhoo. Que ce soit pour une demande
            d&apos;information, un souci technique ou une suggestion, n&apos;hésitez pas à nous
            écrire !
          </p>

          <ul className="ct-highlights" role="list">
            {CONTACT_HIGHLIGHTS.map((item) => (
              <li key={item.title}>
                <span className="ct-highlights__icon">
                  <Icon name={item.icon} size={18} />
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
              Votre satisfaction
              <br />
              est notre priorité
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
              Nous répondons
              <br />
              en moins de 24h
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

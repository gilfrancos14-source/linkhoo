import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useHomePath } from '../hooks/useHomePath';
import { useRevealOnScroll } from '../hooks/useRevealOnScroll';
import { MARKETS, type MarketCode } from '../config/markets';
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
} from '../components/flags';

const FLAG_BY_CODE: Record<MarketCode, (props: { width?: number }) => ReactNode> = {
  CI: FlagCI,
  BJ: FlagBJ,
  SN: FlagSN,
  TG: FlagTG,
  CM: FlagCM,
  BF: FlagBF,
  CG: FlagCG,
  GA: FlagGA,
  GN: FlagGN,
  ML: FlagML,
  NE: FlagNE,
  CD: FlagCD,
};

const MARKET_HIGHLIGHTS: Record<string, string> = {
  CI: 'Abidjan, Grand-Bassam, Assinie et toute la côte.',
  BJ: 'Cotonou, Porto-Novo, Ouidah et l’arrière-pays.',
  SN: 'Dakar, Saly, Saint-Louis et la côte atlantique.',
  TG: 'Lomé, Kpalimé et le littoral togolais.',
  CM: 'Douala, Yaoundé, Kribi et le littoral camerounais.',
  BF: 'Ouagadougou, Bobo-Dioulasso et le plateau.',
  CG: 'Brazzaville, Pointe-Noire et la côte congolaise.',
  GA: 'Libreville, Port-Gentil et l’estuaire.',
  GN: 'Conakry, Îles de Los et la côte guinéenne.',
  ML: 'Bamako, Ségou et le fleuve Niger.',
  NE: 'Niamey, Zinder et l’Agadez.',
  CD: 'Kinshasa, Lubumbashi et le Grand Kivu.',
};

const STATS = [
  { value: '12', label: 'marchés ouverts', note: 'De l’Afrique de l’Ouest à l’Afrique centrale' },
  { value: '100 %', label: 'en ligne', note: 'De la recherche au séjour' },
  { value: '0', label: 'frais cachés', note: 'Prix affichés en toutes lettres' },
  { value: '24/7', label: 'support', note: 'Via le formulaire de contact' },
] as const;

const STEPS = [
  {
    n: '1',
    title: 'Cherchez & réservez',
    text: 'Locataires et voyageurs : trouvez un bien ou une expérience, choisissez vos dates et envoyez une demande de réservation en quelques clics.',
  },
  {
    n: '2',
    title: 'Publiez & gérez',
    text: 'Gérants : publiez vos biens, tenez votre calendrier à jour et suivez vos réservations depuis un tableau de bord dédié.',
  },
  {
    n: '3',
    title: 'Confirmez & séjournez',
    text: 'Chaque demande est confirmée par le gérant, qui peut l’accepter, la refuser ou proposer d’autres dates. Vous suivez tout depuis votre compte.',
  },
] as const;

const ENGAGEMENTS = [
  {
    title: 'Annonces vérifiées',
    text: 'Des photos fidèles aux biens et des annonces contrôlées pour que ce que vous voyez soit ce que vous trouvez.',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9 12l2 2 4-4" />
        <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />
      </svg>
    ),
  },
  {
    title: 'Prix clairs',
    text: 'Le prix que vous voyez est le prix que vous payez : pas de frais obscurs, pas de mauvaises surprises au moment de régler.',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 2v20" />
        <path d="M17 6.5c0-1.9-2.2-3-5-3s-5 1.1-5 3 2.2 2.8 5 3.5 5 1.6 5 3.5-2.2 3-5 3-5-1.1-5-3" />
      </svg>
    ),
  },
  {
    title: 'Données protégées',
    text: 'Vos données personnelles restent les vôtres : collecte minimale, usage transparent, conforme à notre politique de confidentialité.',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="4" y="10" width="16" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 018 0v3" />
      </svg>
    ),
  },
  {
    title: 'Support réactif',
    text: 'Une question, un imprévu ? Notre équipe répond via le formulaire de contact, à toute heure et depuis n’importe quel marché.',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 12a8 8 0 01-8 8H5l-2 2V12a8 8 0 018-8h2a8 8 0 018 8z" />
      </svg>
    ),
  },
] as const;

export default function AProposPage() {
  const homePath = useHomePath();
  useRevealOnScroll();

  return (
    <div className="page-legal page-about">
      <div className="container">
        <Link to="/" className="page-legal__back">&larr; Retour à l&apos;accueil</Link>

        <div className="about__hero reveal">
          <p className="eyebrow">À propos</p>
          <h1 className="page-legal__title">À propos de Linkhoo</h1>
          <p className="about__lead">
            Linkhoo est la plateforme de location et de réservation pensée pour
            l&apos;Afrique francophone — de l&apos;Ouest au centre du continent : chambres
            d&apos;hôtel pour vos escales, appartements pour votre quotidien, expériences et
            activités touristiques — le tout réservable en ligne, en quelques clics, sans
            intermédiaire.
          </p>
          <p className="page-legal__update">Dernière mise à jour : 9 septembre 2026</p>

          <ul className="about__stats" role="list">
            {STATS.map((stat) => (
              <li key={stat.label} className="about__stat">
                <span className="about__stat-value">{stat.value}</span>
                <span className="about__stat-label">{stat.label}</span>
                <span className="about__stat-note">{stat.note}</span>
              </li>
            ))}
          </ul>
        </div>

        <section className="page-legal__section about__section reveal">
          <h2>1. Qui sommes-nous ?</h2>
          <p>
            <strong>Linkhoo</strong> est une plateforme de location de biens immobiliers et de
            réservation d&apos;expériences pensée pour l&apos;Afrique francophone, présente
            dans 12 pays. Appartements, maisons, séjours événementiels et activités
            touristiques : tout se réserve en ligne, en quelques clics, sans intermédiaire.
          </p>
          <p>
            Notre siège est basé à Abidjan et notre équipe réunit des profils de la tech, de
            l&apos;hôtellerie et du commerce, autour d&apos;une même conviction : le marché
            locatif francophone mérite des outils simples, rapides et fiables.
          </p>
          <div className="about__highlight">
            <p>
              De la recherche d&apos;une chambre pour une nuit à la location d&apos;un
              appartement pour s&apos;installer, Linkhoo relie directement ceux qui proposent
              un bien et ceux qui cherchent où séjourner — sans friction, sans intermédiaire
              invisible.
            </p>
          </div>
        </section>

        <section className="page-legal__section about__section reveal">
          <h2>2. Notre mission</h2>
          <p>
            Connecter directement locataires, voyageurs et gérants de biens : plus de frais
            obscurs, plus d&apos;aller-retours interminables. Linkhoo affiche des prix clairs,
            des photos réelles et des disponibilités à jour pour que chaque réservation se
            fasse en toute confiance.
          </p>
          <div className="about__cards about__cards--2">
            <article className="about__card">
              <span className="about__card-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 3" />
                </svg>
              </span>
              <h3 className="about__card-title">Notre mission</h3>
              <p className="about__card-text">
                Rendre la location et la réservation aussi simples qu&apos;un message : une
                recherche, une demande, une confirmation — où que vous soyez en Afrique de
                l&apos;Ouest.
              </p>
            </article>
            <article className="about__card">
              <span className="about__card-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" />
                  <circle cx="12" cy="12" r="2.5" />
                </svg>
              </span>
              <h3 className="about__card-title">Notre vision</h3>
              <p className="about__card-text">
                Devenir la référence de la location courte et longue durée en
                Afrique francophone : un catalogue local, des prix justes et une confiance
                mutuelle entre locataires et gérants.
              </p>
            </article>
          </div>
        </section>

        <section className="page-legal__section about__section reveal">
          <h2>3. Comment ça marche ?</h2>
          <ul className="about__steps" role="list">
            {STEPS.map((step) => (
              <li key={step.n} className="about__step">
                <span className="about__step-n" aria-hidden="true">{step.n}</span>
                <div className="about__step-body">
                  <strong className="about__step-title">{step.title}</strong>
                  <p className="about__step-text">{step.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="page-legal__section about__section reveal">
          <h2>4. Nos marchés</h2>
          <p>
            Linkhoo est déployé marché par marché — <strong>12 pays</strong> d&apos;Afrique
            francophone — avec un catalogue, des villes et des prix adaptés à chaque pays.
            Choisissez votre marché depuis le sélecteur de drapeau en haut de page pour voir
            les biens disponibles :
          </p>
          <div className="about__cards about__cards--markets">
            {MARKETS.map((m) => {
              const Flag = FLAG_BY_CODE[m.code];
              return (
                <article key={m.code} className="about__market">
                  <span className="about__market-flag" aria-hidden="true">
                    <Flag width={36} />
                  </span>
                  <div className="about__market-body">
                    <Link to={`/${m.slug}`} className="about__market-name">{m.label}</Link>
                    <span className="about__market-cities">{MARKET_HIGHLIGHTS[m.code]}</span>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="page-legal__section about__section reveal">
          <h2>5. Nos engagements</h2>
          <ul className="about__cards about__cards--2 about__engagements" role="list">
            {ENGAGEMENTS.map((item) => (
              <li key={item.title} className="about__card about__card--flat">
                <span className="about__card-icon" aria-hidden="true">{item.icon}</span>
                <h3 className="about__card-title">{item.title}</h3>
                <p className="about__card-text">
                  {item.title === 'Données protégées' ? (
                    <>
                      {item.text}{' '}
                      <Link to={`${homePath}/politique-de-confidentialite`}>
                        Politique de confidentialité
                      </Link>
                      .
                    </>
                  ) : (
                    item.text
                  )}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section className="page-legal__section about__section reveal">
          <h2>6. Contact</h2>
          <div className="about__cta">
            <div className="about__cta-body">
              <h3 className="about__cta-title">Une question, une suggestion ?</h3>
              <p className="about__cta-text">
                Écrivez-nous à <strong>bonjour@linkhoo.com</strong> ou passez par notre{' '}
                <Link to="/contact">formulaire de contact</Link> : l&apos;équipe Linkhoo
                vous répond sous 24 à 48 heures ouvrées.
              </p>
              <p className="about__cta-text">
                Retournez à l&apos;<Link to="/">accueil</Link> pour parcourir les biens, ou
                consultez nos <Link to={`${homePath}/mentions-legales`}>mentions légales</Link>.
              </p>
            </div>
            <Link to="/contact" className="about__cta-btn">
              Nous contacter
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14m-6-6l6 6-6 6" />
              </svg>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

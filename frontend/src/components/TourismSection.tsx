import { useEffect, useState } from 'react';
import { useMarket, type MarketCode } from '../contexts/MarketContext';
import { scrollToAccueil } from '../utils/scroll';
import { FALLBACK_TOURISM, fetchDestinationsByMarket, type TourismCards } from '../data/tourism';
import CardSkeleton from './CardSkeleton';

interface Benefit {
  icon: string;
  title: string;
  text: string;
}

// Seul le chapô de la section est figé par marché : les cartes viennent de
// l'API (table tourism_destinations), avec FALLBACK_TOURISM en secours.
interface TourismContent {
  article: 'le' | 'la';
  country: string;
  intro: string;
  signature: string;
  benefits: Benefit[];
}

const CONTENT: Record<MarketCode, TourismContent> = {
  BJ: {
    article: 'le',
    country: 'Bénin',
    intro:
      "Des plages de sable fin aux marchés colorés, en passant par les sites historiques classés au patrimoine mondial de l'UNESCO — le Bénin vous attend pour un séjour inoubliable.",
    signature: 'Le Bénin',
    benefits: [
      { icon: '◇', title: 'Découvertes uniques', text: 'Culture, nature, histoire' },
      { icon: '✓', title: 'Voyage en toute sécurité', text: 'Des partenaires de confiance' },
      { icon: '♡', title: 'Une expérience authentique', text: 'Au cœur des traditions béninoises' },
    ],
  },
  CI: {
    article: 'la',
    country: "Côte d'Ivoire",
    intro:
      "Des lagunes d'Assinie aux paysages du parc de la Comoé, en passant par la vitalité culturelle d'Abidjan — la Côte d'Ivoire vous attend pour un séjour inoubliable.",
    signature: "La Côte d'Ivoire",
    benefits: [
      { icon: '◇', title: 'Découvertes uniques', text: 'Culture, nature, histoire' },
      { icon: '✓', title: 'Voyage en toute sécurité', text: 'Des partenaires de confiance' },
      { icon: '♡', title: 'Une expérience authentique', text: 'Au cœur des traditions ivoiriennes' },
    ],
  },
};

// Le serveur ne stocke pas d'icône : on cyle la même série que le design.
const SMALL_ICONS = ['🛏', '⌂', '♜', '▦'];

export default function TourismSection() {
  const { market } = useMarket();
  const content = CONTENT[market];
  const [cards, setCards] = useState<TourismCards | null>(null);

  useEffect(() => {
    let ignore = false;
    // On vide avant de recharger : sinon /ci afficherait les cartes de /bj
    // pendant un render.
    setCards(null);
    fetchDestinationsByMarket(market)
      .then((data) => {
        if (!ignore) setCards(data);
      })
      .catch(() => {
        // API en panne : la section existe quand même, avec les destinations
        // de secours (jamais de bloc vide sur la home).
        if (!ignore) setCards(FALLBACK_TOURISM[market]);
      });
    return () => {
      ignore = true;
    };
  }, [market]);

  const loading = cards === null;
  const big = cards?.big ?? [];
  const small = cards?.small ?? [];
  const count = big.length + small.length;

  return (
    <section className="tourism" id="tourisme">
      <div className="tourism__bg" aria-hidden="true">
        <img src="/images/1.jpg" alt="" loading="lazy" width="1200" height="800" />
        <div className="tourism__overlay"></div>
      </div>

      <div className="container tourism__content">
        {/* Badge */}
        <div className="tourism__badge reveal">
          <span className="tourism__badge-dot" aria-hidden="true"></span>
          Nouvelle destination
        </div>

        {/* Hero */}
        <div className="tourism__hero reveal">
          <h2 className="tourism__title">
            Découvrez {content.article} <em>{content.country}</em>,<br />votre prochaine adresse touristique
          </h2>

          <p className="tourism__text">{content.intro}</p>

          <div className="tourism__signature" aria-hidden="true">
            {content.signature} <span>vous attend</span>
          </div>
        </div>

        {/* Avantages */}
        <ul className="tourism__benefits reveal">
          {content.benefits.map((benefit) => (
            <li className="tourism__benefit" key={benefit.title}>
              <span className="tourism__benefit-icon" aria-hidden="true">{benefit.icon}</span>
              <div>
                <p className="tourism__benefit-title">{benefit.title}</p>
                <p className="tourism__benefit-text">{benefit.text}</p>
              </div>
            </li>
          ))}
        </ul>

        {/* Grandes destinations : au plus 2, servies par le serveur */}
        <div className="tourism__big-cards reveal">
          {loading ? (
            <CardSkeleton count={2} />
          ) : (
            big.map((destination, index) => (
              <button
                key={destination.id}
                type="button"
                className={`tourism__big-card${index === 0 ? ' tourism__big-card--primary' : ''}`}
                onClick={scrollToAccueil}
              >
                <img src={destination.img} alt={destination.alt} loading="lazy" width="600" height="338" />
                <div className="tourism__big-card-shade" aria-hidden="true"></div>

                <div className="tourism__big-card-body">
                  <h3 className="tourism__big-card-title">{destination.title}</h3>

                  {/* La ville n'est rappelée que lorsqu'elle apporte quelque
                      chose (titre ≠ ville) : « Ouidah / Ouidah » n'aide personne. */}
                  {destination.city !== destination.title && (
                    <p className="tourism__big-card-location">
                      <span aria-hidden="true">●</span>
                      {destination.city}
                    </p>
                  )}

                  <p className="tourism__big-card-text">{destination.text}</p>

                  <span className="tourism__discover">
                    Découvrir <span aria-hidden="true">→</span>
                  </span>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Petites destinations */}
        <div className="tourism__small-cards reveal">
          {loading ? (
            <CardSkeleton count={4} />
          ) : (
            small.map((destination, index) => (
              <button key={destination.id} type="button" className="tourism__small-card" onClick={scrollToAccueil}>
                <img src={destination.img} alt={destination.alt} loading="lazy" width="320" height="145" />
                <div className="tourism__small-card-shade" aria-hidden="true"></div>

                <div className="tourism__small-card-body">
                  <span className="tourism__small-card-icon" aria-hidden="true">
                    {SMALL_ICONS[index % SMALL_ICONS.length]}
                  </span>
                  <h3 className="tourism__small-card-title">{destination.title}</h3>
                  <p className="tourism__small-card-text">{destination.text}</p>
                </div>

                <span className="tourism__small-card-arrow" aria-hidden="true">→</span>
              </button>
            ))
          )}
        </div>

        {/* Pied de section : le compte vient des données, jamais d'un durci */}
        {count > 0 && (
          <p className="tourism__footer reveal">
            {count} destination{count > 1 ? 's' : ''}, une seule émotion
          </p>
        )}
      </div>
    </section>
  );
}

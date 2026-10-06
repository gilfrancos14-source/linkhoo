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

const LEGACY_CONTENT = {
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
} satisfies Record<'BJ' | 'CI', TourismContent>;

// Le serveur ne stocke pas d'icône : on cyle la même série que le design.
const SMALL_ICONS = ['🛏', '⌂', '♜', '▦'];

// Contenu des 10 marchés ouverts : chapô générique structuré (le pays vient
// du registre), bénéfices communs à toute la plateforme.
function marketContent(
  article: 'le' | 'la',
  country: string,
  intro: string,
  tradition: string,
): TourismContent {
  return {
    article,
    country,
    intro,
    signature: `${article === 'le' ? 'Le' : 'La'} ${country}`,
    benefits: [
      { icon: '◇', title: 'Découvertes uniques', text: 'Culture, nature, histoire' },
      { icon: '✓', title: 'Voyage en toute sécurité', text: 'Des partenaires de confiance' },
      { icon: '♡', title: 'Une expérience authentique', text: `Au cœur des traditions ${tradition}` },
    ],
  };
}

const NEW_CONTENT: Record<Exclude<MarketCode, 'CI' | 'BJ'>, TourismContent> = {
  SN: marketContent('le', 'Sénégal',
    'Des plages de Dakar à la baie de Saint-Louis, en passant par les réserves du Sine-Saloum — le Sénégal vous attend pour un séjour inoubliable.',
    'sénégalaises'),
  TG: marketContent('le', 'Togo',
    'Des plages de Kpalimé aux forêts de l’ouest, en passant par les marchés de Lomé — le Togo vous attend pour un séjour inoubliable.',
    'togolaises'),
  CM: marketContent('le', 'Cameroun',
    'Du bouillant Mont Cameroun aux plages de Kribi, en passant par les quartiers vivants de Douala — le Cameroun vous attend pour un séjour inoubliable.',
    'camerounaises'),
  BF: marketContent('le', 'Burkina Faso',
    'Des paysages de la savane aux terres du Sahel, en passant par les marchés d’artisans de Ouagadougou — le Burkina Faso vous attend pour un séjour inoubliable.',
    'burkinabè'),
  CG: marketContent('le', 'Congo',
    'Des chutes de Loufoulakari aux plages de Pointe-Noire, en passant par les rives du fleuve — le Congo vous attend pour un séjour inoubliable.',
    'congolaises'),
  GA: marketContent('le', 'Gabon',
    'Des forêts équatoriales aux plages de l’Atlantique, en passant par les baies de Libreville — le Gabon vous attend pour un séjour inoubliable.',
    'gabonaises'),
  GN: marketContent('la', 'Guinée',
    'Des Îles de Los aux hauts plateaux du Fouta-Djallon, en passant par les rives du Konkouré — la Guinée vous attend pour un séjour inoubliable.',
    'guinéennes'),
  ML: marketContent('le', 'Mali',
    'Des falaises de Bandiagara au delta intérieur du Niger, en passant par les rives de Bamako — le Mali vous attend pour un séjour inoubliable.',
    'maliennes'),
  NE: marketContent('le', 'Niger',
    'Du désert de l’Aïr aux rives du fleuve Niger, en passant par les grandes places de Niamey — le Niger vous attend pour un séjour inoubliable.',
    'nigériennes'),
  CD: marketContent('la', 'RDC',
    'Du parc de la Garamba aux rives du fleuve Congo, en passant par les collines de Kinshasa — la RDC vous attend pour un séjour inoubliable.',
    'de la RDC'),
};

const CONTENT: Record<MarketCode, TourismContent> = { ...LEGACY_CONTENT, ...NEW_CONTENT };

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

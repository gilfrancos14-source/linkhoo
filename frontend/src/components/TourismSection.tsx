import { scrollToAccueil } from '../utils/scroll';

const mainDestinations = [
  {
    img: '/images/ouidah.jpg',
    alt: "Plage d'Ouidah",
    tagIcon: '✦',
    tag: 'Côte atlantique',
    name: 'Ouidah',
    location: 'Plages, histoire et culture',
    text: "Plages de sable fin, cœur touristique et berceau de la mémoire de l'esclavage.",
    primary: true,
  },
  {
    img: '/images/tori.jpg',
    alt: 'Plage de Grand Popo',
    tagIcon: '♟',
    tag: 'Culture & traditions',
    name: 'Grand Popo',
    location: 'Plage, musique et authenticité',
    text: 'Une ambiance chaleureuse, une plage magnifique et une culture vivante.',
    primary: false,
  },
];

const smallDestinations = [
  { img: '/images/pexels-artbovich-7214173.jpg', icon: '🛏', name: 'Nikki', text: 'Village lacustre aux maisons colorées sur pilotis.' },
  { img: '/images/pexels-fotoaibe-1571460.jpg', icon: '⌂', name: 'Ganvié', text: "Venise de l'Afrique, marchés flottants et traditions." },
  { img: '/images/pexels-artbovich-7045712.jpg', icon: '♜', name: 'Porto-Novo', text: 'Capitale culturelle, architecture afro-brésilienne.' },
  { img: '/images/pexels-artbovich-6283961.jpg', icon: '▦', name: 'Abomey', text: 'Palais royaux classés au patrimoine mondial UNESCO.' },
];

const benefits = [
  { icon: '◇', title: 'Découvertes uniques', text: 'Culture, nature, histoire' },
  { icon: '✓', title: 'Voyage en toute sécurité', text: 'Des partenaires de confiance' },
  { icon: '♡', title: 'Une expérience authentique', text: 'Au cœur des traditions béninoises' },
];

export default function TourismSection() {
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
            Découvrez le <em>Bénin</em>,<br />votre prochaine adresse touristique
          </h2>

          <p className="tourism__text">
            Des plages de sable fin aux marchés colorés, en passant par les sites
            historiques classés au patrimoine mondial de l'UNESCO — le Bénin vous
            attend pour un séjour inoubliable.
          </p>

          <div className="tourism__signature" aria-hidden="true">
            Le Bénin <span>vous attend</span>
          </div>
        </div>

        {/* Avantages */}
        <ul className="tourism__benefits reveal">
          {benefits.map((benefit) => (
            <li className="tourism__benefit" key={benefit.title}>
              <span className="tourism__benefit-icon" aria-hidden="true">{benefit.icon}</span>
              <div>
                <p className="tourism__benefit-title">{benefit.title}</p>
                <p className="tourism__benefit-text">{benefit.text}</p>
              </div>
            </li>
          ))}
        </ul>

        {/* Grandes destinations */}
        <div className="tourism__big-cards reveal">
          {mainDestinations.map((destination) => (
            <button
              key={destination.name}
              type="button"
              className={`tourism__big-card${destination.primary ? ' tourism__big-card--primary' : ''}`}
              onClick={scrollToAccueil}
            >
              <img src={destination.img} alt={destination.alt} loading="lazy" width="600" height="338" />
              <div className="tourism__big-card-shade" aria-hidden="true"></div>

              <span className="tourism__big-card-tag">
                <span aria-hidden="true">{destination.tagIcon}</span>
                {destination.tag}
              </span>

              <div className="tourism__big-card-body">
                <h3 className="tourism__big-card-title">{destination.name}</h3>

                <p className="tourism__big-card-location">
                  <span aria-hidden="true">●</span>
                  {destination.location}
                </p>

                <p className="tourism__big-card-text">{destination.text}</p>

                <span className="tourism__discover">
                  Découvrir <span aria-hidden="true">→</span>
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* Petites destinations */}
        <div className="tourism__small-cards reveal">
          {smallDestinations.map((card) => (
            <button key={card.name} type="button" className="tourism__small-card" onClick={scrollToAccueil}>
              <img src={card.img} alt={card.name} loading="lazy" width="320" height="145" />
              <div className="tourism__small-card-shade" aria-hidden="true"></div>

              <div className="tourism__small-card-body">
                <span className="tourism__small-card-icon" aria-hidden="true">{card.icon}</span>
                <h3 className="tourism__small-card-title">{card.name}</h3>
                <p className="tourism__small-card-text">{card.text}</p>
              </div>

              <span className="tourism__small-card-arrow" aria-hidden="true">→</span>
            </button>
          ))}
        </div>

        {/* Pied de section */}
        <p className="tourism__footer reveal">6 destinations, une seule émotion</p>
      </div>
    </section>
  );
}

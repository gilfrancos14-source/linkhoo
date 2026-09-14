import { scrollToAccueil } from '../utils/scroll';

export default function TourismSection() {
  const smallCards = [
    { img: '/images/pexels-artbovich-7214173.jpg', title: 'Nikki', text: 'Village lacustre aux maisons colorées sur pilotis.' },
    { img: '/images/pexels-fotoaibe-1571460.jpg', title: 'Ganvié', text: 'Venise de l\'Afrique, marchés flottants et traditions.' },
    { img: '/images/pexels-artbovich-7045712.jpg', title: 'Porto-Novo', text: 'Capitale culturelle, architecture afro-brésilienne.' },
    { img: '/images/pexels-artbovich-6283961.jpg', title: 'Abomey', text: 'Palais royaux classés au patrimoine mondial UNESCO.' },
  ];

  return (
    <section className="tourism" id="tourisme">
      <div className="tourism__bg" aria-hidden="true">
        <img src="/images/1.jpg" alt="" loading="lazy" width="1200" height="800" />
        <div className="tourism__overlay" aria-hidden="true"></div>
      </div>
      <div className="container tourism__content">
        <div className="tourism__badge reveal">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          Nouvelle destination
        </div>
        <h2 className="tourism__title reveal">Découvrez le <em>Bénin</em>,<br />votre prochaine adresse touristique</h2>
        <p className="tourism__text reveal">Des plages de sable fin aux marchés colorés, en passant par les sites historiques classés au patrimoine mondial de l'UNESCO — le Bénin vous attend pour un séjour inoubliable.</p>

        {/* Deux grosses cartes en haut */}
        <div className="tourism__big-cards reveal">
          <button type="button" className="tourism__big-card" onClick={scrollToAccueil}>
            <img src="/images/ouidah.jpg" alt="Plage d'Ouidah" loading="lazy" width="600" height="338" />
            <div className="tourism__big-card-shade" aria-hidden="true"></div>
            <div className="tourism__big-card-body">
              <h3 className="tourism__big-card-title">Ouidah</h3>
              <p className="tourism__big-card-text">Plages de sable fin, eaux turquoises et balades en bord de mer.</p>
            </div>
          </button>
          <button type="button" className="tourism__big-card" onClick={scrollToAccueil}>
            <img src="/images/tori.jpg" alt="Plage de Grand Popo" loading="lazy" width="600" height="338" />
            <div className="tourism__big-card-shade" aria-hidden="true"></div>
            <div className="tourism__big-card-body">
              <h3 className="tourism__big-card-title">Grand Popo</h3>
              <p className="tourism__big-card-text">Plage sauvage entre lagune et océan, ambiance calme et authentique.</p>
            </div>
          </button>
        </div>

        {/* Petites cartes défilables horizontalement */}
        <div className="tourism__small-cards reveal">
          {smallCards.map((card) => (
            <button key={card.title} type="button" className="tourism__small-card" onClick={scrollToAccueil}>
              <img src={card.img} alt={card.title} loading="lazy" width="240" height="320" />
              <div className="tourism__small-card-shade" aria-hidden="true"></div>
              <div className="tourism__small-card-body">
                <h3 className="tourism__small-card-title">{card.title}</h3>
                <p className="tourism__small-card-text">{card.text}</p>
              </div>
            </button>
          ))}
        </div>

      </div>
    </section>
  );
}

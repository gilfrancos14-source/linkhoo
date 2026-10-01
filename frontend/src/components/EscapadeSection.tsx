import { useMarket, type MarketCode } from '../contexts/MarketContext';
import { scrollToAccueil } from '../utils/scroll';

interface Escapade {
  img: string;
  title: string;
  text: string;
}

interface EscapadeContent {
  sub: string;
  escapades: Escapade[];
}

const CONTENT: Record<MarketCode, EscapadeContent> = {
  BJ: {
    sub: 'Des idées de sorties et découvertes pour profiter ensemble du meilleur du Bénin.',
    escapades: [
      { img: '/images/ouidah.jpg', title: 'Ouidah', text: "Plages, musée d'histoire et balades en famille." },
      { img: '/images/pexels-artbovich-7045712.jpg', title: 'Ganvié', text: 'Pirogue sur le lac, marchés flottants et découvertes.' },
      { img: '/images/pexels-artbovich-7214173.jpg', title: 'Grand Popo', text: "Lagune, plage sauvage et pique-nique au bord de l'eau." },
      { img: '/images/pexels-artbovich-6283961.jpg', title: 'Abomey', text: 'Palais royaux, art et histoire du Dahomey.' },
      { img: '/images/tori.jpg', title: 'Tori Bossito', text: 'Nature, randonnée et villages authentiques.' },
    ],
  },
  CI: {
    sub: "Des idées de sorties et découvertes pour profiter ensemble du meilleur de la Côte d'Ivoire.",
    escapades: [
      { img: '/images/pexels-fotoaibe-1571460.jpg', title: 'Assinie', text: 'Plages, lagunes et balades entre cocotiers.' },
      { img: '/images/pexels-artbovich-7214173.jpg', title: 'Grand-Bassam', text: 'Front de mer, musées et patrimoine classé à l’UNESCO.' },
      { img: '/images/pexels-artbovich-6283961.jpg', title: 'Yamoussoukro', text: 'Basilique de la Paix, jardins et grands axes.' },
      { img: '/images/ouidah.jpg', title: 'Korhogo', text: 'Savanes du nord, tissages et villages authentiques.' },
      { img: '/images/tori.jpg', title: 'Parc de la Comoé', text: 'Nature, randonnée et réserve de biosphère.' },
    ],
  },
};

export default function EscapadeSection() {
  const { market } = useMarket();
  const { sub, escapades } = CONTENT[market];

  return (
    <section className="escapade" id="escapade">
      <div className="container">
        <div className="section-head reveal">
          <p className="eyebrow">Escapade weekend</p>
          <h2 className="section-title">Où aller <em>en famille</em> ?</h2>
          <p className="section-sub">{sub}</p>
        </div>

        <div className="escapade__track">
          {escapades.map((item) => (
            <button key={item.title} type="button" className="escapade__card reveal" onClick={scrollToAccueil}>
              <div className="escapade__card-media">
                <img src={item.img} alt={item.title} loading="lazy" width="260" height="195" />
                <div className="escapade__card-shade" aria-hidden="true"></div>
              </div>
              <div className="escapade__card-body">
                <h3 className="escapade__card-title">{item.title}</h3>
                <p className="escapade__card-text">{item.text}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

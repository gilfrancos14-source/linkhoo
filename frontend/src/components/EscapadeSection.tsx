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

// Chapô des marchés ouverts : identique à CI/BJ, seul le pays change.
function newEscapades(country: string, escapades: Escapade[]): EscapadeContent {
  return {
    sub: `Des idées de sorties et découvertes pour profiter ensemble du meilleur de ${country}.`,
    escapades,
  };
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
  // 10 marchés ouverts : sorties phares des villes du seed, images du pool.
  SN: newEscapades('Sénégal', [
    { img: '/images/pexels-artbovich-7214173.jpg', title: 'Dakar', text: 'Caps, plages et marché des arts de la Corniche.' },
    { img: '/images/ouidah.jpg', title: 'Île de Gorée', text: 'Mémoire, maisons colorées et musée de la traite.' },
    { img: '/images/tori.jpg', title: 'Saly', text: 'Plages de la côte atlantique et balades en bateau.' },
    { img: '/images/pexels-fotoaibe-1571460.jpg', title: 'Saint-Louis', text: 'Île coloniale, pont Faidherbe et pêche traditionnelle.' },
    { img: '/images/pexels-artbovich-6283961.jpg', title: 'Lac Rose', text: 'Eaux salines, cueillette et lagunes de la Langue de Barbarie.' },
  ]),
  TG: newEscapades('Togo', [
    { img: '/images/pexels-artbovich-7214173.jpg', title: 'Lomé', text: 'Grand marché, Quartier allemand et front de mer.' },
    { img: '/images/ouidah.jpg', title: 'Kpalimé', text: 'Chutes, forêt et randonnées dans les montagnes.' },
    { img: '/images/tori.jpg', title: 'Aného', text: 'Lagon, maisons coloniales et plages tranquilles.' },
    { img: '/images/pexels-fotoaibe-1571460.jpg', title: 'Kara', text: 'Plateaux du nord et culture kabyè.' },
    { img: '/images/pexels-artbovich-6283961.jpg', title: 'Togoville', text: 'Case du roi et rives du lagon Togo.' },
  ]),
  CM: newEscapades('Cameroun', [
    { img: '/images/pexels-artbovich-7214173.jpg', title: 'Douala', text: 'Marché du Wouri, Bonanjo et vie nocturne.' },
    { img: '/images/ouidah.jpg', title: 'Yaoundé', text: 'Collines, musées et marché Mvog-Mbi.' },
    { img: '/images/tori.jpg', title: 'Kribi', text: 'Plages et chutes de la Lobé dans l’océan.' },
    { img: '/images/pexels-fotoaibe-1571460.jpg', title: 'Bafoussam', text: 'Hauts-Plateaux, marchés et royautés bamiléké.' },
    { img: '/images/pexels-artbovich-6283961.jpg', title: 'Limbe', text: 'Sable noir, océan et parc zoologique.' },
  ]),
  BF: newEscapades('Burkina Faso', [
    { img: '/images/pexels-artbovich-7214173.jpg', title: 'Ouagadougou', text: 'Grande Mosquée, marchés et artisanat du zoma.' },
    { img: '/images/ouidah.jpg', title: 'Bobo-Dioulasso', text: 'Grande mosquée en banco et ruelles du vieux quartier.' },
    { img: '/images/tori.jpg', title: 'Banfora', text: 'Cascades de Karfiguéla et plantations de canne.' },
    { img: '/images/pexels-fotoaibe-1571460.jpg', title: 'Gorom-Gorom', text: 'Marché du jeudi touareg au cœur du Sahel.' },
    { img: '/images/pexels-artbovich-6283961.jpg', title: 'Pics de Sindou', text: 'Roches sculptées et randonnées au pays kassena.' },
  ]),
  CG: newEscapades('Congo', [
    { img: '/images/pexels-artbovich-7214173.jpg', title: 'Brazzaville', text: 'Basilique Sainte-Anne et marchés de Bacongo.' },
    { img: '/images/ouidah.jpg', title: 'Pointe-Noire', text: 'Plage de La Pointe et vie du port.' },
    { img: '/images/tori.jpg', title: 'Sibiti', text: 'Case à palabres et chutes de Kondoro.' },
    { img: '/images/pexels-fotoaibe-1571460.jpg', title: 'Oyo', text: 'Plateau du centre, rivières et bains de pierre.' },
    { img: '/images/pexels-artbovich-6283961.jpg', title: 'Ouesso', text: 'Porte du parc de Nouabalé-Ndoki et forêt primaire.' },
  ]),
  GA: newEscapades('Gabon', [
    { img: '/images/pexels-artbovich-7214173.jpg', title: 'Libreville', text: 'Batterie IV, aquarium et estuaire.' },
    { img: '/images/ouidah.jpg', title: 'Pongara', text: 'Forêt mangrove et plage à une heure de la capitale.' },
    { img: '/images/tori.jpg', title: 'Port-Gentil', text: 'Îles et plages de l’Ogooué-Maritime.' },
    { img: '/images/pexels-fotoaibe-1571460.jpg', title: 'Lambaréné', text: 'Hôpital Albert Schweitzer et îles de l’Ogooué.' },
    { img: '/images/pexels-artbovich-6283961.jpg', title: 'Parc de la Lopé', text: 'Savanes et forêts classées UNESCO.' },
  ]),
  GN: newEscapades('Guinée', [
    { img: '/images/pexels-artbovich-7214173.jpg', title: 'Conakry', text: 'Péninsule de Kaloum, marchés et front de mer.' },
    { img: '/images/ouidah.jpg', title: 'Îles de Los', text: 'Plages rocheuses et baignade à un braquet du continent.' },
    { img: '/images/tori.jpg', title: 'Labé', text: 'Fouta-Djallon : montagnes, chutes et marchés de bétail.' },
    { img: '/images/pexels-fotoaibe-1571460.jpg', title: 'Dalaba', text: 'Ville fraîche des montagnes, bains et randonnées.' },
    { img: '/images/pexels-artbovich-6283961.jpg', title: 'Kindia', text: 'Chutes de la Soumba et pays de la mangue.' },
  ]),
  ML: newEscapades('Mali', [
    { img: '/images/pexels-artbovich-7214173.jpg', title: 'Bamako', text: 'Grand marché, musée national et rives du Niger.' },
    { img: '/images/ouidah.jpg', title: 'Djenné', text: 'Grande mosquée en banco et cité classée UNESCO.' },
    { img: '/images/tori.jpg', title: 'Ségou', text: 'Artisanat, Bognokoli et bords du fleuve.' },
    { img: '/images/pexels-fotoaibe-1571460.jpg', title: 'Mopti', text: 'Port fluvial, pirogues et grand marché.' },
    { img: '/images/pexels-artbovich-6283961.jpg', title: 'Tombouctou', text: 'Manuscrits, mosquées de sable et histoires de sable.' },
  ]),
  NE: newEscapades('Niger', [
    { img: '/images/pexels-artbovich-7214173.jpg', title: 'Niamey', text: 'Grand marché, grande mosquée et rives du fleuve.' },
    { img: '/images/ouidah.jpg', title: 'Agadez', text: 'Médina de banco et cité caravanière de l’Aïr.' },
    { img: '/images/tori.jpg', title: 'Zinder', text: 'Palais du Sultan et grand marché de la médina.' },
    { img: '/images/pexels-fotoaibe-1571460.jpg', title: 'Tillabéri', text: 'Rives du Niger et portes du parc W.' },
    { img: '/images/pexels-artbovich-6283961.jpg', title: 'Maradi', text: 'Marché du bétail et dombés du sud.' },
  ]),
  CD: newEscapades('RDC', [
    { img: '/images/pexels-artbovich-7214173.jpg', title: 'Kinshasa', text: 'Corniche, Gombe et marchés de la capitale.' },
    { img: '/images/ouidah.jpg', title: 'Goma', text: 'Lac Kivu, sable noir et vue sur le Nyiragongo.' },
    { img: '/images/tori.jpg', title: 'Bukavu', text: 'Jardin botanique et rive sud du lac Kivu.' },
    { img: '/images/pexels-fotoaibe-1571460.jpg', title: 'Lubumbashi', text: 'Hauts-Katanga, musées et kifumbu.' },
    { img: '/images/pexels-artbovich-6283961.jpg', title: 'Matadi', text: 'Port du Congo et gorges de l’Inga.' },
  ]),
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

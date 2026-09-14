import { useMarket } from '../contexts/MarketContext';
import { getBannersBySection } from '../data/banners';
import BannerCarousel from './BannerCarousel';

const events = [
  { img: '/images/1.jpg', alt: 'Vue de Cotonou', title: 'Cotonou' },
  { img: '/images/ouidah.jpg', alt: 'Événement à Ouidah', title: 'Ouidah' },
  { img: '/images/tori.jpg', alt: 'Événement à Tori Bossito', title: 'Tori Bossito' },
];

export default function EventsSection() {
  const { market } = useMarket();
  const banners = getBannersBySection(market, 'events');

  return (
    <section className="events" id="evenements">
      <div className="container">
        <div className={`section-head section-head--row${banners.length ? ' section-head--banners' : ''} reveal`}>
          <div>
            <p className="eyebrow">Événements</p>
            <h2 className="section-title">Retrouvez-nous, <em>dans votre ville</em></h2>
            <p className="section-sub">Des événements exclusifs se déroulent régulièrement dans nos zones d'activité.</p>
          </div>
          {banners.length > 0 && <BannerCarousel banners={banners} />}
        </div>

        <div className="events__grid">
          {events.map((event, i) => (
            <article key={i} className="event-card reveal">
              <div className="event-card__media">
                <img src={event.img} alt={event.alt} loading="lazy" width="400" height="300" />
                <div className="event-card__shade" aria-hidden="true"></div>
                <h3 className="event-card__title">{event.title}</h3>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

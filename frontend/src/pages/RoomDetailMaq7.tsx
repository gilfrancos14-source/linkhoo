import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Icon from '../components/landing/icons';
import LandingFooter from '../components/landing/LandingFooter';
import LandingHeader from '../components/landing/LandingHeader';
import { useFavorites } from '../contexts/FavoritesContext';
import { useMarket } from '../contexts/MarketContext';
import { fetchCategoriesByMarket, type Category } from '../data/categories';
import { fetchRoomById, type Room } from '../data/rooms';
import { useHomePath } from '../hooks/useHomePath';
import { apiReviews, type RoomReviewsResponse } from '../lib/api';
import { formatPrice } from '../lib/roomDisplay';
import { MAQUETTE_NAV_ITEMS } from '../maquette/nav';
import '../styles/40-room-detail-maq7.css';
import '../styles/15-room-detail.css';
import '../styles/53-room-detail-hero.css';
import '../styles/54-room-detail-details.css';

/**
 * Fiche chambre — première section reconstruite : en-tête + galerie façon
 * Airbnb (voir s2.png). Le reste de la page reste volontairement vide pour
 * l'instant ; navigation et pied de page sont conservés.
 */
export default function RoomDetailMaq7() {
  return <RoomDetailContent />;
}

function RoomDetailContent() {
  const { t } = useTranslation();
  const homePath = useHomePath();
  const { market } = useMarket();
  const { id } = useParams<{ id: string }>();
  const favorites = useFavorites();

  const [room, setRoom] = useState<Room | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [cur, setCur] = useState(0);
  const [copied, setCopied] = useState(false);
  const [searchParams] = useSearchParams();
  const [reviews, setReviews] = useState<RoomReviewsResponse | null>(null);
  const [arrivee, setArrivee] = useState(searchParams.get('arrivee') ?? '');
  const [depart, setDepart] = useState(searchParams.get('depart') ?? '');
  const [guests, setGuests] = useState(1);
  const [bookingNotice, setBookingNotice] = useState('');
  const [reported, setReported] = useState(false);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    fetchRoomById(id)
      .then((data) => {
        if (alive) {
          setRoom(data);
          setCur(0);
        }
      })
      .catch(() => {
        if (alive) setRoom(null);
      });
    return () => {
      alive = false;
    };
  }, [id]);

  useEffect(() => {
    let alive = true;
    fetchCategoriesByMarket(market)
      .then((list) => {
        if (alive) setCategory(list.find((item) => item.id === room?.category) ?? null);
      })
      .catch(() => {
        if (alive) setCategory(null);
      });
    return () => {
      alive = false;
    };
  }, [market, room?.category]);

  useEffect(() => {
    if (!room?.id) return;
    let alive = true;
    apiReviews
      .listByRoom(room.id)
      .then((data) => {
        if (alive) setReviews(data);
      })
      .catch(() => {
        if (alive) setReviews(null);
      });
    return () => {
      alive = false;
    };
  }, [room?.id]);

  const nights =
    arrivee && depart
      ? Math.max(1, Math.round((Date.parse(depart) - Date.parse(arrivee)) / 86_400_000))
      : 0;
  const priceText = room ? formatPrice(room.priceNum || room.price) : '';

  const photos = useMemo(() => {
    const list = [room?.img, ...(room?.images ?? [])]
      .filter((value): value is string => Boolean(value && value.trim()));
    return [...new Set(list)];
  }, [room]);

  const safeCur = photos.length > 0 ? Math.min(cur, photos.length - 1) : 0;
  const sidePhotos = photos.slice(1, 5);
  const saved = room ? favorites.isFavorite(room.id) : false;

  const share = async () => {
    try {
      await navigator.clipboard?.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // partage non disponible : on ne casse pas la page
    }
  };

  const toggleSave = () => {
    if (room) void favorites.toggle(room.id);
  };

  const locationLabel = room ? [room.ville, room.pays].filter(Boolean).join(', ') : '';
  const capacityParts = room
    ? [
        room.capacity || t('roomDetailHero.guest'),
        `${room.chambres} ${room.chambres > 1 ? t('roomDetailHero.bedrooms') : t('roomDetailHero.bedroom')}`,
        `${room.douches} ${t('roomDetailHero.bath')}`,
      ].filter(Boolean)
    : [];

  return (
    <div className="room-detail-maq7 room-detail-maq7--hero min-h-screen bg-white font-sans text-ink antialiased">
      <MarketHeader homePath={homePath} />

      <main className="mx-auto max-w-6xl px-4 py-4 lg:px-6 lg:py-6">
        <section className="m7-hero" aria-label={t('roomDetailHero.aria')}>
          <div className="m7-hero__top">
            <h1 className="m7-hero__title">{room?.title ?? ''}</h1>
            <div className="m7-hero__actions">
              <button type="button" onClick={() => void share()} className="m7-hero__action">
                <ShareIcon />
                <span>{copied ? t('roomDetailHero.copied') : t('roomDetailHero.share')}</span>
              </button>
              <button
                type="button"
                onClick={toggleSave}
                className={`m7-hero__action${saved ? ' m7-hero__action--saved' : ''}`}
                aria-pressed={saved}
              >
                <Icon name="heart" size={16} />
                <span>{saved ? t('roomDetailHero.saved') : t('roomDetailHero.save')}</span>
              </button>
            </div>
          </div>

          {photos.length > 0 && (
            <div className="m7-hero__gallery">
              <button
                type="button"
                className="m7-hero__main"
                onClick={() => setCur(safeCur + 1)}
                aria-label={t('roomDetailHero.nextPhoto')}
              >
                <img src={photos[safeCur]} alt={room?.title ?? ''} />
              </button>
              <div className="m7-hero__side">
                {sidePhotos.map((photo, index) => {
                  const photoIndex = index + 1;
                  return (
                    <button
                      key={`${photo}-${photoIndex}`}
                      type="button"
                      className="m7-hero__thumb"
                      onClick={() => setCur(photoIndex)}
                      aria-label={`${t('roomDetailHero.photo')} ${photoIndex + 1}`}
                    >
                      <img src={photo} alt="" />
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                className="m7-hero__all-photos"
                onClick={() => setCur(0)}
              >
                <Icon name="layoutGrid" size={15} />
                {t('roomDetailHero.allPhotos', { count: photos.length })}
              </button>
            </div>
          )}

          <div className="m7-hero__meta">
            <div>
              <p className="m7-hero__subtitle">
                {category?.title ?? t('roomDetailHero.privateRoom')}
                {room ? ` : ${room.title} - ${locationLabel}` : ''}
              </p>
              <p className="m7-hero__facts">{capacityParts.join(' · ')}</p>
            </div>
          </div>

        </section>

        {/* Deuxième section — points forts + carte de réservation (s3.png). */}
        <section className="m7-details" aria-label={t('roomDetailSection2.aria')}>
          <div className="m7-details__grid">
            <div className="m7-details__left">
              <div className="m7-highlights">
                <div className="m7-highlights__cell m7-highlights__cell--laurel">
                  <LaurelIcon />
                  <strong>{t('roomDetailSection2.favouriteBadge')}</strong>
                </div>
                <div className="m7-highlights__cell">
                  <LaurelIcon />
                  <strong>{t('roomDetailSection2.favouriteText')}</strong>
                </div>
                <div className="m7-highlights__cell m7-highlights__cell--rating">
                  <strong>{reviews?.room_avg != null ? formatPrice(reviews.room_avg).replace(/\s/g, ',') : '—'}</strong>
                  <span className="m7-highlights__stars" aria-hidden="true">★★★★★</span>
                </div>
                <div className="m7-highlights__cell m7-highlights__cell--reviews">
                  <strong>{reviews?.room_count ?? 0}</strong>
                  <span>{t('roomDetailSection2.comments')}</span>
                </div>
              </div>

              <div className="m7-detail-row">
                <span className="m7-detail-row__icon"><Icon name="mapPin" size={18} /></span>
                <div>
                  <strong>{t('roomDetailSection2.locationTitle', { city: room?.ville ?? '' })}</strong>
                  <p>{t('roomDetailSection2.locationText', { city: room?.ville ?? '', district: room?.quartier ?? '' })}</p>
                </div>
              </div>

              <div className="m7-detail-row">
                <span className="m7-detail-row__icon"><UtensilsIcon /></span>
                <div>
                  <strong>{t('roomDetailSection2.apartmentTitle')}</strong>
                  <p>{room?.info || t('roomDetailSection2.apartmentText')}</p>
                </div>
              </div>

              <div className="m7-detail-row">
                <span className="m7-detail-row__icon"><Icon name="star" size={18} /></span>
                <div>
                  <strong>{t('roomDetailSection2.hostTitle', { host: room?.gerant ? `${room.gerant.prenom ?? ''} ${room.gerant.nom ?? ''}`.trim() : 'Linkhoo' })}</strong>
                  <p>{t('roomDetailSection2.hostText')}</p>
                </div>
              </div>

              <div className="m7-detail-row m7-detail-row--avatar">
                <span className="m7-detail-row__avatar"><Icon name="userRound" size={18} /></span>
                <div>
                  <strong>{t('roomDetailSection2.hostLabel', { host: room?.gerant?.prenom ?? 'Linkhoo' })}</strong>
                  <p>{t('roomDetailSection2.superhost')}</p>
                </div>
              </div>

              <p className="m7-details__more"><InfoIcon /> {t('roomDetailSection2.learnMore')}</p>
            </div>

            <aside className="m7-details__right">
              <div className="m7-fees-badge">
                <TagIcon />
                <span>{t('roomDetailHero.allFees')}</span>
              </div>

              <div className="m7-book">
                <p className="m7-book__price">
                  <strong>{priceText}</strong> {room?.priceUnit || `/ ${t('roomDetailHero.night')}`}
                  {nights > 0 ? ` pour ${nights} ${nights > 1 ? t('roomDetailHero.nights') : t('roomDetailHero.night')}` : ''}
                </p>

                <div className="m7-book__dates">
                  <label>
                    <span>{t('roomDetailSection2.arrival')}</span>
                    <input type="date" value={arrivee} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setArrivee(e.target.value)} />
                  </label>
                  <label>
                    <span>{t('roomDetailSection2.departure')}</span>
                    <input type="date" value={depart} min={arrivee || undefined} onChange={(e) => setDepart(e.target.value)} />
                  </label>
                  <label className="m7-book__guests">
                    <span>{t('roomDetailSection2.guests')}</span>
                    <select value={guests} onChange={(e) => setGuests(Number(e.target.value))}>
                      {[1, 2, 3, 4, 5, 6].map((value) => (
                        <option key={value} value={value}>{value} {value > 1 ? t('roomDetailSection2.guestsPlural') : t('roomDetailHero.guest')}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <button
                  type="button"
                  className="m7-book__cta"
                  onClick={() => setBookingNotice(
                    !arrivee || !depart
                      ? t('roomDetailSection2.chooseDates')
                      : t('roomDetailSection2.ready'),
                  )}
                >
                  {t('roomDetailSection2.reserve')}
                </button>
                {bookingNotice && <p className="m7-book__notice" role="status">{bookingNotice}</p>}
                <p className="m7-book__disclaimer">{t('roomDetailSection2.noCharge')}</p>
              </div>

              <button
                type="button"
                className="m7-report"
                onClick={() => setReported(true)}
              >
                <FlagIcon /> {reported ? t('roomDetailSection2.reported') : t('roomDetailSection2.report')}
              </button>
            </aside>
          </div>
        </section>
      </main>

      {/* Le scope fournit les variables --acc-* dont LandingFooter dépend. */}
      <div className="room-detail-footer-scope">
        <LandingFooter />
      </div>
    </div>
  );
}

function ShareIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 16V4" />
      <path d="m7 9 5-5 5 5" />
      <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="#e11d74" aria-hidden="true">
      <path d="M12 2 2 12l10 10 10-10L12 2Zm0 4 6 6-6 6-6-6 6-6Z" />
      <circle cx="12" cy="12" r="1.6" fill="#fff" />
    </svg>
  );
}

function LaurelIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#222" strokeWidth="1.6" aria-hidden="true">
      <path d="M8 21C4 17 4 9 9 4" />
      <path d="M16 21c4-4 4-12-1-17" />
      <path d="M9 4c3 0 5 2 5 2M9 4c0 3 1 5 1 5M16 4c-3 0-5 2-5 2M16 4c0 3-1 5-1 5" />
    </svg>
  );
}

function UtensilsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#222" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <path d="M5 3v7a2 2 0 0 0 4 0V3M7 10v11" />
      <path d="M16 3c-2 2-2 5-2 7h4V3M18 10v11" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#717171" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="10" /><path d="M12 11v6M12 7h.01" />
    </svg>
  );
}

function FlagIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#222" strokeWidth="1.8" aria-hidden="true">
      <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
    </svg>
  );
}

/* En-tête de marché identique à /ci : aucun onglet n'est actif sur la fiche. */
function MarketHeader({ homePath }: { homePath: string }) {
  const navigate = useNavigate();
  const items = useMemo(
    () => MAQUETTE_NAV_ITEMS.map((item) => ({ ...item, active: false })),
    [],
  );

  return (
    <div className="landing maquette-shell m7-market-header">
      <LandingHeader
        onSearchClick={() => navigate(homePath, { state: { focusSearch: true } })}
        items={items}
        onItemClick={(purpose) => navigate(homePath, { state: { scrollTo: purpose } })}
        brandTo={homePath}
        account={{ to: `${homePath}/compte`, label: 'Mon espace' }}
      />
    </div>
  );
}

import { useEffect, useMemo, useState, type ReactNode } from 'react';
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
import '../styles/55-room-detail-dates.css';
import '../styles/56-room-detail-rating.css';

const pad2 = (value: number) => String(value).padStart(2, '0');

function toISODate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function fromISODate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatDisplayDate(value: string, locale: string): string {
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(fromISODate(value));
  } catch {
    return value;
  }
}

/**
 * Fiche chambre reconstruite façon Airbnb : galerie (s2.png), points forts et
 * formulaire de réservation (s3.png), puis sélection des dates (s4.png).
 * Le formulaire reste sticky pendant que la colonne gauche défile.
 */
export default function RoomDetailMaq7() {
  return <RoomDetailContent />;
}

function RoomDetailContent() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language || 'fr';
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
  const [monthOffset, setMonthOffset] = useState(0);
  const today = useMemo(() => new Date(), []);
  const todayISO = toISODate(today);

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

  const months = useMemo(() => {
    const first = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
    return [first, new Date(first.getFullYear(), first.getMonth() + 1, 1)];
  }, [monthOffset, today]);

  const monthLabels = useMemo(
    () =>
      months.map((month) => {
        const raw = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(month);
        return raw.charAt(0).toLocaleUpperCase(locale) + raw.slice(1);
      }),
    [months, locale],
  );

  const pickDate = (iso: string) => {
    if (iso < todayISO) return;
    if (!arrivee || depart) {
      setArrivee(iso);
      setDepart('');
      return;
    }
    const arrival = fromISODate(arrivee);
    const earliestDeparture = new Date(arrival.getFullYear(), arrival.getMonth(), arrival.getDate() + 2);
    if (fromISODate(iso) < earliestDeparture) {
      setArrivee(iso);
      setDepart('');
      return;
    }
    setDepart(iso);
  };

  const clearDates = () => {
    setArrivee('');
    setDepart('');
  };

  const rating = reviews?.room_avg ?? 4.85;
  const ratingText = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rating);
  const distribution = [5, 4, 3, 2, 1].map(
    (note) => reviews?.room_distribution?.find((item) => item.note === note)?.percent ?? 0,
  );
  // Sans répartition renvoyée par l'API, on retombe sur la courbe type de s5.
  const bars = reviews?.room_distribution?.length ? distribution : [85, 15, 0, 0, 0];
  const formatNote = (value: number) =>
    new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
      .format(Math.min(5, Math.max(0, value)));
  const scoreDetails: { label: string; value: string; icon: ScoreIconName }[] = [
    { label: t('roomDetailSection5.cleanliness'), value: formatNote(rating - 0.25), icon: 'broom' },
    { label: t('roomDetailSection5.accuracy'), value: formatNote(rating - 0.15), icon: 'check' },
    { label: t('roomDetailSection5.checkin'), value: formatNote(rating - 0.05), icon: 'key' },
    { label: t('roomDetailSection5.communication'), value: formatNote(rating + 0.15), icon: 'chat' },
    { label: t('roomDetailSection5.location'), value: formatNote(rating - 0.35), icon: 'map' },
    { label: t('roomDetailSection5.value'), value: formatNote(rating - 0.05), icon: 'tag' },
  ];

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
                  <strong>
                    {t(
                      room?.isGuestFavourite
                        ? 'roomDetailSection2.favouriteBadge'
                        : 'roomDetailSection2.verifiedBadge',
                    )}
                  </strong>
                </div>
                <div className="m7-highlights__cell">
                  <LaurelIcon />
                  <strong>
                    {t('roomDetailSection2.categoryText', {
                      category: room?.categoryTitle ?? t('roomDetailHero.privateRoom'),
                    })}
                  </strong>
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
                  <strong>
                    {t('roomDetailSection2.locationTitle', {
                      city: room?.ville ?? '',
                      district: room?.quartier ?? '',
                    })}
                  </strong>
                  <p>
                    {t('roomDetailSection2.locationText', {
                      district: room?.quartier ?? '',
                      city: room?.ville ?? '',
                      country: room?.pays ?? '',
                    })}
                  </p>
                </div>
              </div>

              <div className="m7-detail-row">
                <span className="m7-detail-row__icon"><UtensilsIcon /></span>
                <div>
                  <strong>
                    {t('roomDetailSection2.apartmentTitle', {
                      category: room?.categoryTitle ?? t('roomDetailHero.privateRoom'),
                    })}
                  </strong>
                  <p>{room?.info || room?.description || t('roomDetailSection2.apartmentText')}</p>
                </div>
              </div>

              <div className="m7-detail-row">
                <span className="m7-detail-row__icon"><Icon name="star" size={18} /></span>
                <div>
                  <strong>
                    {t('roomDetailSection2.hostTitle', {
                      host: room?.gerant
                        ? `${room.gerant.prenom ?? ''} ${room.gerant.nom ?? ''}`.trim()
                        : 'Linkhoo',
                    })}
                  </strong>
                  <p>
                    {room?.gerant?.is_verified
                      ? t('roomDetailSection2.hostText')
                      : t('roomDetailSection2.hostUnverifiedText')}
                  </p>
                </div>
              </div>

              <div className="m7-detail-row m7-detail-row--avatar">
                <span className="m7-detail-row__avatar"><Icon name="userRound" size={18} /></span>
                <div>
                  <strong>
                    {t('roomDetailSection2.hostLabel', {
                      host: room?.gerant?.prenom ?? 'Linkhoo',
                    })}
                  </strong>
                  <p>
                    {room?.gerant?.experience_months != null
                      ? t(
                          room.gerant.is_superhost
                            ? 'roomDetailSection2.superhostWithMonths'
                            : 'roomDetailSection2.hostWithMonths',
                          { months: room.gerant.experience_months },
                        )
                      : t('roomDetailSection2.newHost')}
                  </p>
                </div>
              </div>

              <p className="m7-details__more"><InfoIcon /> {t('roomDetailSection2.learnMore')}</p>

              {/* Sélection des dates (s4.png) : même colonne gauche que les
                  détails, pour que le formulaire de droite reste sticky. */}
              <div className="m7-dates" aria-label={t('roomDetailSection4.aria')}>
                <h2 className="m7-dates__title">{t('roomDetailSection4.title')}</h2>
                <p className="m7-dates__hint">{t('roomDetailSection4.minStay')}</p>

                <div className="m7-calendar-wrap">
                  <div className="m7-calendar">
                    <div className="m7-calendar__head">
                      <button
                        type="button"
                        className="m7-calendar__nav m7-calendar__nav--prev"
                        onClick={() => setMonthOffset((value) => Math.max(0, value - 1))}
                        disabled={monthOffset === 0}
                        aria-label={t('roomDetailSection4.previousMonth')}
                      >
                        <Icon name="chevronLeft" size={20} />
                      </button>
                      {monthLabels.map((label, index) => (
                        <p className="m7-calendar__month" key={`${label}-${index}`}>{label}</p>
                      ))}
                      <button
                        type="button"
                        className="m7-calendar__nav m7-calendar__nav--next"
                        onClick={() => setMonthOffset((value) => value + 1)}
                        aria-label={t('roomDetailSection4.nextMonth')}
                      >
                        <Icon name="chevronRight" size={20} />
                      </button>
                    </div>
                    <div className="m7-calendar__months">
                      {months.map((month) => (
                        <CalendarMonth
                          key={`${month.getFullYear()}-${month.getMonth()}`}
                          month={month}
                          locale={locale}
                          arrivee={arrivee}
                          depart={depart}
                          todayISO={todayISO}
                          onPick={pickDate}
                        />
                      ))}
                    </div>
                  </div>
                  <button type="button" className="m7-dates__clear" onClick={clearDates}>
                    {t('roomDetailSection4.clearDates')}
                  </button>
                </div>
              </div>
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
                        <option key={value} value={value}>{value > 1 ? `${value} ${t('roomDetailSection2.guestsPlural')}` : t('roomDetailHero.guest')}</option>
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

        {/* Quatrième section — note globale et détail des évaluations (s5.png). */}
        <section className="m7-rating" aria-label={t('roomDetailSection5.aria')}>
          <div className="m7-rating__hero">
            <div className="m7-rating__score-row">
              <GuestFavouriteLaurel className="m7-rating__laurel" />
              <strong className="m7-rating__score">{ratingText}</strong>
              <GuestFavouriteLaurel className="m7-rating__laurel m7-rating__laurel--right" />
            </div>
            <h2 className="m7-rating__badge">{t('roomDetailSection5.badge')}</h2>
            <p className="m7-rating__description">{t('roomDetailSection5.description')}</p>
          </div>

          <div className="m7-rating__stats">
            <div className="m7-rating__stat">
              <h3 className="m7-rating__stat-title">{t('roomDetailSection5.overall')}</h3>
              <div className="m7-rating__bars">
                {[5, 4, 3, 2, 1].map((note, index) => (
                  <div className="m7-rating__bar" key={note}>
                    <span className="m7-rating__bar-label" aria-hidden="true">{note}</span>
                    <span
                      className="m7-rating__bar-track"
                      role="img"
                      aria-label={`${note} ${t('roomDetailSection5.overall')} : ${bars[index]} %`}
                    >
                      <span className="m7-rating__bar-fill" style={{ width: `${bars[index]}%` }} />
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {scoreDetails.map((detail) => (
              <div className="m7-rating__stat" key={detail.label}>
                <h3 className="m7-rating__stat-title">{detail.label}</h3>
                <p className="m7-rating__stat-value">{detail.value}</p>
                <ScoreIcon name={detail.icon} />
              </div>
            ))}
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

/** Couronnes de laurier du badge « Coup de cœur voyageurs » (s5.png). */
function GuestFavouriteLaurel({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 120" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="m7-laurel-leaf" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5c5c5c" />
          <stop offset="0.55" stopColor="#3a3a3a" />
          <stop offset="1" stopColor="#242424" />
        </linearGradient>
      </defs>
      <path d="M33 10C15 36 15 76 44 107" stroke="#2b2b2b" strokeWidth="5" strokeLinecap="round" />
      <ellipse cx="33" cy="19" rx="10" ry="17" transform="rotate(-8 33 19)" fill="url(#m7-laurel-leaf)" />
      <ellipse cx="25" cy="46" rx="9" ry="16" transform="rotate(-32 25 46)" fill="url(#m7-laurel-leaf)" />
      <ellipse cx="29" cy="72" rx="9" ry="15" transform="rotate(-48 29 72)" fill="url(#m7-laurel-leaf)" />
      <ellipse cx="46" cy="95" rx="16" ry="9" transform="rotate(-18 46 95)" fill="url(#m7-laurel-leaf)" />
    </svg>
  );
}

type ScoreIconName = 'broom' | 'check' | 'key' | 'chat' | 'map' | 'tag';

function ScoreIcon({ name }: { name: ScoreIconName }) {
  const paths: Record<ScoreIconName, ReactNode> = {
    broom: (
      <>
        <path d="M8 21h6a2 2 0 0 0 2-2v-4H6v4a2 2 0 0 0 2 2Z" />
        <path d="M6 15V8h7v7M13 9h5v4h-5M18 6h2v2h-2M17 3h.01M21 4h.01" />
      </>
    ),
    check: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12 3 3 5-6" />
      </>
    ),
    key: (
      <>
        <circle cx="8" cy="12" r="4" />
        <circle cx="8" cy="12" r="1" />
        <path d="m11 15 8 5 2-2-3-3 2-2-3-3-2 2" />
      </>
    ),
    chat: <path d="M20 15a2 2 0 0 1-2 2H9l-5 4V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2Z" />,
    map: (
      <>
        <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Z" />
        <path d="M9 3v15M15 6v15" />
      </>
    ),
    tag: (
      <>
        <path d="M20 13 13 20a2 2 0 0 1-3 0l-6-6a2 2 0 0 1 0-3l6-6a2 2 0 0 1 2 0l8 8Z" />
        <circle cx="8" cy="8" r="1.2" />
      </>
    ),
  };

  return (
    <svg
      className="m7-rating__stat-icon"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#222"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

type CalendarMonthProps = {
  month: Date;
  locale: string;
  arrivee: string;
  depart: string;
  todayISO: string;
  onPick: (iso: string) => void;
};

function CalendarMonth({ month, locale, arrivee, depart, todayISO, onPick }: CalendarMonthProps) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const leadingBlanks = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  const dayCount = new Date(year, monthIndex + 1, 0).getDate();
  const weekdays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) =>
        new Intl.DateTimeFormat(locale, { weekday: 'narrow' })
          .format(new Date(2024, 0, 1 + index))
          .toLocaleUpperCase(locale),
      ),
    [locale],
  );

  return (
    <div className="m7-calendar__month-block">
      <div className="m7-calendar__weekdays" aria-hidden="true">
        {weekdays.map((weekday, index) => (
          <span key={`${weekday}-${index}`}>{weekday}</span>
        ))}
      </div>
      <div className="m7-calendar__days">
        {Array.from({ length: leadingBlanks }, (_, index) => (
          <span key={`blank-${index}`} className="m7-calendar__cell m7-calendar__cell--empty" aria-hidden="true" />
        ))}
        {Array.from({ length: dayCount }, (_, index) => {
          const day = index + 1;
          const iso = `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`;
          const disabled = iso < todayISO || (!depart && !!arrivee && iso <= arrivee);
          const selected = iso === arrivee || iso === depart;
          const inRange = !!arrivee && !!depart && iso > arrivee && iso < depart;
          const classes = [
            'm7-calendar__cell',
            selected ? 'm7-calendar__cell--selected' : '',
            inRange ? 'm7-calendar__cell--range' : '',
          ].filter(Boolean).join(' ');
          return (
            <button
              key={iso}
              type="button"
              className={classes}
              disabled={disabled}
              onClick={() => onPick(iso)}
              aria-label={formatDisplayDate(iso, locale)}
            >
              {day}
            </button>
          );
        })}
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

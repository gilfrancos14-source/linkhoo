import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiBoosts, type BoostFeaturedItem } from '../../lib/api';
import { formatPrice } from '../../lib/roomDisplay';
import type { Country } from './data';
import { LISTINGS } from './data';
import Icon from './icons';

const VISITOR_STORAGE_KEY = 'ilehya_boost_visitor';

function generateVisitorId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

let memoFallbackId: string | null = null;

/** Identifiant pseudonyme du visiteur, persisté en local pour la déduplication
    des impressions/clics côté serveur. Navigation privée : identifiant éphémère. */
export function boostVisitorId(): string {
  try {
    const existing = window.localStorage.getItem(VISITOR_STORAGE_KEY);
    if (existing) return existing;
    const generated = generateVisitorId();
    window.localStorage.setItem(VISITOR_STORAGE_KEY, generated);
    return generated;
  } catch {
    if (!memoFallbackId) memoFallbackId = generateVisitorId();
    return memoFallbackId;
  }
}

interface ListingCard {
  id: string;
  roomId: string;
  title: string;
  location: string;
  rating: string;
  reviews: string;
  price: string;
  image: string;
  imageAlt: string;
  href: string;
}

function toCard(item: BoostFeaturedItem, index: number): ListingCard {
  const city = item.ville?.trim() || item.quartier?.trim() || '';
  const fallback = LISTINGS[index % LISTINGS.length];
  return {
    id: item.id,
    roomId: item.room_id,
    title: item.title,
    location: city ? `${city}, ${item.market}` : item.market,
    rating: typeof item.rating === 'number' ? item.rating.toFixed(1) : '—',
    reviews: typeof item.reviews_count === 'number' ? String(item.reviews_count) : '0',
    price: formatPrice(item.price_num ?? item.price),
    image: item.img || fallback.image,
    imageAlt: item.title,
    href: `/${item.market.toLowerCase()}/chambre/${item.room_id}`,
  };
}

interface LandingListingsProps {
  country: Country;
}

export default function LandingListings({ country }: LandingListingsProps) {
  const [items, setItems] = useState<BoostFeaturedItem[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [favorites, setFavorites] = useState<ReadonlySet<string>>(new Set());
  const trackRef = useRef<HTMLDivElement | null>(null);
  const countedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;
    setStatus('loading');
    setItems([]);
    apiBoosts
      .featured(country.code)
      .then((data) => {
        if (!alive) return;
        setItems(Array.isArray(data?.items) ? data.items : []);
        setStatus('ready');
      })
      .catch(() => {
        if (!alive) return;
        setItems([]);
        setStatus('error');
      });
    return () => {
      alive = false;
    };
  }, [country.code]);

  useEffect(() => {
    if (items.length === 0 || typeof IntersectionObserver === 'undefined') return;
    const track = trackRef.current;
    if (!track) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const id = (entry.target as HTMLElement).dataset.boostId;
          if (id && !countedRef.current.has(id)) {
            countedRef.current.add(id);
            apiBoosts.impression(id, boostVisitorId()).catch(() => {});
          }
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.5 },
    );

    track.querySelectorAll<HTMLElement>('[data-boost-id]').forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [items]);

  const toggleFavorite = (id: string) => {
    setFavorites((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const trackClick = (boostId: string) => {
    apiBoosts.click(boostId, boostVisitorId()).catch(() => {});
  };

  if (status === 'error') return null;
  if (status === 'ready' && items.length === 0) return null;

  const market = country.marketSlug ?? country.code.toLowerCase();

  return (
    <section className="acc-section" id="annonces">
      <div className="acc-container acc-section__inner">
        <div className="acc-section__head">
          <div>
            <p className="acc-section__eyebrow acc-section__eyebrow--star">
              <Icon name="star" size={20} />
              Sponsorisé
            </p>
            <h2 className="acc-section__title">Des chambres en vedette</h2>
            <p className="acc-section__sub">
              Les annonces les plus consultées du moment. Profitez-en !
            </p>
          </div>
          <Link className="acc-link" to={`/${market}/recherche`}>
            Voir toutes les annonces
            <Icon name="arrowRight" size={14} />
          </Link>
        </div>

        <div className="acc-listings" ref={trackRef} aria-busy={status === 'loading'}>
          {status === 'loading'
            ? Array.from({ length: 6 }).map((_, index) => (
                <article
                  className="acc-listing acc-listing--skeleton"
                  key={`skeleton-${index}`}
                  aria-hidden="true"
                >
                  <div className="acc-listing__media" />
                  <div className="acc-listing__body">
                    <span className="acc-skeleton acc-skeleton--sm" />
                    <span className="acc-skeleton acc-skeleton--lg" />
                    <span className="acc-skeleton acc-skeleton--md" />
                    <span className="acc-skeleton acc-skeleton--sm" />
                  </div>
                </article>
              ))
            : items.map((item, index) => {
                const card = toCard(item, index);
                const favorite = favorites.has(card.id);
                return (
                  <article className="acc-listing" key={card.id} data-boost-id={card.id}>
                    <Link
                      className="acc-listing__link"
                      to={card.href}
                      aria-label={card.title}
                      onClick={() => trackClick(card.id)}
                    />
                    <div className="acc-listing__media">
                      <img
                        className="acc-listing__img"
                        src={card.image}
                        alt={card.imageAlt}
                        loading="lazy"
                        decoding="async"
                      />
                      <span className="acc-listing__badge">Sponsorisé</span>
                      <button
                        type="button"
                        className={`acc-listing__heart${favorite ? ' acc-listing__heart--active' : ''}`}
                        aria-label={favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                        aria-pressed={favorite}
                        onClick={() => toggleFavorite(card.id)}
                      >
                        <Icon name="heart" size={16} />
                      </button>
                    </div>
                    <div className="acc-listing__body">
                      <p className="acc-listing__loc">
                        <Icon name="mapPin" size={12} />
                        {card.location}
                      </p>
                      <h3 className="acc-listing__name">{card.title}</h3>
                      <p className="acc-listing__rating">
                        <Icon name="star" size={12} className="acc-star-filled" />
                        <b>{card.rating}</b>
                        <span>({card.reviews})</span>
                      </p>
                      <p className="acc-listing__price">
                        <b>{card.price ? `${card.price} FCFA` : 'Prix sur demande'}</b>
                        {card.price ? <span>/ nuit</span> : null}
                      </p>
                    </div>
                  </article>
                );
              })}
        </div>
      </div>
    </section>
  );
}

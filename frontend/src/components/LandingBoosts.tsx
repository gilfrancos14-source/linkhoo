import { useEffect, useRef, useState } from 'react';
import { apiBoosts, type BoostFeaturedItem, type BoostFeaturedResponse } from '../lib/api';
import { roomSubtitle } from '../lib/roomDisplay';
import StayCard from './StayCard';
import CardSkeleton from './CardSkeleton';

const VISITOR_STORAGE_KEY = 'ilehya_boost_visitor';

/**
 * Identifiant pseudonyme du visiteur, persisté en local : la déduplication
 * des impressions/clics côté serveur s'appuie dessus. Navigation privée
 * (localStorage verrouillé) : on retombe sur un identifiant éphémère.
 */
export function boostVisitorId(): string {
  try {
    const existing = window.localStorage.getItem(VISITOR_STORAGE_KEY);
    if (existing) return existing;
    const generated =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(VISITOR_STORAGE_KEY, generated);
    return generated;
  } catch {
    return `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

// Emplacements sponsorisés de la page d'accueil : le serveur renvoie une
// rotation aléatoire (6 slots max). Erreur ou réponse anormale (fallback
// e2e qui renvoie {}) : la section se masque plutôt qu'un bloc vide.
export default function LandingBoosts() {
  const [items, setItems] = useState<BoostFeaturedItem[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const trackRef = useRef<HTMLDivElement | null>(null);
  const countedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;
    setStatus('loading');
    apiBoosts
      .featured()
      .then((data) => {
        if (!alive) return;
        const payload = data as Partial<BoostFeaturedResponse> | null;
        setItems(Array.isArray(payload?.items) ? payload.items : []);
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
  }, []);

  // Impression = carte suffisamment visible, une seule fois par campagne pour
  // ce visiteur (la fenêtre de 10 min est en plus appliquée côté serveur).
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

  // Clic sur une carte : le serveur déduplique à raison de 1 clic par
  // visiteur et par campagne sur 24 h, on peut donc signaler chaque clic.
  const trackClick = (boostId: string) => {
    apiBoosts.click(boostId, boostVisitorId()).catch(() => {});
  };

  if (status === 'error') return null;
  if (status === 'ready' && items.length === 0) return null;

  return (
    <section className="landing-boosts" aria-label="Annonces sponsorisées">
      <div className="container">
        <div className="section-head reveal">
          <p className="eyebrow">Sponsorisé</p>
          <h2 className="section-title">Des chambres <em>en vedette</em></h2>
        </div>

        <div className="landing-boosts__track" ref={trackRef} aria-busy={status === 'loading'}>
          {status === 'loading' ? (
            <CardSkeleton count={4} />
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="landing-boosts__item"
                data-boost-id={item.id}
                onClick={() => trackClick(item.id)}
              >
                <StayCard
                  image={item.img ?? ''}
                  alt={item.title}
                  title={item.title}
                  rating={item.quartier ?? item.ville ?? undefined}
                  ratingType="loc"
                  description={roomSubtitle({ quartier: item.quartier, ville: item.ville })}
                  price={item.price ?? (item.price_num != null ? String(item.price_num) : '')}
                  priceUnit=""
                  href={`/${item.market.toLowerCase()}/chambre/${item.room_id}`}
                  badge="Sponsorisé"
                  badgeVariant="sponsored"
                />
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

import { useEffect, useRef, useState, useCallback } from 'react';
import { useMarket, type MarketCode } from '../contexts/MarketContext';
import { marketByCode } from '../config/markets';
import { fetchEscapadesByMarket, type EscapadeCard } from '../data/escapades';
import CardSkeleton from './CardSkeleton';

// Article du pays (le/la) pour le chapô : « du Bénin », « de la Côte d'Ivoire ».
// Miroir du registre TourismSection (GN et CD sont « la »).
const ARTICLE: Record<MarketCode, 'le' | 'la'> = {
  CI: 'la', BJ: 'le', SN: 'le', TG: 'le', CM: 'le', BF: 'le',
  CG: 'le', GA: 'le', GN: 'la', ML: 'le', NE: 'le', CD: 'la',
};

// Chapô figé par marché (pays venu du registre) ; les cartes viennent de
// l'API (table escapades). Pas de fallback : liste vide ou erreur → la
// section disparaît (return null).
function subFor(market: MarketCode): string {
  const { pays } = marketByCode(market);
  // de + le → du ; de + la → de la
  const de = ARTICLE[market] === 'le' ? 'du' : 'de la';
  return `Des idées de sorties et découvertes pour profiter ensemble du meilleur ${de} ${pays}.`;
}

export default function EscapadeSection() {
  const { market } = useMarket();
  const [cards, setCards] = useState<EscapadeCard[] | null>(null);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const [slideIdx, setSlideIdx] = useState(0);
  const [prevDisabled, setPrevDisabled] = useState(true);
  const [nextDisabled, setNextDisabled] = useState(false);

  useEffect(() => {
    let ignore = false;
    // On vide avant de recharger : sinon /ci afficherait les cartes de /bj
    // pendant un render.
    setCards(null);
    fetchEscapadesByMarket(market)
      .then((data) => {
        if (!ignore) setCards(data);
      })
      .catch(() => {
        // Pas de fallback : erreur → section masquée.
        if (!ignore) setCards([]);
      });
    return () => {
      ignore = true;
    };
  }, [market]);

  const current = activeIdx !== null && cards ? cards[activeIdx] : null;
  const images = current?.images ?? [];

  const updateNav = useCallback(() => {
    // Réinitialise les flèches du carrousel selon le nombre d'images.
    setPrevDisabled(slideIdx <= 0);
    setNextDisabled(slideIdx >= images.length - 1);
  }, [slideIdx, images.length]);

  useEffect(() => {
    updateNav();
  }, [updateNav]);

  const openCard = (idx: number) => {
    if (activeIdx === idx) {
      setActiveIdx(null);
      return;
    }
    setActiveIdx(idx);
    setSlideIdx(0);
    setTimeout(() => {
      if (detailRef.current) {
        detailRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 50);
  };

  const closeDetail = () => setActiveIdx(null);

  const scrollSlides = (direction: 'prev' | 'next') => {
    setSlideIdx((i) => {
      const next = direction === 'prev' ? i - 1 : i + 1;
      return Math.max(0, Math.min(next, images.length - 1));
    });
  };

  const goToSlide = (idx: number) => setSlideIdx(idx);

  // Section masquée : aucun contenu, aucun bloc vide.
  if (cards !== null && cards.length === 0) return null;

  const loading = cards === null;

  return (
    <section className="escapade" id="escapade">
      <div className="container">
        <div className="section-head reveal">
          <p className="eyebrow">Escapade weekend</p>
          <h2 className="section-title">Où aller <em>en famille</em> ?</h2>
          <p className="section-sub">{subFor(market)}</p>
        </div>

        <div className="escapade__track" aria-busy={loading}>
          {loading ? (
            <CardSkeleton count={5} />
          ) : (
            cards.map((item, idx) => (
              <article
                key={item.id}
                className="escapade__card reveal"
                role="button"
                tabIndex={0}
                aria-pressed={activeIdx === idx}
                onClick={() => openCard(idx)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openCard(idx);
                  }
                }}
              >
                <div className="escapade__card-media">
                  <img src={item.cover} alt={item.lieu} loading="lazy" width="260" height="195" />
                  <div className="escapade__card-shade" aria-hidden="true"></div>
                </div>
                <div className="escapade__card-body">
                  <h3 className="escapade__card-title">{item.lieu}</h3>
                  <p className="escapade__card-text">{item.text}</p>
                </div>
              </article>
            ))
          )}
        </div>

        <div
          className={`escapade-detail${activeIdx !== null ? ' is-open' : ''}`}
          id="escapade-detail"
          aria-hidden={activeIdx === null}
          ref={detailRef}
        >
          <button type="button" className="escapade-detail__close" aria-label="Fermer" onClick={closeDetail}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
          <div className="escapade-detail__content">
            <h3 className="escapade-detail__title">{current?.lieu}</h3>
            <p className="escapade-detail__text">{current?.text}</p>

            {images.length > 0 && (
              <>
                <div className="escapade-detail__carousel">
                  {images.length > 1 && (
                    <button
                      type="button"
                      className="escapade-detail__arrow escapade-detail__arrow--prev"
                      aria-label="Image précédente"
                      disabled={prevDisabled}
                      onClick={() => scrollSlides('prev')}
                    >
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5m6-6l-6 6 6 6"/></svg>
                    </button>
                  )}
                  <div className="escapade-detail__stage">
                    <img
                      src={images[slideIdx]}
                      alt={`${current?.lieu ?? ''} — image ${slideIdx + 1}`}
                      loading="lazy"
                      width="720"
                      height="480"
                    />
                  </div>
                  {images.length > 1 && (
                    <button
                      type="button"
                      className="escapade-detail__arrow escapade-detail__arrow--next"
                      aria-label="Image suivante"
                      disabled={nextDisabled}
                      onClick={() => scrollSlides('next')}
                    >
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14m-6-6l6 6-6 6"/></svg>
                    </button>
                  )}
                </div>

                {images.length > 1 && (
                  <div className="escapade-detail__dots" role="tablist" aria-label="Diapositives du carrousel">
                    {images.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        className={`escapade-detail__dot${i === slideIdx ? ' is-active' : ''}`}
                        aria-label={`Image ${i + 1}`}
                        onClick={() => goToSlide(i)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

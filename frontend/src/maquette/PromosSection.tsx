import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { MarketCode } from '../config/markets';
import MaquetteBannerCarousel from './MaquetteBannerCarousel';
import type { BannerSlide, PromoCard } from './viewModel';

interface PromosSectionProps {
  market: MarketCode;
  cards: PromoCard[];
  banners: BannerSlide[];
}

export default function PromosSection({ market, cards, banners }: PromosSectionProps) {
  const navigate = useNavigate();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  if (cards.length === 0 && banners.length === 0) return null;

  const defaultCard =
    cards.find((card) => card.key === 'promo_10' && card.rooms.length > 0) ??
    cards.find((card) => card.rooms.length > 0) ??
    cards.find((card) => card.key === 'promo_10') ??
    cards[0] ??
    null;
  const selected = cards.find((card) => card.key === selectedKey) ?? defaultCard;
  const showFeature = Boolean(selected && !dismissed);
  const hasFeature = showFeature;
  const feature =
    selected && showFeature
      ? {
          title: selected.featureTitle,
          discount: selected.badge,
          description: selected.description,
          rooms: selected.rooms,
        }
      : null;
  const singleRoom = feature?.rooms.length === 1 ? feature.rooms[0] : null;
  const cardSpan = !hasFeature
    ? cards.length === 1
      ? 'lg:col-span-12'
      : cards.length === 2
        ? 'lg:col-span-6'
        : 'lg:col-span-4'
    : cards.length <= 1
      ? 'lg:col-span-4'
      : 'lg:col-span-3';
  const featureSpan =
    cards.length === 0
      ? 'lg:col-span-6 lg:col-start-4'
      : cards.length === 1
        ? 'lg:col-span-8'
        : cards.length === 2
          ? 'lg:col-span-6'
          : 'lg:col-span-3';

  const openRoom = (roomId: string) => navigate(`/${market.toLowerCase()}/chambre/${roomId}`);
  const selectCard = (card: PromoCard) => {
    setSelectedKey(card.key);
    setDismissed(false);
  };

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8" data-purpose="promotional-offers">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <span className="text-orange-500">
              <i className="fa-solid fa-tags"></i>
            </span>
            Offres promotionnelles
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Des réductions incroyables sur une sélection de biens.
          </p>
        </div>
        {banners.length > 0 ? (
          <MaquetteBannerCarousel banners={banners} />
        ) : (
          <div className="flex items-center gap-3 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 px-4 py-2 rounded-2xl max-w-md shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-700 flex items-center justify-center text-lg flex-shrink-0">
              <i className="fa-solid fa-gift"></i>
            </div>
            <div className="text-xs">
              <p className="font-bold text-slate-900">Jusqu'à -30% sur certains logements</p>
              <p className="text-slate-500">Ne manquez pas cette opportunité !</p>
            </div>
          </div>
        )}
      </div>
      {cards.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {cards.map((card) => (
          <article
            key={card.key}
            role="button"
            tabIndex={0}
            aria-pressed={selected?.key === card.key}
            className={`${cardSpan} bg-white rounded-2xl overflow-hidden border shadow-sm flex flex-col justify-between group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5E1E] ${
              selected?.key === card.key ? 'border-[#FF5E1E]' : 'border-slate-100'
            }`}
            onClick={() => selectCard(card)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                selectCard(card);
              }
            }}
          >
            <div className="relative h-40 overflow-hidden bg-gradient-to-br from-slate-100 via-slate-50 to-orange-50 flex items-center justify-center">
              {card.image ? (
                <img
                  alt={card.alt}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  src={card.image}
                  loading="lazy"
                />
              ) : (
                <i className="fa-solid fa-tags text-4xl text-slate-300"></i>
              )}
              <span
                className={`absolute top-2.5 left-2.5 ${card.badgeClassName} text-white text-xs font-bold px-2 py-0.5 rounded-md`}
              >
                {card.badge}
              </span>
            </div>
            <div className="p-4 flex-1 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">{card.title}</h3>
                <p className="text-xs text-slate-500 mt-1">{card.text}</p>
              </div>
              <span
                className={`mt-4 w-full py-2 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition ${
                  selected?.key === card.key
                    ? 'bg-[#FF5E1E]'
                    : 'bg-slate-900 group-hover:bg-[#FF5E1E]'
                }`}
              >
                <span>{card.rooms.length > 0 ? 'Voir les biens' : 'Aucune offre'}</span>
                <i className="fa-solid fa-arrow-right text-[10px]"></i>
              </span>
            </div>
          </article>
        ))}
        {showFeature && feature && (
          <div
            className={`${featureSpan} bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex flex-col justify-between`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-xs font-bold text-slate-900">
                  {feature.title} <span className="text-emerald-600">{feature.discount}</span>
                </span>
                <p className="text-[10px] text-slate-500">{feature.description}</p>
              </div>
              <button
                type="button"
                aria-label="Fermer la sélection"
                className="text-slate-400 hover:text-slate-600 text-xs"
                onClick={() => setDismissed(true)}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            {feature.rooms.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center text-center px-4 py-8">
                <span className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
                  <i className="fa-solid fa-tags text-lg"></i>
                </span>
                <p className="text-sm font-bold text-slate-900">Aucune promotion active</p>
                <p className="text-xs text-slate-500 mt-1 max-w-xs">
                  Aucun bien n'est disponible pour cette offre pour le moment.
                </p>
              </div>
            ) : singleRoom ? (
              <button
                type="button"
                className="relative block w-full h-40 my-3 rounded-xl overflow-hidden text-left group/room"
                onClick={() => openRoom(singleRoom.id)}
              >
                {singleRoom.image ? (
                  <img
                    alt={singleRoom.alt}
                    className="absolute inset-0 w-full h-full object-cover group-hover/room:scale-105 transition duration-300"
                    src={singleRoom.image}
                    loading="lazy"
                  />
                ) : (
                  <span className="absolute inset-0 bg-slate-100" />
                )}
                <span className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-900/20 to-transparent" />
                <span className="absolute bottom-3 left-3 right-3">
                  <span className="block text-sm font-bold text-white truncate">
                    {singleRoom.title}
                  </span>
                  <span className="block text-[11px] font-extrabold text-amber-300">
                    {singleRoom.price}{' '}
                    <span className="text-white/70 font-normal">/nuit</span>
                  </span>
                </span>
              </button>
            ) : (
              <div
                className={`grid gap-2 my-3 ${
                  feature.rooms.length === 2 ? 'grid-cols-2' : 'grid-cols-3'
                }`}
              >
                {feature.rooms.map((room) => (
                  <button
                    key={room.id}
                    type="button"
                    className="space-y-1 text-left"
                    onClick={() => openRoom(room.id)}
                  >
                    {room.image && (
                      <img
                        alt={room.alt}
                        className="w-full h-16 object-cover rounded-lg"
                        src={room.image}
                        loading="lazy"
                      />
                    )}
                    <span className="block text-[10px] font-bold text-slate-800 truncate">
                      {room.title}
                    </span>
                    <span className="block text-[9px] font-extrabold text-[#FF5E1E]">
                      {room.price} <span className="text-slate-400 font-normal">/nuit</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
            {feature.rooms.length > 0 && (
              <div className="flex items-center justify-center gap-1.5 pt-2">
                {feature.rooms.map((room, index) => (
                  <span
                    key={room.id}
                    className={`w-1.5 h-1.5 rounded-full ${
                      index === 0 ? 'bg-[#FF5E1E]' : 'bg-slate-300'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        )}
        </div>
      )}
    </section>
  );
}

import { useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { MarketCode } from '../config/markets';
import PartnerBanners from '../components/landing/PartnerBanners';

interface HeroSectionProps {
  market: MarketCode;
}

function dateLabel(value: string, emptyLabel: string, locale: string): string {
  if (!value) return emptyLabel;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return emptyLabel;
  return date.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
}

function openDatePicker(input: HTMLInputElement | null) {
  if (!input) return;
  const picker = input as HTMLInputElement & { showPicker?: () => void };
  if (typeof picker.showPicker === 'function') {
    try {
      picker.showPicker();
      return;
    } catch {
      // Certains navigateurs refusent showPicker hors geste direct.
    }
  }
  input.focus();
}

export default function HeroSection({ market }: HeroSectionProps) {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const lang = (i18n.language || 'fr').split('-')[0];
  const countryName = t(`markets.${market}`);
  // Le genre du nom français est une propriété du marché, pas de la langue.
  const feminine = ['CI', 'GN', 'CD'].includes(market);
  const countryPhrase = t(
    feminine ? 'country.inFeminine' : 'country.inMasculine',
    { country: countryName },
  );
  const locale = lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : 'fr-FR';
  const [destination, setDestination] = useState('');
  const [arrivee, setArrivee] = useState('');
  const [depart, setDepart] = useState('');
  const arriveeRef = useRef<HTMLInputElement>(null);
  const departRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const params = new URLSearchParams();
    if (destination.trim()) params.set('q', destination.trim());
    if (arrivee) params.set('arrivee', arrivee);
    if (depart) params.set('depart', depart);
    const query = params.toString();
    navigate(`/${market.toLowerCase()}/recherche${query ? `?${query}` : ''}`);
  };

  return (
    <section
      className="relative min-h-[350px] bg-white text-slate-900 flex flex-col justify-center overflow-hidden"
      data-purpose="hero-section"
    >
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7 w-full">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold mb-4">
            <i className="fa-solid fa-location-dot text-[color:var(--market-accent)]"></i>
            <span>{countryName}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-[2.6rem] font-extrabold leading-[1.15] tracking-tight">
            {t('hero.title')} <span className="text-[color:var(--market-accent)]">{t('hero.titleHighlight')}</span>
          </h1>
          <p className="mt-4 text-base sm:text-lg text-slate-600 font-normal leading-relaxed max-w-2xl">
            {t('hero.subtitle', { countryPhrase })}
          </p>
        </div>
        <div className="absolute right-6 top-4 hidden lg:flex lg:justify-center w-[320px]">
          <PartnerBanners />
        </div>
        <div className="mt-5" data-purpose="hero-search-tabs">
          <div className="inline-flex rounded-t-xl overflow-hidden shadow-sm">
            <button
              type="button"
              className="bg-[color:var(--market-accent)] text-white px-6 py-2.5 min-h-[44px] text-xs sm:text-sm font-bold flex items-center gap-2"
            >
              <i className="fa-solid fa-umbrella-beach"></i>
              <span>{t('hero.tabStay')}</span>
            </button>
            <button
              type="button"
              className="bg-white hover:bg-slate-50 text-slate-700 px-6 py-2.5 min-h-[44px] text-xs sm:text-sm font-semibold flex items-center gap-2 transition border border-slate-200"
            >
              <i className="fa-solid fa-car"></i>
              <span>{t('hero.tabCar')}</span>
            </button>
          </div>
          <form
            className="bg-white rounded-b-2xl rounded-tr-2xl p-3 sm:p-4 shadow-2xl text-slate-800 grid grid-cols-1 md:grid-cols-12 gap-3 items-center"
            onSubmit={handleSubmit}
          >
            <div className="md:col-span-4 flex items-center gap-3 px-4 py-2.5 border-b md:border-b-0 md:border-r border-slate-200">
              <i className="fa-solid fa-magnifying-glass text-slate-400 text-lg"></i>
              <div className="w-full">
                <label
                  className="block text-xs font-bold text-slate-800 leading-none mb-1"
                  htmlFor="maquette-destination"
                >
                  {t('hero.whereTo')}
                </label>
                <input
                  id="maquette-destination"
                  className="w-full p-0 text-base text-slate-600 font-medium placeholder-slate-400 border-none focus:ring-0"
                  placeholder={t('hero.destinationPlaceholder')}
                  type="text"
                  value={destination}
                  onChange={(event) => setDestination(event.target.value)}
                />
              </div>
            </div>
            <div className="md:col-span-3 flex items-center gap-3 px-4 py-2.5 border-b md:border-b-0 md:border-r border-slate-200">
              <i className="fa-regular fa-calendar-days text-slate-400 text-lg"></i>
              <div className="w-full">
                <label className="block text-xs font-bold text-slate-800 leading-none mb-1" htmlFor="maquette-arrivee">
                  {t('hero.arrival')}
                </label>
                <button
                  type="button"
                  id="maquette-arrivee"
                  className="block min-h-[44px] inline-flex items-center text-xs text-slate-500 font-medium cursor-pointer text-left"
                  onClick={() => openDatePicker(arriveeRef.current)}
                >
                  {dateLabel(arrivee, t('hero.chooseDate'), locale)}
                </button>
                <input
                  ref={arriveeRef}
                  className="sr-only"
                  type="date"
                  tabIndex={-1}
                  value={arrivee}
                  onChange={(event) => setArrivee(event.target.value)}
                />
              </div>
            </div>
            <div className="md:col-span-3 flex items-center gap-3 px-4 py-2.5 border-b md:border-b-0 md:border-r border-slate-200">
              <i className="fa-regular fa-calendar-days text-slate-400 text-lg"></i>
              <div className="w-full">
                <label className="block text-xs font-bold text-slate-800 leading-none mb-1" htmlFor="maquette-depart">
                  {t('hero.departure')}
                </label>
                <button
                  type="button"
                  id="maquette-depart"
                  className="block min-h-[44px] inline-flex items-center text-xs text-slate-500 font-medium cursor-pointer text-left"
                  onClick={() => openDatePicker(departRef.current)}
                >
                  {dateLabel(depart, t('hero.chooseDate'), locale)}
                </button>
                <input
                  ref={departRef}
                  className="sr-only"
                  type="date"
                  tabIndex={-1}
                  value={depart}
                  onChange={(event) => setDepart(event.target.value)}
                />
              </div>
            </div>
            <div className="md:col-span-2">
              <button
                type="submit"
                className="w-full h-12 bg-[color:var(--market-accent)] hover:bg-[color:var(--market-accent-dark)] text-white font-bold rounded-xl flex items-center justify-center gap-2 text-sm shadow-md shadow-orange-500/30 transition"
              >
                <i className="fa-solid fa-magnifying-glass"></i>
                <span>{t('hero.search')}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}

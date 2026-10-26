import { useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { COUNTRIES } from '../components/landing/data';
import type { MarketCode } from '../config/markets';

interface HeroSectionProps {
  market: MarketCode;
}

function dateLabel(value: string): string {
  if (!value) return 'Choisir une date';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return 'Choisir une date';
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
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
  const country = COUNTRIES.find((item) => item.code === market) ?? COUNTRIES[0];
  const countryPhrase = ['CI', 'GN', 'CD'].includes(market)
    ? `en ${country.label}`
    : `au ${country.label}`;
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
      className="relative min-h-[350px] bg-slate-900 text-white flex flex-col justify-center overflow-hidden"
      data-purpose="hero-section"
    >
      <div className="absolute inset-0 z-0">
        <img
          alt={`Vue de ${country.label}`}
          className="w-full h-full object-cover object-center filter brightness-[0.78]"
          src="/images/hero-city.jpg"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0E1A2D] via-black/40 to-black/30"></div>
      </div>
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7 w-full">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-white text-xs font-semibold mb-4">
            <i className="fa-solid fa-location-dot text-[#FF5E1E]"></i>
            <span>{country.label}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-[2.6rem] font-extrabold leading-[1.15] tracking-tight">
            Trouvez le lieu idéal pour votre <span className="text-[#FF7A00]">prochain séjour</span>
          </h1>
          <p className="mt-4 text-base sm:text-lg text-slate-200 font-normal leading-relaxed max-w-2xl">
            Appartements, maisons, villas et bien plus encore. Découvrez les meilleures offres de
            location {countryPhrase} et réservez en toute confiance.
          </p>
        </div>
        <div className="absolute right-8 top-16 hidden lg:block text-right select-none pointer-events-none transform -rotate-6">
          <p className="font-handwriting text-3xl sm:text-4xl text-white font-bold drop-shadow-lg tracking-wide">
            {country.label},
            <br />
            <span className="text-2xl text-amber-200">une terre d'émotions</span>
          </p>
        </div>
        <div className="mt-5" data-purpose="hero-search-tabs">
          <div className="inline-flex rounded-t-xl overflow-hidden shadow-sm">
            <button
              type="button"
              className="bg-[#FF5E1E] text-white px-6 py-2.5 text-xs sm:text-sm font-bold flex items-center gap-2"
            >
              <i className="fa-solid fa-umbrella-beach"></i>
              <span>Séjour</span>
            </button>
            <button
              type="button"
              className="bg-white/95 hover:bg-white text-slate-700 px-6 py-2.5 text-xs sm:text-sm font-semibold flex items-center gap-2 transition backdrop-blur-sm"
            >
              <i className="fa-solid fa-car"></i>
              <span>Voiture de location</span>
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
                  Où voulez-vous aller ?
                </label>
                <input
                  id="maquette-destination"
                  className="w-full p-0 text-xs text-slate-600 font-medium placeholder-slate-400 border-none focus:ring-0"
                  placeholder="Ville, quartier, hôtel, etc."
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
                  Arrivée
                </label>
                <button
                  type="button"
                  id="maquette-arrivee"
                  className="block text-xs text-slate-500 font-medium cursor-pointer text-left"
                  onClick={() => openDatePicker(arriveeRef.current)}
                >
                  {dateLabel(arrivee)}
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
                  Départ
                </label>
                <button
                  type="button"
                  id="maquette-depart"
                  className="block text-xs text-slate-500 font-medium cursor-pointer text-left"
                  onClick={() => openDatePicker(departRef.current)}
                >
                  {dateLabel(depart)}
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
                className="w-full h-12 bg-[#FF5E1E] hover:bg-[#ea4f11] text-white font-bold rounded-xl flex items-center justify-center gap-2 text-sm shadow-md shadow-orange-500/30 transition"
              >
                <i className="fa-solid fa-magnifying-glass"></i>
                <span>Rechercher</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}

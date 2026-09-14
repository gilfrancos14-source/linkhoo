import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMarket } from '../contexts/MarketContext';

export default function Hero() {
  const { market } = useMarket();
  const [activeTab, setActiveTab] = useState<'sejour' | 'voiture'>('sejour');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateArrivee, setDateArrivee] = useState('');
  const [dateDepart, setDateDepart] = useState('');
  const [dateError, setDateError] = useState('');
  const navigate = useNavigate();

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    if (activeTab === 'voiture') return;

    // Dates obligatoires
    if (!dateArrivee || !dateDepart) {
      setDateError('Veuillez renseigner les dates d\'arrivée et de départ.');
      return;
    }
    if (dateDepart <= dateArrivee) {
      setDateError('La date de départ doit être ultérieure à la date d\'arrivée.');
      return;
    }

    setDateError('');
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set('q', searchQuery.trim());
    params.set('arrivee', dateArrivee);
    params.set('depart', dateDepart);
    void navigate(`/${market.toLowerCase()}/recherche?${params.toString()}`);
  };

  return (
    <section className="hero" id="accueil">
      <div className="hero__bg" aria-hidden="true"></div>
      <div className="hero__overlay" aria-hidden="true"></div>

      <div className="container hero__content">
        <div className="hero__links reveal">
          <button
            type="button"
            className={`hero-link hero-link--spaced${activeTab === 'sejour' ? ' hero-link--active' : ''}`}
            onClick={() => setActiveTab('sejour')}
          >
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6"/></svg>
            Séjour
          </button>
          <button
            type="button"
            className={`hero-link${activeTab === 'voiture' ? ' hero-link--active' : ''}`}
            onClick={() => setActiveTab('voiture')}
          >
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-3M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/></svg>
            Voiture de location
          </button>
        </div>

        <h1 className="hero__tagline reveal">
          {activeTab === 'sejour'
            ? 'Trouvez le lieu idéal pour votre prochain séjour'
            : 'Louez une voiture au meilleur prix'}
        </h1>

        <form className="hero-search reveal" onSubmit={handleSearch} noValidate>
          <div className="hero-search__input-wrap">
            <svg className="hero-search__icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            <input
              type="text"
              className="hero-search__input"
              placeholder={activeTab === 'sejour' ? 'Où voulez-vous aller ?' : 'Où allez-vous ?'}
              aria-label="Rechercher un lieu"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button type="submit" className="hero-search__btn" disabled={activeTab === 'voiture'}>
            Rechercher
          </button>
        </form>

        {activeTab === 'voiture' && (
          <div className="hero__coming-soon reveal" role="status">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
            <p>Cette fonctionnalité sera bientôt disponible.</p>
          </div>
        )}
        <div className="hero-dates reveal">
          <div className="hero-dates__field">
            <label className="hero-dates__label" htmlFor="date-arrivee">Arrivée <span aria-hidden="true">*</span></label>
            <input
              type="date"
              className={`hero-dates__input${dateError && !dateArrivee ? ' hero-dates__input--error' : ''}`}
              id="date-arrivee"
              aria-label="Date d'arrivée"
              aria-required="true"
              aria-invalid={!!dateError && !dateArrivee}
              value={dateArrivee}
              onChange={(e) => { setDateArrivee(e.target.value); if (dateError) setDateError(''); }}
            />
          </div>
          <div className="hero-dates__field">
            <label className="hero-dates__label" htmlFor="date-depart">Départ <span aria-hidden="true">*</span></label>
            <input
              type="date"
              className={`hero-dates__input${dateError && !dateDepart ? ' hero-dates__input--error' : ''}`}
              id="date-depart"
              aria-label="Date de départ"
              aria-required="true"
              aria-invalid={!!dateError && !dateDepart}
              value={dateDepart}
              onChange={(e) => { setDateDepart(e.target.value); if (dateError) setDateError(''); }}
            />
          </div>
        </div>
        {dateError && (
          <p className="hero-dates__error" role="alert">{dateError}</p>
        )}
      </div>
    </section>
  );
}

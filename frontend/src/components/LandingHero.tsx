import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchCategoriesByMarket, type Category } from '../data/categories';

// Hero de la page d'accueil racine — structure CoinAfrique :
// titre H1/H2 puis formulaire « mot-clé + Catégories + Pays + loupe ».
export default function LandingHero() {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [country, setCountry] = useState<'ci' | 'bj' | ''>('');
  const [categoryId, setCategoryId] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState('');

  // Les catégories dépendent du marché : on les recharge à chaque changement
  // de pays (cache HTTP côté cachedGet, aucun coût en double).
  useEffect(() => {
    let alive = true;
    if (!country) {
      setCategories([]);
      setCategoryId('');
      return;
    }
    const market = country === 'bj' ? 'BJ' : 'CI';
    fetchCategoriesByMarket(market)
      .then((data) => {
        if (!alive) return;
        setCategories(data);
        setCategoryId('');
      })
      .catch(() => {
        if (alive) setCategories([]);
      });
    return () => {
      alive = false;
    };
  }, [country]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!country) {
      setError('Choisissez un pays pour lancer la recherche.');
      return;
    }
    setError('');
    const params = new URLSearchParams();
    if (keyword.trim()) params.set('q', keyword.trim());
    if (categoryId) params.set('categorie', categoryId);
    const query = params.toString();
    void navigate(`/${country}/recherche${query ? `?${query}` : ''}`);
  };

  return (
    <section className="landing-hero" id="accueil">
      <div className="container landing-hero__inner">
        <div className="landing-hero__title reveal">
          <h1>Linkhoo — La location directe en Afrique de l’Ouest</h1>
          <p className="landing-hero__subtitle">Des biens proches de chez vous, sans intermédiaire</p>
        </div>

        <form className="landing-search reveal" onSubmit={handleSubmit} noValidate>
          <div className="landing-search__field landing-search__field--keyword">
            <label className="sr-only" htmlFor="landing-keyword">Que cherchez-vous ?</label>
            <svg className="landing-search__icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            <input
              id="landing-keyword"
              type="search"
              className="landing-search__input"
              placeholder="Chercher sur Linkhoo"
              autoComplete="off"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>

          <div className="landing-search__field">
            <label className="sr-only" htmlFor="landing-category">Catégories</label>
            <select
              id="landing-category"
              className="landing-search__select"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              disabled={!country}
            >
              <option value="" disabled={!country}>
                {country ? 'Toutes les catégories' : 'Choisissez un pays'}
              </option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.title}</option>
              ))}
            </select>
          </div>

          <div className="landing-search__field">
            <label className="sr-only" htmlFor="landing-country">Pays</label>
            <select
              id="landing-country"
              className="landing-search__select"
              value={country}
              onChange={(e) => setCountry(e.target.value as 'ci' | 'bj' | '')}
              required
            >
              <option value="" disabled>Pays</option>
              <option value="ci">Côte d’Ivoire</option>
              <option value="bj">Bénin</option>
            </select>
          </div>

          <button type="submit" className="landing-search__submit" aria-label="Lancer la recherche">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          </button>
        </form>

        {error && <p className="landing-search__error reveal" role="alert">{error}</p>}
      </div>
    </section>
  );
}

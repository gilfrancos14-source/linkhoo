import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchCategoriesByMarket, type Category } from '../../data/categories';
import Icon from './icons';
import { COUNTRIES, type Country } from './data';

interface LandingHeroProps {
  country: Country;
  onCountryChange: (country: Country) => void;
}

export default function LandingHero({ country, onCountryChange }: LandingHeroProps) {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    let alive = true;
    fetchCategoriesByMarket(country.code)
      .then((data) => {
        if (alive) setCategories(data);
      })
      .catch(() => {
        if (alive) setCategories([]);
      });
    setCategory('');
    return () => {
      alive = false;
    };
  }, [country.code]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const params = new URLSearchParams();
    if (keyword.trim()) params.set('q', keyword.trim());
    if (category) params.set('categorie', category);
    const query = params.toString();
    const market = country.marketSlug ?? country.code.toLowerCase();
    void navigate(`/${market}/recherche${query ? `?${query}` : ''}`);
  };

  return (
    <section className="acc-hero" id="accueil">
      <div className="acc-container acc-hero__inner">
        <div>
          <p className="acc-hero__eyebrow">
            Location de chambres, appartements, villas et plus encore
          </p>
          <h1 className="acc-hero__title">
            <span className="acc-hero__title-brand">Linkhoo</span> – La location directe en
            Afrique de l&apos;Ouest
          </h1>
          <p className="acc-hero__sub">
            Trouvez facilement le logement idéal pour vos séjours, vos voyages ou vos déplacements
            professionnels.
          </p>
        </div>

        <form className="acc-hero-search" onSubmit={handleSubmit} role="search">
          <label className="acc-search-field" htmlFor="acc-search-keyword">
            <Icon name="search" size={20} />
            <span className="acc-search-field__body">
              <span className="acc-search-field__label">Mot-clé</span>
              <input
                id="acc-search-keyword"
                className="acc-search-field__input"
                placeholder="Ex: villa, hôtel, plage..."
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
              />
            </span>
          </label>

          <label className="acc-search-field" htmlFor="acc-search-category">
            <Icon name="layoutGrid" size={20} />
            <span className="acc-search-field__body">
              <span className="acc-search-field__label">Catégorie</span>
              <select
                id="acc-search-category"
                className="acc-search-field__select"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                <option value="">Toutes les catégories</option>
                {categories.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </span>
            <Icon name="chevronDown" size={16} />
          </label>

          <label className="acc-search-field" htmlFor="acc-search-country">
            <span className="acc-flag" style={{ background: country.flag }} aria-hidden="true" />
            <span className="acc-search-field__body">
              <span className="acc-search-field__label">
                Pays <span className="acc-required">*</span>
              </span>
              <select
                id="acc-search-country"
                className="acc-search-field__select"
                value={country.code}
                onChange={(event) => {
                  const next = COUNTRIES.find((item) => item.code === event.target.value);
                  if (next) onCountryChange(next);
                }}
              >
                {COUNTRIES.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.label}
                  </option>
                ))}
              </select>
            </span>
            <Icon name="chevronDown" size={16} />
          </label>

          <button type="submit" className="acc-search-submit" aria-label="Rechercher">
            <Icon name="search" size={24} />
          </button>
        </form>
      </div>
    </section>
  );
}

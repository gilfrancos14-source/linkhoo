import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMarket } from '../../contexts/MarketContext';
import { marketByCode } from '../../config/markets';
import { apiGerants, type GerantData } from '../../lib/api';
import { isPremiumActive } from '../../lib/premium';
import { formatDateLong } from '../../lib/formatDate';

export default function ProfilPage() {
  const { market } = useMarket();
  const navigate = useNavigate();
  const [gerant, setGerant] = useState<GerantData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    prenom: '',
    nom: '',
    phone: '',
  });

  useEffect(() => {
    apiGerants.getMe().then((data) => {
      setGerant(data);
      setForm({
        prenom: data.prenom || '',
        nom: data.nom || '',
        phone: data.phone || '',
      });
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const updated = await apiGerants.updateMe(form);
      setGerant(updated);
      setSuccess('Profil mis à jour avec succès');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err?.message || 'Erreur lors de la mise à jour');
    } finally {
      setSaving(false);
    }
  };

  const initials = (gerant?.prenom?.[0] || '') + (gerant?.nom?.[0] || '');
  const marketLabel = marketByCode(market).label;
  const verified = Boolean(gerant?.is_verified);
  const premium = isPremiumActive(gerant);
  const memberYear = gerant?.created_at
    ? new Date(gerant.created_at).getFullYear()
    : null;
  const completion = Math.round(
    ([form.prenom, form.nom, form.phone].filter(Boolean).length / 3) * 100,
  );

  if (loading) {
    return (
      <div className="dash">
        <div className="dash-page-head">
          <h1>Mon profil</h1>
          <p>Gérez vos informations personnelles et l'état de votre compte</p>
        </div>
        <div className="profil-skeleton" aria-busy="true">
          <div className="profil-skeleton__hero" />
          <div className="profil-skeleton__panel" />
          <div className="profil-skeleton__aside" />
          <p className="profil-skeleton__text">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dash">
      <div className="dash-page-head">
        <h1>Mon profil</h1>
        <p>Gérez vos informations personnelles et l'état de votre compte</p>
      </div>

      {/* Hero */}
      <section className="profil-hero">
        <div className="profil-hero__glow" aria-hidden="true" />
        <div className="profil-hero__pattern" aria-hidden="true" />
        <div className="profil-hero__content">
          <div className="profil-avatar-wrap">
            <div className="profil-avatar">
              {initials ? <span>{initials}</span> : (
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              )}
            </div>
            {verified && (
              <span
                className="profil-badge profil-badge--verified profil-avatar__badge"
                title="Gérant vérifié"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12l5 5L20 7"/>
                </svg>
                <span className="sr-only">Vérifié</span>
              </span>
            )}
          </div>
          <div className="profil-hero__main">
            <h2>{gerant?.prenom} {gerant?.nom}</h2>
            <p className="profil-hero__email">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
              {gerant?.email || '—'}
            </p>
            <div className="profil-hero__meta">
              <span className="profil-hero__chip">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
                </svg>
                {gerant?.phone || 'Non renseigné'}
              </span>
              {memberYear && (
                <span className="profil-hero__chip">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                  </svg>
                  Membre depuis {memberYear}
                </span>
              )}
            </div>
          </div>
          <div className="profil-hero__badges">
            {premium && (
              <span className="profil-badge profil-badge--premium">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
                Premium
              </span>
            )}
          </div>
        </div>
      </section>

      <div className="profil-layout">
        {/* Formulaire */}
        <form className="profil-form" onSubmit={handleSubmit} noValidate>
          <header className="profil-card__head">
            <span className="profil-card__icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </span>
            <div className="profil-card__heading">
              <h3>Informations personnelles</h3>
              <p>Ces informations identifient votre compte gérant.</p>
            </div>
          </header>

          <div className="profil-completion">
            <div className="profil-completion__top">
              <span>Profil complété</span>
              <strong>{completion}%</strong>
            </div>
            <div
              className="profil-completion__bar"
              role="progressbar"
              aria-valuenow={completion}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Profil complété"
            >
              <span style={{ width: `${completion}%` }} />
            </div>
          </div>

          <div className="form-grid">
            <label className="admin-field">
              <span>Prénom</span>
              <input
                type="text"
                name="prenom"
                value={form.prenom}
                onChange={handleChange}
                placeholder="Votre prénom"
              />
            </label>
            <label className="admin-field">
              <span>Nom</span>
              <input
                type="text"
                name="nom"
                value={form.nom}
                onChange={handleChange}
                placeholder="Votre nom"
              />
            </label>
            <label className="admin-field">
              <span>Téléphone</span>
              <div className="profil-input-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
                </svg>
                <input
                  type="tel"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="+225 07 00 00 00"
                />
              </div>
            </label>

            <div className="profil-field">
              <label className="admin-field admin-field--disabled">
                <span>Email</span>
                <div className="profil-input-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0110 0v4"/>
                  </svg>
                  <input
                    type="email"
                    value={gerant?.email || ''}
                    disabled
                  />
                </div>
              </label>
              <p className="admin-field__hint">
                L'adresse email est liée à votre compte et ne peut pas être modifiée.
              </p>
            </div>
          </div>

          {error && (
            <div className="profil-error" role="alert">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12.01" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {error}
            </div>
          )}
          {success && (
            <div className="profil-success" role="status" aria-live="polite">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12l5 5L20 7"/>
              </svg>
              {success}
            </div>
          )}

          <div className="profil-form__actions">
            <button
              type="button"
              className="admin-btn admin-btn--ghost"
              onClick={() => navigate(-1)}
            >
              Annuler
            </button>
            <button
              type="submit"
              className="admin-btn admin-btn--primary"
              disabled={saving}
            >
              {saving ? (
                <span className="profil-spinner" />
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12l5 5L20 7"/>
                  </svg>
                  Enregistrer
                </>
              )}
            </button>
          </div>
        </form>

        {/* Colonne latérale */}
        <aside className="profil-side">
          <section className="profil-card">
            <header className="profil-card__head">
              <span className="profil-card__icon profil-card__icon--soft" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 3v18h18"/>
                  <path d="M7 15l4-6 4 3 5-7"/>
                </svg>
              </span>
              <div className="profil-card__heading">
                <h3>Aperçu du compte</h3>
                <p>État actuel de votre espace gérant.</p>
              </div>
            </header>
            <div className="profil-info">
              <div className="profil-info__item">
                <div className="profil-info__icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
                    <circle cx="12" cy="10" r="3"/>
                  </svg>
                </div>
                <div>
                  <span className="profil-info__label">Marché</span>
                  <span className="profil-info__value">{marketLabel}</span>
                </div>
              </div>
              <div className="profil-info__item">
                <div className="profil-info__icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
                  </svg>
                </div>
                <div>
                  <span className="profil-info__label">Inscrit le</span>
                  <span className="profil-info__value">
                    {gerant?.created_at ? formatDateLong(gerant.created_at) : '—'}
                  </span>
                </div>
              </div>
              <div className="profil-info__item">
                <div className="profil-info__icon">
                  {verified ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--admin-success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                      <polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--admin-ink-faint)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/>
                      <line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                  )}
                </div>
                <div>
                  <span className="profil-info__label">Vérifié</span>
                  <span className="profil-info__value">{verified ? 'Oui' : 'Non'}</span>
                </div>
              </div>
              <div className="profil-info__item">
                <div className="profil-info__icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={premium ? 'var(--admin-warn)' : 'var(--admin-ink-faint)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                </div>
                <div>
                  <span className="profil-info__label">Premium</span>
                  <span className="profil-info__value">{premium ? 'Actif' : 'Inactif'}</span>
                </div>
              </div>
            </div>
          </section>

          <section className="profil-card">
            <header className="profil-card__head">
              <span className="profil-card__icon profil-card__icon--soft" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" rx="1.5"/>
                  <rect x="14" y="3" width="7" height="7" rx="1.5"/>
                  <rect x="3" y="14" width="7" height="7" rx="1.5"/>
                  <rect x="14" y="14" width="7" height="7" rx="1.5"/>
                </svg>
              </span>
              <div className="profil-card__heading">
                <h3>Accès rapide</h3>
                <p>Vos outils de gestion au quotidien.</p>
              </div>
            </header>
            <nav className="profil-links" aria-label="Accès rapide">
              <Link className="profil-link" to={`/${market}/gerant`}>
                <span className="profil-link__icon" aria-hidden="true">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
                    <polyline points="9 22 9 12 15 12 15 22"/>
                  </svg>
                </span>
                <span className="profil-link__text">Tableau de bord</span>
                <svg className="profil-link__chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </Link>
              <Link className="profil-link" to={`/${market}/gerant/chambres`}>
                <span className="profil-link__icon" aria-hidden="true">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 18v-6a2 2 0 012-2h16a2 2 0 012 2v6"/>
                    <path d="M2 18h20M4 10V6a2 2 0 012-2h12a2 2 0 012 2v4"/>
                    <path d="M7 14h2M13 14h4"/>
                  </svg>
                </span>
                <span className="profil-link__text">Mes annonces</span>
                <svg className="profil-link__chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </Link>
              <Link className="profil-link" to={`/${market}/gerant/verification`}>
                <span className="profil-link__icon" aria-hidden="true">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    <polyline points="9 11.5 11 13.5 15 9.5"/>
                  </svg>
                </span>
                <span className="profil-link__text">Vérification</span>
                <svg className="profil-link__chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </Link>
              <Link className="profil-link" to={`/${market}/gerant/premium`}>
                <span className="profil-link__icon" aria-hidden="true">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                </span>
                <span className="profil-link__text">Premium</span>
                <svg className="profil-link__chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </Link>
            </nav>
          </section>
        </aside>
      </div>
    </div>
  );
}

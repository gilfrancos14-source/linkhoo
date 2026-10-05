import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMarket } from '../../contexts/MarketContext';
import { apiGerants, type GerantData } from '../../lib/api';
import { isPremiumActive } from '../../lib/premium';

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
  const marketLabel = market === 'CI' ? "Côte d'Ivoire" : 'Bénin';

  if (loading) {
    return (
      <div className="dash">
        <div className="dash-page-head">
          <h1>Mon profil</h1>
        </div>
        <p style={{ color: 'var(--admin-ink-faint)' }}>Chargement...</p>
      </div>
    );
  }

  return (
    <div className="dash">
      <div className="dash-page-head">
        <h1>Mon profil</h1>
        <p>Gérez vos informations personnelles</p>
      </div>

      {/* Hero band */}
      <section className="profil-hero">
        <div className="profil-hero__bg" />
        <div className="profil-hero__content">
          <div className="profil-avatar">
            {initials ? <span>{initials}</span> : (
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            )}
          </div>
          <div className="profil-hero__info">
            <h2>{gerant?.prenom} {gerant?.nom}</h2>
            <p>{gerant?.email}</p>
          </div>
          <div className="profil-hero__badges">
            {gerant?.is_verified && (
              <span className="profil-badge profil-badge--verified">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12l5 5L20 7"/>
                </svg>
                Vérifié
              </span>
            )}
            {isPremiumActive(gerant) && (
              <span className="profil-badge profil-badge--premium">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
                Premium
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Formulaire */}
      <form className="profil-form" onSubmit={handleSubmit}>
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
        </div>

        <label className="admin-field">
          <span>Téléphone</span>
          <div className="profil-input-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
            </svg>
            <input
              type="tel"
              name="phone"
              value={form.phone}
              onChange={handleChange}
              placeholder="+229 97 00 00 00"
            />
          </div>
        </label>

        <label className="admin-field admin-field--disabled">
          <span>Email</span>
          <input
            type="email"
            value={gerant?.email || ''}
            disabled
          />
        </label>

        {error && (
          <div className="profil-error">{error}</div>
        )}
        {success && (
          <div className="profil-success">{success}</div>
        )}

        <div className="profil-form__actions">
          <button
            type="button"
            className="admin-btn"
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
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12l5 5L20 7"/>
                </svg>
                Enregistrer
              </>
            )}
          </button>
        </div>
      </form>

      {/* Infos compte */}
      <section className="profil-info">
        <div className="profil-info__item">
          <div className="profil-info__icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
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
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
            </svg>
          </div>
          <div>
            <span className="profil-info__label">Inscrit le</span>
            <span className="profil-info__value">
              {gerant?.created_at ? new Date(gerant.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
            </span>
          </div>
        </div>
        <div className="profil-info__item">
          <div className="profil-info__icon">
            {gerant?.is_verified ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--admin-success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--admin-ink-faint)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            )}
          </div>
          <div>
            <span className="profil-info__label">Vérifié</span>
            <span className="profil-info__value">{gerant?.is_verified ? 'Oui' : 'Non'}</span>
          </div>
        </div>
        <div className="profil-info__item">
          <div className="profil-info__icon">
            {isPremiumActive(gerant) ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--admin-warn)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--admin-ink-faint)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
            )}
          </div>
          <div>
            <span className="profil-info__label">Premium</span>
            <span className="profil-info__value">{isPremiumActive(gerant) ? 'Actif' : 'Inactif'}</span>
          </div>
        </div>
      </section>
    </div>
  );
}

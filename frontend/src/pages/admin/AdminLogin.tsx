import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiAdmin, setAdminToken } from '../../lib/adminApi';
import { marketSlugFromPath } from '../../contexts/MarketContext';
import { marketBySlug } from '../../config/markets';

export default function AdminLogin() {
  const { pathname } = useLocation();
  const marketSlug = marketSlugFromPath(pathname);
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Racine /admin (sans segment de marché) : libellé historique par défaut.
  const marketLabel = marketSlug ? marketBySlug(marketSlug)?.label ?? "Côte d'Ivoire" : "Côte d'Ivoire";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token } = await apiAdmin.login(email, password);
      setAdminToken(token);
      navigate(marketSlug ? `/${marketSlug}/admin` : '/admin');
    } catch (err: any) {
      setError(err.message || 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login">
      <div className="admin-login__left">
        <div className="admin-login__brand">
          <h1 className="admin-login__brand-title">Linkhoo</h1>
          <p className="admin-login__brand-subtitle">
            Gérez votre espace {marketLabel}
          </p>
          <ul className="admin-login__features">
            <li>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              Gestion des chambres et catégories
            </li>
            <li>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              Suivi des réservations en temps réel
            </li>
            <li>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              Statistiques et performance
            </li>
          </ul>
        </div>
        <div className="admin-login__left-footer">
          © {new Date().getFullYear()} Linkhoo. Tous droits réservés.
        </div>
      </div>

      <div className="admin-login__right">
        <div className="admin-login__form-wrapper">
          <img src="/logo.jpg" alt="Linkhoo" className="admin-login__mobile-logo" width="140" />
          <div className="admin-login__form-header">
            <h2>Bienvenue</h2>
            <p>Connectez-vous pour accéder au tableau de bord</p>
          </div>

          <form onSubmit={handleSubmit} className="admin-login__form">
            {error && (
              <div className="admin-login__error">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                {error}
              </div>
            )}

            <div className="admin-login__field">
              <label htmlFor="email">Email</label>
              <div className="admin-login__input-wrapper">
                <svg className="admin-login__input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 7L2 7"/></svg>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="admin@linkhoo.com"
                />
              </div>
            </div>

            <div className="admin-login__field">
              <label htmlFor="password">Mot de passe</label>
              <div className="admin-login__input-wrapper">
                <svg className="admin-login__input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className="admin-login__toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
            </div>

            <button type="submit" className="admin-login__btn" disabled={loading}>
              {loading ? (
                <>
                  <span className="admin-login__spinner" />
                  Connexion...
                </>
              ) : (
                'Se connecter'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

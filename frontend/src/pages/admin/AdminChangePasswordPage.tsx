import { useState } from 'react';
import { AlertCircle, CheckCircle2, KeyRound, ShieldCheck } from 'lucide-react';
import { apiAdmin } from '../../lib/adminApi';
import '../../styles/46-admin-password.css';

export default function AdminChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }
    if (newPassword.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    setLoading(true);
    try {
      await apiAdmin.changePassword(currentPassword, newPassword);
      setSuccess('Mot de passe modifié avec succès');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la modification');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dash admin-password-page">
      <div className="dash-page-head">
        <div className="admin-password-page__heading">
          <span className="admin-password-page__icon" aria-hidden="true">
            <KeyRound size={22} strokeWidth={1.8} />
          </span>
          <div>
            <h1>Changer le mot de passe</h1>
            <p>Modifiez votre mot de passe de connexion admin</p>
          </div>
        </div>
      </div>

      <div className="admin-password-layout">
        <section className="panel admin-password-card">
          <div className="panel__head">
            <div>
              <h2>Sécurité du compte</h2>
              <p>Renouvelez votre clé d'accès au back-office.</p>
            </div>
            <span className="admin-password-card__badge">
              <ShieldCheck size={14} aria-hidden="true" /> Compte protégé
            </span>
          </div>

          <form onSubmit={handleSubmit} className="admin-password-form">
            {error && (
              <div className="admin-password-alert admin-password-alert--error" role="alert">
                <AlertCircle size={17} aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="admin-password-alert admin-password-alert--success" role="status">
                <CheckCircle2 size={17} aria-hidden="true" />
                <span>{success}</span>
              </div>
            )}

            <div className="admin-password-field">
              <label htmlFor="current-password">Mot de passe actuel</label>
              <input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="Votre mot de passe actuel"
              />
            </div>

            <div className="admin-password-field">
              <label htmlFor="new-password">Nouveau mot de passe</label>
              <input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                autoComplete="new-password"
                placeholder="Minimum 6 caractères"
              />
              <span className="admin-password-field__hint">
                Utilisez au moins 6 caractères, avec des chiffres et des symboles.
              </span>
            </div>

            <div className="admin-password-field">
              <label htmlFor="confirm-password">Confirmer le mot de passe</label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                placeholder="Répétez le nouveau mot de passe"
              />
            </div>

            <div className="admin-password-actions">
              <button type="submit" className="admin-btn admin-btn--primary" disabled={loading}>
                <KeyRound size={16} aria-hidden="true" />
                {loading ? 'Enregistrement...' : 'Modifier le mot de passe'}
              </button>
            </div>
          </form>
        </section>

        <aside className="panel admin-password-tips">
          <div className="admin-password-tips__icon" aria-hidden="true">
            <ShieldCheck size={22} strokeWidth={1.7} />
          </div>
          <h2>Bonnes pratiques</h2>
          <p className="admin-password-tips__intro">
            Un mot de passe solide protège l'accès aux paiements, aux annonces et aux données des gérants.
          </p>
          <ul className="admin-password-tips__list">
            <li>Utilisez au moins 6 caractères, idéalement 12 ou plus.</li>
            <li>Mélangez majuscules, minuscules, chiffres et symboles.</li>
            <li>Évitez les dates de naissance et les mots du dictionnaire.</li>
            <li>Ne réutilisez pas le mot de passe d'un autre service.</li>
          </ul>
          <div className="admin-password-tips__note">
            Après modification, votre session reste active sur cet appareil. Les autres sessions devront se reconnecter.
          </div>
        </aside>
      </div>
    </div>
  );
}

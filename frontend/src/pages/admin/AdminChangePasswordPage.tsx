import { useState } from 'react';
import { apiAdmin } from '../../lib/adminApi';

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
    <div className="dash">
      <div className="dash-page-head">
        <h1>Changer le mot de passe</h1>
        <p>Modifiez votre mot de passe de connexion admin</p>
      </div>

      <div style={{ maxWidth: '440px' }}>
        <div className="panel" style={{ padding: '24px' }}>
          <form onSubmit={handleSubmit} className="auth-form">
            {error && <div className="auth-error">{error}</div>}
            {success && (
              <div style={{
                background: '#ecfdf5',
                border: '1px solid #6ee7b7',
                color: '#065f46',
                padding: '0.6rem 0.8rem',
                borderRadius: '8px',
                fontSize: '0.82rem',
              }}>
                {success}
              </div>
            )}

            <div className="auth-field">
              <label htmlFor="current-password">Mot de passe actuel</label>
              <input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            <div className="auth-field">
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
            </div>

            <div className="auth-field">
              <label htmlFor="confirm-password">Confirmer le mot de passe</label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>

            <button type="submit" className="auth-btn auth-btn--primary" disabled={loading}>
              {loading ? 'Enregistrement...' : 'Modifier le mot de passe'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

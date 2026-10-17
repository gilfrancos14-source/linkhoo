import type { FormEvent } from 'react';
import Glyph, { glyphUser } from './Glyph';

export interface ProfileFormState {
  nom: string;
  prenom: string;
  telephone: string;
}

/** Panneau « Mon profil » : informations personnelles éditables. */
export default function ProfilePanel({
  profileForm,
  email,
  saving,
  error,
  success,
  onChange,
  onSubmit,
}: {
  profileForm: ProfileFormState;
  email: string;
  saving: boolean;
  error: string;
  success: string;
  onChange: (patch: Partial<ProfileFormState>) => void;
  onSubmit: (e: FormEvent) => void;
}) {
  return (
    <section className="client-compte__panel" id="cp-panel" role="tabpanel">
      <div className="client-compte__profile">
        <div className="client-compte__profile-head">
          <span className="client-compte__profile-icon"><Glyph>{glyphUser}</Glyph></span>
          <div>
            <p className="eyebrow">Informations personnelles</p>
            <h2>Modifier mon profil</h2>
            <p className="client-compte__profile-note">
              Ces informations servent à vous contacter au sujet de vos réservations.
            </p>
          </div>
        </div>

        <form className="client-compte__profile-form" onSubmit={onSubmit}>
          <div className="client-compte__fields">
            <div className="client-compte__field">
              <label htmlFor="cp-prenom">Prénom</label>
              <input
                id="cp-prenom"
                type="text"
                value={profileForm.prenom}
                onChange={(e) => onChange({ prenom: e.target.value })}
                autoComplete="given-name"
              />
            </div>
            <div className="client-compte__field">
              <label htmlFor="cp-nom">Nom</label>
              <input
                id="cp-nom"
                type="text"
                value={profileForm.nom}
                onChange={(e) => onChange({ nom: e.target.value })}
                autoComplete="family-name"
              />
            </div>
            <div className="client-compte__field">
              <label htmlFor="cp-tel">Téléphone</label>
              <input
                id="cp-tel"
                type="tel"
                value={profileForm.telephone}
                onChange={(e) => onChange({ telephone: e.target.value })}
                autoComplete="tel"
              />
            </div>
            <div className="client-compte__field">
              <label htmlFor="cp-email">
                Email
                <span className="client-compte__field-hint">Géré par votre compte</span>
              </label>
              <input id="cp-email" type="email" value={email} disabled />
            </div>
          </div>

          {error && <p className="client-compte__error" role="alert">{error}</p>}
          {success && <p className="client-compte__success" role="status">{success}</p>}

          <div className="client-compte__form-actions">
            <button
              type="submit"
              className="client-compte__btn client-compte__btn--primary"
              disabled={saving}
            >
              {saving ? 'Enregistrement…' : 'Enregistrer les modifications'}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

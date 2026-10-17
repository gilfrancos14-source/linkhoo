import type { ContactErrors, ContactState } from './docs';

interface ContactStepProps {
  contact: ContactState;
  contactErrors: ContactErrors;
  savingContact: boolean;
  email: string;
  onChange: (patch: Partial<ContactState>) => void;
  onContinue: () => void;
}

export default function ContactStep({
  contact,
  contactErrors,
  savingContact,
  email,
  onChange,
  onContinue,
}: ContactStepProps) {
  return (
    <section className="panel verif-panel">
      <div className="panel__head">
        <div className="verif-head">
          <h2>Vos coordonnées</h2>
        </div>
      </div>

      <p className="verif-intro">
        Ces informations permettent à l&apos;équipe de vous contacter au sujet de votre
        dossier de vérification.
      </p>

      <div className="form-grid">
        <label className={`admin-field${contactErrors.nom ? ' admin-field--error' : ''}`}>
          <span>Nom *</span>
          <input
            type="text"
            value={contact.nom}
            onChange={(e) => onChange({ nom: e.target.value })}
            disabled={savingContact}
          />
          {contactErrors.nom && <span className="field-error">{contactErrors.nom}</span>}
        </label>

        <label className={`admin-field${contactErrors.prenom ? ' admin-field--error' : ''}`}>
          <span>Prénom *</span>
          <input
            type="text"
            value={contact.prenom}
            onChange={(e) => onChange({ prenom: e.target.value })}
            disabled={savingContact}
          />
          {contactErrors.prenom && <span className="field-error">{contactErrors.prenom}</span>}
        </label>

        <label className="admin-field">
          <span>Email</span>
          <input type="email" value={email} readOnly disabled />
        </label>

        <label className={`admin-field${contactErrors.phone ? ' admin-field--error' : ''}`}>
          <span>Téléphone *</span>
          <input
            type="tel"
            value={contact.phone}
            placeholder="+225 07 00 00 00"
            onChange={(e) => onChange({ phone: e.target.value })}
            disabled={savingContact}
          />
          {contactErrors.phone && <span className="field-error">{contactErrors.phone}</span>}
        </label>

        <label className={`admin-field admin-field--full${contactErrors.address ? ' admin-field--error' : ''}`}>
          <span>Adresse de domicile *</span>
          <input
            type="text"
            value={contact.address}
            placeholder="Quartier, rue, ville"
            onChange={(e) => onChange({ address: e.target.value })}
            disabled={savingContact}
          />
          {contactErrors.address && <span className="field-error">{contactErrors.address}</span>}
        </label>
      </div>

      <div className="verif-foot">
        <p className="verif-foot__hint">
          L&apos;adresse de domicile n&apos;est visible que par l&apos;équipe de vérification.
        </p>
        <button
          className="admin-btn admin-btn--primary"
          onClick={onContinue}
          disabled={savingContact}
        >
          {savingContact && <span className="verif-spinner" />}
          {savingContact ? 'Enregistrement...' : 'Enregistrer et continuer →'}
        </button>
      </div>
    </section>
  );
}

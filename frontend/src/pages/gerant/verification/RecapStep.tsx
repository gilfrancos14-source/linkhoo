import type { VerificationStatusResponse } from '../../../lib/api';
import {
  DOC_LABELS,
  DOC_ORDER,
  type ContactState,
  type DocType,
  type UploadState,
} from './docs';

interface RecapStepProps {
  contact: ContactState;
  email: string;
  uploads: Record<DocType, UploadState>;
  hasBothDocs: boolean;
  hasAddress: boolean;
  verificationStatus: VerificationStatusResponse | null;
  isReady: boolean;
  online: boolean;
  submitting: boolean;
  onBack: () => void;
  onSubmit: () => void;
}

export default function RecapStep({
  contact,
  email,
  uploads,
  hasBothDocs,
  hasAddress,
  verificationStatus,
  isReady,
  online,
  submitting,
  onBack,
  onSubmit,
}: RecapStepProps) {
  return (
    <section className="panel verif-panel">
      <div className="panel__head">
        <div className="verif-head">
          <h2>Récapitulatif et envoi</h2>
          <span className="verif-fee">Gratuit</span>
        </div>
      </div>

      <p className="verif-intro">
        Vérifiez le récapitulatif ci-dessous avant d&apos;envoyer votre demande.
        Un administrateur examinera vos documents.
      </p>

      <div className="verif-recap">
        <div className="verif-recap__section">
          <h3 className="verif-recap__title">Coordonnées</h3>
          <dl className="verif-recap__list">
            <div className="verif-recap__row">
              <dt>Nom</dt>
              <dd>{contact.nom} {contact.prenom}</dd>
            </div>
            <div className="verif-recap__row">
              <dt>Email</dt>
              <dd>{email || '—'}</dd>
            </div>
            <div className="verif-recap__row">
              <dt>Téléphone</dt>
              <dd>{contact.phone}</dd>
            </div>
            <div className="verif-recap__row">
              <dt>Adresse de domicile</dt>
              <dd>{contact.address}</dd>
            </div>
          </dl>
        </div>

        <div className="verif-recap__section">
          <h3 className="verif-recap__title">Documents</h3>
          <dl className="verif-recap__list">
            {DOC_ORDER.map((docType) => {
              const doc = uploads[docType].uploaded;
              return (
                <div className="verif-recap__row" key={docType}>
                  <dt>{DOC_LABELS[docType].title}</dt>
                  <dd>
                    <span
                      className={`admin-badge ${doc ? 'admin-badge--success' : 'admin-badge--warning'}`}
                    >
                      <span className="badge-dot"></span>
                      {doc ? 'Déposé' : 'Manquant'}
                    </span>
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>

        <div className="verif-recap__section">
          <h3 className="verif-recap__title">Adresse de l&apos;appartement</h3>
          <dl className="verif-recap__list">
            <div className="verif-recap__row">
              <dt>Google Maps</dt>
              <dd>
                {hasAddress && verificationStatus?.property_maps_url ? (
                  <a
                    className="verif-address__link"
                    href={verificationStatus.property_maps_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Ouvrir dans Google Maps ↗
                  </a>
                ) : (
                  'Non enregistrée'
                )}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="verif-fee-note">
        <span className="verif-fee-note__icon" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="16" x2="12" y2="12"/>
            <line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
        </span>
        <span>
          La vérification est <strong>gratuite</strong>. Une fois la demande envoyée,
          votre dossier passe en examen.
        </span>
      </div>

      <div className="verif-foot">
        <button className="admin-btn" onClick={onBack}>
          ← Retour
        </button>
        <p className={`verif-foot__hint${isReady && online ? ' verif-foot__hint--ready' : ''}`}>
          {!online
            ? 'Connexion requise pour envoyer votre demande.'
            : isReady
              ? 'Dossier complet. Vous pouvez envoyer votre demande.'
              : !hasBothDocs
                ? 'Les 2 faces de la carte sont requises.'
                : 'L\'adresse Google Maps est requise.'}
        </p>
        <button
          className="admin-btn admin-btn--primary"
          onClick={onSubmit}
          disabled={!isReady || submitting || !online}
        >
          {submitting && <span className="verif-spinner" />}
          {submitting ? 'Envoi en cours...' : 'Soumettre ma demande'}
        </button>
      </div>
    </section>
  );
}

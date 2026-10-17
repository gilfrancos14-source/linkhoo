import { Link } from 'react-router-dom';
import type { VerificationStatusResponse } from '../../../lib/api';
import { formatDate } from '../../../lib/formatDate';

interface PendingSectionProps {
  status: 'pending' | 'under_review';
  verificationStatus: VerificationStatusResponse | null;
  gerantPath: string;
}

export default function PendingSection({ status, verificationStatus, gerantPath }: PendingSectionProps) {
  return (
    <section className="verif-wait">
      <div className={`verif-wait__hero${status === 'under_review' ? ' verif-wait__hero--review' : ''}`}>
        <div className="verif-wait__glow" aria-hidden="true" />
        <div className="verif-wait__pattern" aria-hidden="true" />
        <div className="verif-wait__seal" aria-hidden="true">
          <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h5"/>
            <path d="M14 2v6h6"/>
            <circle cx="17" cy="17" r="4.5"/>
            <path d="M17 15v2l1.5 1.5"/>
          </svg>
        </div>
        <div className="verif-wait__copy">
          <span className="verif-wait__eyebrow">
            <span className="verif-wait__dot" aria-hidden="true" />
            Vérification d&apos;identité
          </span>
          <h3>Demande en cours</h3>
          <p>
            {status === 'under_review'
              ? 'Un administrateur examine vos documents.'
              : 'Votre dossier a bien été reçu. Le traitement suit son cours.'}
          </p>
          <div className="verif-wait__chips">
            <span className="verif-wait__chip verif-wait__chip--live">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {status === 'under_review' ? (
                  <>
                    <circle cx="11" cy="11" r="7"/>
                    <line x1="16.5" y1="16.5" x2="21" y2="21"/>
                  </>
                ) : (
                  <>
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                  </>
                )}
              </svg>
              {status === 'under_review' ? 'Sous le contrôle de notre équipe' : 'Reçue par nos équipes'}
            </span>
            {verificationStatus?.verification_submitted_at && (
              <span className="verif-wait__chip">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                Soumise le {formatDate(verificationStatus.verification_submitted_at)}
              </span>
            )}
          </div>
        </div>
      </div>

      <ol className="verif-wait__timeline" aria-label="Étapes de la vérification">
        <li className="verif-wait__step verif-wait__step--done">
          <span className="verif-wait__step-badge" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12l5 5L20 7"/>
            </svg>
          </span>
          <div className="verif-wait__step-body">
            <h4>Dossier envoyé</h4>
            <p>Le recto, le verso de votre pièce et l&apos;adresse du logement nous sont bien parvenus.</p>
          </div>
        </li>
        <li
          className={`verif-wait__step ${
            status === 'under_review'
              ? 'verif-wait__step--active'
              : 'verif-wait__step--current'
          }`}
        >
          <span className="verif-wait__step-badge" aria-hidden="true">
            {status === 'under_review' ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7"/>
                <line x1="16.5" y1="16.5" x2="21" y2="21"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9"/>
                <polyline points="12 7 12 12 15.5 14"/>
              </svg>
            )}
          </span>
          <div className="verif-wait__step-body">
            <h4>{status === 'under_review' ? 'Examen en cours' : 'Vérification à venir'}</h4>
            <p>
              {status === 'under_review'
                ? 'Un administrateur contrôle la conformité de vos documents et de votre adresse.'
                : 'Votre dossier est en file d\'attente et sera examiné très prochainement.'}
            </p>
          </div>
        </li>
        <li className="verif-wait__step verif-wait__step--upcoming">
          <span className="verif-wait__step-badge" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 01-3.46 0"/>
            </svg>
          </span>
          <div className="verif-wait__step-body">
            <h4>Décision</h4>
            <p>Vous serez notifié dès que votre identité sera confirmée par notre équipe.</p>
          </div>
        </li>
      </ol>

      <div className="verif-wait__note">
        <span className="verif-wait__note-icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="16" x2="12" y2="12"/>
            <line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
        </span>
        <div>
          <h4>Que se passe-t-il ensuite ?</h4>
          <p>
            Dès la validation, votre badge <strong>vérifié</strong> sera activé et la publication
            de vos annonces débloquée. Vous pouvez en attendant consulter votre tableau de bord.
          </p>
        </div>
      </div>

      <div className="verif-wait__actions">
        <Link className="admin-btn verif-done__cta" to={gerantPath}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="3" width="7" height="9" rx="1"/>
            <rect x="14" y="3" width="7" height="5" rx="1"/>
            <rect x="14" y="12" width="7" height="9" rx="1"/>
            <rect x="3" y="16" width="7" height="5" rx="1"/>
          </svg>
          Tableau de bord
        </Link>
        <Link className="admin-btn verif-done__cta" to={`${gerantPath}/chambres`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 21V7a2 2 0 012-2h6a2 2 0 012 2v14"/>
            <path d="M13 21V11a2 2 0 012-2h4a2 2 0 012 2v10"/>
            <path d="M3 21h18"/>
          </svg>
          Mes chambres
        </Link>
      </div>
    </section>
  );
}

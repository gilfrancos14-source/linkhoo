import { Link } from 'react-router-dom';
import type { VerificationStatusResponse } from '../../../lib/api';
import { marketByCode, type MarketCode } from '../../../config/markets';
import { DOC_LABELS, DOC_ORDER, type DocType, type UploadState } from './docs';

interface VerifiedSectionProps {
  market: MarketCode;
  gerantPath: string;
  verifiedDate: string | null;
  uploads: Record<DocType, UploadState>;
  hasAddress: boolean;
  verificationStatus: VerificationStatusResponse | null;
}

export default function VerifiedSection({
  market,
  gerantPath,
  verifiedDate,
  uploads,
  hasAddress,
  verificationStatus,
}: VerifiedSectionProps) {
  return (
    <section className="verif-done">
      <div className="verif-done__hero">
        <div className="verif-done__glow" aria-hidden="true" />
        <div className="verif-done__pattern" aria-hidden="true" />
        <div className="verif-done__seal" aria-hidden="true">
          <svg width="54" height="54" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            <path d="M9 12l2 2 4-4"/>
          </svg>
        </div>
        <div className="verif-done__copy">
          <span className="verif-done__eyebrow">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12l5 5L20 7"/>
            </svg>
            Identité confirmée
          </span>
          <h3>Compte vérifié</h3>
          <p>Vous pouvez désormais créer et gérer vos annonces.</p>
          <div className="verif-done__chips">
            <span className="verif-done__chip">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              Badge vérifié actif
            </span>
            {verifiedDate && (
              <span className="verif-done__chip">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
                </svg>
                Vérifié le {verifiedDate}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="verif-done__grid">
        <article className="verif-done__perk">
          <span className="verif-done__perk-icon verif-done__perk-icon--trust" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <path d="M9 12l2 2 4-4"/>
            </svg>
          </span>
          <div>
            <h4 className="verif-done__perk-title">Confiance immédiate</h4>
            <p className="verif-done__perk-desc">Votre badge vérifié rassure les voyageurs avant même leur première réservation.</p>
          </div>
        </article>

        <article className="verif-done__perk">
          <span className="verif-done__perk-icon verif-done__perk-icon--publish" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </span>
          <div>
            <h4 className="verif-done__perk-title">Annonces publiées</h4>
            <p className="verif-done__perk-desc">Publiez vos annonces sur le marché {marketByCode(market).label}, sans limite.</p>
          </div>
        </article>

        <article className="verif-done__perk">
          <span className="verif-done__perk-icon verif-done__perk-icon--grow" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
              <polyline points="17 6 23 6 23 12"/>
            </svg>
          </span>
          <div>
            <h4 className="verif-done__perk-title">Outils de croissance</h4>
            <p className="verif-done__perk-desc">Réservations, boosts et statistiques : tout pour remplir votre calendrier.</p>
          </div>
        </article>
      </div>

      {(DOC_ORDER.some((t) => uploads[t].uploaded) || hasAddress) && (
        <div className="verif-done__panel">
          <header className="verif-done__panel-head">
            <span className="verif-done__panel-icon" aria-hidden="true">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/>
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
                <path d="M9 14l2 2 4-4"/>
              </svg>
            </span>
            <div>
              <h4>Dossier vérifié</h4>
              <p>Les éléments validés par notre équipe.</p>
            </div>
          </header>
          <ul className="verif-done__list">
            {DOC_ORDER.map((docType) => {
              const doc = uploads[docType].uploaded;
              if (!doc) return null;
              return (
                <li className="verif-done__item" key={docType}>
                  <span className="verif-done__check" aria-hidden="true">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12l5 5L20 7"/>
                    </svg>
                  </span>
                  <span className="verif-done__item-label">{DOC_LABELS[docType].title}</span>
                  <span className={`admin-badge ${doc.status === 'approved' ? 'admin-badge--success' : doc.status === 'rejected' ? 'admin-badge--danger' : 'admin-badge--warning'}`}>
                    <span className="badge-dot"></span>
                    {doc.status === 'approved' ? 'Validé' : doc.status === 'rejected' ? 'Rejeté' : 'Déposé'}
                  </span>
                </li>
              );
            })}
            {hasAddress && verificationStatus?.property_maps_url && (
              <li className="verif-done__item">
                <span className="verif-done__check" aria-hidden="true">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12l5 5L20 7"/>
                  </svg>
                </span>
                <span className="verif-done__item-label">Adresse Google Maps</span>
                <a
                  className="verif-done__link"
                  href={verificationStatus.property_maps_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Ouvrir dans Google Maps ↗
                </a>
              </li>
            )}
          </ul>
        </div>
      )}

      <div className="verif-done__actions">
        <Link className="admin-btn admin-btn--primary verif-done__cta" to={`${gerantPath}/chambres/ajouter`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Publier une annonce
        </Link>
        <Link className="admin-btn verif-done__cta" to={`${gerantPath}/reservations`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
          </svg>
          Voir les réservations
        </Link>
      </div>
    </section>
  );
}

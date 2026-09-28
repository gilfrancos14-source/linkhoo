import { useState, useEffect } from 'react';
import { apiAdmin, type AdminGerant } from '../lib/adminApi';
import type { VerificationDocument, VerificationDocType } from '../lib/api';
import PropertyMap from './PropertyMap';

const DOC_LABELS: Record<VerificationDocType, string> = {
  id_card_front: 'Carte d\'identité — Recto',
  id_card_back: 'Carte d\'identité — Verso',
  national_id: 'Pièce d\'identité',
  selfie: 'Selfie',
};

const NEW_DOC_ORDER: VerificationDocType[] = ['id_card_front', 'id_card_back'];
const LEGACY_DOC_ORDER: VerificationDocType[] = ['national_id', 'selfie'];

interface AdminGerantDrawerProps {
  gerant: AdminGerant;
  onClose: () => void;
  onUpdated: (gerant: AdminGerant) => void;
}

export default function AdminGerantDrawer({ gerant, onClose, onUpdated }: AdminGerantDrawerProps) {
  const [documents, setDocuments] = useState<VerificationDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [docRejectReason, setDocRejectReason] = useState('');
  const [showDocRejectInput, setShowDocRejectInput] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    loadDocuments();
  }, [gerant.id]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 300);
  };

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const docs = await apiAdmin.getVerificationDocuments(gerant.id);
      setDocuments(docs);
    } catch {
      setError('Erreur lors du chargement des documents');
    } finally {
      setLoading(false);
    }
  };

  const handleStartReview = async () => {
    setActionLoading('start-review');
    try {
      const updated = await apiAdmin.startGerantReview(gerant.id);
      onUpdated(updated);
    } catch (err: any) {
      setError(err.message || 'Erreur');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReviewDocument = async (docId: string, status: 'approved' | 'rejected', reason?: string) => {
    setActionLoading(docId);
    try {
      const updated = await apiAdmin.reviewDocument(docId, status, reason);
      setDocuments((prev) => prev.map((d) => (d.id === docId ? updated : d)));
      setShowDocRejectInput(null);
      setDocRejectReason('');
    } catch (err: any) {
      setError(err.message || 'Erreur');
    } finally {
      setActionLoading(null);
    }
  };

  const handleApprove = async () => {
    setActionLoading('approve');
    try {
      const updated = await apiAdmin.approveGerantVerification(gerant.id);
      onUpdated(updated);
      handleClose();
    } catch (err: any) {
      setError(err.message || 'Erreur');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return;
    setActionLoading('reject');
    try {
      const updated = await apiAdmin.rejectGerantVerification(gerant.id, rejectReason);
      onUpdated(updated);
      handleClose();
    } catch (err: any) {
      setError(err.message || 'Erreur');
    } finally {
      setActionLoading(null);
    }
  };

  const frontDoc = documents.find((d) => d.document_type === 'id_card_front');
  const backDoc = documents.find((d) => d.document_type === 'id_card_back');
  const legacyIdDoc = documents.find((d) => d.document_type === 'national_id');
  const legacySelfieDoc = documents.find((d) => d.document_type === 'selfie');
  const hasNewPair = Boolean(frontDoc && backDoc);
  const hasLegacyPair = Boolean(legacyIdDoc && legacySelfieDoc);
  const allApproved = hasNewPair
    ? frontDoc!.status === 'approved' && backDoc!.status === 'approved'
    : hasLegacyPair
      ? legacyIdDoc!.status === 'approved' && legacySelfieDoc!.status === 'approved'
      : false;
  const hasPending = gerant.verification_status === 'pending' || gerant.verification_status === 'under_review';
  const hasAddress = gerant.property_lat != null && gerant.property_lng != null && Boolean(gerant.property_maps_url);
  const orderedDocs = hasNewPair
    ? NEW_DOC_ORDER.map((t) => documents.find((d) => d.document_type === t)).filter(Boolean) as VerificationDocument[]
    : hasLegacyPair
      ? LEGACY_DOC_ORDER.map((t) => documents.find((d) => d.document_type === t)).filter(Boolean) as VerificationDocument[]
      : documents;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, pointerEvents: visible ? 'auto' : 'none' }}>
      <div
        onClick={handleClose}
        style={{
          position: 'absolute', inset: 0, background: '#00000040',
          opacity: visible ? 1 : 0, transition: 'opacity 0.3s ease',
        }}
      />
      <div style={{
        position: 'absolute', top: 0, right: 0, bottom: 0, width: '480px', maxWidth: '100%',
        background: '#fff', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
        transform: visible ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>

        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--admin-line)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>
              {gerant.prenom} {gerant.nom}
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--admin-ink-soft)' }}>{gerant.email}</p>
            <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
              <span className={`admin-badge ${gerant.market === 'CI' ? 'admin-badge--info' : 'admin-badge--success'}`}>{gerant.market}</span>
              <span className={`admin-badge ${gerant.is_verified ? 'admin-badge--success' : gerant.verification_status === 'pending' ? 'admin-badge--warning' : gerant.verification_status === 'under_review' ? 'admin-badge--info' : 'admin-badge--danger'}`}>
                {gerant.is_verified ? 'Vérifié' : gerant.verification_status === 'pending' ? 'En attente' : gerant.verification_status === 'under_review' ? 'En révision' : gerant.verification_status === 'rejected' ? 'Rejeté' : 'Non vérifié'}
              </span>
            </div>
          </div>
          <button onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--admin-ink-soft)', flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
          {error && <div className="auth-error" style={{ marginBottom: '12px' }}>{error}</div>}

          <div style={{ border: '1px solid var(--admin-line)', borderRadius: '10px', padding: '16px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Position de l&apos;appartement</h3>
              {hasAddress ? (
                <span className="admin-badge admin-badge--success">
                  <span className="badge-dot"></span>
                  Fournie
                </span>
              ) : (
                <span className="admin-badge admin-badge--danger">
                  <span className="badge-dot"></span>
                  Absente
                </span>
              )}
            </div>

            {hasAddress ? (
              <>
                <PropertyMap
                  lat={gerant.property_lat!}
                  lng={gerant.property_lng!}
                  mapsUrl={gerant.property_maps_url}
                  height={240}
                  interactive={false}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginTop: '10px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '12px', color: 'var(--admin-ink-soft)', fontVariantNumeric: 'tabular-nums' }}>
                    {gerant.property_lat!.toFixed(5)}, {gerant.property_lng!.toFixed(5)}
                  </span>
                  <a
                    href={gerant.property_maps_url || undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="admin-btn admin-btn--sm"
                    style={{ textDecoration: 'none' }}
                  >
                    Ouvrir dans Google Maps ↗
                  </a>
                </div>
              </>
            ) : (
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--admin-ink-soft)' }}>
                Adresse non fournie par le gérant.
              </p>
            )}
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0', color: 'var(--admin-ink-soft)' }}>Chargement...</div>
          ) : orderedDocs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--admin-ink-soft)' }}>Aucun document soumis.</div>
          ) : (
            <div style={{ display: 'grid', gap: '16px' }}>
              {orderedDocs.map((doc) => (
                <div key={doc.id} style={{ border: '1px solid var(--admin-line)', borderRadius: '10px', padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>
                      {DOC_LABELS[doc.document_type] || doc.document_type}
                    </h3>
                    <span className={`admin-badge ${doc.status === 'approved' ? 'admin-badge--success' : doc.status === 'rejected' ? 'admin-badge--danger' : 'admin-badge--warning'}`}>
                      <span className="badge-dot"></span>
                      {doc.status === 'approved' ? 'Approuvé' : doc.status === 'rejected' ? 'Rejeté' : 'En attente'}
                    </span>
                  </div>

                  <div style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--admin-line)', marginBottom: '12px' }}>
                    {doc.mime_type?.startsWith('image/') ? (
                      <img src={doc.file_url} alt={doc.document_type} style={{ width: '100%', maxHeight: '300px', objectFit: 'contain', background: '#f8fafc' }} />
                    ) : (
                      <div style={{ height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', color: '#64748b', fontSize: '13px' }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
                          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                        </svg>
                        {doc.original_filename || 'Document'}
                      </div>
                    )}
                  </div>

                  {doc.status === 'rejected' && doc.rejection_reason && (
                    <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#DC2626' }}>Raison du rejet : {doc.rejection_reason}</p>
                  )}

                  {hasPending && doc.status === 'pending' && (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button className="admin-btn admin-btn--success admin-btn--sm" onClick={() => handleReviewDocument(doc.id, 'approved')} disabled={actionLoading === doc.id}>
                        {actionLoading === doc.id ? '...' : 'Approuver'}
                      </button>
                      {showDocRejectInput === doc.id ? (
                        <div style={{ display: 'flex', gap: '6px', flex: 1, minWidth: '200px' }}>
                          <input type="text" className="admin-field__input" placeholder="Raison du rejet..." value={docRejectReason} onChange={(e) => setDocRejectReason(e.target.value)}
                            style={{ flex: 1, fontSize: '13px', padding: '6px 10px', border: '1px solid var(--admin-line)', borderRadius: '6px' }} />
                          <button className="admin-btn admin-btn--danger admin-btn--sm" onClick={() => { if (docRejectReason.trim()) handleReviewDocument(doc.id, 'rejected', docRejectReason); }}
                            disabled={!docRejectReason.trim() || actionLoading === doc.id} style={{ fontSize: '12px' }}>Confirmer</button>
                          <button className="admin-btn admin-btn--sm" onClick={() => { setShowDocRejectInput(null); setDocRejectReason(''); }} style={{ fontSize: '12px' }}>Annuler</button>
                        </div>
                      ) : (
                        <button className="admin-btn admin-btn--danger admin-btn--sm" onClick={() => setShowDocRejectInput(doc.id)}>Rejeter</button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {hasPending && orderedDocs.length > 0 && (
          <div style={{ padding: '16px 24px', borderTop: '1px solid var(--admin-line)', flexShrink: 0 }}>
            {showRejectInput ? (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Raison du rejet</label>
                  <input type="text" className="admin-field__input" placeholder="Expliquez pourquoi la demande est rejetée..." value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
                    style={{ width: '100%', fontSize: '13px', padding: '8px 12px', border: '1px solid var(--admin-line)', borderRadius: '6px' }} />
                </div>
                <div style={{ display: 'flex', gap: '6px', marginTop: '20px' }}>
                  <button className="admin-btn admin-btn--danger" onClick={handleReject} disabled={!rejectReason.trim() || actionLoading === 'reject'}>
                    {actionLoading === 'reject' ? '...' : 'Confirmer'}
                  </button>
                  <button className="admin-btn" onClick={() => { setShowRejectInput(false); setRejectReason(''); }}>Annuler</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                {gerant.verification_status === 'pending' && (
                  <button className="admin-btn" onClick={handleStartReview} disabled={actionLoading === 'start-review'}>
                    {actionLoading === 'start-review' ? '...' : 'Commencer la révision'}
                  </button>
                )}
                <button className="admin-btn admin-btn--success" onClick={handleApprove} disabled={!allApproved || !hasAddress || actionLoading === 'approve'}
                  title={!hasAddress ? 'Adresse Google Maps manquante' : !allApproved ? 'Les 2 documents doivent être approuvés' : undefined}>
                  {actionLoading === 'approve' ? '...' : 'Approuver'}
                </button>
                <button className="admin-btn admin-btn--danger" onClick={() => setShowRejectInput(true)}>
                  Rejeter
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

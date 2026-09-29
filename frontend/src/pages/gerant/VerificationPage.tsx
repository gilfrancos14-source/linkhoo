import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useMarket } from '../../contexts/MarketContext';
import { apiGerants, apiUpload, request, type GerantData, type VerificationDocument, type VerificationStatusResponse } from '../../lib/api';
import PropertyMap from '../../components/PropertyMap';

type DocType = 'id_card_front' | 'id_card_back';

interface UploadState {
  file: File | null;
  preview: string | null;
  uploading: boolean;
  uploaded: VerificationDocument | null;
  error: string | null;
}

const DOC_LABELS: Record<DocType, { title: string; description: string; accept: string; hint: string }> = {
  id_card_front: {
    title: 'Carte d\'identité — Recto',
    description: 'Photo du recto de votre carte nationale d\'identité',
    accept: 'image/*',
    hint: 'JPG ou PNG · 4 coins visibles, texte lisible',
  },
  id_card_back: {
    title: 'Carte d\'identité — Verso',
    description: 'Photo du verso de votre carte nationale d\'identité',
    accept: 'image/*',
    hint: 'JPG ou PNG · 4 coins visibles, texte lisible',
  },
};

const DOC_ORDER: DocType[] = ['id_card_front', 'id_card_back'];

function DocIndex({ index }: { index: number }) {
  return <span className="verif-doc__num">{String(index).padStart(2, '0')}</span>;
}

interface AddressState {
  url: string;
  saving: boolean;
  error: string | null;
}

interface ManualCoords {
  lat: number;
  lng: number;
}

export default function VerificationPage() {
  const { market } = useMarket();
  const { userId } = useAuth();
  const [gerant, setGerant] = useState<GerantData | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploads, setUploads] = useState<Record<DocType, UploadState>>({
    id_card_front: { file: null, preview: null, uploading: false, uploaded: null, error: null },
    id_card_back: { file: null, preview: null, uploading: false, uploaded: null, error: null },
  });
  const [dragging, setDragging] = useState<DocType | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const confirmRanRef = useRef(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [address, setAddress] = useState<AddressState>({
    url: '',
    saving: false,
    error: null,
  });
  const [manualMode, setManualMode] = useState(false);
  const [manualCoords, setManualCoords] = useState<ManualCoords | null>(null);

  const loadData = useCallback(async () => {
    try {
      const g = await apiGerants.getMe();
      setGerant(g);
      const status = await apiGerants.getVerificationStatus(g.id);
      setVerificationStatus(status);

      const docMap: Record<string, VerificationDocument> = {};
      for (const doc of status.documents) {
        docMap[doc.document_type] = doc;
      }

      setUploads({
        id_card_front: {
          file: null,
          preview: null,
          uploading: false,
          uploaded: docMap['id_card_front'] || null,
          error: null,
        },
        id_card_back: {
          file: null,
          preview: null,
          uploading: false,
          uploaded: docMap['id_card_back'] || null,
          error: null,
        },
      });

      setAddress({
        url: status.property_maps_url || '',
        saving: false,
        error: null,
      });
      setManualMode(false);
      setManualCoords(null);
    } catch (err) {
      console.error('[Verification] Load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!userId) return;
    loadData();
  }, [userId]);

  const handleFileSelect = (docType: DocType, file: File) => {
    if (uploads[docType].uploaded) return;
    const preview = URL.createObjectURL(file);
    setUploads((prev) => ({
      ...prev,
      [docType]: { ...prev[docType], file, preview, error: null },
    }));
  };

  const handleRemoveFile = (docType: DocType) => {
    if (uploads[docType].preview) {
      URL.revokeObjectURL(uploads[docType].preview);
    }
    setUploads((prev) => ({
      ...prev,
      [docType]: { file: null, preview: null, error: null },
    }));
  };

  const handleDrop = (docType: DocType, e: React.DragEvent) => {
    e.preventDefault();
    setDragging(null);
    if (uploads[docType].uploaded) return;
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleFileSelect(docType, file);
    }
  };

  const handleUpload = async (docType: DocType) => {
    const state = uploads[docType];
    if (!state.file || !gerant) return;

    setUploads((prev) => ({
      ...prev,
      [docType]: { ...prev[docType], uploading: true, error: null },
    }));

    try {
      const result = await apiUpload.upload(state.file, 'verification-docs');
      const savedDoc = await request<VerificationDocument>(`/gerants/${gerant.id}/documents`, {
        method: 'POST',
        body: JSON.stringify({
          document_type: docType,
          file_url: result.url,
          file_path: result.path,
          original_filename: state.file.name,
          mime_type: state.file.type,
          file_size: state.file.size,
        }),
      });

      setUploads((prev) => ({
        ...prev,
        [docType]: {
          file: null,
          preview: null,
          uploading: false,
          uploaded: savedDoc,
          error: null,
        },
      }));
    } catch (err: any) {
      setUploads((prev) => ({
        ...prev,
        [docType]: { ...prev[docType], uploading: false, error: err.message || 'Erreur lors de l\'upload' },
      }));
    }
  };

  const handleDeleteDocument = async (docType: DocType) => {
    const doc = uploads[docType].uploaded;
    if (!doc || !gerant) return;

    try {
      await apiGerants.deleteDocument(gerant.id, doc.id);
      setUploads((prev) => ({
        ...prev,
        [docType]: { ...prev[docType], uploaded: null },
      }));
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la suppression');
    }
  };

  const handleSaveAddress = async () => {
    if (!gerant || !address.url.trim()) return;
    setAddress((prev) => ({ ...prev, saving: true, error: null }));
    setManualMode(false);
    setManualCoords(null);
    try {
      await apiGerants.setPropertyAddress(gerant.id, address.url.trim());
      const status = await apiGerants.getVerificationStatus(gerant.id);
      setVerificationStatus(status);
      setAddress({
        url: status.property_maps_url || address.url.trim(),
        saving: false,
        error: null,
      });
      setSuccess('');
    } catch (err: any) {
      const message = err.message || 'Lien Google Maps non reconnu';
      setAddress((prev) => ({
        ...prev,
        saving: false,
        error: message,
      }));
      // Fallback : proposer de placer le pin manuellement
      if (/non reconnu|non reconnue|placez le marqueur/i.test(message)) {
        setManualMode(true);
        setManualCoords(null);
      }
    }
  };

  const handleSaveManualPosition = async () => {
    if (!gerant || !manualCoords || !address.url.trim()) return;
    setAddress((prev) => ({ ...prev, saving: true, error: null }));
    try {
      await apiGerants.setPropertyAddress(gerant.id, address.url.trim(), manualCoords.lat, manualCoords.lng);
      const status = await apiGerants.getVerificationStatus(gerant.id);
      setVerificationStatus(status);
      setAddress({
        url: status.property_maps_url || address.url.trim(),
        saving: false,
        error: null,
      });
      setManualMode(false);
      setManualCoords(null);
    } catch (err: any) {
      setAddress((prev) => ({
        ...prev,
        saving: false,
        error: err.message || 'Erreur lors de l\'enregistrement de la position',
      }));
    }
  };

  const manualFallbackCenter: ManualCoords =
    market === 'BJ' ? { lat: 6.3703, lng: 2.3912 } : { lat: 5.36, lng: -4.008 };

  const handleSubmit = async () => {
    if (!gerant) return;
    setSubmitting(true);
    setError('');
    try {
      const result = await apiGerants.submitVerification(gerant.id);
      window.location.href = result.payment_url;
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la soumission');
      setSubmitting(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!gerant) return;
    const urlParams = new URLSearchParams(window.location.search);
    const transactionId = urlParams.get('id');
    if (!transactionId) return;

    setConfirming(true);
    try {
      await apiGerants.confirmVerification(gerant.id, Number(transactionId));
      setSuccess('Paiement confirmé. Votre dossier passe en examen.');
      loadData();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la confirmation du paiement');
    } finally {
      setConfirming(false);
    }
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const transactionId = urlParams.get('id');
    if (!transactionId || !gerant) return;
    // Verrou : loadData() rappelé après la confirmation crée un nouvel objet
    // gerant, ce qui relancerait l’effet et reconfirmerait en boucle tant que
    // ?id= reste dans l’URL.
    if (confirmRanRef.current) return;
    confirmRanRef.current = true;
    handleConfirmPayment();
  }, [gerant]);

  const hasBothDocs = Boolean(uploads.id_card_front.uploaded && uploads.id_card_back.uploaded);
  const hasAddress = Boolean(
    verificationStatus?.property_lat != null &&
      verificationStatus?.property_lng != null &&
      verificationStatus?.property_maps_url
  );
  const isReady = hasBothDocs && hasAddress;
  const status = verificationStatus?.verification_status || 'none';
  const showForm = status === 'none' || status === 'rejected';

  if (loading) {
    return (
      <div className="dash">
        <div className="dash-page-head">
          <h1>Vérification</h1>
          <p>Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dash">
      <div className="dash-page-head">
        <h1>Vérification</h1>
        <p>Confirmez votre identité pour publier des annonces sur le marché {market}.</p>
      </div>

      {error && <div className="verif-alert verif-alert--danger">{error}</div>}
      {success && <div className="verif-alert verif-alert--success">{success}</div>}
      {confirming && <div className="verif-alert verif-alert--info">Confirmation du paiement...</div>}

      {status === 'approved' ? (
        <section className="verify-cta verify-cta--done">
          <div className="verify-cta__icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <path d="M9 12l2 2 4-4"/>
            </svg>
          </div>
          <div className="verify-cta__text">
            <h3>Compte vérifié</h3>
            <p>Vous pouvez désormais créer et gérer vos annonces.</p>
          </div>
        </section>
      ) : status === 'pending' || status === 'under_review' ? (
        <section className="verify-cta">
          <div className="verify-cta__icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <div className="verify-cta__text">
            <h3>Demande en cours</h3>
            <p>
              {status === 'under_review'
                ? 'Un administrateur examine vos documents.'
                : 'Votre dossier a bien été reçu. Le traitement suit son cours.'}
            </p>
            {verificationStatus?.verification_submitted_at && (
              <span className="verify-cta__meta">
                Soumise le {new Date(verificationStatus.verification_submitted_at).toLocaleDateString('fr-FR')}
              </span>
            )}
          </div>
        </section>
      ) : status === 'rejected' ? (
        <section className="verify-cta verify-cta--danger">
          <div className="verify-cta__icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="15" y1="9" x2="9" y2="15"/>
              <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
          </div>
          <div className="verify-cta__text">
            <h3>Demande rejetée</h3>
            <p>{verificationStatus?.verification_rejection_reason || 'Les documents soumis n\'ont pas été acceptés.'}</p>
            <span className="verify-cta__meta">Vous pouvez téléverser de nouveaux documents ci-dessous.</span>
          </div>
        </section>
      ) : null}

      {showForm && (
        <div className="steps verif-steps">
          <div className={`step ${!isReady ? 'step--active' : 'step--done'}`}>
            <span className="step__num">{isReady ? '' : '1'}</span>
            <span className="step__label">Documents + adresse</span>
          </div>
          <div className={`step ${isReady ? 'step--active' : ''}`}>
            <span className="step__num">2</span>
            <span className="step__label">Paiement</span>
          </div>
        </div>
      )}

      {showForm && (
        <section className="panel verif-panel">
          <div className="panel__head">
            <div className="verif-head">
              <h2>Documents requis</h2>
              <span className="verif-fee">2 000 XOF</span>
            </div>
          </div>

          <p className="verif-intro">
            Trois éléments sont nécessaires : le <strong>recto</strong> et le <strong>verso</strong> de votre
            carte nationale d&apos;identité, et l&apos;<strong>adresse Google Maps</strong> de l&apos;appartement.
          </p>

          <div className="verif-fee-note">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="16" x2="12" y2="12"/>
              <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
            <span>
              Frais de vérification : <strong>2 000 XOF</strong>. Le paiement se fait
              à l&apos;étape suivante, une fois les documents et l&apos;adresse envoyés.
            </span>
          </div>

          <div className="verif-docs">
            {DOC_ORDER.map((docType, index) => {
              const config = DOC_LABELS[docType];
              const state = uploads[docType];
              const doc = state.uploaded;
              const isDragging = dragging === docType;

              return (
                <div key={docType} className={`verif-doc${doc ? ' verif-doc--ready' : ''}`}>
                  <DocIndex index={index + 1} />
                  <h3 className="verif-doc__title">{config.title}</h3>
                  <p className="verif-doc__desc">{config.description}</p>

                  {doc ? (
                    <>
                      <div className="verif-preview">
                        {doc.mime_type?.startsWith('image/') ? (
                          <img src={doc.file_url} alt={config.title} />
                        ) : (
                          <div className="verif-preview--file">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                              <polyline points="14 2 14 8 20 8"/>
                            </svg>
                            {doc.original_filename || 'Document'}
                          </div>
                        )}
                      </div>
                      <div className="verif-doc__meta">
                        <span className={`admin-badge ${doc.status === 'approved' ? 'admin-badge--success' : doc.status === 'rejected' ? 'admin-badge--danger' : 'admin-badge--warning'}`}>
                          <span className="badge-dot"></span>
                          {doc.status === 'approved' ? 'Approuvé' : doc.status === 'rejected' ? 'Rejeté' : 'En attente'}
                        </span>
                        {doc.status !== 'approved' && (
                          <button
                            className="admin-btn admin-btn--danger admin-btn--sm"
                            onClick={() => handleDeleteDocument(docType)}
                          >
                            Remplacer
                          </button>
                        )}
                      </div>
                      {doc.status === 'rejected' && doc.rejection_reason && (
                        <p className="verif-doc__rejected">Raison : {doc.rejection_reason}</p>
                      )}
                    </>
                  ) : state.preview ? (
                    <>
                      <div className="verif-preview">
                        <img src={state.preview} alt="Aperçu" />
                      </div>
                      <div className="verif-doc__actions">
                        <button
                          className="admin-btn admin-btn--primary"
                          onClick={() => handleUpload(docType)}
                          disabled={state.uploading}
                        >
                          {state.uploading && <span className="verif-spinner" />}
                          {state.uploading ? 'Envoi...' : 'Envoyer'}
                        </button>
                        <button
                          className="admin-btn"
                          onClick={() => handleRemoveFile(docType)}
                          disabled={state.uploading}
                        >
                          Annuler
                        </button>
                      </div>
                    </>
                  ) : (
                    <label
                      className={`verif-drop${isDragging ? ' verif-drop--dragover' : ''}`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (!doc) setDragging(docType);
                      }}
                      onDragLeave={() => setDragging(null)}
                      onDrop={(e) => handleDrop(docType, e)}
                    >
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                        <circle cx="8.5" cy="8.5" r="1.5"/>
                        <polyline points="21 15 16 10 5 21"/>
                      </svg>
                      <p className="verif-drop__main">Déposez l&apos;image ou cliquez</p>
                      <p className="verif-drop__hint">{config.hint}</p>
                      <input
                        type="file"
                        accept={config.accept}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileSelect(docType, file);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  )}

                  {state.error && <p className="verif-doc__error">{state.error}</p>}
                </div>
              );
            })}
          </div>

          <div className={`verif-address${hasAddress ? ' verif-address--ready' : ''}`}>
            <div className="verif-address__head">
              <DocIndex index={3} />
              <div>
                <h3 className="verif-doc__title">Adresse Google Maps de l&apos;appartement</h3>
                <p className="verif-doc__desc">
                  Dans l&apos;app Google Maps : appui long sur le bâtiment → <strong>Partager</strong> → <strong>Copier le lien</strong>, puis collez-le ci-dessous.
                </p>
              </div>
            </div>

            <div className="verif-address__form">
              <input
                type="url"
                className="admin-field__input verif-address__input"
                placeholder="https://www.google.com/maps/..."
                value={address.url}
                onChange={(e) => {
                  setAddress((prev) => ({ ...prev, url: e.target.value, error: null }));
                  setManualMode(false);
                  setManualCoords(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSaveAddress();
                  }
                }}
                disabled={address.saving}
              />
              <button
                className="admin-btn admin-btn--primary"
                onClick={handleSaveAddress}
                disabled={!address.url.trim() || address.saving}
              >
                {address.saving && <span className="verif-spinner" />}
                {address.saving ? 'Vérification...' : hasAddress ? 'Mettre à jour' : 'Enregistrer'}
              </button>
            </div>

            {address.error && <p className="verif-doc__error">{address.error}</p>}

            {manualMode && (
              <div className="verif-address__manual">
                <p className="verif-address__manual-hint">
                  Lien non reconnu. Cliquez sur la carte pour placer le marqueur à l&apos;emplacement exact de l&apos;appartement, puis enregistrez.
                </p>
                <PropertyMap
                  lat={manualCoords?.lat ?? manualFallbackCenter.lat}
                  lng={manualCoords?.lng ?? manualFallbackCenter.lng}
                  height={260}
                  interactive
                  zoom={manualCoords ? 17 : 13}
                  showMarker={Boolean(manualCoords)}
                  onMapClick={(lat, lng) => setManualCoords({ lat, lng })}
                />
                <div className="verif-address__manual-actions">
                  <span className="verif-address__coords">
                    {manualCoords
                      ? `Marqueur : ${manualCoords.lat.toFixed(5)}, ${manualCoords.lng.toFixed(5)}`
                      : 'Aucun marqueur placé'}
                  </span>
                  <button
                    className="admin-btn admin-btn--primary"
                    onClick={handleSaveManualPosition}
                    disabled={!manualCoords || address.saving}
                  >
                    {address.saving && <span className="verif-spinner" />}
                    {address.saving ? 'Enregistrement...' : 'Enregistrer cette position'}
                  </button>
                </div>
              </div>
            )}

            {hasAddress && verificationStatus?.property_lat != null && verificationStatus?.property_lng != null && (
              <div className="verif-address__preview">
                <div className="verif-address__preview-head">
                  <span className={`admin-badge admin-badge--success`}>
                    <span className="badge-dot"></span>
                    Position enregistrée
                  </span>
                  <a
                    className="verif-address__link"
                    href={verificationStatus.property_maps_url || undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Ouvrir dans Google Maps ↗
                  </a>
                </div>
                <PropertyMap
                  lat={verificationStatus.property_lat}
                  lng={verificationStatus.property_lng}
                  mapsUrl={verificationStatus.property_maps_url}
                  height={220}
                  interactive={false}
                />
                <p className="verif-address__coords">
                  {verificationStatus.property_lat.toFixed(5)}, {verificationStatus.property_lng.toFixed(5)}
                </p>
              </div>
            )}
          </div>

          <div className="verif-foot">
            <p className={`verif-foot__hint${isReady ? ' verif-foot__hint--ready' : ''}`}>
              {isReady
                ? 'Documents et adresse prêts. Passons au paiement.'
                : !hasBothDocs
                  ? 'Les 2 faces de la carte sont requises.'
                  : 'L\'adresse Google Maps est requise.'}
            </p>
            <button
              className="admin-btn admin-btn--primary"
              onClick={handleSubmit}
              disabled={!isReady || submitting}
            >
              {submitting && <span className="verif-spinner" />}
              {submitting ? 'Redirection...' : 'Soumettre et payer 2 000 XOF'}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

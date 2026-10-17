import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useMarket } from '../../contexts/MarketContext';
import { marketByCode } from '../../config/markets';
import { useHomePath } from '../../hooks/useHomePath';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { apiGerants, apiUpload, request, type GerantData, type VerificationDocument, type VerificationStatusResponse } from '../../lib/api';
import { formatDateLong } from '../../lib/formatDate';
import VerifiedSection from './verification/VerifiedSection';
import PendingSection from './verification/PendingSection';
import RejectedBanner from './verification/RejectedBanner';
import VerificationStepper from './verification/VerificationStepper';
import ContactStep from './verification/ContactStep';
import DocumentsStep from './verification/DocumentsStep';
import RecapStep from './verification/RecapStep';
import {
  type AddressState,
  type ContactErrors,
  type ContactState,
  type DocType,
  type ManualCoords,
  type Step,
  type UploadState,
} from './verification/docs';

export default function VerificationPage() {
  const { market } = useMarket();
  const homePath = useHomePath();
  const gerantPath = `${homePath}/gerant`;
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
  const online = useOnlineStatus();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [address, setAddress] = useState<AddressState>({
    url: '',
    saving: false,
    error: null,
  });
  const [manualMode, setManualMode] = useState(false);
  const [manualCoords, setManualCoords] = useState<ManualCoords | null>(null);
  const [step, setStep] = useState<Step>(1);
  const [contact, setContact] = useState<ContactState>({
    nom: '',
    prenom: '',
    phone: '',
    address: '',
  });
  const [contactErrors, setContactErrors] = useState<ContactErrors>({});
  const [savingContact, setSavingContact] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const g = await apiGerants.getMe();
      setGerant(g);
      setContact({
        nom: g.nom || '',
        prenom: g.prenom || '',
        phone: g.phone || '',
        address: g.address || '',
      });
      setContactErrors({});
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

  const handleDragOver = (docType: DocType) => {
    if (uploads[docType].uploaded) return;
    setDragging(docType);
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

  const handleUrlChange = (url: string) => {
    setAddress((prev) => ({ ...prev, url, error: null }));
    setManualMode(false);
    setManualCoords(null);
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

  const manualFallbackCenter: ManualCoords = marketByCode(market).center;

  const handleContactChange = (patch: Partial<ContactState>) => {
    setContact((prev) => ({ ...prev, ...patch }));
  };

  const handleContinueContact = async () => {
    const trimmed = {
      nom: contact.nom.trim(),
      prenom: contact.prenom.trim(),
      phone: contact.phone.trim(),
      address: contact.address.trim(),
    };
    const errors: ContactErrors = {};
    if (!trimmed.nom) errors.nom = 'Le nom est requis.';
    if (!trimmed.prenom) errors.prenom = 'Le prénom est requis.';
    if (!trimmed.phone) errors.phone = 'Le téléphone est requis.';
    if (!trimmed.address) errors.address = 'L\'adresse de domicile est requise.';
    setContactErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSavingContact(true);
    setError('');
    try {
      const updated = await apiGerants.updateMe(trimmed);
      setGerant(updated);
      setStep(2);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setSavingContact(false);
    }
  };

  const handleSubmit = async () => {
    if (!gerant) return;
    // L'envoi de la demande exige le réseau.
    if (!online) {
      setError('Connexion requise pour envoyer votre demande.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await apiGerants.submitVerification(gerant.id);
      setSuccess('Demande soumise. Un administrateur va examiner vos documents.');
      setStep(1);
      setSubmitting(false);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la soumission');
      setSubmitting(false);
    }
  };

  const hasBothDocs = Boolean(uploads.id_card_front.uploaded && uploads.id_card_back.uploaded);
  const hasAddress = Boolean(
    verificationStatus?.property_lat != null &&
      verificationStatus?.property_lng != null &&
      verificationStatus?.property_maps_url
  );
  const isReady = hasBothDocs && hasAddress;
  const status = verificationStatus?.verification_status || 'none';
  const showForm = status === 'none' || status === 'rejected';

  const approvedAt = gerant?.verified_at || verificationStatus?.verification_reviewed_at;
  const verifiedDate = approvedAt ? formatDateLong(approvedAt) : null;
  const email = gerant?.email || '';

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

      {status === 'approved' ? (
        <VerifiedSection
          market={market}
          gerantPath={gerantPath}
          verifiedDate={verifiedDate}
          uploads={uploads}
          hasAddress={hasAddress}
          verificationStatus={verificationStatus}
        />
      ) : status === 'pending' || status === 'under_review' ? (
        <PendingSection
          status={status}
          verificationStatus={verificationStatus}
          gerantPath={gerantPath}
        />
      ) : status === 'rejected' ? (
        <RejectedBanner verificationStatus={verificationStatus} />
      ) : null}

      {showForm && <VerificationStepper step={step} />}

      {showForm && step === 1 && (
        <ContactStep
          contact={contact}
          contactErrors={contactErrors}
          savingContact={savingContact}
          email={email}
          onChange={handleContactChange}
          onContinue={handleContinueContact}
        />
      )}

      {showForm && step === 2 && (
        <DocumentsStep
          uploads={uploads}
          dragging={dragging}
          hasBothDocs={hasBothDocs}
          isReady={isReady}
          savingContact={savingContact}
          address={address}
          hasAddress={hasAddress}
          manualMode={manualMode}
          manualCoords={manualCoords}
          manualFallbackCenter={manualFallbackCenter}
          verificationStatus={verificationStatus}
          onDragOver={handleDragOver}
          onDragLeave={() => setDragging(null)}
          onDrop={handleDrop}
          onFileSelect={handleFileSelect}
          onUpload={handleUpload}
          onRemove={handleRemoveFile}
          onDelete={handleDeleteDocument}
          onUrlChange={handleUrlChange}
          onSaveAddress={handleSaveAddress}
          onMapClick={(lat, lng) => setManualCoords({ lat, lng })}
          onSaveManual={handleSaveManualPosition}
          onBack={() => setStep(1)}
          onContinue={() => setStep(3)}
        />
      )}

      {showForm && step === 3 && (
        <RecapStep
          contact={contact}
          email={email}
          uploads={uploads}
          hasBothDocs={hasBothDocs}
          hasAddress={hasAddress}
          verificationStatus={verificationStatus}
          isReady={isReady}
          online={online}
          submitting={submitting}
          onBack={() => setStep(2)}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}

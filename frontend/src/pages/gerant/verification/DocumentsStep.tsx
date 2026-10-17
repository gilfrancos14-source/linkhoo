import type { VerificationStatusResponse } from '../../../lib/api';
import AddressStep from './AddressStep';
import DocumentDropzone from './DocumentDropzone';
import {
  DOC_LABELS,
  DOC_ORDER,
  type AddressState,
  type DocType,
  type ManualCoords,
  type UploadState,
} from './docs';

interface DocumentsStepProps {
  uploads: Record<DocType, UploadState>;
  dragging: DocType | null;
  hasBothDocs: boolean;
  isReady: boolean;
  savingContact: boolean;
  address: AddressState;
  hasAddress: boolean;
  manualMode: boolean;
  manualCoords: ManualCoords | null;
  manualFallbackCenter: ManualCoords;
  verificationStatus: VerificationStatusResponse | null;
  onDragOver: (docType: DocType) => void;
  onDragLeave: () => void;
  onDrop: (docType: DocType, e: React.DragEvent) => void;
  onFileSelect: (docType: DocType, file: File) => void;
  onUpload: (docType: DocType) => void;
  onRemove: (docType: DocType) => void;
  onDelete: (docType: DocType) => void;
  onUrlChange: (url: string) => void;
  onSaveAddress: () => void;
  onMapClick: (lat: number, lng: number) => void;
  onSaveManual: () => void;
  onBack: () => void;
  onContinue: () => void;
}

export default function DocumentsStep({
  uploads,
  dragging,
  hasBothDocs,
  isReady,
  savingContact,
  address,
  hasAddress,
  manualMode,
  manualCoords,
  manualFallbackCenter,
  verificationStatus,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileSelect,
  onUpload,
  onRemove,
  onDelete,
  onUrlChange,
  onSaveAddress,
  onMapClick,
  onSaveManual,
  onBack,
  onContinue,
}: DocumentsStepProps) {
  return (
    <section className="panel verif-panel">
      <div className="panel__head">
        <div className="verif-head">
          <h2>Documents requis</h2>
          <span className="verif-fee">Gratuit</span>
        </div>
      </div>

      <p className="verif-intro">
        Trois éléments sont nécessaires : le <strong>recto</strong> et le <strong>verso</strong> de votre
        carte nationale d&apos;identité, et l&apos;<strong>adresse Google Maps</strong> de l&apos;appartement.
      </p>

      <div className="verif-fee-note">
        <span className="verif-fee-note__icon" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="16" x2="12" y2="12"/>
            <line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
        </span>
        <span>
          La vérification est <strong>gratuite</strong>. Elle est envoyée à
          l&apos;étape suivante, une fois les documents et l&apos;adresse déposés.
        </span>
      </div>

      <div className="verif-docs">
        {DOC_ORDER.map((docType, index) => (
          <DocumentDropzone
            key={docType}
            docType={docType}
            index={index + 1}
            config={DOC_LABELS[docType]}
            state={uploads[docType]}
            isDragging={dragging === docType}
            onDragOver={() => onDragOver(docType)}
            onDragLeave={onDragLeave}
            onDrop={(e) => onDrop(docType, e)}
            onFileSelect={(file) => onFileSelect(docType, file)}
            onUpload={() => onUpload(docType)}
            onRemove={() => onRemove(docType)}
            onDelete={() => onDelete(docType)}
          />
        ))}
      </div>

      <AddressStep
        address={address}
        hasAddress={hasAddress}
        manualMode={manualMode}
        manualCoords={manualCoords}
        manualFallbackCenter={manualFallbackCenter}
        verificationStatus={verificationStatus}
        onUrlChange={onUrlChange}
        onSave={onSaveAddress}
        onMapClick={onMapClick}
        onSaveManual={onSaveManual}
      />

      <div className="verif-foot">
        <button className="admin-btn" onClick={onBack} disabled={savingContact}>
          ← Retour
        </button>
        <p className={`verif-foot__hint${isReady ? ' verif-foot__hint--ready' : ''}`}>
          {isReady
            ? 'Documents et adresse prêts. Passons à l\'envoi.'
            : !hasBothDocs
              ? 'Les 2 faces de la carte sont requises.'
              : 'L\'adresse Google Maps est requise.'}
        </p>
        <button
          className="admin-btn admin-btn--primary"
          onClick={onContinue}
          disabled={!isReady}
        >
          Continuer vers l&apos;envoi →
        </button>
      </div>
    </section>
  );
}

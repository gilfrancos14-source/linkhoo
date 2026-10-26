import DocIndex from './DocIndex';
import type { DocConfig, DocType, UploadState } from './docs';

interface DocumentDropzoneProps {
  docType: DocType;
  index: number;
  config: DocConfig;
  state: UploadState;
  isDragging: boolean;
  onDragOver: () => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onFileSelect: (file: File) => void;
  onUpload: () => void;
  onRemove: () => void;
  onDelete: () => void;
}

export default function DocumentDropzone({
  index,
  config,
  state,
  isDragging,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileSelect,
  onUpload,
  onRemove,
  onDelete,
}: DocumentDropzoneProps) {
  const doc = state.uploaded;

  return (
    <div className={`verif-doc${doc ? ' verif-doc--ready' : ''}`}>
      <DocIndex index={index} />
      <h3 className="verif-doc__title">{config.title}</h3>
      <p className="verif-doc__desc">{config.description}</p>

      {doc ? (
        <>
          <div className="verif-preview">
            {doc.file_url && doc.mime_type?.startsWith('image/') ? (
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
                onClick={onDelete}
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
              onClick={onUpload}
              disabled={state.uploading}
            >
              {state.uploading && <span className="verif-spinner" />}
              {state.uploading ? 'Envoi...' : 'Envoyer'}
            </button>
            <button
              className="admin-btn"
              onClick={onRemove}
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
            onDragOver();
          }}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <span className="verif-drop__icon" aria-hidden="true">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
          </span>
          <p className="verif-drop__main">Déposez l&apos;image ou cliquez</p>
          <p className="verif-drop__hint">{config.hint}</p>
          <input
            type="file"
            accept={config.accept}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onFileSelect(file);
              e.target.value = '';
            }}
          />
        </label>
      )}

      {state.error && <p className="verif-doc__error">{state.error}</p>}
    </div>
  );
}

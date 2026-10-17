import type { VerificationStatusResponse } from '../../../lib/api';
import PropertyMap from '../../../components/PropertyMap';
import DocIndex from './DocIndex';
import type { AddressState, ManualCoords } from './docs';

interface AddressStepProps {
  address: AddressState;
  hasAddress: boolean;
  manualMode: boolean;
  manualCoords: ManualCoords | null;
  manualFallbackCenter: ManualCoords;
  verificationStatus: VerificationStatusResponse | null;
  onUrlChange: (url: string) => void;
  onSave: () => void;
  onMapClick: (lat: number, lng: number) => void;
  onSaveManual: () => void;
}

export default function AddressStep({
  address,
  hasAddress,
  manualMode,
  manualCoords,
  manualFallbackCenter,
  verificationStatus,
  onUrlChange,
  onSave,
  onMapClick,
  onSaveManual,
}: AddressStepProps) {
  return (
    <div className={`verif-address${hasAddress ? ' verif-address--ready' : ''}`}>
      <div className="verif-address__head">
        <DocIndex index={3} />
        <span className="verif-address__icon" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
        </span>
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
          onChange={(e) => onUrlChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onSave();
            }
          }}
          disabled={address.saving}
        />
        <button
          className="admin-btn admin-btn--primary"
          onClick={onSave}
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
            onMapClick={onMapClick}
          />
          <div className="verif-address__manual-actions">
            <span className="verif-address__coords">
              {manualCoords
                ? `Marqueur : ${manualCoords.lat.toFixed(5)}, ${manualCoords.lng.toFixed(5)}`
                : 'Aucun marqueur placé'}
            </span>
            <button
              className="admin-btn admin-btn--primary"
              onClick={onSaveManual}
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
  );
}

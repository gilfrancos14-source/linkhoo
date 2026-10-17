import type { FormEvent } from 'react';
import type { DureeUnite } from '../../lib/duration';
import type { FormErrors } from './roomForm';
import ReservationAuthCta from './ReservationAuthCta';
import ReservationSuccess from './ReservationSuccess';
import ReservationForm, { type ReservationFormData } from './ReservationForm';

interface ReservationBoxProps {
  online: boolean;
  submitted: boolean;
  queued: boolean;
  clerkSignedIn: boolean;
  market: string;
  homePath: string;
  formData: ReservationFormData;
  duree: string;
  unite: DureeUnite;
  errors: FormErrors;
  touched: Record<string, boolean>;
  submitting: boolean;
  submitError: string;
  effectiveDateFin: string;
  estimatedMontant: number | null;
  dureeNombre: number;
  onChange: (patch: Partial<ReservationFormData>) => void;
  onDureeChange: (value: string) => void;
  onBlur: (field: string) => void;
  onSubmit: (e: FormEvent) => void;
}

export default function ReservationBox({
  online,
  submitted,
  queued,
  clerkSignedIn,
  market,
  homePath,
  formData,
  duree,
  unite,
  errors,
  touched,
  submitting,
  submitError,
  effectiveDateFin,
  estimatedMontant,
  dureeNombre,
  onChange,
  onDureeChange,
  onBlur,
  onSubmit,
}: ReservationBoxProps) {
  return (
    <div className="room-detail__form-box">
      <h2>Demande de réservation</h2>
      {!online && !submitted && (
        <p className="room-detail__offline" role="status">
          Vous êtes hors-ligne : votre demande sera enregistrée puis
          envoyée automatiquement au retour de la connexion.
        </p>
      )}
      {!clerkSignedIn && !submitted && <ReservationAuthCta market={market} />}
      {submitted ? (
        <ReservationSuccess
          queued={queued}
          clerkSignedIn={clerkSignedIn}
          market={market}
          homePath={homePath}
        />
      ) : (
        <ReservationForm
          formData={formData}
          duree={duree}
          unite={unite}
          errors={errors}
          touched={touched}
          submitting={submitting}
          submitError={submitError}
          effectiveDateFin={effectiveDateFin}
          estimatedMontant={estimatedMontant}
          dureeNombre={dureeNombre}
          onChange={onChange}
          onDureeChange={onDureeChange}
          onBlur={onBlur}
          onSubmit={onSubmit}
        />
      )}
    </div>
  );
}

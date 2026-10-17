import type { FormEvent } from 'react';
import { maxDuree, pluralDuree, type DureeUnite } from '../../lib/duration';
import { priceWithCurrency } from '../../lib/roomDisplay';
import type { FormErrors } from './roomForm';

export interface ReservationFormData {
  name: string;
  email: string;
  phone: string;
  dateDebut: string;
}

interface ReservationFormProps {
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

export default function ReservationForm({
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
}: ReservationFormProps) {
  return (
    <form className="room-detail__form" onSubmit={onSubmit} noValidate>
      <div className="room-detail__field">
        <label htmlFor="rd-name">Nom complet <span aria-hidden="true">*</span></label>
        <input
          id="rd-name"
          type="text"
          required
          placeholder="Votre nom"
          autoComplete="name"
          aria-required="true"
          aria-invalid={!!errors.name && touched.name}
          aria-describedby={errors.name ? 'rd-name-error' : undefined}
          value={formData.name}
          onChange={(e) => onChange({ name: e.target.value })}
          onBlur={() => onBlur('name')}
        />
        {errors.name && touched.name && (
          <p className="room-detail__field-error" id="rd-name-error" role="alert">{errors.name}</p>
        )}
      </div>
      <div className="room-detail__field">
        <label htmlFor="rd-email">Email <span aria-hidden="true">*</span></label>
        <input
          id="rd-email"
          type="email"
          required
          placeholder="Votre email"
          autoComplete="email"
          aria-required="true"
          aria-invalid={!!errors.email && touched.email}
          aria-describedby={errors.email ? 'rd-email-error' : undefined}
          value={formData.email}
          onChange={(e) => onChange({ email: e.target.value })}
          onBlur={() => onBlur('email')}
        />
        {errors.email && touched.email && (
          <p className="room-detail__field-error" id="rd-email-error" role="alert">{errors.email}</p>
        )}
      </div>
      <div className="room-detail__field">
        <label htmlFor="rd-phone">Téléphone <span aria-hidden="true">*</span></label>
        <input
          id="rd-phone"
          type="tel"
          required
          placeholder="Votre téléphone"
          autoComplete="tel"
          inputMode="tel"
          aria-required="true"
          aria-invalid={!!errors.phone && touched.phone}
          aria-describedby={errors.phone ? 'rd-phone-error' : undefined}
          value={formData.phone}
          onChange={(e) => onChange({ phone: e.target.value })}
          onBlur={() => onBlur('phone')}
        />
        {errors.phone && touched.phone && (
          <p className="room-detail__field-error" id="rd-phone-error" role="alert">{errors.phone}</p>
        )}
      </div>
      <div className="room-detail__field-row">
        <div className="room-detail__field">
          <label htmlFor="rd-date-debut">Date de début <span aria-hidden="true">*</span></label>
          <input
            id="rd-date-debut"
            type="date"
            required
            aria-required="true"
            aria-invalid={!!errors.dateDebut && touched.dateDebut}
            aria-describedby={errors.dateDebut ? 'rd-date-debut-error' : undefined}
            value={formData.dateDebut}
            onChange={(e) => onChange({ dateDebut: e.target.value })}
            onBlur={() => onBlur('dateDebut')}
          />
          {errors.dateDebut && touched.dateDebut && (
            <p className="room-detail__field-error" id="rd-date-debut-error" role="alert">{errors.dateDebut}</p>
          )}
        </div>
        <div className="room-detail__field">
          <label htmlFor="rd-duree">Durée <span aria-hidden="true">*</span></label>
          <input
            id="rd-duree"
            type="number"
            min={1}
            max={maxDuree(unite)}
            step={1}
            required
            aria-required="true"
            aria-invalid={!!errors.duree && touched.duree}
            aria-describedby={errors.duree ? 'rd-duree-error' : undefined}
            value={duree}
            onChange={(e) => onDureeChange(e.target.value)}
            onBlur={() => onBlur('duree')}
          />
          {errors.duree && touched.duree && (
            <p className="room-detail__field-error" id="rd-duree-error" role="alert">{errors.duree}</p>
          )}
        </div>
        <div className="room-detail__field">
          <label htmlFor="rd-unite">Unité <span aria-hidden="true">*</span></label>
          <select id="rd-unite" value={unite} disabled aria-required="true">
            <option value={unite}>{unite === 'mois' ? 'mois' : 'nuit'}</option>
          </select>
        </div>
      </div>
      {effectiveDateFin && (
        <div className="room-detail__field">
          <label htmlFor="rd-date-fin">Date de fin (calculée)</label>
          <input
            id="rd-date-fin"
            type="date"
            value={effectiveDateFin}
            readOnly
            aria-readonly="true"
          />
        </div>
      )}
      {effectiveDateFin && estimatedMontant !== null && (
        <p className="room-detail__field" style={{ margin: 0, fontSize: '14px', color: 'var(--ink-soft)' }}>
          Du {formData.dateDebut} au {effectiveDateFin} · {pluralDuree(dureeNombre, unite)} — estimation :{' '}
          <strong>{priceWithCurrency(estimatedMontant)}</strong>
        </p>
      )}
      {submitError && (
        <p className="room-detail__field-error" role="alert">{submitError}</p>
      )}
      <button type="submit" className="room-detail__submit" disabled={submitting}>
        {submitting ? 'Envoi en cours...' : 'Envoyer la demande'}
      </button>
    </form>
  );
}

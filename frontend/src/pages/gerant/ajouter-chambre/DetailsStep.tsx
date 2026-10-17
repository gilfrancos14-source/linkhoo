import type { FormData } from './form';

/** Étape 2 — Détails (prix, capacité, conditions). */
export default function DetailsStep({
  form,
  errors,
  onUpdate,
  onPrev,
  onNext,
}: {
  form: FormData;
  errors: Record<string, string>;
  onUpdate: (field: keyof FormData, value: string | number | boolean) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <>
      <div className="form-grid">
        <label className={`admin-field ${errors.priceNum ? 'admin-field--error' : ''}`}>
          <span>Prix (FCFA) *</span>
          <input type="number" min={1} value={form.priceNum || ''} onChange={(e) => onUpdate('priceNum', Number(e.target.value))} placeholder="660" />
          {errors.priceNum && <span className="field-error">{errors.priceNum}</span>}
        </label>

        <label className="admin-field">
          <span>Unité de prix</span>
          <div className="radio-group">
            <label className={`radio-btn ${form.priceUnit === '/ mois' ? 'radio-btn--active' : ''}`}>
              <input type="radio" name="priceUnit" value="/ mois" checked={form.priceUnit === '/ mois'} onChange={() => onUpdate('priceUnit', '/ mois')} />
              <span>Par mois</span>
            </label>
            <label className={`radio-btn ${form.priceUnit === '/ nuit' ? 'radio-btn--active' : ''}`}>
              <input type="radio" name="priceUnit" value="/ nuit" checked={form.priceUnit === '/ nuit'} onChange={() => onUpdate('priceUnit', '/ nuit')} />
              <span>Par nuit</span>
            </label>
          </div>
        </label>

        <label className="admin-field">
          <span>Nombre de chambres</span>
          <input type="number" min={1} max={20} value={form.chambres} onChange={(e) => onUpdate('chambres', Number(e.target.value))} />
        </label>

        <label className="admin-field">
          <span>Nombre de douches</span>
          <input type="number" min={1} max={10} value={form.douches} onChange={(e) => onUpdate('douches', Number(e.target.value))} />
        </label>
      </div>

      <label className={`admin-field admin-field--full ${errors.conditions ? 'admin-field--error' : ''}`}>
        <span>Conditions *</span>
        <textarea rows={3} value={form.conditions} onChange={(e) => onUpdate('conditions', e.target.value)} placeholder="Ex: Caution 1 mois, durée min 6 mois, charges comprises..." />
        <small className="admin-field__hint">Pas de numéro de téléphone : les clients vous contactent via la messagerie.</small>
        {errors.conditions && <span className="field-error">{errors.conditions}</span>}
      </label>

      <label className="admin-field admin-field--full">
        <span className="checkbox-label">
          <input
            type="checkbox"
            checked={form.isPopular}
            onChange={(e) => onUpdate('isPopular', e.target.checked ? true : false)}
            style={{ width: 'auto', marginRight: '8px' }}
          />
          Marquer comme chambre populaire (affichée dans "Les plus louées")
        </span>
      </label>

      <div className="form-nav">
        <button type="button" className="admin-btn" onClick={onPrev}>
          ← Étape précédente
        </button>
        <div className="form-nav__spacer" />
        <button type="button" className="admin-btn admin-btn--primary" onClick={onNext}>
          Étape suivante →
        </button>
      </div>
    </>
  );
}

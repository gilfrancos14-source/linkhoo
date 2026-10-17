import type { Category } from '../../../data/categories';
import type { FormData } from './form';

/** Étape 1 — Identification de l'appartement. */
export default function IdentificationStep({
  form,
  errors,
  categories,
  citySuggestions,
  onUpdate,
  onNext,
}: {
  form: FormData;
  errors: Record<string, string>;
  categories: Category[];
  citySuggestions: string[];
  onUpdate: (field: keyof FormData, value: string | number | boolean) => void;
  onNext: () => void;
}) {
  return (
    <>
      <div className="form-grid">
        <label className={`admin-field ${errors.title ? 'admin-field--error' : ''}`}>
          <span>Titre *</span>
          <input type="text" value={form.title} onChange={(e) => onUpdate('title', e.target.value)} placeholder="Ex: Appartement familial" />
          {errors.title && <span className="field-error">{errors.title}</span>}
        </label>

        <label className={`admin-field ${errors.ville ? 'admin-field--error' : ''}`}>
          <span>Ville *</span>
          <input
            type="text"
            list="gerant-room-city-options"
            value={form.ville}
            onChange={(e) => onUpdate('ville', e.target.value)}
            placeholder="Ex: Cotonou"
          />
          <datalist id="gerant-room-city-options">
            {citySuggestions.map((city) => (
              <option key={city} value={city} />
            ))}
          </datalist>
          {errors.ville && <span className="field-error">{errors.ville}</span>}
        </label>

        <label className={`admin-field ${errors.quartier ? 'admin-field--error' : ''}`}>
          <span>Quartier *</span>
          <input type="text" value={form.quartier} onChange={(e) => onUpdate('quartier', e.target.value)} placeholder="Ex: Centre-ville" />
          {errors.quartier && <span className="field-error">{errors.quartier}</span>}
        </label>

        <label className={`admin-field ${errors.category ? 'admin-field--error' : ''}`}>
          <span>Catégorie *</span>
          <select value={form.category} onChange={(e) => onUpdate('category', e.target.value)}>
            <option value="">Choisir une catégorie</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
          {errors.category && <span className="field-error">{errors.category}</span>}
        </label>
      </div>

      <label className={`admin-field admin-field--full ${errors.description ? 'admin-field--error' : ''}`}>
        <span>Description *</span>
        <textarea rows={4} value={form.description} onChange={(e) => onUpdate('description', e.target.value)} placeholder="Décrivez l'appartement en détail : ambiance, équipements, points forts..." />
        <small className="admin-field__hint">Pas de numéro de téléphone : les clients vous contactent via la messagerie.</small>
        {errors.description && <span className="field-error">{errors.description}</span>}
      </label>

      <div className="form-nav">
        <div className="form-nav__spacer" />
        <button type="button" className="admin-btn admin-btn--primary" onClick={onNext}>
          Étape suivante →
        </button>
      </div>
    </>
  );
}

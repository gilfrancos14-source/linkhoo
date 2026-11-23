import { useCallback, useEffect, useState } from 'react';
import { apiAdmin, type TranslationReviewItem } from '../../lib/adminApi';
import '../../styles/48-admin-translations.css';

type Locale = 'en' | 'es';

const keyOf = (item: TranslationReviewItem) =>
  `${item.entity_type}:${item.entity_id}:${item.field}`;

export default function AdminTranslationsPage() {
  const [locale, setLocale] = useState<Locale>('en');
  const [items, setItems] = useState<TranslationReviewItem[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [glossary, setGlossary] = useState<Array<{ source_term: string; target_term: string }>>([]);
  const [sourceTerm, setSourceTerm] = useState('');
  const [targetTerm, setTargetTerm] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const [data, terms] = await Promise.all([
        apiAdmin.listTranslationReview(locale),
        apiAdmin.listGlossary(locale),
      ]);
      setItems(data);
      setGlossary(terms);
      setDrafts(Object.fromEntries(data.map((item) => [keyOf(item), item.value])));
    } catch {
      setMessage('Impossible de charger les traductions.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (item: TranslationReviewItem) => {
    const value = (drafts[keyOf(item)] ?? item.value).trim();
    if (!value) return;
    setMessage('');
    try {
      await apiAdmin.correctTranslation({
        entityType: item.entity_type,
        entityId: item.entity_id,
        locale: item.locale,
        field: item.field,
        value,
      });
      setMessage('Correction enregistrée. Elle ne sera plus régénérée.');
      await load();
    } catch {
      setMessage("Erreur lors de l'enregistrement de la correction.");
    }
  };

  const saveGlossary = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!sourceTerm.trim() || !targetTerm.trim()) return;
    setMessage('');
    try {
      await apiAdmin.saveGlossaryTerm({
        sourceTerm: sourceTerm.trim(),
        locale,
        targetTerm: targetTerm.trim(),
      });
      setSourceTerm('');
      setTargetTerm('');
      setMessage('Terme du glossaire enregistré.');
      await load();
    } catch {
      setMessage("Erreur lors de l'enregistrement du terme.");
    }
  };

  return (
    <div className="dash tr-page">
      <div className="dash-page-head">
        <h1>Traductions à revoir</h1>
        <p>Corrigez les traductions signalées comme douteuses par le worker.</p>
      </div>

      <div className="tr-toolbar">
        <label htmlFor="tr-locale">Langue</label>
        <select
          id="tr-locale"
          value={locale}
          onChange={(event) => setLocale(event.target.value as Locale)}
        >
          <option value="en">Anglais</option>
          <option value="es">Espagnol</option>
        </select>
        <button type="button" className="admin-btn" onClick={() => void load()}>
          Actualiser
        </button>
      </div>

      {message && <div className="tr-message" role="status">{message}</div>}

      {loading ? (
        <div className="panel tr-empty">Chargement…</div>
      ) : items.length === 0 ? (
        <div className="panel tr-empty">Aucune traduction à revoir pour cette langue.</div>
      ) : (
        <div className="tr-list">
          {items.map((item) => (
            <div key={keyOf(item)} className="panel tr-item">
              <div className="tr-item__meta">
                <strong>{item.entity_type}</strong>
                <span>{item.entity_id}</span>
                <code>{item.field}</code>
                <span>{item.locale}</span>
              </div>
              <textarea
                value={drafts[keyOf(item)] ?? item.value}
                onChange={(event) =>
                  setDrafts((prev) => ({ ...prev, [keyOf(item)]: event.target.value }))
                }
                rows={3}
                aria-label={`Traduire ${item.field} de ${item.entity_id}`}
              />
              <button
                type="button"
                className="admin-btn admin-btn--primary admin-btn--sm"
                onClick={() => void save(item)}
              >
                Enregistrer la correction
              </button>
            </div>
          ))}
        </div>
      )}

      <section className="panel tr-glossary">
        <h2>Glossaire</h2>
        <p>Ces termes sont protégés avant traduction pour garder leur forme exacte.</p>
        <form onSubmit={saveGlossary} className="tr-glossary__form">
          <input
            type="text"
            value={sourceTerm}
            onChange={(event) => setSourceTerm(event.target.value)}
            placeholder="Terme français"
            aria-label="Terme français"
          />
          <input
            type="text"
            value={targetTerm}
            onChange={(event) => setTargetTerm(event.target.value)}
            placeholder={`Traduction ${locale}`}
            aria-label={`Traduction ${locale}`}
          />
          <button type="submit" className="admin-btn admin-btn--primary admin-btn--sm">
            Ajouter
          </button>
        </form>
        {glossary.length > 0 && (
          <ul className="tr-glossary__list">
            {glossary.map((term) => (
              <li key={term.source_term}>
                <strong>{term.source_term}</strong> → {term.target_term}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

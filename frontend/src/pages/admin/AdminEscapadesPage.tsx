import { MARKETS, MARKET_CODES, type MarketCode } from '../../config/markets';

import { useState, useEffect, useRef, useCallback } from 'react';
import { apiAdmin, type AdminEscapade } from '../../lib/adminApi';

interface ImageSlot {
  /** URL finale (uploadée ou déjà en base). */
  url: string;
  /** Fichier en attente d'upload (absent pour les images déjà en base). */
  file?: File;
}

interface FormData {
  market: MarketCode;
  lieu: string;
  description: string;
  images: ImageSlot[];
}

const DEFAULT_FORM: FormData = {
  market: 'CI',
  lieu: '',
  description: '',
  images: [],
};

const MAX_IMAGES = 5;

export default function AdminEscapadesPage() {
  const [escapades, setEscapades] = useState<AdminEscapade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [marketFilter, setMarketFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState<AdminEscapade | null>(null);
  const [form, setForm] = useState<FormData>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const slotsRef = useRef<ImageSlot[]>([]);
  slotsRef.current = form.images;

  // Libère les aperçus blob à chaque démontage (pas seulement au closePanel)
  // pour éviter les fuites si l'admin navigue avec le panneau ouvert.
  useEffect(
    () => () => {
      for (const slot of slotsRef.current) {
        if (slot.url.startsWith('blob:')) URL.revokeObjectURL(slot.url);
      }
    },
    [],
  );

  // GET /escapades est par marché : on interroge TOUS les marchés puis on
  // concatène, en gardant l'ordre serveur (created_at puis id) par marché.
  const loadEscapades = useCallback(async (options?: { silent?: boolean }) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    if (!options?.silent) {
      setLoading(true);
      setError('');
    }
    try {
      const lists = await Promise.all(MARKET_CODES.map((code) => apiAdmin.getEscapades(code)));
      if (controller.signal.aborted) return;
      setEscapades(lists.flat());
    } catch {
      if (!controller.signal.aborted && !options?.silent) {
        setError('Impossible de charger les escapades.');
      }
    } finally {
      if (!controller.signal.aborted && !options?.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEscapades();
    return () => abortRef.current?.abort();
  }, [loadEscapades]);

  const filtered = marketFilter === 'all' ? escapades : escapades.filter((e) => e.market === marketFilter);

  // Un changement de filtre peut réduire la liste à moins de pages : on
  // revient à la première pour ne pas afficher une page vide.
  useEffect(() => {
    setCurrentPage(1);
  }, [marketFilter]);

  // Pagination côté client (les escapades sont déjà toutes chargées) : on
  // n'en montre que 10 par page au lieu de toute la liste.
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const openCreate = () => {
    setEditing(null);
    setForm(DEFAULT_FORM);
    setPanelOpen(true);
  };

  const openEdit = (escapade: AdminEscapade) => {
    setEditing(escapade);
    setForm({
      market: escapade.market,
      lieu: escapade.lieu,
      description: escapade.description || '',
      images: (escapade.images || []).map((url) => ({ url })),
    });
    setPanelOpen(true);
  };

  const closePanel = () => {
    setPanelOpen(false);
    setEditing(null);
    for (const slot of form.images) {
      if (slot.url.startsWith('blob:')) URL.revokeObjectURL(slot.url);
    }
    setForm(DEFAULT_FORM);
  };

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const room = MAX_IMAGES - form.images.length;
    const accepted = Array.from(files).filter((f) => f.type.startsWith('image/')).slice(0, room);
    if (accepted.length === 0) return;
    setForm((f) => ({
      ...f,
      images: [
        ...f.images,
        ...accepted.map((file) => ({ url: URL.createObjectURL(file), file })),
      ],
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(e.target.files);
    // Permet de re-sélectionner le même fichier après un retrait.
    e.target.value = '';
  };

  const removeImage = (index: number) => {
    setForm((f) => {
      const slot = f.images[index];
      if (slot?.url.startsWith('blob:')) URL.revokeObjectURL(slot.url);
      return { ...f, images: f.images.filter((_, i) => i !== index) };
    });
  };

  const handleSave = async () => {
    if (!form.lieu.trim() || !form.description.trim()) {
      setError('Lieu et description sont obligatoires.');
      return;
    }
    if (form.images.length === 0) {
      setError('Ajoutez au moins une image (1 à 5).');
      return;
    }

    setSaving(true);
    setError('');
    try {
      // Upload des fichiers en attente, dans l'ordre de la liste, pour
      // préserver la couverture (images[0]).
      const urls: string[] = [];
      for (const slot of form.images) {
        if (slot.file) {
          const result = await apiAdmin.uploadFile(slot.file);
          urls.push(result.url);
        } else {
          urls.push(slot.url);
        }
      }

      const payload = {
        market: form.market,
        lieu: form.lieu.trim(),
        description: form.description.trim(),
        images: urls,
      };

      if (editing) await apiAdmin.updateEscapade(editing.id, payload);
      else await apiAdmin.createEscapade(payload);

      await loadEscapades({ silent: true });
      closePanel();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiAdmin.deleteEscapade(id);
      await loadEscapades({ silent: true });
      setDeleteConfirm(null);
    } catch {
      setError('Erreur lors de la suppression.');
    }
  };

  return (
    <div className="dash">
      <div className="dash-page-head">
        <div>
          <h1>Escapades weekend</h1>
          <p>Gérer les cartes de la section Escapade</p>
          <p style={{ fontSize: '12px', color: 'var(--admin-ink-soft)', marginTop: '4px' }}>
            La première image est la couverture de la carte ; toutes les images s'affichent dans le
            panneau de détail (clic sur la carte). 1 à 5 images par escapade.
          </p>
        </div>
        <button className="admin-btn" onClick={openCreate}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Ajouter
        </button>
      </div>

      <div className="gerants-filter-card">
        <div className="gerants-filter-card__top">
          <div className="gerants-filter-card__divider" />
          <select
            className="gerants-filter-card__select"
            value={marketFilter}
            onChange={(e) => setMarketFilter(e.target.value)}
          >
            <option value="all">Tous les marchés</option>
            {MARKETS.map((m) => (
              <option key={m.code} value={m.code}>{m.label}</option>
            ))}
          </select>
        </div>
      </div>

      {error && <div className="auth-error" style={{ marginBottom: '12px' }}>{error}</div>}

      {loading ? (
        <div className="panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--admin-ink-soft)' }}>Chargement...</div>
      ) : filtered.length === 0 ? (
        <div className="panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--admin-ink-soft)' }}>
          Aucune escapade trouvée.
        </div>
      ) : (
        <>
          <div className="panel">
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Couverture</th>
                    <th>Lieu</th>
                    <th>Marché</th>
                    <th>Images</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((escapade) => (
                    <tr key={escapade.id}>
                      <td>
                        <img
                          src={escapade.images?.[0] || ''}
                          alt={escapade.lieu}
                          style={{ width: '90px', height: '60px', objectFit: 'cover', borderRadius: '6px', background: 'var(--admin-mist-2, #f1f5f9)' }}
                        />
                      </td>
                      <td style={{ fontSize: '13px', maxWidth: '220px' }}>
                        <div style={{ fontWeight: 600 }}>{escapade.lieu}</div>
                        <div style={{ color: 'var(--admin-ink-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {escapade.description}
                        </div>
                      </td>
                      <td>
                        <span className={`admin-badge ${escapade.market === 'CI' ? 'admin-badge--info' : 'admin-badge--success'}`}>
                          {escapade.market}
                        </span>
                      </td>
                      <td>
                        <span className="admin-badge admin-badge--muted">
                          {escapade.images?.length ?? 0} image{(escapade.images?.length ?? 0) > 1 ? 's' : ''}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button className="admin-btn admin-btn--sm" onClick={() => openEdit(escapade)}>Modifier</button>
                          <button className="admin-btn admin-btn--danger admin-btn--sm" onClick={() => setDeleteConfirm(escapade.id)}>
                            Supprimer
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="banners-mobile-cards">
            {paginated.map((escapade) => (
              <div className="gerant-card" key={escapade.id}>
                {escapade.images?.[0] && (
                  <img
                    src={escapade.images[0]}
                    alt={escapade.lieu}
                    style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '6px', marginBottom: '10px' }}
                  />
                )}
                <div className="gerant-card__header">
                  <div className="gerant-card__info">
                    <span className="admin-badge admin-badge--danger">{escapade.lieu}</span>
                    <span className={`admin-badge ${escapade.market === 'CI' ? 'admin-badge--info' : 'admin-badge--success'}`}>
                      {escapade.market}
                    </span>
                  </div>
                </div>
                <div className="gerant-card__meta">
                  <span className="admin-badge admin-badge--muted">
                    {escapade.images?.length ?? 0} image{(escapade.images?.length ?? 0) > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="gerant-card__actions">
                  <button className="admin-btn admin-btn--sm" onClick={() => openEdit(escapade)}>Modifier</button>
                  <button className="admin-btn admin-btn--danger admin-btn--sm" onClick={() => setDeleteConfirm(escapade.id)}>
                    Supprimer
                  </button>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="admin-pagination">
              <button
                className="admin-pagination__btn"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
              >
                ←
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  className={`admin-pagination__btn ${page === currentPage ? 'admin-pagination__btn--active' : ''}`}
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </button>
              ))}
              <button
                className="admin-pagination__btn"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(currentPage + 1)}
              >
                →
              </button>
            </div>
          )}
        </>
      )}

      {deleteConfirm && (
        <div className="verify-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="verify-modal" onClick={(e) => e.stopPropagation()}>
            <div className="verify-modal__result verify-modal__result--unavailable">
              <div className="verify-modal__icon verify-modal__icon--unavailable">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
              </div>
              <p style={{ fontWeight: 600 }}>Supprimer cette escapade ?</p>
              <p style={{ fontSize: '13px', color: 'var(--admin-ink-soft)' }}>Cette action est irréversible.</p>
              <div className="verify-modal__actions">
                <button className="admin-btn admin-btn--danger" onClick={() => handleDelete(deleteConfirm)}>Supprimer</button>
                <button className="admin-btn" onClick={() => setDeleteConfirm(null)}>Annuler</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={`banner-slide-panel ${panelOpen ? 'banner-slide-panel--open' : ''}`}>
        {panelOpen && <div className="banner-slide-panel__overlay" onClick={closePanel} />}
        <div className="banner-slide-panel__content">
          <div className="banner-slide-panel__header">
            <h2>{editing ? "Modifier l'escapade" : 'Ajouter une escapade'}</h2>
            <button className="banner-slide-panel__close" onClick={closePanel}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>

          <div className="banner-slide-panel__body">
            <div className="banner-field">
              <span>Images ({form.images.length} / {MAX_IMAGES})</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '6px' }}>
                {form.images.map((slot, i) => (
                  <div key={slot.url} style={{ position: 'relative', width: '96px', height: '72px' }}>
                    <img
                      src={slot.url}
                      alt={i === 0 ? `Couverture — ${form.lieu || 'escapade'}` : `Image ${i + 1}`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--admin-line, #e2e8f0)' }}
                    />
                    {i === 0 && (
                      <span
                        style={{
                          position: 'absolute', bottom: '2px', left: '2px', fontSize: '9px',
                          padding: '1px 5px', borderRadius: '4px', background: 'rgba(15,23,42,0.7)', color: '#fff',
                        }}
                      >
                        Couverture
                      </span>
                    )}
                    <button
                      type="button"
                      aria-label={`Retirer l'image ${i + 1}`}
                      onClick={() => removeImage(i)}
                      style={{
                        position: 'absolute', top: '2px', right: '2px', width: '20px', height: '20px',
                        borderRadius: '50%', border: 'none', background: 'rgba(15,23,42,0.7)', color: '#fff',
                        cursor: 'pointer', display: 'grid', placeItems: 'center', fontSize: '12px', lineHeight: 1,
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
                {form.images.length < MAX_IMAGES && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      width: '96px', height: '72px', borderRadius: '6px', border: '1px dashed var(--admin-line, #cbd5e1)',
                      background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center',
                      color: 'var(--admin-ink-soft)', fontSize: '24px',
                    }}
                    aria-label="Ajouter une image"
                  >
                    +
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
              <small style={{ color: 'var(--admin-ink-soft)' }}>
                JPEG, PNG, WebP, GIF — 2 Mo max par image. La première est la couverture.
              </small>
            </div>

            <label className="banner-field">
              <span>Marché</span>
              <select value={form.market} onChange={(e) => setForm({ ...form, market: e.target.value as MarketCode })}>
                {MARKETS.map((m) => (
                  <option key={m.code} value={m.code}>{m.label}</option>
                ))}
              </select>
            </label>

            <label className="banner-field">
              <span>Lieu</span>
              <input
                type="text"
                placeholder="Ouidah, Ganvié, Assinie..."
                value={form.lieu}
                onChange={(e) => setForm({ ...form, lieu: e.target.value })}
                maxLength={120}
              />
            </label>

            <label className="banner-field">
              <span>Description</span>
              <textarea
                rows={5}
                maxLength={2000}
                placeholder="Description de l'escapade (visible en entier dans le panneau de détail)"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
              <small style={{ color: 'var(--admin-ink-soft)' }}>{form.description.length} / 2000</small>
            </label>
          </div>

          <div className="banner-slide-panel__footer">
            <button className="admin-btn" onClick={closePanel}>Annuler</button>
            <button className="admin-btn admin-btn--success" onClick={handleSave} disabled={saving}>
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

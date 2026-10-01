import { useState, useEffect, useRef, useCallback } from 'react';
import { apiAdmin, type AdminDestination } from '../../lib/adminApi';
import { apiRooms } from '../../lib/api';

interface FormData {
  market: 'CI' | 'BJ';
  city: string;
  title: string;
  description: string;
  alt: string;
  featured: boolean;
}

const DEFAULT_FORM: FormData = {
  market: 'CI',
  city: '',
  title: '',
  description: '',
  alt: '',
  featured: false,
};

export default function AdminDestinationsPage() {
  const [destinations, setDestinations] = useState<AdminDestination[]>([]);
  // Ids servis en grosse carte par le serveur (règle des 30 jours + « mettre
  // en avant ») : le badge reflète la décision serveur, jamais un calcul local.
  const [bigIds, setBigIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [marketFilter, setMarketFilter] = useState<string>('all');

  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState<AdminDestination | null>(null);
  const [form, setForm] = useState<FormData>(DEFAULT_FORM);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [citySuggestions, setCitySuggestions] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const previewRef = useRef<string | null>(null);
  previewRef.current = imagePreview;

  // Démonagement avec le panneau ouvert : l'URL blob de l'aperçu ne serait
  // jamais libérée (closePanel n'est pas appelé).
  useEffect(
    () => () => {
      const preview = previewRef.current;
      if (preview && preview.startsWith('blob:')) URL.revokeObjectURL(preview);
    },
    [],
  );

  // GET /tourism exige ?market= : on charge les deux marchés, on affiche les
  // deux listes dans l'ordre serveur (grosses cartes d'abord).
  const loadDestinations = useCallback(async (options?: { silent?: boolean }) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    if (!options?.silent) {
      setLoading(true);
      setError('');
    }
    try {
      const [ci, bj] = await Promise.all([
        apiAdmin.getDestinations('CI'),
        apiAdmin.getDestinations('BJ'),
      ]);
      if (controller.signal.aborted) return;
      setDestinations([...ci.big, ...ci.small, ...bj.big, ...bj.small]);
      setBigIds(new Set([...ci.big, ...bj.big].map((d) => d.id)));
    } catch {
      if (!controller.signal.aborted && !options?.silent) {
        setError('Impossible de charger les destinations.');
      }
    } finally {
      if (!controller.signal.aborted && !options?.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDestinations();
    return () => abortRef.current?.abort();
  }, [loadDestinations]);

  // Villes déjà utilisées par les événements et les biens : suggestions de
  // saisie pour que la ville de la destination tombe pile sur celle d'un
  // événement (sinon la carte ne bascule jamais en grande carte).
  useEffect(() => {
    Promise.all([apiRooms.villes(), apiAdmin.getEvents('CI'), apiAdmin.getEvents('BJ')])
      .then(([villes, ciEvents, bjEvents]) => {
        const seen = new Map<string, string>();
        for (const value of [...destinations.map((d) => d.city), ...villes, ...ciEvents.map((e) => e.city), ...bjEvents.map((e) => e.city)]) {
          const raw = (value || '').trim();
          if (!raw) continue;
          const key = raw.toLowerCase();
          if (!seen.has(key)) seen.set(key, raw);
        }
        setCitySuggestions([...seen.values()].sort((a, b) => a.localeCompare(b, 'fr')));
      })
      .catch(() => {});
    // destinations évolue après chaque mutation : on rafraîchit les
    // suggestions au passage (les villes saisies doivent rester proposées).
  }, [destinations]);

  const filtered = marketFilter === 'all' ? destinations : destinations.filter((d) => d.market === marketFilter);

  const openCreate = () => {
    setEditing(null);
    setForm(DEFAULT_FORM);
    setImageFile(null);
    setImagePreview(null);
    setPanelOpen(true);
  };

  const openEdit = (destination: AdminDestination) => {
    setEditing(destination);
    setForm({
      market: destination.market,
      city: destination.city,
      title: destination.title,
      description: destination.description || '',
      alt: destination.alt || '',
      featured: destination.featured === true,
    });
    setImageFile(null);
    setImagePreview(destination.img);
    setPanelOpen(true);
  };

  const closePanel = () => {
    setPanelOpen(false);
    setEditing(null);
    setImageFile(null);
    if (imagePreview && imagePreview.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    if (imagePreview && imagePreview.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      setImageFile(file);
      if (imagePreview && imagePreview.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSave = async () => {
    if (!form.city.trim() || !form.title.trim() || !form.description.trim()) {
      setError('Ville, titre et description sont obligatoires.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      let img = editing?.img || '';

      if (imageFile) {
        const result = await apiAdmin.uploadFile(imageFile);
        img = result.url;
      }

      if (!img) {
        setError('Veuillez sélectionner une image.');
        setSaving(false);
        return;
      }

      const payload = {
        market: form.market,
        city: form.city.trim(),
        title: form.title.trim(),
        description: form.description.trim(),
        alt: form.alt.trim(),
        featured: form.featured,
        img,
      };

      if (editing) await apiAdmin.updateDestination(editing.id, payload);
      else await apiAdmin.createDestination(payload);

      // Rechargement silencieux : le badge « grande carte » reflète la
      // décision serveur après l'ajout/modification.
      await loadDestinations({ silent: true });
      closePanel();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiAdmin.deleteDestination(id);
      await loadDestinations({ silent: true });
      setDeleteConfirm(null);
    } catch {
      setError('Erreur lors de la suppression.');
    }
  };

  return (
    <div className="dash">
      <div className="dash-page-head">
        <div>
          <h1>Destinations touristiques</h1>
          <p>Gérer les cartes de la section Tourisme</p>
          <p style={{ fontSize: '12px', color: 'var(--admin-ink-soft)', marginTop: '4px' }}>
            Une destination passe en grande carte quand sa ville a un événement qui commence dans les 30
            prochains jours — ou quand « Mettre en avant » est coché.
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
            <option value="CI">Côte d'Ivoire</option>
            <option value="BJ">Bénin</option>
          </select>
        </div>
      </div>

      {error && <div className="auth-error" style={{ marginBottom: '12px' }}>{error}</div>}

      {loading ? (
        <div className="panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--admin-ink-soft)' }}>Chargement...</div>
      ) : filtered.length === 0 ? (
        <div className="panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--admin-ink-soft)' }}>
          Aucune destination trouvée.
        </div>
      ) : (
        <>
          <div className="panel">
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Image</th>
                    <th>Titre</th>
                    <th>Ville</th>
                    <th>Marché</th>
                    <th>Statut</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((destination) => (
                    <tr key={destination.id}>
                      <td>
                        <img
                          src={destination.img || ''}
                          alt={destination.alt || destination.title}
                          style={{ width: '90px', height: '60px', objectFit: 'cover', borderRadius: '6px', background: 'var(--admin-mist-2, #f1f5f9)' }}
                        />
                      </td>
                      <td style={{ fontSize: '13px', maxWidth: '220px' }}>
                        <div style={{ fontWeight: 600 }}>{destination.title}</div>
                        <div style={{ color: 'var(--admin-ink-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {destination.description}
                        </div>
                      </td>
                      <td style={{ fontSize: '13px' }}>{destination.city}</td>
                      <td>
                        <span className={`admin-badge ${destination.market === 'CI' ? 'admin-badge--info' : 'admin-badge--success'}`}>
                          {destination.market}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {destination.featured && (
                            <span className="admin-badge admin-badge--success">Mise en avant</span>
                          )}
                          <span className={`admin-badge ${bigIds.has(destination.id) ? 'admin-badge--warning' : 'admin-badge--muted'}`}>
                            {bigIds.has(destination.id) ? 'Grande carte' : 'Petite carte'}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button className="admin-btn admin-btn--sm" onClick={() => openEdit(destination)}>Modifier</button>
                          <button className="admin-btn admin-btn--danger admin-btn--sm" onClick={() => setDeleteConfirm(destination.id)}>
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
            {filtered.map((destination) => (
              <div className="gerant-card" key={destination.id}>
                {destination.img && (
                  <img
                    src={destination.img}
                    alt={destination.alt || destination.title}
                    style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '6px', marginBottom: '10px' }}
                  />
                )}
                <div className="gerant-card__header">
                  <div className="gerant-card__info">
                    <span className="admin-badge admin-badge--danger">{destination.city}</span>
                    <span className={`admin-badge ${destination.market === 'CI' ? 'admin-badge--info' : 'admin-badge--success'}`}>
                      {destination.market}
                    </span>
                  </div>
                </div>
                <p style={{ fontSize: '14px', fontWeight: 600, margin: '6px 0 2px' }}>{destination.title}</p>
                <div className="gerant-card__meta">
                  <span className={`admin-badge ${bigIds.has(destination.id) ? 'admin-badge--warning' : 'admin-badge--muted'}`}>
                    {bigIds.has(destination.id) ? 'Grande carte' : 'Petite carte'}
                  </span>
                </div>
                <div className="gerant-card__actions">
                  <button className="admin-btn admin-btn--sm" onClick={() => openEdit(destination)}>Modifier</button>
                  <button className="admin-btn admin-btn--danger admin-btn--sm" onClick={() => setDeleteConfirm(destination.id)}>
                    Supprimer
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {deleteConfirm && (
        <div className="verify-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="verify-modal" onClick={(e) => e.stopPropagation()}>
            <div className="verify-modal__result verify-modal__result--unavailable">
              <div className="verify-modal__icon verify-modal__icon--unavailable">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
              </div>
              <p style={{ fontWeight: 600 }}>Supprimer cette destination ?</p>
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
            <h2>{editing ? 'Modifier la destination' : 'Ajouter une destination'}</h2>
            <button className="banner-slide-panel__close" onClick={closePanel}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>

          <div className="banner-slide-panel__body">
            <div className="banner-upload-zone" onClick={() => fileInputRef.current?.click()} onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}>
              {imagePreview ? (
                <img src={imagePreview} alt="Aperçu" className="banner-upload-zone__preview" />
              ) : (
                <>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--admin-ink-soft)" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                  <p>Cliquez ou glissez une image</p>
                  <span>JPEG, PNG, WebP, GIF — 2 Mo max</span>
                </>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
            </div>

            <label className="banner-field">
              <span>Marché</span>
              <select value={form.market} onChange={(e) => setForm({ ...form, market: e.target.value as 'CI' | 'BJ' })}>
                <option value="CI">Côte d'Ivoire</option>
                <option value="BJ">Bénin</option>
              </select>
            </label>

            <label className="banner-field">
              <span>Ville</span>
              <input
                type="text"
                list="admin-destination-city-options"
                placeholder="Ouidah, Abidjan..."
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
              <datalist id="admin-destination-city-options">
                {citySuggestions.map((city) => (
                  <option key={city} value={city} />
                ))}
              </datalist>
              <small style={{ color: 'var(--admin-ink-soft)' }}>
                Doit correspondre à la ville d'un événement pour basculer en grande carte.
              </small>
            </label>

            <label className="banner-field">
              <span>Titre</span>
              <input type="text" placeholder="Nom de la destination" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </label>

            <label className="banner-field">
              <span>Description</span>
              <textarea
                rows={5}
                maxLength={2000}
                placeholder="Description de la destination"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
              <small style={{ color: 'var(--admin-ink-soft)' }}>{form.description.length} / 2000</small>
            </label>

            <label className="banner-field">
              <span>Texte alternatif</span>
              <input type="text" placeholder="Description de l'image" value={form.alt} onChange={(e) => setForm({ ...form, alt: e.target.value })} />
            </label>

            <label className="banner-field">
              <span className="checkbox-label">
                <input
                  type="checkbox"
                  checked={form.featured}
                  onChange={(e) => setForm({ ...form, featured: e.target.checked })}
                />
                Mettre en avant (force la grande carte, même sans événement dans les 30 jours)
              </span>
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

import { useState, useEffect, useRef, useCallback } from 'react';
import { apiAdmin, type AdminBanner } from '../../lib/adminApi';

type SectionFilter = 'all' | AdminBanner['section'];

const SECTIONS: { key: AdminBanner['section']; label: string }[] = [
  { key: 'popular', label: 'Populaires' },
  { key: 'promos', label: 'Promos' },
  { key: 'categories', label: 'Catégories' },
  { key: 'events', label: 'Événements' },
];

const SECTION_COLORS: Record<string, string> = {
  popular: 'admin-badge--info',
  promos: 'admin-badge--warning',
  categories: 'admin-badge--success',
  events: 'admin-badge--danger',
};

interface FormData {
  section: AdminBanner['section'];
  market: 'CI' | 'BJ';
  link: string;
  alt: string;
  order: number;
}

const DEFAULT_FORM: FormData = { section: 'popular', market: 'CI', link: '', alt: '', order: 0 };

export default function AdminBannersPage() {
  const [banners, setBanners] = useState<AdminBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sectionFilter, setSectionFilter] = useState<SectionFilter>('all');
  const [marketFilter, setMarketFilter] = useState<string>('all');

  const [panelOpen, setPanelOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<AdminBanner | null>(null);
  const [form, setForm] = useState<FormData>(DEFAULT_FORM);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const loadBanners = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError('');
    try {
      const market = marketFilter !== 'all' ? marketFilter : undefined;
      const data = await apiAdmin.getBanners(market);
      if (!controller.signal.aborted) setBanners(data);
    } catch {
      if (!controller.signal.aborted) setError('Impossible de charger les bannières.');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [marketFilter]);

  useEffect(() => {
    loadBanners();
    return () => abortRef.current?.abort();
  }, [loadBanners]);

  const filtered = sectionFilter === 'all' ? banners : banners.filter((b) => b.section === sectionFilter);

  const openCreate = () => {
    setEditingBanner(null);
    setForm(DEFAULT_FORM);
    setImageFile(null);
    setImagePreview(null);
    setPanelOpen(true);
  };

  const openEdit = (banner: AdminBanner) => {
    setEditingBanner(banner);
    setForm({
      section: banner.section,
      market: banner.market,
      link: banner.link,
      alt: banner.alt || '',
      order: banner.order,
    });
    setImageFile(null);
    setImagePreview(banner.img);
    setPanelOpen(true);
  };

  const closePanel = () => {
    setPanelOpen(false);
    setEditingBanner(null);
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
    setSaving(true);
    setError('');
    try {
      let img = editingBanner?.img || '';

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
        section: form.section,
        market: form.market,
        link: form.link,
        alt: form.alt,
        order: form.order,
        img,
      };

      if (editingBanner) {
        const updated = await apiAdmin.updateBanner(editingBanner.id, payload);
        setBanners((prev) => prev.map((b) => (b.id === editingBanner.id ? updated : b)));
      } else {
        const created = await apiAdmin.createBanner(payload);
        setBanners((prev) => [...prev, created]);
      }
      closePanel();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiAdmin.deleteBanner(id);
      setBanners((prev) => prev.filter((b) => b.id !== id));
      setDeleteConfirm(null);
    } catch {
      setError('Erreur lors de la suppression.');
    }
  };

  const sectionTabs: { key: SectionFilter; label: string; count: number }[] = [
    { key: 'all', label: 'Toutes', count: banners.length },
    ...SECTIONS.map((s) => ({
      key: s.key as SectionFilter,
      label: s.label,
      count: banners.filter((b) => b.section === s.key).length,
    })),
  ];

  return (
    <div className="dash">
      <div className="dash-page-head">
        <div>
          <h1>Bannières</h1>
          <p>Gérer les bannières affichées sur le site</p>
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
        <div className="gerants-filter-card__tabs">
          {sectionTabs.map((t) => (
            <button
              key={t.key}
              className={`gerants-filter-card__tab ${sectionFilter === t.key ? 'gerants-filter-card__tab--active' : ''}`}
              onClick={() => setSectionFilter(t.key)}
            >
              {t.label}
              <span className="gerants-filter-card__badge">{t.count}</span>
            </button>
          ))}
        </div>
      </div>

      {error && <div className="auth-error" style={{ marginBottom: '12px' }}>{error}</div>}

      {loading ? (
        <div className="panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--admin-ink-soft)' }}>Chargement...</div>
      ) : filtered.length === 0 ? (
        <div className="panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--admin-ink-soft)' }}>
          Aucune bannière trouvée.
        </div>
      ) : (
        <>
          <div className="panel">
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Image</th>
                    <th>Section</th>
                    <th>Marché</th>
                    <th>Ordre</th>
                    <th>Lien</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((banner) => (
                    <tr key={banner.id}>
                      <td>
                        <img
                          src={banner.img}
                          alt={banner.alt || 'Bannière'}
                          style={{ width: '120px', height: '40px', objectFit: 'cover', borderRadius: '6px' }}
                        />
                      </td>
                      <td>
                        <span className={`admin-badge ${SECTION_COLORS[banner.section] || ''}`}>
                          {SECTIONS.find((s) => s.key === banner.section)?.label || banner.section}
                        </span>
                      </td>
                      <td>
                        <span className={`admin-badge ${banner.market === 'CI' ? 'admin-badge--info' : 'admin-badge--success'}`}>
                          {banner.market}
                        </span>
                      </td>
                      <td style={{ fontSize: '13px', color: 'var(--admin-ink-soft)' }}>{banner.order}</td>
                      <td style={{ fontSize: '13px', color: 'var(--admin-ink-soft)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {banner.link}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button className="admin-btn admin-btn--sm" onClick={() => openEdit(banner)}>Modifier</button>
                          <button className="admin-btn admin-btn--danger admin-btn--sm" onClick={() => setDeleteConfirm(banner.id)}>
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
            {filtered.map((banner) => (
              <div className="gerant-card" key={banner.id}>
                <img
                  src={banner.img}
                  alt={banner.alt || 'Bannière'}
                  style={{ width: '100%', height: '60px', objectFit: 'cover', borderRadius: '6px', marginBottom: '10px' }}
                />
                <div className="gerant-card__header">
                  <div className="gerant-card__info">
                    <span className={`admin-badge ${SECTION_COLORS[banner.section] || ''}`}>
                      {SECTIONS.find((s) => s.key === banner.section)?.label || banner.section}
                    </span>
                    <span className={`admin-badge ${banner.market === 'CI' ? 'admin-badge--info' : 'admin-badge--success'}`}>
                      {banner.market}
                    </span>
                  </div>
                </div>
                <div className="gerant-card__meta">
                  <span className="gerant-card__date">Ordre: {banner.order}</span>
                </div>
                <div className="gerant-card__actions">
                  <button className="admin-btn admin-btn--sm" onClick={() => openEdit(banner)}>Modifier</button>
                  <button className="admin-btn admin-btn--danger admin-btn--sm" onClick={() => setDeleteConfirm(banner.id)}>
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
              <p style={{ fontWeight: 600 }}>Supprimer cette bannière ?</p>
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
            <h2>{editingBanner ? 'Modifier la bannière' : 'Ajouter une bannière'}</h2>
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
              <span>Section</span>
              <select value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value as AdminBanner['section'] })}>
                {SECTIONS.map((s) => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </select>
            </label>

            <label className="banner-field">
              <span>Marché</span>
              <select value={form.market} onChange={(e) => setForm({ ...form, market: e.target.value as 'CI' | 'BJ' })}>
                <option value="CI">Côte d'Ivoire</option>
                <option value="BJ">Bénin</option>
              </select>
            </label>

            <label className="banner-field">
              <span>Lien</span>
              <input type="url" placeholder="https://..." value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} />
            </label>

            <label className="banner-field">
              <span>Texte alternatif</span>
              <input type="text" placeholder="Description de la bannière" value={form.alt} onChange={(e) => setForm({ ...form, alt: e.target.value })} />
            </label>

            <label className="banner-field">
              <span>Ordre d'affichage</span>
              <input type="number" min={0} max={10000} value={form.order} onChange={(e) => setForm({ ...form, order: Number(e.target.value) })} />
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

import { MARKETS, type MarketCode } from '../../config/markets';

import { useState, useEffect, useRef, useCallback } from 'react';
import { apiAdmin, type AdminEvent } from '../../lib/adminApi';
import { apiRooms } from '../../lib/api';

type CityFilter = 'all' | string;

interface FormData {
  market: MarketCode;
  city: string;
  title: string;
  description: string;
  event_date: string;
  alt: string;
}

const DEFAULT_FORM: FormData = {
  market: 'CI',
  city: '',
  title: '',
  description: '',
  event_date: '',
  alt: '',
};

function formatDateFr(isoDate: string): string {
  return isoDate ? isoDate.split('-').reverse().join('/') : '';
}

export default function AdminEventsPage() {
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [marketFilter, setMarketFilter] = useState<string>('all');
  const [cityFilter, setCityFilter] = useState<CityFilter>('all');

  const [panelOpen, setPanelOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<AdminEvent | null>(null);
  const [form, setForm] = useState<FormData>(DEFAULT_FORM);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [roomCities, setRoomCities] = useState<string[]>([]);
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

  // GET /events exige ?market= : on charge les deux marchés puis on filtre
  // côté client, pour que « Tous les marchés » reste possible.
  const loadEvents = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError('');
    try {
      const [ci, bj] = await Promise.all([apiAdmin.getEvents('CI'), apiAdmin.getEvents('BJ')]);
      if (controller.signal.aborted) return;
      setEvents(
        [...ci, ...bj].sort((a, b) =>
          a.event_date < b.event_date ? -1 : a.event_date > b.event_date ? 1 : a.id < b.id ? -1 : 1,
        ),
      );
    } catch {
      if (!controller.signal.aborted) setError("Impossible de charger les événements.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEvents();
    return () => abortRef.current?.abort();
  }, [loadEvents]);

  // Villes déjà utilisées par les biens — suggestions de saisie pour éviter
  // les libellés non alignés entre événements et biens.
  useEffect(() => {
    apiRooms.villes().then(setRoomCities).catch(() => {});
  }, []);

  const byMarket = marketFilter === 'all' ? events : events.filter((e) => e.market === marketFilter);
  const filtered = cityFilter === 'all' ? byMarket : byMarket.filter((e) => e.city === cityFilter);

  // Union événements + biens, dédup (casse) en gardant la première occurrence.
  const citySuggestions = (() => {
    const seen = new Map<string, string>();
    for (const value of [...events.map((e) => e.city), ...roomCities]) {
      const raw = (value || '').trim();
      if (!raw) continue;
      const key = raw.toLowerCase();
      if (!seen.has(key)) seen.set(key, raw);
    }
    return [...seen.values()].sort((a, b) => a.localeCompare(b, 'fr'));
  })();

  const cityTabs: { key: CityFilter; label: string; count: number }[] = [
    { key: 'all', label: 'Toutes', count: byMarket.length },
    ...Array.from(new Set(byMarket.map((e) => e.city)))
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
      .map((city) => ({
        key: city as CityFilter,
        label: city,
        count: byMarket.filter((e) => e.city === city).length,
      })),
  ];

  const openCreate = () => {
    setEditingEvent(null);
    setForm(DEFAULT_FORM);
    setImageFile(null);
    setImagePreview(null);
    setPanelOpen(true);
  };

  const openEdit = (event: AdminEvent) => {
    setEditingEvent(event);
    setForm({
      market: event.market,
      city: event.city,
      title: event.title,
      description: event.description || '',
      event_date: event.event_date,
      alt: event.alt || '',
    });
    setImageFile(null);
    setImagePreview(event.img);
    setPanelOpen(true);
  };

  const closePanel = () => {
    setPanelOpen(false);
    setEditingEvent(null);
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
    if (!form.city.trim() || !form.title.trim() || !form.event_date) {
      setError('Ville, titre et date sont obligatoires.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      let img = editingEvent?.img || '';

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
        event_date: form.event_date,
        alt: form.alt.trim(),
        img,
      };

      if (editingEvent) {
        const updated = await apiAdmin.updateEvent(editingEvent.id, payload);
        setEvents((prev) => prev.map((e) => (e.id === editingEvent.id ? updated : e)));
      } else {
        const created = await apiAdmin.createEvent(payload);
        setEvents((prev) => [...prev, created]);
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
      await apiAdmin.deleteEvent(id);
      setEvents((prev) => prev.filter((e) => e.id !== id));
      setDeleteConfirm(null);
    } catch {
      setError('Erreur lors de la suppression.');
    }
  };

  return (
    <div className="dash">
      <div className="dash-page-head">
        <div>
          <h1>Événements</h1>
          <p>Gérer les événements affichés par ville sur le site</p>
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
            onChange={(e) => {
              setMarketFilter(e.target.value);
              setCityFilter('all');
            }}
          >
            <option value="all">Tous les marchés</option>
            {MARKETS.map((m) => (
              <option key={m.code} value={m.code}>{m.label}</option>
            ))}
          </select>
        </div>
        <div className="gerants-filter-card__tabs">
          {cityTabs.map((t) => (
            <button
              key={t.key}
              className={`gerants-filter-card__tab ${cityFilter === t.key ? 'gerants-filter-card__tab--active' : ''}`}
              onClick={() => setCityFilter(t.key)}
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
          Aucun événement trouvé.
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
                    <th>Date</th>
                    <th>Marché</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((event) => (
                    <tr key={event.id}>
                      <td>
                        <img
                          src={event.img || ''}
                          alt={event.alt || event.title}
                          style={{ width: '90px', height: '60px', objectFit: 'cover', borderRadius: '6px', background: 'var(--admin-mist-2, #f1f5f9)' }}
                        />
                      </td>
                      <td style={{ fontSize: '13px', maxWidth: '220px' }}>
                        <div style={{ fontWeight: 600 }}>{event.title}</div>
                        <div style={{ color: 'var(--admin-ink-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {event.description}
                        </div>
                      </td>
                      <td style={{ fontSize: '13px' }}>{event.city}</td>
                      <td style={{ fontSize: '13px', whiteSpace: 'nowrap' }}>{formatDateFr(event.event_date)}</td>
                      <td>
                        <span className={`admin-badge ${event.market === 'CI' ? 'admin-badge--info' : 'admin-badge--success'}`}>
                          {event.market}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button className="admin-btn admin-btn--sm" onClick={() => openEdit(event)}>Modifier</button>
                          <button className="admin-btn admin-btn--danger admin-btn--sm" onClick={() => setDeleteConfirm(event.id)}>
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
            {filtered.map((event) => (
              <div className="gerant-card" key={event.id}>
                {event.img && (
                  <img
                    src={event.img}
                    alt={event.alt || event.title}
                    style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '6px', marginBottom: '10px' }}
                  />
                )}
                <div className="gerant-card__header">
                  <div className="gerant-card__info">
                    <span className="admin-badge admin-badge--danger">{event.city}</span>
                    <span className={`admin-badge ${event.market === 'CI' ? 'admin-badge--info' : 'admin-badge--success'}`}>
                      {event.market}
                    </span>
                  </div>
                </div>
                <p style={{ fontSize: '14px', fontWeight: 600, margin: '6px 0 2px' }}>{event.title}</p>
                <div className="gerant-card__meta">
                  <span className="gerant-card__date">{formatDateFr(event.event_date)}</span>
                </div>
                <div className="gerant-card__actions">
                  <button className="admin-btn admin-btn--sm" onClick={() => openEdit(event)}>Modifier</button>
                  <button className="admin-btn admin-btn--danger admin-btn--sm" onClick={() => setDeleteConfirm(event.id)}>
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
              <p style={{ fontWeight: 600 }}>Supprimer cet événement ?</p>
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
            <h2>{editingEvent ? "Modifier l'événement" : 'Ajouter un événement'}</h2>
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
              <select value={form.market} onChange={(e) => setForm({ ...form, market: e.target.value as MarketCode })}>
                {MARKETS.map((m) => (
                  <option key={m.code} value={m.code}>{m.label}</option>
                ))}
              </select>
            </label>

            <label className="banner-field">
              <span>Ville</span>
              <input
                type="text"
                list="admin-event-city-options"
                placeholder="Cotonou, Abidjan..."
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
              <datalist id="admin-event-city-options">
                {citySuggestions.map((city) => (
                  <option key={city} value={city} />
                ))}
              </datalist>
            </label>

            <label className="banner-field">
              <span>Titre</span>
              <input type="text" placeholder="Nom de l'événement" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </label>

            <label className="banner-field">
              <span>Date</span>
              <input type="date" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} />
            </label>

            <label className="banner-field">
              <span>Description</span>
              <textarea
                rows={5}
                maxLength={2000}
                placeholder="Description de l'événement"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
              <small style={{ color: 'var(--admin-ink-soft)' }}>{form.description.length} / 2000</small>
            </label>

            <label className="banner-field">
              <span>Texte alternatif</span>
              <input type="text" placeholder="Description de l'image" value={form.alt} onChange={(e) => setForm({ ...form, alt: e.target.value })} />
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

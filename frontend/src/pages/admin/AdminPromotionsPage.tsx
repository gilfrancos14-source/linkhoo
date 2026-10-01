import { useState, useEffect, useCallback, useRef } from 'react';
import { apiAdmin } from '../../lib/adminApi';
import { apiRooms, type RoomData } from '../../lib/api';
import { priceWithCurrency } from '../../lib/roomDisplay';

type PromoKey = 'promo_15' | 'promo_10' | 'promo_5';

interface PromoSection {
  key: PromoKey;
  label: string;
  badge: string;
  color: string;
}

const PROMO_SECTIONS: PromoSection[] = [
  { key: 'promo_15', label: 'Offres à -15 %', badge: '-15 %', color: 'admin-badge--danger' },
  { key: 'promo_10', label: 'Offres à -10 %', badge: '-10 %', color: 'admin-badge--warning' },
  { key: 'promo_5', label: 'Offres à -5 %', badge: '-5 %', color: 'admin-badge--success' },
];

export default function AdminPromotionsPage() {
  const [rooms, setRooms] = useState<RoomData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [marketFilter, setMarketFilter] = useState<string>('CI');
  const [activeSection, setActiveSection] = useState<PromoKey>('promo_15');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const [dateModal, setDateModal] = useState<string | null>(null);
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const loadRooms = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError('');
    try {
      // Toujours fraîche : une chambre ajoutée/modifiée par un autre admin
      // doit apparaître ici sans attendre l'expiration du cache public (60 s).
      const data = await apiRooms.list(marketFilter, { fresh: true });
      if (!controller.signal.aborted) setRooms(data);
    } catch {
      if (!controller.signal.aborted) setError('Impossible de charger les chambres.');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [marketFilter]);

  useEffect(() => {
    loadRooms();
    return () => abortRef.current?.abort();
  }, [loadRooms]);

  const currentSection = PROMO_SECTIONS.find((s) => s.key === activeSection)!;

  const filteredRooms = rooms.filter((r) => {
    if (search) {
      const term = search.toLowerCase();
      const matchTitle = r.title?.toLowerCase().includes(term);
      const matchGerant = (r as any).gerant?.nom?.toLowerCase().includes(term) ||
        (r as any).gerant?.prenom?.toLowerCase().includes(term);
      if (!matchTitle && !matchGerant) return false;
    }
    return true;
  });

  const roomsInGroup = filteredRooms.filter((r) => r.promo_group === activeSection);
  const availableRooms = filteredRooms.filter((r) => r.promo_group !== activeSection);

  const isExpired = (room: RoomData) => {
    if (!room.promo_end) return false;
    return new Date(room.promo_end) < new Date();
  };

  const handleToggle = async (room: RoomData) => {
    const roomId = room.id;
    setSaving(roomId);
    setError('');
    try {
      const newGroup = room.promo_group === activeSection ? null : activeSection;
      const start = newGroup ? (room.promo_start || new Date().toISOString()) : null;
      const end = newGroup ? (room.promo_end || null) : null;
      const updated = await apiAdmin.updateRoomPromoGroup(roomId, {
        promo_group: newGroup,
        promo_start: start,
        promo_end: end,
      });
      setRooms((prev) => prev.map((r) => r.id === roomId ? { ...r, ...updated } : r));
    } catch {
      setError('Erreur lors de la mise à jour.');
    } finally {
      setSaving(null);
    }
  };

  const openDateModal = (room: RoomData) => {
    setDateModal(room.id);
    setDateStart(room.promo_start ? new Date(room.promo_start).toISOString().slice(0, 16) : '');
    setDateEnd(room.promo_end ? new Date(room.promo_end).toISOString().slice(0, 16) : '');
  };

  const handleSaveDates = async () => {
    if (!dateModal) return;
    setSaving(dateModal);
    setError('');
    try {
      const updated = await apiAdmin.updateRoomPromoGroup(dateModal, {
        promo_group: activeSection,
        promo_start: dateStart ? new Date(dateStart).toISOString() : null,
        promo_end: dateEnd ? new Date(dateEnd).toISOString() : null,
      });
      setRooms((prev) => prev.map((r) => r.id === dateModal ? { ...r, ...updated } : r));
      setDateModal(null);
    } catch {
      setError('Erreur lors de la sauvegarde des dates.');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="dash">
      <div className="dash-page-head">
        <div>
          <h1>Promotions</h1>
          <p>Gérer les chambres assignées à chaque offre promotionnelle</p>
        </div>
      </div>

      <div className="gerants-filter-card">
        <div className="gerants-filter-card__top">
          <div className="gerants-filter-card__divider" />
          <select
            className="gerants-filter-card__select"
            value={marketFilter}
            onChange={(e) => setMarketFilter(e.target.value)}
          >
            <option value="CI">Côte d'Ivoire</option>
            <option value="BJ">Bénin</option>
          </select>
        </div>
        <div className="gerants-filter-card__tabs">
          {PROMO_SECTIONS.map((s) => {
            const count = rooms.filter((r) => r.promo_group === s.key).length;
            return (
              <button
                key={s.key}
                className={`gerants-filter-card__tab ${activeSection === s.key ? 'gerants-filter-card__tab--active' : ''}`}
                onClick={() => { setActiveSection(s.key); setSearch(''); }}
              >
                {s.badge}
                <span className="gerants-filter-card__badge">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {error && <div className="auth-error" style={{ marginBottom: '12px' }}>{error}</div>}

      <div className="panel" style={{ marginBottom: '16px' }}>
        <label className="banner-field" style={{ marginBottom: 0 }}>
          <span>Rechercher une chambre ou un gérant</span>
          <input
            type="text"
            placeholder="Nom du chambre ou du gérant..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>

      {loading ? (
        <div className="panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--admin-ink-soft)' }}>Chargement...</div>
      ) : (
        <>
          <div className="panel" style={{ marginBottom: '16px' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: 600 }}>
              Chambres dans {currentSection.label}
              <span className={`admin-badge ${currentSection.color}`} style={{ marginLeft: '8px' }}>{roomsInGroup.length}</span>
            </h3>
            {roomsInGroup.length === 0 ? (
              <p style={{ color: 'var(--admin-ink-soft)', fontSize: '14px' }}>
                Aucune chambre assignée à cette promotion. Ajoutez des chambres ci-dessous.
              </p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Chambre</th>
                      <th>Gérant</th>
                      <th>Prix</th>
                      <th>Début</th>
                      <th>Fin</th>
                      <th>État</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roomsInGroup.map((room) => (
                      <tr key={room.id}>
                        <td style={{ fontWeight: 500 }}>{room.title}</td>
                        <td style={{ fontSize: '13px', color: 'var(--admin-ink-soft)' }}>
                          {(room as any).gerant?.prenom} {(room as any).gerant?.nom}
                        </td>
                        <td style={{ fontSize: '13px' }}>{priceWithCurrency(room.price, room.price_unit)}</td>
                        <td style={{ fontSize: '13px' }}>
                          {room.promo_start ? new Date(room.promo_start).toLocaleDateString('fr-FR') : '—'}
                        </td>
                        <td style={{ fontSize: '13px' }}>
                          {room.promo_end ? new Date(room.promo_end).toLocaleDateString('fr-FR') : '—'}
                        </td>
                        <td>
                          {isExpired(room) ? (
                            <span className="admin-badge admin-badge--danger">Expirée</span>
                          ) : room.promo_end ? (
                            <span className="admin-badge admin-badge--success">Active</span>
                          ) : (
                            <span className="admin-badge admin-badge--info">Sans date</span>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button className="admin-btn admin-btn--sm" onClick={() => openDateModal(room)}>
                              Dates
                            </button>
                            <button
                              className="admin-btn admin-btn--danger admin-btn--sm"
                              onClick={() => handleToggle(room)}
                              disabled={saving === room.id}
                            >
                              Retirer
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="panel">
            <h3 style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: 600 }}>
              Chambres disponibles
              <span className="admin-badge admin-badge--info" style={{ marginLeft: '8px' }}>{availableRooms.length}</span>
            </h3>
            {availableRooms.length === 0 ? (
              <p style={{ color: 'var(--admin-ink-soft)', fontSize: '14px' }}>
                Aucune chambre disponible à ajouter.
              </p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Chambre</th>
                      <th>Gérant</th>
                      <th>Prix</th>
                      <th>Catégorie</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {availableRooms.map((room) => (
                      <tr key={room.id}>
                        <td style={{ fontWeight: 500 }}>{room.title}</td>
                        <td style={{ fontSize: '13px', color: 'var(--admin-ink-soft)' }}>
                          {(room as any).gerant?.prenom} {(room as any).gerant?.nom}
                        </td>
                        <td style={{ fontSize: '13px' }}>{priceWithCurrency(room.price, room.price_unit)}</td>
                        <td style={{ fontSize: '13px', color: 'var(--admin-ink-soft)' }}>{room.category}</td>
                        <td>
                          <button
                            className="admin-btn admin-btn--success admin-btn--sm"
                            onClick={() => handleToggle(room)}
                            disabled={saving === room.id}
                          >
                            {saving === room.id ? '...' : 'Ajouter'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {dateModal && (
        <div className="verify-overlay" onClick={() => setDateModal(null)}>
          <div className="verify-modal" onClick={(e) => e.stopPropagation()}>
            <div className="verify-modal__result">
              <p style={{ fontWeight: 600, marginBottom: '16px' }}>Définir la période promotionnelle</p>
              <label className="banner-field">
                <span>Date de début</span>
                <input
                  type="datetime-local"
                  value={dateStart}
                  onChange={(e) => setDateStart(e.target.value)}
                />
              </label>
              <label className="banner-field">
                <span>Date de fin</span>
                <input
                  type="datetime-local"
                  value={dateEnd}
                  onChange={(e) => setDateEnd(e.target.value)}
                />
              </label>
              <div className="verify-modal__actions">
                <button className="admin-btn admin-btn--success" onClick={handleSaveDates} disabled={saving === dateModal}>
                  {saving === dateModal ? 'Enregistrement...' : 'Enregistrer'}
                </button>
                <button className="admin-btn" onClick={() => setDateModal(null)}>Annuler</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

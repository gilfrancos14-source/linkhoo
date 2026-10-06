import { useCallback, useEffect, useState } from 'react';
import { MARKETS } from '../../config/markets';
import { apiAdmin, type AdminBoostItem } from '../../lib/adminApi';
import type { BoostDisplayStatus } from '../../lib/api';
import {
  boostAmount,
  boostDateRange,
  boostModeLabels,
  boostStatusLabels,
} from '../../lib/boosts';

// Valeurs acceptées par GET /admin/boosts (adminBoostsQuerySchema côté serveur).
const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Tous les statuts' },
  { value: 'active', label: 'Actives' },
  { value: 'paused', label: 'En pause' },
  { value: 'pending', label: 'Paiement en attente' },
  { value: 'exhausted', label: 'Budget épuisé' },
  { value: 'canceled', label: 'Annulées' },
];

function gerantLabel(item: AdminBoostItem): string {
  const { prenom, nom, email } = item.gerant ?? {};
  const name = [prenom, nom].filter(Boolean).join(' ').trim();
  return name || email || '—';
}

export default function AdminBoostsPage() {
  const [items, setItems] = useState<AdminBoostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [marketFilter, setMarketFilter] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiAdmin.getBoosts({
        status: statusFilter || undefined,
        market: marketFilter || undefined,
      });
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch {
      setError('Impossible de charger les campagnes.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, marketFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = async (item: AdminBoostItem) => {
    const next: 'active' | 'paused' = item.status === 'active' ? 'paused' : 'active';
    setSavingId(item.id);
    setActionError('');
    try {
      const updated = await apiAdmin.setBoostStatus(item.id, next);
      setItems((prev) =>
        prev.map((row) =>
          row.id === item.id
            ? {
                ...row,
                status: updated.status,
                display_status: updated.display_status as BoostDisplayStatus,
                spent: updated.spent,
                remaining: updated.remaining,
              }
            : row,
        ),
      );
    } catch (err) {
      // 409 serveur (pending / canceled / budget épuisé) : on affiche son mot.
      setActionError(
        err instanceof Error && err.message ? err.message : 'Mise à jour impossible.',
      );
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="dash">
      <div className="dash-page-head">
        <div>
          <h1>Booster</h1>
          <p>Superviser les campagnes sponsorisées des gérants</p>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 16,
            padding: '4px 0',
          }}
        >
          <div className="boost-field">
            <label htmlFor="admin-boost-status">Statut</label>
            <select
              id="admin-boost-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="boost-field">
            <label htmlFor="admin-boost-market">Marché</label>
            <select
              id="admin-boost-market"
              value={marketFilter}
              onChange={(e) => setMarketFilter(e.target.value)}
            >
              <option value="">Tous les marchés</option>
              {MARKETS.map((m) => (
                <option key={m.code} value={m.code}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: '12px 16px',
            background: '#FEE2E2',
            border: '1px solid #FECACA',
            borderRadius: 10,
            color: '#991B1B',
            fontSize: 13.5,
            marginBottom: 12,
          }}
        >
          {error}{' '}
          <button className="admin-btn admin-btn--sm" onClick={() => load()}>
            Réessayer
          </button>
        </div>
      )}

      {actionError && (
        <div
          style={{
            padding: '12px 16px',
            background: '#FEF3C7',
            border: '1px solid #FDE68A',
            borderRadius: 10,
            color: '#92400E',
            fontSize: 13.5,
            marginBottom: 12,
          }}
          role="alert"
        >
          {actionError}
        </div>
      )}

      {loading ? (
        <div
          className="panel"
          style={{ padding: '40px', textAlign: 'center', color: 'var(--admin-ink-soft)' }}
        >
          Chargement...
        </div>
      ) : items.length === 0 ? (
        <div className="panel" style={{ padding: '40px', textAlign: 'center' }}>
          <p style={{ margin: 0, color: 'var(--admin-ink-soft)', fontSize: 14 }}>
            Aucune campagne pour ces filtres.
          </p>
        </div>
      ) : (
        <div className="panel">
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Chambre</th>
                  <th>Gérant</th>
                  <th>Marché</th>
                  <th>Mode</th>
                  <th>Statut</th>
                  <th>Budget</th>
                  <th>Période</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const canToggle = item.status === 'active' || item.status === 'paused';
                  return (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 500 }}>{item.room?.title ?? 'Chambre'}</td>
                      <td style={{ fontSize: '13px', color: 'var(--admin-ink-soft)' }}>
                        {gerantLabel(item)}
                      </td>
                      <td style={{ fontSize: '13px' }}>{item.market}</td>
                      <td style={{ fontSize: '13px' }}>{boostModeLabels[item.mode]}</td>
                      <td>
                        <span className={`boost-pill boost-pill--${item.display_status}`}>
                          {boostStatusLabels[item.display_status]}
                        </span>
                      </td>
                      <td style={{ fontSize: '13px' }}>
                        {boostAmount(item.spent)} / {boostAmount(item.budget_total)}
                      </td>
                      <td style={{ fontSize: '13px', color: 'var(--admin-ink-soft)' }}>
                        {boostDateRange(item.starts_at, item.ends_at)}
                      </td>
                      <td>
                        {canToggle ? (
                          <button
                            className={`admin-btn admin-btn--sm ${
                              item.status === 'active'
                                ? 'admin-btn--danger'
                                : 'admin-btn--success'
                            }`}
                            disabled={savingId === item.id}
                            onClick={() => toggle(item)}
                          >
                            {savingId === item.id
                              ? '...'
                              : item.status === 'active'
                                ? 'Suspendre'
                                : 'Reprendre'}
                          </button>
                        ) : (
                          <span style={{ color: 'var(--admin-ink-soft)' }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

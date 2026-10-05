import { useState, useEffect } from 'react';
import {
  apiAdmin,
  type AdminReservation,
  type AdminReservationCounts,
} from '../../lib/adminApi';

const ITEMS_PER_PAGE = 10;

const ZERO_COUNTS: AdminReservationCounts = {
  total: 0,
  pending: 0,
  confirmed: 0,
  cancelled: 0,
};

function countKeyOf(statut: string): keyof AdminReservationCounts | null {
  if (statut === 'en_attente') return 'pending';
  if (statut === 'confirmee') return 'confirmed';
  if (statut === 'annulee') return 'cancelled';
  return null;
}

export default function AdminReservationsPage() {
  const [reservations, setReservations] = useState<AdminReservation[]>([]);
  const [counts, setCounts] = useState<AdminReservationCounts>(ZERO_COUNTS);
  const [total, setTotal] = useState(0);
  const [ready, setReady] = useState(false);
  const [filterStatut, setFilterStatut] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [checkingId, setCheckingId] = useState<string | null>(null);

  // Filtrage (statut, recherche) et pagination sont délégués au serveur
  // (RPC admin_reservations en SQL) : chaque changement reinterroge la page
  // courante. Les anciens résultats restent affichés pendant le refetch
  // pour ne pas faire clignoter le tableau ni perdre le focus du champ de
  // recherche.
  useEffect(() => {
    let cancelled = false;
    apiAdmin
      .getReservations({
        statut: filterStatut,
        search,
        page: currentPage,
        limit: ITEMS_PER_PAGE,
      })
      .then((data) => {
        if (cancelled) return;
        setReservations(data.items);
        setTotal(data.total);
        setCounts(data.counts);
      })
      .catch(() => {
        if (cancelled) return;
        setReservations([]);
        setTotal(0);
        setCounts(ZERO_COUNTS);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [filterStatut, search, currentPage]);

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  const handleCheckAvailability = async (reservation: AdminReservation) => {
    setCheckingId(reservation.id);
    try {
      const result = await apiAdmin.checkAvailability(reservation.id);
      setReservations((prev) =>
        prev.map((r) => r.id === reservation.id ? { ...r, statut: result.statut as AdminReservation['statut'] } : r)
      );
      // Mise à jour optimiste des compteurs du haut (le service vient de
      // changer le statut) — un refetch complète le reste si besoin.
      const from = countKeyOf(reservation.statut);
      const to = countKeyOf(result.statut);
      if (from && to && from !== to) {
        setCounts((prev) => ({
          ...prev,
          [from]: Math.max(0, prev[from] - 1),
          [to]: prev[to] + 1,
        }));
      }
    } catch {
      // keep current state
    } finally {
      setCheckingId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('fr-FR');
  };

  if (!ready) {
    return (
      <div className="admin-page">
        <div className="admin-page__header">
          <h2>Réservations</h2>
        </div>
        <p style={{ color: 'var(--admin-ink-soft)' }}>Chargement...</p>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-page__header">
        <h2>Réservations</h2>
        <span className="admin-page__subtitle">
          Gérants non qualifiés — {counts.pending} en attente
        </span>
      </div>

      <div className="admin-stats" style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {[
          { label: 'Total', value: counts.total, color: 'var(--admin-ink)' },
          { label: 'En attente', value: counts.pending, color: '#F59E0B' },
          { label: 'Confirmées', value: counts.confirmed, color: '#22c55e' },
          { label: 'Annulées', value: counts.cancelled, color: '#EF4444' },
        ].map((s) => (
          <div key={s.label} style={{
            padding: '12px 20px', borderRadius: '8px',
            background: 'var(--admin-card-bg)', border: '1px solid var(--admin-line)',
            minWidth: '120px', flex: '1',
          }}>
            <div style={{ fontSize: '12px', color: 'var(--admin-ink-soft)' }}>{s.label}</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="admin-filters">
        <input
          type="text"
          placeholder="Rechercher par client ou chambre..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
          className="admin-input"
        />
        <select
          value={filterStatut}
          onChange={(e) => { setFilterStatut(e.target.value); setCurrentPage(1); }}
          className="admin-select"
        >
          <option value="all">Tous statuts</option>
          <option value="en_attente">En attente</option>
          <option value="confirmee">Confirmée</option>
          <option value="annulee">Annulée</option>
        </select>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Client</th>
              <th>Chambre</th>
              <th>Dates</th>
              <th>Montant</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {reservations.map((res) => (
              <tr key={res.id}>
                <td>
                  <div style={{ fontWeight: 500 }}>{res.client_name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--admin-ink-soft)' }}>{res.client_email}</div>
                  {res.client_phone && (
                    <div style={{ fontSize: '12px', color: 'var(--admin-ink-soft)' }}>{res.client_phone}</div>
                  )}
                </td>
                <td>{res.room_title}</td>
                <td className="admin-table__dates">
                  <span>{formatDate(res.date_debut)}</span>
                  <span> → {formatDate(res.date_fin)}</span>
                </td>
                <td className="admin-table__price">{res.montant?.toLocaleString()} FCFA</td>
                <td>
                  <span className={`admin-badge admin-badge--${res.statut === 'confirmee' ? 'success' : res.statut === 'annulee' ? 'danger' : 'warning'}`}>
                    <span className="badge-dot"></span>
                    {res.statut === 'confirmee' ? 'Confirmée' : res.statut === 'annulee' ? 'Annulée' : 'En attente'}
                  </span>
                </td>
                <td>
                  <div className="admin-table__actions">
                    {res.statut === 'en_attente' && (
                      <button
                        className="admin-btn admin-btn--sm admin-btn--primary"
                        onClick={() => handleCheckAvailability(res)}
                        disabled={checkingId === res.id}
                      >
                        {checkingId === res.id ? '...' : 'Vérifier dispo'}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {reservations.length === 0 && (
              <tr>
                <td colSpan={6} className="admin-table__empty">Aucune réservation trouvée</td>
              </tr>
            )}
          </tbody>
        </table>
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
    </div>
  );
}

import { useState, useEffect, useMemo } from 'react';
import { apiAdmin, type AdminReservation } from '../../lib/adminApi';

export default function AdminReservationsPage() {
  const [reservations, setReservations] = useState<AdminReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatut, setFilterStatut] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await apiAdmin.getReservations();
      setReservations(data);
    } catch {
      setReservations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const filtered = useMemo(() => {
    return reservations.filter((r) => {
      const matchStatut = filterStatut === 'all' || r.statut === filterStatut;
      const matchSearch = !search ||
        r.client_name?.toLowerCase().includes(search.toLowerCase()) ||
        r.room_title?.toLowerCase().includes(search.toLowerCase()) ||
        r.client_email?.toLowerCase().includes(search.toLowerCase());
      return matchStatut && matchSearch;
    });
  }, [reservations, filterStatut, search]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleCheckAvailability = async (reservation: AdminReservation) => {
    setCheckingId(reservation.id);
    try {
      const result = await apiAdmin.checkAvailability(reservation.id);
      setReservations((prev) =>
        prev.map((r) => r.id === reservation.id ? { ...r, statut: result.statut as AdminReservation['statut'] } : r)
      );
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

  const stats = useMemo(() => ({
    total: reservations.length,
    pending: reservations.filter((r) => r.statut === 'en_attente').length,
    confirmed: reservations.filter((r) => r.statut === 'confirmee').length,
    cancelled: reservations.filter((r) => r.statut === 'annulee').length,
  }), [reservations]);

  if (loading) {
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
          Gérants non qualifiés — {stats.pending} en attente
        </span>
      </div>

      <div className="admin-stats" style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {[
          { label: 'Total', value: stats.total, color: 'var(--admin-ink)' },
          { label: 'En attente', value: stats.pending, color: '#F59E0B' },
          { label: 'Confirmées', value: stats.confirmed, color: '#22c55e' },
          { label: 'Annulées', value: stats.cancelled, color: '#EF4444' },
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
        <select value={filterStatut} onChange={(e) => { setFilterStatut(e.target.value); setCurrentPage(1); }} className="admin-select">
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
            {paginated.map((res) => (
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
            {paginated.length === 0 && (
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

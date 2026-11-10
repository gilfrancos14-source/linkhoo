import { useState, useEffect } from 'react';
import {
  CalendarDays,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  Building2,
  Phone,
  Mail,
  Check,
} from 'lucide-react';
import {
  apiAdmin,
  type AdminReservation,
  type AdminReservationCounts,
} from '../../lib/adminApi';
import { priceWithCurrency } from '../../lib/roomDisplay';
import { formatDate as formatDateFr } from '../../lib/formatDate';
import '../../styles/22-admin-dashboard.css';

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

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return 'CL';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function AdminReservationsPage() {
  const [reservations, setReservations] = useState<AdminReservation[]>([]);
  const [counts, setCounts] = useState<AdminReservationCounts>(ZERO_COUNTS);
  const [total, setTotal] = useState(0);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [filterStatut, setFilterStatut] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  // Filtrage (statut, recherche) et pagination sont délégués au serveur
  // (RPC admin_reservations en SQL) : chaque changement reinterroge la page
  // courante. Les anciens résultats restent affichés pendant le refetch
  // pour ne pas faire clignoter le tableau ni perdre le focus du champ de
  // recherche.
  useEffect(() => {
    let cancelled = false;
    setLoadError('');
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
      .catch((err: unknown) => {
        if (cancelled) return;
        // Sans état d'erreur, une panne réseau/401 s'affichait comme
        // « Aucune réservation trouvée » → l'admin décidait sur du faux.
        setReservations([]);
        setTotal(0);
        setCounts(ZERO_COUNTS);
        setLoadError(
          err instanceof Error && err.message
            ? err.message
            : 'Impossible de charger les réservations.',
        );
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [filterStatut, search, currentPage, reloadKey]);

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  const handleCheckAvailability = async (reservation: AdminReservation) => {
    setCheckingId(reservation.id);
    setActionError('');
    try {
      const result = await apiAdmin.checkAvailability(reservation.id);
      setReservations((prev) =>
        prev.map((r) =>
          r.id === reservation.id
            ? { ...r, statut: result.statut as AdminReservation['statut'] }
            : r,
        ),
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
    } catch (err: unknown) {
      // Un 403/401/500 ne doit pas passer pour un succès silencieux.
      setActionError(
        err instanceof Error && err.message
          ? err.message
          : "L'action a échoué. Réessayez.",
      );
    } finally {
      setCheckingId(null);
    }
  };

  const formatDate = (dateStr: string) => formatDateFr(dateStr) || '—';

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
        <div>
          <h2>Réservations</h2>
          <span className="admin-page__subtitle">
            Gérants non qualifiés — {counts.pending} en attente
          </span>
        </div>
      </div>

      {loadError && (
        <div
          className="verif-alert verif-alert--danger"
          role="alert"
          style={{ marginBottom: '16px' }}
        >
          <p>{loadError}</p>
          <button
            type="button"
            className="admin-btn admin-btn--sm admin-btn--primary"
            onClick={() => setReloadKey((k) => k + 1)}
          >
            Réessayer
          </button>
        </div>
      )}

      {actionError && (
        <p
          className="verif-alert verif-alert--danger"
          role="alert"
          style={{ marginBottom: '16px' }}
        >
          {actionError}
        </p>
      )}

      {/* ── Cartes KPI Modernes ── */}
      <div className="admin-stats dash-res-stats">
        {/* Total */}
        <div
          className="dash-res-card"
          style={{ borderLeft: '4px solid #0ea5e9' }}
        >
          <div className="dash-res-card__info">
            <span className="dash-res-card__label">Total</span>
            <span
              className="dash-res-card__val"
              style={{ color: 'var(--admin-ink)' }}
            >
              {counts.total}
            </span>
            <span style={{ fontSize: '11px', color: '#64748b' }}>
              Toutes réservations
            </span>
          </div>
          <div
            className="dash-res-card__icon"
            style={{ background: '#f0f9ff', color: '#0284c7' }}
          >
            <CalendarDays size={22} />
          </div>
        </div>

        {/* En attente */}
        <div
          className="dash-res-card"
          style={{
            borderLeft: '4px solid #f59e0b',
            background: counts.pending > 0 ? '#fffdf7' : '#ffffff',
          }}
        >
          <div className="dash-res-card__info">
            <span className="dash-res-card__label">En attente</span>
            <span className="dash-res-card__val" style={{ color: '#F59E0B' }}>
              {counts.pending}
            </span>
            <span
              style={{
                fontSize: '11px',
                color: counts.pending > 0 ? '#b45309' : '#64748b',
                fontWeight: counts.pending > 0 ? 600 : 400,
              }}
            >
              {counts.pending > 0 ? 'À confirmer d’urgence' : 'Aucune attente'}
            </span>
          </div>
          <div
            className="dash-res-card__icon"
            style={{ background: '#fef3c7', color: '#d97706' }}
          >
            <Clock size={22} />
          </div>
        </div>

        {/* Confirmées */}
        <div
          className="dash-res-card"
          style={{ borderLeft: '4px solid #10b981' }}
        >
          <div className="dash-res-card__info">
            <span className="dash-res-card__label">Confirmées</span>
            <span className="dash-res-card__val" style={{ color: '#22c55e' }}>
              {counts.confirmed}
            </span>
            <span style={{ fontSize: '11px', color: '#16a34a' }}>
              Séjours validés
            </span>
          </div>
          <div
            className="dash-res-card__icon"
            style={{ background: '#f0fdf4', color: '#16a34a' }}
          >
            <CheckCircle2 size={22} />
          </div>
        </div>

        {/* Annulées */}
        <div
          className="dash-res-card"
          style={{ borderLeft: '4px solid #ef4444' }}
        >
          <div className="dash-res-card__info">
            <span className="dash-res-card__label">Annulées</span>
            <span className="dash-res-card__val" style={{ color: '#EF4444' }}>
              {counts.cancelled}
            </span>
            <span style={{ fontSize: '11px', color: '#ef4444' }}>
              Refusées ou annulées
            </span>
          </div>
          <div
            className="dash-res-card__icon"
            style={{ background: '#fef2f2', color: '#dc2626' }}
          >
            <XCircle size={22} />
          </div>
        </div>
      </div>

      {/* ── Contrôles de Recherche et Filtres ── */}
      <div className="admin-filters dash-res-controls">
        <div className="dash-res-controls__top">
          <div className="dash-search-wrapper">
            <Search size={16} className="dash-search-icon" />
            <input
              type="text"
              placeholder="Rechercher par client ou chambre..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="admin-input dash-search-input"
            />
          </div>

          <div className="dash-status-select-wrap">
            <select
              value={filterStatut}
              onChange={(e) => {
                setFilterStatut(e.target.value);
                setCurrentPage(1);
              }}
              className="admin-select dash-select"
              aria-label="Filtrer par statut"
            >
              <option value="all">Tous statuts</option>
              <option value="en_attente">En attente</option>
              <option value="confirmee">Confirmée</option>
              <option value="annulee">Annulée</option>
            </select>
          </div>
        </div>

        {/* Résumé de filtre actif */}
        <div className="dash-res-filter-summary">
          <span className="dash-res-filter-summary__label">
            {filterStatut === 'all' && `${counts.total} réservation${counts.total > 1 ? 's' : ''} au total`}
            {filterStatut === 'en_attente' && `${counts.pending} en attente`}
            {filterStatut === 'confirmee' && <><span>Confirmées</span> — {counts.confirmed} séjour{counts.confirmed > 1 ? 's' : ''} validé{counts.confirmed > 1 ? 's' : ''}</>}
            {filterStatut === 'annulee' && `${counts.cancelled} annulée${counts.cancelled > 1 ? 's' : ''}`}
          </span>
        </div>
      </div>

      {/* ── Tableau Élégant & Responsive ── */}
      <div className="admin-table-wrap dash-table-card">
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
                  <div className="dash-client-cell">
                    <div className="dash-client-avatar">
                      {initialsOf(res.client_name)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>
                        {res.client_name}
                      </div>
                      <div
                        style={{
                          fontSize: '12px',
                          color: 'var(--admin-ink-soft)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Mail size={12} color="#94a3b8" /> {res.client_email}
                      </div>
                      {res.client_phone && (
                        <div
                          style={{
                            fontSize: '12px',
                            color: 'var(--admin-ink-soft)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            marginTop: '2px',
                          }}
                        >
                          <Phone size={12} color="#94a3b8" /> {res.client_phone}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td>
                  <div className="dash-room-badge">
                    <Building2 size={15} color="#0ea5e9" />
                    <span>{res.room_title}</span>
                  </div>
                </td>
                <td className="admin-table__dates">
                  <span>{formatDate(res.date_debut)}</span>
                  <span> → {formatDate(res.date_fin)}</span>
                </td>
                <td className="admin-table__price">
                  {priceWithCurrency(res.montant)}
                </td>
                <td>
                  <span
                    className={`admin-badge admin-badge--${
                      res.statut === 'confirmee'
                        ? 'success'
                        : res.statut === 'annulee'
                          ? 'danger'
                          : 'warning'
                    }`}
                  >
                    <span className="badge-dot"></span>
                    {res.statut === 'confirmee'
                      ? 'Confirmée'
                      : res.statut === 'annulee'
                        ? 'Annulée'
                        : 'En attente'}
                  </span>
                </td>
                <td>
                  <div className="admin-table__actions">
                    {res.statut === 'en_attente' && (
                      <button
                        className="admin-btn admin-btn--sm admin-btn--primary dash-action-btn-dispo"
                        onClick={() => handleCheckAvailability(res)}
                        disabled={checkingId === res.id}
                      >
                        {checkingId === res.id ? (
                          '...'
                        ) : (
                          <>
                            <Check size={13} />
                            Vérifier dispo
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {reservations.length === 0 && !loadError && (
              <tr>
                <td colSpan={6} className="admin-table__empty">
                  Aucune réservation trouvée
                </td>
              </tr>
            )}
            {reservations.length === 0 && loadError && (
              <tr>
                <td colSpan={6} className="admin-table__empty">
                  Données indisponibles — voir le message d'erreur ci-dessus
                </td>
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

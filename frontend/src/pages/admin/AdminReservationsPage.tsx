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
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import {
  apiAdmin,
  type AdminReservation,
  type AdminReservationCounts,
  type AdminRefund,
  type AdminRefundCounts,
} from '../../lib/adminApi';
import { formatPrice, priceWithCurrency } from '../../lib/roomDisplay';
import { formatDate as formatDateFr } from '../../lib/formatDate';
import '../../styles/22-admin-dashboard.css';

const ITEMS_PER_PAGE = 10;

const ZERO_COUNTS: AdminReservationCounts = {
  total: 0,
  pending: 0,
  confirmed: 0,
  cancelled: 0,
};

const ZERO_REFUND_COUNTS: AdminRefundCounts = {
  failed: 0,
  manual_required: 0,
  processing: 0,
  total: 0,
};

const REFUND_STATUS_LABELS: Record<AdminRefund['status'], string> = {
  requested: 'En cours',
  processing: 'En cours',
  succeeded: 'Remboursé',
  failed: 'Échec',
  manual_required: 'Manuel requis',
  canceled: 'Annulé',
};

const REFUND_REASON_LABELS: Record<string, string> = {
  client_cancellation: 'Annulation par le client',
  gerant_refusal: 'Réservation refusée par le gérant',
  gerant_cancellation: 'Annulation par le gérant',
  auto_expiry: 'Expiration automatique',
  platform_cancellation: 'Annulation par la plateforme',
  dispute: 'Litige',
  goodwill: 'Geste commercial',
  other: 'Remboursement',
};

function formatRefundAmount(amount: number, currency: string): string {
  return `${formatPrice(amount)} ${currency}`;
}


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

  // Remboursements : état séparé pour qu'une panne de cette route ne bloque pas
  // le traitement des réservations.
  const [refunds, setRefunds] = useState<AdminRefund[]>([]);
  const [refundCounts, setRefundCounts] = useState<AdminRefundCounts>(ZERO_REFUND_COUNTS);
  const [refundsReady, setRefundsReady] = useState(false);
  const [refundsError, setRefundsError] = useState('');
  const [refundsReloadKey, setRefundsReloadKey] = useState(0);
  const [refundActionId, setRefundActionId] = useState<string | null>(null);
  const [confirmingRefundId, setConfirmingRefundId] = useState<string | null>(null);
  const [refundFeedback, setRefundFeedback] = useState<{
    tone: 'success' | 'danger';
    message: string;
  } | null>(null);

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

  useEffect(() => {
    let cancelled = false;
    setRefundsError('');
    apiAdmin
      .getRefunds({ scope: 'all', limit: 50 })
      .then((data) => {
        if (cancelled) return;
        setRefunds(data.items);
        setRefundCounts(data.counts);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setRefunds([]);
        setRefundCounts(ZERO_REFUND_COUNTS);
        setRefundsError(
          err instanceof Error && err.message
            ? err.message
            : 'Impossible de charger les remboursements.',
        );
      })
      .finally(() => {
        if (!cancelled) setRefundsReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [refundsReloadKey]);

  const attentionRefunds = refunds.filter(
    (refund) => refund.status === 'failed' || refund.status === 'manual_required',
  );
  const processingRefunds = refunds.filter((refund) => refund.status === 'processing');
  const hasRefundWork = attentionRefunds.length > 0 || processingRefunds.length > 0;

  const handleRefundRetry = async (refund: AdminRefund) => {
    setRefundActionId(refund.id);
    setRefundFeedback(null);
    try {
      const { outcome } = await apiAdmin.retryRefund(refund.id);
      setConfirmingRefundId(null);
      setRefundFeedback({
        tone: outcome.status === 'failed' ? 'danger' : 'success',
        message:
          outcome.reason === 'already_refunded' || outcome.status === 'succeeded'
            ? 'Ce remboursement était déjà abouti.'
            : outcome.status === 'failed'
              ? 'Le prestataire a refusé le remboursement. Vérifiez le motif avant de relancer.'
              : 'Remboursement relancé : en attente de la confirmation du prestataire.',
      });
      setRefundsReloadKey((key) => key + 1);
      setReloadKey((key) => key + 1);
    } catch (err: unknown) {
      setRefundFeedback({
        tone: 'danger',
        message:
          err instanceof Error && err.message
            ? err.message
            : 'La relance du remboursement a échoué.',
      });
    } finally {
      setRefundActionId(null);
    }
  };

  const handleRefundSync = async (refund: AdminRefund) => {
    setRefundActionId(refund.id);
    setRefundFeedback(null);
    try {
      const { refund: synced } = await apiAdmin.syncRefund(refund.id);
      setRefundFeedback({
        tone: synced.status === 'failed' ? 'danger' : 'success',
        message: `Statut synchronisé : ${REFUND_STATUS_LABELS[synced.status]}.`,
      });
      setRefundsReloadKey((key) => key + 1);
      setReloadKey((key) => key + 1);
    } catch (err: unknown) {
      setRefundFeedback({
        tone: 'danger',
        message:
          err instanceof Error && err.message
            ? err.message
            : 'La vérification du remboursement a échoué.',
      });
    } finally {
      setRefundActionId(null);
    }
  };

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

      {/* ── Remboursements à traiter ── */}
      {refundsReady && (hasRefundWork || refundsError || refundFeedback) && (
        <section className="admin-refunds" aria-labelledby="admin-refunds-title">
          <div className="admin-refunds__header">
            <div>
              <h3 id="admin-refunds-title">Remboursements à traiter</h3>
              <p className="admin-refunds__subtitle">
                {refundCounts.failed + refundCounts.manual_required} à relancer ·{' '}
                {refundCounts.processing} en cours
              </p>
            </div>
            <button
              type="button"
              className="admin-btn admin-btn--sm"
              onClick={() => setRefundsReloadKey((key) => key + 1)}
            >
              <RefreshCw size={13} />
              Rafraîchir
            </button>
          </div>

          {refundsError && (
            <p className="admin-refunds__feedback admin-refunds__feedback--danger" role="alert">
              {refundsError}
            </p>
          )}

          {refundFeedback && (
            <p
              className={`admin-refunds__feedback admin-refunds__feedback--${refundFeedback.tone}`}
              role="status"
            >
              {refundFeedback.message}
            </p>
          )}

          <ul className="admin-refunds__list">
            {[...attentionRefunds, ...processingRefunds].map((refund) => {
              const busy = refundActionId === refund.id;
              const canRetry = refund.hasProviderPayment;
              return (
                <li key={refund.id} className="admin-refunds__item">
                  <div className="admin-refunds__info">
                    <div className="admin-refunds__line">
                      <span
                        className={`admin-badge admin-badge--${
                          refund.status === 'processing' ? 'warning' : 'danger'
                        }`}
                      >
                        <span className="badge-dot"></span>
                        {REFUND_STATUS_LABELS[refund.status]}
                      </span>
                      <strong className="admin-refunds__amount">
                        {formatRefundAmount(refund.amount, refund.currency)}
                      </strong>
                      {refund.reservation?.clientName && (
                        <span className="admin-refunds__client">
                          {refund.reservation.clientName}
                        </span>
                      )}
                    </div>
                    <p className="admin-refunds__meta">
                      {refund.reservation?.roomTitle ?? 'Réservation inconnue'}
                      {refund.reservation?.dateDebut && refund.reservation?.dateFin
                        ? ` · ${formatDate(refund.reservation.dateDebut)} → ${formatDate(
                            refund.reservation.dateFin,
                          )}`
                        : ''}
                    </p>
                    <p className="admin-refunds__reason">
                      {refund.reasonDetails ||
                        REFUND_REASON_LABELS[refund.reason] ||
                        refund.reason}
                      {refund.providerStatus ? ` · prestataire : ${refund.providerStatus}` : ''}
                    </p>
                    {refund.status === 'manual_required' && !canRetry && (
                      <p className="admin-refunds__warning">
                        <AlertTriangle size={13} />
                        Paiement sans identifiant provider : remboursement manuel requis.
                      </p>
                    )}
                  </div>

                  <div className="admin-refunds__actions">
                    {refund.status === 'processing' ? (
                      <button
                        type="button"
                        className="admin-btn admin-btn--sm"
                        onClick={() => handleRefundSync(refund)}
                        disabled={busy}
                      >
                        <RefreshCw size={13} />
                        {busy ? 'Vérification...' : 'Vérifier'}
                      </button>
                    ) : !canRetry ? (
                      <button type="button" className="admin-btn admin-btn--sm" disabled>
                        Relance impossible
                      </button>
                    ) : confirmingRefundId === refund.id ? (
                      <div className="admin-refunds__confirm">
                        <span>Confirmer ?</span>
                        <button
                          type="button"
                          className="admin-btn admin-btn--sm admin-btn--primary"
                          onClick={() => handleRefundRetry(refund)}
                          disabled={busy}
                        >
                          {busy ? '...' : 'Oui'}
                        </button>
                        <button
                          type="button"
                          className="admin-btn admin-btn--sm"
                          onClick={() => setConfirmingRefundId(null)}
                          disabled={busy}
                        >
                          Annuler
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="admin-btn admin-btn--sm admin-btn--primary"
                        onClick={() => setConfirmingRefundId(refund.id)}
                        disabled={busy}
                      >
                        <RefreshCw size={13} />
                        Relancer
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

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

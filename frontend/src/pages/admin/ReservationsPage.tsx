import { useState, useEffect } from 'react';
import { getReservations, updateReservationStatut, checkDateConflict, statutLabels, type Reservation } from '../../lib/reservations';
import { addClientNotification } from '../../lib/notifications';
import { sendWhatsAppClientResponse } from '../../lib/whatsapp';

interface VerifyState {
  reservation: Reservation;
  loading: boolean;
  available: boolean | null;
}

export default function ReservationsPage() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [filterStatut, setFilterStatut] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [verify, setVerify] = useState<VerifyState | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  useEffect(() => {
    setReservations(getReservations());
  }, []);

  const filtered = reservations.filter((r) => {
    const matchSearch = r.roomTitle.toLowerCase().includes(search.toLowerCase());
    const matchStatut = filterStatut === 'all' || r.statut === filterStatut;
    return matchSearch && matchStatut;
  });

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleVerify = (res: Reservation) => {
    setVerify({ reservation: res, loading: true, available: null });

    setTimeout(() => {
      if (!res.dateDebut || !res.dateFin) {
        setVerify((prev) => prev ? { ...prev, loading: false, available: false } : null);
        return;
      }
      const conflict = checkDateConflict(res.roomId, res.dateDebut, res.dateFin, res.id);
      setVerify((prev) => prev ? { ...prev, loading: false, available: !conflict.hasConflict } : null);
    }, 1500);
  };

  const handleConfirmFromPopup = () => {
    if (!verify) return;
    updateReservationStatut(verify.reservation.id, 'confirmee');
    addClientNotification({
      type: 'reservation_confirmed',
      roomTitle: verify.reservation.roomTitle,
      roomId: verify.reservation.roomId,
      clientEmail: verify.reservation.clientEmail,
      message: `Votre réservation pour "${verify.reservation.roomTitle}" a été confirmée par l'administrateur.`,
    });
    sendWhatsAppClientResponse({
      clientPhone: verify.reservation.clientPhone,
      clientName: verify.reservation.clientName,
      roomTitle: verify.reservation.roomTitle,
      dateDebut: verify.reservation.dateDebut,
      dateFin: verify.reservation.dateFin,
      confirmed: true,
    });
    setVerify(null);
    setReservations(getReservations());
  };

  const handleRejectFromPopup = () => {
    if (!verify) return;
    updateReservationStatut(verify.reservation.id, 'annulee');
    addClientNotification({
      type: 'reservation_rejected',
      roomTitle: verify.reservation.roomTitle,
      roomId: verify.reservation.roomId,
      clientEmail: verify.reservation.clientEmail,
      message: `Désolé, "${verify.reservation.roomTitle}" n'est pas disponible pour les dates souhaitées.`,
    });
    sendWhatsAppClientResponse({
      clientPhone: verify.reservation.clientPhone,
      clientName: verify.reservation.clientName,
      roomTitle: verify.reservation.roomTitle,
      dateDebut: verify.reservation.dateDebut,
      dateFin: verify.reservation.dateFin,
      confirmed: false,
    });
    setVerify(null);
    setReservations(getReservations());
  };

  const totalRevenu = reservations
    .filter((r) => r.statut === 'confirmee')
    .reduce((sum, r) => sum + r.montant, 0);

  return (
    <div className="admin-page">
      <div className="admin-page__header">
        <h2>Gestion des réservations</h2>
        <span className="admin-page__subtitle">
          Total confirmées : <strong>{totalRevenu.toLocaleString()} FCFA</strong>
        </span>
      </div>

      <div className="admin-filters">
        <input
          type="text"
          placeholder="Rechercher par chambre..."
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
                <td>{res.roomTitle}</td>
                <td className="admin-table__dates">
                  {res.dateDebut ? (
                    <>
                      <span>{new Date(res.dateDebut).toLocaleDateString('fr-FR')}</span>
                      <span>→ {new Date(res.dateFin).toLocaleDateString('fr-FR')}</span>
                    </>
                  ) : (
                    <span className="admin-table__pending">Dates à confirmer</span>
                  )}
                </td>
                <td className="admin-table__price">{res.montant.toLocaleString()} FCFA</td>
                <td>
                  <span className={`admin-badge admin-badge--${res.statut === 'confirmee' ? 'success' : res.statut === 'annulee' ? 'danger' : 'warning'}`}>
                    {statutLabels[res.statut]}
                  </span>
                </td>
                <td>
                  <div className="admin-table__actions">
                    {res.statut === 'en_attente' && (
                      <button className="admin-btn admin-btn--sm admin-btn--primary" onClick={() => handleVerify(res)}>
                        Vérifier
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="admin-table__empty">Aucune réservation trouvée</td>
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

      {verify && (
        <div className="verify-overlay" onClick={() => !verify.loading && setVerify(null)}>
          <div className="verify-modal" onClick={(e) => e.stopPropagation()}>
            {verify.loading ? (
              <div className="verify-modal__loading">
                <div className="verify-spinner" />
                <p>Vérification de la disponibilité...</p>
                <span className="verify-modal__room">{verify.reservation.roomTitle}</span>
              </div>
            ) : verify.available ? (
              <div className="verify-modal__result verify-modal__result--available">
                <div className="verify-modal__icon verify-modal__icon--available">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-5"/>
                  </svg>
                </div>
                <h3>Disponible</h3>
                <p>La chambre <strong>{verify.reservation.roomTitle}</strong> est disponible pour les dates demandées.</p>
                <div className="verify-modal__actions">
                  <button className="verify-btn verify-btn--confirm" onClick={handleConfirmFromPopup}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7"/></svg>
                    Disponible — Confirmer
                  </button>
                  <button className="verify-btn verify-btn--cancel" onClick={() => setVerify(null)}>
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <div className="verify-modal__result verify-modal__result--unavailable">
                <div className="verify-modal__icon verify-modal__icon--unavailable">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/>
                  </svg>
                </div>
                <h3>Non disponible</h3>
                <p>La chambre <strong>{verify.reservation.roomTitle}</strong> n'est pas disponible pour les dates demandées.</p>
                <div className="verify-modal__actions">
                  <button className="verify-btn verify-btn--reject" onClick={handleRejectFromPopup}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                    Non disponible — Refuser
                  </button>
                  <button className="verify-btn verify-btn--cancel" onClick={() => setVerify(null)}>
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

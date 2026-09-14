import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useHomePath } from '../hooks/useHomePath';
import { getReservations, statutLabels, statutColors, type Reservation } from '../lib/reservations';

export default function ClientReservationPage() {
  const homePath = useHomePath();
  const [email, setEmail] = useState(localStorage.getItem('ilehya-client-email') || '');
  const [searched, setSearched] = useState(false);
  const [reservations, setReservations] = useState<Reservation[]>([]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    localStorage.setItem('ilehya-client-email', email.trim());
    const all = await getReservations();
    setReservations(all.filter((r) => r.clientEmail === email.trim().toLowerCase()));
    setSearched(true);
  };

  return (
    <main className="client-reservation">
      <div className="container">
        <nav className="room-detail__breadcrumb" aria-label="Fil d'Ariane">
          <Link to={homePath}>Accueil</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Suivi de réservation</span>
        </nav>

        <div className="client-reservation__card">
          <div className="client-reservation__header">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--sky)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2"/>
              <path d="M16 2v4M8 2v4M3 10h18"/>
            </svg>
            <h1>Suivi de réservation</h1>
            <p>Entrez votre adresse email pour consulter l'état de vos demandes.</p>
          </div>

          <form className="client-reservation__form" onSubmit={handleSearch}>
            <input
              type="email"
              placeholder="Votre adresse email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="client-reservation__input"
            />
            <button type="submit" className="client-reservation__btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7"/>
                <path d="M21 21l-4.3-4.3"/>
              </svg>
              Rechercher
            </button>
          </form>

          {searched && (
            <div className="client-reservation__results">
              {reservations.length === 0 ? (
                <div className="client-reservation__empty">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--ink-soft)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M8 15s1.5 2 4 2 4-2 4-2"/>
                  </svg>
                  <p>Aucune réservation trouvée pour cette adresse email.</p>
                </div>
              ) : (
                <div className="client-reservation__list">
                  {reservations.map((r) => (
                    <div key={r.id} className="client-reservation__item">
                      <div className="client-reservation__item-header">
                        <span className="client-reservation__item-id">#{r.id.slice(0, 8)}</span>
                        <span
                          className="client-reservation__item-status"
                          style={{ color: statutColors[r.statut] || 'inherit' }}
                        >
                          {statutLabels[r.statut] || r.statut}
                        </span>
                      </div>
                      <p className="client-reservation__item-chambre">{r.roomTitle}</p>
                      <p className="client-reservation__item-dates">
                        Du {r.dateDebut} au {r.dateFin}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="client-reservation__footer">
            <Link to={homePath} className="client-reservation__link">Parcourir les appartements</Link>
          </div>
        </div>
      </div>
    </main>
  );
}

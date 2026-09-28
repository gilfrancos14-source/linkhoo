import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { useMarket } from '../../contexts/MarketContext';
import { useHomePath } from '../../hooks/useHomePath';
import { fetchMyRooms, type Room } from '../../data/rooms';
import { fetchCategoriesByMarket, type Category } from '../../data/categories';
import { apiGerants, type GerantData } from '../../lib/api';

const PAGE_SIZE = 5;

export default function DashboardPage() {
  const { market } = useMarket();
  const homePath = useHomePath();
  const { userId } = useAuth();
  const gerantPath = `${homePath}/gerant`;
  const [rooms, setRooms] = useState<Room[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [gerant, setGerant] = useState<GerantData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [loadedRooms, loadedCategories] = await Promise.all([
        fetchMyRooms(),
        fetchCategoriesByMarket(market),
      ]);
      setRooms(loadedRooms);
      setCategories(loadedCategories);
    } catch {
      setError('Impossible de charger les données du tableau de bord.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    loadData();
  }, [market]);

  useEffect(() => {
    if (!userId) return;
    apiGerants.getMe().then(setGerant).catch((err) => {
      console.error('[Dashboard] Erreur chargement profil gérant:', err);
    });
  }, [userId]);

  const total = rooms.length;
  const disponibles = rooms.filter((room) => room.disponible).length;
  const recentRooms = rooms.slice(0, 8);
  const totalPages = Math.ceil(recentRooms.length / PAGE_SIZE);
  const pageItems = recentRooms.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (loading) {
    return (
      <div className="dash">
        <div className="dash-page-head">
          <h1>Aperçu</h1>
          <p>Chargement...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dash">
        <div className="dash-page-head">
          <h1>Aperçu</h1>
          <p>{error}</p>
          <button className="admin-btn" onClick={loadData}>Réessayer</button>
        </div>
      </div>
    );
  }

  return (
    <div className="dash">
      <div className="dash-page-head">
        <h1>Aperçu</h1>
        <p>Vue d'ensemble de votre activité sur le marché {market}.</p>
      </div>

      {(!gerant || !gerant.is_verified) && (
        <section className="verify-cta">
          <div className="verify-cta__icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <path d="M9 12l2 2 4-4"/>
            </svg>
          </div>
          <div className="verify-cta__text">
            {gerant?.verification_status === 'pending' || gerant?.verification_status === 'under_review' ? (
              <>
                <h3>Demande en cours</h3>
                <p>Votre demande de vérification est en cours de traitement. L'admin la traitera bientôt.</p>
              </>
            ) : gerant?.verification_status === 'rejected' ? (
              <>
                <h3>Demande rejetée</h3>
                <p>{gerant.verification_rejection_reason || 'Votre demande a été rejetée. Vous pouvez soumettre de nouveaux documents.'}</p>
              </>
            ) : (
              <>
                <h3>Devenez gérant vérifié</h3>
                <p>Obtenez le badge vérifié pour inspirer plus de confiance aux clients.</p>
              </>
            )}
          </div>
          {(!gerant?.verification_status || gerant?.verification_status === 'none' || gerant?.verification_status === 'rejected') && (
            <Link to={`${gerantPath}/verification`} className="verify-cta__btn" style={{ textDecoration: 'none' }}>
              {gerant?.verification_status === 'rejected' ? 'Resoumettre' : 'Demander la vérification'}
            </Link>
          )}
        </section>
      )}

      {gerant && gerant.is_verified && (
        <section className="verify-cta verify-cta--done">
          <div className="verify-cta__icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <path d="M9 12l2 2 4-4"/>
            </svg>
          </div>
          <div className="verify-cta__text">
            <h3>Compte vérifié</h3>
            <p>Votre compte est vérifié depuis le {new Date(gerant.verified_at!).toLocaleDateString('fr-FR')}.</p>
          </div>
        </section>
      )}

      <section className="hero-band">
        <div className="hero-kpi">
          <span className="hero-kpi__label">Chambres enregistrées</span>
          <span className="hero-kpi__value">{total}</span>
          <span className="hero-kpi__change">{disponibles} disponibles</span>
        </div>
        <div className="hero-side">
          <div className="hero-mini">
            <span className="hero-mini__label">Disponibles</span>
            <span className="hero-mini__value">{disponibles}</span>
          </div>
          <div className="hero-divider"></div>
          <div className="hero-mini">
            <span className="hero-mini__label">Catégories</span>
            <span className="hero-mini__value">{categories.length}</span>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel__head">
          <h2>Actions rapides</h2>
        </div>
        <div className="quick-actions">
          <Link to={`${gerantPath}/chambres/ajouter`} className="quick-action">
            <div className="quick-action__icon quick-action__icon--blue">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </div>
            Ajouter chambre
          </Link>
          {gerant?.is_verified && gerant?.is_premium && (!gerant?.premium_expires_at || new Date(gerant.premium_expires_at) > new Date()) && (
            <Link to={`${gerantPath}/reservations`} className="quick-action">
              <div className="quick-action__icon quick-action__icon--amber">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
              </div>
              Réservations
            </Link>
          )}
          <Link to={`${gerantPath}/chambres`} className="quick-action">
            <div className="quick-action__icon quick-action__icon--purple">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 21V7a2 2 0 012-2h6a2 2 0 012 2v14"/><path d="M13 21V11a2 2 0 012-2h4a2 2 0 012 2v10"/><path d="M3 21h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
            </div>
            Gérer les chambres
          </Link>
          <Link to={homePath} className="quick-action">
            <div className="quick-action__icon quick-action__icon--green">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </div>
            Voir le site
          </Link>
        </div>
      </section>

      <section className="panel table-panel">
        <div className="panel__head">
          <h2>Chambres récentes</h2>
        </div>
        {recentRooms.length === 0 ? (
          <p className="admin-table__empty">Aucune chambre enregistrée.</p>
        ) : (
          <>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Image</th>
                    <th>Titre</th>
                    <th>Ville</th>
                    <th>Catégorie</th>
                    <th>Prix</th>
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((room) => {
                    const category = categories.find((item) => item.id === room.category);
                    return (
                      <tr key={room.id}>
                        <td>
                          <div className="cell-customer">
                            <img src={room.img} alt={room.alt} className="cell-avatar" style={{ objectFit: 'cover' }} />
                            <span className="cell-name">{room.title}</span>
                          </div>
                        </td>
                        <td>{room.ville}</td>
                        <td>{category?.title}</td>
                        <td className="admin-table__price">{room.price} FCFA <span className="admin-table__unit">{room.priceUnit}</span></td>
                        <td>
                          <span className={`admin-badge ${room.disponible ? 'admin-badge--success' : 'admin-badge--danger'}`}>
                            <span className="badge-dot"></span>
                            {room.disponible ? 'Disponible' : 'Occupée'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="admin-pagination">
                <button type="button" disabled={page === 1} onClick={() => setPage(page - 1)}>← Préc</button>
                {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
                  <button key={pageNumber} type="button" className={pageNumber === page ? 'active' : ''} onClick={() => setPage(pageNumber)}>{pageNumber}</button>
                ))}
                <button type="button" disabled={page === totalPages} onClick={() => setPage(page + 1)}>Suiv →</button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

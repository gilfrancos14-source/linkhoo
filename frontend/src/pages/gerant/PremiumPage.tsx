import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useMarket } from '../../contexts/MarketContext';
import { apiPremium, apiGerants, type GerantData } from '../../lib/api';
import { isPremiumActive } from '../../lib/premium';

export default function PremiumPage() {
  const { market } = useMarket();
  const { userId } = useAuth();
  const [gerant, setGerant] = useState<GerantData | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!userId) return;
    apiGerants.getMe().then(setGerant).catch(() => {}).finally(() => setLoading(false));
  }, [userId]);

  const handlePremium = async () => {
    if (!userId || !gerant) return;
    setProcessing(true);
    setError('');
    try {
      const { payment_url } = await apiPremium.initiate(market);
      window.location.href = payment_url;
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'initiation du paiement');
      setProcessing(false);
    }
  };

  const isActive = isPremiumActive(gerant);
  const expiresAt = gerant?.premium_expires_at ? new Date(gerant.premium_expires_at) : null;

  if (loading) {
    return (
      <div className="dash">
        <div className="dash-page-head">
          <h1>Premium</h1>
          <p>Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dash">
      <div className="dash-page-head">
        <h1>Premium</h1>
        <p>Gérez votre abonnement premium pour le marché {market}.</p>
      </div>

      {isActive ? (
        <section className="verify-cta verify-cta--done">
          <div className="verify-cta__icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          </div>
          <div className="verify-cta__text">
            <h3>Compte Premium actif</h3>
            <p>
              {expiresAt
                ? `Votre abonnement expire le ${expiresAt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}.`
                : 'Votre abonnement est actif.'}
            </p>
          </div>
        </section>
      ) : (
        <>
          <section className="verify-cta">
            <div className="verify-cta__icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
            </div>
            <div className="verify-cta__text">
              <h3>Devenez Premium</h3>
              <p>Débloquez la visibilité premium pour vos annonces sur le marché {market}.</p>
            </div>
            <button className="verify-cta__btn" onClick={handlePremium} disabled={processing}>
              {processing ? 'Redirection...' : '5 000 XOF / mois'}
            </button>
          </section>

          <section className="panel">
            <div className="panel__head">
              <h2>Avantages Premium</h2>
            </div>
            <div style={{ padding: '16px 24px' }}>
              <ul style={{ margin: 0, paddingLeft: '20px', lineHeight: '2', color: '#334155', fontSize: '14px' }}>
                <li>Une annonce sur 3 en tête des recherches et des catégories</li>
                <li>Badge <strong>Premium</strong> sur vos cartes de résultats</li>
                <li>Badge <strong>Premium</strong> sur la fiche publique de vos biens</li>
                <li>Gestion des réservations de vos biens</li>
                <li>Badge <strong>PRO</strong> et statut Premium dans votre espace gérant</li>
              </ul>
            </div>
          </section>
        </>
      )}

      {error && (
        <div style={{ marginTop: '16px', padding: '12px 16px', background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: '10px', color: '#991B1B', fontSize: '13.5px' }}>
          {error}
        </div>
      )}
    </div>
  );
}

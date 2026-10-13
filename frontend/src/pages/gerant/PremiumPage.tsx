import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useMarket } from '../../contexts/MarketContext';
import { apiPremium, apiGerants, type GerantData } from '../../lib/api';
import { isPremiumActive } from '../../lib/premium';

const PERKS = [
  {
    title: 'Une annonce sur 3 en tête des recherches et des catégories',
    desc: 'Une de vos trois premières annonces remonte en priorité dans les résultats et les catégories, pour être vue en premier par les voyageurs.',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
      </svg>
    ),
  },
  {
    title: 'Badge Premium sur vos cartes de résultats',
    desc: 'Un badge doré « Premium » s’affiche sur vos cartes dans la liste, pour capter l’œil dès le premier aperçu.',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    ),
  },
  {
    title: 'Badge Premium sur la fiche publique de vos biens',
    desc: 'Le badge apparaît aussi sur la page détaillée de chaque bien, ce qui renforce la confiance des clients.',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
  },
  {
    title: 'Gestion des réservations de vos biens',
    desc: 'Accédez à vos réservations depuis votre tableau de bord : consultez, validez et suivez chaque demande en un clic.',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
  },
  {
    title: 'Badge PRO et statut Premium dans votre espace gérant',
    desc: 'Votre profil gérant affiche le badge PRO et le statut Premium, visible de vos clients et partenaires.',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="5"/>
        <path d="M20 21a8 8 0 0 0-16 0"/>
      </svg>
    ),
  },
];

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
        <section className="premium-active">
          <div className="premium-active__badge" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          </div>
          <div className="premium-active__text">
            <h3>Compte Premium actif</h3>
            <p>
              {expiresAt
                ? `Votre abonnement expire le ${expiresAt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}.`
                : 'Votre abonnement est actif.'}
            </p>
            <span className="premium-active__chip">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Statut Premium
            </span>
          </div>
        </section>
      ) : (
        <>
          <section className="premium-hero">
            <div className="premium-hero__grid">
              <div>
                <span className="premium-hero__eyebrow">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                  Abonnement gérant
                </span>
                <h2 className="premium-hero__title">Devenez Premium</h2>
                <p className="premium-hero__lead">
                  Débloquez la visibilité premium pour vos annonces sur le marché {market}.
                </p>
              </div>

              <div className="premium-hero__price-card">
                <div className="premium-hero__price-label">Tarif mensuel</div>
                <div className="premium-hero__price">
                  <span className="premium-hero__amount">5 000</span>
                  <span className="premium-hero__currency">XOF</span>
                </div>
                <div className="premium-hero__period">par mois, sans engagement</div>
                <button className="premium-hero__btn" onClick={handlePremium} disabled={processing}>
                  {processing
                    ? 'Redirection...'
                    : '5 000 XOF / mois'}
                </button>
                <p className="premium-hero__note">Paiement sécurisé via FedaPay</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="premium-section-title">
              <span className="premium-section-title__dot" aria-hidden="true" />
              Avantages Premium
            </h2>
            <ul className="premium-perks" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {PERKS.map((perk) => (
                <li key={perk.title} className="premium-perk">
                  <span className="premium-perk__icon" aria-hidden="true">
                    {perk.icon}
                  </span>
                  <div className="premium-perk__body">
                    <p className="premium-perk__title">{perk.title}</p>
                    <p className="premium-perk__desc">{perk.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      {error && (
        <div className="premium-error" role="alert">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {error}
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { apiAdmin, type AdminStats } from '../../lib/adminApi';
import { MARKETS } from '../../config/markets';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadStats = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiAdmin.getStats();
      setStats(data);
    } catch {
      setError('Impossible de charger les statistiques.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="dash">
        <div className="dash-page-head">
          <h1>Tableau de bord</h1>
          <p>Chargement...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dash">
        <div className="dash-page-head">
          <h1>Tableau de bord</h1>
          <p>{error}</p>
          <button className="admin-btn" onClick={loadStats}>Réessayer</button>
        </div>
      </div>
    );
  }

  return (
    <div className="dash">
      <div className="dash-page-head">
        <h1>Tableau de bord</h1>
        <p>Vue d'ensemble de la plateforme Linkhoo — tous les marchés</p>
      </div>

      <section className="hero-band">
        <div className="hero-kpi">
          <span className="hero-kpi__label">Gérants</span>
          <span className="hero-kpi__value">{stats?.gerants?.total || 0}</span>
          <span className="hero-kpi__change">{stats?.gerants?.verified || 0} vérifiés</span>
        </div>
        <div className="hero-side hero-side--markets">
          {MARKETS.map(({ code, label }) => (
            <div className="hero-mini" key={code}>
              <span className="hero-mini__label" title={label}>
                {code}
              </span>
              <span className="hero-mini__value">{stats?.gerants?.byMarket?.[code] || 0}</span>
            </div>
          ))}
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginTop: '20px' }}>
        <div className="panel" style={{ padding: '20px' }}>
          <div style={{ fontSize: '13px', color: 'var(--admin-ink-soft)', marginBottom: '8px' }}>Chambres</div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--admin-ink)' }}>{stats?.rooms?.total || 0}</div>
          <div style={{ fontSize: '12px', color: 'var(--admin-ink-soft)', marginTop: '4px' }}>
            {stats?.rooms?.available || 0} disponibles · {stats?.rooms?.unavailable || 0} occupées
          </div>
        </div>

        <div className="panel" style={{ padding: '20px' }}>
          <div style={{ fontSize: '13px', color: 'var(--admin-ink-soft)', marginBottom: '8px' }}>Réservations</div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--admin-ink)' }}>{stats?.reservations?.total || 0}</div>
          <div style={{ fontSize: '12px', color: 'var(--admin-ink-soft)', marginTop: '4px' }}>
            {stats?.reservations?.pending || 0} en attente · {stats?.reservations?.confirmed || 0} confirmées
          </div>
        </div>

        <div className="panel" style={{ padding: '20px' }}>
          <div style={{ fontSize: '13px', color: 'var(--admin-ink-soft)', marginBottom: '8px' }}>Revenu total</div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--admin-ink)' }}>
            {(stats?.reservations?.totalRevenue || 0).toLocaleString('fr-FR')} FCFA
          </div>
          <div style={{ fontSize: '12px', color: 'var(--admin-ink-soft)', marginTop: '4px' }}>
            Réservations confirmées
          </div>
        </div>

        <div className="panel" style={{ padding: '20px' }}>
          <div style={{ fontSize: '13px', color: 'var(--admin-ink-soft)', marginBottom: '8px' }}>Gérants premium</div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--admin-ink)' }}>{stats?.gerants?.premium || 0}</div>
          <div style={{ fontSize: '12px', color: 'var(--admin-ink-soft)', marginTop: '4px' }}>
            {stats?.gerants?.newThisMonth || 0} nouveaux ce mois
          </div>
        </div>

        <div className="panel" style={{ padding: '20px' }}>
          <div style={{ fontSize: '13px', color: 'var(--admin-ink-soft)', marginBottom: '8px' }}>Vérifications en attente</div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: stats?.gerants?.pendingVerifications ? '#F59E0B' : 'var(--admin-ink)' }}>
            {stats?.gerants?.pendingVerifications || 0}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--admin-ink-soft)', marginTop: '4px' }}>
            Demandes à traiter
          </div>
        </div>
      </div>
    </div>
  );
}

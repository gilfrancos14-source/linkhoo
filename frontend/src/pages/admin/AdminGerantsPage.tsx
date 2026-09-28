import { useState, useEffect, useMemo } from 'react';
import { apiAdmin, type AdminGerant } from '../../lib/adminApi';
import AdminGerantDrawer from '../../components/AdminGerantDrawer';

type StatusTab = 'all' | 'pending_verification' | 'under_review' | 'verified' | 'rejected';

export default function AdminGerantsPage() {
  const [gerants, setGerants] = useState<AdminGerant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusTab, setStatusTab] = useState<StatusTab>('all');
  const [marketFilter, setMarketFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedGerant, setSelectedGerant] = useState<AdminGerant | null>(null);

  const loadGerants = async () => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string> = {};
      if (statusTab === 'verified') params.verification_status = 'approved';
      else if (statusTab === 'pending_verification') params.verification_status = 'pending';
      else if (statusTab === 'under_review') params.verification_status = 'under_review';
      else if (statusTab === 'rejected') params.verification_status = 'rejected';
      if (marketFilter !== 'all') params.market = marketFilter;
      const data = await apiAdmin.getGerants(params);
      setGerants(data);
    } catch {
      setError('Impossible de charger la liste des gérants.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGerants();
  }, [statusTab, marketFilter]);

  const filtered = useMemo(() => {
    if (!search.trim()) return gerants;
    const q = search.toLowerCase().trim();
    return gerants.filter(
      (g) =>
        g.nom?.toLowerCase().includes(q) ||
        g.prenom?.toLowerCase().includes(q) ||
        g.email?.toLowerCase().includes(q)
    );
  }, [gerants, search]);

  const handleRevoke = async (gerantId: string) => {
    setActionLoading(gerantId);
    try {
      const updated = await apiAdmin.revokeGerantVerification(gerantId);
      setGerants((prev) => prev.map((g) => (g.id === gerantId ? updated : g)));
    } catch {
      setError('Erreur lors de la révocation.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleGerantUpdated = (updated: AdminGerant) => {
    setGerants((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
  };

  const pendingCount = gerants.filter((g) => g.verification_status === 'pending').length;
  const underReviewCount = gerants.filter((g) => g.verification_status === 'under_review').length;
  const verifiedCount = gerants.filter((g) => g.verification_status === 'approved').length;
  const rejectedCount = gerants.filter((g) => g.verification_status === 'rejected').length;

  const statusTabs: { key: StatusTab; label: string; count: number }[] = [
    { key: 'all', label: 'Tous', count: gerants.length },
    { key: 'pending_verification', label: 'En attente', count: pendingCount },
    { key: 'under_review', label: 'En révision', count: underReviewCount },
    { key: 'verified', label: 'Vérifiés', count: verifiedCount },
    { key: 'rejected', label: 'Rejetés', count: rejectedCount },
  ];

  const renderActions = (gerant: AdminGerant) => {
    const isLoading = actionLoading === gerant.id;
    const hasDocuments = gerant.verification_status === 'pending' || gerant.verification_status === 'under_review';

    return (
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {hasDocuments && (
          <button
            className="admin-btn admin-btn--sm"
            onClick={() => setSelectedGerant(gerant)}
          >
            Documents
          </button>
        )}
        {gerant.is_verified ? (
          <button className="admin-btn admin-btn--danger admin-btn--sm" onClick={() => handleRevoke(gerant.id)} disabled={isLoading}>
            {isLoading ? '...' : 'Révoquer'}
          </button>
        ) : null}
      </div>
    );
  };

  const renderStatus = (gerant: AdminGerant) => {
    const status = gerant.verification_status;
    const configs: Record<string, { badge: string; label: string }> = {
      none: { badge: 'admin-badge--muted', label: 'Non vérifié' },
      pending: { badge: 'admin-badge--warning', label: 'En attente' },
      under_review: { badge: 'admin-badge--info', label: 'En révision' },
      approved: { badge: 'admin-badge--success', label: 'Vérifié' },
      rejected: { badge: 'admin-badge--danger', label: 'Rejeté' },
    };
    const config = configs[status] || configs.none;
    return (
      <span className={`admin-badge ${config.badge}`}>
        <span className="badge-dot"></span>
        {config.label}
      </span>
    );
  };

  return (
    <div className="dash">
      <div className="dash-page-head">
        <h1>Gérants</h1>
        <p>Gérer les comptes gérants et attribuer les badges de vérification</p>
      </div>

      <div className="gerants-filter-card">
        <div className="gerants-filter-card__top">
          <div className="gerants-filter-card__search">
            <svg className="gerants-filter-card__search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
            <input
              type="text"
              className="gerants-filter-card__input"
              placeholder="Rechercher par nom ou email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="gerants-filter-card__divider" />
          <select
            className="gerants-filter-card__select"
            value={marketFilter}
            onChange={(e) => setMarketFilter(e.target.value)}
          >
            <option value="all">Tous les marchés</option>
            <option value="CI">Côte d'Ivoire</option>
            <option value="BJ">Bénin</option>
          </select>
        </div>
        <div className="gerants-filter-card__tabs">
          {statusTabs.map((t) => (
            <button
              key={t.key}
              className={`gerants-filter-card__tab ${statusTab === t.key ? 'gerants-filter-card__tab--active' : ''}`}
              onClick={() => setStatusTab(t.key)}
            >
              {t.label}
              <span className="gerants-filter-card__badge">
                {t.key === 'all' ? gerants.length : t.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {error && <div className="auth-error" style={{ marginBottom: '12px' }}>{error}</div>}

      {loading ? (
        <div className="panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--admin-ink-soft)' }}>Chargement...</div>
      ) : filtered.length === 0 ? (
        <div className="panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--admin-ink-soft)' }}>
          {search ? 'Aucun gérant ne correspond à la recherche.' : 'Aucun gérant trouvé.'}
        </div>
      ) : (
        <>
          <div className="panel gerants-desktop-table">
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Gérant</th>
                    <th>Email</th>
                    <th>Marché</th>
                    <th>Inscrit le</th>
                    <th>Statut</th>
                    <th>Soumis le</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((gerant) => {
                    return (
                      <tr key={gerant.id}>
                        <td>
                          <div className="cell-customer">
                            <div className="cell-avatar" style={{
                              background: gerant.is_verified ? 'var(--admin-success-bg)' : 'var(--admin-line)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '14px', fontWeight: 700,
                              color: gerant.is_verified ? 'var(--admin-success)' : 'var(--admin-ink-soft)',
                            }}>
                              {gerant.is_verified ? (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                                  <path d="M9 12l2 2 4-4"/>
                                </svg>
                              ) : (
                                (gerant.prenom?.[0] || gerant.email[0]).toUpperCase()
                              )}
                            </div>
                            <span className="cell-name">{gerant.prenom} {gerant.nom}</span>
                          </div>
                        </td>
                        <td style={{ fontSize: '13px', color: 'var(--admin-ink-soft)' }}>{gerant.email}</td>
                        <td>
                          <span className={`admin-badge ${gerant.market === 'CI' ? 'admin-badge--info' : 'admin-badge--success'}`}>
                            {gerant.market}
                          </span>
                        </td>
                        <td style={{ fontSize: '13px', color: 'var(--admin-ink-soft)' }}>
                          {new Date(gerant.created_at).toLocaleDateString('fr-FR')}
                        </td>
                        <td>{renderStatus(gerant)}</td>
                        <td style={{ fontSize: '13px', color: 'var(--admin-ink-soft)' }}>
                          {gerant.verification_submitted_at
                            ? new Date(gerant.verification_submitted_at).toLocaleDateString('fr-FR')
                            : '—'}
                        </td>
                        <td>{renderActions(gerant)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="gerants-mobile-cards">
            {filtered.map((gerant) => {
              const avatarClass = gerant.is_verified ? 'gerant-card__avatar--verified' : '';
              return (
                <div className="gerant-card" key={gerant.id}>
                  <div className="gerant-card__header">
                    <div className={`gerant-card__avatar ${avatarClass}`}>
                      {gerant.is_verified ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                          <path d="M9 12l2 2 4-4"/>
                        </svg>
                      ) : (
                        <span>{(gerant.prenom?.[0] || gerant.email[0]).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="gerant-card__info">
                      <span className="gerant-card__name">{gerant.prenom} {gerant.nom}</span>
                      <span className="gerant-card__email">{gerant.email}</span>
                    </div>
                    <span className={`gerant-card__status admin-badge ${
                      gerant.verification_status === 'approved' ? 'admin-badge--success' :
                      gerant.verification_status === 'pending' ? 'admin-badge--warning' :
                      gerant.verification_status === 'under_review' ? 'admin-badge--info' :
                      gerant.verification_status === 'rejected' ? 'admin-badge--danger' :
                      'admin-badge--muted'
                    }`}>
                      {gerant.verification_status === 'approved' ? 'Vérifié' :
                       gerant.verification_status === 'pending' ? 'En attente' :
                       gerant.verification_status === 'under_review' ? 'En révision' :
                       gerant.verification_status === 'rejected' ? 'Rejeté' : 'Non vérifié'}
                    </span>
                  </div>
                  <div className="gerant-card__meta">
                    <span className={`admin-badge ${gerant.market === 'CI' ? 'admin-badge--info' : 'admin-badge--success'}`}>
                      {gerant.market}
                    </span>
                    <span className="gerant-card__date">
                      Inscrit le {new Date(gerant.created_at).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                  <div className="gerant-card__actions">
                    {renderActions(gerant)}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {selectedGerant && (
        <AdminGerantDrawer
          gerant={selectedGerant}
          onClose={() => setSelectedGerant(null)}
          onUpdated={handleGerantUpdated}
        />
      )}
    </div>
  );
}

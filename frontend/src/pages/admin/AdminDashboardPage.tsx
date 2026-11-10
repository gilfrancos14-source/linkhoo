import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Building2,
  CalendarCheck,
  Wallet,
  Users,
  Award,
  AlertCircle,
  TrendingUp,
  Clock,
  ArrowUpRight,
  Globe,
  RefreshCw,
  ShieldAlert,
  CheckCircle2,
  Filter,
  Layers,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import { apiAdmin, type AdminStats } from '../../lib/adminApi';
import { MARKETS, type MarketCode } from '../../config/markets';
import { priceWithCurrency } from '../../lib/roomDisplay';
import '../../styles/22-admin-dashboard.css';

/** Drapeaux et métadonnées d'affichage pour les 12 marchés Linkhoo */
const MARKET_FLAGS: Record<string, string> = {
  CI: '🇨🇮',
  BJ: '🇧🇯',
  SN: '🇸🇳',
  TG: '🇹🇬',
  CM: '🇨🇲',
  BF: '🇧🇫',
  CG: '🇨🇬',
  GA: '🇬🇦',
  GN: '🇬🇳',
  ML: '🇲🇱',
  NE: '🇳🇪',
  CD: '🇨🇩',
};

/** Données du graphique : une entrée par marché du registre (zéros inclus). */
export function buildRoomChartData(stats: AdminStats | null) {
  return MARKETS.map(({ code }) => {
    const marketRooms = stats?.rooms?.byMarket?.[code];
    return {
      code,
      disponibles: marketRooms?.available ?? 0,
      occupees: marketRooms?.unavailable ?? 0,
    };
  });
}

type PeriodFilter = 'all' | 'month' | 'quarter' | 'year';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [selectedMarket, setSelectedMarket] = useState<string>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodFilter>('all');
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const loadStats = async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }
    setError('');
    try {
      const data = await apiAdmin.getStats();
      setStats(data);
      const now = new Date();
      setLastUpdated(
        now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      );
    } catch {
      setError('Impossible de charger les statistiques.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const marketLabels: Record<string, string> = useMemo(
    () => Object.fromEntries(MARKETS.map(({ code, label }) => [code, label])),
    [],
  );

  const roomChartData = useMemo(() => buildRoomChartData(stats), [stats]);

  // Données filtrées ou enrichies par marché pour la section détaillée
  const marketSummaries = useMemo(() => {
    return MARKETS.map((m) => {
      const roomData = stats?.rooms?.byMarket?.[m.code as MarketCode];
      const gerantCount = stats?.gerants?.byMarket?.[m.code as MarketCode] ?? 0;
      const totalRooms = roomData?.total ?? 0;
      const avail = roomData?.available ?? 0;
      const occ = roomData?.unavailable ?? 0;
      const availPct = totalRooms > 0 ? Math.round((avail / totalRooms) * 100) : 0;
      return {
        ...m,
        flag: MARKET_FLAGS[m.code] || '🌍',
        totalRooms,
        available: avail,
        occupied: occ,
        availPct,
        gerantCount,
      };
    });
  }, [stats]);

  // Stats ciblées si un marché est spécifiquement sélectionné
  const filteredMarketInfo = useMemo(() => {
    if (selectedMarket === 'all') return null;
    return marketSummaries.find((m) => m.code === selectedMarket) || null;
  }, [selectedMarket, marketSummaries]);

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
          <button className="admin-btn" onClick={() => loadStats(false)}>
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  const pendingVerifCount = stats?.gerants?.pendingVerifications || 0;
  const pendingReservationsCount = stats?.reservations?.pending || 0;

  return (
    <div className="dash">
      {/* ── En-tête Moderne & Contrôles Live ── */}
      <header className="dash-header">
        <div className="dash-header__top">
          <div className="dash-header__titles">
            <div className="dash-header__badge-row">
              <span className="dash-live-badge">
                <span className="dash-live-badge__dot" />
                Plateforme active
              </span>
              {lastUpdated && (
                <span className="dash-last-updated">Mis à jour à {lastUpdated}</span>
              )}
            </div>
            <div className="dash-page-head" style={{ marginBottom: 0 }}>
              <h1 className="dash-header__title">Tableau de bord</h1>
              <p className="dash-header__subtitle">
                Vue d'ensemble de la plateforme Linkhoo — tous les marchés
              </p>
            </div>
          </div>

          <div className="dash-header__actions">
            <button
              className={`dash-refresh-btn ${isRefreshing ? 'is-loading' : ''}`}
              onClick={() => loadStats(true)}
              disabled={isRefreshing}
              aria-label="Rafraîchir les statistiques"
            >
              <RefreshCw size={15} />
              <span>{isRefreshing ? 'Actualisation...' : 'Actualiser'}</span>
            </button>
          </div>
        </div>

        {/* ── Barre de Filtres Interactifs (Marché & Période) ── */}
        <div className="dash-filters-bar">
          <div className="dash-filters-group">
            <div className="dash-filter-item">
              <Globe size={16} color="#0ea5e9" />
              <label htmlFor="market-filter-select" style={{ fontWeight: 600, fontSize: '13px' }}>
                Marché :
              </label>
              <select
                id="market-filter-select"
                className="dash-select"
                value={selectedMarket}
                onChange={(e) => setSelectedMarket(e.target.value)}
                aria-label="Filtrer par marché"
              >
                <option value="all">Tous les marchés (12 pays)</option>
                {MARKETS.map(({ code, label }) => (
                  <option key={code} value={code}>
                    {MARKET_FLAGS[code] || ''} {label} ({code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="dash-filters-group">
            <div className="dash-filter-item">
              <Filter size={15} color="#64748b" />
              <span style={{ fontWeight: 600, fontSize: '13px' }}>Période :</span>
              <div className="dash-period-pills" role="group" aria-label="Filtrer la période">
                <button
                  type="button"
                  className={`dash-period-pill ${selectedPeriod === 'all' ? 'dash-period-pill--active' : ''}`}
                  onClick={() => setSelectedPeriod('all')}
                >
                  Tout
                </button>
                <button
                  type="button"
                  className={`dash-period-pill ${selectedPeriod === 'month' ? 'dash-period-pill--active' : ''}`}
                  onClick={() => setSelectedPeriod('month')}
                >
                  Ce mois
                </button>
                <button
                  type="button"
                  className={`dash-period-pill ${selectedPeriod === 'quarter' ? 'dash-period-pill--active' : ''}`}
                  onClick={() => setSelectedPeriod('quarter')}
                >
                  Trimestre
                </button>
                <button
                  type="button"
                  className={`dash-period-pill ${selectedPeriod === 'year' ? 'dash-period-pill--active' : ''}`}
                  onClick={() => setSelectedPeriod('year')}
                >
                  Année
                </button>
              </div>
            </div>
          </div>
        </div>

        {filteredMarketInfo && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: '#0369a1', background: '#e0f2fe', padding: '6px 14px', borderRadius: '8px' }}>
            <span>
              Filtre actif : <strong>{filteredMarketInfo.flag} {filteredMarketInfo.label}</strong> ({filteredMarketInfo.totalRooms} chambres · {filteredMarketInfo.gerantCount} gérants)
            </span>
            <button
              onClick={() => setSelectedMarket('all')}
              style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: '#0369a1', cursor: 'pointer', fontWeight: 700, fontSize: '12px' }}
            >
              Effacer le filtre ×
            </button>
          </div>
        )}
      </header>

      {/* ── Bannières d'actions urgentes / alertes ── */}
      {(pendingVerifCount > 0 || pendingReservationsCount > 0) && (
        <div className="dash-alerts">
          {pendingVerifCount > 0 && (
            <div className="dash-alert-card dash-alert-card--warning">
              <div className="dash-alert-content">
                <div className="dash-alert-icon">
                  <ShieldAlert size={20} />
                </div>
                <div>
                  <strong>{pendingVerifCount} vérification{pendingVerifCount > 1 ? 's' : ''} de gérant en attente</strong>
                  <div style={{ fontSize: '12.5px', opacity: 0.9 }}>
                    Des gestionnaires ont soumis leurs pièces d'identité et attendent votre validation.
                  </div>
                </div>
              </div>
              <Link to="/admin/gerants" className="dash-alert-btn">
                Traiter les dossiers <ArrowUpRight size={14} />
              </Link>
            </div>
          )}

          {pendingReservationsCount > 0 && (
            <div className="dash-alert-card dash-alert-card--info">
              <div className="dash-alert-content">
                <div className="dash-alert-icon">
                  <Clock size={20} />
                </div>
                <div>
                  <strong>{pendingReservationsCount} réservation{pendingReservationsCount > 1 ? 's' : ''} en attente</strong>
                  <div style={{ fontSize: '12.5px', opacity: 0.9 }}>
                    Des réservations clients nécessitent confirmation ou vérification de disponibilité.
                  </div>
                </div>
              </div>
              <Link to="/admin/reservations" className="dash-alert-btn">
                Voir les réservations <ArrowUpRight size={14} />
              </Link>
            </div>
          )}
        </div>
      )}

      {/* ── Grille de Cartes KPI Modernes ── */}
      <div className="dash-cards-grid">
        {/* KPI 1 : Chambres */}
        <div className="dash-kpi-card dash-kpi-card--accent-sky">
          <div className="dash-kpi-card__head">
            <span className="dash-kpi-card__label">Chambres</span>
            <div className="dash-kpi-card__icon-box dash-kpi-card__icon-box--sky">
              <Building2 size={20} />
            </div>
          </div>
          <div>
            <div className="dash-kpi-card__value">{stats?.rooms?.total || 0}</div>
            <div style={{ fontSize: '11px', color: '#0284c7', fontWeight: 600, marginTop: '2px' }}>
              Logements répertoriés
            </div>
          </div>
          <div className="dash-kpi-card__footer">
            <span>
              {stats?.rooms?.available || 0} disponibles · {stats?.rooms?.unavailable || 0} occupées
            </span>
          </div>
        </div>

        {/* KPI 2 : Réservations */}
        <div className="dash-kpi-card dash-kpi-card--accent-emerald">
          <div className="dash-kpi-card__head">
            <span className="dash-kpi-card__label">Réservations</span>
            <div className="dash-kpi-card__icon-box dash-kpi-card__icon-box--emerald">
              <CalendarCheck size={20} />
            </div>
          </div>
          <div>
            <div className="dash-kpi-card__value">{stats?.reservations?.total || 0}</div>
            <div style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600, marginTop: '2px' }}>
              Total des réservations
            </div>
          </div>
          <div className="dash-kpi-card__footer">
            <span>
              {stats?.reservations?.pending || 0} en attente · {stats?.reservations?.confirmed || 0} confirmées
            </span>
          </div>
        </div>

        {/* KPI 3 : Revenu total */}
        <div className="dash-kpi-card dash-kpi-card--accent-violet">
          <div className="dash-kpi-card__head">
            <span className="dash-kpi-card__label">Revenu total</span>
            <div className="dash-kpi-card__icon-box dash-kpi-card__icon-box--violet">
              <Wallet size={20} />
            </div>
          </div>
          <div>
            <div className="dash-kpi-card__value" style={{ fontSize: '24px' }}>
              {priceWithCurrency(stats?.reservations?.totalRevenue || 0)}
            </div>
            <div style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 600, marginTop: '2px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <TrendingUp size={12} /> Volume d'affaires global
            </div>
          </div>
          <div className="dash-kpi-card__footer">
            <span>Réservations confirmées</span>
          </div>
        </div>

        {/* KPI 4 : Gérants */}
        <div className="dash-kpi-card dash-kpi-card--accent-sky">
          <div className="dash-kpi-card__head">
            <span className="dash-kpi-card__label">Gérants</span>
            <div className="dash-kpi-card__icon-box dash-kpi-card__icon-box--sky">
              <Users size={20} />
            </div>
          </div>
          <div>
            <div className="dash-kpi-card__value">{stats?.gerants?.total || 0}</div>
            <div style={{ fontSize: '11px', color: '#0ea5e9', fontWeight: 600, marginTop: '2px' }}>
              Propriétaires & hôtes
            </div>
          </div>
          <div className="dash-kpi-card__footer">
            <span>{stats?.gerants?.verified || 0} vérifiés</span>
            <span className="dash-kpi-card__badge dash-kpi-card__badge--success">
              {stats?.gerants?.total ? Math.round(((stats.gerants.verified || 0) / stats.gerants.total) * 100) : 0}% qualifiés
            </span>
          </div>
        </div>

        {/* KPI 5 : Gérants premium */}
        <div className="dash-kpi-card dash-kpi-card--accent-amber">
          <div className="dash-kpi-card__head">
            <span className="dash-kpi-card__label">Gérants premium</span>
            <div className="dash-kpi-card__icon-box dash-kpi-card__icon-box--amber">
              <Award size={20} />
            </div>
          </div>
          <div>
            <div className="dash-kpi-card__value">{stats?.gerants?.premium || 0}</div>
            <div style={{ fontSize: '11px', color: '#d97706', fontWeight: 600, marginTop: '2px' }}>
              Abonnements actifs
            </div>
          </div>
          <div className="dash-kpi-card__footer">
            <span>{stats?.gerants?.newThisMonth || 0} nouveaux ce mois</span>
          </div>
        </div>

        {/* KPI 6 : Vérifications en attente */}
        <div className={`dash-kpi-card ${pendingVerifCount > 0 ? 'dash-kpi-card--urgent' : ''}`}>
          <div className="dash-kpi-card__head">
            <span className="dash-kpi-card__label">Vérifications en attente</span>
            <div
              className={`dash-kpi-card__icon-box ${
                pendingVerifCount > 0 ? 'dash-kpi-card__icon-box--urgent' : 'dash-kpi-card__icon-box--emerald'
              }`}
            >
              {pendingVerifCount > 0 ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
            </div>
          </div>
          <div>
            <div className={`dash-kpi-card__value ${pendingVerifCount > 0 ? 'dash-kpi-card__value--urgent' : ''}`}>
              {stats?.gerants?.pendingVerifications || 0}
            </div>
            <div
              style={{
                fontSize: '11px',
                color: pendingVerifCount > 0 ? '#b45309' : '#16a34a',
                fontWeight: 600,
                marginTop: '2px',
              }}
            >
              {pendingVerifCount > 0 ? 'Dossiers à réviser' : 'Tous dossiers traités'}
            </div>
          </div>
          <div className="dash-kpi-card__footer">
            <span>Demandes à traiter</span>
            {pendingVerifCount > 0 && (
              <Link
                to="/admin/gerants"
                style={{
                  marginLeft: 'auto',
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#d97706',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '2px',
                  textDecoration: 'none',
                }}
              >
                Gérer <ChevronRight size={13} />
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ── Section Graphique : Chambres par Marché ── */}
      <section className="panel admin-chart dash-chart-panel">
        <header className="admin-chart__head dash-chart-head">
          <div className="admin-chart__intro dash-chart-intro">
            <h2 className="admin-chart__title dash-chart-title">Chambres par marché</h2>
            <p className="admin-chart__subtitle dash-chart-subtitle">
              {stats?.rooms?.total || 0} chambres au total, tous marchés confondus
            </p>
          </div>

          <div className="admin-chart__kpi dash-chart-metrics-right">
            <div className="dash-chart-kpi-block">
              <span className="admin-chart__kpi-label dash-chart-kpi-label">Gérants</span>
              <span className="admin-chart__kpi-value dash-chart-kpi-val">{stats?.gerants?.total || 0}</span>
              <span className="admin-chart__kpi-note dash-chart-kpi-note">{stats?.gerants?.verified || 0} vérifiés</span>
            </div>
            <div
              className="dash-chart-kpi-block"
              style={{ borderLeft: '1px solid #e2e8f0', paddingLeft: '16px' }}
            >
              <span className="dash-chart-kpi-label">Taux d'occupation</span>
              <span className="dash-chart-kpi-val" style={{ color: '#0ea5e9' }}>
                {stats?.rooms?.total
                  ? Math.round(((stats.rooms.unavailable || 0) / stats.rooms.total) * 100)
                  : 0}%
              </span>
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                {stats?.rooms?.available || 0} libres
              </span>
            </div>
          </div>
        </header>

        <div className="dash-chart-wrapper">
          <div className="dash-chart-scroll-box">
            <div
              className="admin-chart__body dash-chart-inner"
              role="img"
              aria-label="Graphique des chambres disponibles et occupées pour chaque marché"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={roomChartData} margin={{ top: 12, right: 12, left: -10, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis
                    dataKey="code"
                    tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: '#64748b', fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(14, 165, 233, 0.08)' }}
                    labelFormatter={(label) => {
                      const codeStr = String(label);
                      const flag = MARKET_FLAGS[codeStr] || '';
                      return `${flag} ${marketLabels[codeStr] ?? codeStr} (${codeStr})`;
                    }}
                    contentStyle={{
                      borderRadius: 12,
                      border: '1px solid #cbd5e1',
                      boxShadow: '0 12px 28px -10px rgba(15, 23, 42, 0.25)',
                      fontSize: 13,
                      padding: '10px 14px',
                      backgroundColor: '#ffffff',
                    }}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    iconType="circle"
                    wrapperStyle={{ fontSize: 12, paddingBottom: 16 }}
                  />
                  <Bar
                    dataKey="disponibles"
                    name="Disponibles"
                    stackId="rooms"
                    fill="#0ea5e9"
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar
                    dataKey="occupees"
                    name="Occupées"
                    stackId="rooms"
                    fill="#f59e0b"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="dash-chart-mobile-hint">
            <span>👉 Glisser horizontalement pour voir tous les pays</span>
          </div>
        </div>
      </section>

      {/* ── Section : Vue Détaillée par Marché (Cards tactiles & responsive) ── */}
      <section className="dash-markets-panel">
        <div className="dash-markets-panel__head">
          <div>
            <h3 className="dash-markets-panel__title">Répartition par Marché & Pays</h3>
            <p className="dash-markets-panel__subtitle">
              Disponibilité des hébergements et gérants inscrits par pays
            </p>
          </div>
          {selectedMarket !== 'all' && (
            <button
              className="admin-btn"
              style={{ fontSize: '12px', padding: '6px 12px' }}
              onClick={() => setSelectedMarket('all')}
            >
              Afficher tous les marchés
            </button>
          )}
        </div>

        <div className="dash-markets-grid">
          {marketSummaries
            .filter((m) => selectedMarket === 'all' || m.code === selectedMarket)
            .map((m) => {
              const isSelected = selectedMarket === m.code;
              return (
                <div
                  key={m.code}
                  className={`dash-market-card ${isSelected ? 'dash-market-card--selected' : ''}`}
                  onClick={() => setSelectedMarket(isSelected ? 'all' : m.code)}
                  style={{ cursor: 'pointer' }}
                  title="Cliquer pour filtrer"
                >
                  <div className="dash-market-card__head">
                    <div className="dash-market-card__country">
                      <span>{m.flag}</span>
                      <span>{m.label}</span>
                    </div>
                    <span className="dash-market-code-pill">{m.code}</span>
                  </div>

                  <div className="dash-market-card__stats">
                    <span>
                      <strong>{m.totalRooms}</strong> chambre{m.totalRooms > 1 ? 's' : ''}
                    </span>
                    <span>
                      <strong>{m.gerantCount}</strong> gérant{m.gerantCount > 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="dash-market-bar" title={`${m.available} dispos, ${m.occupied} occupées`}>
                    <div
                      className="dash-market-bar__avail"
                      style={{ width: `${m.totalRooms > 0 ? (m.available / m.totalRooms) * 100 : 0}%` }}
                    />
                    <div
                      className="dash-market-bar__occ"
                      style={{ width: `${m.totalRooms > 0 ? (m.occupied / m.totalRooms) * 100 : 0}%` }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b' }}>
                    <span style={{ color: '#0284c7', fontWeight: 600 }}>{m.available} libres</span>
                    <span style={{ color: '#d97706', fontWeight: 600 }}>{m.occupied} louées</span>
                  </div>
                </div>
              );
            })}
        </div>
      </section>

      {/* ── Section : Raccourcis d'Administration Rapide ── */}
      <section className="dash-shortcuts">
        <h3 className="dash-shortcuts__title">Actions rapides d'administration</h3>
        <div className="dash-shortcuts__grid">
          <Link to="/admin/gerants" className="dash-shortcut-card">
            <div className="dash-shortcut-icon">
              <ShieldCheck size={20} />
            </div>
            <div className="dash-shortcut-info">
              <span className="dash-shortcut-label">Gérer les gérants</span>
              <span className="dash-shortcut-desc">Vérifications d'identité & comptes</span>
            </div>
            <ArrowUpRight size={16} color="#94a3b8" />
          </Link>

          <Link to="/admin/reservations" className="dash-shortcut-card">
            <div className="dash-shortcut-icon">
              <CalendarCheck size={20} />
            </div>
            <div className="dash-shortcut-info">
              <span className="dash-shortcut-label">Réservations</span>
              <span className="dash-shortcut-desc">Suivi des demandes & séjours</span>
            </div>
            <ArrowUpRight size={16} color="#94a3b8" />
          </Link>

          <Link to="/admin/banners" className="dash-shortcut-card">
            <div className="dash-shortcut-icon">
              <Layers size={20} />
            </div>
            <div className="dash-shortcut-info">
              <span className="dash-shortcut-label">Bannières d'accueil</span>
              <span className="dash-shortcut-desc">Visuels et promotions par pays</span>
            </div>
            <ArrowUpRight size={16} color="#94a3b8" />
          </Link>

          <Link to="/admin/evenements" className="dash-shortcut-card">
            <div className="dash-shortcut-icon">
              <Globe size={20} />
            </div>
            <div className="dash-shortcut-info">
              <span className="dash-shortcut-label">Événements & Tourisme</span>
              <span className="dash-shortcut-desc">Agenda culturel et destinations</span>
            </div>
            <ArrowUpRight size={16} color="#94a3b8" />
          </Link>
        </div>
      </section>
    </div>
  );
}

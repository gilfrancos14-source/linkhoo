import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useMarket } from '../../contexts/MarketContext';
import { useHomePath } from '../../hooks/useHomePath';
import { fetchRoomsByMarket, type Room } from '../../data/rooms';
import { fetchCategoriesByMarket, type Category } from '../../data/categories';

const revenueSeries = [4200, 4800, 4100, 5300, 5900, 5600, 6400, 7100, 6800, 7600, 8200, 7900, 8600, 9100];
const months = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc','J1','J2'];

const activityData = [
  { parts: ['Koffi Agossa', ' a réservé Familial — Quartier des arts'], time: 'Il y a 8 min' },
  { parts: ['Paiement en attente pour ', 'Suite Prestige'], time: 'Il y a 34 min' },
  { parts: ['Adéola Bello', ' a annulé sa réservation'], time: 'Il y a 1 h' },
  { parts: ['Nouvelle chambre ajoutée : ', 'Studio Cosmos'], time: 'Il y a 2 h' },
  { parts: ['Mariam Soula', ' a confirmé son séjour'], time: 'Il y a 3 h' },
  { parts: ['Avis 5 étoiles laissé par ', 'Ibrahim Touré'], time: 'Il y a 5 h' },
];

function animateValue(el: HTMLElement, end: number, opts: { duration?: number; format?: (v: number) => string } = {}) {
  const { duration = 900, format = (v) => Math.round(v).toString() } = opts;
  const t0 = performance.now();
  function tick(now: number) {
    const p = Math.min((now - t0) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = format(end * eased);
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function drawChart(svgEl: SVGSVGElement, series: number[]) {
  const W = 620, H = 220, pad = 12;
  const max = Math.max(...series) * 1.15;
  const stepX = (W - pad * 2) / (series.length - 1);

  const points = series.map((v, i) => {
    const x = pad + i * stepX;
    const y = H - pad - (v / max) * (H - pad * 2);
    return [x, y];
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const areaPath = linePath + ` L ${points[points.length - 1][0].toFixed(1)} ${H - pad} L ${points[0][0].toFixed(1)} ${H - pad} Z`;

  svgEl.innerHTML = `
    <defs>
      <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#0EA5E9" stop-opacity="0.28"/>
        <stop offset="100%" stop-color="#0EA5E9" stop-opacity="0"/>
      </linearGradient>
    </defs>
    ${[0, 1, 2, 3].map(i => `<line x1="${pad}" y1="${pad + i * (H - pad * 2) / 3}" x2="${W - pad}" y2="${pad + i * (H - pad * 2) / 3}" stroke="#DCEBF9" stroke-width="1"/>`).join('')}
    <path d="${areaPath}" fill="url(#areaFill)" stroke="none"/>
    <path d="${linePath}" fill="none" stroke="#0EA5E9" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    ${points.map(p => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3" fill="#fff" stroke="#0284C7" stroke-width="2"/>`).join('')}
  `;
}

export default function DashboardPage() {
  const { market } = useMarket();
  const homePath = useHomePath();
  const adminPath = `${homePath}/admin`;

  const [rooms, setRooms] = useState<Room[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const totalRevenue = revenueSeries.reduce((a, b) => a + b, 0);
  const chartRef = useRef<SVGSVGElement>(null);
  const axisRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 5;

  const loadData = async () => {
    const [r, c] = await Promise.all([
      fetchRoomsByMarket(market),
      fetchCategoriesByMarket(market),
    ]);
    setRooms(r);
    setCategories(c);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [market]);

  const total = rooms.length;
  const disponibles = rooms.filter((r) => r.disponible).length;
  const recent = [...rooms].reverse().slice(0, 8);

  useEffect(() => {
    if (loading) return;
    if (chartRef.current) drawChart(chartRef.current, revenueSeries);
    if (axisRef.current) {
      axisRef.current.innerHTML = months
        .filter((_, i) => i % 2 === 0)
        .map(m => `<span>${m}</span>`)
        .join('');
    }

    const revEl = document.getElementById('kpi-revenue');
    const roomEl = document.getElementById('kpi-rooms');
    const dispoEl = document.getElementById('kpi-dispo');
    if (revEl) animateValue(revEl, totalRevenue, { format: (v) => Math.round(v).toLocaleString('fr-FR') + ' FCFA' });
    if (roomEl) animateValue(roomEl, total, { format: (v) => Math.round(v).toLocaleString('fr-FR') });
    if (dispoEl) animateValue(dispoEl, disponibles, { format: (v) => Math.round(v).toLocaleString('fr-FR') });
  }, [loading, total, disponibles, totalRevenue]);

  const totalPages = Math.ceil(recent.length / PAGE_SIZE);
  const pageItems = recent.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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

  return (
    <div className="dash">
      <div className="dash-page-head">
        <h1>Aperçu</h1>
        <p>Vue d'ensemble de l'activité sur les 30 derniers jours.</p>
      </div>

      {/* Hero KPI band */}
      <section className="hero-band">
        <div className="hero-kpi">
          <span className="hero-kpi__label">Revenu total estimé</span>
          <span className="hero-kpi__value" id="kpi-revenue">0 FCFA</span>
          <span className="hero-kpi__change">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            +12,4% vs période précédente
          </span>
        </div>
        <div className="hero-side">
          <div className="hero-mini">
            <span className="hero-mini__label">Chambres</span>
            <span className="hero-mini__value" id="kpi-rooms">0</span>
          </div>
          <div className="hero-divider"></div>
          <div className="hero-mini">
            <span className="hero-mini__label">Disponibles</span>
            <span className="hero-mini__value" id="kpi-dispo">0</span>
          </div>
          <div className="hero-divider"></div>
          <div className="hero-mini">
            <span className="hero-mini__label">Catégories</span>
            <span className="hero-mini__value">{categories.length}</span>
          </div>
        </div>
      </section>

      {/* Chart + activity */}
      <section className="dash-grid">
        <div className="panel">
          <div className="panel__head">
            <h2>Évolution du revenu</h2>
            <div className="tabs">
              <button className="tab active">Revenu</button>
              <button className="tab">Commandes</button>
            </div>
          </div>
          <svg ref={chartRef} className="chart" viewBox="0 0 620 220" preserveAspectRatio="none" />
          <div className="chart-axis" ref={axisRef}></div>
        </div>

        <div className="panel">
          <div className="panel__head">
            <h2>Activité récente</h2>
          </div>
          <ul className="activity-list">
            {activityData.map((a, i) => (
              <li key={i} className="activity-item">
                <span className="activity-dot"></span>
                <div className="activity-body">
                  <span className="activity-text">
                    {a.parts[0]}<strong>{a.parts[1]}</strong>
                  </span>
                  <span className="activity-time">{a.time}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Quick actions */}
      <section className="panel">
        <div className="panel__head">
          <h2>Actions rapides</h2>
        </div>
        <div className="quick-actions">
          <Link to={`${adminPath}/chambres/ajouter`} className="quick-action">
            <div className="quick-action__icon quick-action__icon--blue">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </div>
            Ajouter chambre
          </Link>
          <Link to={`${adminPath}/categories`} className="quick-action">
            <div className="quick-action__icon quick-action__icon--purple">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/></svg>
            </div>
            Gérer catégories
          </Link>
          <Link to={`${adminPath}/reservations`} className="quick-action">
            <div className="quick-action__icon quick-action__icon--amber">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
            </div>
            Réservations
          </Link>
          <Link to={homePath} className="quick-action">
            <div className="quick-action__icon quick-action__icon--green">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </div>
            Voir le site
          </Link>
        </div>
      </section>

      {/* Recent rooms table */}
      <section className="panel table-panel">
        <div className="panel__head">
          <h2>Chambres récentes</h2>
        </div>
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
                const cat = categories.find((c) => c.id === room.category);
                return (
                  <tr key={room.id}>
                    <td>
                      <div className="cell-customer">
                        <img src={room.img} alt={room.alt} className="cell-avatar" style={{ objectFit: 'cover' }} />
                        <span className="cell-name">{room.title}</span>
                      </div>
                    </td>
                    <td>{room.ville}</td>
                    <td>{cat?.title}</td>
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
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button key={p} type="button" className={p === page ? 'active' : ''} onClick={() => setPage(p)}>{p}</button>
            ))}
            <button type="button" disabled={page === totalPages} onClick={() => setPage(page + 1)}>Suiv →</button>
          </div>
        )}
      </section>
    </div>
  );
}

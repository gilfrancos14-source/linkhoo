import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { useHomePath } from '../../hooks/useHomePath';
import { apiBoosts, apiGerants, type BoostData, type BoostDisplayStatus, type GerantData } from '../../lib/api';
import {
  boostAmount,
  boostDateRange,
  boostEndIso,
  boostModeLabels,
  boostSpentPercent,
  boostStartIso,
  boostStatusLabels,
  isoDay,
  validateBoostWindow,
} from '../../lib/boosts';

// Statuts pour lesquels le solde restant peut être reprogrammé (le serveur
// refuse pending / canceled / exhausted, la fenêtre reste à 90 jours).
const RESCHEDULABLE = new Set<string>(['scheduled', 'live', 'paused', 'ended']);

type BoostFilter = 'all' | 'live' | 'scheduled' | 'ended';

const FILTERS: { id: BoostFilter; label: string }[] = [
  { id: 'all', label: 'Toutes' },
  { id: 'live', label: 'Actives' },
  { id: 'scheduled', label: 'Programmées' },
  { id: 'ended', label: 'Terminées' },
];

const ENDED_STATUSES: BoostDisplayStatus[] = ['ended', 'exhausted', 'canceled'];

function matchesFilter(status: BoostDisplayStatus, filter: BoostFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'live') return status === 'live' || status === 'paused';
  if (filter === 'scheduled') return status === 'scheduled';
  return ENDED_STATUSES.includes(status);
}

export default function BoostsPage() {
  const homePath = useHomePath();
  const gerantPath = `${homePath}/gerant`;
  const { userId } = useAuth();
  const [gerant, setGerant] = useState<GerantData | null>(null);
  const [items, setItems] = useState<BoostData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<BoostFilter>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [startDay, setStartDay] = useState('');
  const [endDay, setEndDay] = useState('');
  const [scheduleError, setScheduleError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiBoosts.mine();
      setItems(Array.isArray(data?.items) ? data.items : []);
      setError('');
    } catch {
      setError('Impossible de charger vos campagnes. Réessayez plus tard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!userId) return;
    load();
    apiGerants.getMe().then(setGerant).catch(() => {});
  }, [userId, load]);

  const openSchedule = (boost: BoostData) => {
    setEditingId(boost.id);
    // m1 : pour une campagne en cours, starts_at est déjà passé — le
    // pré-remplir tel quel déclenche « La date de début ne peut pas être dans
    // le passé » et rend impossible de prolonger la fin. On part d'aujourd'hui
    // (et on ne laisse jamais une fin antérieure à ce nouveau début).
    const today = isoDay(new Date());
    const originalStart = isoDay(new Date(boost.starts_at));
    const nextStart = originalStart > today ? originalStart : today;
    const originalEnd = isoDay(new Date(boost.ends_at));
    setStartDay(nextStart);
    setEndDay(originalEnd > nextStart ? originalEnd : nextStart);
    setScheduleError('');
  };

  const saveSchedule = async (id: string) => {
    const localError = validateBoostWindow(startDay, endDay);
    if (localError) {
      setScheduleError(localError);
      return;
    }
    setSaving(true);
    setScheduleError('');
    try {
      await apiBoosts.updateSchedule(id, {
        starts_at: boostStartIso(startDay),
        ends_at: boostEndIso(endDay),
      });
      setEditingId(null);
      await load();
    } catch (err) {
      setScheduleError(err instanceof Error && err.message ? err.message : 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="dash">
        <div className="dash-page-head">
          <h1>Booster</h1>
          <p>Chargement...</p>
        </div>
        <div className="boosts-skeleton" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="boosts-skeleton__card">
              <span className="boosts-skeleton__media" />
              <span className="boosts-skeleton__line boosts-skeleton__line--lg" />
              <span className="boosts-skeleton__line" />
              <span className="boosts-skeleton__line boosts-skeleton__line--sm" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const verified = Boolean(gerant?.is_verified);
  const liveCount = items.filter((b) => b.display_status === 'live').length;
  const totalSpent = items.reduce((sum, b) => sum + b.spent, 0);
  const totalRemaining = items.reduce((sum, b) => sum + b.remaining, 0);
  const visibleItems = items.filter((b) => matchesFilter(b.display_status, filter));

  return (
    <div className="dash">
      <div className="boosts-head">
        <div className="boosts-head__copy">
          <span className="boosts-head__eyebrow">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            Sponsorisation
          </span>
          <h1>Booster</h1>
          <p>Sponsorisez vos chambres : jusqu'à 6 emplacements en vedette sur la page d'accueil.</p>
        </div>
        <div className="boosts-head__actions">
          {verified ? (
            <Link to={`${gerantPath}/boosts/new`} className="admin-btn admin-btn--primary">
              + Nouvelle campagne
            </Link>
          ) : (
            <Link to={`${gerantPath}/verification`} className="admin-btn">
              Vérifier mon compte
            </Link>
          )}
        </div>
      </div>

      {!verified && (
        <section className="verify-cta">
          <div className="verify-cta__icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
          </div>
          <div className="verify-cta__text">
            <h3>Vérification requise</h3>
            <p>La vérification du compte gérant est nécessaire pour booster une chambre.</p>
          </div>
          <Link to={`${gerantPath}/verification`} className="verify-cta__btn" style={{ textDecoration: 'none' }}>
            Compléter la vérification
          </Link>
        </section>
      )}

      {error && (
        <div className="boosts-alert" role="alert">
          <span>{error}</span>
          <button className="admin-btn admin-btn--sm" onClick={() => { setLoading(true); load(); }}>
            Réessayer
          </button>
        </div>
      )}

      {!error && items.length === 0 && (
        <section className="boosts-empty">
          <span className="boosts-empty__icon" aria-hidden="true">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </span>
          <h2>Aucune campagne</h2>
          <p>
            {verified
              ? 'Créez votre première campagne pour mettre une chambre en avant sur la page d’accueil.'
              : 'Passez la vérification de votre compte puis créez votre première campagne.'}
          </p>
          {verified && (
            <Link to={`${gerantPath}/boosts/new`} className="admin-btn admin-btn--primary">
              Commencer
            </Link>
          )}
        </section>
      )}

      {!error && items.length > 0 && (
        <>
          <div className="boosts-kpis">
            <div className="boosts-kpi">
              <span className="boosts-kpi__icon boosts-kpi__icon--live" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12.55a11 11 0 0114.08 0" />
                  <path d="M1.42 9a16 16 0 0121.16 0" />
                  <path d="M8.53 16.11a6 6 0 016.95 0" />
                  <line x1="12" y1="20" x2="12.01" y2="20" />
                </svg>
              </span>
              <div className="boosts-kpi__body">
                <span className="boosts-kpi__label">Campagnes en ligne</span>
                <strong className="boosts-kpi__value">{liveCount}</strong>
                <span className="boosts-kpi__hint">sur {items.length} campagne{items.length > 1 ? 's' : ''}</span>
              </div>
            </div>

            <div className="boosts-kpi">
              <span className="boosts-kpi__icon boosts-kpi__icon--spent" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="1" x2="12" y2="23" />
                  <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
                </svg>
              </span>
              <div className="boosts-kpi__body">
                <span className="boosts-kpi__label">Budget consommé</span>
                <strong className="boosts-kpi__value">{boostAmount(totalSpent)}</strong>
                <span className="boosts-kpi__hint">sur l’ensemble des campagnes</span>
              </div>
            </div>

            <div className="boosts-kpi">
              <span className="boosts-kpi__icon boosts-kpi__icon--remaining" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 3v18h18" />
                  <path d="M7 15l4-6 4 3 5-7" />
                </svg>
              </span>
              <div className="boosts-kpi__body">
                <span className="boosts-kpi__label">Budget restant</span>
                <strong className="boosts-kpi__value">{boostAmount(totalRemaining)}</strong>
                <span className="boosts-kpi__hint">encore disponible</span>
              </div>
            </div>
          </div>

          <div className="boosts-filters" role="group" aria-label="Filtrer les campagnes">
            {FILTERS.map((f) => {
              const count = items.filter((b) => matchesFilter(b.display_status, f.id)).length;
              return (
                <button
                  key={f.id}
                  type="button"
                  className={`boosts-filter${filter === f.id ? ' is-active' : ''}`}
                  aria-pressed={filter === f.id}
                  onClick={() => setFilter(f.id)}
                >
                  {f.label}
                  <span className="boosts-filter__count">{count}</span>
                </button>
              );
            })}
          </div>

          {visibleItems.length === 0 ? (
            <p className="boosts-filters-empty">Aucune campagne pour ce filtre.</p>
          ) : (
            <div className="boost-list">
              {visibleItems.map((boost) => {
                const percent = boostSpentPercent(boost.budget_total, boost.spent);
                const canReschedule = RESCHEDULABLE.has(boost.display_status);
                const roomTitle = boost.room?.title ?? 'Chambre';
                const place = [boost.room?.ville, boost.room?.quartier].filter(Boolean).join(' · ');
                return (
                  <article key={boost.id} className="boost-card">
                    <div className="boost-card__media">
                      {boost.room?.img ? (
                        <img src={boost.room.img} alt="" loading="lazy" />
                      ) : (
                        <span className="boost-card__media-fallback" aria-hidden="true">
                          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                            <polyline points="9 22 9 12 15 12 15 22" />
                          </svg>
                        </span>
                      )}
                      <span className={`boost-pill boost-pill--${boost.display_status} boost-card__status`}>
                        <span className="boost-pill__dot" aria-hidden="true" />
                        {boostStatusLabels[boost.display_status]}
                      </span>
                    </div>

                    <div className="boost-card__body">
                      <div className="boost-card__head">
                        <h3 className="boost-card__title">{roomTitle}</h3>
                        {place && <p className="boost-card__place">{place}</p>}
                      </div>

                      <div className="boost-card__meta">
                        <span className="boost-card__chip">{boostModeLabels[boost.mode]}</span>
                        <span className="boost-card__chip boost-card__chip--dates">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <rect x="3" y="4" width="18" height="18" rx="2" />
                            <path d="M16 2v4M8 2v4M3 10h18" />
                          </svg>
                          {boostDateRange(boost.starts_at, boost.ends_at)}
                        </span>
                      </div>

                      <div className="boost-card__stats">
                        <div className="boost-card__stat">
                          <span className="boost-card__stat-value">{boost.clicks_count}</span>
                          <span className="boost-card__stat-label">clics</span>
                        </div>
                        <div className="boost-card__stat">
                          <span className="boost-card__stat-value">{boost.impressions_count}</span>
                          <span className="boost-card__stat-label">impressions</span>
                        </div>
                      </div>

                      <div className="boost-card__budget">
                        <div className="boost-card__budget-top">
                          <span className="boost-budget">{boostAmount(boost.spent)} consommés</span>
                          <span className="boost-card__remaining">
                            Reste {boostAmount(boost.remaining)} sur {boostAmount(boost.budget_total)}
                          </span>
                        </div>
                        <div
                          className="boost-progress"
                          role="progressbar"
                          aria-valuenow={percent}
                          aria-valuemin={0}
                          aria-valuemax={100}
                        >
                          <span className="boost-progress__fill" style={{ width: `${percent}%` }} />
                        </div>
                        <span className="boost-card__percent">{percent}% du budget utilisé</span>
                      </div>

                      {editingId === boost.id ? (
                        <div className="boost-form boost-card__schedule">
                          <div className="boost-field">
                            <label htmlFor={`start-${boost.id}`}>Début</label>
                            <input
                              id={`start-${boost.id}`}
                              type="date"
                              value={startDay}
                              min={isoDay(new Date())}
                              onChange={(e) => setStartDay(e.target.value)}
                            />
                          </div>
                          <div className="boost-field">
                            <label htmlFor={`end-${boost.id}`}>Fin</label>
                            <input
                              id={`end-${boost.id}`}
                              type="date"
                              value={endDay}
                              min={startDay}
                              onChange={(e) => setEndDay(e.target.value)}
                            />
                          </div>
                          {scheduleError && (
                            <p className="boost-card__error">{scheduleError}</p>
                          )}
                          <div className="boost-actions">
                            <button
                              className="admin-btn admin-btn--primary admin-btn--sm"
                              onClick={() => saveSchedule(boost.id)}
                              disabled={saving}
                            >
                              {saving ? 'Enregistrement...' : 'Enregistrer'}
                            </button>
                            <button className="admin-btn admin-btn--sm" onClick={() => setEditingId(null)} disabled={saving}>
                              Annuler
                            </button>
                          </div>
                        </div>
                      ) : null}

                      {canReschedule && editingId !== boost.id && (
                        <div className="boost-card__actions">
                          <button className="admin-btn admin-btn--sm" onClick={() => openSchedule(boost)}>
                            Modifier les dates
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

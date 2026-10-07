import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { useHomePath } from '../../hooks/useHomePath';
import { apiBoosts, apiGerants, type BoostData, type GerantData } from '../../lib/api';
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

export default function BoostsPage() {
  const homePath = useHomePath();
  const gerantPath = `${homePath}/gerant`;
  const { userId } = useAuth();
  const [gerant, setGerant] = useState<GerantData | null>(null);
  const [items, setItems] = useState<BoostData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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
      </div>
    );
  }

  const verified = Boolean(gerant?.is_verified);

  return (
    <div className="dash">
      <div className="admin-page__header">
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800 }}>Booster</h1>
          <p style={{ margin: '4px 0 0', fontSize: 14.5, color: 'var(--admin-ink-soft)' }}>
            Sponsorisez vos chambres : jusqu'à 6 emplacements en vedette sur la page d'accueil.
          </p>
        </div>
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
        <div style={{ padding: '12px 16px', background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 10, color: '#991B1B', fontSize: 13.5 }}>
          {error}{' '}
          <button className="admin-btn admin-btn--sm" onClick={() => { setLoading(true); load(); }}>
            Réessayer
          </button>
        </div>
      )}

      {!error && items.length === 0 && (
        <section className="panel">
          <div className="panel__head">
            <h2>Aucune campagne</h2>
          </div>
          <div style={{ padding: '16px 24px', color: '#64748B', fontSize: 14 }}>
            {verified ? (
              <>
                Créez votre première campagne pour mettre une chambre en avant sur la page d'accueil.
                {' '}
                <Link to={`${gerantPath}/boosts/new`}>Commencer</Link>
              </>
            ) : (
              'Passez la vérification de votre compte puis créez votre première campagne.'
            )}
          </div>
        </section>
      )}

      {items.length > 0 && (
        <div className="boost-list">
          {items.map((boost) => {
            const percent = boostSpentPercent(boost.budget_total, boost.spent);
            const canReschedule = RESCHEDULABLE.has(boost.display_status);
            const roomTitle = boost.room?.title ?? 'Chambre';
            return (
              <article key={boost.id} className="boost-row">
                <div className="boost-row__main">
                  <div className="boost-row__title">
                    {roomTitle}{' '}
                    <span className={`boost-pill boost-pill--${boost.display_status}`}>
                      {boostStatusLabels[boost.display_status]}
                    </span>
                  </div>
                  <div className="boost-row__meta">
                    <span>{boostModeLabels[boost.mode]}</span>
                    <span>{boostDateRange(boost.starts_at, boost.ends_at)}</span>
                    <span>
                      Reste {boostAmount(boost.remaining)} sur {boostAmount(boost.budget_total)}
                    </span>
                  </div>
                  {editingId === boost.id ? (
                    <div className="boost-form" style={{ marginTop: 8 }}>
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
                        <p style={{ margin: 0, color: '#991B1B', fontSize: 13 }}>{scheduleError}</p>
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
                </div>
                <div className="boost-row__side">
                  <span className="boost-budget">{boostAmount(boost.spent)} consommés</span>
                  <div className="boost-progress" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
                    <span className="boost-progress__fill" style={{ width: `${percent}%` }} />
                  </div>
                  {canReschedule && (
                    <button className="admin-btn admin-btn--sm" onClick={() => openSchedule(boost)}>
                      Modifier les dates
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

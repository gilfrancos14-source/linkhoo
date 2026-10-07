import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { useHomePath } from '../../hooks/useHomePath';
import { apiBoosts, apiGerants, type BoostConfig, type BoostMode, type GerantData } from '../../lib/api';
import { fetchMyRooms, type Room } from '../../data/rooms';
import { boostAmount, boostEndIso, boostStartIso, isoDay, validateBoostWindow } from '../../lib/boosts';

function addDays(days: number): string {
  return isoDay(new Date(Date.now() + days * 24 * 60 * 60 * 1000));
}

export default function BoostCreatePage() {
  const homePath = useHomePath();
  const gerantPath = `${homePath}/gerant`;
  const { userId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [gerant, setGerant] = useState<GerantData | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [config, setConfig] = useState<BoostConfig | null>(null);
  const [roomId, setRoomId] = useState('');
  const [mode, setMode] = useState<BoostMode>('cpc');
  const [budgetChoice, setBudgetChoice] = useState<number | null>(null);
  const [startDay, setStartDay] = useState(() => isoDay(new Date()));
  const [endDay, setEndDay] = useState(() => addDays(30));
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    Promise.all([
      apiGerants.getMe().catch(() => null),
      fetchMyRooms().catch(() => [] as Room[]),
      apiBoosts.config().catch(() => null),
    ]).then(([gerantData, roomList, boostConfig]) => {
      if (!alive) return;
      setGerant(gerantData);
      setRooms(Array.isArray(roomList) ? roomList : []);
      setConfig(boostConfig);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [userId]);

  const disponibleRooms = useMemo(() => rooms.filter((room) => room.disponible), [rooms]);
  const effectiveRoomId = roomId || disponibleRooms[0]?.id || '';
  const effectiveBudget = budgetChoice ?? config?.budgets[0] ?? 0;
  const windowError = validateBoostWindow(startDay, endDay);

  const estimate =
    config && effectiveBudget > 0
      ? mode === 'cpc'
        ? `≈ ${Math.floor(effectiveBudget / config.price_cpc)} clics`
        : `≈ ${Math.floor(effectiveBudget / config.price_cpi)} impressions`
      : '';

  const handleSubmit = async () => {
    const localError = validateBoostWindow(startDay, endDay);
    if (localError || !effectiveRoomId) {
      setError(localError || 'Choisissez une chambre à booster.');
      return;
    }
    setProcessing(true);
    setError('');
    try {
      const { payment_url } = await apiBoosts.initiate({
        room_id: effectiveRoomId,
        mode,
        budget_total: effectiveBudget,
        starts_at: boostStartIso(startDay),
        ends_at: boostEndIso(endDay),
      });
      window.location.href = payment_url;
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : "Erreur lors de l'initiation du paiement",
      );
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="dash">
        <div className="dash-page-head">
          <h1>Nouvelle campagne</h1>
          <p>Chargement...</p>
        </div>
      </div>
    );
  }

  if (gerant && !gerant.is_verified) {
    return (
      <div className="dash">
        <div className="dash-page-head">
          <h1>Nouvelle campagne</h1>
        </div>
        <section className="verify-cta">
          <div className="verify-cta__icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
          </div>
          <div className="verify-cta__text">
            <h3>Vérification requise</h3>
            <p>Compte gérant non vérifié : la vérification est requise pour booster une chambre.</p>
          </div>
          <Link to={`${gerantPath}/verification`} className="verify-cta__btn" style={{ textDecoration: 'none' }}>
            Compléter la vérification
          </Link>
        </section>
        <Link to={`${gerantPath}/boosts`} className="admin-btn">
          ← Mes campagnes
        </Link>
      </div>
    );
  }

  if (disponibleRooms.length === 0) {
    return (
      <div className="dash">
        <div className="dash-page-head">
          <h1>Nouvelle campagne</h1>
        </div>
        <section className="panel">
          <div className="panel__head">
            <h2>Aucune chambre disponible</h2>
          </div>
          <div style={{ padding: '16px 24px', color: '#64748B', fontSize: 14 }}>
            Ajoutez une chambre disponible pour pouvoir la booster.{' '}
            <Link to={`${gerantPath}/chambres/ajouter`}>Ajouter une chambre</Link>
          </div>
        </section>
        <Link to={`${gerantPath}/boosts`} className="admin-btn">
          ← Mes campagnes
        </Link>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="dash">
        <div className="dash-page-head">
          <h1>Nouvelle campagne</h1>
          <p>Tarifs indisponibles pour le moment. Réessayez plus tard.</p>
        </div>
        <Link to={`${gerantPath}/boosts`} className="admin-btn">
          ← Mes campagnes
        </Link>
      </div>
    );
  }

  const selectedRoom = disponibleRooms.find((room) => room.id === effectiveRoomId);

  return (
    <div className="dash">
      <div className="admin-page__header">
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800 }}>Nouvelle campagne</h1>
          <p style={{ margin: '4px 0 0', fontSize: 14.5, color: 'var(--admin-ink-soft)' }}>
            Sponsorisez une chambre sur la page d'accueil du marché.
          </p>
        </div>
        <Link to={`${gerantPath}/boosts`} className="admin-btn">
          ← Mes campagnes
        </Link>
      </div>

      <section className="panel">
        <div className="panel__head">
          <h2>1. Chambre à booster</h2>
        </div>
        <div style={{ padding: '16px 24px' }}>
          <div className="boost-field">
            <label htmlFor="boost-room">Chambre</label>
            <select
              id="boost-room"
              className="admin-select"
              value={effectiveRoomId}
              onChange={(e) => setRoomId(e.target.value)}
            >
              {disponibleRooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.title}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel__head">
          <h2>2. Mode de facturation</h2>
        </div>
        <div style={{ padding: '16px 24px' }}>
          <div className="boost-options">
            <button
              type="button"
              className={`boost-option${mode === 'cpc' ? ' is-selected' : ''}`}
              aria-pressed={mode === 'cpc'}
              onClick={() => setMode('cpc')}
            >
              <span className="boost-option__title">
                Par clic — {boostAmount(config.price_cpc)}
              </span>
              <span className="boost-option__hint">
                Vous payez quand un visiteur clique sur l'annonce.
              </span>
            </button>
            <button
              type="button"
              className={`boost-option${mode === 'cpi' ? ' is-selected' : ''}`}
              aria-pressed={mode === 'cpi'}
              onClick={() => setMode('cpi')}
            >
              <span className="boost-option__title">
                Par impression — {boostAmount(config.price_cpi)}
              </span>
              <span className="boost-option__hint">
                Vous payez quand l'annonce est affichée à un visiteur.
              </span>
            </button>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel__head">
          <h2>3. Budget</h2>
        </div>
        <div style={{ padding: '16px 24px' }}>
          <div className="boost-options">
            {config.budgets.map((amount) => (
              <button
                key={amount}
                type="button"
                className={`boost-option${effectiveBudget === amount ? ' is-selected' : ''}`}
                aria-pressed={effectiveBudget === amount}
                onClick={() => setBudgetChoice(amount)}
              >
                <span className="boost-option__title">{boostAmount(amount, config.currency)}</span>
                <span className="boost-option__hint">
                  {mode === 'cpc'
                    ? `≈ ${Math.floor(amount / config.price_cpc)} clics`
                    : `≈ ${Math.floor(amount / config.price_cpi)} impressions`}
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel__head">
          <h2>4. Dates</h2>
        </div>
        <div style={{ padding: '16px 24px' }}>
          <div className="boost-form">
            <div className="boost-field">
              <label htmlFor="boost-start">Début</label>
              <input
                id="boost-start"
                type="date"
                value={startDay}
                min={isoDay(new Date())}
                onChange={(e) => setStartDay(e.target.value)}
              />
            </div>
            <div className="boost-field">
              <label htmlFor="boost-end">Fin</label>
              <input
                id="boost-end"
                type="date"
                value={endDay}
                min={startDay}
                onChange={(e) => setEndDay(e.target.value)}
              />
            </div>
            {windowError && (
              <p style={{ margin: 0, color: '#991B1B', fontSize: 13 }}>{windowError}</p>
            )}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel__head">
          <h2>5. Récapitulatif</h2>
        </div>
        <div style={{ padding: '16px 24px' }}>
          <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 2, color: '#334155', fontSize: 14 }}>
            <li>Chambre : {selectedRoom?.title ?? '—'}</li>
            <li>Mode : {mode === 'cpc' ? 'Par clic' : 'Par impression'} ({boostAmount(mode === 'cpc' ? config.price_cpc : config.price_cpi)} / {mode === 'cpc' ? 'clic' : 'impression'})</li>
            <li>Budget : {boostAmount(effectiveBudget, config.currency)}{estimate ? ` — ${estimate}` : ''}</li>
            <li>Du {startDay} au {endDay}</li>
          </ul>

          {error && (
            <div style={{ marginTop: 16, padding: '12px 16px', background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 10, color: '#991B1B', fontSize: 13.5 }}>
              {error}
            </div>
          )}

          <div className="boost-actions" style={{ marginTop: 16 }}>
            <Link to={`${gerantPath}/boosts`} className="admin-btn">
              Annuler
            </Link>
            <button
              className="admin-btn admin-btn--primary"
              onClick={handleSubmit}
              disabled={processing || Boolean(windowError)}
            >
              {processing ? 'Redirection...' : `Payer ${boostAmount(effectiveBudget, config.currency)}`}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

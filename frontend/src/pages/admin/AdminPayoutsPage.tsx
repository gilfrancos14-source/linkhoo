import { useCallback, useEffect, useRef, useState } from 'react';
import {
  apiAdmin,
  type AdminPayout,
  type AdminPayoutScope,
  type AdminPayoutStatus,
} from '../../lib/adminApi';
import { MARKETS } from '../../config/markets';
import '../../styles/20-auth.css';

/**
 * Reversements aux gérants.
 *
 * Le back-office doit voir ce qui est versé, ce qui est en attente et ce qui
 * a échoué — et pouvoir **relancer** un reversement bloqué (numéro mobile
 * money erroné, solde pawaPay insuffisant) sans intervenir en base.
 */

const STATUS_LABELS: Record<AdminPayoutStatus, string> = {
  scheduled: 'Programmé',
  processing: 'En cours',
  paid: 'Versé',
  failed: 'Échec',
  canceled: 'Annulé',
};

const STATUS_CLASSES: Record<AdminPayoutStatus, string> = {
  scheduled: 'admin-badge--info',
  processing: 'admin-badge--warning',
  paid: 'admin-badge--success',
  failed: 'admin-badge--danger',
  canceled: 'admin-badge--muted',
};

const SCOPES: { key: AdminPayoutScope; label: string }[] = [
  { key: 'attention', label: 'À traiter' },
  { key: 'failed', label: 'Échecs' },
  { key: 'scheduled', label: 'Programmés' },
  { key: 'processing', label: 'En cours' },
  { key: 'paid', label: 'Versés' },
  { key: 'all', label: 'Tous' },
];

function money(amount: number, currency: string): string {
  return `${new Intl.NumberFormat('fr-FR').format(amount)} ${currency}`;
}

function dateLabel(value: string | null): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function AdminPayoutsPage() {
  const [payouts, setPayouts] = useState<AdminPayout[]>([]);
  const [scope, setScope] = useState<AdminPayoutScope>('attention');
  const [market, setMarket] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retrying, setRetrying] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError('');
    try {
      const data = await apiAdmin.getPayouts({
        scope,
        market: market !== 'all' ? market : undefined,
      });
      if (!controller.signal.aborted) setPayouts(data.items);
    } catch {
      if (!controller.signal.aborted) setError('Impossible de charger les reversements.');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [scope, market]);

  useEffect(() => {
    load();
    return () => abortRef.current?.abort();
  }, [load]);

  const handleRetry = async (payout: AdminPayout) => {
    setRetrying(payout.id);
    setNotice('');
    setError('');
    try {
      await apiAdmin.retryPayout(payout.id);
      setNotice(`Reversement ${payout.reference} remis en file d'attente.`);
      await load();
    } catch {
      setError('Relance impossible : vérifiez le statut du reversement.');
    } finally {
      setRetrying(null);
    }
  };

  return (
    <div className="admin-page">
      <header className="admin-page__head">
        <h1 className="admin-page__title">Reversements aux gérants</h1>
        <p className="admin-page__subtitle">
          Ce qui a été viré aux gérants, ce qui est en attente, et ce qui a échoué.
          Un reversement en échec peut être remis en file d&apos;attente.
        </p>
      </header>

      <div className="admin-toolbar">
        <div className="admin-filters">
          {SCOPES.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`admin-chip ${scope === item.key ? 'is-active' : ''}`}
              onClick={() => setScope(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <select
          className="admin-select"
          value={market}
          onChange={(event) => setMarket(event.target.value)}
          aria-label="Filtrer par marché"
        >
          <option value="all">Tous les marchés</option>
          {MARKETS.map((m) => (
            <option key={m.code} value={m.code}>
              {m.code}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="admin-alert admin-alert--danger">{error}</p>}
      {notice && <p className="admin-alert admin-alert--success">{notice}</p>}

      {loading ? (
        <p className="admin-empty">Chargement…</p>
      ) : payouts.length === 0 ? (
        <p className="admin-empty">Aucun reversement dans cette vue.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Référence</th>
                <th>Gérant</th>
                <th>Montant</th>
                <th>Commission</th>
                <th>Net versé</th>
                <th>Destination</th>
                <th>Statut</th>
                <th>Date</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {payouts.map((payout) => (
                <tr key={payout.id}>
                  <td>
                    <span className="font-mono text-[11.5px]">{payout.reference}</span>
                    {payout.kind === 'withdrawal' && (
                      <span className="ml-2 text-[11px] text-[#8A99B5]">retrait demandé</span>
                    )}
                  </td>
                  <td>
                    <span className="block text-[12.5px] font-semibold text-[#0F2150]">
                      {payout.gerant_name ?? '—'}
                    </span>
                    <span className="block text-[11.5px] text-[#8A99B5]">{payout.gerant_email ?? ''}</span>
                  </td>
                  <td>{money(payout.gross_amount, payout.currency)}</td>
                  <td>
                    {money(payout.commission_amount, payout.currency)}
                    {payout.refunded_amount > 0 && (
                      <span className="block text-[11px] text-[#C25712]">
                        remboursé {money(payout.refunded_amount, payout.currency)}
                      </span>
                    )}
                  </td>
                  <td className="font-semibold">{money(payout.net_amount, payout.currency)}</td>
                  <td>
                    <span className="block text-[12px]">{payout.destination_phone ?? '—'}</span>
                    <span className="block text-[11px] text-[#8A99B5]">
                      {payout.destination_holder_name ?? ''}
                      {payout.destination_provider ? ` · ${payout.destination_provider}` : ''}
                    </span>
                  </td>
                  <td>
                    <span className={`admin-badge ${STATUS_CLASSES[payout.status]}`}>
                      {STATUS_LABELS[payout.status]}
                    </span>
                    {payout.failure_message && (
                      <span className="mt-1 block max-w-[220px] text-[11px] text-[#C25712]">
                        {payout.failure_message}
                      </span>
                    )}
                  </td>
                  <td className="text-[12px]">{dateLabel(payout.paid_at ?? payout.scheduled_for)}</td>
                  <td>
                    {payout.status !== 'paid' && payout.status !== 'processing' && (
                      <button
                        type="button"
                        className="admin-btn admin-btn--ghost"
                        onClick={() => handleRetry(payout)}
                        disabled={retrying === payout.id}
                      >
                        {retrying === payout.id ? 'Relance...' : 'Relancer'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

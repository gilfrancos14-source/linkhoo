import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Ban,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Globe2,
  Inbox,
  RefreshCw,
  Search,
  Sparkles,
  Wallet,
  XCircle,
} from 'lucide-react';
import {
  apiAdmin,
  type AdminPayout,
  type AdminPayoutCounts,
  type AdminPayoutScope,
  type AdminPayoutStatus,
} from '../../lib/adminApi';
import { MARKETS } from '../../config/markets';
import '../../styles/20-auth.css';
import '../../styles/45-admin-payouts.css';

/**
 * Reversements aux gérants.
 *
 * Le back-office doit voir ce qui est versé, ce qui est en attente et ce qui
 * a échoué — et pouvoir **relancer** un reversement bloqué (numéro mobile
 * money erroné, solde pawaPay insuffisant) sans intervenir en base.
 */

type StatusTone = 'info' | 'warning' | 'success' | 'danger' | 'muted';

const STATUS_META: Record<
  AdminPayoutStatus,
  { label: string; tone: StatusTone; icon: typeof CheckCircle2 }
> = {
  scheduled: { label: 'Programmé', tone: 'info', icon: CalendarClock },
  processing: { label: 'En cours', tone: 'warning', icon: Clock3 },
  paid: { label: 'Versé', tone: 'success', icon: CheckCircle2 },
  failed: { label: 'Échec', tone: 'danger', icon: XCircle },
  canceled: { label: 'Annulé', tone: 'muted', icon: Ban },
};

const SCOPES: { key: AdminPayoutScope; label: string }[] = [
  { key: 'attention', label: 'À traiter' },
  { key: 'failed', label: 'Échecs' },
  { key: 'scheduled', label: 'Programmés' },
  { key: 'processing', label: 'En cours' },
  { key: 'paid', label: 'Versés' },
  { key: 'all', label: 'Tous' },
];

const SCOPE_COUNT_KEY: Record<AdminPayoutScope, keyof AdminPayoutCounts | null> = {
  attention: null,
  failed: 'failed',
  scheduled: 'scheduled',
  processing: 'processing',
  paid: 'paid',
  all: 'total',
};

const KPIS: {
  key: keyof AdminPayoutCounts;
  label: string;
  hint: string;
  tone: StatusTone;
  icon: typeof CheckCircle2;
}[] = [
  { key: 'failed', label: 'À traiter', hint: 'Virements en échec', tone: 'danger', icon: AlertTriangle },
  { key: 'scheduled', label: 'Programmés', hint: 'En attente d’exécution', tone: 'info', icon: CalendarClock },
  { key: 'processing', label: 'En cours', hint: 'Traitement pawaPay', tone: 'warning', icon: Clock3 },
  { key: 'paid', label: 'Versés', hint: 'Virements effectués', tone: 'success', icon: CheckCircle2 },
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

function initials(name: string | null): string {
  if (!name) return '—';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export default function AdminPayoutsPage() {
  const [payouts, setPayouts] = useState<AdminPayout[]>([]);
  const [counts, setCounts] = useState<AdminPayoutCounts | null>(null);
  const [scope, setScope] = useState<AdminPayoutScope>('attention');
  const [market, setMarket] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('');
  const [error, setError] = useState('');
  const [retrying, setRetrying] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(
    async (isRefresh = false) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError('');
      try {
        const data = await apiAdmin.getPayouts({
          scope,
          market: market !== 'all' ? market : undefined,
        });
        if (!controller.signal.aborted) {
          setPayouts(data.items);
          setCounts(data.counts ?? null);
          setLastUpdated(
            new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
          );
        }
      } catch {
        if (!controller.signal.aborted) setError('Impossible de charger les reversements.');
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [scope, market],
  );

  useEffect(() => {
    load();
    return () => abortRef.current?.abort();
  }, [load]);

  const visiblePayouts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return payouts;
    return payouts.filter((payout) =>
      [
        payout.reference,
        payout.gerant_name,
        payout.gerant_email,
        payout.destination_phone,
        payout.destination_holder_name,
      ].some((value) => value?.toLowerCase().includes(query)),
    );
  }, [payouts, search]);

  const handleRetry = async (payout: AdminPayout) => {
    setRetrying(payout.id);
    setNotice('');
    setError('');
    try {
      await apiAdmin.retryPayout(payout.id);
      setNotice(`Reversement ${payout.reference} remis en file d'attente.`);
      await load(true);
    } catch {
      setError('Relance impossible : vérifiez le statut du reversement.');
    } finally {
      setRetrying(null);
    }
  };

  return (
    <div className="payouts-page">
      {/* ── En-tête ── */}
      <header className="payouts-hero">
        <span className="payouts-hero__glow" aria-hidden="true" />
        <span className="payouts-hero__pattern" aria-hidden="true" />
        <div className="payouts-hero__copy">
          <span className="payouts-hero__eyebrow">
            <Sparkles size={13} aria-hidden="true" />
            Finance · Suivi des virements
          </span>
          <h1>Reversements aux gérants</h1>
          <p>
            Ce qui a été viré aux gérants, ce qui est en attente, et ce qui a échoué.
            Un reversement en échec peut être remis en file d&apos;attente.
          </p>
        </div>
        <div className="payouts-hero__side">
          <div className="payouts-hero__stat">
            <span>Flux suivis</span>
            <strong>{counts?.total ?? '—'}</strong>
          </div>
          <button
            type="button"
            className="payouts-hero__refresh"
            onClick={() => load(true)}
            disabled={refreshing}
          >
            <RefreshCw size={15} className={refreshing ? 'payouts-spin' : ''} aria-hidden="true" />
            {refreshing ? 'Actualisation...' : 'Actualiser'}
          </button>
          {lastUpdated && (
            <span className="payouts-hero__updated">Mis à jour à {lastUpdated}</span>
          )}
        </div>
      </header>

      {/* ── Indicateurs ── */}
      <section className="payouts-kpis" aria-label="Synthèse des reversements">
        {KPIS.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <article key={kpi.key} className={`payouts-kpi payouts-kpi--${kpi.tone}`}>
              <span className="payouts-kpi__icon">
                <Icon size={19} strokeWidth={2} aria-hidden="true" />
              </span>
              <div className="payouts-kpi__body">
                <span className="payouts-kpi__label">{kpi.label}</span>
                <strong className="payouts-kpi__value">
                  {counts ? counts[kpi.key] : '—'}
                </strong>
                <span className="payouts-kpi__hint">{kpi.hint}</span>
              </div>
            </article>
          );
        })}
      </section>

      {error && (
        <p className="payouts-alert payouts-alert--danger">
          <AlertCircle size={16} aria-hidden="true" />
          {error}
        </p>
      )}
      {notice && (
        <p className="payouts-alert payouts-alert--success">
          <CheckCircle2 size={16} aria-hidden="true" />
          {notice}
        </p>
      )}

      {/* ── Filtres ── */}
      <div className="payouts-toolbar">
        <div className="payouts-tabs" role="tablist" aria-label="Filtrer les reversements">
          {SCOPES.map((item) => {
            const countKey = SCOPE_COUNT_KEY[item.key];
            const count = countKey && counts ? counts[countKey] : null;
            return (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={scope === item.key}
                className={`payouts-tab ${scope === item.key ? 'is-active' : ''}`}
                onClick={() => setScope(item.key)}
              >
                {item.label}
                {count !== null && <span className="payouts-tab__count">{count}</span>}
              </button>
            );
          })}
        </div>

        <div className="payouts-tools">
          <label className="payouts-search">
            <Search size={15} aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Référence, gérant, téléphone…"
              aria-label="Rechercher un reversement"
            />
          </label>
          <div className="payouts-select-wrap">
            <Globe2 size={15} aria-hidden="true" />
            <select
              className="payouts-select"
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
            <ChevronDown size={14} aria-hidden="true" />
          </div>
        </div>
      </div>

      {/* ── Journal ── */}
      <section className="payouts-panel">
        <div className="payouts-panel__head">
          <div>
            <h2 className="payouts-panel__title">
              <span className="payouts-panel__title-icon">
                <Wallet size={16} aria-hidden="true" />
              </span>
              Journal des reversements
            </h2>
            <p className="payouts-panel__meta">
              Relancez un virement bloqué pour le remettre en file d&apos;attente.
            </p>
            <p className="payouts-scroll-hint">Faites glisser le tableau pour voir les détails →</p>
          </div>
          <span className="payouts-panel__count">
            {visiblePayouts.length} ligne{visiblePayouts.length > 1 ? 's' : ''}
          </span>
        </div>

        {loading ? (
          <div className="payouts-loading" aria-label="Chargement des reversements">
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="payouts-skeleton" />
            ))}
          </div>
        ) : visiblePayouts.length === 0 ? (
          <div className="payouts-empty">
            <span className="payouts-empty__icon">
              <Inbox size={27} aria-hidden="true" />
            </span>
            <h3>{search.trim() ? 'Aucun résultat' : 'Aucun reversement dans cette vue'}</h3>
            <p>
              {search.trim()
                ? `Aucun reversement ne correspond à « ${search.trim()} ».`
                : 'Essayez un autre filtre ou un autre marché pour afficher des virements.'}
            </p>
          </div>
        ) : (
          <div className="payouts-table-wrap">
            <table className="payouts-table">
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Gérant</th>
                  <th>Montant</th>
                  <th>Commission</th>
                  <th>Net versé</th>
                  <th>Destination</th>
                  <th>Statut</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visiblePayouts.map((payout) => {
                  const status = STATUS_META[payout.status];
                  const StatusIcon = status.icon;
                  return (
                    <tr key={payout.id}>
                      <td>
                        <span className="payouts-ref">{payout.reference}</span>
                        <span className="payouts-kind">
                          {payout.kind === 'withdrawal' ? 'retrait demandé · ' : ''}
                          {dateLabel(payout.paid_at ?? payout.scheduled_for)}
                        </span>
                      </td>
                      <td>
                        <div className="payouts-person">
                          <span className="payouts-avatar" aria-hidden="true">
                            {initials(payout.gerant_name)}
                          </span>
                          <span>
                            <span className="payouts-person__name">
                              {payout.gerant_name ?? '—'}
                            </span>
                            <span className="payouts-person__mail">
                              {payout.gerant_email ?? ''}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td className="payouts-amount">{money(payout.gross_amount, payout.currency)}</td>
                      <td>
                        <span className="payouts-amount">
                          {money(payout.commission_amount, payout.currency)}
                        </span>
                        {payout.refunded_amount > 0 && (
                          <span className="payouts-refund">
                            remboursé {money(payout.refunded_amount, payout.currency)}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="payouts-amount--net">
                          {money(payout.net_amount, payout.currency)}
                        </span>
                      </td>
                      <td>
                        <span className="payouts-phone">{payout.destination_phone ?? '—'}</span>
                        <span className="payouts-dest-meta">
                          {payout.destination_holder_name ?? ''}
                          {payout.destination_provider ? ` · ${payout.destination_provider}` : ''}
                        </span>
                      </td>
                      <td>
                        <span className={`payouts-status payouts-status--${status.tone}`}>
                          <StatusIcon size={12} aria-hidden="true" />
                          {status.label}
                        </span>
                        {payout.failure_message && (
                          <span className="payouts-failure">{payout.failure_message}</span>
                        )}
                      </td>
                      <td>
                        {payout.status !== 'paid' && payout.status !== 'processing' && (
                          <button
                            type="button"
                            className="payouts-retry"
                            onClick={() => handleRetry(payout)}
                            disabled={retrying === payout.id}
                          >
                            <RefreshCw
                              size={12}
                              className={retrying === payout.id ? 'payouts-spin' : ''}
                              aria-hidden="true"
                            />
                            {retrying === payout.id ? 'Relance...' : 'Relancer'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="payouts-panel__foot">
          <span>
            {SCOPES.find((item) => item.key === scope)?.label} ·{' '}
            {market === 'all' ? 'Tous les marchés' : market}
          </span>
          <span>Montants dans la devise du marché</span>
        </div>
      </section>
    </div>
  );
}

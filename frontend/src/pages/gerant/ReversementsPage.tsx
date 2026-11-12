import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  apiPayouts,
  type PayoutBalanceData,
  type PayoutData,
  type PayoutMethod,
  type PayoutSettingsData,
  type PayoutStatus,
} from '../../lib/api';
import { formatDate, formatDateTimeShort } from '../../lib/formatDate';
import GerantSidebar from '../../components/gerant/GerantSidebar';
import { formatPrice } from '../../lib/roomDisplay';

/**
 * Opérateurs mobile money connus de pawaPay (union des marchés). Sert seulement
 * d'aide à la saisie : la vérité reste la vérification administrateur, et le
 * backend valide la destination finale au moment du transfert.
 */
const KNOWN_MOBILE_PROVIDERS = [
  'ORANGE_CIV',
  'MTN_MOMO_CIV',
  'WAVE_CIV',
  'MOOV_BEN',
  'FREE_SEN',
  'ORANGE_SEN',
  'WAVE_SEN',
  'MTN_MOMO_CMR',
  'ORANGE_CMR',
  'MOOV_BFA',
  'ORANGE_BFA',
  'AIRTEL_COG',
  'MTN_MOMO_COG',
  'AIRTEL_GAB',
] as const;

const STATUS_LABELS: Record<PayoutStatus, string> = {
  scheduled: 'Programmé',
  processing: 'En cours',
  paid: 'Versé',
  failed: 'Échec',
  canceled: 'Annulé',
};

const STATUS_CLASSES: Record<PayoutStatus, string> = {
  scheduled: 'admin-badge--warning',
  processing: 'admin-badge--info',
  paid: 'admin-badge--success',
  failed: 'admin-badge--danger',
  canceled: 'admin-badge--muted',
};

/** Un échec technique n'est pas un échec métier : on l'explique autrement. */
function statusLabel(payout: PayoutData): string {
  if (payout.status === 'scheduled' && payout.failure_code === 'payout_details_missing') {
    return 'Coordonnées à compléter';
  }
  if (payout.status === 'processing' && payout.failure_code === 'unconfirmed') {
    return 'Vérification en cours';
  }
  return STATUS_LABELS[payout.status];
}

function money(amount: number, currency: string): string {
  return `${formatPrice(amount)} ${currency}`;
}

interface FormState {
  method: PayoutMethod;
  phone: string;
  provider: string;
  bankCode: string;
  bankName: string;
  accountNumber: string;
  holderName: string;
}

const EMPTY_FORM: FormState = {
  method: 'mobile_money',
  phone: '',
  provider: 'ORANGE_CIV',
  bankCode: '',
  bankName: '',
  accountNumber: '',
  holderName: '',
};

/** Opérateur canonique : la valeur enregistrée peut être en minuscules. */
function canonicalProvider(value: string): string {
  return value.trim().toUpperCase();
}

function formFromSettings(settings: PayoutSettingsData | null): FormState {
  if (!settings) return EMPTY_FORM;

  const providers = settings.providers ?? [];
  const saved = settings.provider ? canonicalProvider(settings.provider) : '';
  const provider = saved && (providers.length === 0 || providers.includes(saved))
    ? saved
    : providers[0] || saved || 'ORANGE_CIV';

  return {
    // pawaPay ne reverse que par mobile money : un ancien réglage bancaire
    // doit être ramené vers le seul moyen réellement exécutable.
    method: 'mobile_money',
    phone: settings.phone ?? '',
    provider,
    bankCode: settings.bank_code ?? '',
    bankName: settings.bank_name ?? '',
    accountNumber: settings.account_number ?? '',
    holderName: settings.holder_name ?? '',
  };
}

/** Même règles que `payoutSettingsSchema` : messages locaux, pas de round-trip. */
function validate(form: FormState): string | null {
  if (!form.holderName.trim() || form.holderName.trim().length < 2) {
    return 'Renseignez le nom du titulaire du compte.';
  }
  if (!form.phone.trim()) {
    return form.method === 'mobile_money'
      ? 'Renseignez le numéro mobile money.'
      : 'Renseignez le numéro du bénéficiaire.';
  }
  if (form.method === 'mobile_money') {
    if (!form.provider.trim()) return "Choisissez l'opérateur mobile money.";
    return null;
  }
  if (!form.bankName.trim()) return 'Renseignez le nom de la banque.';
  if (!form.bankCode.trim()) return 'Renseignez le code banque.';
  if (!form.accountNumber.trim()) return 'Renseignez le numéro de compte.';
  return null;
}

export default function ReversementsPage() {
  const [settings, setSettings] = useState<PayoutSettingsData | null>(null);
  const [payouts, setPayouts] = useState<PayoutData[]>([]);
  const [balance, setBalance] = useState<PayoutBalanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState('');
  const [withdrawSuccess, setWithdrawSuccess] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiPayouts.getSettings(),
      apiPayouts.listMine(),
      apiPayouts.getBalance(),
    ])
      .then(([nextSettings, nextPayouts, nextBalance]) => {
        if (cancelled) return;
        setSettings(nextSettings);
        setForm(formFromSettings(nextSettings));
        setPayouts(nextPayouts);
        setBalance(nextBalance);
      })
      .catch(() => {
        if (!cancelled) setLoadError('Impossible de charger vos reversements.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const totalPaid = useMemo(
    () =>
      payouts
        .filter((payout) => payout.status === 'paid')
        .reduce((sum, payout) => sum + payout.net_amount, 0),
    [payouts],
  );

  const currency = balance?.currency ?? payouts[0]?.currency ?? 'XOF';

  const activeWithdrawal = useMemo(
    () =>
      payouts.some(
        (payout) =>
          payout.kind === 'withdrawal' &&
          (payout.status === 'scheduled' || payout.status === 'processing'),
      ),
    [payouts],
  );

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
    setSaveError('');
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaveError('');
    setSaved(false);

    const error = validate(form);
    if (error) {
      setSaveError(error);
      return;
    }

    setSaving(true);
    try {
      const next = await apiPayouts.saveSettings({
        method: form.method,
        holder_name: form.holderName.trim(),
        phone: form.phone.trim(),
        provider: form.method === 'mobile_money' ? form.provider.trim() : null,
        bank_code: form.method === 'bank_transfer' ? form.bankCode.trim() : null,
        bank_name: form.method === 'bank_transfer' ? form.bankName.trim() : null,
        account_number: form.method === 'bank_transfer' ? form.accountNumber.trim() : null,
      });
      setSettings(next);
      setForm(formFromSettings(next));
      setSaved(true);
    } catch (err) {
      setSaveError(
        err instanceof Error && err.message
          ? err.message
          : "L'enregistrement a échoué. Réessayez.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleWithdraw = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setWithdrawError('');
    setWithdrawSuccess('');

    if (!balance) return;
    if (!settings?.verified) {
      setWithdrawError('Complétez et enregistrez vos coordonnées mobile money avant de demander un retrait.');
      return;
    }
    if (activeWithdrawal) {
      setWithdrawError('Un retrait est déjà en cours de traitement.');
      return;
    }

    const raw = withdrawAmount.trim();
    let amount: number | undefined;
    if (raw) {
      amount = Number(raw);
      if (!Number.isInteger(amount) || amount <= 0) {
        setWithdrawError('Saisissez un montant entier supérieur à zéro.');
        return;
      }
      if (amount > balance.available) {
        setWithdrawError(`Le montant dépasse votre solde disponible (${money(balance.available, currency)}).`);
        return;
      }
    }

    setWithdrawing(true);
    try {
      const result = await apiPayouts.requestWithdrawal(amount);
      setBalance(result.balance);
      setPayouts((prev) => [result.payout, ...prev]);
      setWithdrawAmount('');
      setWithdrawSuccess(
        `Retrait de ${money(result.payout.net_amount, result.payout.currency)} demandé. Vous serez notifié dès le versement.`,
      );
    } catch (err) {
      setWithdrawError(
        err instanceof Error && err.message
          ? err.message
          : 'La demande de retrait a échoué. Réessayez.',
      );
    } finally {
      setWithdrawing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen">
        <GerantSidebar />
        <div className="min-w-0 flex-1">
          <div className="admin-page">
            <div className="admin-page__header">
              <h2 className="dash-page-head">Reversements</h2>
            </div>
            <p className="admin-page__subtitle">Chargement...</p>
          </div>
        </div>
      </div>
    );
  }

  const verified = Boolean(settings?.verified);
  const missing = settings?.missing_fields ?? [];
  // La liste du marché (backend) fait foi ; l'union codée en dur ne sert que
  // de secours si l'API ne renvoie rien.
  const marketProviders = settings?.providers ?? [];
  const baseProviders: readonly string[] =
    marketProviders.length > 0 ? marketProviders : KNOWN_MOBILE_PROVIDERS;
  const providerOptions = baseProviders.includes(form.provider)
    ? baseProviders
    : [...baseProviders, form.provider].filter(Boolean);

  return (
    <div className="flex min-h-screen">
      <GerantSidebar />
      <div className="min-w-0 flex-1">
        <div className="admin-page">
          <div className="admin-page__header">
            <h2 className="dash-page-head">Reversements</h2>
            <span className="admin-page__subtitle">
              Total versé : <strong>{money(balance?.paid ?? totalPaid, currency)}</strong>
            </span>
          </div>

          {loadError && (
            <p className="verif-alert verif-alert--danger" role="alert">{loadError}</p>
          )}

          <section className="mb-5 rounded-2xl border border-[#EEF2F8] bg-white p-5 shadow-[0_2px_10px_rgba(20,40,90,0.04)]">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#8A99B5]">
                  Solde disponible
                </p>
                <p className="mt-1 text-[30px] font-extrabold leading-none text-[#0F2150]">
                  {money(balance?.available ?? 0, currency)}
                </p>
                <p className="mt-2 max-w-md text-[12.5px] leading-5 text-[#5F7396]">
                  Crédité automatiquement par vos séjours terminés et payés en ligne.
                  Un séjour annulé ou remboursé ne crédite rien.
                </p>
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-[#F4F7FC] px-2.5 py-1 text-[11.5px] font-semibold text-[#5F7396]">
                  Commission prélevée : {balance?.commission_percent ?? 0} %
                  <span className="font-normal text-[#8A99B5]">
                    (5 % si vous êtes premium et vérifié, 10 % si vous êtes
                    vérifié, 15 % sinon)
                  </span>
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl bg-[#FFF7ED] px-4 py-3">
                  <p className="text-[11px] font-semibold text-[#C25712]">En cours</p>
                  <p className="mt-0.5 text-[15px] font-bold text-[#0F2150]">
                    {money(balance?.pending ?? 0, currency)}
                  </p>
                </div>
                <div className="rounded-xl bg-[#E6F6EF] px-4 py-3">
                  <p className="text-[11px] font-semibold text-[#2E9E78]">Déjà versé</p>
                  <p className="mt-0.5 text-[15px] font-bold text-[#0F2150]">
                    {money(balance?.paid ?? totalPaid, currency)}
                  </p>
                </div>
              </div>
            </div>

            <form
              className="mt-5 flex flex-wrap items-end gap-3 border-t border-[#EEF2F8] pt-4"
              onSubmit={handleWithdraw}
            >
              <label className="block">
                <span className="text-[12px] font-semibold text-[#1F3566]">
                  Montant à retirer
                </span>
                <input
                  className="admin-input mt-1 w-44"
                  value={withdrawAmount}
                  onChange={(event) => {
                    setWithdrawAmount(event.target.value.replace(/[^0-9]/g, ''));
                    setWithdrawError('');
                    setWithdrawSuccess('');
                  }}
                  inputMode="numeric"
                  placeholder={String(balance?.available ?? 0)}
                  disabled={withdrawing || activeWithdrawal}
                />
              </label>
              <button
                type="submit"
                className="admin-btn admin-btn--primary"
                disabled={
                  withdrawing ||
                  activeWithdrawal ||
                  !settings?.verified ||
                  (balance?.available ?? 0) <= 0
                }
              >
                {withdrawing ? 'Demande en cours...' : 'Demander un retrait'}
              </button>
              <p className="basis-full text-[11.5px] text-[#8A99B5]">
                Laissez vide pour retirer tout le solde disponible. Le versement est
                exécuté par pawaPay sur votre compte mobile money.
              </p>
            </form>

            {!settings?.verified && (
              <p className="verif-alert mt-3" role="status">
                Complétez vos coordonnées mobile money ci-dessous pour débloquer le retrait.
              </p>
            )}
            {activeWithdrawal && (
              <p className="verif-alert mt-3" role="status">
                Un retrait est déjà en cours. Attendez son issue avant d'en demander un autre.
              </p>
            )}
            {withdrawError && (
              <p className="verif-alert verif-alert--danger mt-3" role="alert">{withdrawError}</p>
            )}
            {withdrawSuccess && (
              <p className="verif-alert mt-3" role="status">{withdrawSuccess}</p>
            )}
          </section>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <section className="rounded-2xl border border-[#EEF2F8] bg-white p-5 shadow-[0_2px_10px_rgba(20,40,90,0.04)]">
              <h3 className="text-[15px] font-bold text-[#0F2150]">Mes coordonnées</h3>
              <p className="mt-1 text-[12.5px] leading-5 text-[#5F7396]">
                Les séjours payés en ligne créditent votre solde une fois terminés.
                Le retrait est ensuite versé par pawaPay sur ce compte mobile money.
              </p>

              <div
                className={`mt-3 rounded-xl px-4 py-3 text-[12.5px] font-semibold ${
                  verified
                    ? 'bg-[#E6F6EF] text-[#2E9E78]'
                    : 'bg-[#FFF1E8] text-[#C25712]'
                }`}
                role="status"
              >
                {verified
                  ? 'Coordonnées mobile money prêtes à recevoir vos retraits.'
                  : missing.length > 0
                    ? 'Coordonnées incomplètes : le retrait sera bloqué tant qu\'elles ne sont pas renseignées.'
                    : 'Vérifiez votre numéro et votre opérateur avant de demander un retrait.'}
              </div>

              <form className="mt-4 space-y-4" onSubmit={handleSubmit} noValidate>
                <label className="block">
                  <span className="text-[12px] font-semibold text-[#1F3566]">Titulaire du compte</span>
                  <input
                    className="admin-input mt-1 w-full"
                    value={form.holderName}
                    onChange={(event) => update('holderName', event.target.value)}
                    autoComplete="name"
                    required
                  />
                </label>

                <label className="block">
                  <span className="text-[12px] font-semibold text-[#1F3566]">Numéro mobile money</span>
                  <input
                    className="admin-input mt-1 w-full"
                    value={form.phone}
                    onChange={(event) => update('phone', event.target.value)}
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="+225 07 00 00 00"
                    required
                  />
                </label>

                <label className="block">
                  <span className="text-[12px] font-semibold text-[#1F3566]">Opérateur</span>
                  <select
                    className="admin-select mt-1 w-full"
                    value={form.provider}
                    onChange={(event) => update('provider', event.target.value)}
                  >
                    {providerOptions.map((provider) => (
                      <option key={provider} value={provider}>
                        {provider}
                      </option>
                    ))}
                  </select>
                </label>

                {saveError && (
                  <p className="verif-alert verif-alert--danger" role="alert">{saveError}</p>
                )}
                {saved && (
                  <p className="verif-alert" role="status">
                    Coordonnées enregistrées. Vous pouvez maintenant demander un retrait.
                  </p>
                )}

                <button
                  type="submit"
                  className="admin-btn admin-btn--primary"
                  disabled={saving}
                >
                  {saving ? 'Enregistrement...' : 'Enregistrer mes coordonnées'}
                </button>
              </form>
            </section>

            <section className="rounded-2xl border border-[#EEF2F8] bg-white p-5 shadow-[0_2px_10px_rgba(20,40,90,0.04)]">
              <h3 className="text-[15px] font-bold text-[#0F2150]">Historique</h3>
              <p className="mt-1 text-[12.5px] leading-5 text-[#5F7396]">
                Vos retraits et les mouvements de votre portefeuille, du plus récent au
                plus ancien.
              </p>

              {payouts.length === 0 ? (
                <p className="mt-6 rounded-xl bg-[#F7F9FD] px-4 py-6 text-center text-[12.5px] text-[#5F7396]">
                  Aucun mouvement pour le moment.
                </p>
              ) : (
                <ul className="mt-4 divide-y divide-[#EEF2F8]">
                  {payouts.map((payout) => (
                    <li key={payout.id} className="py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[13px] font-bold text-[#0F2150]">
                            {money(payout.net_amount, payout.currency)}
                          </p>
                          <p className="mt-0.5 text-[11.5px] font-semibold text-[#40527C]">
                            {payout.kind === 'withdrawal' ? 'Retrait demandé' : 'Séjour terminé'}
                          </p>
                          <p className="text-[11.5px] text-[#8A99B5]">
                            Réf. {payout.reference}
                          </p>
                          <p className="text-[11.5px] text-[#8A99B5]">
                            {payout.paid_at
                              ? `Versé le ${formatDateTimeShort(payout.paid_at)}`
                              : `Demandé le ${formatDate(payout.requested_at ?? payout.created_at)}`}
                          </p>
                          {payout.refunded_amount > 0 && (
                            <p className="text-[11.5px] text-[#8A99B5]">
                              Remboursé au client : {money(payout.refunded_amount, payout.currency)}
                            </p>
                          )}
                        </div>
                        <span className={`admin-badge ${STATUS_CLASSES[payout.status]} shrink-0`}>
                          {statusLabel(payout)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  apiPayouts,
  type PayoutData,
  type PayoutMethod,
  type PayoutSettingsData,
  type PayoutStatus,
} from '../../lib/api';
import { formatDate, formatDateTimeShort } from '../../lib/formatDate';
import { formatPrice } from '../../lib/roomDisplay';

/**
 * Opérateurs mobile money connus de Hub2 (union des marchés). Sert seulement
 * d'aide à la saisie : la vérité reste la vérification administrateur, et le
 * backend valide la destination finale au moment du transfert.
 */
const KNOWN_MOBILE_PROVIDERS = [
  'orange',
  'mtn',
  'moov',
  'wave',
  'free',
  'emoney',
  'celtiis',
  'togocell',
  'mobicash',
  'airtel',
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
  provider: 'orange',
  bankCode: '',
  bankName: '',
  accountNumber: '',
  holderName: '',
};

function formFromSettings(settings: PayoutSettingsData | null): FormState {
  if (!settings) return EMPTY_FORM;
  return {
    method: settings.method ?? 'mobile_money',
    phone: settings.phone ?? '',
    provider: settings.provider ?? 'orange',
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
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([apiPayouts.getSettings(), apiPayouts.listMine()])
      .then(([nextSettings, nextPayouts]) => {
        if (cancelled) return;
        setSettings(nextSettings);
        setForm(formFromSettings(nextSettings));
        setPayouts(nextPayouts);
      })
      .catch(() => {
        if (!cancelled) setLoadError('Impossible de charger vos coordonnées de reversement.');
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

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-page__header">
          <h2>Reversements</h2>
        </div>
        <p className="admin-page__subtitle">Chargement...</p>
      </div>
    );
  }

  const verified = Boolean(settings?.verified);
  const missing = settings?.missing_fields ?? [];
  // Un opérateur déjà enregistré mais absent de la liste connue doit rester
  // sélectionnable : sinon le select afficherait « orange » tout en envoyant
  // l'ancienne valeur.
  const providerOptions = (
    KNOWN_MOBILE_PROVIDERS as readonly string[]
  ).includes(form.provider)
    ? KNOWN_MOBILE_PROVIDERS
    : [...KNOWN_MOBILE_PROVIDERS, form.provider].filter(Boolean);

  return (
    <div className="admin-page">
      <div className="admin-page__header">
        <h2>Reversements</h2>
        <span className="admin-page__subtitle">
          Total versé : <strong>{money(totalPaid, payouts[0]?.currency ?? 'XOF')}</strong>
        </span>
      </div>

      {loadError && (
        <p className="verif-alert verif-alert--danger" role="alert">{loadError}</p>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="rounded-2xl border border-[#EEF2F8] bg-white p-5 shadow-[0_2px_10px_rgba(20,40,90,0.04)]">
          <h3 className="text-[15px] font-bold text-[#0F2150]">Mes coordonnées</h3>
          <p className="mt-1 text-[12.5px] leading-5 text-[#5F7396]">
            L'argent de vos réservations payées en ligne est reversé sur ce compte,
            24 h après le début du séjour. Toute modification doit être vérifiée par
            un administrateur avant le prochain versement.
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
              ? `Coordonnées vérifiées${settings?.verified_at ? ` le ${formatDate(settings.verified_at)}` : ''}.`
              : missing.length > 0
                ? 'Coordonnées incomplètes : aucun versement ne partira avant qu’elles soient complètes et vérifiées.'
                : 'Coordonnées en attente de vérification par un administrateur.'}
          </div>

          <form className="mt-4 space-y-4" onSubmit={handleSubmit} noValidate>
            <fieldset>
              <legend className="text-[12px] font-semibold text-[#1F3566]">
                Moyen de réception
              </legend>
              <div className="mt-2 flex gap-2">
                {([
                  ['mobile_money', 'Mobile money'],
                  ['bank_transfer', 'Virement bancaire'],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={form.method === value}
                    onClick={() => update('method', value)}
                    className={`h-9 rounded-lg border px-4 text-[12px] font-semibold transition ${
                      form.method === value
                        ? 'border-[#F26B1D] bg-[#FDEDE2] text-[#C25712]'
                        : 'border-[#E1E8F4] bg-white text-[#40527C] hover:bg-[#F7F9FD]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>

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
              <span className="text-[12px] font-semibold text-[#1F3566]">
                {form.method === 'mobile_money' ? 'Numéro mobile money' : 'Numéro du bénéficiaire'}
              </span>
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

            {form.method === 'mobile_money' ? (
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
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-[12px] font-semibold text-[#1F3566]">Banque</span>
                  <input
                    className="admin-input mt-1 w-full"
                    value={form.bankName}
                    onChange={(event) => update('bankName', event.target.value)}
                    required
                  />
                </label>
                <label className="block">
                  <span className="text-[12px] font-semibold text-[#1F3566]">Code banque</span>
                  <input
                    className="admin-input mt-1 w-full"
                    value={form.bankCode}
                    onChange={(event) => update('bankCode', event.target.value)}
                    required
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="text-[12px] font-semibold text-[#1F3566]">Numéro de compte</span>
                  <input
                    className="admin-input mt-1 w-full"
                    value={form.accountNumber}
                    onChange={(event) => update('accountNumber', event.target.value)}
                    inputMode="numeric"
                    required
                  />
                </label>
              </div>
            )}

            {saveError && (
              <p className="verif-alert verif-alert--danger" role="alert">{saveError}</p>
            )}
            {saved && (
              <p className="verif-alert" role="status">
                Coordonnées enregistrées. Elles seront vérifiées par un administrateur
                avant le prochain versement.
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
          <h3 className="text-[15px] font-bold text-[#0F2150]">Historique des reversements</h3>
          <p className="mt-1 text-[12.5px] leading-5 text-[#5F7396]">
            Chaque séjour payé en ligne génère un reversement du montant net, une fois
            le délai de sécurité écoulé.
          </p>

          {payouts.length === 0 ? (
            <p className="mt-6 rounded-xl bg-[#F7F9FD] px-4 py-6 text-center text-[12.5px] text-[#5F7396]">
              Aucun reversement pour le moment.
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
                      <p className="mt-0.5 text-[11.5px] text-[#5F7396]">
                        Réf. {payout.reference}
                      </p>
                      <p className="text-[11.5px] text-[#8A99B5]">
                        {payout.paid_at
                          ? `Versé le ${formatDateTimeShort(payout.paid_at)}`
                          : `Prévu le ${formatDate(payout.scheduled_for)}`}
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
  );
}

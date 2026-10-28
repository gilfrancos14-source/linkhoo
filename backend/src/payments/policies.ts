/**
 * Politique commerciale d'un marché (`payment_policies`).
 *
 * La base est la source de vérité : les décisions produit (encaissement à
 * 100 %, commission nulle, reversement à J+1) y sont stockées pour pouvoir
 * évoluer sans redéploiement. En cas de ligne absente, on retombe sur des
 * valeurs SÛRES : paiement en ligne désactivé, sinon une nouvelle market
 * ouvrirait un checkout non voulu.
 */

import { supabaseAdmin } from '../config/supabase';
import type { MarketCode } from '../config/markets';

export interface PaymentPolicy {
  readonly market: MarketCode;
  readonly onlinePaymentEnabled: boolean;
  readonly depositPercent: number;
  readonly commissionPercent: number;
  readonly payoutDelayHours: number;
}

const DEFAULT_POLICY: Omit<PaymentPolicy, 'market'> = {
  onlinePaymentEnabled: false,
  depositPercent: 100,
  commissionPercent: 0,
  payoutDelayHours: 24,
};

interface PolicyRow {
  market: string;
  online_payment_enabled: boolean | null;
  deposit_percent: number | string | null;
  commission_percent: number | string | null;
  payout_delay_hours: number | string | null;
}

function toNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function getPaymentPolicy(market: MarketCode): Promise<PaymentPolicy> {
  const { data, error } = await supabaseAdmin
    .from('payment_policies')
    .select(
      'market, online_payment_enabled, deposit_percent, commission_percent, payout_delay_hours',
    )
    .eq('market', market)
    .maybeSingle();

  if (error) throw error;

  const row = data as PolicyRow | null;
  if (!row) return { market, ...DEFAULT_POLICY };

  return {
    market,
    onlinePaymentEnabled: row.online_payment_enabled === true,
    depositPercent: toNumber(row.deposit_percent, DEFAULT_POLICY.depositPercent),
    commissionPercent: toNumber(row.commission_percent, DEFAULT_POLICY.commissionPercent),
    payoutDelayHours: toNumber(row.payout_delay_hours, DEFAULT_POLICY.payoutDelayHours),
  };
}

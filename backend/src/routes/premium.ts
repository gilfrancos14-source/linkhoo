import { Router, Request, Response, NextFunction } from 'express';
import { Transaction, Webhook } from 'fedapay';
import { supabaseAdmin } from '../config/supabase';
import '../config/fedapay';
import { requireClerkAuth } from '../middleware/clerkAuth';
import { premiumInitiateSchema, premiumConfirmSchema } from '../validations/premium';
import { isValidEmail, withFedapayTimeout } from '../config/fedapayHttp';
import { isPremiumActive, isPremiumExpired } from '../utils/premium';
import { isMarketCode } from '../config/markets';
import { mapFedaPayStatus, isNotFoundError, type PremiumTxStatus } from '../smoke/fedapayRiskTests.helpers';

const PREMIUM_AMOUNT = 5000;
const PREMIUM_DURATION_DAYS = 30;
const PREMIUM_CURRENCY = 'XOF';

const TX_TYPES = ['premium', 'verification'] as const;
type TxType = (typeof TX_TYPES)[number];

/**
 * Ramène le type de transaction à une valeur autorisée par le CHECK
 * (premium_transactions.type) ou renvoie null si la valeur est inconnue.
 * 'premium_subscription' est l'ancien libellé utilisé par les transactions
 * créées avant l'ajout de la colonne `type`.
 */
function normalizeTxType(value: unknown): TxType | null {
  if (value === 'premium_subscription') return 'premium';
  if (typeof value === 'string' && (TX_TYPES as readonly string[]).includes(value)) {
    return value as TxType;
  }
  return null;
}

const router = Router();

function getOrigin(req: Request): string {
  const origin = req.headers.origin;
  if (typeof origin === 'string' && origin) return origin;
  return process.env.APP_PUBLIC_URL || 'http://localhost:5173';
}

function getCallbackUrl(req: Request, market: string): string {
  return `${getOrigin(req)}/${market.toLowerCase()}/gerant/premium/success`;
}

async function upsertPremiumTransaction(input: {
  fedapayTransactionId: number | string;
  clerkUserId: string;
  market: string;
  amount: number;
  status: PremiumTxStatus;
  customerEmail?: string | null;
  rawEvent?: unknown;
  type?: 'premium' | 'verification';
}): Promise<{ id: string; status: PremiumTxStatus; activated: boolean }> {
  const txId = Number(input.fedapayTransactionId);
  if (!Number.isFinite(txId) || txId <= 0) {
    throw new Error('fedapay_transaction_id invalide');
  }

  const { data, error } = await supabaseAdmin
    .from('premium_transactions')
    .upsert(
      {
        fedapay_transaction_id: txId,
        clerk_user_id: input.clerkUserId,
        market: input.market,
        amount: input.amount,
        currency: PREMIUM_CURRENCY,
        status: input.status,
        customer_email: input.customerEmail ?? null,
        raw_event: input.rawEvent ?? null,
        type: input.type ?? 'premium',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'fedapay_transaction_id' }
    )
    .select('id, status, activated_at')
    .single();

  if (error) throw error;
  if (!data) throw new Error('Insertion premium_transactions échouée');

  return {
    id: data.id,
    status: data.status as PremiumTxStatus,
    activated: !!data.activated_at,
  };
}

async function hasActivePremiumOnOtherMarket(clerkUserId: string, currentMarket: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('gerants')
    .select('market, is_premium, premium_expires_at')
    .eq('clerk_user_id', clerkUserId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return false;
  if (data.market === currentMarket) return false;
  return isPremiumActive(data);
}

async function activatePremiumForClerkUser(
  premiumTransactionId: string
): Promise<{ alreadyActive: boolean; expiresAt: string | null }> {
  // Une seule requête SQL : réclamer la transaction (activated_at NULL -> now)
  // et prolonger l'abonnement se font dans la MÊME transaction. Le webhook
  // FedaPay et POST /confirm arrivent presque ensemble pour un paiement : le
  // second reçoit already_activated = true et n'allonge rien. En cas d'échec,
  // PostgreSQL annule tout — jamais d'abonnement manquant après paiement.
  const { data, error } = await supabaseAdmin.rpc('activate_premium_checked', {
    p_transaction_id: premiumTransactionId,
    p_days: PREMIUM_DURATION_DAYS,
  });
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error('Activation premium échouée (réponse vide)');

  return {
    alreadyActive: Boolean(row.already_activated),
    expiresAt: row.new_expires_at ?? null,
  };
}

router.post('/initiate', requireClerkAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedBody = premiumInitiateSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({ error: 'Données invalides', details: parsedBody.error.flatten() });
    }

    const authUserId = req.auth?.userId;
    if (!authUserId) {
      return res.status(401).json({ error: 'Non autorisé' });
    }

    const { market } = parsedBody.data;
    const clerk_user_id = authUserId;

    const { data: gerant, error: fetchError } = await supabaseAdmin
      .from('gerants')
      .select('id, email, is_premium, premium_expires_at')
      .eq('clerk_user_id', clerk_user_id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!gerant) return res.status(404).json({ error: 'Gérant introuvable' });

    if (isPremiumActive(gerant)) {
      return res.status(400).json({ error: 'Vous êtes déjà premium', expires_at: gerant.premium_expires_at });
    }

    if (await hasActivePremiumOnOtherMarket(clerk_user_id, market)) {
      return res.status(400).json({
        error: 'Vous avez déjà un abonnement premium actif sur un autre marché. Veuillez l\'annuler avant d\'en prendre un nouveau.',
      });
    }

    const customerEmail = gerant.email && isValidEmail(gerant.email)
      ? gerant.email
      : null;

    if (!customerEmail) {
      return res.status(400).json({
        error: 'Email gérant invalide ou manquant. Mettez à jour votre profil avant de payer.',
      });
    }

    const transaction = await withFedapayTimeout(
      Transaction.create({
        description: `Abonnement Premium ${market} - ${PREMIUM_DURATION_DAYS} jours`,
        amount: PREMIUM_AMOUNT,
        currency: { iso: PREMIUM_CURRENCY },
        callback_url: getCallbackUrl(req, market),
        customer: { email: customerEmail },
        metadata: {
          clerk_user_id,
          market,
          type: 'premium',
        },
      })
    );

    const token = await withFedapayTimeout(transaction.generateToken());
    const paymentUrl = (token as any).url || `https://process.fedapay.com/${(token as any).token}`;

    await upsertPremiumTransaction({
      fedapayTransactionId: transaction.id,
      clerkUserId: clerk_user_id,
      market,
      amount: PREMIUM_AMOUNT,
      status: 'pending',
      customerEmail,
      rawEvent: { source: 'initiate' },
    });

    res.json({
      transaction_id: transaction.id,
      payment_url: paymentUrl,
    });
  } catch (err: any) {
    if (isNotFoundError(err)) {
      return res.status(404).json({ error: 'Ressource FedaPay introuvable' });
    }
    console.error('[premium] initiate error:', err?.message || err);
    next(err);
  }
});

router.post('/confirm', requireClerkAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedBody = premiumConfirmSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({ error: 'Données invalides', details: parsedBody.error.flatten() });
    }

    const authUserId = req.auth?.userId;
    if (!authUserId) {
      return res.status(401).json({ error: 'Non autorisé' });
    }

    const { transaction_id } = parsedBody.data;

    let transaction: any;
    try {
      transaction = await withFedapayTimeout(Transaction.retrieve(transaction_id));
    } catch (err) {
      if (isNotFoundError(err)) {
        return res.status(404).json({ error: 'Transaction introuvable' });
      }
      throw err;
    }

    const meta: any = (transaction as any).metadata || {};
    const clerkUserIdFromMeta = meta.clerk_user_id as string | undefined;
    const marketFromMeta = meta.market as string | undefined;
    // Pas de valeur par défaut : si FedaPay ne renvoie pas de montant,
    // amountFromTx vaut NaN et le contrôle ci-dessous refusera la requête.
    const amountFromTx = Number((transaction as any).amount);
    const customerEmail = (transaction as any).customer?.email ?? null;
    const rawStatus = (transaction as any).status;
    const status = mapFedaPayStatus(rawStatus);
    const rawType = (meta.type as string | undefined) ?? undefined;
    const metaType = rawType === undefined ? 'premium' : normalizeTxType(rawType);

    if (!clerkUserIdFromMeta || !marketFromMeta) {
      return res.status(400).json({ error: 'Métadonnées de transaction invalides' });
    }
    if (clerkUserIdFromMeta !== authUserId) {
      return res.status(403).json({ error: 'Cette transaction ne vous appartient pas' });
    }
    if (metaType !== 'premium') {
      return res.status(400).json({ error: 'Transaction non éligible à l\'abonnement premium' });
    }
    if (!Number.isFinite(amountFromTx) || amountFromTx < PREMIUM_AMOUNT) {
      return res.status(400).json({ error: 'Montant de transaction insuffisant' });
    }

    const persisted = await upsertPremiumTransaction({
      fedapayTransactionId: transaction.id,
      clerkUserId: clerkUserIdFromMeta,
      market: marketFromMeta,
      amount: amountFromTx,
      status,
      customerEmail,
      rawEvent: { source: 'confirm', transaction_status: rawStatus },
      type: 'premium',
    });

    if (status !== 'approved') {
      return res.status(400).json({
        error: status === 'pending'
          ? 'Paiement en attente de confirmation'
          : `Paiement ${status}`,
        status,
        transaction_status: rawStatus,
      });
    }

    // Pas de condition ici : c'est la fonction SQL qui décide. Si le webhook
    // FedaPay a déjà consommé la transaction (ou si on rappelle deux fois),
    // already_active = true et l'abonnement n'est pas prolongé une 2e fois.
    const activation = await activatePremiumForClerkUser(persisted.id);

    const { data: gerant } = await supabaseAdmin
      .from('gerants')
      .select('*')
      .eq('clerk_user_id', clerkUserIdFromMeta)
      .single();

    res.json({
      success: true,
      already_active: activation.alreadyActive,
      premium_expires_at: activation.expiresAt ?? gerant?.premium_expires_at ?? null,
      gerant,
    });
  } catch (err: any) {
    if (isNotFoundError(err)) {
      return res.status(404).json({ error: 'Transaction introuvable' });
    }
    console.error('[premium] confirm error:', err?.message || err);
    next(err);
  }
});

router.post('/webhook', async (req: Request, res: Response, _next: NextFunction) => {
  const signature =
    (req.headers['x-fedapay-signature'] as string) ||
    (req.headers['X-FedaPay-Signature'] as string) ||
    '';
  const webhookSecret = process.env.FEDAPAY_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.warn('[premium] webhook reçu mais FEDAPAY_WEBHOOK_SECRET non configuré');
    return res.status(500).send('Webhook non configuré');
  }

  const rawBody =
    typeof req.rawBody === 'string' && req.rawBody.length > 0
      ? req.rawBody
      : JSON.stringify(req.body);

  let event: any;
  try {
    event = Webhook.constructEvent(rawBody, signature, webhookSecret);
  } catch (err: any) {
    console.warn('[premium] webhook signature invalide:', err?.message || err);
    return res.status(400).send(`Webhook signature invalide: ${err?.message || 'erreur'}`);
  }

  try {
    const eventName = event?.name || event?.type;
    const entity = event?.entity;

    if (eventName === 'transaction.approved' && entity?.id) {
      const meta: any = entity.metadata && typeof entity.metadata === 'object' ? entity.metadata : {};
      const clerkUserId = typeof meta.clerk_user_id === 'string' ? meta.clerk_user_id : undefined;
      // market n'a plus de valeur par défaut : un marché manquant ne doit pas
      // être rattaché artificiellement à CI.
      const market = isMarketCode(meta.market) ? meta.market : undefined;
      const txType =
        meta.type === undefined || meta.type === null || meta.type === ''
          ? 'premium'
          : normalizeTxType(meta.type);
      const amount = Number(entity.amount);

      if (!clerkUserId || !market || !txType) {
        console.warn('[premium] webhook transaction.approved métadonnées invalides:', JSON.stringify({ clerkUserId, market, type: meta.type }));
        return res.json({ received: true, ignored: 'invalid_metadata' });
      }
      if (!Number.isFinite(amount)) {
        console.warn(`[premium] webhook transaction.approved sans montant numérique (tx ${entity.id})`);
        return res.json({ received: true, ignored: 'invalid_amount' });
      }

      const status = mapFedaPayStatus(entity.status);
      const customerEmail = entity.customer?.email ?? null;

      const persisted = await upsertPremiumTransaction({
        fedapayTransactionId: entity.id,
        clerkUserId,
        market,
        amount,
        status,
        customerEmail,
        rawEvent: event,
        type: txType,
      });

      // `!persisted.activated` n'est qu'un raccourci (évite un appel RPC) :
      // c'est la fonction SQL qui tranche de façon atomique si /confirm
      // arrive en même temps que ce webhook.
      if (status === 'approved' && !persisted.activated && txType === 'premium') {
        if (amount >= PREMIUM_AMOUNT) {
          const activation = await activatePremiumForClerkUser(persisted.id);
          console.log(
            activation.alreadyActive
              ? `[premium] webhook: tx ${entity.id} déjà consommée, aucune prolongation`
              : `[premium] webhook: premium activé pour ${clerkUserId} (tx ${entity.id})`
          );
        } else {
          console.warn(`[premium] webhook: activation refusée, montant insuffisant (${amount}) pour tx ${entity.id}`);
        }
      } else {
        console.log(`[premium] webhook: tx ${entity.id} status=${status} type=${txType} (déjà activée=${persisted.activated})`);
      }
    } else if (eventName === 'transaction.declined' || eventName === 'transaction.canceled') {
      if (entity?.id) {
        const meta: any = entity.metadata && typeof entity.metadata === 'object' ? entity.metadata : {};
        const clerkUserId = typeof meta.clerk_user_id === 'string' ? meta.clerk_user_id : undefined;
        const market = isMarketCode(meta.market) ? meta.market : undefined;
        const txType =
          meta.type === undefined || meta.type === null || meta.type === ''
            ? 'premium'
            : normalizeTxType(meta.type);
        const amount = Number(entity.amount);
        if (clerkUserId && market && txType) {
          const newStatus: PremiumTxStatus =
            eventName === 'transaction.declined' ? 'declined' : 'canceled';
          await upsertPremiumTransaction({
            fedapayTransactionId: entity.id,
            clerkUserId,
            market,
            // Ici l'important est d'enregistrer le statut ; un montant absent
            // est stocké en 0 plutôt que remplacé par le prix d'un premium.
            amount: Number.isFinite(amount) ? amount : 0,
            status: newStatus,
            customerEmail: entity.customer?.email ?? null,
            rawEvent: event,
            type: txType,
          });
        }
      }
      console.log(`[premium] webhook ${eventName} reçu (id=${entity?.id})`);
    } else {
      console.log(`[premium] webhook event ignoré: ${eventName}`);
    }

    return res.json({ received: true });
  } catch (err: any) {
    console.error('[premium] webhook handler error:', err?.message || err);
    return res.status(500).json({ error: 'Erreur traitement webhook' });
  }
});

router.get('/status', requireClerkAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUserId = req.auth?.userId;
    if (!authUserId) {
      return res.status(401).json({ error: 'Non autorisé' });
    }

    const { data, error } = await supabaseAdmin
      .from('gerants')
      .select('is_premium, premium_expires_at')
      .eq('clerk_user_id', authUserId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Gérant introuvable' });

    const now = new Date();
    const isExpired = isPremiumExpired(data, now);

    if (isExpired) {
      await supabaseAdmin
        .from('gerants')
        .update({ is_premium: false, updated_at: now.toISOString() })
        .eq('clerk_user_id', authUserId);
    }

    const isActive = isPremiumActive(data, now);

    const { data: pendingTx } = await supabaseAdmin
      .from('premium_transactions')
      .select('id, created_at')
      .eq('clerk_user_id', authUserId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const hasPendingPayment = !!pendingTx;
    const pendingSince = pendingTx?.created_at ?? null;

    res.json({
      is_premium: !!isActive,
      premium_expires_at: data.premium_expires_at,
      has_pending_payment: hasPendingPayment,
      pending_since: pendingSince,
    });
  } catch (err) {
    next(err);
  }
});

export default router;

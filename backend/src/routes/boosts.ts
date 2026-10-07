// Routes de la fonctionnalité Boost : sponsorisation de chambres sur la
// landing (6 emplacements « Sponsorisé »).
//
// Chemins de paiement : rails FedaPay réutilisés à l'identique du premium
// (meta.type = 'boost', ledger premium_transactions), webhook unique
// /api/premium/webhook qui crédite la campagne en priorité, page de retour
// + rattrapage à la visite du gérant en secours. Les montants sont
// TOUJOURS calculés ici (config/boosts.ts), jamais reçus du client.
//
// Facturation réelle : RPC charge_boost (migration 0013) — verrou ligne,
// fenêtre de dates, dédup visiteur et épuisement atomiques en SQL.

import { Router, Request, Response, NextFunction } from 'express';
import { Transaction } from 'fedapay';
import { supabaseAdmin } from '../config/supabase';
import '../config/fedapay';
import { requireClerkAuth } from '../middleware/clerkAuth';
import {
  boostInitiateSchema,
  boostConfirmSchema,
  boostTrackSchema,
  boostScheduleSchema,
} from '../validations/boost';
import { idParamsSchema } from '../validations/common';
import { isValidEmail, withFedapayTimeout } from '../config/fedapayHttp';
import { isMarketCode } from '../config/markets';
import {
  normalizeTxType,
  upsertPremiumTransaction,
  activateBoostForTransaction,
} from '../utils/premiumTx';
import {
  BOOST_ROOM_EMBED,
  mapBoostRow,
} from '../utils/boostDisplay';
import {
  ensureTrackVisitor,
  issueTrackCookieIfMissing,
} from '../utils/trackVisitor';
import { flagPaidWithoutCampaign } from '../utils/boostAlerts';
import {
  mapFedaPayStatus,
  isNotFoundError,
} from '../smoke/fedapayRiskTests.helpers';
import {
  BOOST_BUDGETS,
  BOOST_CURRENCY,
  BOOST_MAX_DURATION_DAYS,
  BOOST_PRICE_CPI,
  BOOST_PRICE_CPC,
  BOOST_PENDING_SUPERSEDE_MS,
  boostChargeAmount,
} from '../config/boosts';

const router = Router();

function getCallbackUrl(market: string): string {
  // m3 : uniquement APP_PUBLIC_URL (allow-list serveur). L'entête Origin est
  // forgeable — un payeur redirigé « après paiement » vers un domaine tiers,
  // c'est du phishing post-paiement.
  const base = (process.env.APP_PUBLIC_URL || 'http://localhost:5173').replace(/\/+$/, '');
  return `${base}/${market.toLowerCase()}/gerant/boosts/success`;
}

/** Paiement refusé/annulé : la campagne ne doit jamais passer active. */
async function cancelBoostForTransaction(premiumTxId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('boosts')
    .update({ status: 'canceled', updated_at: new Date().toISOString() })
    .eq('transaction_id', premiumTxId)
    .eq('status', 'pending');
  if (error) throw error;
}

async function fetchBoostRow(boostId: string) {
  const { data, error } = await supabaseAdmin
    .from('boosts')
    .select(`*, ${BOOST_ROOM_EMBED}`)
    .eq('id', boostId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Rattrapage des paiements : si le webhook a été perdu (FedaPay en retry ×9,
 * onglet fermé avant callback…), la visite du gérant repasse par l'API
 * FedaPay directement et crédite la campagne. Best effort : une erreur
 * FedaPay ne doit jamais rendre la liste illisible.
 *
 * M3 : borné à 3 tentatives de moins de 24 h, 2 s max par appel FedaPay, et
 * appelé EN ARRIÈRE-PLAN — il ne doit jamais retarder GET /boosts/mine.
 * m8 : les plus anciennes d'abord, et les tentatives > 24 h passent en
 * canceled (elles resteraient « Paiement en attente » indéfiniment).
 */
const RECONCILE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const RECONCILE_LIMIT = 3;
const RECONCILE_FEDAPAY_TIMEOUT_MS = 2000;

async function reconcilePendingBoosts(clerkUserId: string): Promise<void> {
  const now = Date.now();
  const cutoffIso = new Date(now - RECONCILE_MAX_AGE_MS).toISOString();

  const { error: purgeError } = await supabaseAdmin
    .from('boosts')
    .update({ status: 'canceled', updated_at: new Date(now).toISOString() })
    .eq('gerant_id', clerkUserId)
    .eq('status', 'pending')
    .lt('created_at', cutoffIso);
  if (purgeError) {
    console.warn('[boosts] purge des tentatives anciennes impossible :', purgeError.message);
  }

  const { data, error } = await supabaseAdmin
    .from('boosts')
    .select(
      `id, market, transaction_id, transaction:premium_transactions(id, fedapay_transaction_id, status)`
    )
    .eq('gerant_id', clerkUserId)
    .eq('status', 'pending')
    .gte('created_at', cutoffIso)
    .order('created_at', { ascending: true })
    .limit(RECONCILE_LIMIT);
  if (error || !Array.isArray(data)) return;

  for (const row of data) {
    // Le client Supabase type l'embed en tableau alors que beaucoup-à-un
    // renvoie un objet : on accepte les deux formes.
    const tx = Array.isArray(row.transaction) ? row.transaction[0] : row.transaction;
    const fedapayId = tx?.fedapay_transaction_id;
    if (!row.transaction_id || !fedapayId) continue;
    try {
      const remote = (await withFedapayTimeout(
        Transaction.retrieve(fedapayId),
        RECONCILE_FEDAPAY_TIMEOUT_MS,
      )) as {
        status?: unknown;
        amount?: unknown;
        customer?: { email?: string } | null;
      };
      const status = mapFedaPayStatus(remote.status);
      const txAmount = Number.isFinite(Number(remote.amount)) ? Number(remote.amount) : 0;
      const persisted = await upsertPremiumTransaction({
        fedapayTransactionId: fedapayId,
        clerkUserId,
        market: row.market,
        amount: txAmount,
        status,
        customerEmail: remote.customer?.email ?? null,
        rawEvent: { source: 'reconcile', transaction_status: remote.status },
        type: 'boost',
      });
      if (status === 'approved') {
        // m6 : même défense en profondeur que le webhook et /confirm. Un
        // montant hors grille n'active rien — et comme l'argent est déjà
        // encaissé, on alerte le support au lieu d'un simple warn.
        if (!BOOST_BUDGETS.some((budget) => budget === txAmount)) {
          console.warn(
            '[boosts] rattrapage : montant hors grille (' + txAmount + ') pour tx ' + fedapayId + ' — activation refusée',
          );
          await flagPaidWithoutCampaign({
            clerkUserId,
            market: row.market,
            transactionId: fedapayId,
            amount: txAmount,
            source: 'reconcile-amount',
          });
          continue;
        }
        const activation = await activateBoostForTransaction(persisted.id);
        if (!activation.boostId) {
          // M4 : encaissé mais plus de campagne à créditer → alerte support.
          await flagPaidWithoutCampaign({
            clerkUserId,
            market: row.market,
            transactionId: fedapayId,
            amount: txAmount,
            source: 'reconcile',
          });
        }
      } else if (status === 'declined' || status === 'canceled') {
        await cancelBoostForTransaction(persisted.id);
      }
    } catch (err) {
      console.warn('[boosts] rattrapage impossible pour', row.id, (err as Error)?.message || err);
    }
  }
}

/** Un seul rattrapage par gérant à la fois (M3 : lancé en arrière-plan). */
const reconcileInFlight = new Set<string>();

function reconcileInBackground(clerkUserId: string): void {
  if (reconcileInFlight.has(clerkUserId)) return;
  reconcileInFlight.add(clerkUserId);
  void reconcilePendingBoosts(clerkUserId)
    .catch((err: unknown) => {
      console.warn('[boosts] rattrapage en arrière-plan :', (err as Error)?.message || err);
    })
    .finally(() => {
      reconcileInFlight.delete(clerkUserId);
    });
}

// ── Configuration publique (affichée sur l'écran de création et la landing) ──

router.get('/config', (_req: Request, res: Response) => {
  res.json({
    currency: BOOST_CURRENCY,
    price_cpc: BOOST_PRICE_CPC,
    price_cpi: BOOST_PRICE_CPI,
    budgets: [...BOOST_BUDGETS],
    max_duration_days: BOOST_MAX_DURATION_DAYS,
  });
});

// ── Emplacements sponsorisés de la landing (public, cache 300 s) ──

router.get('/featured', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // C1 : pose l'identité visiteur (cookie signé) avant les événements de
    // tracking — sans elle, impression/click répondraient visitor_issued.
    issueTrackCookieIfMissing(req, res);
    const nowIso = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from('boosts')
      .select(`id, market, mode, room_id, ${BOOST_ROOM_EMBED}`)
      .eq('status', 'active')
      .lte('starts_at', nowIso)
      .gte('ends_at', nowIso)
      .order('created_at', { ascending: false })
      .limit(30);
    if (error) throw error;

    // Array.isArray obligatoire : une réponse anormale (ou le fallback e2e
    // qui renvoie {}) ne doit jamais planter la landing.
    const rows: any[] = Array.isArray(data) ? data : [];

    // Rotation aléatoire (Fisher–Yates) : chaque visiteur voit une
    // sélection différente parmi les campagnes en ligne.
    const shuffled = [...rows];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const items = shuffled
      .filter((row) => row.room && row.room.disponible !== false)
      .slice(0, 6)
      .map((row) => ({
        id: row.id,
        room_id: row.room_id,
        market: row.market,
        mode: row.mode,
        title: row.room.title,
        price: row.room.price ?? null,
        price_num: row.room.price_num ?? null,
        img: row.room.img ?? null,
        ville: row.room.ville ?? null,
        quartier: row.room.quartier ?? null,
        category: row.room.category ?? null,
      }));

    res.json({
      items,
      config: {
        currency: BOOST_CURRENCY,
        price_cpc: BOOST_PRICE_CPC,
        price_cpi: BOOST_PRICE_CPI,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── Tracking (public) : impression / clic ──

async function handleCharge(
  req: Request,
  res: Response,
  next: NextFunction,
  kind: 'impression' | 'click'
): Promise<void> {
  try {
    const parsedBody = boostTrackSchema.safeParse(req.body);
    if (!parsedBody.success) {
      res.status(400).json({ error: 'Données invalides', details: parsedBody.error.flatten() });
      return;
    }
    const { boost_id } = parsedBody.data;

    // C1 : l'identité de dédup vient du cookie signé, JAMAIS du corps — un
    // `visitor_id` fourni par le client se vidait d'un budget en 100 requêtes.
    const { visitorId, issued } = ensureTrackVisitor(req, res);
    if (issued) {
      // Cookie absent/forgé : on le pose et on laisse le client relancer une
      // fois. Aucune lecture base, aucun verrou, aucun débit.
      res.status(200).json({
        counted: false,
        billed: false,
        exhausted: false,
        remaining: null,
        visitor_issued: true,
      });
      return;
    }

    const { data: boost, error } = await supabaseAdmin
      .from('boosts')
      .select('id, mode, status')
      .eq('id', boost_id)
      .maybeSingle();
    if (error) throw error;
    if (!boost) {
      res.status(404).json({ error: 'Campagne introuvable' });
      return;
    }

    // Le montant vient du mode de campagne (serveur) — jamais du client.
    const amount = boostChargeAmount(boost.mode, kind);
    const { data, error: chargeError } = await supabaseAdmin.rpc('charge_boost', {
      p_boost_id: boost_id,
      p_kind: kind,
      p_visitor_id: visitorId,
      p_amount: amount,
    });
    if (chargeError) throw chargeError;

    const row = Array.isArray(data) ? data[0] : data;
    res.json(
      row
        ? {
            counted: Boolean(row.counted),
            billed: Boolean(row.billed),
            exhausted: Boolean(row.exhausted),
            remaining: row.remaining ?? null,
            visitor_issued: false,
          }
        : {
            counted: false,
            billed: false,
            exhausted: false,
            remaining: null,
            visitor_issued: false,
          }
    );
  } catch (err) {
    next(err);
  }
}

router.post('/impression', (req: Request, res: Response, next: NextFunction) => {
  void handleCharge(req, res, next, 'impression');
});

router.post('/click', (req: Request, res: Response, next: NextFunction) => {
  void handleCharge(req, res, next, 'click');
});

// ── Création d'une campagne (paiement FedaPay) ──

router.post('/initiate', requireClerkAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedBody = boostInitiateSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({ error: 'Données invalides', details: parsedBody.error.flatten() });
    }

    const authUserId = req.auth?.userId;
    if (!authUserId) {
      return res.status(401).json({ error: 'Non autorisé' });
    }

    const { room_id, mode, budget_total, starts_at, ends_at } = parsedBody.data;

    const { data: gerant, error: fetchGerantError } = await supabaseAdmin
      .from('gerants')
      .select('id, email, market, is_verified')
      .eq('clerk_user_id', authUserId)
      .maybeSingle();
    if (fetchGerantError) throw fetchGerantError;
    if (!gerant) return res.status(404).json({ error: 'Gérant introuvable' });
    if (!gerant.is_verified) {
      return res.status(403).json({
        error: 'Compte gérant non vérifié : la vérification est requise pour booster une chambre.',
      });
    }

    const { data: room, error: fetchRoomError } = await supabaseAdmin
      .from('rooms')
      .select('id, title, market, gerant_id, disponible')
      .eq('id', room_id)
      .maybeSingle();
    if (fetchRoomError) throw fetchRoomError;
    if (!room) return res.status(404).json({ error: 'Chambre introuvable' });
    if (room.gerant_id !== authUserId) {
      return res.status(403).json({ error: 'Cette chambre ne vous appartient pas' });
    }
    if (room.disponible === false) {
      return res.status(400).json({ error: 'Cette chambre n\'est plus disponible' });
    }

    // M1 : expiration paresseuse de CETTE chambre. Sans cette transition, une
    // campagne dont la fenêtre est passée reste `active` et bloque toute nouvelle
    // création à jamais (l'unique partielle n'est libérée que par `ended`).
    const nowIso = new Date().toISOString();
    const { error: expireError } = await supabaseAdmin
      .from('boosts')
      .update({ status: 'ended', updated_at: nowIso })
      .eq('room_id', room_id)
      .eq('status', 'active')
      .lte('ends_at', nowIso);
    if (expireError) throw expireError;

    // Index partiel UNIQUE (une seule campagne pending/active par chambre) :
    // refuse une nouvelle tentative trop proche de la précédente, remplace
    // celles abandonnées (> BOOST_PENDING_SUPERSEDE_MS) pour ne jamais
    // bloquer le gérant derrière un paiement mort.
    const { data: liveRows, error: liveError } = await supabaseAdmin
      .from('boosts')
      .select('id, status, created_at')
      .eq('room_id', room_id)
      .in('status', ['pending', 'active']);
    if (liveError) throw liveError;
    const live: any[] = Array.isArray(liveRows) ? liveRows : [];
    if (live.some((row) => row.status === 'active')) {
      return res.status(400).json({ error: 'Une campagne est déjà en cours pour cette chambre.' });
    }
    const now = Date.now();
    const recentPending = live.some(
      (row) => row.status === 'pending' && now - new Date(row.created_at).getTime() < BOOST_PENDING_SUPERSEDE_MS
    );
    if (recentPending) {
      return res.status(409).json({
        error: 'Une tentative de paiement est déjà en cours pour cette chambre. Réessayez dans quelques minutes.',
      });
    }
    for (const row of live) {
      if (row.status !== 'pending') continue;
      const { error: cancelError } = await supabaseAdmin
        .from('boosts')
        .update({ status: 'canceled', updated_at: new Date().toISOString() })
        .eq('id', row.id)
        .eq('status', 'pending');
      if (cancelError) throw cancelError;
    }

    const customerEmail = gerant.email && isValidEmail(gerant.email) ? gerant.email : null;
    if (!customerEmail) {
      return res.status(400).json({
        error: 'Email gérant invalide ou manquant. Mettez à jour votre profil avant de payer.',
      });
    }

    const transaction = await withFedapayTimeout(
      Transaction.create({
        description: `Boost ${mode.toUpperCase()} - ${room.title}`,
        amount: budget_total,
        currency: { iso: BOOST_CURRENCY },
        callback_url: getCallbackUrl(room.market),
        customer: { email: customerEmail },
        metadata: {
          clerk_user_id: authUserId,
          market: room.market,
          type: 'boost',
          room_id,
          mode,
          budget_total,
          starts_at: starts_at.toISOString(),
          ends_at: ends_at.toISOString(),
        },
      })
    );

    const token = await withFedapayTimeout(transaction.generateToken());
    const paymentUrl =
      (token as any).url || `https://process.fedapay.com/${(token as any).token}`;

    const persisted = await upsertPremiumTransaction({
      fedapayTransactionId: transaction.id,
      clerkUserId: authUserId,
      market: room.market,
      amount: budget_total,
      status: 'pending',
      customerEmail,
      rawEvent: { source: 'initiate' },
      type: 'boost',
    });

    const { data: boost, error: insertError } = await supabaseAdmin
      .from('boosts')
      .insert({
        market: room.market,
        room_id,
        gerant_id: authUserId,
        mode,
        budget_total,
        starts_at: starts_at.toISOString(),
        ends_at: ends_at.toISOString(),
        transaction_id: persisted.id,
        status: 'pending',
      })
      .select('id')
      .single();
    if (insertError) {
      // 23505 = deux initiations concurrentes pour la même chambre : le
      // verrou du prix FedaPay vient d'être créé, on ne double pas.
      if (insertError.code === '23505') {
        return res.status(409).json({ error: 'Une campagne est déjà en cours pour cette chambre.' });
      }
      throw insertError;
    }

    res.json({
      transaction_id: transaction.id,
      payment_url: paymentUrl,
      boost_id: boost.id,
    });
  } catch (err: any) {
    if (isNotFoundError(err)) {
      return res.status(404).json({ error: 'Ressource FedaPay introuvable' });
    }
    console.error('[boosts] initiate error:', err?.message || err);
    next(err);
  }
});

// ── Retour du gérant après paiement (secours du webhook) ──

router.post('/confirm', requireClerkAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedBody = boostConfirmSchema.safeParse(req.body);
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
    const marketFromMeta = isMarketCode(meta.market) ? meta.market : undefined;
    const rawType = meta.type as string | undefined;
    const metaType = rawType === undefined ? null : normalizeTxType(rawType);
    const amountFromTx = Number((transaction as any).amount);
    const rawStatus = (transaction as any).status;
    const status = mapFedaPayStatus(rawStatus);

    if (!clerkUserIdFromMeta || !marketFromMeta) {
      return res.status(400).json({ error: 'Métadonnées de transaction invalides' });
    }
    if (clerkUserIdFromMeta !== authUserId) {
      return res.status(403).json({ error: 'Cette transaction ne vous appartient pas' });
    }
    if (metaType !== 'boost') {
      return res.status(400).json({ error: 'Transaction non éligible à un boost' });
    }
    if (!Number.isFinite(amountFromTx) || !BOOST_BUDGETS.some((b) => b === amountFromTx)) {
      // m6 + M4 : la transaction est approuvée mais le montant n'est dans
      // aucune grille → rien n'est crédité. L'argent étant encaissé, on alerte
      // le support (idempotent : même id que webhook et rattrapage). Un
      // montant faux sur un paiement non approuvé n'est pas un incident.
      if (status === 'approved') {
        await flagPaidWithoutCampaign({
          clerkUserId: clerkUserIdFromMeta,
          market: marketFromMeta,
          transactionId: transaction.id,
          amount: Number.isFinite(amountFromTx) ? amountFromTx : 0,
          source: 'confirm-amount',
        });
      }
      return res.status(400).json({ error: 'Montant de transaction invalide' });
    }

    const persisted = await upsertPremiumTransaction({
      fedapayTransactionId: transaction.id,
      clerkUserId: clerkUserIdFromMeta,
      market: marketFromMeta,
      amount: amountFromTx,
      status,
      customerEmail: (transaction as any).customer?.email ?? null,
      rawEvent: { source: 'confirm', transaction_status: rawStatus },
      type: 'boost',
    });

    if (status !== 'approved') {
      if (status === 'declined' || status === 'canceled') {
        await cancelBoostForTransaction(persisted.id);
      }
      return res.status(400).json({
        error:
          status === 'pending'
            ? 'Paiement en attente de confirmation'
            : `Paiement ${status}`,
        status,
        transaction_status: rawStatus,
      });
    }

    // Idem premium : la RPC tranche (webhook probablement déjà passé).
    const activation = await activateBoostForTransaction(persisted.id);
    if (!activation.boostId) {
      // M4 : la transaction est approved mais la campagne a disparu →
      // l'argent est encaissé, rien n'est crédité : on alerte le support.
      await flagPaidWithoutCampaign({
        clerkUserId: clerkUserIdFromMeta,
        market: marketFromMeta,
        transactionId: transaction.id,
        amount: amountFromTx,
        source: 'confirm',
      });
      return res.status(409).json({
        error: 'Cette tentative de paiement n\'est plus valable (campagne remplacée ou annulée).',
        status: 'paid_without_campaign',
      });
    }

    const boostRow = await fetchBoostRow(activation.boostId);
    if (!boostRow) return res.status(404).json({ error: 'Campagne introuvable' });

    res.json({
      success: true,
      already_activated: activation.alreadyActivated,
      boost: mapBoostRow(boostRow),
    });
  } catch (err: any) {
    if (isNotFoundError(err)) {
      return res.status(404).json({ error: 'Transaction introuvable' });
    }
    console.error('[boosts] confirm error:', err?.message || err);
    next(err);
  }
});

// ── Mes campagnes (avec rattrapage des paiements) ──

router.get('/mine', requireClerkAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUserId = req.auth?.userId;
    if (!authUserId) {
      return res.status(401).json({ error: 'Non autorisé' });
    }

    // M3 : en arrière-plan — 3 appels FedaPay de 15 s ne doivent jamais
    // faire échouer le chargement de la liste (timeout front = 15 s).
    reconcileInBackground(authUserId);

    const { data, error } = await supabaseAdmin
      .from('boosts')
      .select(`*, ${BOOST_ROOM_EMBED}`)
      .eq('gerant_id', authUserId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;

    const rows: any[] = Array.isArray(data) ? data : [];
    res.json({ items: rows.map((row) => mapBoostRow(row)) });
  } catch (err) {
    next(err);
  }
});

// ── Reprogrammer le solde restant (sans repayer) ──

router.patch('/:id/schedule', requireClerkAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedParams = idParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return res.status(400).json({ error: 'Identifiant invalide' });
    }
    const parsedBody = boostScheduleSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({ error: 'Données invalides', details: parsedBody.error.flatten() });
    }

    const authUserId = req.auth?.userId;
    if (!authUserId) {
      return res.status(401).json({ error: 'Non autorisé' });
    }

    const { data: boost, error } = await supabaseAdmin
      .from('boosts')
      .select('id, status, spent, budget_total, gerant_id')
      .eq('id', parsedParams.data.id)
      .maybeSingle();
    if (error) throw error;
    if (!boost) return res.status(404).json({ error: 'Campagne introuvable' });
    if (boost.gerant_id !== authUserId) {
      return res.status(403).json({ error: 'Cette campagne ne vous appartient pas' });
    }
    if (boost.status === 'pending') {
      return res.status(409).json({ error: 'Paiement en attente : la campagne n\'est pas encore active.' });
    }
    if (boost.status === 'canceled') {
      return res.status(409).json({ error: 'Campagne annulée.' });
    }
    if (boost.status === 'exhausted' || boost.spent >= boost.budget_total) {
      return res.status(409).json({ error: 'Budget épuisé : créez une nouvelle campagne.' });
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('boosts')
      .update({
        starts_at: parsedBody.data.starts_at.toISOString(),
        ends_at: parsedBody.data.ends_at.toISOString(),
        // M1 : une campagne `ended` repassée en ligne doit redevenir `active`,
        // sinon elle ne se facturerait jamais (charge_boost exige active).
        ...(boost.status === 'ended' ? { status: 'active' } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', boost.id)
      .select(`*, ${BOOST_ROOM_EMBED}`)
      .single();
    if (updateError) {
      // 23505 : une autre campagne pending/active occupe déjà la chambre
      // (index partiel) — la reprogrammation reste impossible sans 500.
      if (updateError.code === '23505') {
        return res
          .status(409)
          .json({ error: 'Une autre campagne est déjà en cours pour cette chambre.' });
      }
      throw updateError;
    }

    res.json({ boost: mapBoostRow(updated) });
  } catch (err) {
    next(err);
  }
});

export default router;

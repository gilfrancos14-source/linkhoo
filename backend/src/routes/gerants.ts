import { Router, Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { Transaction } from 'fedapay';
import { supabaseAdmin } from '../config/supabase';
import '../config/fedapay';
import { gerantCreateSchema, gerantUpdateSchema, verificationDocumentTypeSchema, propertyAddressSchema } from '../validations/gerant';
import { idParamsSchema } from '../validations/common';
import { withFedapayTimeout } from '../config/fedapayHttp';
import { mapFedaPayStatus, isNotFoundError } from '../smoke/fedapayRiskTests.helpers';
import { parseGoogleMapsUrl } from '../utils/googleMaps';
import { requireProfile } from '../middleware/requireProfile';

const VERIFICATION_AMOUNT = 2000;
const VERIFICATION_CURRENCY = 'XOF';

function getOrigin(req: Request): string {
  const origin = req.headers.origin;
  if (typeof origin === 'string' && origin) return origin;
  return process.env.APP_PUBLIC_URL || 'http://localhost:5173';
}

const router = Router();

router.get('/me', requireProfile('gerant'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUserId = req.auth?.userId;
    if (!authUserId) {
      return res.status(401).json({ error: 'Non autorisé' });
    }

    const { data, error } = await supabaseAdmin
      .from('gerants')
      .select('*')
      .eq('clerk_user_id', authUserId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Profil gérant introuvable' });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.patch('/me', requireProfile('gerant'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUserId = req.auth?.userId;
    if (!authUserId) {
      return res.status(401).json({ error: 'Non autorisé' });
    }

    const parsed = gerantUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Données invalides', details: parsed.error.flatten() });
    }

    if (Object.keys(parsed.data).length === 0) {
      return res.status(400).json({ error: 'Aucune donnée à modifier' });
    }

    const { data: existing } = await supabaseAdmin
      .from('gerants')
      .select('id')
      .eq('clerk_user_id', authUserId)
      .maybeSingle();
    if (!existing) return res.status(404).json({ error: 'Profil gérant introuvable' });

    const { data, error } = await supabaseAdmin
      .from('gerants')
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq('clerk_user_id', authUserId)
      .select()
      .maybeSingle();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedBody = gerantCreateSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({ error: 'Données invalides', details: parsedBody.error.flatten() });
    }

    const authUserId = req.auth?.userId;
    if (!authUserId) {
      return res.status(401).json({ error: 'Non autorisé' });
    }
    if (parsedBody.data.clerk_user_id !== authUserId) {
      return res.status(403).json({ error: 'Vous ne pouvez créer que votre propre profil' });
    }

    const { data: existingClient } = await supabaseAdmin
      .from('clients')
      .select('id')
      .eq('clerk_user_id', authUserId)
      .maybeSingle();
    if (existingClient) {
      return res.status(409).json({ error: 'Compte déjà enregistré comme client', role: 'client' });
    }

    const { data: existing } = await supabaseAdmin
      .from('gerants')
      .select('id')
      .eq('clerk_user_id', parsedBody.data.clerk_user_id)
      .maybeSingle();
    if (existing) {
      return res.status(409).json({ error: 'Profil gérant déjà existant', role: 'gerant' });
    }

    const { data, error } = await supabaseAdmin
      .from('gerants')
      .insert(parsedBody.data)
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

// ── Vérification : Documents ──

router.post('/:id/documents', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedParams = idParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return res.status(400).json({ error: 'Identifiant invalide' });
    }

    const authUserId = req.auth?.userId;
    if (!authUserId) {
      return res.status(401).json({ error: 'Non autorisé' });
    }

    const { data: gerant, error: fetchError } = await supabaseAdmin
      .from('gerants')
      .select('clerk_user_id, verification_status')
      .eq('id', parsedParams.data.id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!gerant) return res.status(404).json({ error: 'Gérant introuvable' });
    if (gerant.clerk_user_id !== authUserId) {
      return res.status(403).json({ error: 'Non autorisé' });
    }
    if (gerant.verification_status === 'pending' || gerant.verification_status === 'under_review') {
      return res.status(400).json({ error: 'Impossible d\'ajouter un document pendant la révision' });
    }

    const { document_type, file_url, file_path, original_filename, mime_type, file_size } = req.body;
    if (!document_type || !file_url || !file_path) {
      return res.status(400).json({ error: 'document_type, file_url et file_path sont requis' });
    }
    const parsedDocType = verificationDocumentTypeSchema.safeParse(document_type);
    if (!parsedDocType.success) {
      return res.status(400).json({ error: 'document_type doit être id_card_front, id_card_back, national_id ou selfie' });
    }

    const { data: existingDoc, error: existingError } = await supabaseAdmin
      .from('verification_documents')
      .select('id')
      .eq('gerant_id', parsedParams.data.id)
      .eq('document_type', document_type)
      .maybeSingle();
    if (existingError) throw existingError;

    if (existingDoc) {
      // On ne touche JAMAIS à storage avec un chemin fourni par le client :
      // cela permettrait de supprimer le document d'un autre gérant.
      // Le nettoyage du fichier fraîchement envoyé reste géré côté client
      // (ou par le DELETE /:id/documents qui, lui, lit file_path en base).
      return res.status(409).json({ error: 'Un document de ce type existe déjà. Supprimez-le avant d\'en ajouter un nouveau.' });
    }

    const { data, error } = await supabaseAdmin
      .from('verification_documents')
      .insert({
        gerant_id: parsedParams.data.id,
        document_type,
        file_url,
        file_path,
        original_filename: original_filename || null,
        mime_type: mime_type || null,
        file_size: file_size || null,
      })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/documents', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedParams = idParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return res.status(400).json({ error: 'Identifiant invalide' });
    }

    const authUserId = req.auth?.userId;
    if (!authUserId) {
      return res.status(401).json({ error: 'Non autorisé' });
    }

    const { data: gerant, error: fetchError } = await supabaseAdmin
      .from('gerants')
      .select('clerk_user_id')
      .eq('id', parsedParams.data.id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!gerant) return res.status(404).json({ error: 'Gérant introuvable' });
    if (gerant.clerk_user_id !== authUserId) {
      return res.status(403).json({ error: 'Non autorisé' });
    }

    const { data, error } = await supabaseAdmin
      .from('verification_documents')
      .select('*')
      .eq('gerant_id', parsedParams.data.id)
      .order('created_at', { ascending: true });
    if (error) throw error;

    const docsWithFreshUrls = await Promise.all(
      (data || []).map(async (doc: any) => {
        const { data: signData } = await supabaseAdmin.storage
          .from('verification-docs')
          .createSignedUrl(doc.file_path, 3600);
        return { ...doc, file_url: signData?.signedUrl ?? doc.file_url };
      })
    );
    res.json(docsWithFreshUrls);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id/documents/:docId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedParams = idParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return res.status(400).json({ error: 'Identifiant invalide' });
    }

    const authUserId = req.auth?.userId;
    if (!authUserId) {
      return res.status(401).json({ error: 'Non autorisé' });
    }

    const { data: gerant, error: fetchError } = await supabaseAdmin
      .from('gerants')
      .select('clerk_user_id, verification_status')
      .eq('id', parsedParams.data.id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!gerant) return res.status(404).json({ error: 'Gérant introuvable' });
    if (gerant.clerk_user_id !== authUserId) {
      return res.status(403).json({ error: 'Non autorisé' });
    }
    if (gerant.verification_status === 'pending' || gerant.verification_status === 'under_review') {
      return res.status(400).json({ error: 'Impossible de supprimer un document pendant la révision' });
    }

    const docId = req.params.docId;
    const { data: doc, error: docError } = await supabaseAdmin
      .from('verification_documents')
      .select('id, file_path')
      .eq('id', docId)
      .eq('gerant_id', parsedParams.data.id)
      .maybeSingle();
    if (docError) throw docError;
    if (!doc) return res.status(404).json({ error: 'Document introuvable' });

    await supabaseAdmin.storage.from('verification-docs').remove([doc.file_path]);

    const { error: deleteError } = await supabaseAdmin
      .from('verification_documents')
      .delete()
      .eq('id', docId);
    if (deleteError) throw deleteError;

    res.status(204).send(undefined);
  } catch (err) {
    next(err);
  }
});

// ── Vérification : Adresse Google Maps ──

router.patch('/:id/property-address', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedParams = idParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return res.status(400).json({ error: 'Identifiant invalide' });
    }

    const authUserId = req.auth?.userId;
    if (!authUserId) {
      return res.status(401).json({ error: 'Non autorisé' });
    }

    const parsedBody = propertyAddressSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({ error: 'Données invalides', details: parsedBody.error.flatten() });
    }

    const { data: gerant, error: fetchError } = await supabaseAdmin
      .from('gerants')
      .select('clerk_user_id, verification_status')
      .eq('id', parsedParams.data.id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!gerant) return res.status(404).json({ error: 'Gérant introuvable' });
    if (gerant.clerk_user_id !== authUserId) {
      return res.status(403).json({ error: 'Non autorisé' });
    }
    if (gerant.verification_status === 'pending' || gerant.verification_status === 'under_review') {
      return res.status(400).json({ error: 'Impossible de modifier l\'adresse pendant la révision' });
    }

    const { maps_url, lat, lng } = parsedBody.data;
    let coords = await parseGoogleMapsUrl(maps_url);

    if (!coords && lat !== undefined && lng !== undefined) {
      // Fallback : position placée manuellement sur la carte
      coords = { lat, lng };
    }

    if (!coords) {
      return res.status(400).json({
        error: 'Lien Google Maps non reconnu. Collez le lien depuis l\'application Google Maps, ou placez le marqueur manuellement.',
      });
    }

    const { data, error } = await supabaseAdmin
      .from('gerants')
      .update({
        property_maps_url: maps_url,
        property_lat: coords.lat,
        property_lng: coords.lng,
        updated_at: new Date().toISOString(),
      })
      .eq('id', parsedParams.data.id)
      .select('id, property_maps_url, property_lat, property_lng, verification_status')
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// ── Vérification : Soumission + Paiement ──

router.post('/:id/submit-verification', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedParams = idParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return res.status(400).json({ error: 'Identifiant invalide' });
    }

    const authUserId = req.auth?.userId;
    if (!authUserId) {
      return res.status(401).json({ error: 'Non autorisé' });
    }

    const { data: gerant, error: fetchError } = await supabaseAdmin
      .from('gerants')
      .select('clerk_user_id, email, verification_status, market, property_lat, property_lng, property_maps_url')
      .eq('id', parsedParams.data.id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!gerant) return res.status(404).json({ error: 'Gérant introuvable' });
    if (gerant.clerk_user_id !== authUserId) {
      return res.status(403).json({ error: 'Non autorisé' });
    }

    if (gerant.verification_status === 'pending' || gerant.verification_status === 'under_review') {
      return res.status(400).json({ error: 'Une demande de vérification est déjà en cours' });
    }

    const { data: docs, error: docsError } = await supabaseAdmin
      .from('verification_documents')
      .select('document_type')
      .eq('gerant_id', parsedParams.data.id);
    if (docsError) throw docsError;

    const docTypes = new Set((docs || []).map((d) => d.document_type));
    const hasNewPair = docTypes.has('id_card_front') && docTypes.has('id_card_back');
    const hasLegacyPair = docTypes.has('national_id') && docTypes.has('selfie');
    if (!hasNewPair && !hasLegacyPair) {
      return res.status(400).json({ error: 'Vous devez télécharger le recto et le verso de votre carte d\'identité' });
    }

    if (gerant.property_lat == null || gerant.property_lng == null || !gerant.property_maps_url) {
      return res.status(400).json({ error: 'Vous devez indiquer l\'adresse Google Maps de l\'appartement' });
    }

    const customerEmail = gerant.email;
    if (!customerEmail) {
      return res.status(400).json({ error: 'Email gérant manquant. Mettez à jour votre profil.' });
    }

    const callbackUrl = `${getOrigin(req)}/${gerant.market.toLowerCase()}/gerant/verification/success`;

    const transaction = await withFedapayTimeout(
      Transaction.create({
        description: `Frais de vérification - ${gerant.market}`,
        amount: VERIFICATION_AMOUNT,
        currency: { iso: VERIFICATION_CURRENCY },
        callback_url: callbackUrl,
        customer: { email: customerEmail },
        metadata: {
          clerk_user_id: authUserId,
          market: gerant.market,
          type: 'verification',
          gerant_id: parsedParams.data.id,
        },
      })
    );

    const token = await withFedapayTimeout(transaction.generateToken());
    const paymentUrl = (token as any).url || `https://process.fedapay.com/${(token as any).token}`;

    await supabaseAdmin
      .from('premium_transactions')
      .upsert(
        {
          fedapay_transaction_id: transaction.id,
          clerk_user_id: authUserId,
          market: gerant.market,
          amount: VERIFICATION_AMOUNT,
          currency: VERIFICATION_CURRENCY,
          status: 'pending',
          customer_email: customerEmail,
          type: 'verification',
          raw_event: { source: 'submit-verification' },
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'fedapay_transaction_id' }
      );

    res.json({
      transaction_id: transaction.id,
      payment_url: paymentUrl,
    });
  } catch (err: any) {
    if (isNotFoundError(err)) {
      return res.status(404).json({ error: 'Ressource FedaPay introuvable' });
    }
    console.error('[verification] submit error:', err?.message || err);
    next(err);
  }
});

router.post('/:id/confirm-verification', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedParams = idParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return res.status(400).json({ error: 'Identifiant invalide' });
    }

    const authUserId = req.auth?.userId;
    if (!authUserId) {
      return res.status(401).json({ error: 'Non autorisé' });
    }

    const transactionId = Number(req.body.transaction_id);
    if (!transactionId || transactionId <= 0) {
      return res.status(400).json({ error: 'Transaction ID invalide' });
    }

    const { data: gerant, error: fetchError } = await supabaseAdmin
      .from('gerants')
      .select('clerk_user_id, market')
      .eq('id', parsedParams.data.id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!gerant) return res.status(404).json({ error: 'Gérant introuvable' });
    if (gerant.clerk_user_id !== authUserId) {
      return res.status(403).json({ error: 'Non autorisé' });
    }

    let transaction: any;
    try {
      transaction = await withFedapayTimeout(Transaction.retrieve(transactionId));
    } catch (err) {
      if (isNotFoundError(err)) {
        return res.status(404).json({ error: 'Transaction introuvable' });
      }
      throw err;
    }

    const meta: any = (transaction as any).metadata || {};
    if (meta.clerk_user_id !== authUserId) {
      return res.status(403).json({ error: 'Cette transaction ne vous appartient pas' });
    }

    const rawType = (meta.type as string | undefined) ?? '';
    const metaType = rawType === 'premium_subscription' ? 'premium' : rawType;
    if (metaType !== 'verification') {
      return res.status(400).json({ error: 'Transaction non éligible à la vérification' });
    }

    const amountFromTx = Number((transaction as any).amount);
    if (!Number.isFinite(amountFromTx) || amountFromTx < VERIFICATION_AMOUNT) {
      return res.status(400).json({ error: 'Montant de transaction insuffisant' });
    }

    const rawStatus = (transaction as any).status;
    const status = mapFedaPayStatus(rawStatus);

    await supabaseAdmin
      .from('premium_transactions')
      .upsert(
        {
          fedapay_transaction_id: transaction.id,
          clerk_user_id: authUserId,
          market: gerant.market,
          amount: amountFromTx,
          currency: VERIFICATION_CURRENCY,
          status,
          customer_email: (transaction as any).customer?.email ?? null,
          type: 'verification',
          raw_event: { source: 'confirm-verification', transaction_status: rawStatus },
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'fedapay_transaction_id' }
      );

    if (status !== 'approved') {
      return res.status(400).json({
        error: status === 'pending' ? 'Paiement en attente de confirmation' : `Paiement ${status}`,
        status,
      });
    }

    const { data: currentGerant } = await supabaseAdmin
      .from('gerants')
      .select('verification_status')
      .eq('id', parsedParams.data.id)
      .maybeSingle();

    if (currentGerant?.verification_status === 'pending' || currentGerant?.verification_status === 'under_review') {
      const { data: updatedGerant } = await supabaseAdmin
        .from('gerants')
        .select('*')
        .eq('id', parsedParams.data.id)
        .single();
      return res.json({ success: true, gerant: updatedGerant });
    }

    const { error: updateError } = await supabaseAdmin
      .from('gerants')
      .update({
        verification_status: 'pending',
        verification_submitted_at: new Date().toISOString(),
        verification_rejection_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', parsedParams.data.id);
    if (updateError) throw updateError;

    await supabaseAdmin.from('notifications').insert({
      id: randomUUID(),
      type: 'verification_submitted',
      room_title: null,
      room_id: null,
      client_name: null,
      client_email: null,
      client_phone: null,
      message: `Nouvelle demande de vérification de ${gerant.market}`,
      gerant_id: authUserId,
    });

    const { data: updatedGerant } = await supabaseAdmin
      .from('gerants')
      .select('*')
      .eq('id', parsedParams.data.id)
      .single();

    res.json({ success: true, gerant: updatedGerant });
  } catch (err: any) {
    if (isNotFoundError(err)) {
      return res.status(404).json({ error: 'Transaction introuvable' });
    }
    console.error('[verification] confirm error:', err?.message || err);
    next(err);
  }
});

router.get('/:id/verification-status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedParams = idParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return res.status(400).json({ error: 'Identifiant invalide' });
    }

    const authUserId = req.auth?.userId;
    if (!authUserId) {
      return res.status(401).json({ error: 'Non autorisé' });
    }

    const { data: gerant, error: fetchError } = await supabaseAdmin
      .from('gerants')
      .select('clerk_user_id, verification_status, verification_rejection_reason, verification_submitted_at, verification_reviewed_at, property_maps_url, property_lat, property_lng')
      .eq('id', parsedParams.data.id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!gerant) return res.status(404).json({ error: 'Gérant introuvable' });
    if (gerant.clerk_user_id !== authUserId) {
      return res.status(403).json({ error: 'Non autorisé' });
    }

    const { data: docs, error: docsError } = await supabaseAdmin
      .from('verification_documents')
      .select('id, document_type, status, rejection_reason, created_at')
      .eq('gerant_id', parsedParams.data.id)
      .order('created_at', { ascending: true });
    if (docsError) throw docsError;

    res.json({
      verification_status: gerant.verification_status,
      verification_rejection_reason: gerant.verification_rejection_reason,
      verification_submitted_at: gerant.verification_submitted_at,
      verification_reviewed_at: gerant.verification_reviewed_at,
      property_maps_url: gerant.property_maps_url,
      property_lat: gerant.property_lat,
      property_lng: gerant.property_lng,
      documents: docs || [],
    });
  } catch (err) {
    next(err);
  }
});

export default router;

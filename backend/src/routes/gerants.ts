import { Router, Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { supabaseAdmin } from '../config/supabase';
import { publishNotificationChanged } from '../utils/realtime';
import { gerantCreateSchema, gerantUpdateSchema, verificationDocumentTypeSchema, propertyAddressSchema } from '../validations/gerant';
import { idParamsSchema } from '../validations/common';
import { isGoogleMapsUrl, parseGoogleMapsUrl } from '../utils/googleMaps';
import {
  isAccessibleVerificationPath,
  isOwnedVerificationPath,
} from '../utils/verificationStorage';
import { GERANT_COLUMNS, VERIFICATION_DOCUMENT_COLUMNS } from '../utils/gerantSelect';
import { requireProfile } from '../middleware/requireProfile';

const router = Router();

const VERIFICATION_REQUIRED_DOCS = [
  'national_id',
  'proof_of_address',
  'selfie',
] as const;

router.get('/me', requireProfile('gerant'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUserId = req.auth?.userId;
    if (!authUserId) {
      return res.status(401).json({ error: 'Non autorisé' });
    }

    const { data, error } = await supabaseAdmin
      .from('gerants')
      .select(GERANT_COLUMNS)
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
      .select(GERANT_COLUMNS)
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
      .select(GERANT_COLUMNS)
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

    const { document_type, file_path, original_filename, mime_type, file_size, replace } = req.body;
    if (!document_type || !file_path) {
      return res.status(400).json({ error: 'document_type et file_path sont requis' });
    }
    const parsedDocType = verificationDocumentTypeSchema.safeParse(document_type);
    if (!parsedDocType.success) {
      return res.status(400).json({
        error: 'document_type doit être national_id, proof_of_address ou selfie',
      });
    }
    // La clé storage doit appartenir à l'utilisateur connecté. Sans ce
    // contrôle, un gérant pouvait inscrire le chemin d'un autre gérant puis
    // obtenir une URL signée via GET /:id/documents (IDOR pièces d'identité).
    if (!isOwnedVerificationPath(file_path, authUserId)) {
      return res.status(403).json({ error: 'Chemin de document non autorisé' });
    }

    const { data: existingDoc, error: existingError } = await supabaseAdmin
      .from('verification_documents')
      .select('id, file_path')
      .eq('gerant_id', parsedParams.data.id)
      .eq('document_type', document_type)
      .maybeSingle();
    if (existingError) throw existingError;

    if (existingDoc && replace !== true) {
      // On ne touche JAMAIS à storage avec un chemin fourni par le client :
      // cela permettrait de supprimer le document d'un autre gérant.
      // Le remplacement explicite ci-dessous supprime l'ancien chemin lu en
      // base, jamais celui fourni dans la requête.
      return res.status(409).json({ error: 'Un document de ce type existe déjà. Supprimez-le avant d\'en ajouter un nouveau.' });
    }

    // `file_url` est toujours dérivée d'une URL signée à la lecture : on ne
    // stocke jamais une URL fournie par le client (elle servirait de fallback
    // et ferait charger une ressource externe au navigateur de l'admin).
    const safeMimeType =
      typeof mime_type === 'string' && /^[a-z]+\/[a-z0-9.+-]{1,100}$/i.test(mime_type)
        ? mime_type
        : null;
    const safeFileSize =
      Number.isInteger(file_size) && file_size >= 0 && file_size <= 10 * 1024 * 1024
        ? file_size
        : null;
    const safeOriginalName =
      typeof original_filename === 'string' ? original_filename.slice(0, 255) : null;

    const documentPayload = {
      gerant_id: parsedParams.data.id,
      document_type,
      file_url: null,
      file_path,
      original_filename: safeOriginalName,
      mime_type: safeMimeType,
      file_size: safeFileSize,
    };

    let data: { file_path: string } | null = null;
    let error: unknown = null;

    if (existingDoc) {
      const result = await supabaseAdmin
        .from('verification_documents')
        .update({
          ...documentPayload,
          status: 'pending',
          rejection_reason: null,
          reviewed_by: null,
          reviewed_at: null,
        })
        .eq('id', existingDoc.id)
        .select(VERIFICATION_DOCUMENT_COLUMNS)
        .single();
      data = result.data;
      error = result.error;
    } else {
      const result = await supabaseAdmin
        .from('verification_documents')
        .insert(documentPayload)
        .select(VERIFICATION_DOCUMENT_COLUMNS)
        .single();
      data = result.data;
      error = result.error;
    }
    if (error) throw error;
    if (!data) throw new Error('Document non enregistré');

    if (existingDoc && existingDoc.file_path !== file_path) {
      await supabaseAdmin.storage.from('verification-docs').remove([existingDoc.file_path]);
    }

    // Aperçu immédiat : on renvoie une URL signée fraîche sans la persister.
    const { data: signData } = await supabaseAdmin.storage
      .from('verification-docs')
      .createSignedUrl(data.file_path, 3600);
    res.status(201).json({ ...data, file_url: signData?.signedUrl ?? null });
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
      .select(VERIFICATION_DOCUMENT_COLUMNS)
      .eq('gerant_id', parsedParams.data.id)
      .order('created_at', { ascending: true });
    if (error) throw error;

    const docsWithFreshUrls = await Promise.all(
      (data || []).map(async (doc: any) => {
        // Défense en profondeur pour les lignes créées avant le correctif :
        // on refuse de signer un chemin préfixé par un autre propriétaire.
        if (!isAccessibleVerificationPath(doc.file_path, authUserId)) {
          return { ...doc, file_url: null };
        }
        const { data: signData } = await supabaseAdmin.storage
          .from('verification-docs')
          .createSignedUrl(doc.file_path, 3600);
        // Pas de fallback sur `doc.file_url` (potentiellement client) : en cas
        // d'échec de signature, on renvoie null et l'UI affiche l'état fichier.
        return { ...doc, file_url: signData?.signedUrl ?? null };
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

    // Ne jamais persister l'URL brute : si ce n'est pas un lien Google Maps
    // naviguable (http(s) + hôte Google), on reconstruit une URL canonique à
    // partir des coordonnées. Une URL arbitraire (`javascript:`, site tiers)
    // serait sinon réaffichée plus tard dans un `<a href>`.
    const trimmedMapsUrl = maps_url.trim();
    const safeMapsUrl = isGoogleMapsUrl(maps_url)
      ? /^https?:\/\//i.test(trimmedMapsUrl)
        ? trimmedMapsUrl
        : `https://${trimmedMapsUrl}`
      : `https://www.google.com/maps?q=${coords.lat},${coords.lng}`;

    const { data, error } = await supabaseAdmin
      .from('gerants')
      .update({
        property_maps_url: safeMapsUrl,
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

// ── Vérification : Soumission gratuite (revue admin) ──

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
      .select(
        'clerk_user_id, verification_status, market, nom, prenom, phone, address, date_of_birth, nationality, property_lat, property_lng, property_maps_url',
      )
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

    const hasPersonalInfo =
      Boolean(gerant.nom?.trim()) &&
      Boolean(gerant.prenom?.trim()) &&
      Boolean(gerant.phone?.trim()) &&
      Boolean(gerant.address?.trim()) &&
      Boolean(gerant.date_of_birth) &&
      Boolean(gerant.nationality?.trim());
    if (!hasPersonalInfo) {
      return res.status(400).json({
        error: 'Complétez vos informations personnelles avant de soumettre votre dossier',
      });
    }

    const { data: docs, error: docsError } = await supabaseAdmin
      .from('verification_documents')
      .select('document_type')
      .eq('gerant_id', parsedParams.data.id);
    if (docsError) throw docsError;

    const docTypes = new Set((docs || []).map((d) => d.document_type));
    const hasCurrentSet = VERIFICATION_REQUIRED_DOCS.every((type) => docTypes.has(type));
    if (!hasCurrentSet) {
      return res.status(400).json({
        error: 'Vous devez télécharger votre pièce d\'identité, un justificatif de domicile et une photo de vous',
      });
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

    // Une nouvelle soumission remet les pièces en file d'examen, notamment
    // après un rejet où elles portent encore le statut `rejected`.
    await supabaseAdmin
      .from('verification_documents')
      .update({
        status: 'pending',
        rejection_reason: null,
        reviewed_by: null,
        reviewed_at: null,
      })
      .eq('gerant_id', parsedParams.data.id);

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
    void publishNotificationChanged('admin', 'gerant');

    const { data: updatedGerant } = await supabaseAdmin
      .from('gerants')
      .select(GERANT_COLUMNS)
      .eq('id', parsedParams.data.id)
      .single();

    res.json({ success: true, gerant: updatedGerant });
  } catch (err) {
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

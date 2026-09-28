import { Router, Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { clientCreateSchema, clientUpdateSchema } from '../validations/client';
import { requireProfile } from '../middleware/requireProfile';

const router = Router();

router.get('/me', requireProfile('client'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUserId = (req as any).auth?.userId;
    if (!authUserId) {
      return res.status(401).json({ error: 'Non autorisé' });
    }

    const { data, error } = await supabaseAdmin
      .from('clients')
      .select('*')
      .eq('clerk_user_id', authUserId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Profil client introuvable' });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.patch('/me', requireProfile('client'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUserId = (req as any).auth?.userId;
    if (!authUserId) {
      return res.status(401).json({ error: 'Non autorisé' });
    }

    const parsed = clientUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Données invalides', details: parsed.error.flatten() });
    }
    if (Object.keys(parsed.data).length === 0) {
      return res.status(400).json({ error: 'Aucune donnée à modifier' });
    }

    const { data: existing } = await supabaseAdmin
      .from('clients')
      .select('id')
      .eq('clerk_user_id', authUserId)
      .maybeSingle();
    if (!existing) return res.status(404).json({ error: 'Profil client introuvable' });

    const { data, error } = await supabaseAdmin
      .from('clients')
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
    const parsedBody = clientCreateSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({ error: 'Données invalides', details: parsedBody.error.flatten() });
    }

    const authUserId = (req as any).auth?.userId;
    if (!authUserId) {
      return res.status(401).json({ error: 'Non autorisé' });
    }
    if (parsedBody.data.clerk_user_id !== authUserId) {
      return res.status(403).json({ error: 'Vous ne pouvez créer que votre propre profil' });
    }

    const { data: existingGerant } = await supabaseAdmin
      .from('gerants')
      .select('id')
      .eq('clerk_user_id', authUserId)
      .maybeSingle();
    if (existingGerant) {
      return res.status(409).json({ error: 'Compte déjà enregistré comme gerant', role: 'gerant' });
    }

    const { data: existing } = await supabaseAdmin
      .from('clients')
      .select('id')
      .eq('clerk_user_id', parsedBody.data.clerk_user_id)
      .maybeSingle();
    if (existing) {
      return res.status(409).json({ error: 'Profil client déjà existant', role: 'client' });
    }

    const { data, error } = await supabaseAdmin
      .from('clients')
      .insert(parsedBody.data)
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

export default router;

import { Router, Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { supabaseAdmin, supabasePublic } from '../config/supabase';
import { requireAdminAuth } from '../middleware/requireAdminAuth';
import { idParamsSchema, marketQuerySchema } from '../validations/common';
import { bannerCreateSchema, bannerUpdateSchema } from '../validations/banner';

const router = Router();
const validSections = ['popular', 'promos', 'categories', 'events'] as const;

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedQuery = marketQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      return res.status(400).json({ error: 'Paramètres invalides' });
    }

    let query = supabasePublic.from('banners').select('*').order('order', { ascending: true });
    if (parsedQuery.data.market) {
      query = query.eq('market', parsedQuery.data.market);
    }

    const section = req.query.section;
    if (section !== undefined && (typeof section !== 'string' || !validSections.includes(section as typeof validSections[number]))) {
      return res.status(400).json({ error: 'Section invalide' });
    }
    if (typeof section === 'string') {
      query = query.eq('section', section);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAdminAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedBody = bannerCreateSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({ error: 'Données de bannière invalides' });
    }

    const { data, error } = await supabaseAdmin
      .from('banners')
      .insert({ id: randomUUID(), ...parsedBody.data })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireAdminAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedParams = idParamsSchema.safeParse(req.params);
    const parsedBody = bannerUpdateSchema.safeParse(req.body);
    if (!parsedParams.success || !parsedBody.success || Object.keys(parsedBody.data).length === 0) {
      return res.status(400).json({ error: 'Données de bannière invalides' });
    }

    const { data, error } = await supabaseAdmin
      .from('banners')
      .update(parsedBody.data)
      .eq('id', parsedParams.data.id)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Bannière introuvable' });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireAdminAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedParams = idParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return res.status(400).json({ error: 'Identifiant invalide' });
    }

    const { data, error } = await supabaseAdmin
      .from('banners')
      .delete()
      .eq('id', parsedParams.data.id)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Bannière introuvable' });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;

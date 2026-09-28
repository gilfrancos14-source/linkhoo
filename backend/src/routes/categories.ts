import { Router, Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { supabaseAdmin, supabasePublic } from '../config/supabase';
import { requireClerkAuth } from '../middleware/clerkAuth';
import { requireGerantMarket } from '../middleware/requireGerantMarket';
import { idParamsSchema, marketQuerySchema } from '../validations/common';
import { categoryCreateSchema, categoryUpdateSchema } from '../validations/category';

const router = Router();

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedQuery = marketQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      return res.status(400).json({ error: 'Paramètres invalides' });
    }

    let query = supabasePublic.from('categories').select('*');
    if (parsedQuery.data.market) {
      query = query.eq('market', parsedQuery.data.market);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.post('/', requireClerkAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedBody = categoryCreateSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({ error: 'Données de catégorie invalides' });
    }

    const gerantInfo = await requireGerantMarket(req, res);
    if (!gerantInfo) return;

    if (parsedBody.data.market !== gerantInfo.market) {
      return res.status(403).json({ error: 'Vous ne pouvez créer des catégories que dans votre marché' });
    }

    const { data, error } = await supabaseAdmin
      .from('categories')
      .insert({ id: randomUUID(), ...parsedBody.data })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireClerkAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedParams = idParamsSchema.safeParse(req.params);
    const parsedBody = categoryUpdateSchema.safeParse(req.body);
    if (!parsedParams.success || !parsedBody.success || Object.keys(parsedBody.data).length === 0) {
      return res.status(400).json({ error: 'Données de catégorie invalides' });
    }

    const gerantInfo = await requireGerantMarket(req, res);
    if (!gerantInfo) return;

    const { data: existingCat, error: fetchError } = await supabaseAdmin
      .from('categories')
      .select('market')
      .eq('id', parsedParams.data.id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!existingCat) return res.status(404).json({ error: 'Catégorie introuvable' });
    if (existingCat.market !== gerantInfo.market) {
      return res.status(403).json({ error: 'Vous ne pouvez modifier que les catégories de votre marché' });
    }

    const { data, error } = await supabaseAdmin
      .from('categories')
      .update(parsedBody.data)
      .eq('id', parsedParams.data.id)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Catégorie introuvable' });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireClerkAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedParams = idParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return res.status(400).json({ error: 'Identifiant invalide' });
    }

    const gerantInfo = await requireGerantMarket(req, res);
    if (!gerantInfo) return;

    const { data: existingCat, error: fetchError } = await supabaseAdmin
      .from('categories')
      .select('market')
      .eq('id', parsedParams.data.id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!existingCat) return res.status(404).json({ error: 'Catégorie introuvable' });
    if (existingCat.market !== gerantInfo.market) {
      return res.status(403).json({ error: 'Vous ne pouvez supprimer que les catégories de votre marché' });
    }

    const { data, error } = await supabaseAdmin
      .from('categories')
      .delete()
      .eq('id', parsedParams.data.id)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Catégorie introuvable' });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;

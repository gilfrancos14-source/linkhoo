import { Router, Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { supabaseAdmin, supabasePublic } from '../config/supabase';
import { requireAdminAuth } from '../middleware/requireAdminAuth';
import { requirePermission, requireSuperadmin } from '../middleware/adminPermissions';
import { idParamsSchema } from '../validations/common';
import {
  escapadeQuerySchema,
  escapadeCreateSchema,
  escapadeUpdateSchema,
} from '../validations/escapade';
import { ESCAPADE_COLUMNS } from '../utils/selects';

const router = Router();

// GET public : liste des escapades d'un marché, dans l'ordre de création.
// `market` est obligatoire : sans lui, les cartes CI et BJ se mélangeraient.
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedQuery = escapadeQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      return res.status(400).json({ error: 'Paramètres invalides' });
    }
    const market = parsedQuery.data.market;

    const { data, error } = await supabasePublic
      .from('escapades')
      .select(ESCAPADE_COLUMNS)
      .eq('market', market)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true });
    if (error) throw error;

    res.json(data ?? []);
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAdminAuth, requirePermission('escapades'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedBody = escapadeCreateSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({ error: "Données d'escapade invalides" });
    }

    const { data, error } = await supabaseAdmin
      .from('escapades')
      .insert({ id: randomUUID(), ...parsedBody.data })
      .select(ESCAPADE_COLUMNS)
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireAdminAuth, requirePermission('escapades'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedParams = idParamsSchema.safeParse(req.params);
    const parsedBody = escapadeUpdateSchema.safeParse(req.body);
    if (!parsedParams.success || !parsedBody.success || Object.keys(parsedBody.data).length === 0) {
      return res.status(400).json({ error: "Données d'escapade invalides" });
    }

    const { data, error } = await supabaseAdmin
      .from('escapades')
      .update(parsedBody.data)
      .eq('id', parsedParams.data.id)
      .select(ESCAPADE_COLUMNS)
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Escapade introuvable' });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireAdminAuth, requireSuperadmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedParams = idParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return res.status(400).json({ error: 'Identifiant invalide' });
    }

    const { data, error } = await supabaseAdmin
      .from('escapades')
      .delete()
      .eq('id', parsedParams.data.id)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Escapade introuvable' });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;

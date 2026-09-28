import { Router, Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { supabaseAdmin, supabasePublic } from '../config/supabase';
import { requireAdminAuth } from '../middleware/requireAdminAuth';
import { idParamsSchema } from '../validations/common';
import { eventQuerySchema, eventCreateSchema, eventUpdateSchema } from '../validations/event';

const router = Router();

// Marge de 7 jours : un événement récemment passé reste affiché une semaine
// (transition douce pour les cartes), puis il disparaît du site public.
// Abidjan = UTC+0 toute l'année, la date UTC est donc la date locale.
const PAST_MARGIN_DAYS = 7;
function pastCutoff(): string {
  return new Date(Date.now() - PAST_MARGIN_DAYS * 86400000).toISOString().slice(0, 10);
}

// Les événements passés ne sont visibles que par le back-office : la route
// publique renvoie uniquement les événements à venir, sauf si l'appelant
// demande `include_past=1` et prouve son rôle admin.
function requireAdminForPast(req: Request, res: Response, next: NextFunction) {
  if (req.query.include_past === '1') return requireAdminAuth(req, res, next);
  next();
}

// GET public : le marché est obligatoire (eventQuerySchema), le tri est
// déterministe (event_date, puis id) pour que la couverture d'une ville et
// l'ordre des cartes soient stables entre deux appels.
router.get('/', requireAdminForPast, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedQuery = eventQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      return res.status(400).json({ error: 'Paramètres invalides' });
    }

    let query = supabasePublic
      .from('events')
      .select('*')
      .eq('market', parsedQuery.data.market);
    if (parsedQuery.data.include_past !== '1') {
      query = query.gte('event_date', pastCutoff());
    }
    const { data, error } = await query
      .order('event_date', { ascending: true })
      .order('id', { ascending: true });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAdminAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedBody = eventCreateSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({ error: "Données d'événement invalides" });
    }

    const { data, error } = await supabaseAdmin
      .from('events')
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
    const parsedBody = eventUpdateSchema.safeParse(req.body);
    if (!parsedParams.success || !parsedBody.success || Object.keys(parsedBody.data).length === 0) {
      return res.status(400).json({ error: "Données d'événement invalides" });
    }

    const { data, error } = await supabaseAdmin
      .from('events')
      .update(parsedBody.data)
      .eq('id', parsedParams.data.id)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Événement introuvable' });
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
      .from('events')
      .delete()
      .eq('id', parsedParams.data.id)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Événement introuvable' });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;

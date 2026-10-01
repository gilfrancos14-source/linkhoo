import { Router, Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { supabaseAdmin, supabasePublic } from '../config/supabase';
import { requireAdminAuth } from '../middleware/requireAdminAuth';
import { idParamsSchema } from '../validations/common';
import {
  destinationQuerySchema,
  destinationCreateSchema,
  destinationUpdateSchema,
} from '../validations/tourism';
import { partitionDestinations, upcomingEventCities, upcomingWindow } from '../utils/tourism';

const router = Router();

// GET public : une seule forme de réponse, { big, small } = partition complète
// de la table. Le back-office concatène les deux tableaux pour obtenir la
// liste complète, l'ordre de tri et l'effet réel de la règle d'éligibilité.
// Deux lectures seulement : les événements du marché sur la fenêtre de 30
// jours (map ville → prochain événement) puis les destinations du marché.
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedQuery = destinationQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      return res.status(400).json({ error: 'Paramètres invalides' });
    }
    const market = parsedQuery.data.market;

    // Abidjan = UTC+0 toute l'année : la date UTC est la date locale.
    const today = new Date().toISOString().slice(0, 10);
    const { to } = upcomingWindow(today);

    const eventsResult = await supabasePublic
      .from('events')
      .select('city, event_date')
      .eq('market', market)
      .gte('event_date', today)
      .lte('event_date', to);
    if (eventsResult.error) throw eventsResult.error;

    const { data, error } = await supabasePublic
      .from('tourism_destinations')
      .select('*')
      .eq('market', market);
    if (error) throw error;

    const upcoming = upcomingEventCities(eventsResult.data ?? [], today);
    const { big, small } = partitionDestinations(data ?? [], upcoming);
    res.json({ big, small });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAdminAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedBody = destinationCreateSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({ error: 'Données de destination invalides' });
    }

    const { data, error } = await supabaseAdmin
      .from('tourism_destinations')
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
    const parsedBody = destinationUpdateSchema.safeParse(req.body);
    if (!parsedParams.success || !parsedBody.success || Object.keys(parsedBody.data).length === 0) {
      return res.status(400).json({ error: 'Données de destination invalides' });
    }

    const { data, error } = await supabaseAdmin
      .from('tourism_destinations')
      .update(parsedBody.data)
      .eq('id', parsedParams.data.id)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Destination introuvable' });
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
      .from('tourism_destinations')
      .delete()
      .eq('id', parsedParams.data.id)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Destination introuvable' });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;

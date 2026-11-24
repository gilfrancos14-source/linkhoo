import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { supabasePublic } from '../config/supabase';
import type { MarketCode } from '../config/markets';
import { ROOM_COLUMNS } from '../utils/selects';
import { createClientLimiter } from '../utils/rateLimiters';
import { SecureCache } from '../utils/SecureCache';
import { attachTranslations, resolveLocale } from '../i18n/translations';
import { marketFromRequest } from '../services/geoIp';
import { logger } from '../lib/logger';

const router = Router();
const discoverLimiter = createClientLimiter({ prefix: 'discover' });
const responseCache = new SecureCache();

const querySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(6).optional(),
    lang: z.enum(['fr', 'en', 'es']).optional(),
    // Développement uniquement : permet de tester la section sans vivre au
    // bon endroit (IP locale = pas de pays détecté).
    market: z.string().length(2).optional(),
  })
  .strict();

interface DiscoverResponse {
  market: MarketCode | null;
  rooms: Record<string, unknown>[];
}

const EMPTY: DiscoverResponse = { market: null, rooms: [] };

/**
 * GET /api/discover/local-rooms — quelques logements du marché déduit de l'IP
 * du visiteur. Endpoint public, non bloquant : sans pays ou sans chambre, on
 * renvoie une liste vide et la section landing se masque d'elle-même.
 */
router.get('/local-rooms', discoverLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: 'Paramètres invalides' });

    const limit = parsed.data.limit ?? 4;
    const locale = resolveLocale(parsed.data.lang);

    let market: MarketCode | null = null;
    if (process.env.NODE_ENV !== 'production' && parsed.data.market) {
      market = parsed.data.market.toUpperCase() as MarketCode;
    } else {
      const detected = await marketFromRequest(req);
      market = detected.market;
    }
    if (!market) return res.json(EMPTY);

    const cacheKey = `local-rooms:${market}:${locale}:${limit}`;
    const cached = responseCache.get<DiscoverResponse>(cacheKey);
    if (cached) return res.json(cached);

    const { data, error } = await supabasePublic
      .from('rooms')
      .select(ROOM_COLUMNS)
      .eq('market', market)
      .eq('disponible', true)
      .not('img', 'is', null)
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .limit(limit);
    if (error) throw error;

    const rooms = await attachTranslations(
      Array.isArray(data) ? data : [],
      'room',
      locale,
    );
    const payload: DiscoverResponse = { market, rooms };
    responseCache.set(cacheKey, payload, 300);

    if (process.env.NODE_ENV === 'development') {
      logger.info('[discover] logements locaux servis', { market, count: rooms.length });
    }
    return res.json(payload);
  } catch (err) {
    next(err);
  }
});

export default router;

import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { supabaseAdmin, supabasePublic } from '../config/supabase';
import { isMarketCode, type MarketCode } from '../config/markets';
import { ROOM_COLUMNS } from '../utils/selects';
import { createClientLimiter } from '../utils/rateLimiters';
import { SecureCache } from '../utils/SecureCache';
import { attachTranslations, resolveLocale } from '../i18n/translations';
import {
  marketFromRequest,
  nearestMarketFromRequest,
  nearestMarketsFromRequest,
} from '../services/geoIp';
import { fetchAllRows } from '../utils/fetchAll';
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

/**
 * Prochain week-end complet : samedi → lundi (nuits de samedi et dimanche).
 * Si l'on est déjà samedi, on prend le week-end en cours ; dimanche, on attend
 * le samedi suivant pour pouvoir proposer les deux jours.
 */
export function nextWeekendDates(now = new Date()): { arrivee: string; depart: string } {
  const day = now.getUTCDay(); // 0 = dimanche, 6 = samedi
  const delta = day === 6 ? 0 : day === 0 ? 6 : 6 - day;
  const saturday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + delta),
  );
  const monday = new Date(saturday);
  monday.setUTCDate(monday.getUTCDate() + 2);
  return {
    arrivee: saturday.toISOString().slice(0, 10),
    depart: monday.toISOString().slice(0, 10),
  };
}

interface DiscoverResponse {
  market: MarketCode | null;
  rooms: Record<string, unknown>[];
}

const EMPTY: DiscoverResponse = { market: null, rooms: [] };

/**
 * GET /api/discover/market — marché déduit de l'IP du visiteur, sans logements.
 *
 * Sert les liens « Devenir hôte » / inscription de la landing : un visiteur
 * doit arriver sur le marché de son pays, pas systématiquement sur /ci.
 * Réponse dépendant de l'IP : aucun cache partagé (contrairement aux listes
 * de logements, identiques pour tous les visiteurs d'un même marché).
 */
router.get('/market', discoverLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: 'Paramètres invalides' });

    // Développement uniquement : une IP locale ne donne aucun pays.
    if (process.env.NODE_ENV !== 'production' && parsed.data.market) {
      const code = parsed.data.market.toUpperCase();
      if (!isMarketCode(code)) return res.status(400).json({ error: 'Marché inconnu' });
      return res.json({ market: code, countryCode: code });
    }

    const { market, countryCode } = await marketFromRequest(req);
    return res.json({ market, countryCode });
  } catch (err) {
    next(err);
  }
});

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

/**
 * GET /api/discover/neighbor-rooms — offres du marché voisin (le plus proche
 * géographiquement, hors pays du visiteur). Même contrat que /local-rooms.
 */
router.get('/neighbor-rooms', discoverLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: 'Paramètres invalides' });

    const limit = parsed.data.limit ?? 4;
    const locale = resolveLocale(parsed.data.lang);
    const { market } = await nearestMarketFromRequest(req);
    if (!market) return res.json(EMPTY);

    const cacheKey = `neighbor-rooms:${market}:${locale}:${limit}`;
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
    return res.json(payload);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/discover/weekend-rooms — logements libres samedi ET dimanche dans
 * le 2ᵉ marché le plus proche (le 1ᵉʳ est déjà montré dans /neighbor-rooms).
 */
router.get('/weekend-rooms', discoverLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: 'Paramètres invalides' });

    const limit = parsed.data.limit ?? 4;
    const locale = resolveLocale(parsed.data.lang);
    const { markets } = await nearestMarketsFromRequest(req, 2);
    const market = markets[1] ?? null;
    if (!market) return res.json(EMPTY);

    const { arrivee, depart } = nextWeekendDates();
    const cacheKey = `weekend-rooms:${market}:${locale}:${limit}:${arrivee}`;
    const cached = responseCache.get<DiscoverResponse>(cacheKey);
    if (cached) return res.json(cached);

    // Même règle que /api/rooms/available : une réservation non annulée qui
    // chevauche [samedi, lundi[ bloque la chambre.
    const overlapping = await fetchAllRows<{ room_id: string | null }>((from, to) =>
      supabaseAdmin
        .from('reservations')
        .select('room_id')
        .neq('statut', 'annulee')
        .lt('date_debut', depart)
        .gt('date_fin', arrivee)
        .order('id', { ascending: true })
        .range(from, to),
    );
    const blocked = new Set(
      overlapping.map((row) => row.room_id).filter((id): id is string => Boolean(id)),
    );

    const rows = await fetchAllRows<Record<string, unknown>>((from, to) =>
      supabasePublic
        .from('rooms')
        .select(ROOM_COLUMNS)
        .eq('market', market)
        .eq('disponible', true)
        .not('img', 'is', null)
        .order('created_at', { ascending: false })
        .order('id', { ascending: true })
        .range(from, to),
    );
    const rooms = await attachTranslations(
      rows.filter((room) => !blocked.has(String(room.id))).slice(0, limit),
      'room',
      locale,
    );

    const payload: DiscoverResponse = { market, rooms };
    responseCache.set(cacheKey, payload, 300);
    return res.json(payload);
  } catch (err) {
    next(err);
  }
});

export default router;

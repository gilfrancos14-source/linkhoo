import { Router, Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import type { z } from 'zod';
import { supabaseAdmin, supabasePublic } from '../config/supabase';
import { requireClerkAuth } from '../middleware/clerkAuth';
import { requireGerantMarket } from '../middleware/requireGerantMarket';
import { idParamsSchema, marketQuerySchema } from '../validations/common';
import {
  roomAvailableQuerySchema,
  roomCreateSchema,
  roomListQuerySchema,
  roomUpdateSchema,
} from '../validations/room';
import { fetchAllRows } from '../utils/fetchAll';
import { normalizeCity } from '../utils/city';
import { isPremiumActive } from '../utils/premium';
import { interleaveRooms, rankWindowRows } from '../utils/rankRooms';

const router = Router();

type RoomListFilters = z.infer<typeof roomListQuerySchema>;

/**
 * Applique les filtres de `roomListQuerySchema` à une builder PostgREST :
 * utilisé à la fois par la requête de données et par le compte `count: exact`,
 * pour que total et page portent exactement sur le même périmètre.
 */
function applyRoomFilters(query: any, filters: RoomListFilters): any {
  let q = query;
  if (filters.market) q = q.eq('market', filters.market);
  if (filters.ville) q = q.eq('ville', filters.ville);
  if (filters.quartier) q = q.eq('quartier', filters.quartier);
  if (filters.category) q = q.eq('category', filters.category);
  if (filters.prix_min !== undefined) q = q.gte('price_num', filters.prix_min);
  if (filters.prix_max !== undefined) q = q.lte('price_num', filters.prix_max);
  if (filters.chambres !== undefined) {
    // « 3 chambres » vaut « 3 et plus » (identique au filtre client).
    q = filters.chambres >= 3 ? q.gte('chambres', 3) : q.eq('chambres', filters.chambres);
  }
  if (filters.disponible !== undefined) q = q.eq('disponible', filters.disponible === 'true');
  return q;
}

/**
 * `gerant_id` des gérants premium ACTIFS — l'expiration est tranchée par
 * `isPremiumActive` (source unique, la même que les badges).
 *
 * Client admin : la table `gerants` est protégée par RLS (le client anon en
 * lit 0 ligne), exactement comme pour la fiche détaillée d'une chambre.
 *
 * Cette lecture sert uniquement au classement : si elle échoue, on journalise
 * et on classe sans boost plutôt que de casser le catalogue.
 */
async function loadPremiumGerantIds(): Promise<Set<string>> {
  try {
    const { data, error } = await supabaseAdmin
      .from('gerants')
      .select('clerk_user_id, is_premium, premium_expires_at')
      .eq('is_premium', true);
    if (error) throw error;

    const ids = new Set<string>();
    // `select()` sans `.single()` renvoie une liste ; un résultat unique
    // inattendu ne doit pas faire échouer le classement.
    for (const gerant of Array.isArray(data) ? data : []) {
      if (gerant.clerk_user_id && isPremiumActive(gerant)) ids.add(gerant.clerk_user_id);
    }
    return ids;
  } catch (err) {
    console.error('loadPremiumGerantIds : classement sans boost', err);
    return new Set();
  }
}

/** Drapeau `gerant_premium` sur chaque ligne (alimente le badge « Premium »). */
function stampPremiumFlag(rows: any[], premiumGerantIds: ReadonlySet<string>): any[] {
  return rows.map((room) => ({
    ...room,
    gerant_premium: !!room.gerant_id && premiumGerantIds.has(room.gerant_id),
  }));
}

/** Classement quota premium (ordre organique intercalé) + drapeau par ligne. */
function rankRows(rows: any[], premiumGerantIds: ReadonlySet<string>): any[] {
  return stampPremiumFlag(interleaveRooms(rows, premiumGerantIds), premiumGerantIds);
}

router.get('/popular', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedQuery = marketQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      return res.status(400).json({ error: 'Paramètres invalides' });
    }

    const market = parsedQuery.data.market;

    // Les deux lectures partent en parallèle : la latence totale devient le
    // max des deux au lieu de la somme des deux aller-retours Supabase.
    // Réservations bornées aux 2000 plus récentes : le classement « top
    // réservées » se base sur l'essentiel de l'activité, et la requête reste
    // rapide quel que soit le volume futur (PostgREST tronque silencieusement
    // à db-max-rows = 1000 sans ORDER/LIMIT explicite).
    const [{ data: allRooms, error: roomsError }, { data: reservations, error: resError }] =
      await Promise.all([
        supabasePublic
          .from('rooms')
          .select('*')
          .eq('market', market)
          .order('created_at', { ascending: false }),
        supabaseAdmin
          .from('reservations')
          .select('room_id')
          .eq('statut', 'confirmee')
          .order('created_at', { ascending: false })
          .limit(2000),
      ]);
    if (roomsError) throw roomsError;
    if (resError) throw resError;

    const bookingCounts = new Map<string, number>();
    (reservations || []).forEach((r) => {
      bookingCounts.set(r.room_id, (bookingCounts.get(r.room_id) || 0) + 1);
    });

    const rooms = allRooms || [];
    const popular = rooms.filter((r) => r.is_popular);
    const remaining = 6 - popular.length;

    const topBooked = rooms
      .filter((r) => !r.is_popular)
      .sort((a, b) => (bookingCounts.get(b.id) || 0) - (bookingCounts.get(a.id) || 0))
      .slice(0, Math.max(0, remaining));

    const result = [...popular, ...topBooked].slice(0, 6);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedQuery = roomListQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      return res.status(400).json({ error: 'Paramètres invalides' });
    }
    const filters = parsedQuery.data;

    // Sans page/limit : comportement historique (tableau complet, parcouru par
    // tranches de 1000 pour contourner db-max-rows).
    if (filters.page === undefined && filters.limit === undefined) {
      const rowsPromise = fetchAllRows<any>((from, to) => {
        const query = applyRoomFilters(
          supabasePublic
            .from('rooms')
            .select('*')
            .order('created_at', { ascending: false })
            .order('id', { ascending: true }),
          filters,
        );
        return query.range(from, to);
      });
      const premiumPromise = loadPremiumGerantIds();
      const [data, premiumGerantIds] = await Promise.all([rowsPromise, premiumPromise]);
      return res.json(rankRows(data, premiumGerantIds));
    }

    // Mode paginé : une page de lignes + un compte exact, en SQL — jamais
    // l'intégralité de la table en mémoire.
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 24;
    const offset = (page - 1) * limit;

    const countQuery = applyRoomFilters(
      supabasePublic.from('rooms').select('id', { count: 'exact', head: true }),
      filters,
    );

    // Fenêtre bornée : on lit `ratio × la page` lignes depuis le début de la
    // liste (au plus RANK_MAX_WINDOW) pour pouvoir intercaler le quota
    // premium, puis on découpe la page demandée — le `count` reste le vrai
    // total. Page plus profonde que la borne : repli sur l'ordre organique.
    const windowRows = rankWindowRows(offset, limit);
    const rowsQuery = applyRoomFilters(
      supabasePublic
        .from('rooms')
        .select('*')
        .order('created_at', { ascending: false })
        .order('id', { ascending: true }),
      filters,
    ).range(
      windowRows === null ? offset : 0,
      windowRows === null ? offset + limit - 1 : windowRows - 1,
    );

    const premiumPromise = loadPremiumGerantIds();

    const [{ count, error: countError }, { data: rows, error }, premiumGerantIds] =
      await Promise.all([countQuery, rowsQuery, premiumPromise]);
    if (countError) throw countError;
    if (error) throw error;

    const items =
      windowRows === null
        ? stampPremiumFlag(rows ?? [], premiumGerantIds)
        : rankRows(rows ?? [], premiumGerantIds).slice(offset, offset + limit);

    res.json({ items, total: count ?? 0, page, limit });
  } catch (err) {
    next(err);
  }
});

router.get('/available', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedQuery = roomAvailableQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      return res.status(400).json({ error: 'Paramètres de disponibilité invalides' });
    }

    const { market, arrivee, depart, ville } = parsedQuery.data;
    const normalizedVille = ville ? normalizeCity(ville) : null;

    const overlapping = await fetchAllRows<{ room_id: string | null }>((from, to) =>
      supabaseAdmin
        .from('reservations')
        .select('room_id')
        .neq('statut', 'annulee')
        .lt('date_debut', depart)
        .gt('date_fin', arrivee)
        .order('id', { ascending: true })
        .range(from, to));

    const blockedIds = new Set(
      overlapping.map((r) => r.room_id).filter((id): id is string => !!id)
    );

    const roomsPromise = fetchAllRows<any>((from, to) => {
      let query = supabasePublic
        .from('rooms')
        .select('*')
        .eq('disponible', true)
        .order('created_at', { ascending: false })
        .order('id', { ascending: true });
      if (market) {
        query = query.eq('market', market);
      }
      return query.range(from, to);
    });
    const premiumPromise = loadPremiumGerantIds();
    const [rooms, premiumGerantIds] = await Promise.all([roomsPromise, premiumPromise]);

    const available = rooms.filter((room) => !blockedIds.has(room.id));

    // Repli progressif : match exact normalisé, puis match partiel (« Abid »
    // → « Abidjan », « Lomé » → « Lomé-Centre ») si l'exact ne renvoie rien.
    if (!normalizedVille) {
      res.json(rankRows(available, premiumGerantIds));
      return;
    }

    const exact = available.filter((room) => normalizeCity(room.ville) === normalizedVille);
    if (exact.length > 0) {
      res.json(rankRows(exact, premiumGerantIds));
      return;
    }

    res.json(
      rankRows(
        available.filter((room) => {
          const v = normalizeCity(room.ville);
          return v.length > 0 && (v.includes(normalizedVille) || normalizedVille.includes(v));
        }),
        premiumGerantIds,
      )
    );
  } catch (err) {
    next(err);
  }
});

// Liste distincte des villes déjà utilisées — alimente les suggestions
// (datalist) des formulaires admin (événements) et gérant (biens).
router.get('/villes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedQuery = marketQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      return res.status(400).json({ error: 'Paramètres invalides' });
    }

    const rows = await fetchAllRows<{ ville: string | null }>((from, to) => {
      let query = supabasePublic
        .from('rooms')
        .select('ville')
        .order('ville', { ascending: true })
        .order('id', { ascending: true });
      if (parsedQuery.data.market) {
        query = query.eq('market', parsedQuery.data.market);
      }
      return query.range(from, to);
    });

    // Dédup sur la forme normalisée, en gardant la casse d'origine (« Bouaké »).
    const seen = new Map<string, string>();
    for (const row of rows) {
      const raw = (row.ville || '').trim();
      if (!raw) continue;
      const key = normalizeCity(raw);
      if (key && !seen.has(key)) seen.set(key, raw);
    }
    res.json([...seen.values()].sort((a, b) => a.localeCompare(b, 'fr')));
  } catch (err) {
    next(err);
  }
});

// Liste distincte des quartiers — alimente les filtres des pages catégorie
// sans télécharger le catalogue complet côté client.
router.get('/quartiers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedQuery = marketQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      return res.status(400).json({ error: 'Paramètres invalides' });
    }

    const rows = await fetchAllRows<{ quartier: string | null }>((from, to) => {
      let query = supabasePublic
        .from('rooms')
        .select('quartier')
        .order('quartier', { ascending: true })
        .order('id', { ascending: true });
      if (parsedQuery.data.market) {
        query = query.eq('market', parsedQuery.data.market);
      }
      return query.range(from, to);
    });

    // Dédup insensible à la casse en gardant la forme d'origine.
    const seen = new Map<string, string>();
    for (const row of rows) {
      const raw = (row.quartier || '').trim();
      if (!raw) continue;
      const key = raw.toLowerCase();
      if (!seen.has(key)) seen.set(key, raw);
    }
    res.json([...seen.values()].sort((a, b) => a.localeCompare(b, 'fr')));
  } catch (err) {
    next(err);
  }
});

router.get('/mine', requireClerkAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUserId = req.auth?.userId;
    if (!authUserId) return res.status(401).json({ error: 'Non autorisé' });

    const { data, error } = await supabaseAdmin
      .from('rooms')
      .select('*')
      .eq('gerant_id', authUserId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedParams = idParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return res.status(400).json({ error: 'Identifiant invalide' });
    }

    const { data, error } = await supabaseAdmin
      .from('rooms')
      .select('*')
      .eq('id', parsedParams.data.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Chambre introuvable' });

    let gerant = null;
    if (data.gerant_id) {
      const { data: gerantData } = await supabaseAdmin
        .from('gerants')
        .select('nom, prenom, phone, is_verified, is_premium, premium_expires_at')
        .eq('clerk_user_id', data.gerant_id)
        .maybeSingle();
      // Identité et coordonnées jamais exposées tant que le gérant n'est pas vérifié.
      if (gerantData?.is_verified) gerant = gerantData;
    }

    res.json({ ...data, gerant });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireClerkAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedBody = roomCreateSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({ error: 'Données de chambre invalides' });
    }

    const gerantInfo = await requireGerantMarket(req, res, { requireVerified: false });
    if (!gerantInfo) return;

    if (parsedBody.data.market !== gerantInfo.market) {
      return res.status(403).json({ error: 'Vous ne pouvez créer des chambres que dans votre marché' });
    }

    const { data, error } = await supabaseAdmin
      .from('rooms')
      .insert({ id: randomUUID(), ...parsedBody.data, gerant_id: gerantInfo.userId })
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
    const parsedBody = roomUpdateSchema.safeParse(req.body);
    if (!parsedParams.success || !parsedBody.success || Object.keys(parsedBody.data).length === 0) {
      return res.status(400).json({ error: 'Données de chambre invalides' });
    }

    const gerantInfo = await requireGerantMarket(req, res, { requireVerified: false });
    if (!gerantInfo) return;

    const { data: existingRoom, error: fetchError } = await supabaseAdmin
      .from('rooms')
      .select('market, gerant_id')
      .eq('id', parsedParams.data.id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!existingRoom) return res.status(404).json({ error: 'Chambre introuvable' });
    if (existingRoom.gerant_id !== gerantInfo.userId) {
      return res.status(403).json({ error: 'Cette chambre ne vous appartient pas' });
    }

    const { data, error } = await supabaseAdmin
      .from('rooms')
      .update(parsedBody.data)
      .eq('id', parsedParams.data.id)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Chambre introuvable' });
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

    const gerantInfo = await requireGerantMarket(req, res, { requireVerified: false });
    if (!gerantInfo) return;

    const { data: existingRoom, error: fetchError } = await supabaseAdmin
      .from('rooms')
      .select('market, gerant_id')
      .eq('id', parsedParams.data.id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!existingRoom) return res.status(404).json({ error: 'Chambre introuvable' });
    if (existingRoom.gerant_id !== gerantInfo.userId) {
      return res.status(403).json({ error: 'Cette chambre ne vous appartient pas' });
    }

    const { data: activeReservations, error: reservationError } = await supabaseAdmin
      .from('reservations')
      .select('id')
      .eq('room_id', parsedParams.data.id)
      .in('statut', ['en_attente', 'confirmee'])
      .limit(1);
    if (reservationError) throw reservationError;
    if (activeReservations && activeReservations.length > 0) {
      return res.status(409).json({ error: 'Impossible de supprimer cette chambre : des réservations actives existent' });
    }

    const { data, error } = await supabaseAdmin
      .from('rooms')
      .delete()
      .eq('id', parsedParams.data.id)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Chambre introuvable' });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/toggle', requireClerkAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedParams = idParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return res.status(400).json({ error: 'Identifiant invalide' });
    }

    const gerantInfo = await requireGerantMarket(req, res, { requireVerified: false });
    if (!gerantInfo) return;

    const { data: room, error: fetchError } = await supabaseAdmin
      .from('rooms')
      .select('disponible, market, gerant_id')
      .eq('id', parsedParams.data.id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!room) return res.status(404).json({ error: 'Chambre introuvable' });
    if (room.gerant_id !== gerantInfo.userId) {
      return res.status(403).json({ error: 'Cette chambre ne vous appartient pas' });
    }

    const { data, error } = await supabaseAdmin
      .from('rooms')
      .update({ disponible: !room.disponible })
      .eq('id', parsedParams.data.id)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Chambre introuvable' });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

export default router;

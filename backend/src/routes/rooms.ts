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
import { isPlatformImageUrl } from '../validations/imageUrl';
import {
  attachTranslations,
  enqueueTranslations,
  resolveLocale,
} from '../i18n/translations';
import { fetchAllRows } from '../utils/fetchAll';
import { hostResponseRate } from '../services/hostResponseRate';
import { normalizeCity } from '../utils/city';
import { isPremiumActive } from '../utils/premium';
import { interleaveRooms, rankWindowRows } from '../utils/rankRooms';
import { ROOM_COLUMNS } from '../utils/selects';

const router = Router();

type RoomListFilters = z.infer<typeof roomListQuerySchema>;

/**
 * Met la requête dans la même forme que `rooms.search_text` (minuscules,
 * accents retirés) : « Bouaké », « bouake » et « BOUAKÉ » donnent le même
 * motif. Le texte des annonces est normalisé à l'écriture par la migration
 * `20261122120000_rooms_search_text.sql`.
 */
function normalizeSearchTerm(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

function applyRoomFilters(query: any, filters: RoomListFilters): any {
  let q = query;
  if (filters.market) q = q.eq('market', filters.market);
  if (filters.ville) q = q.eq('ville', filters.ville);
  if (filters.quartier) q = q.eq('quartier', filters.quartier);
  if (filters.category) q = q.eq('category', filters.category);
  if (filters.prix_min !== undefined) q = q.gte('price_num', filters.prix_min);
  if (filters.prix_max !== undefined) q = q.lte('price_num', filters.prix_max);
  if (filters.chambres !== undefined) {
    q = filters.chambres >= 3 ? q.gte('chambres', 3) : q.eq('chambres', filters.chambres);
  }
  if (filters.disponible !== undefined) q = q.eq('disponible', filters.disponible === 'true');
  if (filters.promo_group) q = q.eq('promo_group', filters.promo_group);
  if (filters.q) {
    // Même sémantique que la recherche côté client : chaque mot doit matcher,
    // sans tenir compte des accents ni de la casse. `search_text` contient déjà
    // tous les champs pertinents (titre, description, ville, catégorie…).
    const words = normalizeSearchTerm(filters.q).trim().split(/\s+/).filter(Boolean);
    for (const word of words) {
      const pattern = `%${word.replace(/[%_,()"\\]/g, ' ').trim()}%`;
      // Un mot ne contenant que des caractères réservés ne peut rien
      // correspondre : on force un résultat vide au lieu de tout renvoyer.
      if (pattern === '%%') {
        q = q.eq('id', '');
        continue;
      }
      q = q.or(`search_text.ilike.${pattern}`);
    }
  }
  return q;
}

interface GerantSignals {
  premiumIds: ReadonlySet<string>;
  verifiedIds: ReadonlySet<string>;
}

/** Champs du profil gérant lus pour la fiche chambre. */
interface GerantRow {
  nom?: string | null;
  prenom?: string | null;
  phone?: string | null;
  is_verified?: boolean | null;
  is_premium?: boolean | null;
  premium_expires_at?: string | null;
  created_at?: string | null;
}

const GERANT_SIGNALS_CACHE_TTL_MS = 90_000;
const EMPTY_GERANT_SIGNALS: GerantSignals = {
  premiumIds: new Set<string>(),
  verifiedIds: new Set<string>(),
};
let gerantSignalsCache: { signals: GerantSignals; at: number } | null = null;
let gerantSignalsInflight: Promise<GerantSignals> | null = null;

export function resetPremiumCacheForTests(): void {
  gerantSignalsCache = null;
  gerantSignalsInflight = null;
}

async function loadGerantSignals(): Promise<GerantSignals> {
  if (
    gerantSignalsCache &&
    Date.now() - gerantSignalsCache.at < GERANT_SIGNALS_CACHE_TTL_MS
  ) {
    return gerantSignalsCache.signals;
  }
  if (gerantSignalsInflight) return gerantSignalsInflight;

  gerantSignalsInflight = (async () => {
    try {
      const { data, error } = await supabaseAdmin
        .from('gerants')
        .select('clerk_user_id, is_premium, premium_expires_at, is_verified')
        .or('is_premium.eq.true,is_verified.eq.true');
      if (error) throw error;

      const premiumIds = new Set<string>();
      const verifiedIds = new Set<string>();
      for (const gerant of Array.isArray(data) ? data : []) {
        if (!gerant.clerk_user_id) continue;
        if (isPremiumActive(gerant)) premiumIds.add(gerant.clerk_user_id);
        if (gerant.is_verified) verifiedIds.add(gerant.clerk_user_id);
      }

      const signals = { premiumIds, verifiedIds };
      gerantSignalsCache = { signals, at: Date.now() };
      return signals;
    } catch (err) {
      console.error('loadGerantSignals : classement sans signal', err);
      return EMPTY_GERANT_SIGNALS;
    } finally {
      gerantSignalsInflight = null;
    }
  })();

  return gerantSignalsInflight;
}

function stampGerantFlags(rows: any[], signals: GerantSignals): any[] {
  return rows.map((room) => ({
    ...room,
    gerant_premium: !!room.gerant_id && signals.premiumIds.has(room.gerant_id),
    // Les annonces publiées par l'administration sont vérifiées d'office.
    gerant_verified:
      Boolean(room.is_admin_owned) ||
      (!!room.gerant_id && signals.verifiedIds.has(room.gerant_id)),
  }));
}

function rankRows(rows: any[], signals: GerantSignals): any[] {
  return stampGerantFlags(interleaveRooms(rows, signals.premiumIds), signals);
}

function gerantTier(room: any): number {
  if (room.gerant_premium) return 0;
  if (room.gerant_verified) return 1;
  return 2;
}

function rankAvailableRows(rows: any[], signals: GerantSignals): any[] {
  return stampGerantFlags(rows, signals)
    .map((room, index) => ({ room, index }))
    .sort((a, b) => gerantTier(a.room) - gerantTier(b.room) || a.index - b.index)
    .map(({ room }) => room);
}

router.get('/popular', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedQuery = marketQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      return res.status(400).json({ error: 'Paramètres invalides' });
    }

    const market = parsedQuery.data.market;

    const [{ data: allRooms, error: roomsError }, { data: reservations, error: resError }] =
      await Promise.all([
        supabasePublic
          .from('rooms')
          .select(ROOM_COLUMNS)
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
    res.json(await attachTranslations(result, 'room', resolveLocale(req.query.lang)));
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
    const locale = resolveLocale(req.query.lang);

    if (filters.page === undefined && filters.limit === undefined) {
      const rowsPromise = fetchAllRows<any>((from, to) => {
        const query = applyRoomFilters(
          supabasePublic
            .from('rooms')
            .select(ROOM_COLUMNS)
            .order('created_at', { ascending: false })
            .order('id', { ascending: true }),
          filters,
        );
        return query.range(from, to);
      });
      const premiumPromise = loadGerantSignals();
      const [data, signals] = await Promise.all([rowsPromise, premiumPromise]);
      return res.json(await attachTranslations(rankRows(data, signals), 'room', locale));
    }

    const page = filters.page ?? 1;
    const limit = filters.limit ?? 24;
    const offset = (page - 1) * limit;

    const countQuery = applyRoomFilters(
      supabasePublic.from('rooms').select('id', { count: 'exact', head: true }),
      filters,
    );

    const windowRows = rankWindowRows(offset, limit);
    const rowsQuery = applyRoomFilters(
      supabasePublic
        .from('rooms')
        .select(ROOM_COLUMNS)
        .order('created_at', { ascending: false })
        .order('id', { ascending: true }),
      filters,
    ).range(
      windowRows === null ? offset : 0,
      windowRows === null ? offset + limit - 1 : windowRows - 1,
    );

    const premiumPromise = loadGerantSignals();

    const [{ count, error: countError }, { data: rows, error }, signals] =
      await Promise.all([countQuery, rowsQuery, premiumPromise]);
    if (countError) throw countError;
    if (error) throw error;

    const items =
      windowRows === null
        ? stampGerantFlags(rows ?? [], signals)
        : rankRows(rows ?? [], signals).slice(offset, offset + limit);

    res.json({
      items: await attachTranslations(items, 'room', locale),
      total: count ?? 0,
      page,
      limit,
    });
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

    const { market, arrivee, depart, ville, quartier, category, prix_min, prix_max, q } = parsedQuery.data;
    const locale = resolveLocale(req.query.lang);
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
      // Filtres exacts poussés au serveur : la page ne télécharge plus les
      // annonces qu'elle va écarter. La ville est exclue volontairement : le
      // rapprochement normalisé (accents/casse) est fait plus bas.
      const query = applyRoomFilters(
        supabasePublic
          .from('rooms')
          .select(ROOM_COLUMNS)
          .eq('disponible', true)
          .order('created_at', { ascending: false })
          .order('id', { ascending: true }),
        { market, quartier, category, prix_min, prix_max, q },
      );
      return query.range(from, to);
    });
    const premiumPromise = loadGerantSignals();
    const [rooms, signals] = await Promise.all([roomsPromise, premiumPromise]);

    const available = rooms.filter((room) => !blockedIds.has(room.id));
    const send = async (rows: any[]) => {
      res.json(await attachTranslations(rows, 'room', locale));
    };

    if (!normalizedVille) {
      await send(rankAvailableRows(available, signals));
      return;
    }

    const exact = available.filter((room) => normalizeCity(room.ville) === normalizedVille);
    if (exact.length > 0) {
      await send(rankAvailableRows(exact, signals));
      return;
    }

    await send(
      rankAvailableRows(
        available.filter((room) => {
          const v = normalizeCity(room.ville);
          return v.length > 0 && (v.includes(normalizedVille) || normalizedVille.includes(v));
        }),
        signals,
      )
    );
  } catch (err) {
    next(err);
  }
});

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
      .select(ROOM_COLUMNS)
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
      .select(ROOM_COLUMNS)
      .eq('id', parsedParams.data.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Chambre introuvable' });

    const signals = await loadGerantSignals();
    type PublicHost = {
      nom?: string | null;
      prenom?: string | null;
      phone?: string | null;
      is_verified: boolean;
      is_premium: boolean;
      premium_expires_at?: string | null;
      created_at?: string | null;
    };
    let gerant: PublicHost | null = null;
    let gerantRow: GerantRow | null = null;
    let adminOwnerCreatedAt: string | null = null;
    if (data.gerant_id) {
      const result = await supabaseAdmin
        .from('gerants')
        .select('nom, prenom, phone, is_verified, is_premium, premium_expires_at, created_at')
        .eq('clerk_user_id', data.gerant_id)
        .maybeSingle();
      gerantRow = (result.data as GerantRow | null) ?? null;
      if (gerantRow) {
        gerant = {
          nom: gerantRow.nom ?? '',
          prenom: gerantRow.prenom ?? '',
          phone: gerantRow.is_verified ? gerantRow.phone : null,
          is_verified: Boolean(gerantRow.is_verified),
          is_premium: Boolean(gerantRow.is_premium),
          premium_expires_at: gerantRow.premium_expires_at,
          created_at: gerantRow.created_at,
        };
      }
    }

    // Chambre publiée par l'administration : le propriétaire est le compte
    // admin (ou le délégué), pas un gérant. On affiche ce dernier comme hôte
    // vérifié, sans exposer ses coordonnées.
    if (!gerant && data.is_admin_owned && data.admin_owner_id) {
      const { data: admin } = await supabaseAdmin
        .from('admins')
        .select('nom, prenom, created_at')
        .eq('id', data.admin_owner_id)
        .maybeSingle();
      adminOwnerCreatedAt = (admin?.created_at as string | null) ?? null;
      gerant = {
        nom: (admin?.nom as string | null) ?? '',
        prenom: (admin?.prenom as string | null) ?? 'Linkhoo',
        phone: null,
        is_verified: true,
        is_premium: false,
        premium_expires_at: null,
        created_at: adminOwnerCreatedAt,
      };
    }

    // Catégorie et ancienneté de l'hôte : la page de détail affiche ces
    // informations, elles doivent venir de la base et non d'un texte codé.
    let categoryTitle: string | null = null;
    if (data.category) {
      const { data: category } = await supabaseAdmin
        .from('categories')
        .select('title')
        .eq('id', data.category)
        .maybeSingle();
      categoryTitle = category?.title ?? null;
    }
    const ownerCreatedAt = gerantRow?.created_at ?? adminOwnerCreatedAt;
    const experienceMonths = ownerCreatedAt
      ? Math.max(
          0,
          Math.floor(
            (Date.now() - new Date(ownerCreatedAt).getTime()) /
              (30 * 24 * 60 * 60 * 1000),
          ),
        )
      : null;

    const [localized] = await attachTranslations([data], 'room', resolveLocale(req.query.lang));
    const responseStats = await hostResponseRate(data.gerant_id);
    res.json({
      ...localized,
      host_response_rate: responseStats.rate,
      host_response_answered: responseStats.answered,
      host_response_total: responseStats.total,
      category_title: categoryTitle,
      is_guest_favourite: Boolean(data.is_popular),
      gerant: gerant
        ? {
            ...gerant,
            experience_months: experienceMonths,
            is_superhost: Boolean(gerantRow?.is_verified) || Boolean(data.is_admin_owned),
          }
        : null,
      gerant_premium: !!data.gerant_id && signals.premiumIds.has(data.gerant_id),
      gerant_verified:
        Boolean(data.is_admin_owned) ||
        (!!data.gerant_id && signals.verifiedIds.has(data.gerant_id)),
    });
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

    // CORRECTIF : on strip explicitement `id` et `gerant_id` du body client.
    // Avant, `{ id: randomUUID(), ...parsedBody.data, gerant_id: gerantInfo.userId }`
    // laissait le client écraser `id` (collision) — et si le schéma autorisait
    // `gerant_id`, la propriété de la chambre pouvait être usurpée.
    const {
      id: _ignoredId,
      gerant_id: _ignoredGerantId,
      ...payload
    } = parsedBody.data as Record<string, unknown>;

    const { data, error } = await supabaseAdmin
      .from('rooms')
      .insert({ ...payload, id: randomUUID(), gerant_id: gerantInfo.userId })
      .select(ROOM_COLUMNS)
      .single();
    if (error) throw error;
    // Traduction asynchrone : on répond tout de suite, le worker s'en charge.
    if (data?.id) void enqueueTranslations('room', data.id, payload);
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
      .select('market, gerant_id, img, images')
      .eq('id', parsedParams.data.id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!existingRoom) return res.status(404).json({ error: 'Chambre introuvable' });
    if (existingRoom.gerant_id !== gerantInfo.userId) {
      return res.status(403).json({ error: 'Cette chambre ne vous appartient pas' });
    }

    // CORRECTIF : on interdit la modification de `id`, `gerant_id` et `market`
    // via PUT. Transférer la propriété ou le marché d'une chambre existante
    // doit passer par un flux dédié (pas un PUT générique).
    const {
      id: _ignoredId,
      gerant_id: _ignoredGerantId,
      market: _ignoredMarket,
      ...patch
    } = parsedBody.data as Record<string, unknown>;
    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: 'Données de chambre invalides' });
    }

    // Les images historiques déjà enregistrées peuvent être renvoyées telles
    // quelles (le formulaire les réutilise), mais aucune **nouvelle** URL
    // hors stockage plateforme ne peut être injectée par ce chemin : sinon le
    // contrôle de pertinence serait contournable en modifiant l'annonce.
    const submittedImages: string[] = [
      ...(Array.isArray(patch.images) ? (patch.images as string[]) : []),
      ...(typeof patch.img === 'string' ? [patch.img as string] : []),
    ];
    if (submittedImages.length > 0) {
      const room = existingRoom as { img?: unknown; images?: unknown };
      const alreadyStored = new Set<string>(
        [room.img, ...(Array.isArray(room.images) ? room.images : [])].filter(
          (url): url is string => typeof url === 'string',
        ),
      );
      const rejected = submittedImages.filter(
        (url) => !isPlatformImageUrl(url) && !alreadyStored.has(url),
      );
      if (rejected.length > 0) {
        return res.status(400).json({
          error:
            "URL d'image invalide : seules les photos téléversées dans le stockage de la plateforme sont acceptées",
        });
      }
    }

    const { data, error } = await supabaseAdmin
      .from('rooms')
      .update(patch)
      .eq('id', parsedParams.data.id)
      .select(ROOM_COLUMNS)
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Chambre introuvable' });
    void enqueueTranslations('room', data.id, data as Record<string, unknown>);
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
      .select(ROOM_COLUMNS)
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Chambre introuvable' });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

export default router;
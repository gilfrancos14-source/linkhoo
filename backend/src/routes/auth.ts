import { Router, Request, Response, NextFunction } from 'express';
import { createClerkClient } from '@clerk/backend';
import { supabaseAdmin } from '../config/supabase';
import { bootstrapSchema, type AuthRole } from '../validations/auth';
import { emailSchema } from '../validations/common';
import { phoneMatchesMarket } from '../utils/phoneMarket';
import { countryOfIp, type GeoResult } from '../utils/geoIp';

const router = Router();

/**
 * Contrôle géographique au bootstrap d'un compte gérant.
 *
 * L'IP vient de `req.ip` (fiable en production si TRUST_PROXY est configuré).
 * Quand le pays ne peut pas être résolu (localhost, VPN, service geoIP
 * indisponible), on autorise et on journalise : un contrôle de sécurité ne
 * doit jamais reposer sur une information incertaine.
 *
 * @returns `allowed: false` si la réponse 403 a été envoyée ; `geo` est le
 *   résultat résolu, conservé pour être stocké une fois pour toutes sur le
 *   profil (l'admin le lit ensuite sans nouvel appel réseau).
 */
async function gerantCountryAllowed(
  req: Request,
  res: Response,
  market: string,
): Promise<{ allowed: boolean; geo: GeoResult | null }> {
  const ip = req.ip ?? null;
  const geo = await countryOfIp(ip);

  if (!geo) {
    console.warn(`[geo] Contrôle ignoré : pays inconnu pour ${ip ?? 'IP absente'} (marché ${market}).`);
    return { allowed: true, geo: null };
  }

  if (geo.countryCode.toUpperCase() !== market.toUpperCase()) {
    console.warn(
      `[geo] Accès refusé : IP ${ip ?? '?'} localisée en ${geo.countryCode} alors que le marché est ${market}.`,
    );
    res.status(403).json({
      error: `Accès refusé : votre position (${geo.country}) ne correspond pas au marché ${market}. Connectez-vous depuis le pays de votre marché.`,
      code: 'GERANT_COUNTRY_MARKET_MISMATCH',
      country: geo.countryCode,
      market,
    });
    return { allowed: false, geo };
  }

  return { allowed: true, geo };
}

function getClerkClient() {
  return createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
}

async function getExistingRole(clerkUserId: string): Promise<AuthRole | null> {
  const [{ data: client }, { data: gerant }] = await Promise.all([
    supabaseAdmin.from('clients').select('id').eq('clerk_user_id', clerkUserId).maybeSingle(),
    supabaseAdmin.from('gerants').select('id').eq('clerk_user_id', clerkUserId).maybeSingle(),
  ]);

  if (client) return 'client';
  if (gerant) return 'gerant';
  return null;
}

async function resolveClerkIdentity(userId: string) {
  const clerk = getClerkClient();
  const user = await clerk.users.getUser(userId);

  const email =
    user.primaryEmailAddress?.emailAddress ||
    user.emailAddresses?.[0]?.emailAddress ||
    '';
  if (!email) {
    throw Object.assign(new Error('Adresse email manquante sur le compte Clerk'), { status: 400 });
  }

  const phone = user.phoneNumbers?.find((p) => p.phoneNumber)?.phoneNumber ?? null;

  return {
    clerk,
    user,
    email: emailSchema.parse(email),
    nom: user.lastName || '',
    prenom: user.firstName || '',
    phone,
  };
}

async function setClerkRole(
  clerk: ReturnType<typeof getClerkClient>,
  userId: string,
  role: AuthRole,
) {
  const user = await clerk.users.getUser(userId);
  const publicMetadata = {
    ...(user.publicMetadata as Record<string, unknown>),
    role,
  };
  await clerk.users.updateUser(userId, { publicMetadata });
}

router.get('/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authUserId = req.auth?.userId;
    if (!authUserId) {
      return res.status(401).json({ error: 'Non autorisé' });
    }

    const role = await getExistingRole(authUserId);
    let clerkRole: string | null = null;
    try {
      const identity = await resolveClerkIdentity(authUserId);
      const meta = (identity.user.publicMetadata || {}) as { role?: string };
      clerkRole = meta.role === 'client' || meta.role === 'gerant' ? meta.role : null;
    } catch {
      clerkRole = null;
    }

    res.json({
      role: role || clerkRole,
      profile_role: role,
      clerk_role: clerkRole,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/bootstrap', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = bootstrapSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Données invalides', details: parsed.error.flatten() });
    }

    const authUserId = req.auth?.userId;
    if (!authUserId) {
      return res.status(401).json({ error: 'Non autorisé' });
    }

    const requestedRole = parsed.data.role;
    const market = parsed.data.market;
    const existingRole = await getExistingRole(authUserId);

    if (existingRole && existingRole !== requestedRole) {
      return res.status(409).json({
        error: `Compte déjà enregistré comme ${existingRole}`,
        role: existingRole,
      });
    }

    const identity = await resolveClerkIdentity(authUserId);

    if (requestedRole === 'client') {
      // Un compte client est rattaché à UN marché, comme un compte gérant.
      if (!market) {
        return res.status(400).json({ error: 'market est requis pour un compte client' });
      }

      const { data: existing } = await supabaseAdmin
        .from('clients')
        .select('id, market')
        .eq('clerk_user_id', authUserId)
        .maybeSingle();

      if (existing && existing.market !== market) {
        // Le front redirige vers l'espace client du marché réel du compte.
        return res.status(409).json({
          error: `Compte client déjà enregistré sur le marché ${existing.market}`,
          role: 'client',
          market: existing.market,
        });
      }

      if (!existing) {
        const { error } = await supabaseAdmin.from('clients').insert({
          clerk_user_id: authUserId,
          email: identity.email,
          nom: identity.nom,
          prenom: identity.prenom,
          market,
        });
        if (error) throw error;
      }

      await setClerkRole(identity.clerk, authUserId, 'client');
      return res.status(existingRole ? 200 : 201).json({
        role: 'client',
        profile_role: 'client',
        clerk_role: 'client',
        market: existing?.market ?? market,
      });
    }

    if (!market) {
      return res.status(400).json({ error: 'market est requis pour un compte gérant' });
    }

    const { data: existing } = await supabaseAdmin
      .from('gerants')
      .select('id, market')
      .eq('clerk_user_id', authUserId)
      .maybeSingle();

    if (!existing) {
      // Nouvelle inscription : le gérant DOIT fournir un numéro cohérent avec
      // son marché — premier signal qu'il est bien présent dans ce pays
      // (contrôle renforcé ensuite par la vérification KYC/admin).
      // Source de vérité : numéro du compte Clerk ; repli sur le body.
      const phone = (identity.phone ?? parsed.data.phone ?? '').trim();
      if (!phone) {
        return res.status(400).json({
          error: 'Un numéro de téléphone est requis pour un compte gérant',
          code: 'GERANT_PHONE_REQUIRED',
        });
      }
      if (!phoneMatchesMarket(phone, market)) {
        return res.status(403).json({
          error: `Ce numéro de téléphone ne correspond pas au marché ${market}. Utilisez un numéro de ce pays.`,
          code: 'GERANT_PHONE_MARKET_MISMATCH',
        });
      }

      // Le pays de l'IP doit correspondre au marché déclaré (nouvelle inscription).
      // Le résultat est persisté ici : l'administration n'aura aucun appel
      // geoIP à faire lors de l'affichage de la liste des gérants.
      const countryCheck = await gerantCountryAllowed(req, res, market);
      if (!countryCheck.allowed) return;

      const { error } = await supabaseAdmin.from('gerants').insert({
        clerk_user_id: authUserId,
        email: identity.email,
        nom: identity.nom,
        prenom: identity.prenom,
        market,
        phone,
        signup_ip: req.ip ?? null,
        signup_country: countryCheck.geo?.countryCode ?? null,
        signup_country_name: countryCheck.geo?.country ?? null,
      });
      if (error) throw error;
    } else if (existing.market !== market) {
      // Un gérant est rattaché à UN seul marché à la fois. Si l'URL demande
      // un marché différent de celui du profil, on renvoie 409 avec le marché
      // réel pour que le front redirige vers l'espace gérant du bon marché.
      return res.status(409).json({
        error: `Compte gérant déjà enregistré sur le marché ${existing.market}`,
        role: 'gerant',
        market: existing.market,
      });
    } else {
      // Gérant existant : on compare au marché du profil (source de vérité),
      // pas seulement à celui de l'URL.
      if (!(await gerantCountryAllowed(req, res, existing.market)).allowed) return;
    }

    await setClerkRole(identity.clerk, authUserId, 'gerant');
    return res.status(existingRole ? 200 : 201).json({
      role: 'gerant',
      profile_role: 'gerant',
      clerk_role: 'gerant',
      market: existing?.market ?? market,
    });
  } catch (err: any) {
    if (err?.status) {
      return res.status(err.status).json({ error: err.message });
    }
    next(err);
  }
});

export default router;

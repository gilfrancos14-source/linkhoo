import { Router, Request, Response, NextFunction } from 'express';
import { createClerkClient } from '@clerk/backend';
import { supabaseAdmin } from '../config/supabase';
import { bootstrapSchema, type AuthRole } from '../validations/auth';
import { emailSchema } from '../validations/common';

const router = Router();

function getClerkClient() {
  return createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
}

async function getExistingRole(clerkUserId: string): Promise<AuthRole | null> {
  const [{ data: client }, { data: gerant }] = await Promise.all([
    supabaseAdmin.from('clients').select('id').eq('clerk_user_id', clerkUserId).maybeSingle(),
    supabaseAdmin.from('gerants').select('id').eq('clerk_user_id', clerkUserId).maybeSingle(),
  ]);

  if (client && gerant) return 'client';
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

  return {
    clerk,
    user,
    email: emailSchema.parse(email),
    nom: user.lastName || '',
    prenom: user.firstName || '',
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
      const { data: existing } = await supabaseAdmin
        .from('clients')
        .select('id')
        .eq('clerk_user_id', authUserId)
        .maybeSingle();

      if (!existing) {
        const { error } = await supabaseAdmin.from('clients').insert({
          clerk_user_id: authUserId,
          email: identity.email,
          nom: identity.nom,
          prenom: identity.prenom,
        });
        if (error) throw error;
      }

      await setClerkRole(identity.clerk, authUserId, 'client');
      return res.status(existingRole ? 200 : 201).json({
        role: 'client',
        profile_role: 'client',
        clerk_role: 'client',
      });
    }

    if (!market) {
      return res.status(400).json({ error: 'market est requis pour un compte gérant' });
    }

    const { data: existing } = await supabaseAdmin
      .from('gerants')
      .select('id')
      .eq('clerk_user_id', authUserId)
      .maybeSingle();

    if (!existing) {
      const { error } = await supabaseAdmin.from('gerants').insert({
        clerk_user_id: authUserId,
        email: identity.email,
        nom: identity.nom,
        prenom: identity.prenom,
        market,
      });
      if (error) throw error;
    }

    await setClerkRole(identity.clerk, authUserId, 'gerant');
    return res.status(existingRole ? 200 : 201).json({
      role: 'gerant',
      profile_role: 'gerant',
      clerk_role: 'gerant',
    });
  } catch (err: any) {
    if (err?.status) {
      return res.status(err.status).json({ error: err.message });
    }
    next(err);
  }
});

export default router;

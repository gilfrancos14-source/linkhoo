import { supabaseAdmin } from '../config/supabase';
import { isQualifiedGerant } from './gerantQualification';

/**
 * Vrai si l'utilisateur appelant est un gérant **vérifié ET premium actif**.
 *
 * C'est la même porte pour toutes les routes de réservation (liste,
 * confirmation) : un gérant non qualifié n'en reçoit aucune ligne. La règle
 * sert aussi de condition de révélation de l'identité du client — voir
 * `maskClientIdentity`.
 *
 * Existe une fois ici et non dans `reservations.ts` : la route notifications
 * doit poser la même question, et une porte posée deux fois finit par diverger.
 */
export async function isQualifiedGerantUser(authUserId: string): Promise<boolean> {
  const { data: gerant } = await supabaseAdmin
    .from('gerants')
    .select('is_verified, is_premium, premium_expires_at')
    .eq('clerk_user_id', authUserId)
    .maybeSingle();
  return isQualifiedGerant(gerant);
}

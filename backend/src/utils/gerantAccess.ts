import { supabaseAdmin } from '../config/supabase';
import { isQualifiedGerant } from './gerantQualification';

/**
 * Vrai si l'utilisateur appelant est un gérant **vérifié**.
 *
 * C'est la même porte pour toutes les routes de réservation (liste,
 * confirmation) : un gérant non vérifié n'en reçoit aucune ligne. La règle
 * sert aussi de condition de révélation de l'identité du client — voir
 * `maskClientIdentity`.
 *
 * Le premium n'entre pas dans cette décision : un gérant vérifié y accède
 * qu'il soit abonné ou non.
 *
 * Existe une fois ici et non dans `reservations.ts` : la route notifications
 * doit poser la même question, et une porte posée deux fois finit par diverger.
 */
export async function isQualifiedGerantUser(authUserId: string): Promise<boolean> {
  const { data: gerant } = await supabaseAdmin
    .from('gerants')
    .select('is_verified')
    .eq('clerk_user_id', authUserId)
    .maybeSingle();
  return isQualifiedGerant(gerant);
}

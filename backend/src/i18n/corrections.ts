import { supabaseAdmin } from '../config/supabase';
import type { ContentLocale } from './translations';

/**
 * Enregistre une traduction corrigée (admin ou visiteur). Le statut `corrige`
 * empêche le worker de régénérer la valeur : la correction est définitive.
 */
export async function saveCorrection(
  entityType: string,
  entityId: string,
  locale: ContentLocale,
  field: string,
  value: string,
): Promise<void> {
  const { data: existing } = await (supabaseAdmin as any)
    .from('translations')
    .select('source_hash')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .eq('locale', locale)
    .eq('field', field)
    .maybeSingle();

  await (supabaseAdmin as any).from('translations').upsert({
    entity_type: entityType,
    entity_id: entityId,
    locale,
    field,
    value,
    status: 'corrige',
    source_hash: existing?.source_hash ?? '',
    updated_at: new Date().toISOString(),
  });

  // La correction retire l'annonce de la file « À revoir ».
  await (supabaseAdmin as any)
    .from('translation_jobs')
    .update({ status: 'done', updated_at: new Date().toISOString() })
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .eq('locale', locale)
    .eq('status', 'review');
}

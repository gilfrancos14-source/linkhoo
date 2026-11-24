import { createHash } from 'crypto';
import { supabaseAdmin } from '../config/supabase';
import { fieldsFor, PROTECTION_FIELDS, TRANSLATABLE_FIELDS } from './fields';

/**
 * Internationalisation des contenus de la base.
 *
 * Les colonnes d'origine restent en français : c'est la source et le fallback.
 * Les traductions OPUS-MT sont stockées dans `translations`, et les demandes
 * sont mises en file dans `translation_jobs` sans bloquer l'enregistrement.
 */

export type ContentLocale = 'fr' | 'en' | 'es';

export const TRANSLATION_LOCALES: readonly ContentLocale[] = ['en', 'es'];

export { TRANSLATABLE_FIELDS } from './fields';

/** Conservé pour compatibilité avec la phase 1. */
export const ROOM_TRANSLATABLE_FIELDS = TRANSLATABLE_FIELDS.room;

export type RoomTranslatableField = string;

export function resolveLocale(raw: unknown): ContentLocale {
  const value = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (value === 'en' || value === 'es') return value;
  return 'fr';
}

/** Empreinte du texte source : sert de cache pour ne jamais traduire deux fois la même phrase. */
export function sourceHash(fields: Record<string, unknown>, entityType = 'room'): string {
  const source = fieldsFor(entityType)
    .map((field) => String(fields[field] ?? ''))
    .join('\u0000');
  return createHash('sha256').update(source).digest('hex');
}

function pickFields(entityType: string, fields: Record<string, unknown>): Record<string, string> {
  const picked: Record<string, string> = {};
  for (const field of [...fieldsFor(entityType), ...PROTECTION_FIELDS]) {
    if (typeof fields[field] === 'string') picked[field] = fields[field] as string;
  }
  return picked;
}

/**
 * Remplace les champs traduisibles par leur version dans `locale`.
 * Les traductions manquantes restent en français (fallback), donc rien ne casse
 * pour les visiteurs francophones ni avant que le worker ait tourné.
 */
export async function attachTranslations<T extends { id?: unknown }>(
  rows: T[],
  entityType: string,
  locale: ContentLocale,
): Promise<T[]> {
  if (locale === 'fr' || rows.length === 0) return rows;

  const ids = rows
    .map((row) => row.id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
  if (ids.length === 0) return rows;

  type TranslationRow = { entity_id: string; field: string; value: string };
  let data: TranslationRow[] = [];
  try {
    const result = await supabaseAdmin
      .from('translations')
      .select('entity_id, field, value')
      .eq('entity_type', entityType)
      .eq('locale', locale)
      // Les traductions `review` sont des doutes détectés par l'aller-retour
      // FR→EN→FR : elles ne doivent jamais être servies publiquement. Tant
      // qu'elles ne sont pas corrigées, le FR d'origine reste affiché.
      .neq('status', 'review')
      .in('entity_id', ids);
    data = Array.isArray(result.data) ? (result.data as unknown as TranslationRow[]) : [];
  } catch (err) {
    console.error('[i18n] lecture des traductions impossible :', err);
    return rows;
  }
  if (data.length === 0) return rows;

  const byId = new Map<string, Record<string, string>>();
  for (const row of data) {
    if (!row?.entity_id || !row.field || typeof row.value !== 'string') continue;
    const fields = byId.get(row.entity_id) ?? {};
    fields[row.field] = row.value;
    byId.set(row.entity_id, fields);
  }

  return rows.map((row) => {
    const translated = byId.get(String(row.id));
    if (!translated) return row;
    const merged = { ...row } as Record<string, unknown>;
    for (const field of fieldsFor(entityType)) {
      if (translated[field]) merged[field] = translated[field];
    }
    return merged as T;
  });
}

/**
 * Enfile les traductions en anglais et en espagnol. Appelée sans `await`
 * depuis les routes : l'enregistrement répond immédiatement.
 */
export async function enqueueTranslations(
  entityType: string,
  entityId: string,
  fields: Record<string, unknown>,
): Promise<void> {
  const payload = pickFields(entityType, fields);
  if (fieldsFor(entityType).every((field) => typeof fields[field] !== 'string')) return;
  const hash = sourceHash(fields, entityType);

  for (const locale of TRANSLATION_LOCALES) {
    try {
      await supabaseAdmin.from('translation_jobs').insert({
        entity_type: entityType,
        entity_id: entityId,
        locale,
        payload,
        source_hash: hash,
      });
    } catch (err) {
      console.error('[i18n] file de traduction indisponible :', err);
    }
  }
}

/** Champs traduisibles et champs à protéger, par type de contenu. */

export const TRANSLATABLE_FIELDS: Readonly<Record<string, readonly string[]>> = {
  room: ['title', 'subtitle', 'info', 'description', 'conditions', 'capacity'],
  category: ['title', 'alt'],
  banner: ['alt'],
  event: ['title', 'description'],
  destination: ['title', 'description'],
  escapade: ['description'],
  review: ['commentaire'],
};

/** Noms propres et valeurs que le modèle ne doit pas reformuler. */
export const PROTECTION_FIELDS = ['ville', 'quartier', 'pays', 'city', 'lieu'] as const;

export function fieldsFor(entityType: string): readonly string[] {
  return TRANSLATABLE_FIELDS[entityType] ?? TRANSLATABLE_FIELDS.room;
}

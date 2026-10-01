// Ville côté events, côté rooms et côté tourisme : trois textes libres saisis
// à la main qui doivent comparer égaux. Normalisation : casse + accents, puis
// on retire espaces/tirets/ponctuation pour que « Bouaké » = « bouake »,
// « San-Pédro » = « sanpedro », « Tori Bossito » = « toribossito ».
// Accepte `unknown` : la valeur vient d'une colonne Supabase ou d'un query
// string, jamais d'un type garanti string.
export function normalizeCity(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

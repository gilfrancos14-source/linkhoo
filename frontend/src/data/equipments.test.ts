import { describe, expect, it } from 'vitest';
import { EQUIPMENT_CATEGORIES, EQUIPMENT_KEYS, RESTAURATION_KEYS } from './equipments';

describe('catalogue des équipements', () => {
  it('contient 30 clés uniques', () => {
    expect(EQUIPMENT_KEYS).toHaveLength(30);
    expect(new Set(EQUIPMENT_KEYS).size).toBe(30);
  });

  it('répartit tous les équipements dans exactement une catégorie', () => {
    const grouped = EQUIPMENT_CATEGORIES.flatMap((category) => category.items);
    expect(grouped).toHaveLength(EQUIPMENT_KEYS.length);
    expect(new Set(grouped).size).toBe(EQUIPMENT_KEYS.length);
    expect([...grouped].sort()).toEqual([...EQUIPMENT_KEYS].sort());
  });

  it('propose cinq options de restauration dont aucune par défaut', () => {
    expect(RESTAURATION_KEYS).toEqual([
      'aucune',
      'petit_dejeuner_inclus',
      'petit_dejeuner_option',
      'repas_sur_demande',
      'restaurant',
    ]);
  });
});

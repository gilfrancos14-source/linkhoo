import { beforeEach, describe, expect, it, vi } from 'vitest';
import { supabaseAdmin } from '../config/supabase';
import { fakeChain, useSupabaseTables } from '../testHelpers/supertestApp';
import {
  attachTranslations,
  enqueueTranslations,
  resolveLocale,
  sourceHash,
} from './translations';

vi.mock('../config/supabase', async () => {
  const helper = await import('../testHelpers/supertestApp');
  return helper.createSupabaseMock();
});

beforeEach(() => {
  vi.clearAllMocks();
  useSupabaseTables(supabaseAdmin.from, {});
});

describe('resolveLocale', () => {
  it('ne renvoie que fr, en ou es', () => {
    expect(resolveLocale('en')).toBe('en');
    expect(resolveLocale('ES')).toBe('es');
    expect(resolveLocale('fr')).toBe('fr');
    expect(resolveLocale('de')).toBe('fr');
    expect(resolveLocale(undefined)).toBe('fr');
  });
});

describe('sourceHash', () => {
  it('donne la même empreinte pour le même texte', () => {
    const a = { title: 'Studio', description: 'Sympa' };
    const b = { title: 'Studio', description: 'Sympa', price_num: 100 };
    expect(sourceHash(a)).toBe(sourceHash(b));
  });

  it('change quand le texte change', () => {
    expect(sourceHash({ title: 'Studio' })).not.toBe(sourceHash({ title: 'Villa' }));
  });
});

describe('attachTranslations', () => {
  const rows = [
    { id: 'r1', title: 'Studio Français', description: 'Description FR' },
    { id: 'r2', title: 'Villa Française', description: 'Autre description' },
  ];

  it('ne fait aucune requête en français', async () => {
    await expect(attachTranslations(rows, 'room', 'fr')).resolves.toBe(rows);
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });

  it('remplace les champs traduits et garde le français manquant', async () => {
    useSupabaseTables(supabaseAdmin.from, {
      translations: fakeChain({
        data: [
          { entity_id: 'r1', field: 'title', value: 'English Studio' },
          { entity_id: 'r1', field: 'description', value: 'Nice place' },
        ],
        error: null,
      }),
    });

    const result = await attachTranslations(rows, 'room', 'en');

    expect(result[0]).toMatchObject({ title: 'English Studio', description: 'Nice place' });
    expect(result[1]).toMatchObject({ title: 'Villa Française', description: 'Autre description' });
    expect(supabaseAdmin.from).toHaveBeenCalledWith('translations');
  });
});

describe('enqueueTranslations', () => {
  it('crée un job par langue cible', async () => {
    await enqueueTranslations('room', 'r1', { title: 'Studio', price_num: 100 });

    expect(supabaseAdmin.from).toHaveBeenCalledWith('translation_jobs');
    const inserts = vi
      .mocked(supabaseAdmin.from)
      .mock.results.map((r) => r.value)
      .filter(Boolean);
    expect(inserts.length).toBeGreaterThan(0);
  });
});

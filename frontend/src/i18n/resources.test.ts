import { describe, expect, it } from 'vitest';
import en from './resources/en.json';
import es from './resources/es.json';
import fr from './resources/fr.json';

function flatten(value: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(value).flatMap(([key, child]) =>
    child && typeof child === 'object'
      ? flatten(child as Record<string, unknown>, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}

const locales = { fr, en, es };

describe('ressources i18n', () => {
  it('ont exactement les mêmes clés dans les trois langues', () => {
    const reference = new Set(flatten(fr));
    for (const [locale, resources] of Object.entries(locales)) {
      const keys = new Set(flatten(resources));
      expect([...keys].filter((key) => !reference.has(key)), `clés en trop en ${locale}`).toEqual([]);
      expect([...reference].filter((key) => !keys.has(key)), `clés manquantes en ${locale}`).toEqual([]);
    }
  });

  it('couvre les libellés de la phase 2', () => {
    for (const key of [
      'landing.header.bannerAlt',
      'landing.header.bannerAria',
      'landing.header.slidesAria',
      'landing.header.slideAria',
      'metadata.title',
      'metadata.description',
      'pwa.settings',
      'pwa.pushDescription',
      'pwa.attempt_other',
      'pwa.items_other',
      'landing.localRooms.title',
      'landing.localRooms.viewAll',
      'landing.neighborRooms.title',
      'landing.neighborRooms.viewAll',
      'landing.weekendRooms.title',
      'landing.weekendRooms.showAll',
      'partnerAds.aria',
      'partnerAds.defaultAlt',
      'partnerAds.slide1',
      'equipments.title',
      'equipments.items.wifi',
      'equipments.categories.confort',
      'equipments.restauration.aucune',
      'roomDetailHero.share',
      'roomDetailHero.allPhotos',
      'roomDetailHero.allFees',
      'roomDetailSection2.reserve',
      'roomDetailSection2.noCharge',
      'roomDetailSection2.responseRate',
      'roomDetailSection2.lastName',
      'roomDetailSection2.firstName',
      'roomDetailSection2.phone',
      'roomDetailReviews.title',
      'roomDetailReviews.showAll',
      'api.timeout',
      'api.newsletterInvalidEmail',
      'markets.CI',
      'markets.CD',
      'country.inFeminine',
      'country.ofMasculine',
      'country.sentenceFeminine',
    ]) {
      for (const [locale, resources] of Object.entries(locales)) {
        const value = key
          .split('.')
          .reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], resources);
        expect(typeof value, `${key} manquante en ${locale}`).toBe('string');
      }
    }
  });
});

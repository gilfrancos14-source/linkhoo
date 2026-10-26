import { describe, expect, it } from 'vitest';
import type {
  BannerData,
  DestinationData,
  EscapadeData,
  EventData,
  FeaturedReviewData,
  RoomData,
} from '../lib/api';
import {
  buildBanners,
  buildCategoryCards,
  buildEscapades,
  buildEvents,
  buildPopularCards,
  buildPromos,
  buildReviews,
  buildTourism,
} from './viewModel';

function makeRoom(overrides: Partial<RoomData> = {}): RoomData {
  return {
    id: 'room-1',
    title: 'Appartement Cocody',
    subtitle: 'Calme et lumineux',
    info: '',
    price: '25000',
    price_num: 25000,
    price_unit: '/nuit',
    img: '/images/room.jpg',
    alt: '',
    images: [],
    description: 'Un appartement confortable.',
    category: 'appartements',
    market: 'CI',
    pays: "Côte d'Ivoire",
    ville: 'Abidjan',
    quartier: 'Cocody',
    chambres: 2,
    douches: 1,
    disponible: true,
    date_dispo: '2026-10-01',
    conditions: '',
    ...overrides,
  };
}

function makeEvent(overrides: Partial<EventData> = {}): EventData {
  return {
    id: 'event-1',
    market: 'CI',
    city: 'Abidjan',
    title: 'Festival',
    description: 'Un festival de musique.',
    event_date: '2026-10-20',
    img: '/images/event.jpg',
    alt: null,
    ...overrides,
  };
}

function makeDestination(overrides: Partial<DestinationData> = {}): DestinationData {
  return {
    id: 'dest-1',
    market: 'CI',
    city: 'Abidjan',
    title: 'Le Plateau',
    description: 'Balade au centre-ville.',
    img: '/images/destination.jpg',
    alt: null,
    featured: true,
    ...overrides,
  };
}

function makeReview(overrides: Partial<FeaturedReviewData> = {}): FeaturedReviewData {
  return {
    id: 'review-1',
    client_name: 'Awa Koné',
    note_appartement: 4.6,
    commentaire: 'Très bon séjour.',
    created_at: '2026-10-01T10:00:00.000Z',
    room: { title: 'Appartement', ville: 'Abidjan', market: 'CI' },
    room_avg: 4.5,
    ...overrides,
  };
}

function makeBanner(overrides: Partial<BannerData> = {}): BannerData {
  return {
    id: 'banner-1',
    section: 'popular',
    img: '/images/banner.jpg',
    alt: 'Bannière',
    link: '/ci',
    market: 'CI',
    order: 0,
    ...overrides,
  };
}

describe('buildBanners', () => {
  it('renvoie des listes vides quand les bannières sont absentes', () => {
    expect(buildBanners(null)).toEqual({
      popular: [],
      promos: [],
      categories: [],
      events: [],
    });
  });

  it('répartit les bannières par section et conserve l’ordre admin', () => {
    const banners = buildBanners([
      makeBanner({ id: 'b2', section: 'categories', order: 2 }),
      makeBanner({ id: 'b1', section: 'categories', order: 1, alt: '' }),
      makeBanner({ id: 'b3', section: 'events', img: '/images/event.jpg' }),
    ]);

    expect(banners.categories.map((banner) => banner.id)).toEqual(['b1', 'b2']);
    expect(banners.categories[0].alt).toBe('Bannière promotionnelle');
    expect(banners.events).toHaveLength(1);
    expect(banners.popular).toEqual([]);
    expect(banners.promos).toEqual([]);
  });

  it('ignore une section inconnue', () => {
    const banners = buildBanners([
      makeBanner({ id: 'b1', section: 'inconnue' }),
      makeBanner({ id: 'b2', section: 'popular' }),
    ]);

    expect(banners.popular.map((banner) => banner.id)).toEqual(['b2']);
  });
});

describe('buildPopularCards', () => {
  it('limite à cinq cartes et dérive lieu, équipements et prix', () => {
    const rooms = Array.from({ length: 7 }, (_, index) =>
      makeRoom({ id: `room-${index}`, chambres: 1, douches: 0 }),
    );

    const cards = buildPopularCards(rooms);

    expect(cards).toHaveLength(5);
    expect(cards[0]).toMatchObject({
      location: 'Abidjan - Cocody',
      price: '25 000 FCFA',
      unit: '/nuit',
      meta: [{ icon: 'fa-bed', label: '1 chambre' }],
    });
  });
});

describe('buildPromos', () => {
  it('garde les trois cartes et ne remplit que les promotions actives', () => {
    const now = new Date('2026-10-22T12:00:00');
    const rooms = [
      makeRoom({ id: 'promo-15', promo_group: 'promo_15', promo_end: '2026-10-31' }),
      makeRoom({ id: 'promo-10', promo_group: 'promo_10', promo_end: '2026-10-31' }),
      makeRoom({ id: 'expired', promo_group: 'promo_5', promo_end: '2026-10-01' }),
    ];

    const cards = buildPromos(rooms, now);

    expect(cards.map((card) => card.key)).toEqual(['promo_15', 'promo_10', 'promo_5']);
    const family = cards.find((card) => card.key === 'promo_10');
    expect(family?.featureTitle).toBe('Escapades en famille');
    expect(family?.rooms.map((room) => room.id)).toEqual(['promo-10']);
    expect(cards.find((card) => card.key === 'promo_5')?.rooms).toEqual([]);
  });

  it('conserve les trois cartes sans promotion active', () => {
    const cards = buildPromos([makeRoom()]);
    expect(cards).toHaveLength(3);
    expect(cards.every((card) => card.rooms.length === 0 && card.image === '')).toBe(true);
    expect(buildPromos(null)).toHaveLength(3);
  });
});

describe('buildEvents', () => {
  it('regroupe par ville et trie les événements à la une', () => {
    const result = buildEvents([
      makeEvent({ id: 'late', event_date: '2026-12-05', city: 'Bouaké', title: 'Concert' }),
      makeEvent({ id: 'soon', event_date: '2026-10-25', city: 'Abidjan', title: 'Festival' }),
    ]);

    expect(result.cities.map((city) => city.city)).toEqual(['Bouaké', 'Abidjan']);
    expect(result.featured?.id).toBe('soon');
    expect(result.featuredEvents.map((event) => event.id)).toEqual(['soon', 'late']);
  });

  it('renvoie un résultat vide sans événement', () => {
    expect(buildEvents([]).featuredEvents).toEqual([]);
  });
});

describe('buildTourism', () => {
  it('met les grandes cartes dans la carte longue et les petites dans la grille', () => {
    const result = buildTourism(
      {
        big: [makeDestination({ id: 'big', city: 'Abidjan' })],
        small: [makeDestination({ id: 'small', city: 'Bouaké', title: 'Bouaké' })],
      },
      [makeRoom({ ville: 'Abidjan' }), makeRoom({ id: 'room-2', ville: 'Abidjan' })],
    );

    expect(result?.bannerImage).toBe('/images/destination.jpg');
    expect(result?.longCards).toEqual([
      expect.objectContaining({ id: 'big', city: 'Abidjan', count: 2 }),
    ]);
    expect(result?.minis).toEqual([
      expect.objectContaining({ id: 'small', city: 'Bouaké', count: 0 }),
    ]);
  });

  it('garde les deux grandes cartes dans la carte longue, sans les mélanger aux petites', () => {
    const result = buildTourism(
      {
        big: [
          makeDestination({ id: 'big-1', city: 'Abidjan', title: 'Abidjan' }),
          makeDestination({ id: 'big-2', city: 'Bouaké', title: 'Bouaké' }),
        ],
        small: [
          makeDestination({ id: 'small-1', city: 'Assinie', title: 'Assinie' }),
          makeDestination({ id: 'small-2', city: 'Korhogo', title: 'Korhogo' }),
        ],
      },
      [],
    );

    expect(result?.longCards.map((card) => card.id)).toEqual(['big-1', 'big-2']);
    expect(result?.minis.map((card) => card.id)).toEqual(['small-1', 'small-2']);
  });

  it('sans grande carte, la première petite occupe la carte longue', () => {
    const result = buildTourism(
      {
        big: [],
        small: [
          makeDestination({ id: 'small-1', city: 'Assinie', title: 'Assinie' }),
          makeDestination({ id: 'small-2', city: 'Korhogo', title: 'Korhogo' }),
          makeDestination({ id: 'small-3', city: 'San-Pédro', title: 'San-Pédro' }),
        ],
      },
      [],
    );

    expect(result?.longCards.map((card) => card.id)).toEqual(['small-1']);
    expect(result?.bannerImage).toBe('/images/destination.jpg');
    expect(result?.minis.map((card) => card.id)).toEqual(['small-2', 'small-3']);
  });

  it('masque la section quand la partition est vide', () => {
    expect(buildTourism({ big: [], small: [] }, [])).toBeNull();
    expect(buildTourism(null, [])).toBeNull();
  });
});

describe('buildCategoryCards', () => {
  it('compte les biens par catégorie', () => {
    const categories = [
      {
        id: 'appartements',
        title: 'Appartements',
        img: '/images/cat.jpg',
        alt: '',
        market: 'CI' as const,
      },
    ];
    const rooms = [makeRoom(), makeRoom({ id: 'room-2' })];

    expect(buildCategoryCards(categories, rooms)).toEqual([
      {
        id: 'appartements',
        title: 'Appartements',
        image: '/images/cat.jpg',
        alt: 'Appartements',
        count: 2,
      },
    ]);
  });
});

describe('buildEscapades', () => {
  it('filtre les escapades sans image et limite à quatre', () => {
    const escapades: EscapadeData[] = [
      { id: '1', market: 'CI', lieu: 'Assinie', description: 'Plage', images: ['/images/a.jpg'] },
      { id: '2', market: 'CI', lieu: 'Sans image', description: 'Vide', images: [] },
      ...Array.from({ length: 5 }, (_, index) => ({
        id: `extra-${index}`,
        market: 'CI' as const,
        lieu: `Lieu ${index}`,
        description: 'Description',
        images: ['/images/extra.jpg'],
      })),
    ];

    expect(buildEscapades(escapades)).toHaveLength(4);
    expect(buildEscapades(escapades)[0]).toMatchObject({
      lieu: 'Assinie',
      cover: '/images/a.jpg',
    });
  });
});

describe('buildReviews', () => {
  it('filtre par marché, arrondit les notes et dérive les initiales', () => {
    const reviews = buildReviews(
      [
        makeReview(),
        makeReview({
          id: 'other-market',
          client_name: 'Koffi Yao',
          room: { title: null, ville: null, market: 'BJ' },
        }),
        makeReview({ id: 'review-2', note_appartement: 3.6 }),
      ],
      'CI',
    );

    expect(reviews).toHaveLength(2);
    expect(reviews[0]).toMatchObject({ initials: 'AK', rating: 5, city: 'Abidjan' });
    expect(reviews[1].rating).toBe(4);
  });
});

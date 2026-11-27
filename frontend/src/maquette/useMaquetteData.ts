import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MarketCode } from '../config/markets';
import type { BannerData, TourismPartition } from '../lib/api';
import {
  EMPTY_MAQUETTE_DATA,
  maquetteApi,
  type MaquetteBannerSection,
  type MaquetteData,
} from './maquetteApi';

const BANNER_SECTIONS: MaquetteBannerSection[] = ['popular', 'promos', 'categories', 'events'];

function asList<T>(value: T[]): T[] {
  return Array.isArray(value) ? value : [];
}

function isBannerSection(value: unknown): value is MaquetteBannerSection {
  return typeof value === 'string' && BANNER_SECTIONS.includes(value as MaquetteBannerSection);
}

function asBanners(value: BannerData[]): BannerData[] {
  return asList(value).filter(
    (banner) =>
      banner &&
      typeof banner.id === 'string' &&
      typeof banner.img === 'string' &&
      banner.img.length > 0 &&
      isBannerSection(banner.section),
  );
}

function asTourism(value: TourismPartition): TourismPartition {
  if (!value || !Array.isArray(value.big) || !Array.isArray(value.small)) {
    return { big: [], small: [] };
  }
  return value;
}

export function useMaquetteData(market: MarketCode): MaquetteData {
  const { i18n } = useTranslation();
  // `withLang()` inclut la langue dans l'URL (donc dans la clé de cache) : en
  // relançant l'effet à chaque changement de langue, on recharge les contenus
  // de la base sans rechargement de page.
  const language = i18n.language.split('-')[0];
  const [data, setData] = useState<MaquetteData>(EMPTY_MAQUETTE_DATA);

  useEffect(() => {
    let alive = true;
    setData(EMPTY_MAQUETTE_DATA);

    maquetteApi
      .banners(market)
      .then((items) => {
        if (alive) setData((current) => ({ ...current, banners: asBanners(items) }));
      })
      .catch(() => {
        if (alive) setData((current) => ({ ...current, banners: [] }));
      });

    maquetteApi
      .popular(market)
      .then((items) => {
        if (alive) setData((current) => ({ ...current, popular: asList(items) }));
      })
      .catch(() => {
        if (alive) setData((current) => ({ ...current, popular: [] }));
      });

    maquetteApi
      .rooms(market)
      .then((items) => {
        if (alive) setData((current) => ({ ...current, rooms: asList(items) }));
      })
      .catch(() => {
        if (alive) setData((current) => ({ ...current, rooms: [] }));
      });

    maquetteApi
      .categories(market)
      .then((items) => {
        if (alive) setData((current) => ({ ...current, categories: asList(items) }));
      })
      .catch(() => {
        if (alive) setData((current) => ({ ...current, categories: [] }));
      });

    maquetteApi
      .events(market)
      .then((items) => {
        if (alive) setData((current) => ({ ...current, events: asList(items) }));
      })
      .catch(() => {
        if (alive) setData((current) => ({ ...current, events: [] }));
      });

    maquetteApi
      .tourism(market)
      .then((items) => {
        if (alive) setData((current) => ({ ...current, tourism: asTourism(items) }));
      })
      .catch(() => {
        if (alive) setData((current) => ({ ...current, tourism: { big: [], small: [] } }));
      });

    maquetteApi
      .escapades(market)
      .then((items) => {
        if (alive) setData((current) => ({ ...current, escapades: asList(items) }));
      })
      .catch(() => {
        if (alive) setData((current) => ({ ...current, escapades: [] }));
      });

    maquetteApi
      .reviews()
      .then((items) => {
        if (alive) setData((current) => ({ ...current, reviews: asList(items) }));
      })
      .catch(() => {
        if (alive) setData((current) => ({ ...current, reviews: [] }));
      });

    return () => {
      alive = false;
    };
  }, [market, language]);

  return data;
}

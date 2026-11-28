import type { Room } from '../../../data/rooms';

/** Types de pièces que le gérant peut associer à une photo. */
export const ROOM_IMAGE_LABELS = [
  'chambre',
  'salon',
  'douche',
  'cuisine',
  'cour',
] as const;

export type RoomImageLabel = (typeof ROOM_IMAGE_LABELS)[number];

export const ROOM_IMAGE_LABEL_TEXT: Record<RoomImageLabel, string> = {
  chambre: 'Chambre',
  salon: 'Salon',
  douche: 'Douche',
  cuisine: 'Cuisine',
  cour: 'Cour',
};

export interface PhotoItem {
  /** Fichier choisi par le gérant (absent pour une photo déjà en ligne). */
  file?: File;
  /** Source affichable : URL distante ou `blob:` d'un fichier local. */
  preview: string;
  /** URL d'une photo déjà enregistrée (mode modification). */
  url?: string;
  /** Type de pièce déclaré par le gérant pour cette photo. */
  label?: RoomImageLabel;
}

/** Nombre maximum de photos par appartement. */
export const MAX_PHOTOS = 5;

export interface FormData {
  title: string;
  description: string;
  ville: string;
  quartier: string;
  /** Lien de partage Google Maps du logement (facultatif). */
  mapsUrl: string;
  priceNum: number;
  priceUnit: '/ mois' | '/ nuit';
  conditions: string;
  chambres: number;
  douches: number;
  category: string;
  isPopular: boolean;
  /** Clés des équipements cochés (catalogue EQUIPMENT_KEYS). */
  equipments: string[];
  /** Service de restauration (catalogue RESTAURATION_KEYS). */
  restauration: string;
  /** Réduction appliquée par le gérant (promo_15 / promo_10 / promo_5). */
  promoGroup: string;
  promoStart: string;
  promoEnd: string;
  promoMinNights: number;
  promoMaxNights: number;
}

export const emptyForm: FormData = {
  title: '',
  description: '',
  ville: '',
  quartier: '',
  mapsUrl: '',
  priceNum: 0,
  priceUnit: '/ mois',
  conditions: '',
  chambres: 1,
  douches: 1,
  category: '',
  isPopular: false,
  equipments: [],
  restauration: 'aucune',
  promoGroup: '',
  promoStart: '',
  promoEnd: '',
  promoMinNights: 1,
  promoMaxNights: 30,
};

export const marketPays: Record<string, string> = {
  CI: 'Côte d\'Ivoire',
  BJ: 'Bénin',
};

export interface PreviewSnapshot {
  form: FormData;
  photos: PhotoItem[];
  mainPhotoIndex: number;
  categoryTitle: string;
}

/** Formulaire prérempli depuis une annonce existante. */
export function formFromRoom(room: Room): FormData {
  return {
    title: room.title,
    description: room.description,
    ville: room.ville,
    quartier: room.quartier,
    mapsUrl: room.mapsUrl ?? '',
    priceNum: room.priceNum,
    priceUnit: room.priceUnit === '/ nuit' ? '/ nuit' : '/ mois',
    conditions: room.conditions,
    chambres: room.chambres,
    douches: room.douches,
    category: room.category,
    isPopular: Boolean(room.isPopular),
    equipments: room.equipments ?? [],
    restauration: room.restauration ?? 'aucune',
    promoGroup: room.promoGroup ?? '',
    promoStart: room.promoStart ?? '',
    promoEnd: room.promoEnd ?? '',
    promoMinNights: room.promoMinNights ?? 1,
    promoMaxNights: room.promoMaxNights ?? 30,
  };
}

/**
 * Photos existantes d'une annonce, prêtes pour l'étape 3.
 *
 * L'image principale (`room.img`) passe en tête : elle retrouve ainsi son
 * rôle de photo principale dans le formulaire, même si `room.images` est
 * dans un autre ordre. Les entrées gardent leur URL (`url`) pour ne pas être
 * re-téléversées à l'enregistrement.
 */
export function photosFromRoom(room: Room): PhotoItem[] {
  const urls: string[] = [];
  if (room.img) urls.push(room.img);
  room.images.forEach((url) => {
    if (url && !urls.includes(url)) urls.push(url);
  });
  const labels = room.imageLabels ?? {};
  return urls.slice(0, MAX_PHOTOS).map((url) => {
    const stored = labels[url];
    const label = ROOM_IMAGE_LABELS.find((value) => value === stored);
    return { preview: url, url, ...(label ? { label } : {}) };
  });
}

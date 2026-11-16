import type { Room } from '../../../data/rooms';

export interface PhotoItem {
  /** Fichier choisi par le gérant (absent pour une photo déjà en ligne). */
  file?: File;
  /** Source affichable : URL distante ou `blob:` d'un fichier local. */
  preview: string;
  /** URL d'une photo déjà enregistrée (mode modification). */
  url?: string;
}

/** Nombre maximum de photos par appartement. */
export const MAX_PHOTOS = 3;

export interface FormData {
  title: string;
  description: string;
  ville: string;
  quartier: string;
  priceNum: number;
  priceUnit: '/ mois' | '/ nuit';
  conditions: string;
  chambres: number;
  douches: number;
  category: string;
  isPopular: boolean;
}

export const emptyForm: FormData = {
  title: '',
  description: '',
  ville: '',
  quartier: '',
  priceNum: 0,
  priceUnit: '/ mois',
  conditions: '',
  chambres: 1,
  douches: 1,
  category: '',
  isPopular: false,
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
    priceNum: room.priceNum,
    priceUnit: room.priceUnit === '/ nuit' ? '/ nuit' : '/ mois',
    conditions: room.conditions,
    chambres: room.chambres,
    douches: room.douches,
    category: room.category,
    isPopular: Boolean(room.isPopular),
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
  return urls.slice(0, MAX_PHOTOS).map((url) => ({ preview: url, url }));
}

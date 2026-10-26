export interface PhotoItem {
  file: File;
  preview: string;
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

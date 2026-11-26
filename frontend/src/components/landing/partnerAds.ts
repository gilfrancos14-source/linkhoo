/**
 * Configuration de l'espace publicitaire du hero.
 *
 * Pour publier une offre : déposer le visuel dans `frontend/public/ads/`
 * (jpg, png, webp, svg ou GIF animé) puis renseigner son chemin ci-dessous.
 * Le texte i18n sert de repli tant que le visuel est absent ou indisponible.
 */
export interface PartnerAd {
  /** Chemin public du visuel (gif animé inclus). Absent = texte de repli affiché. */
  readonly image?: string;
  /** Clé i18next du texte de repli ET du texte alternatif. */
  readonly textKey: string;
  /** Lien éventuel vers l'offre du partenaire. */
  readonly href?: string;
}

export const PARTNER_ADS: readonly PartnerAd[] = [
  { textKey: 'partnerAds.slide1' },
  { textKey: 'partnerAds.slide2' },
  { textKey: 'partnerAds.slide3' },
];

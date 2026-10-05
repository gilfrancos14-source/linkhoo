import type { ReactNode } from 'react';

// Drapeaux SVG partagés : sélecteur de marché (header), recherche de la
// page d'accueil et grille « Choisissez un Pays ».
// Les pays à venir sont des rendus simplifiés (bandes + étoile) — suffisants
// pour une carte désactivée « Bientôt ».

const STAR =
  'M12 3l2.47 5.01 5.53.8-4 3.9.94 5.5L12 15.6 7.06 18.2 8 12.74 8.8l5.53-.8z';

function Star({ x, y, size, fill }: { x: number; y: number; size: number; fill: string }) {
  const scale = size / 24;
  return (
    <path d={STAR} fill={fill} transform={`translate(${x - size / 2} ${y - size / 2}) scale(${scale})`} />
  );
}

function FlagFrame({ width, children }: { width: number; children: ReactNode }) {
  return (
    <svg viewBox="0 0 30 20" width={width} height={(width * 20) / 30} aria-hidden="true">
      {children}
    </svg>
  );
}

export function FlagCI({ width = 24 }: { width?: number }): ReactNode {
  return (
    <FlagFrame width={width}>
      <rect width="10" height="20" fill="#F77F00" />
      <rect x="10" width="10" height="20" fill="#FFFFFF" />
      <rect x="20" width="10" height="20" fill="#009E60" />
    </FlagFrame>
  );
}

export function FlagBJ({ width = 24 }: { width?: number }): ReactNode {
  return (
    <FlagFrame width={width}>
      <rect width="12" height="20" fill="#008751" />
      <rect x="12" width="18" height="10" fill="#FCD116" />
      <rect x="12" y="10" width="18" height="10" fill="#E8112D" />
    </FlagFrame>
  );
}

export function FlagSN({ width = 24 }: { width?: number }): ReactNode {
  return (
    <FlagFrame width={width}>
      <rect width="10" height="20" fill="#00853F" />
      <rect x="10" width="10" height="20" fill="#FDEF42" />
      <rect x="20" width="10" height="20" fill="#E31B23" />
      <Star x={15} y={10} size={9} fill="#00853F" />
    </FlagFrame>
  );
}

export function FlagML({ width = 24 }: { width?: number }): ReactNode {
  return (
    <FlagFrame width={width}>
      <rect width="10" height="20" fill="#14B53A" />
      <rect x="10" width="10" height="20" fill="#FCD116" />
      <rect x="20" width="10" height="20" fill="#CE1126" />
    </FlagFrame>
  );
}

export function FlagBF({ width = 24 }: { width?: number }): ReactNode {
  return (
    <FlagFrame width={width}>
      <rect width="30" height="10" fill="#EF2B2D" />
      <rect y="10" width="30" height="10" fill="#009E49" />
      <Star x={15} y={10} size={10} fill="#FCD116" />
    </FlagFrame>
  );
}

export function FlagTG({ width = 24 }: { width?: number }): ReactNode {
  return (
    <FlagFrame width={width}>
      <rect width="30" height="4" fill="#006A4E" />
      <rect y="4" width="30" height="4" fill="#FCD116" />
      <rect y="8" width="30" height="4" fill="#006A4E" />
      <rect y="12" width="30" height="4" fill="#FCD116" />
      <rect y="16" width="30" height="4" fill="#006A4E" />
      <rect width="12" height="12" fill="#CE1126" />
      <Star x={6} y={6} size={8} fill="#FFFFFF" />
    </FlagFrame>
  );
}

export function FlagCM({ width = 24 }: { width?: number }): ReactNode {
  return (
    <FlagFrame width={width}>
      <rect width="10" height="20" fill="#007A5E" />
      <rect x="10" width="10" height="20" fill="#CE1126" />
      <rect x="20" width="10" height="20" fill="#FCD116" />
      <Star x={15} y={10} size={9} fill="#FCD116" />
    </FlagFrame>
  );
}

// République du Congo : diagonale jaune entre le vert et le rouge.
export function FlagCG({ width = 24 }: { width?: number }): ReactNode {
  return (
    <FlagFrame width={width}>
      <rect width="30" height="20" fill="#009543" />
      <polygon points="0,20 30,0 30,6 9,20" fill="#FBDE4A" />
      <polygon points="9,20 30,6 30,20" fill="#DC241F" />
    </FlagFrame>
  );
}

export function FlagGA({ width = 24 }: { width?: number }): ReactNode {
  return (
    <FlagFrame width={width}>
      <rect width="30" height="6.67" fill="#009E60" />
      <rect y="6.67" width="30" height="6.66" fill="#FCD116" />
      <rect y="13.33" width="30" height="6.67" fill="#3A75C4" />
    </FlagFrame>
  );
}

export function FlagGN({ width = 24 }: { width?: number }): ReactNode {
  return (
    <FlagFrame width={width}>
      <rect width="10" height="20" fill="#CE1126" />
      <rect x="10" width="10" height="20" fill="#FCD116" />
      <rect x="20" width="10" height="20" fill="#009E49" />
    </FlagFrame>
  );
}

export function FlagNE({ width = 24 }: { width?: number }): ReactNode {
  return (
    <FlagFrame width={width}>
      <rect width="30" height="6.67" fill="#E05206" />
      <rect y="6.67" width="30" height="6.66" fill="#FFFFFF" />
      <rect y="13.33" width="30" height="6.67" fill="#0DB02B" />
      <circle cx="15" cy="10" r="3.4" fill="#E05206" />
    </FlagFrame>
  );
}

// RD Congo : diagonale rouge cernée de jaune sur champ bleu.
export function FlagCD({ width = 24 }: { width?: number }): ReactNode {
  return (
    <FlagFrame width={width}>
      <rect width="30" height="20" fill="#007FFF" />
      <polygon points="0,20 30,0 30,6 9,20" fill="#F7D618" />
      <polygon points="3,20 30,2 30,4 6,20" fill="#CE1021" />
      <Star x={7.5} y={6.5} size={8} fill="#F7D618" />
    </FlagFrame>
  );
}

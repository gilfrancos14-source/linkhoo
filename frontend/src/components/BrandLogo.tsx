import { useState } from 'react';

interface BrandLogoProps {
  /** Classes appliquées à l'image (le repli typographique garde la même hauteur visuelle). */
  className?: string;
  alt?: string;
}

/**
 * Logo du projet (public/logo.jpg).
 *
 * L'image est dotée d'un repli typographique « Linkhoo » : si le fichier ne
 * se charge pas (cache service worker obsolète, asset absent, réponse non
 * image mise en cache), la marque reste affichée au lieu d'une icône d'image
 * cassée. `width`/`height` sont déclarés pour éviter tout décalage de mise en
 * page au chargement.
 */
export default function BrandLogo({ className = 'sidebar-logo', alt = 'Logo Linkhoo' }: BrandLogoProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span
        className="flex items-center gap-1.5 text-[19px] font-extrabold leading-none tracking-tight text-navy"
        aria-label="Linkhoo"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-8 w-8 text-sky-600"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" />
          <circle cx="12" cy="9.5" r="2.5" />
        </svg>
        Link<span className="text-sky-600">hoo</span>
      </span>
    );
  }

  return (
    <img
      className={className}
      src="/logo.jpg"
      alt={alt}
      width={759}
      height={373}
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

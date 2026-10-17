import type { ReactNode } from 'react';

/** Enveloppe SVG commune aux pictogrammes de l'espace client. */
export default function Glyph({ children }: { children: ReactNode }) {
  return (
    <svg
      className="client-compte__glyph"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const glyphCalendar = (
  <>
    <rect x="3" y="5" width="18" height="16" rx="2.5" />
    <path d="M8 3v4M16 3v4M3 10.5h18" />
  </>
);

export const glyphStar = (
  <path d="M12 3.6l2.55 5.17 5.7.83-4.13 4.02.98 5.68L12 16.62 6.9 19.3l.98-5.68L3.75 9.6l5.7-.83z" />
);

export const glyphUser = (
  <>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" />
  </>
);

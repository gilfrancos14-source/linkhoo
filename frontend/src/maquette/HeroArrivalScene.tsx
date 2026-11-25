/**
 * Prototype : illustration vectorielle animée « quelqu'un entre dans une
 * maison ». Purement décoratif, bouclé, sans dépendance et respectueux de
 * prefers-reduced-motion (voir hero-arrival.css).
 */
export default function HeroArrivalScene() {
  return (
    <div className="hero-arrival" aria-hidden="true">
      <svg viewBox="70 10 250 235" role="presentation">
        <defs>
          <linearGradient id="ha-wall" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff8ee" />
            <stop offset="1" stopColor="#fbe6cd" />
          </linearGradient>
          <linearGradient id="ha-wall-side" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#efd5b6" />
            <stop offset="1" stopColor="#d9ab7e" />
          </linearGradient>
          <linearGradient id="ha-roof" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ff9b5c" />
            <stop offset="1" stopColor="#e95a2b" />
          </linearGradient>
          <linearGradient id="ha-roof-side" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#e35b2a" />
            <stop offset="1" stopColor="#b93d18" />
          </linearGradient>
          <radialGradient id="ha-glow">
            <stop offset="0" stopColor="#ffd488" stopOpacity="0.95" />
            <stop offset="1" stopColor="#ffd488" stopOpacity="0" />
          </radialGradient>
          <filter id="ha-shadow" x="-30%" y="-30%" width="160%" height="170%">
            <feDropShadow dx="0" dy="7" stdDeviation="7" floodColor="#7c4a2d" floodOpacity="0.16" />
          </filter>
        </defs>

        {/* Sol et ombre portée */}
        <ellipse className="hero-arrival__ground" cx="176" cy="221" rx="112" ry="15" />
        <ellipse cx="176" cy="218" rx="92" ry="8" fill="#dbe3ee" opacity="0.75" />

        <g filter="url(#ha-shadow)">
          {/* Mur latéral (perspective) */}
          <polygon points="245,105 292,80 292,190 245,212" fill="url(#ha-wall-side)" />
          <polygon points="292,80 292,190 286,187 286,83" fill="#c99568" opacity="0.45" />

          {/* Façade + pignon */}
          <rect x="110" y="105" width="135" height="107" fill="url(#ha-wall)" />
          <polygon points="110,105 178,55 245,105" fill="url(#ha-wall)" />

          {/* Toit : versant latéral puis versant avant */}
          <polygon points="178,55 225,27 302,82 255,108" fill="url(#ha-roof-side)" />
          <polygon points="98,110 178,45 258,110" fill="url(#ha-roof)" />
          <polygon points="112,105 178,62 244,105" fill="url(#ha-wall)" />
          <path d="M98 110 178 45 258 110" fill="none" stroke="#c9431c" strokeWidth="3" strokeLinejoin="round" opacity="0.5" />

          {/* Fenêtre */}
          <rect x="124" y="128" width="34" height="34" rx="4" fill="#bfe6f5" stroke="#fff" strokeWidth="3" />
          <path d="M141 128v34M124 145h34" stroke="#fff" strokeWidth="3" />
          <rect x="258" y="120" width="22" height="30" rx="3" fill="#9fd4ea" stroke="#fff" strokeWidth="2.5" opacity="0.9" />

          {/* Porche et marches */}
          <path d="M148 212h66l12 9H136z" fill="#d8c3a5" />
          <path d="M136 221h90l10 7H128z" fill="#c9ad8a" />

          {/* Ouverture de la porte */}
          <path d="M160 212v-49a21 21 0 0 1 42 0v49z" fill="#5b3823" />
          <ellipse className="hero-arrival__glow" cx="181" cy="191" rx="34" ry="40" fill="url(#ha-glow)" />

          {/* Battant animé */}
          <g className="hero-arrival__door">
            <path d="M160 212v-49a21 21 0 0 1 42 0v49z" fill="#b9703f" stroke="#8d4d28" strokeWidth="2" />
            <circle cx="194" cy="186" r="2.6" fill="#ffd488" />
          </g>
        </g>

        {/* Visiteur qui entre */}
        <g className="hero-arrival__person">
          <ellipse className="hero-arrival__person-shadow" cx="0" cy="0" rx="13" ry="4" fill="#94a3b8" opacity="0.35" />
          <g transform="translate(0 -1)">
            <path className="hero-arrival__leg hero-arrival__leg--back" d="M-3 -8v10" stroke="#3f4d63" strokeWidth="4" strokeLinecap="round" />
            <path className="hero-arrival__leg hero-arrival__leg--front" d="M3 -8v10" stroke="#2f3a4d" strokeWidth="4" strokeLinecap="round" />
            <path d="M-8 -30q8-5 16 0l3 22h-22z" fill="#ff7a45" />
            <path className="hero-arrival__arm" d="M7 -27l7 10" stroke="#f0b49b" strokeWidth="3.5" strokeLinecap="round" />
            <path d="M-9 -27l-6 9" stroke="#f0b49b" strokeWidth="3.5" strokeLinecap="round" />
            <circle cx="0" cy="-38" r="9" fill="#f0b49b" />
            <path d="M-9 -40a9 9 0 0 1 18 0z" fill="#2f3a4d" />
          </g>
        </g>

        {/* Petits éclats décoratifs */}
        <g className="hero-arrival__sparkles" fill="#ff9b5c">
          <circle cx="286" cy="52" r="3" />
          <circle cx="78" cy="86" r="2.5" />
          <circle cx="304" cy="140" r="2" />
        </g>
      </svg>
    </div>
  );
}

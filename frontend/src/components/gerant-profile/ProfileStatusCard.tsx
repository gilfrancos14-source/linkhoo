import { FileText, Check } from 'lucide-react';

interface ProfileStatusCardProps {
  profileUpToDate: boolean;
}

/**
 * Carte de statut de profil (colonne droite, en haut).
 */
export function ProfileStatusCard({ profileUpToDate }: ProfileStatusCardProps) {
  return (
    <section className="relative h-[177px] overflow-hidden rounded-xl border border-[#EEF2F8] bg-white shadow-[0_2px_10px_rgba(20,40,90,0.04)]">
      <svg viewBox="0 0 381 177" preserveAspectRatio="xMaxYMin slice" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <linearGradient id="g-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#CDE7F6" /><stop offset="1" stopColor="#EAF5FB" />
          </linearGradient>
          <linearGradient id="g-sea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#A5CEE4" /><stop offset="1" stopColor="#6FA9C9" />
          </linearGradient>
          <linearGradient id="g-fade" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="1" />
            <stop offset=".6" stopColor="#fff" stopOpacity=".85" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect x="190" y="7" width="191" height="150" fill="#EDE6DA" />
        <rect x="215" y="12" width="150" height="90" fill="url(#g-sky)" />
        <rect x="215" y="68" width="150" height="34" fill="url(#g-sea)" />
        <g fill="#9DB3C0" opacity=".75">
          <rect x="232" y="58" width="7" height="11" /><rect x="243" y="62" width="9" height="7" />
          <rect x="330" y="60" width="8" height="9" /><rect x="341" y="63" width="10" height="6" />
        </g>
        <g stroke="#7B7F86" strokeWidth="3">
          <path d="M262 12v90M312 12v90M215 102h150M215 12h150" />
        </g>
        <path d="M190 7h32v112c-9-7-23-7-32 0z" fill="#E3D4BD" />
        <path d="M365 7h16v125h-16z" fill="#E3D4BD" />
        <path d="M246 122c32-16 92-14 135-2v57H238z" fill="#F7F3EC" />
        <path d="M262 138c34-9 74-7 119 3v36H255z" fill="#E7DFD2" />
        <rect x="290" y="116" width="34" height="12" rx="5" fill="#fff" opacity=".9" />
        <rect x="332" y="118" width="30" height="12" rx="5" fill="#EFE8DC" />
        <path d="M352 148h18l-3 18h-12z" fill="#C9CDD3" />
        <path d="M361 148c-12-12-14-26-6-36 6 10 10 22 6 36zM361 148c-8-12-18-18-24-16-4 10-12 18-24 16zM361 146c-14-4-22-12-22-20 10 2 20 8 22 20z" fill="#8FA58F" />
        <rect x="190" y="0" width="110" height="177" fill="url(#g-fade)" />
        <path d="M0 92C120 108 260 130 381 164V177H0z" fill="#fff" />
      </svg>

      <span
        className={`absolute left-[24px] top-[26px] grid h-[24px] w-[24px] place-items-center rounded-full ring-4 ring-white/80 ${profileUpToDate ? 'bg-[#27B585]' : 'bg-[#F26B1D]'}`}
      >
        {profileUpToDate ? (
          <Check size={12} className="stroke-white stroke-[3]" />
        ) : (
          <FileText size={12} className="stroke-white stroke-[3]" />
        )}
      </span>
      <div className="absolute bottom-[19px] left-[26px]">
        <h3 className="text-[13px] font-bold leading-5">
          {profileUpToDate ? 'Votre profil est à jour' : 'Complétez votre profil'}
        </h3>
        <p className="mt-[7px] text-[11px] leading-[19px] text-[#5F7396]">
          {profileUpToDate
            ? 'Vos informations sont complètes et visibles pour les voyageurs.'
            : 'Certaines informations sont manquantes ou en attente de validation.'}
        </p>
      </div>
    </section>
  );
}
